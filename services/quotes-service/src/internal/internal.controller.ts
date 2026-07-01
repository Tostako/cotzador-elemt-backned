import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { QuotesService } from '../quotes/quotes.service';
import { UpdatePaymentStatusDto } from '../quotes/quotes-internal.dto';
import { InternalApiKeyGuard } from '../common/internal-auth.guard';
import { Public } from '../common/public.decorator';

@Public()
@UseGuards(InternalApiKeyGuard)
@Controller('internal/quotes')
export class InternalController {
  constructor(private readonly quotes: QuotesService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotes.findOneInternal(id);
  }

  @Patch(':id/payment-status')
  updatePaymentStatus(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto) {
    return this.quotes.updatePaymentStatus(id, dto);
  }
}
