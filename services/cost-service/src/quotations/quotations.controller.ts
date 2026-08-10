import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { QuotationsService } from './quotations.service';
import { RegistrarLineaCotizacionDto } from './quotations.dto';

@Controller('costos')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post('projects/:projectId/quotations')
  crear(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.quotationsService.crear(user.shop_id, user.customer_id, projectId);
  }

  @Patch('quotations/:quotationId/lines/:lineId')
  registrarLinea(
    @CurrentUser() user: CurrentUserData,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: RegistrarLineaCotizacionDto,
  ) {
    return this.quotationsService.registrarLinea(user.shop_id, quotationId, lineId, dto);
  }

  @Post('quotations/:quotationId/lines/:lineId/apply-price')
  aplicarPrecioCotizado(
    @CurrentUser() user: CurrentUserData,
    @Param('quotationId', ParseUUIDPipe) quotationId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Query('dryRun') dryRun?: string,
    @Headers('x-confirmation-token') confirmationToken?: string,
  ) {
    return this.quotationsService.aplicarPrecioCotizado(
      user.shop_id,
      quotationId,
      lineId,
      user.email,
      dryRun === 'true' || dryRun === '1',
      confirmationToken,
    );
  }
}