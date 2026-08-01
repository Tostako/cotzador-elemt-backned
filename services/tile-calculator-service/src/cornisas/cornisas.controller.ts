import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CornisasService } from './cornisas.service';
import { CreateCornisasProjectDto, UpdateCornisasProjectDto } from './cornisas.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('tile-calculator/cornisas-projects')
export class CornisasController {
  constructor(private readonly service: CornisasService) {}

  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get() findAll(@CurrentUser() u: CurrentUserData) {
    return this.service.findAll(this.ctx(u));
  }

  @Get(':id') findOne(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.findOne(this.ctx(u), id);
  }

  @Post() create(@CurrentUser() u: CurrentUserData, @Body() dto: CreateCornisasProjectDto) {
    return this.service.create(this.ctx(u), dto);
  }

  @Put(':id') update(@CurrentUser() u: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateCornisasProjectDto) {
    return this.service.update(this.ctx(u), id, dto);
  }

  @Delete(':id') remove(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.remove(this.ctx(u), id);
  }

  @Post(':id/calculate') calculate(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.calculate(this.ctx(u), id);
  }
}
