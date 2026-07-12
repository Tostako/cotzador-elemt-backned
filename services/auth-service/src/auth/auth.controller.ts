import { Body, Controller, Get, HttpCode, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, LogoutDto, RefreshTokenDto, RegisterDto, ResetPasswordDto, SelectShopDto } from './auth.dto';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../common/current-user.decorator';

const REFRESH_COOKIE = 'refresh_token';

function extractRefresh(req: { cookies?: Record<string, string> }, dto?: { refresh_token?: string }): string | undefined {
  return req.cookies?.[REFRESH_COOKIE] ?? dto?.refresh_token;
}

function extractClientMeta(req: Request) {
  const ua = req.headers['user-agent'];
  return {
    ip: req.ip,
    userAgent: Array.isArray(ua) ? ua[0] : ua,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('customer/register')
  register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    return this.auth.register(dto, res, extractClientMeta(req));
  }

  @Public() @Post('customer/login')
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    return this.auth.login(dto, res, extractClientMeta(req));
  }

  /** Token pendiente: el guard deja pasar y leemos el email del token. */
  @Post('select-shop')
  selectShop(
    @Body() dto: SelectShopDto,
    @CurrentUser('email') email: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.auth.selectShop(email, dto.shop_slug, res, extractClientMeta(req));
  }

  @Public() @Post('customer/refresh')
  refresh(
    @Body() dto: RefreshTokenDto,
    @Query('shop_slug') shopSlug: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const token = extractRefresh(req, dto);
    return this.auth.refresh(token, shopSlug, res, extractClientMeta(req));
  }

  @Public() @Post('customer/logout')
  @HttpCode(204)
  async logout(
    @Body() dto: LogoutDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const token = extractRefresh(req, dto);
    await this.auth.logout(token, res);
  }

  @Get('me')
  me(
    @CurrentUser('customer_id') customerId: string,
    @CurrentUser('shop_id') shopId: string,
  ) {
    return this.auth.me(customerId, shopId);
  }

  @Patch('customer/reset-password')
  resetPassword(
    @CurrentUser('customer_id') customerId: string,
    @CurrentUser('shop_id') shopId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.auth.resetPassword(customerId, shopId, dto);
  }
}
