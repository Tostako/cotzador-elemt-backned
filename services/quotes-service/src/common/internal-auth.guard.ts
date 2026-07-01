import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest();
    const headerKey = request.headers['x-internal-api-key'];
    const expected = this.config.get<string>('INTERNAL_API_KEY');
    if (!expected || headerKey !== expected) {
      throw new UnauthorizedException('Clave interna inválida');
    }
    return true;
  }
}
