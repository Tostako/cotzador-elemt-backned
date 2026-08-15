import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { TemplatesService } from './templates.service';
import {
  AplicarPlantillaDto,
  CreateTemplateDto,
  UpdateTemplateDto,
} from './templates.dto';

@Controller('costos')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get('templates')
  listar(@CurrentUser() user: CurrentUserData) {
    return this.templatesService.listar(user.shop_id);
  }

  @Post('templates')
  crear(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templatesService.crear(user.shop_id, user.customer_id, dto);
  }

  @Patch('templates/:id')
  actualizar(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.actualizar(user.shop_id, user.customer_id, id, dto);
  }

  @Delete('templates/:id')
  eliminar(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.templatesService.eliminar(user.shop_id, id);
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
