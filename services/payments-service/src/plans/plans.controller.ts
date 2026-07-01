import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PaymentPlanDto } from './plans.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('payment-plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}
  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get() findAll(@CurrentUser() u: CurrentUserData) { return this.plans.findAll(this.ctx(u)); }
  @Get(':id') findOne(@CurrentUser() u: CurrentUserData, @Param('id') id: string) { return this.plans.findOne(this.ctx(u), id); }
  @Post() create(@CurrentUser() u: CurrentUserData, @Body() dto: PaymentPlanDto) { return this.plans.create(this.ctx(u), dto); }
  @Put(':id') update(@CurrentUser() u: CurrentUserData, @Param('id') id: string, @Body() dto: PaymentPlanDto) { return this.plans.update(this.ctx(u), id, dto); }
  @Delete(':id') remove(@CurrentUser() u: CurrentUserData, @Param('id') id: string) { return this.plans.remove(this.ctx(u), id); }
  @Patch(':id/default') setDefault(@CurrentUser() u: CurrentUserData, @Param('id') id: string) { return this.plans.setDefault(this.ctx(u), id); }
}
