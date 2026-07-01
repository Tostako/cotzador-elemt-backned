import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const start = Date.now();
    const requestId = (req.headers['x-request-id'] as string) ?? 'no-request-id';
    const method = req.method;
    const url = req.url;
    const shopSlug = (req.headers['x-shop-slug'] as string) ?? (req.query.shop_slug as string) ?? '-';
    const customerId = ((req as any).user as any)?.customer_id ?? '-';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const status = req.res?.statusCode ?? 200;
          this.logger.log(
            `[${requestId}] ${method} ${url} | shop=${shopSlug} | customer=${customerId} | status=${status} | ${duration}ms`,
          );
        },
        error: (err: any) => {
          const duration = Date.now() - start;
          const status = err?.status ?? 500;
          this.logger.error(
            `[${requestId}] ${method} ${url} | shop=${shopSlug} | customer=${customerId} | status=${status} | ${duration}ms | error=${err.message}`,
            err.stack,
          );
        },
      }),
    );
  }
}
