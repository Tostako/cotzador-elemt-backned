import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateChapterDto,
  UpdateChapterDto,
  CreateApuDto,
  UpdateApuDto,
  DuplicarApuDto,
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

  @Get('catalog/counters')
  counters(
    @CurrentUser() user: CurrentUserData,
    @Query('projectId') projectId?: string,
  ) {
    return this.catalogService.counters(user.shop_id, projectId);
  }

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
    @Query('dryRun') dryRun?: string,
    @Headers('x-confirmation-token') confirmationToken?: string,
  ) {
    return this.catalogService.editarApuConImpacto(
      user.shop_id,
      id,
      dto,
      dryRun === 'true' || dryRun === '1',
      confirmationToken,
    );
  }

  @Get('apus/:id/impact')
  impactoApu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.impactoApu(user.shop_id, id);
  }

  @Post('apus/:id/duplicate')
  duplicarApu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicarApuDto,
  ) {
    return this.catalogService.duplicarApu(user.shop_id, id, dto);
  }

  @Delete('apus/:id')
  eliminarApu(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalogService.eliminarApu(user.shop_id, id);
  }

  // ---- HU-13: importación masiva -----------------------------------------

  @Post('catalog/apus/import')
  @UseInterceptors(FileInterceptor('archivo'))
  previsualizarImport(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file?: { buffer?: Buffer },
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        error: 'ARCHIVO_REQUERIDO',
        mensaje: 'Envíe el archivo XLSX en el campo "archivo"',
      });
    }
    return this.catalogService.previsualizarImportacion(user.shop_id, file.buffer);
  }

  @Post('catalog/imports/:jobId/confirm')
  confirmarImport(
    @CurrentUser() user: CurrentUserData,
    @Param('jobId') jobId: string,
  ) {
    return this.catalogService.confirmarImportacion(user.shop_id, jobId);
  }
}