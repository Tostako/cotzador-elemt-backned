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
import { SuppliesService } from './supplies.service';
import {
  CreateSupplyDto,
  UpdateSupplyDto,
  CreatePriceDto,
  ListPricesDto,
  RecargaMasivaDto,
} from './supplies.dto';

@Controller('costos/supplies')
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