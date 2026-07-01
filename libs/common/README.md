# libs/common

Código compartido por todos los microservicios (NestJS). Cada servicio recibe
una copia en `src/common/` (ver scripts de build) para poder construir su imagen
Docker de forma independiente:

- `jwt-auth.guard.ts` — valida el JWT y adjunta `req.user`.
- `response.interceptor.ts` — envuelve respuestas en `{ data }`.
- `all-exceptions.filter.ts` — normaliza errores a `{ error }`.
- `current-user.decorator.ts` — `@CurrentUser()` inyecta el usuario.
- `shop-slug.decorator.ts` — `@ShopSlug()` resuelve el tenant en rutas públicas.
- `public.decorator.ts` — `@Public()` marca rutas sin auth.
