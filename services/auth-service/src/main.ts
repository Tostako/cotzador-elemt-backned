import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { LoggingInterceptor } from './common/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // Middleware de debug: loguea headers y URL de TODO lo que entra al servicio
  // NO leemos el body aquí para no consumir el stream antes de que NestJS lo parseé.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[AUTH-DEBUG-IN] ${req.method} ${req.url} | path=${req.path} | content-type=${req.headers['content-type']} | content-length=${req.headers['content-length']} | host=${req.headers.host}`);
    next();
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log('auth-service escuchando en puerto ' + port);
}
bootstrap();
