import { Body, Controller, Get, Patch, Post, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, ResetPasswordDto, SelectShopDto } from './auth.dto';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('customer/register')
  register(@Body() dto: RegisterDto) {
    console.log('[AUTH-CONTROLLER] register body:', JSON.stringify(dto));
    return this.auth.register(dto);
  }

  @Public() @Post('debug')
  debug(@Body() body: any, @Request() req: any) {
    return {
      method: req.method,
      url: req.url,
      path: req.path,
      headers: req.headers,
      body,
    };
  }

  @Public() @Post('customer/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  /** Token pendiente: el guard deja pasar y leemos el email del token. */
  @Post('select-shop')
  selectShop(@Body() dto: SelectShopDto, @CurrentUser('email') email: string) {
    return this.auth.selectShop(email, dto.shop_slug);
  }

  @Get('me')
  me(@CurrentUser('customer_id') customerId: string) {
    return this.auth.me(customerId);
  }

  @Public() @Patch('customer/reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}
