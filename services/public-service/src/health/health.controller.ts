import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '../common/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async health(@Res() res: Response) {
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'connected';
    } catch (err) {
      console.error('[HEALTH] DB check failed:', (err as Error).message);
    }

    const isHealthy = dbStatus === 'connected';
    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isHealthy ? 'ok' : 'degraded',
      service: 'public-service',
      db: dbStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
}
