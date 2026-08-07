import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateChapterDto,
  UpdateChapterDto,
  CreateApuDto,
  UpdateApuDto,
} from './catalog.dto';

@Controller('costos')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // ---- Capítulos ----------------------------------------------------------

  @Get('chapters')
  listarCapitulos(@CurrentUser() user: CurrentUserData) {
    return this.catalogService.listarCapitulos(user.shop_id);
  }

  @Post('chapters')
  crearCapitulo(@CurrentUser() user: CurrentUserData, @Body() dto: CreateChapterDto) {
    return this.catalogService.crearCapitulo(user.shop_id, dto);
  }

  @Patch('chapters/:id')
  actualizarCapitulo(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.catalogService.actualizarCapitulo(user.shop_id, id, dto);
  }

  @Delete('chapters/:id')
  eliminarCapitulo(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.eliminarCapitulo(user.shop_id, id);
  }

  // ---- APUs ---------------------------------------------------------------

  @Get('apus')
  listarApus(
    @CurrentUser() user: CurrentUserData,
    @Query() query: { chapter_id?: string; q?: string; page?: number; per_page?: number },
  ) {
    return this.catalogService.listarApus(user.shop_id, query);
  }

  @Get('apus/:id')
  obtenerApu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.obtenerApu(user.shop_id, id);
  }

  @Post('apus')
  crearApu(@CurrentUser() user: CurrentUserData, @Body() dto: CreateApuDto) {
    return this.catalogService.crearApu(user.shop_id, dto);
  }

  @Patch('apus/:id')
  actualizarApu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApuDto,
  ) {
    return this.catalogService.actualizarApu(user.shop_id, id, dto);
  }

  @Delete('apus/:id')
  eliminarApu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.eliminarApu(user.shop_id, id);
  }
}