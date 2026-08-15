import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

function humanizeValidation(message: string): string {
  const rules: [RegExp, string][] = [
    [/^(.*) must be an email$/i, '$1 no es un email válido'],
    [/^(.*) must be a string$/i, '$1 debe ser texto'],
    [/^(.*) must be a number$/i, '$1 debe ser un número'],
    [/^(.*) must be an integer$/i, '$1 debe ser un número entero'],
    [/^(.*) must be a boolean$/i, '$1 debe ser verdadero o falso'],
    [/^(.*) must be a uuid$/i, '$1 no tiene un formato válido'],
    [/^(.*) must be an object$/i, '$1 debe ser un objeto'],
    [/^(.*) should not be empty$/i, '$1 no puede estar vacío'],
    [/^(.*) must be longer than or equal to (\d+) characters$/i, '$1 debe tener al menos $2 caracteres'],
    [/^(.*) must be shorter than or equal to (\d+) characters$/i, '$1 debe tener como máximo $2 caracteres'],
    [/^(.*) must be longer than or equal to (\d+)$/i, '$1 debe ser mayor o igual a $2'],
    [/^(.*) must be shorter than or equal to (\d+)$/i, '$1 debe ser menor o igual a $2'],
  ];

  for (const [regex, replacement] of rules) {
    if (regex.test(message)) {
      return message.replace(regex, replacement).replace(/^\w/, (c) => c.toUpperCase());
    }
  }

  return message
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Normaliza todos los errores al formato { error, requestId, timestamp }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = (req.headers['x-request-id'] as string) ?? 'no-request-id';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let codigo: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as string | Record<string, unknown>;
      const extra: Record<string, unknown> = {};
      if (typeof body === 'object' && body !== null) {
        if (typeof body.mensaje === 'string') message = body.mensaje;
        else if (typeof body.message === 'string') message = humanizeValidation(body.message);
        else if (Array.isArray(body.message)) message = humanizeValidation(body.message.join(', '));
        if (typeof body.codigo === 'string') codigo = body.codigo;
        else if (typeof body.error === 'string') codigo = body.error;
        // Propaga campos adicionales (p.ej. filas_con_error) sin perder el envelope.
        for (const [k, v] of Object.entries(body)) {
          if (!['message', 'mensaje', 'codigo', 'error', 'statusCode'].includes(k)) extra[k] = v;
        }
      }
      this.logger.error(`[${requestId}] ${req.method} ${req.url} -> ${status}: ${message}`);
      res.status(status).json({
        error: message,
        requestId,
        timestamp: new Date().toISOString(),
        ...(codigo ? { codigo } : {}),
        ...(Object.keys(extra).length ? extra : {}),
      });
      return;
    } else if (exception instanceof Error) {
      this.logger.error(`[${requestId}] ${exception.message}`, exception.stack);
    }

    this.logger.error(`[${requestId}] ${req.method} ${req.url} -> ${status}: ${message}`);

    res.status(status).json({
      error: message,
      requestId,
      timestamp: new Date().toISOString(),
      ...(codigo ? { codigo } : {}),
    });
  }
}