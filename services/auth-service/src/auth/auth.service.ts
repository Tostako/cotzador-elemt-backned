import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Shop } from '../entities/shop.entity';
import { Customer } from '../entities/customer.entity';
import { LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';

@Injectable()
export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_EXPIRES_IN: jwt.SignOptions['expiresIn'] =
    (process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']) ?? '7d';

  constructor(
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
  ) {
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  private async resolveShop(slug: string): Promise<Shop> {
    const shop = await this.shops.findOne({ where: { slug, is_active: true } });
    if (!shop) throw new NotFoundException(`Tienda '${slug}' no encontrada`);
    return shop;
  }

  private sign(c: Customer): string {
    return jwt.sign(
      {
        sub: c.id,
        customer_id: c.id,
        shop_id: c.shop_id,
        email: c.email,
        name: c.name,
        role: 'customer',
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN },
    );
  }

  async register(dto: RegisterDto): Promise<{ token: string }> {
    const shop = await this.resolveShop(dto.shop_slug);
    const exists = await this.customers.findOne({
      where: { shop_id: shop.id, email: dto.email },
    });
    if (exists) throw new BadRequestException('El email ya está registrado en esta tienda');

    const customer = this.customers.create({
      shop_id: shop.id,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      password: await bcrypt.hash(dto.password, 10),
    });
    const saved = await this.customers.save(customer);
    return { token: this.sign(saved) };
  }

  async login(dto: LoginDto): Promise<{ token: string }> {
    const shop = await this.resolveShop(dto.shop_slug);
    const customer = await this.customers
      .createQueryBuilder('c')
      .addSelect('c.password')
      .where('c.shop_id = :shopId AND c.email = :email', { shopId: shop.id, email: dto.email })
      .getOne();
    if (!customer?.password || !(await bcrypt.compare(dto.password, customer.password))) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    await this.customers.update(customer.id, { last_login: new Date() });
    return { token: this.sign(customer) };
  }

  /** Canjea un token pendiente (solo email) por uno definitivo ligado a la tienda. */
  async selectShop(email: string, slug: string): Promise<{ token: string }> {
    const shop = await this.resolveShop(slug);
    const customer = await this.customers.findOne({ where: { shop_id: shop.id, email } });
    if (!customer) throw new NotFoundException('El cliente no existe en esta tienda');
    return { token: this.sign(customer) };
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
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    await this.customers.update(customer.id, {
      password: await bcrypt.hash(dto.new_password, 10),
    });
    return { ok: true };
  }
}
