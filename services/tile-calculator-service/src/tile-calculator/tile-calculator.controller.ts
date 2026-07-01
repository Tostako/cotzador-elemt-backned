import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { TileCalculatorService } from './tile-calculator.service';
import { CreateProjectDto, UpdateProjectDto } from './tile-calculator.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('tile-calculator/projects')
export class TileCalculatorController {
  constructor(private readonly service: TileCalculatorService) {}

  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get() findAll(@CurrentUser() u: CurrentUserData) {
    return this.service.findAll(this.ctx(u));
  }

  @Get(':id') findOne(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.findOne(this.ctx(u), id);
  }

  @Post() create(@CurrentUser() u: CurrentUserData, @Body() dto: CreateProjectDto) {
    return this.service.create(this.ctx(u), dto);
  }

  @Put(':id') update(@CurrentUser() u: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(this.ctx(u), id, dto);
  }

  @Delete(':id') remove(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.service.remove(this.ctx(u), id);
  }
}
