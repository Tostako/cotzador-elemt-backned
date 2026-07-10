import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, ResetPasswordDto, SelectShopDto } from './auth.dto';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Post('customer/register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
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
