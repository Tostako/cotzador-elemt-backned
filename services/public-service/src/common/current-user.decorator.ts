import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  id: string;          // sub del token
  customer_id: string; // cliente del cotizador
  shop_id: string;     // tenant
  email: string;
  role: string;
}

/** Inyecta el usuario autenticado (o un campo suyo) en el controlador. */
export const CurrentUser = createParamDecorator(
  (field: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return field ? req.user?.[field] : req.user;
  },
);
