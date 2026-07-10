# Despliegue en Render

> Nota: Render cobra por **Blueprint** y por **Private Services**. Esta guÃ­a usa el plan **gratuito** creando 8 Web Services pÃºblicos.

## OpciÃ³n A: Blueprint (puede requerir tarjeta/plan)

1. SubÃ­ el repo a GitHub.
2. En Render, creÃ¡ un nuevo **Blueprint**.
3. SeleccionÃ¡ el repo.
4. Render leerÃ¡ `render.yaml` y crearÃ¡ los 8 servicios.
5. ConfigurÃ¡ las variables sensibles en cada servicio (ver abajo).

## OpciÃ³n B: Manual (gratuito, recomendado)

Crear 8 Web Services uno por uno.

### Paso 1: Subir a GitHub

```bash
git add .
git commit -m "Backend ELEMENT listo para Render"
git push origin main
```

### Paso 2: Crear cada servicio

En Render, **New â†’ Web Service â†’ Build and deploy from a Git repository**.

RepetÃ­ 8 veces con estos datos:

| Nombre | Root Directory | Build Command | Start Command |
|---|---|---|---|
| `element-gateway` | `api-gateway` | `npm install && npm run build` | `npm run start` |
| `element-auth` | `services/auth-service` | `npm install && npm run build` | `npm run start` |
| `element-quotes` | `services/quotes-service` | `npm install && npm run build` | `npm run start` |
| `element-payments` | `services/payments-service` | `npm install && npm run build` | `npm run start` |
| `element-config` | `services/config-service` | `npm install && npm run build` | `npm run start` |
| `element-catalog` | `services/catalog-service` | `npm install && npm run build` | `npm run start` |
| `element-public` | `services/public-service` | `npm install && npm run build` | `npm run start` |
| `element-tile` | `services/tile-calculator-service` | `npm install && npm run build` | `npm run start` |

### Paso 3: Variables de entorno

Las variables `SUPABASE_DATABASE_URL`, `JWT_SECRET` y `JWT_EXPIRES_IN` deben configurarse en **todos** los servicios.
Además, `JWT_SECRET` y `CORS_ALLOWED_ORIGINS` también van en el **gateway**.

> **Importante:** `JWT_SECRET` debe ser el **mismo valor** en el gateway y en todos los servicios. Si usás el Blueprint (`render.yaml`), se comparte mediante el grupo `element-secrets`.
>
> `CORS_ALLOWED_ORIGINS` ya está configurada como `https://cotzador-elemt.vercel.app` en el Blueprint.

#### Variables compartidas (grupo `element-secrets`)

```env
JWT_SECRET=cambia-esto-por-un-secreto-largo-y-seguro
SUPABASE_DATABASE_URL=postgresql://postgres.ktmsemzpnpvlcyxjtqlf:TU_PASSWORD@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

#### `element-gateway`

```env
NODE_ENV=production
GATEWAY_PORT=3000
JWT_SECRET=<secreto>
CORS_ALLOWED_ORIGINS=https://cotzador-elemt.vercel.app
AUTH_URL=https://element-auth.onrender.com
QUOTES_URL=https://element-quotes.onrender.com
PAYMENTS_URL=https://element-payments.onrender.com
CONFIG_URL=https://element-config.onrender.com
CATALOG_URL=https://element-catalog.onrender.com
PUBLIC_URL=https://element-public.onrender.com
TILE_CALCULATOR_URL=https://element-tile.onrender.com
```


#### `element-auth`

```env
NODE_ENV=production
PORT=3001
SUPABASE_DATABASE_URL=<URL de Supabase>
AUTH_DATABASE_SCHEMA=element_auth
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
CORS_ALLOWED_ORIGINS=https://cotzador-elemt.vercel.app
```

#### `element-quotes`

```env
NODE_ENV=production
PORT=3002
SUPABASE_DATABASE_URL=<URL de Supabase>
QUOTES_DATABASE_SCHEMA=quotes
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
INTERNAL_API_KEY=element-internal-key
CORS_ALLOWED_ORIGINS=https://cotzador-elemt.vercel.app
```

#### `element-payments`

```env
NODE_ENV=production
PORT=3003
SUPABASE_DATABASE_URL=<URL de Supabase>
PAYMENTS_DATABASE_SCHEMA=payments
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
QUOTES_INTERNAL_URL=https://element-quotes.onrender.com
INTERNAL_API_KEY=element-internal-key
CORS_ALLOWED_ORIGINS=https://cotzador-elemt.vercel.app
```

#### `element-config`

```env
NODE_ENV=production
PORT=3004
SUPABASE_DATABASE_URL=<URL de Supabase>
CONFIG_DATABASE_SCHEMA=config
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
CORS_ALLOWED_ORIGINS=https://cotzador-elemt.vercel.app
```

#### `element-catalog`

```env
NODE_ENV=production
PORT=3005
SUPABASE_DATABASE_URL=<URL de Supabase>
CATALOG_DATABASE_SCHEMA=catalog
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
CORS_ALLOWED_ORIGINS=https://cotzador-elemt.vercel.app
```

#### `element-public`

```env
NODE_ENV=production
PORT=3006
SUPABASE_DATABASE_URL=<URL de Supabase>
PUBLIC_DATABASE_SCHEMA=site
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
CORS_ALLOWED_ORIGINS=https://cotzador-elemt.vercel.app
```

#### `element-tile`

```env
NODE_ENV=production
PORT=3007
SUPABASE_DATABASE_URL=<URL de Supabase>
TILE_CALCULATOR_DATABASE_SCHEMA=tile_calculator
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
CORS_ALLOWED_ORIGINS=https://cotzador-elemt.vercel.app
```

### Paso 4: Configurar el frontend

```env
VITE_API_URL=https://element-gateway.onrender.com
VITE_FRONTEND_URL=https://cotzador-elemt.vercel.app
```

El gateway acepta rutas con o sin `/api/v1`.


### Paso 5: Supabase Network Restrictions

En Supabase Dashboard, permitÃ­ conexiones desde Render. Render publica sus IPs [aquÃ­](https://docs.render.com/static-outbound-ip-addresses).

## Consideraciones del plan gratuito

- Los servicios se duermen tras 15 minutos de inactividad.
- El primer request despuÃ©s de inactividad puede tardar 30-60 segundos.
- El plan gratuito tiene 512MB RAM por servicio.
- 8 servicios free pueden consumir mucho tiempo de CPU; si ves lÃ­mites, considerÃ¡ consolidar o pasar a plan Starter.

