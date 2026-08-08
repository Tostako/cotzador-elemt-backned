import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { TemplatesService } from './templates.service';
import { AplicarPlantillaDto } from './templates.dto';

@Controller('costos')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get('templates')
  listar(@CurrentUser() user: CurrentUserData) {
    return this.templatesService.listar(user.shop_id);
  }

  @Post('projects/:projectId/apply-template')
  aplicar(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AplicarPlantillaDto,
  ) {
    return this.templatesService.aplicar(user.shop_id, user.customer_id, projectId, dto, user.email);
  }
}