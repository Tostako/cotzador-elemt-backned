import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('costos/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('projects/:projectId/summary')
  async resumen(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() res: Response,
  ) {
    // Si el cliente envía el ETag correcto, responder 304 sin recalcular.
    if (ifNoneMatch) {
      const etagActual = await this.analyticsService.etagActual(user.shop_id, user.customer_id, projectId);
      if (ifNoneMatch.includes(etagActual)) {
        return res.status(HttpStatus.NOT_MODIFIED).end();
      }
    }

    const data = await this.analyticsService.resumen(user.shop_id, user.customer_id, projectId);
    return res.set('ETag', data.etag).header('Cache-Control', 'no-cache').json({ data });
  }

  @Get('projects/:projectId/by-chapters')
  porCapitulos(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.analyticsService.porCapitulos(user.shop_id, user.customer_id, projectId);
  }
}