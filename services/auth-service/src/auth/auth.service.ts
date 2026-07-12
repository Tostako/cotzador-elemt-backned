import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'crypto';
import { Response } from 'express';
import { Shop } from '../entities/shop.entity';
import { Customer } from '../entities/customer.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface AccessPayload {
  sub: string;
  customer_id: string;
  shop_id: string;
  email: string;
  name: string;
  role: string;
}

interface RefreshPayload {
  sub: string;
  customer_id: string;
  shop_id: string;
  email: string;
  jti: string;
  type: 'refresh';
}

const REFRESH_COOKIE = 'refresh_token';

@Injectable()
export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private readonly JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] =
    (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '1d';
  private readonly JWT_REFRESH_EXPIRES_IN: jwt.SignOptions['expiresIn'] =
    (process.env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '7d';

  constructor(
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
  ) {
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    if (!this.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }

    // Limpieza periÃ³dica de refresh tokens expirados (cada 24h).
    setInterval(() => this.cleanupExpiredTokens(), 24 * 60 * 60 * 1000);
  }

  // ===================== Helpers =====================

  private async resolveShop(slug: string): Promise<Shop> {
    const shop = await this.shops.findOne({ where: { slug, is_active: true } });
    if (!shop) throw new NotFoundException(`Tienda '${slug}' no encontrada`);
    return shop;
  }

  private accessExpiresInSeconds(): number {
    const value = typeof this.JWT_EXPIRES_IN === 'number'
      ? this.JWT_EXPIRES_IN
      : this.parseExpiresIn(this.JWT_EXPIRES_IN);
    return value;
  }

  private refreshExpiresInSeconds(): number {
    const value = typeof this.JWT_REFRESH_EXPIRES_IN === 'number'
      ? this.JWT_REFRESH_EXPIRES_IN
      : this.parseExpiresIn(this.JWT_REFRESH_EXPIRES_IN);
    return value;
  }

  private parseExpiresIn(input: string | number | undefined): number {
    if (typeof input === 'number') return input;
    if (!input) return 86400; // fallback 1 dÃ­a
    const match = String(input).trim().match(/^(\d+)\s*([smhdw]?)$/i);
    if (!match) return 86400;
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers: Record<string, number> = {
      s: 1, m: 60, h: 3600, d: 86400, w: 604800,
    };
    return amount * (multipliers[unit] ?? 1);
  }

  private signAccessToken(c: Customer): string {
    return jwt.sign(
      {
        sub: c.id,
        customer_id: c.id,
        shop_id: c.shop_id,
        email: c.email,
        name: c.name,
        role: 'customer',
      } as AccessPayload,
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN },
    );
  }

  private signRefreshToken(c: Customer, jti: string): string {
    return jwt.sign(
      {
        sub: c.id,
        customer_id: c.id,
        shop_id: c.shop_id,
        email: c.email,
        jti,
        type: 'refresh',
      } as RefreshPayload,
      this.JWT_REFRESH_SECRET,
      { expiresIn: this.JWT_REFRESH_EXPIRES_IN },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private setRefreshCookie(res: Response, token: string, maxAgeMs: number) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/auth/customer',
      maxAge: maxAgeMs,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/auth/customer',
    });
  }

  private async createRefreshTokenRecord(
    customer: Customer,
    token: string,
    replacedBy?: string,
    req?: { ip?: string; userAgent?: string },
  ): Promise<RefreshToken> {
    const now = new Date();
    const expiresInMs = this.refreshExpiresInSeconds() * 1000;
    const payload = jwt.decode(token) as RefreshPayload;

    const record = this.refreshTokens.create({
      customer_id: customer.id,
      shop_id: customer.shop_id,
      token_hash: this.hashToken(token),
      jti: payload.jti,
      issued_at: now,
      expires_at: new Date(now.getTime() + expiresInMs),
      replaced_by: replacedBy ?? null,
      ip_address: req?.ip ?? null,
      user_agent: req?.userAgent ?? null,
    });
    return this.refreshTokens.save(record);
  }

  private async revokeFamily(customerId: string) {
    await this.refreshTokens.update(
      { customer_id: customerId, revoked_at: IsNull() },
      { revoked_at: new Date() },
    );
  }

  private async cleanupExpiredTokens() {
    try {
      const result = await this.refreshTokens
        .createQueryBuilder()
        .delete()
        .where('expires_at < NOW()')
        .orWhere('revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL \'30 days\'')
        .execute();
      if (result.affected) {
        console.log(`[AUTH] Limpieza de refresh tokens: ${result.affected} eliminados`);
      }
    } catch (err) {
      console.error('[AUTH] Error limpiando refresh tokens:', err);
    }
  }

  // ===================== PÃºblico =====================

  private async buildTokenPair(
    customer: Customer,
    res: Response,
    req?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const accessToken = this.signAccessToken(customer);
    const jti = randomUUID();
    const refreshToken = this.signRefreshToken(customer, jti);

    await this.createRefreshTokenRecord(customer, refreshToken, undefined, req);
    this.setRefreshCookie(res, refreshToken, this.refreshExpiresInSeconds() * 1000);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.accessExpiresInSeconds(),
    };
  }

  async register(
    dto: RegisterDto,
    res: Response,
    req?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair & { token_type: string }> {
    const shop = await this.resolveShop(dto.shop_slug);
    const exists = await this.customers.findOne({
      where: { shop_id: shop.id, email: dto.email },
    });
    if (exists) throw new BadRequestException('El email ya estÃ¡ registrado en esta tienda');

    const customer = this.customers.create({
      shop_id: shop.id,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      password: await bcrypt.hash(dto.password, 10),
    });
    const saved = await this.customers.save(customer);
    const pair = await this.buildTokenPair(saved, res, req);
    return { ...pair, token_type: 'Bearer' };
  }

  async login(
    dto: LoginDto,
    res: Response,
    req?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair & { token_type: string }> {
    const shop = await this.resolveShop(dto.shop_slug);
    const customer = await this.customers
      .createQueryBuilder('c')
      .addSelect('c.password')
      .where('c.shop_id = :shopId AND c.email = :email', { shopId: shop.id, email: dto.email })
      .getOne();
    if (!customer?.password || !(await bcrypt.compare(dto.password, customer.password))) {
      throw new UnauthorizedException('Email o contraseÃ±a incorrectos');
    }
    await this.customers.update(customer.id, { last_login: new Date() });
    const pair = await this.buildTokenPair(customer, res, req);
    return { ...pair, token_type: 'Bearer' };
  }

  /** Canjea un token pendiente (solo email) por uno definitivo ligado a la tienda. */
  async selectShop(
    email: string,
    slug: string,
    res: Response,
    req?: { ip?: string; userAgent?: string },
  ): Promise<TokenPair & { token_type: string }> {
    const shop = await this.resolveShop(slug);
    const customer = await this.customers.findOne({ where: { shop_id: shop.id, email } });
    if (!customer) throw new NotFoundException('El cliente no existe en esta tienda');
    const pair = await this.buildTokenPair(customer, res, req);
    return { ...pair, token_type: 'Bearer' };
  }

  async refresh(
    incomingRefresh: string | undefined,
    shopSlug: string,
    res: Response,
    req?: { ip?: string; userAgent?: string },
  ): Promise<{ access_token: string; expires_in: number }> {
    if (!incomingRefresh) {
      throw new UnauthorizedException('Refresh token invÃ¡lido o expirado');
    }

    let payload: RefreshPayload;
    try {
      payload = jwt.verify(incomingRefresh, this.JWT_REFRESH_SECRET) as RefreshPayload;
    } catch {
      throw new UnauthorizedException('Refresh token invÃ¡lido o expirado');
    }

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Refresh token invÃ¡lido o expirado');
    }

    const shop = await this.resolveShop(shopSlug);
    if (payload.shop_id !== shop.id) {
      throw new UnauthorizedException('Refresh token invÃ¡lido o expirado');
    }

    const hash = this.hashToken(incomingRefresh);
    const record = await this.refreshTokens.findOne({ where: { token_hash: hash } });

    // Token vÃ¡lido pero no encontrado en DB = posiblemente ya fue eliminado/expirado.
    if (!record) {
      throw new UnauthorizedException('Refresh token invÃ¡lido o expirado');
    }

    const now = new Date();
    if (record.revoked_at || record.expires_at < now) {
      // Intento de reuso: revocar toda la familia.
      await this.revokeFamily(record.customer_id);
      throw new UnauthorizedException('Refresh token invÃ¡lido o expirado');
    }

    if (record.replaced_by) {
      // El token ya fue rotado anteriormente: posible robo.
      await this.revokeFamily(record.customer_id);
      throw new UnauthorizedException('Refresh token invÃ¡lido o expirado');
    }

    const customer = await this.customers.findOne({
      where: { id: payload.customer_id, shop_id: shop.id },
    });
    if (!customer) {
      throw new UnauthorizedException('Refresh token invÃ¡lido o expirado');
    }

    // Rotar: crear nuevo refresh token.
    const newJti = randomUUID();
    const newRefreshToken = this.signRefreshToken(customer, newJti);
    const newRecord = await this.createRefreshTokenRecord(customer, newRefreshToken, undefined, req);

    // Marcar el anterior como reemplazado y revocado.
    await this.refreshTokens.update(record.id, {
      replaced_by: newRecord.id,
      revoked_at: now,
    });

    this.setRefreshCookie(res, newRefreshToken, this.refreshExpiresInSeconds() * 1000);

    return {
      access_token: this.signAccessToken(customer),
      expires_in: this.accessExpiresInSeconds(),
    };
  }

  async logout(
    incomingRefresh: string | undefined,
    res: Response,
  ): Promise<void> {
    this.clearRefreshCookie(res);

    if (!incomingRefresh) return;

    try {
      const payload = jwt.verify(incomingRefresh, this.JWT_REFRESH_SECRET) as RefreshPayload;
      if (payload.type === 'refresh' && payload.jti) {
        const hash = this.hashToken(incomingRefresh);
        await this.refreshTokens.update(
          { token_hash: hash, revoked_at: IsNull() },
          { revoked_at: new Date() },
        );
      }
    } catch {
      // Ignorar errores de validaciÃ³n en logout: el cliente quiere salir de todos modos.
    }
  }

  async me(customerId: string, shopId: string): Promise<Customer> {
    const customer = await this.customers.findOne({
      where: { id: customerId, shop_id: shopId },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async resetPassword(
    customerId: string,
    shopId: string,
    dto: ResetPasswordDto,
  ): Promise<{ ok: true }> {
    const customer = await this.customers
      .createQueryBuilder('c')
      .addSelect('c.password')
      .where('c.id = :id AND c.shop_id = :shopId', { id: customerId, shopId })
      .getOne();
    if (!customer?.password) {
      throw new NotFoundException('Cliente no encontrado');
    }
    if (!(await bcrypt.compare(dto.old_password, customer.password))) {
      throw new UnauthorizedException('La contraseÃ±a actual no es correcta');
    }
    await this.customers.update(customer.id, {
      password: await bcrypt.hash(dto.new_password, 10),
    });
    return { ok: true };
  }
}
