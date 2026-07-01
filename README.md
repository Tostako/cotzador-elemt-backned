# Backend Microservicios — ELEMENT Cotizador

Backend en **NestJS + TypeScript** dividido en **7 microservicios + un API Gateway**.

Cada servicio es un proyecto Node independiente. Se levantan manualmente en
terminales locales y apuntan a **Supabase PostgreSQL** usando schemas separados.

El frontend sigue apuntando a una sola URL: el **Gateway**
(`http://localhost:3000/api/v1`).

## Documentos de diseño

- **[01-ENDPOINTS-API.md](./01-ENDPOINTS-API.md)** — Contrato de los endpoints.
- **[02-ARQUITECTURA-MICROSERVICIOS.md](./02-ARQUITECTURA-MICROSERVICIOS.md)** — Cómo se divide y por qué.

## Estructura

```
backend-microservicios/
├── package.json              # scripts para instalar/build/levantar todo
├── .env.example              # variables compartidas (Supabase, JWT, schemas)
├── README.md                 # este archivo
├── api-gateway/              # Express: enrutado a microservicios (puerto 3000)
└── services/
    ├── auth-service/         # :3001  schema element_auth — login, registro, tenant
    ├── quotes-service/       # :3002  schema quotes — cotizaciones
    ├── payments-service/     # :3003  schema payments — planes y abonos
    ├── config-service/       # :3004  schema config — parametrización del cotizador
    ├── catalog-service/      # :3005  schema catalog — materiales
    ├── public-service/       # :3006  schema site — landing pública
    └── tile-calculator-service/   # :3007  schema tile_calculator — calculadora de enchapes
```

## Mapa endpoint → microservicio

| Microservicio | Prefijos que atiende | Schema en Supabase |
|---|---|---|
| Auth & Tenant | `/auth/*`, `/customers/*` | `element_auth` |
| Quotes | `/quotes/*` (excepto `/payments`) | `quotes` |
| Payments & Plans | `/payment-plans/*`, `/quotes/:id/payments` | `payments` |
| Config | `/customer-config/*` | `config` |
| Catalog | `/quote-catalog/*` | `catalog` |
| Public/Site | `/public/*` | `site` |
| Tile Calculator | `/tile-calculator/*` | `tile_calculator` |

## Convenciones

- Respuestas envueltas en `{ "data": ... }`.
- Errores en `{ "error": "...", "requestId": "...", "timestamp": "..." }`.
- Auth con `Authorization: Bearer <jwt>`.
- Multi-tenant: cada query filtra por `shop_id` (+ `customer_id` donde aplica).

## Requisitos previos

- **Node.js 20**
- **Supabase** con las migraciones aplicadas
- Cuenta de **Render** (opcional, para deploy)

## Configuración inicial

### 1. Instalar dependencias de todos los servicios

Desde la raíz del backend:

```bash
cd "D:\git proyectos\cotizador backned\backend-microservicios"
npm install
npm run install:all
```

### 2. Aplicar migraciones en Supabase

```bash
cd "D:\git proyectos\cotizador backned\database"
copy connection\.env.example connection\.env
```

Edita `connection/.env` con tu URL de Supabase (directa, puerto 5432):

```env
DATABASE_URL=postgresql://postgres.ktmsemzpnpvlcyxjtqlf:Elemet1337_@aws-1-us-east-1.pooler.supabase.com:5432/postgres
```

Luego ejecuta:

```bash
npm install
npx ts-node -P tsconfig.json scripts/migrate.ts
npx ts-node -P tsconfig.json scripts/seed.ts
```

### 3. Crear archivos `.env` de cada servicio

> **Importante:** cada servicio lee su `.env` gracias a `@nestjs/config`. Si no existe
> el archivo o no tiene `DATABASE_URL`, el servicio no se conecta a Supabase.

```bash
cd "D:\git proyectos\cotizador backned\backend-microservicios"
copy .env.example .env
```

Edita `.env` y ajusta `JWT_SECRET` y `SUPABASE_DATABASE_URL` si es necesario.

Luego, en **cada servicio** copia su `.env.example` a `.env`:

```bash
cd api-gateway && copy .env.example .env
cd ../services/auth-service && copy .env.example .env
cd ../quotes-service && copy .env.example .env
cd ../payments-service && copy .env.example .env
cd ../config-service && copy .env.example .env
cd ../catalog-service && copy .env.example .env
cd ../public-service && copy .env.example .env
cd ../tile-calculator-service && copy .env.example .env
```

Cada `.env` de servicio ya viene con la URL de Supabase y su schema:

```env
DATABASE_URL=postgresql://postgres.ktmsemzpnpvlcyxjtqlf:Elemet1337_@aws-1-us-east-1.pooler.supabase.com:6543/postgres
DATABASE_SCHEMA=element_auth   # cambia según el servicio
JWT_SECRET=cambia-esto-por-un-secreto-largo
JWT_EXPIRES_IN=7d
```

Si actualizas `.env.example` más tarde, recuerda volver a copiarlo a cada servicio.

## Cómo levantar todo

### Opción A: una sola terminal con `concurrently` (recomendado)

```bash
cd "D:\git proyectos\cotizador backned\backend-microservicios"
npm run dev
```

Esto levanta el gateway y los 7 servicios en paralelo, todos en la misma terminal.

### Opción B: script de PowerShell

Haz doble clic en `start-all.ps1` o ejecútalo:

```powershell
.\start-all.ps1
```

Se abren 8 terminales independientes (una por servicio).

### Opción C: terminales separadas

Si prefieres ver logs separados, abre 8 terminales:

```bash
# Terminal 1 - Gateway
cd api-gateway && npm run start:dev

# Terminal 2 - Auth
cd services/auth-service && npm run start:dev

# Terminal 3 - Quotes
cd services/quotes-service && npm run start:dev

# Terminal 4 - Payments
cd services/payments-service && npm run start:dev

# Terminal 5 - Config
cd services/config-service && npm run start:dev

# Terminal 6 - Catalog
cd services/catalog-service && npm run start:dev

# Terminal 7 - Public
cd services/public-service && npm run start:dev

# Terminal 8 - Tile Calculator
cd services/tile-calculator-service && npm run start:dev
```

## Verificación

```bash
curl http://localhost:3000/health
```

Y para probar registro:

```bash
curl -X POST http://localhost:3000/api/v1/auth/customer/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan","email":"juan@correo.com","password":"secreto123","shop_slug":"elemet-haus"}'
```

## Build de producción

```bash
npm run build:all
```

## Deploy en Render

El archivo `render.yaml` define el Blueprint para subir todos los servicios a
Render. Conecta tu repo de GitHub a Render y usa "Blueprints" para desplegar.

Cada servicio usa su propio `package.json` y Dockerfile ya no es necesario;
Render puede ejecutar comandos de Node directamente usando el `start` script.

## Notas de diseño

- **Nada de FK entre servicios.** `shop_id`/`customer_id` viven en el schema
  `element_auth`; las demás tablas solo guardan el id y confían en el token.
- `public-service` mantiene un *read-model* mínimo de `shops` en el schema `site`.
- El bus de eventos (RabbitMQ/Kafka) es opcional y no bloquea el MVP.
