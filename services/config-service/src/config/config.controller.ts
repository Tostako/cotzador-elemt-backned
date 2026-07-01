import { Body, Controller, Get, Put } from '@nestjs/common';
import { ConfigService } from './config.service';
import { UpdateConfigDto } from './config.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('customer-config')
export class ConfigController {
  constructor(private readonly config: ConfigService) {}
  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get('me') getMine(@CurrentUser() u: CurrentUserData) { return this.config.getMine(this.ctx(u)); }
  @Put('me') updateMine(@CurrentUser() u: CurrentUserData, @Body() dto: UpdateConfigDto) {
    return this.config.updateMine(this.ctx(u), dto);
  }
}
