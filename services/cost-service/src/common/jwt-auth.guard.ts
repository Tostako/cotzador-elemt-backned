import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { IS_PUBLIC_KEY } from './public.decorator';

interface JwtPayload {
  sub: string;
  customer_id?: string;
  shop_id?: string;
  email: string;
  role?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed authorization header');
    }
    try {
      const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET as string) as JwtPayload;
      if (!payload.shop_id) {
        throw new UnauthorizedException('Token incompleto: falta el contexto de tienda');
      }
      req.user = {
        id: payload.sub,
        customer_id: payload.customer_id ?? payload.sub,
        shop_id: payload.shop_id,
        email: payload.email,
        role: payload.role ?? 'customer',
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}