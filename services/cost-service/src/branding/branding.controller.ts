import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { BrandingService } from './branding.service';
import { ActualizarMarcaDto } from './branding.dto';

@Controller('costos/org/branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  obtener(@CurrentUser() user: CurrentUserData) {
    return this.brandingService.obtener(user.shop_id);
  }

  @Put()
  actualizar(@CurrentUser() user: CurrentUserData, @Body() dto: ActualizarMarcaDto) {
    return this.brandingService.actualizar(user.shop_id, dto);
  }
}