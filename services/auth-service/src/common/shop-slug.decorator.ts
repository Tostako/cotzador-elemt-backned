import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Resuelve el tenant para rutas públicas: ?shop_slug=, X-Shop-Slug o default. */
export const ShopSlug = createParamDecorator((_d, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return (req.query?.shop_slug as string) ?? (req.headers['x-shop-slug'] as string) ?? 'elemet-haus';
});
