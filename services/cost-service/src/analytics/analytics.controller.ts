import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser, CurrentUserData } from '../common/current-user.decorator';
import { AnalyticsService } from './analytics.service';

const GRUPOS = ['MATERIAL', 'MANO_OBRA', 'EQUIPO', 'TRANSPORTE'];

@Controller('costos/projects/:projectId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
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

  @Get('by-chapters')
  porCapitulos(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.analyticsService.porCapitulos(user.shop_id, user.customer_id, projectId);
  }

  @Get('consolidated')
  consolidado(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('grupo') grupo: string,
  ) {
    if (!grupo || !GRUPOS.includes(grupo)) {
      throw new BadRequestException({
        error: 'GRUPO_INVALIDO',
        mensaje: 'El grupo debe ser MATERIAL, MANO_OBRA, EQUIPO o TRANSPORTE',
      });
    }
    return this.analyticsService.consolidado(user.shop_id, user.customer_id, projectId, grupo as any);
  }

  @Get('cost-intelligence')
  costIntelligence(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.analyticsService.costIntelligence(user.shop_id, user.customer_id, projectId);
  }

  @Get('alerts')
  alerts(
    @CurrentUser() user: CurrentUserData,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.analyticsService.alerts(user.shop_id, user.customer_id, projectId);
  }
}