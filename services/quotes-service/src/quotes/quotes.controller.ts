import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto, SelectPlanDto, UpdateQuoteDto } from './quotes.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get() findAll(@CurrentUser() u: CurrentUserData) { return this.quotes.findAll(this.ctx(u)); }

  @Get(':id') findOne(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.quotes.findOne(this.ctx(u), id);
  }

  @Post() create(@CurrentUser() u: CurrentUserData, @Body() dto: CreateQuoteDto) {
    return this.quotes.create(this.ctx(u), dto);
  }

  @Patch(':id') update(@CurrentUser() u: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotes.update(this.ctx(u), id, dto);
  }

  @Delete(':id') remove(@CurrentUser() u: CurrentUserData, @Param('id') id: string) {
    return this.quotes.remove(this.ctx(u), id);
  }

  @Post(':id/select-plan') selectPlan(
    @CurrentUser() u: CurrentUserData, @Param('id') id: string, @Body() dto: SelectPlanDto) {
    return this.quotes.selectPlan(this.ctx(u), id, dto.payment_plan_id);
  }
}
