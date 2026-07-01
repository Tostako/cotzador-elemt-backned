import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './payments.dto';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';

@Controller('quotes/:quoteId/payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  private ctx(u: CurrentUserData) { return { shop_id: u.shop_id, customer_id: u.customer_id }; }

  @Get() list(@CurrentUser() u: CurrentUserData, @Param('quoteId') quoteId: string) {
    return this.payments.list(this.ctx(u), quoteId);
  }
  @Get('installments') installments(@CurrentUser() u: CurrentUserData, @Param('quoteId') quoteId: string) {
    return this.payments.getInstallments(this.ctx(u), quoteId);
  }
  @Post() create(@CurrentUser() u: CurrentUserData, @Param('quoteId') quoteId: string, @Body() dto: CreatePaymentDto) {
    return this.payments.create(this.ctx(u), quoteId, dto);
  }
  @Delete(':paymentId') remove(@CurrentUser() u: CurrentUserData, @Param('quoteId') quoteId: string, @Param('paymentId') paymentId: string) {
    return this.payments.remove(this.ctx(u), quoteId, paymentId);
  }
}
