# Documentación de Endpoints — ELEMENT Cotizador

> Extraído del frontend (`src/shared/services/api.ts`, `store.ts` y las páginas de cada feature).
> Toda la API cuelga de un **base URL** configurable: `VITE_API_URL` (por defecto `http://localhost:3000/api/v1`).

---

## Convenciones globales (aplican a TODOS los endpoints)

El cliente es **multi-tienda (multi-tenant)**. Cada petición identifica la tienda de tres formas y el backend debe aceptar cualquiera:

| Mecanismo | Cómo se envía | Valor por defecto |
|-----------|---------------|-------------------|
| Query param | `?shop_slug=elemet-haus` (se añade solo si la ruta no lo trae ya y no empieza por `/public/`) | `elemet-haus` |
| Header | `X-Shop-Slug: elemet-haus` | `elemet-haus` |
| Token | El `shop_id` viaja dentro del JWT | — |

**Headers que el frontend manda siempre:**

```
Content-Type: application/json
X-Shop-Slug: <slug>
Authorization: Bearer <token>     // solo si hay sesión iniciada
```

**Formato de respuesta esperado:** el frontend desempaqueta `response.data`, es decir el backend debe envolver:

```json
{ "data": <payload real> }
```

**Formato de error esperado** (cualquier status != 2xx):

```json
{ "error": "mensaje legible" }     // también acepta { "message": "..." }
```

**Autenticación:** JWT en `Authorization: Bearer`. El frontend lee del token (`payload`) los campos: `customer_id`/`sub`/`id`, `email`, `name`, `role`, `shop_id`, `profession`, `phone`, `address`. Un token "pendiente" es el que **no** trae `shop_id` (o `sub === 'pending'`); en ese caso el front llama a `select-shop` para canjearlo por uno definitivo.

---

## 1. Autenticación (`/auth`, `/customers`)

### POST `/auth/customer/register`
**Función:** registrar un nuevo cliente en la tienda. Público (no requiere token).
**Body JSON:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@correo.com",
  "phone": "3001234567",
  "password": "secreto123",
  "shop_slug": "elemet-haus",
  "address": "Arquitecto"
}
```
> `phone` y `address` son opcionales. `address` se usa también para guardar la profesión.

### POST `/auth/customer/login`
**Función:** iniciar sesión. Devuelve un JWT. Público.
**Body JSON:**
```json
{
  "email": "juan@correo.com",
  "password": "secreto123",
  "shop_slug": "elemet-haus"
}
```
**Respuesta esperada:** `{ "token": "<jwt>" }` o `{ "data": { "token": "<jwt>" } }`.

### POST `/auth/select-shop`
**Función:** canjear un token "pendiente" (sin `shop_id`) por un token definitivo ligado a la tienda. Se usa cuando un cliente existe en varias tiendas.
**Body JSON:**
```json
{ "shop_slug": "elemet-haus" }
```
**Respuesta esperada:** `{ "token": "<jwt-definitivo>" }`.

### GET `/auth/me`
**Función:** obtener los datos del usuario autenticado a partir del token. Requiere `Authorization`.
**Body:** ninguno.

### PATCH `/auth/customer/reset-password`
**Función:** restablecer la contraseña sin sesión iniciada, identificando al cliente por email o teléfono. Público.
**Body JSON:**
```json
{
  "new_password": "nuevaClave123",
  "shop_slug": "elemet-haus",
  "email": "juan@correo.com",
  "phone": "3001234567"
}
```
> Se envía `email` **o** `phone` (al menos uno), nunca son ambos obligatorios.

### PATCH `/customers/me`
**Función:** actualizar el perfil del cliente autenticado (nombre, correo, teléfono, dirección/profesión).
**Body JSON:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@correo.com",
  "phone": "3001234567",
  "address": "Arquitecto"
}
```

---

## 2. Landing pública (`/public`)

> No requieren token ni añaden `shop_slug` automáticamente (la ruta ya lo trae como query).

### GET `/public/site-config?shop_slug=<slug>`
**Función:** traer la configuración pública del sitio (textos, branding) para la landing.
**Body:** ninguno.

### GET `/public/landing-images?shop_slug=<slug>`
**Función:** traer las imágenes de la landing (hero, galería, etc.).
**Body:** ninguno.

---

## 3. Cotizaciones (`/quotes`)

> Todas requieren `Authorization`. El campo `data` es un JSON (JSONB en BD) con todo el formulario de la cotización (`QuoteFormData`).

### GET `/quotes`
**Función:** listar todas las cotizaciones del cliente autenticado.
**Body:** ninguno.

### GET `/quotes/{id}`
**Función:** obtener una cotización por su id.
**Body:** ninguno.

### POST `/quotes`
**Función:** crear una cotización nueva.
**Body JSON:**
```json
{
  "date": "2026-06-23",
  "client": "María Gómez",
  "project": "Casa campestre",
  "area": 240.5,
  "price": 3360000,
  "status": "draft",
  "data": {
    "client": "María Gómez",
    "project": "Casa campestre",
    "areaMode": "dimensions",
    "lotShape": "rectangular",
    "frontal": "10", "posterior": "10", "latIzq": "12", "latDer": "12",
    "directArea": "100",
    "occ": 80,
    "floors": 2,
    "overhangSize": 1.0,
    "facades": { "frontal": false, "posterior": false, "lateralLeft": false, "lateralRight": false },
    "selectedServices": ["arch", "struct"],
    "selectedSubPackages": [],
    "hasCompletePackage": false,
    "discount": 0,
    "additionalServices": [],
    "paymentPlanId": 3,
    "invoices": []
  }
}
```
> `status` ∈ `draft | sent | paid | completed`. El front quita el `id` temporal antes de enviar y espera recibir `{ "data": { "id": <real>, ... } }`.

### PATCH `/quotes/{id}`
**Función:** actualizar una cotización existente (datos parciales).
**Body JSON:** los campos a cambiar, p. ej.:
```json
{ "data": { /* QuoteFormData actualizado */ }, "status": "sent" }
```

### DELETE `/quotes/{id}`
**Función:** eliminar una cotización.
**Body:** ninguno.

### POST `/quotes/{id}/select-plan`
**Función:** asignar un plan de pagos a una cotización.
**Body JSON:**
```json
{ "payment_plan_id": 3 }
```

---

## 4. Pagos de cotización (`/quotes/{id}/payments`)

### GET `/quotes/{quoteId}/payments`
**Función:** listar los pagos/abonos registrados de una cotización.
**Body:** ninguno.

### POST `/quotes/{quoteId}/payments`
**Función:** registrar un pago de una cuota del plan.
**Body JSON:**
```json
{
  "installmentIndex": 0,
  "amount": 1680000,
  "method": "transferencia",
  "notes": "Abono inicial",
  "status": "confirmed",
  "paidAt": "2026-06-23"
}
```
> `installmentIndex` (0-based) indica qué cuota del plan representa este pago.

### DELETE `/quotes/{quoteId}/payments/{paymentId}`
**Función:** eliminar un pago registrado.
**Body:** ninguno.

---

## 5. Planes de pago (`/payment-plans`)

### GET `/payment-plans`
**Función:** listar los planes de pago guardados del cliente.
**Body:** ninguno.

### GET `/payment-plans/{id}`
**Función:** obtener un plan de pago por id.
**Body:** ninguno.

### POST `/payment-plans`
**Función:** crear un plan de pago con sus cuotas.
**Body JSON:**
```json
{
  "name": "Plan estándar",
  "description": "4 pagos",
  "installments": [
    { "name": "Firma",     "percentage": 50, "order": 0 },
    { "name": "Revisión 1", "percentage": 20, "order": 1 },
    { "name": "Revisión 2", "percentage": 20, "order": 2 },
    { "name": "Entrega",    "percentage": 10, "order": 3 }
  ],
  "isDefault": false
}
```

### PUT `/payment-plans/{id}`
**Función:** reemplazar/actualizar un plan de pago completo.
**Body JSON:** mismo esquema que el POST.

### DELETE `/payment-plans/{id}`
**Función:** eliminar un plan de pago.
**Body:** ninguno.

### PATCH `/payment-plans/{id}/default`
**Función:** marcar un plan como predeterminado (desmarca los demás).
**Body:** ninguno.

---

## 6. Configuración del cliente (`/customer-config`)

> Guarda toda la parametrización del cotizador (tarifas, paquetes, plan de pago base, datos de factura, precios de estimación). El backend usa **snake_case**; el frontend traduce.

### GET `/customer-config/me`
**Función:** traer la configuración del cliente autenticado. Puede incluir un objeto `customer` anidado con `name/email/phone/address`.
**Body:** ninguno.

### PUT `/customer-config/me`
**Función:** guardar la configuración completa (o parcial) del cotizador.
**Body JSON (snake_case):**
```json
{
  "services": {
    "arch":   { "name": "Diseño Arquitectónico", "price": 7000, "unit": "/m²" },
    "struct": { "name": "Diseño Estructural",     "price": 4000, "unit": "/m²" }
  },
  "sub_packages": {
    "installations": { "name": "Instalaciones", "price": 4500, "unit": "/m²" }
  },
  "complete_package": { "name": "Paquete Técnico Completo", "price": 14000, "unit": "/m²" },
  "payment_plan": {
    "payments": [
      { "name": "Firma", "percentage": 50 },
      { "name": "Entrega", "percentage": 50 }
    ]
  },
  "invoice": {
    "company":        { "enabled": true, "name": "", "nit": "", "address": "", "phone": "", "email": "", "website": "", "logo": "" },
    "representative":  { "enabled": true, "name": "", "position": "", "document": "", "signature": "" },
    "banking":         { "enabled": true, "bank": "", "accountType": "", "accountNumber": "", "accountHolder": "" },
    "document":        { "consecutiveNumber": 1, "terms": "", "footerNote": "" }
  },
  "estimation": {
    "obra_negra": 1500000,
    "obra_gris": 2800000,
    "acabados": 4200000,
    "custom_estimations": [ { "id": 1, "name": "Piscina", "price": 8000000 } ]
  }
}
```
> El front puede enviar solo una clave (p. ej. `{ "services": {...} }` o `{ "payment_plan": {...} }`) para guardados parciales.

---

## 7. Catálogo de materiales (`/quote-catalog`)

> Categorías → Productos → Precios (por ferretería) → Pedidos. IDs en formato string (UUID).

### Categorías

#### GET `/quote-catalog/categories`
**Función:** listar categorías de materiales. **Body:** ninguno.

#### POST `/quote-catalog/categories`
**Función:** crear categoría.
**Body JSON:**
```json
{ "name": "Cemento", "description": "Sacos y mezclas" }
```

#### DELETE `/quote-catalog/categories/{id}`
**Función:** eliminar categoría. **Body:** ninguno.

### Productos

#### GET `/quote-catalog/products?category_id={id}`
**Función:** listar productos (opcionalmente filtrados por categoría). **Body:** ninguno.

#### GET `/quote-catalog/products/{id}`
**Función:** obtener un producto con sus precios. **Body:** ninguno.

#### POST `/quote-catalog/products`
**Función:** crear producto dentro de una categoría.
**Body JSON:**
```json
{ "category_id": "uuid-categoria", "name": "Cemento gris 50kg", "description": "Marca X" }
```

#### DELETE `/quote-catalog/products/{id}`
**Función:** eliminar producto. **Body:** ninguno.

### Precios (por producto)

#### POST `/quote-catalog/products/{productId}/prices`
**Función:** agregar un precio de una ferretería/marca al producto.
**Body JSON:**
```json
{
  "hardware_store": "Homecenter",
  "brand": "Argos",
  "price": 32000,
  "notes": "Precio con IVA"
}
```

#### PATCH `/quote-catalog/products/{productId}/prices/{priceId}`
**Función:** actualizar un precio existente.
**Body JSON:** los campos a cambiar (mismo esquema que el POST).

#### DELETE `/quote-catalog/products/{productId}/prices/{priceId}`
**Función:** eliminar un precio. **Body:** ninguno.

### Pedidos

#### GET `/quote-catalog/orders`
**Función:** listar pedidos de materiales. **Body:** ninguno.

#### POST `/quote-catalog/orders`
**Función:** crear un pedido con sus ítems.
**Body JSON:**
```json
{
  "notes": "Pedido de Cemento gris 50kg",
  "items": [
    { "product_id": "uuid-producto", "price_id": "uuid-precio", "quantity": 10 }
  ]
}
```

---

## Resumen — tabla de todos los endpoints

| # | Método | Ruta | Auth | Función |
|---|--------|------|------|---------|
| 1 | POST | `/auth/customer/register` | Público | Registro de cliente |
| 2 | POST | `/auth/customer/login` | Público | Login |
| 3 | POST | `/auth/select-shop` | Token pendiente | Canjear token por tienda |
| 4 | GET | `/auth/me` | Sí | Datos del usuario |
| 5 | PATCH | `/auth/customer/reset-password` | Público | Restablecer contraseña |
| 6 | PATCH | `/customers/me` | Sí | Actualizar perfil |
| 7 | GET | `/public/site-config` | Público | Config pública del sitio |
| 8 | GET | `/public/landing-images` | Público | Imágenes de la landing |
| 9 | GET | `/quotes` | Sí | Listar cotizaciones |
| 10 | GET | `/quotes/{id}` | Sí | Detalle de cotización |
| 11 | POST | `/quotes` | Sí | Crear cotización |
| 12 | PATCH | `/quotes/{id}` | Sí | Actualizar cotización |
| 13 | DELETE | `/quotes/{id}` | Sí | Eliminar cotización |
| 14 | POST | `/quotes/{id}/select-plan` | Sí | Asignar plan de pago |
| 15 | GET | `/quotes/{id}/payments` | Sí | Listar pagos |
| 16 | POST | `/quotes/{id}/payments` | Sí | Registrar pago |
| 17 | DELETE | `/quotes/{id}/payments/{paymentId}` | Sí | Eliminar pago |
| 18 | GET | `/payment-plans` | Sí | Listar planes |
| 19 | GET | `/payment-plans/{id}` | Sí | Detalle de plan |
| 20 | POST | `/payment-plans` | Sí | Crear plan |
| 21 | PUT | `/payment-plans/{id}` | Sí | Actualizar plan |
| 22 | DELETE | `/payment-plans/{id}` | Sí | Eliminar plan |
| 23 | PATCH | `/payment-plans/{id}/default` | Sí | Marcar plan por defecto |
| 24 | GET | `/customer-config/me` | Sí | Traer configuración |
| 25 | PUT | `/customer-config/me` | Sí | Guardar configuración |
| 26 | GET | `/quote-catalog/categories` | Sí | Listar categorías |
| 27 | POST | `/quote-catalog/categories` | Sí | Crear categoría |
| 28 | DELETE | `/quote-catalog/categories/{id}` | Sí | Eliminar categoría |
| 29 | GET | `/quote-catalog/products` | Sí | Listar productos |
| 30 | GET | `/quote-catalog/products/{id}` | Sí | Detalle de producto |
| 31 | POST | `/quote-catalog/products` | Sí | Crear producto |
| 32 | DELETE | `/quote-catalog/products/{id}` | Sí | Eliminar producto |
| 33 | POST | `/quote-catalog/products/{id}/prices` | Sí | Agregar precio |
| 34 | PATCH | `/quote-catalog/products/{id}/prices/{priceId}` | Sí | Actualizar precio |
| 35 | DELETE | `/quote-catalog/products/{id}/prices/{priceId}` | Sí | Eliminar precio |
| 36 | GET | `/quote-catalog/orders` | Sí | Listar pedidos |
| 37 | POST | `/quote-catalog/orders` | Sí | Crear pedido |

---

## 8. Calculadora de Enchapes (`/tile-calculator`)

> CRUD de proyectos de calculadora de enchapes. Todo el estado (niveles, espacios, materiales, sobrantes) se guarda como documento JSONB.

### GET `/tile-calculator/projects`
**Función:** listar proyectos resumidos del cliente autenticado. **Body:** ninguno.

### GET `/tile-calculator/projects/{id}`
**Función:** obtener un proyecto completo. **Body:** ninguno.

### POST `/tile-calculator/projects`
**Función:** crear un proyecto con un nivel por defecto ("Piso 1").
**Body JSON:**
```json
{
  "nombre": "Casa Campestre Llanogrande",
  "propietario": "Juan Pérez",
  "ubicacion": "Llanogrande, Rionegro"
}
```

### PUT `/tile-calculator/projects/{id}`
**Función:** guardar/actualizar el estado completo del proyecto.
**Body JSON:** documento completo con `nombre`, `propietario`, `ubicacion`, `niveles`, `materiales`, `banco_sobrantes`.

### DELETE `/tile-calculator/projects/{id}`
**Función:** eliminar un proyecto. **Body:** ninguno.

---

## 9. Cálculos de calculadora de enchapes (`/tile-calculator`)

> Endpoints stateless para calcular materiales, desperdicio y sobrantes. No persisten datos.

### GET `/tile-calculator/patterns`
**Función:** listar los patrones de instalación soportados con su % de desperdicio base. **Body:** ninguno.

### POST `/tile-calculator/calculate`
**Función:** calcular piezas, área comprada y costo estimado para un espacio + material + patrón.
**Body JSON:**
```json
{
  "espacio": {
    "segmentos": [{ "largo": 5.5, "ancho": 4.2 }],
    "tipo": "piso",
    "orientacion_manual": null
  },
  "material": {
    "id": "mat_ghi321",
    "nombre": "Porcelanato Gris Cemento",
    "tipo_acabado": "Porcelanato",
    "formato_largo": 60,
    "formato_ancho": 60,
    "modo_precio": "m2",
    "precio_m2": 85000
  },
  "patron_id": "recta",
  "ajuste_desperdicio": 2.5
}
```

### POST `/tile-calculator/offcuts`
**Función:** calcular sobrantes reutilizables y descartes de un espacio.
**Body JSON:**
```json
{
  "espacio": {
    "segmentos": [{ "largo": 5.5, "ancho": 4.2 }]
  },
  "material": {
    "id": "mat_ghi321",
    "nombre": "Porcelanato Gris Cemento",
    "tipo_acabado": "Porcelanato",
    "formato_largo": 60,
    "formato_ancho": 60,
    "modo_precio": "m2"
  }
}
```

### POST `/tile-calculator/projects/{id}/calculate`
**Función:** calcular el presupuesto completo de un proyecto guardado, recorriendo todos sus espacios y materiales asignados.
**Body JSON (opcional):**
```json
{
  "patron_id": "recta",
  "ajuste_desperdicio": 2.5
}
```

---

**Total: 46 endpoints.**
