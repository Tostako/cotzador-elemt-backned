# Despliegue en Render

> Nota: Render cobra por **Blueprint** y por **Private Services**. Esta guía usa el plan **gratuito** creando 8 Web Services públicos.

## Opción A: Blueprint (puede requerir tarjeta/plan)

1. Subí el repo a GitHub.
2. En Render, creá un nuevo **Blueprint**.
3. Seleccioná el repo.
4. Render leerá `render.yaml` y creará los 8 servicios.
5. Configurá las variables sensibles en cada servicio (ver abajo).

## Opción B: Manual (gratuito, recomendado)

Crear 8 Web Services uno por uno.

### Paso 1: Subir a GitHub

```bash
git add .
git commit -m "Backend ELEMENT listo para Render"
git push origin main
```

### Paso 2: Crear cada servicio

En Render, **New → Web Service → Build and deploy from a Git repository**.

Repetí 8 veces con estos datos:

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

#### `element-gateway`

```env
NODE_ENV=production
GATEWAY_PORT=3000
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
```

#### `element-config`

```env
NODE_ENV=production
PORT=3004
SUPABASE_DATABASE_URL=<URL de Supabase>
CONFIG_DATABASE_SCHEMA=config
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
```

#### `element-catalog`

```env
NODE_ENV=production
PORT=3005
SUPABASE_DATABASE_URL=<URL de Supabase>
CATALOG_DATABASE_SCHEMA=catalog
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
```

#### `element-public`

```env
NODE_ENV=production
PORT=3006
SUPABASE_DATABASE_URL=<URL de Supabase>
PUBLIC_DATABASE_SCHEMA=site
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
```

#### `element-tile`

```env
NODE_ENV=production
PORT=3007
SUPABASE_DATABASE_URL=<URL de Supabase>
TILE_CALCULATOR_DATABASE_SCHEMA=tile_calculator
JWT_SECRET=<secreto>
JWT_EXPIRES_IN=7d
```

### Paso 4: Configurar el frontend

```env
VITE_API_URL=https://element-gateway.onrender.com
```

El gateway acepta rutas con o sin `/api/v1`.

### Paso 5: Supabase Network Restrictions

En Supabase Dashboard, permití conexiones desde Render. Render publica sus IPs [aquí](https://docs.render.com/static-outbound-ip-addresses).

## Consideraciones del plan gratuito

- Los servicios se duermen tras 15 minutos de inactividad.
- El primer request después de inactividad puede tardar 30-60 segundos.
- El plan gratuito tiene 512MB RAM por servicio.
- 8 servicios free pueden consumir mucho tiempo de CPU; si ves límites, considerá consolidar o pasar a plan Starter.
