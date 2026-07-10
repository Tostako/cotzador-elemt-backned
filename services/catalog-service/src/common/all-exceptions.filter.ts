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
  // Errores generados por class-validator traducidos a español amigable.
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

  // Fallback: convierte snake/camel a espacios y capitaliza.
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

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as string | { message?: string | string[] };
      const raw = typeof body === 'string' ? body : body.message ?? message;
      const joined = Array.isArray(raw) ? raw.join(', ') : raw;
      message = humanizeValidation(joined);
    } else if (exception instanceof Error) {
      // No exponer mensajes internos de errores no controlados (DB, red, etc.).
      this.logger.error(`[${requestId}] ${exception.message}`, exception.stack);
    }

    this.logger.error(`[${requestId}] ${req.method} ${req.url} -> ${status}: ${message}`);

    res.status(status).json({
      error: message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
