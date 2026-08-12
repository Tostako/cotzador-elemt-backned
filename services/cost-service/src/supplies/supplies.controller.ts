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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { SuppliesService } from './supplies.service';
import {
  CreateSupplyDto,
  UpdateSupplyDto,
  CreatePriceDto,
  ListPricesDto,
  RecargaMasivaDto,
} from './supplies.dto';

@Controller('costos/catalog/supplies')
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Get()
  listar(
    @CurrentUser() user: CurrentUserData,
    @Query() query: { grupo?: string; q?: string; page?: number; per_page?: number },
  ) {
    return this.suppliesService.listar(user.shop_id, query);
  }

  @Get(':id')
  obtener(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.suppliesService.obtener(user.shop_id, id);
  }

  @Post()
  crear(@CurrentUser() user: CurrentUserData, @Body() dto: CreateSupplyDto) {
    return this.suppliesService.crear(user.shop_id, dto);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplyDto,
  ) {
    return this.suppliesService.actualizar(user.shop_id, id, dto);
  }

  @Delete(':id')
  eliminar(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.suppliesService.eliminar(user.shop_id, id);
  }

  // ---- Importación masiva de insumos --------------------------------------

  @Post('import')
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
    return this.suppliesService.previsualizarImportacion(user.shop_id, file.buffer);
  }

  @Post('imports/:jobId/confirm')
  confirmarImport(
    @CurrentUser() user: CurrentUserData,
    @Param('jobId') jobId: string,
  ) {
    return this.suppliesService.confirmarImportacion(user.shop_id, jobId);
  }

  @Get(':id/usage')
  uso(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.suppliesService.uso(user.shop_id, id, projectId);
  }

  // ---- Precios ------------------------------------------------------------

  @Get(':id/prices')
  listarPrecios(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListPricesDto,
  ) {
    return this.suppliesService.listarPrecios(user.shop_id, id, query);
  }

  @Post(':id/prices')
  registrarPrecio(
    @CurrentUser() user: CurrentUserData,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePriceDto,
  ) {
    return this.suppliesService.registrarPrecio(user.shop_id, id, dto, user.email);
  }

  @Post('recalcula')
  recalc(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RecargaMasivaDto,
  ) {
    return this.suppliesService.recalcula(user.shop_id, dto as any);
  }
}