import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { GuardaescobasService } from './guardaescobas.service';
import { CreateGuardaescobasProjectDto, UpdateGuardaescobasProjectDto } from './guardaescobas.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('tile-calculator/guardaescobas-projects')
export class GuardaescobasController {
  constructor(private readonly service: GuardaescobasService) {}

  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get() findAll(@CurrentUser() u: CurrentUserData) {
    return this.service.findAll(this.ctx(u));
  }

  @Get(':id') findOne(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.findOne(this.ctx(u), id);
  }

  @Post() create(@CurrentUser() u: CurrentUserData, @Body() dto: CreateGuardaescobasProjectDto) {
    return this.service.create(this.ctx(u), dto);
  }

  @Put(':id') update(@CurrentUser() u: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateGuardaescobasProjectDto) {
    return this.service.update(this.ctx(u), id, dto);
  }

  @Delete(':id') remove(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.remove(this.ctx(u), id);
  }

  @Post(':id/calculate') calculate(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.calculate(this.ctx(u), id);
  }
}
