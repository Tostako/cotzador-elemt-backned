import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { HousePlansService } from './house-plans.service';
import { CreateHousePlanDto, UpdateHousePlanDto, ImportProjectDto } from './house-plans.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('tile-calculator/house-plans')
export class HousePlansController {
  constructor(private readonly service: HousePlansService) {}

  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get() findAll(@CurrentUser() u: CurrentUserData) {
    return this.service.findAll(this.ctx(u));
  }

  @Get(':id') findOne(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.findOne(this.ctx(u), id);
  }

  @Post() create(@CurrentUser() u: CurrentUserData, @Body() dto: CreateHousePlanDto) {
    return this.service.create(this.ctx(u), dto);
  }

  @Put(':id') update(@CurrentUser() u: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateHousePlanDto) {
    return this.service.update(this.ctx(u), id, dto);
  }

  @Delete(':id') remove(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.remove(this.ctx(u), id);
  }

  @Post(':id/import-to-tiles') importToTiles(
    @CurrentUser() u: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: ImportProjectDto,
  ) {
    return this.service.importToTiles(this.ctx(u), id, dto);
  }

  @Post(':id/import-to-guardaescobas') importToGuardaescobas(
    @CurrentUser() u: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: ImportProjectDto,
  ) {
    return this.service.importToGuardaescobas(this.ctx(u), id, dto);
  }

  @Post(':id/sync-to-tiles/:projectId') syncToTiles(
    @CurrentUser() u: CurrentUserData,
    @Param('id') id: string,
    @Param('projectId') projectId: string,
  ) {
    return this.service.syncToTiles(this.ctx(u), id, projectId);
  }

  @Post(':id/sync-to-guardaescobas/:projectId') syncToGuardaescobas(
    @CurrentUser() u: CurrentUserData,
    @Param('id') id: string,
    @Param('projectId') projectId: string,
  ) {
    return this.service.syncToGuardaescobas(this.ctx(u), id, projectId);
  }
}
