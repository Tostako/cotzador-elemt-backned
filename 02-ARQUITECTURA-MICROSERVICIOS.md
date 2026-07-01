# Arquitectura de Microservicios — ELEMENT Cotizador

Este documento divide los 37 endpoints del frontend en **microservicios independientes**, define qué brinda cada uno, cómo se comunican y cómo se construye el backend desde cero.

---

## 1. Por qué dividir (problema actual)

Hoy el frontend habla con **un solo backend monolítico** (`VITE_API_URL`) que resuelve todo: auth, cotizaciones, pagos, configuración y catálogo. Eso limita porque:

- Todo escala junto aunque solo el catálogo reciba carga.
- Un fallo en una parte (p. ej. el catálogo de materiales) puede tumbar el login.
- Es difícil que distintos equipos trabajen en paralelo.
- El modelo multi-tienda (`shop_slug`) obliga a tocar todo el monolito en cada cambio.

La solución es separar por **dominio de negocio**, poner un **API Gateway** al frente y que el frontend siga viendo una sola URL.

---

## 2. Diagrama de la arquitectura propuesta

```
                          ┌─────────────────────────┐
                          │   Frontend (React/Vite)  │
                          │   VITE_API_URL → Gateway │
                          └────────────┬────────────┘
                                       │  HTTPS + JWT + X-Shop-Slug
                                       ▼
                         ┌──────────────────────────────┐
                         │        API GATEWAY            │
                         │  • Enrutado a microservicios  │
                         │  • Valida JWT y shop_slug     │
                         │  • Rate limit / CORS / logs   │
                         │  • Envuelve respuestas {data} │
                         └──────┬───────┬───────┬────────┘
        ┌───────────────┬───────┘       │       └───────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 1. Auth &    │ │ 2. Quotes    │ │ 3. Payments  │ │ 4. Config    │ │ 5. Catalog   │
│   Tenant Svc │ │   Service    │ │   & Plans    │ │   Service    │ │   (Materiales)│
│              │ │              │ │   Service    │ │              │ │   Service    │
│ auth_db      │ │ quotes_db    │ │ payments_db  │ │ config_db    │ │ catalog_db   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        │
        ▼
┌──────────────┐ ┌──────────────┐        ┌──────────────────────────────┐
│ 6. Public/   │ │ 7. Tile      │        │   Bus de eventos (opcional)   │
│   Site Svc   │ │   Calculator │        │   RabbitMQ / Kafka / NATS     │
│ site_db      │ │   Svc        │        │   p.ej. "QuoteCreated"        │
│              │ │ tile_calc_db │        │                               │
└──────────────┘ └──────────────┘        └──────────────────────────────┘
```

Cada microservicio tiene **su propia base de datos** (patrón *database-per-service*). Nadie consulta la BD de otro: se comunican por HTTP (síncrono) o eventos (asíncrono).

---

## 3. Los microservicios y qué brinda cada uno

### Servicio 1 — Auth & Tenant Service
**Qué brinda:** identidad, sesiones y multi-tienda. Es la puerta de entrada y emite los JWT que el resto valida.

Endpoints que asume:

| Método | Ruta |
|--------|------|
| POST | `/auth/customer/register` |
| POST | `/auth/customer/login` |
| POST | `/auth/select-shop` |
| GET | `/auth/me` |
| PATCH | `/auth/customer/reset-password` |
| PATCH | `/customers/me` |

Responsabilidades clave:
- Hash de contraseñas (bcrypt/argon2), emisión y firma de JWT con `customer_id`, `email`, `name`, `role`, `shop_id`.
- Resolución del *tenant*: traducir `shop_slug` → `shop_id` y meterlo en el token (flujo `select-shop` para token pendiente).
- Es el **dueño del concepto de "tienda" y "cliente"**; expone (internamente) un endpoint tipo `GET /internal/shops/{slug}` para que el Gateway y otros servicios resuelvan el tenant.

BD `auth_db`: tablas `customers`, `shops`, `customer_shops`.

---

### Servicio 2 — Quotes Service
**Qué brinda:** ciclo de vida de las cotizaciones (el corazón del negocio).

| Método | Ruta |
|--------|------|
| GET | `/quotes` |
| GET | `/quotes/{id}` |
| POST | `/quotes` |
| PATCH | `/quotes/{id}` |
| DELETE | `/quotes/{id}` |
| POST | `/quotes/{id}/select-plan` |

Responsabilidades clave:
- Guardar el JSON completo del formulario (`data` → JSONB) y los campos calculados (`area`, `price`, `status`).
- Filtrar siempre por `customer_id` + `shop_id` del token (aislamiento multi-tenant).
- `select-plan` guarda la referencia `payment_plan_id` (el plan vive en el Servicio 3; aquí solo se referencia por id).
- Al crear una cotización publica un evento `QuoteCreated` (opcional) para que Payments u otros reaccionen.

BD `quotes_db`: tabla `quotes` (con `data` JSONB).

---

### Servicio 3 — Payments & Plans Service
**Qué brinda:** planes de pago reutilizables y registro de abonos por cotización.

| Método | Ruta |
|--------|------|
| GET / POST / PUT / DELETE | `/payment-plans`, `/payment-plans/{id}` |
| PATCH | `/payment-plans/{id}/default` |
| GET | `/quotes/{id}/payments` |
| POST | `/quotes/{id}/payments` |
| DELETE | `/quotes/{id}/payments/{paymentId}` |

Responsabilidades clave:
- Plantillas de plan (cuotas con `name`, `percentage`, `order`, `isDefault`).
- Registro de pagos reales por cuota (`installmentIndex`, `amount`, `method`, `status`, `paidAt`).
- Necesita validar que la cotización existe → llama por HTTP interno al Servicio 2 (`GET /internal/quotes/{id}`) o escucha el evento `QuoteCreated`.

BD `payments_db`: tablas `payment_plans`, `payment_plan_installments`, `quote_payments`.

> Nota de diseño: las rutas de pagos van bajo `/quotes/{id}/payments`. El **Gateway** las enruta a este servicio aunque la URL contenga `quotes`. Alternativa más limpia: exponerlas como `/payments?quote_id=`.

---

### Servicio 4 — Config Service
**Qué brinda:** toda la parametrización del cotizador por cliente (tarifas, paquetes, datos de factura, precios de estimación).

| Método | Ruta |
|--------|------|
| GET | `/customer-config/me` |
| PUT | `/customer-config/me` |

Responsabilidades clave:
- Almacenar la config como documento (snake_case): `services`, `sub_packages`, `complete_package`, `payment_plan`, `invoice`, `estimation`.
- Soportar guardados parciales (el front a veces manda solo una clave).
- Devolver opcionalmente el objeto `customer` anidado (puede pedirlo al Servicio 1).

BD `config_db`: tabla `customer_configs` (un documento JSONB por `customer_id` + `shop_id`).

---

### Servicio 5 — Catalog Service (Materiales)
**Qué brinda:** catálogo jerárquico de materiales y pedidos. Es el candidato #1 a separarse porque tiene su propio modelo (categorías → productos → precios → pedidos) y crece independiente.

| Método | Ruta |
|--------|------|
| GET / POST / DELETE | `/quote-catalog/categories` |
| GET / POST / DELETE | `/quote-catalog/products` |
| POST / PATCH / DELETE | `/quote-catalog/products/{id}/prices/...` |
| GET / POST | `/quote-catalog/orders` |

Responsabilidades clave:
- Comparar precios de la misma referencia entre ferreterías (`hardware_store`, `brand`, `price`).
- Calcular `lowest_price`, `prices_count`, subtotales y total de pedidos.
- Aislamiento por `shop_id`.

BD `catalog_db`: tablas `categories`, `products`, `prices`, `orders`, `order_items`.

---

### Servicio 6 — Public / Site Service
**Qué brinda:** contenido público de la landing (sin autenticación).

| Método | Ruta |
|--------|------|
| GET | `/public/site-config` |
| GET | `/public/landing-images` |

Responsabilidades clave:
- Servir branding/imágenes por `shop_slug` con caché agresivo (CDN).
- No requiere JWT → el Gateway lo deja pasar sin validar token.

BD `site_db`: tablas `site_configs`, `landing_images` (o directamente object storage para imágenes).

---

### Servicio 7 — Tile Calculator Service
**Qué brinda:** persistencia de los proyectos de la calculadora de enchapes (niveles, espacios, materiales, banco de sobrantes).

| Método | Ruta |
|--------|------|
| GET | `/tile-calculator/projects` |
| GET | `/tile-calculator/projects/:id` |
| POST | `/tile-calculator/projects` |
| PUT | `/tile-calculator/projects/:id` |
| DELETE | `/tile-calculator/projects/:id` |
| GET | `/tile-calculator/patterns` |
| POST | `/tile-calculator/calculate` |
| POST | `/tile-calculator/offcuts` |
| POST | `/tile-calculator/projects/:id/calculate` |

Responsabilidades clave:
- Guardar el estado completo de un proyecto como documento JSONB.
- El backend solo almacena; los cálculos geométricos corren en el frontend.
- Aislamiento por `shop_id` + `customer_id`.

BD `tile_calculator_db`: tabla `tile_projects`.

---

## 4. Tabla resumen: endpoint → microservicio

| Microservicio | Endpoints | BD propia |
|---------------|-----------|-----------|
| 1. Auth & Tenant | 6 (auth/*, customers/me) | `auth_db` |
| 2. Quotes | 6 (quotes/*) | `quotes_db` |
| 3. Payments & Plans | 8 (payment-plans/*, quotes/*/payments) | `payments_db` |
| 4. Config | 2 (customer-config/me) | `config_db` |
| 5. Catalog | 12 (quote-catalog/*) | `catalog_db` |
| 6. Public/Site | 2 (public/*) | `site_db` |
| 7. Tile Calculator | 9 (tile-calculator/*) | `tile_calculator_db` |

---

## 5. El API Gateway (pieza clave)

El frontend **no debe cambiar**: sigue apuntando `VITE_API_URL` a una sola URL (el Gateway). El Gateway:

1. **Enruta por prefijo** de ruta a cada microservicio:
   - `/auth/*`, `/customers/*` → Auth
   - `/quotes/*/payments`, `/payment-plans/*` → Payments
   - `/quotes/*` → Quotes
   - `/customer-config/*` → Config
   - `/quote-catalog/*` → Catalog
   - `/public/*` → Public
   - `/tile-calculator/*` → Tile Calculator
2. **Valida el JWT** una sola vez y propaga `customer_id` / `shop_id` a los servicios vía headers internos (p. ej. `X-Customer-Id`, `X-Shop-Id`), así los microservicios no re-validan firmas.
3. **Resuelve el tenant**: acepta `?shop_slug=`, `X-Shop-Slug` y el `shop_id` del token (las tres formas que ya manda el front).
4. **Normaliza respuestas** al formato `{ "data": ... }` y errores a `{ "error": "..." }`.
5. Aplica CORS, rate limit y logging centralizado.

Tecnologías típicas: Kong, Traefik, NGINX, o un Gateway propio en Node/Express o Go.

---

## 6. Comunicación entre servicios

- **Síncrona (HTTP interno):** cuando un servicio necesita un dato ya (Payments preguntando si la cotización existe). Usar endpoints `/internal/*` no expuestos por el Gateway.
- **Asíncrona (eventos):** para desacoplar. Ejemplos de eventos a publicar en RabbitMQ/Kafka/NATS:
  - `CustomerRegistered` (Auth) → Config crea la configuración por defecto del nuevo cliente.
  - `QuoteCreated` / `QuoteUpdated` (Quotes) → Payments y reportes reaccionan.
  - `PaymentRegistered` (Payments) → Quotes actualiza el `status` a `paid`.

Regla de oro: **un servicio nunca lee la BD de otro**. Si necesita datos, los pide por API o los recibe por evento.

---

## 7. Multi-tenant en cada servicio

Todos los datos se particionan por `shop_id`. Cada tabla de cada BD lleva una columna `shop_id` (y `customer_id` donde aplique), y **toda** query filtra por ella. El Gateway garantiza que el `shop_id` venga del token verificado, no del cliente, para evitar que una tienda vea datos de otra.

---

## 8. Stack sugerido para construir el backend

| Capa | Opción recomendada | Alternativas |
|------|--------------------|--------------|
| Lenguaje/Runtime | Node.js + TypeScript (NestJS) | Go, Python (FastAPI) |
| Base de datos | PostgreSQL (1 instancia por servicio o esquemas separados) | — |
| Datos JSON (`data`, config) | Columnas JSONB en Postgres | MongoDB para Catalog |
| Auth | JWT (jsonwebtoken) + bcrypt/argon2 | — |
| API Gateway | Kong / Traefik / NGINX | Gateway propio en Express |
| Mensajería | RabbitMQ | Kafka, NATS |
| Contenedores | Docker + docker-compose (ya existe en el repo) | Kubernetes en producción |
| Documentación API | OpenAPI/Swagger por servicio | — |

> El `docker-compose.yml` del repo ya contempla `saas-backend` + `db` + red `element-network`. El siguiente paso es reemplazar ese único `saas-backend` por los 6 servicios + gateway + sus BDs, todos en la misma red.

---

## 9. Orden de construcción recomendado

1. **Auth & Tenant** primero (todo depende de los JWT y del `shop_id`).
2. **API Gateway** apuntando solo a Auth, para validar el flujo de login/registro/select-shop end-to-end con el frontend actual.
3. **Config** (lo necesita el cotizador para funcionar).
4. **Quotes** + **Payments & Plans** (núcleo del negocio).
5. **Catalog** (materiales).
6. **Public/Site** (landing).
7. **Tile Calculator** (calculadora de enchapes).
8. Añadir el **bus de eventos** cuando se quiera desacoplar (no es bloqueante para el MVP).

En cada paso el frontend no se modifica: solo se va ampliando lo que el Gateway sabe enrutar.
