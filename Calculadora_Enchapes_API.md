# Calculadora de Enchapes — API Documentation

## Overview

Módulo para calcular la cantidad exacta de material (enchapes, pisos, paredes) necesaria para un proyecto de construcción, considerando patrones de instalación, formatos de pieza, desperdicio real por geometría, y un banco de sobrantes reutilizables.

---

## Endpoints

### 1. List Projects

**Endpoint:** `GET /api/v1/tile-calculator/projects`

**Description:** Lista todos los proyectos de calculadora de enchapes del usuario autenticado.

**Function:** Devuelve un array de proyectos resumidos (sin el detalle completo de niveles/espacios).

**Response:**
```json
{
  "data": [
    {
      "id": "proj_abc123",
      "nombre": "Casa Campestre Llanogrande",
      "propietario": "Juan Pérez",
      "ubicacion": "Llanogrande, Rionegro",
      "niveles_count": 2,
      "espacios_count": 8,
      "materiales_count": 4,
      "total_presupuesto": 12500000,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-16T14:30:00Z"
    }
  ]
}
```

---

### 2. Get Project

**Endpoint:** `GET /api/v1/tile-calculator/projects/:id`

**Description:** Obtiene un proyecto completo con todos sus niveles, espacios, materiales, conexiones y banco de sobrantes.

**Function:** Carga el estado completo de la calculadora para un proyecto específico.

**Response:**
```json
{
  "data": {
    "id": "proj_abc123",
    "nombre": "Casa Campestre",
    "propietario": "Juan Pérez",
    "ubicacion": "Llanogrande",
    "niveles": [
      {
        "id": "niv_xyz789",
        "nombre": "Piso 1",
        "espacios": [
          {
            "id": "sp_def456",
            "nombre": "Sala - Principal",
            "tipo": "piso",
            "segmentos": [
              { "largo": 5.5, "ancho": 4.2 }
            ],
            "x": 60,
            "y": 60,
            "material_id": "mat_ghi321",
            "patron_id": "recta",
            "ajuste_desperdicio": 2.5,
            "orientacion_manual": null,
            "filtro_tipo_acabado": null
          }
        ],
        "conexiones": [
          { "id": "cx_jkl654", "a": "sp_def456", "b": "sp_mno987" }
        ]
      }
    ],
    "materiales": [
      {
        "id": "mat_ghi321",
        "nombre": "Porcelanato Gris Cemento",
        "tipo_acabado": "Porcelanato",
        "formato_largo": 60,
        "formato_ancho": 60,
        "formato_grosor": 9,
        "color": "Gris Cemento",
        "marca": "Portobello",
        "categoria": "Ambos",
        "m2_caja": 1.44,
        "peso_caja": 28,
        "modo_precio": "m2",
        "precio_m2": 85000,
        "precio_caja": null,
        "umbral_sobrante_cm": 10
      }
    ],
    "banco_sobrantes": [
      {
        "id": "sob_pqr159",
        "material_id": "mat_ghi321",
        "ancho": 0.15,
        "alto": 0.60,
        "cantidad": 3,
        "origen_nivel_id": "niv_xyz789",
        "origen_space_id": "sp_def456",
        "patron_id": "recta",
        "direccion": "Horizontal (lado mayor)",
        "total_cortes": 12,
        "tramo_index": 0,
        "origen": "corte de columna final",
        "fecha": "2025-01-16"
      }
    ],
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-16T14:30:00Z"
  }
}
```

---

### 3. Create Project

**Endpoint:** `POST /api/v1/tile-calculator/projects`

**Description:** Crea un nuevo proyecto de calculadora de enchapes.

**Function:** Inicializa un proyecto con un nivel por defecto ("Piso 1").

**Request Body:**
```json
{
  "nombre": "Casa Campestre Llanogrande",
  "propietario": "Juan Pérez",
  "ubicacion": "Llanogrande, Rionegro"
}
```

**Response:**
```json
{
  "data": {
    "id": "proj_abc123",
    "nombre": "Casa Campestre Llanogrande",
    "propietario": "Juan Pérez",
    "ubicacion": "Llanogrande, Rionegro",
    "niveles": [
      {
        "id": "niv_xyz789",
        "nombre": "Piso 1",
        "espacios": [],
        "conexiones": []
      }
    ],
    "materiales": [],
    "banco_sobrantes": [],
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  }
}
```

---

### 4. Update Project

**Endpoint:** `PUT /api/v1/tile-calculator/projects/:id`

**Description:** Guarda/actualiza el estado completo de un proyecto (niveles, espacios, materiales, banco de sobrantes).

**Function:** Reemplaza el estado completo del proyecto. Se usa para guardar tras cada cambio significativo.

**Request Body:**
```json
{
  "nombre": "Casa Campestre Llanogrande",
  "propietario": "Juan Pérez",
  "ubicacion": "Llanogrande, Rionegro",
  "niveles": [
    {
      "id": "niv_xyz789",
      "nombre": "Piso 1",
      "espacios": [
        {
          "id": "sp_def456",
          "nombre": "Sala - Principal",
          "tipo": "piso",
          "segmentos": [
            { "largo": 5.5, "ancho": 4.2 }
          ],
          "x": 60,
          "y": 60,
          "material_id": "mat_ghi321",
          "patron_id": "recta",
          "ajuste_desperdicio": 2.5,
          "orientacion_manual": null,
          "filtro_tipo_acabado": null
        }
      ],
      "conexiones": []
    }
  ],
  "materiales": [
    {
      "id": "mat_ghi321",
      "nombre": "Porcelanato Gris Cemento",
      "tipo_acabado": "Porcelanato",
      "formato_largo": 60,
      "formato_ancho": 60,
      "formato_grosor": 9,
      "color": "Gris Cemento",
      "marca": "Portobello",
      "categoria": "Ambos",
      "m2_caja": 1.44,
      "peso_caja": 28,
      "modo_precio": "m2",
      "precio_m2": 85000,
      "precio_caja": null,
      "umbral_sobrante_cm": 10
    }
  ],
  "banco_sobrantes": []
}
```

**Response:**
```json
{
  "data": {
    "id": "proj_abc123",
    "nombre": "Casa Campestre Llanogrande",
    "propietario": "Juan Pérez",
    "ubicacion": "Llanogrande, Rionegro",
    "updated_at": "2025-01-16T14:30:00Z"
  }
}
```

---

### 5. Delete Project

**Endpoint:** `DELETE /api/v1/tile-calculator/projects/:id`

**Description:** Elimina un proyecto y todos sus datos asociados.

**Function:** Borrado permanente del proyecto.

**Response:**
```json
{
  "data": {
    "message": "Proyecto eliminado correctamente"
  }
}
```

---

## Data Models

### EnchapeProject

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Auto | UUID del proyecto |
| `nombre` | `string` | Yes | Nombre del proyecto |
| `propietario` | `string` | No | Nombre del propietario |
| `ubicacion` | `string` | No | Ubicación del proyecto |
| `niveles` | `Nivel[]` | Yes | Array de niveles/pisos |
| `materiales` | `Material[]` | Yes | Catálogo de materiales del proyecto |
| `banco_sobrantes` | `Sobrante[]` | Yes | Piezas sobrantes guardadas |
| `created_at` | `string` | Auto | ISO 8601 timestamp |
| `updated_at` | `string` | Auto | ISO 8601 timestamp |

### Nivel

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID del nivel |
| `nombre` | `string` | Yes | Ej: "Piso 1", "Sótano" |
| `espacios` | `Espacio[]` | Yes | Espacios de este nivel |
| `conexiones` | `Conexion[]` | Yes | Conexiones entre espacios |

### Espacio

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID del espacio |
| `nombre` | `string` | Yes | Ej: "Sala", "Baño Principal" |
| `tipo` | `"piso" \| "pared"` | Yes | Tipo de superficie |
| `segmentos` | `Segmento[]` | Yes | Tramos geométricos (forma en L = múltiples) |
| `x` | `number` | Yes | Posición X en el canvas |
| `y` | `number` | Yes | Posición Y en el canvas |
| `material_id` | `string` | No | ID del material asignado |
| `patron_id` | `string` | No | ID del patrón de instalación |
| `ajuste_desperdicio` | `number` | No | % adicional manual de desperdicio |
| `orientacion_manual` | `"largo" \| "ancho" \| null` | No | Dirección forzada de instalación |
| `filtro_tipo_acabado` | `string` | No | Filtro temporal en UI |

### Segmento

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `largo` | `number` | Yes | Largo en metros |
| `ancho` | `number` | Yes | Ancho (o alto para paredes) en metros |

### Conexion

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID de la conexión |
| `a` | `string` | Yes | ID espacio origen |
| `b` | `string` | Yes | ID espacio destino |

### Material

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID del material |
| `nombre` | `string` | Yes | Nombre descriptivo |
| `tipo_acabado` | `string` | Yes | Ver `TIPOS_ACABADO` abajo |
| `formato_largo` | `number` | No | Largo de la pieza en cm |
| `formato_ancho` | `number` | No | Ancho de la pieza en cm |
| `formato_grosor` | `number` | No | Grosor en mm |
| `color` | `string` | No | Color o acabado |
| `marca` | `string` | No | Marca comercial |
| `categoria` | `"Ambos" \| "Piso" \| "Pared"` | Yes | Dónde aplica |
| `m2_caja` | `number` | No | m² por caja |
| `peso_caja` | `number` | No | Peso en kg por caja |
| `modo_precio` | `"m2" \| "caja"` | Yes | Cómo se cotiza |
| `precio_m2` | `number` | No | Precio por m² (si modo=m2) |
| `precio_caja` | `number` | No | Precio por caja (si modo=caja) |
| `umbral_sobrante_cm` | `number` | No | Mínimo cm para guardar sobrante |

### Sobrante (Banco)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | UUID del sobrante |
| `material_id` | `string` | Yes | Material de origen |
| `ancho` | `number` | Yes | Ancho en metros |
| `alto` | `number` | Yes | Alto en metros |
| `cantidad` | `number` | Yes | Cuántas piezas |
| `origen_nivel_id` | `string` | Yes | De qué nivel |
| `origen_space_id` | `string` | Yes | De qué espacio |
| `patron_id` | `string` | Yes | Patrón usado |
| `direccion` | `string` | Yes | Dirección de instalación |
| `total_cortes` | `number` | No | Total de cortes en ese espacio |
| `tramo_index` | `number` | Yes | Índice del tramo |
| `origen` | `string` | Yes | Origen del corte (descripción) |
| `fecha` | `string` | Yes | Fecha de guardado (YYYY-MM-DD) |

---

## Constants

### TIPOS_ACABADO

```typescript
const TIPOS_ACABADO = [
  'Cerámica',
  'Porcelanato',
  'Piedra Natural (Mármol/Granito/Travertino)',
  'Madera Maciza (Duela)',
  'Piso Laminado',
  'SPC (Vinílico Rígido)',
  'Vinílico Flexible (LVT)',
  'Microcemento',
  'Resina Epóxica',
  'Concreto Pulido',
  'Alfombra / Carpeta',
  'Bambú'
];
```

### ACABADOS_CONTINUOS (sin piezas ni patrón)

```typescript
const CONTINUOS = new Set([
  'Microcemento',
  'Resina Epóxica',
  'Concreto Pulido'
]);
```

### PATRONES_DE_INSTALACION

```typescript
const PATRONES = [
  { id: 'recta',       nombre: 'Recta / Junta corrida (a hilo)',         desperdicio: 5,  recomendado: 'Sirve para casi todos los materiales y formatos rectangulares grandes.' },
  { id: 'trabada50',   nombre: 'Trabada 1/2 (a la española, ladrillo 50%)', desperdicio: 8,  recomendado: 'Porcelanato, cerámica, SPC y laminado rectangular.' },
  { id: 'trabada33',   nombre: 'Trabada 1/3',                            desperdicio: 10, recomendado: 'Porcelanato rectangular y madera/laminado de tablas largas.' },
  { id: 'trabada25',   nombre: 'Trabada 1/4',                            desperdicio: 8,  recomendado: 'Formatos grandes rectificados (porcelanato XL).' },
  { id: 'diagonal45',  nombre: 'Diagonal 45°',                           desperdicio: 15, recomendado: 'Cerámica y porcelanato cuadrado; amplía visualmente espacios pequeños.' },
  { id: 'espina',      nombre: 'Espina de pescado (Herringbone)',        desperdicio: 20, recomendado: 'Madera, laminado y SPC en formato de tabla/listón.' },
  { id: 'cesta',       nombre: 'Cesta / Basket weave',                   desperdicio: 15, recomendado: 'Madera y mosaico.' },
  { id: 'versalles',   nombre: 'Versalles (combinación de formatos)',    desperdicio: 12, recomendado: 'Piedra natural y porcelanato imitación piedra.' },
  { id: 'irregular',   nombre: 'Espacio irregular / muchos cortes',      desperdicio: 12, recomendado: 'Cualquier material en espacios con ángulos o formas en L.' }
];
```

### UMBRALES_POR_DEFECTO_Sobrante

| Tipo de Material | Umbral (cm) |
|-----------------|-------------|
| Cerámica, Porcelanato, Piedra Natural | 10 |
| Madera, Laminado, SPC, Vinílico, Bambú, Alfombra | 15 |
| Continuos (Microcemento, Resina, Concreto) | null (no aplica) |

---

## Calculations (Frontend/Backend Logic)

### 1. Área de un espacio

```typescript
function computeArea(espacio: Espacio): number {
  return espacio.segmentos.reduce((sum, seg) => 
    sum + (seg.largo * seg.ancho), 0
  );
}
```

### 2. Piezas por patrón (geometría real)

```typescript
function piezasPorPatron(L: number, A: number, pL: number, pA: number, patronId: string) {
  // pL, pA = formato de pieza en metros (cm/100)
  // L, A = dimensiones del espacio en metros
  // Retorna: { piezasTotales, areaComprada, areaNecesaria, desperdicioPct, filas, ... }
}
```

### 3. Cálculo completo de instalación

```typescript
function calcularInstalacion(
  espacio: Espacio,
  material: Material,
  patronId: string,
  ajusteManual: number
) {
  // Retorna: { areaNecesaria, areaComprada, desperdicioPct, piezas, orientacion, exacto }
}
```

### 4. Sobrantes / Offcuts

```typescript
function calcularSobrantesEspacio(
  espacio: Espacio,
  material: Material,
  usarA: boolean // dirección de instalación
) {
  // Retorna: { grupos, soportado, descartados, umbralCm }
  // grupos = [{ tramoIndex, tramoL, tramoA, esPrincipal, offcuts: [{ancho, alto, cantidad, origen}] }]
}
```

---

## Frontend Routes

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/calculadoras/enchapes` | `EnchapesPage` | Página principal con stepper |
| `/calculadoras/enchapes?fase=1` | Canvas | Recolección de datos |
| `/calculadoras/enchapes?fase=2` | SummaryTable | Resumen |
| `/calculadoras/enchapes?fase=3` | AssignmentPanel | Asignación de materiales |
| `/calculadoras/enchapes?fase=4` | BudgetView | Presupuesto |
| `/calculadoras/enchapes?vista=catalogo` | MaterialCatalog | Catálogo de materiales |
| `/calculadoras/enchapes?vista=visual` | VisualizationView | Plano SVG + sobrantes |

---

## State Shape (Zustand)

```typescript
interface EnchapesState {
  // Proyecto actual
  proyecto: { nombre: string; propietario: string; ubicacion: string };
  niveles: Nivel[];
  materiales: Material[];
  bancoSobrantes: Sobrante[];
  
  // UI
  fase: 1 | 2 | 3 | 4;
  vista: 'wizard' | 'catalogo' | 'visual';
  nivelActivoId: string | null;
  
  // Canvas
  zoomLevel: number;
  selectedCardId: string | null;
  connectMode: boolean;
  connectOrigin: string | null;
}
```

---

## Backend Calculation Endpoints

Además del CRUD de proyectos, el backend expone endpoints stateless para calcular sin persistir:

- `GET /api/v1/tile-calculator/patterns` — lista de patrones con desperdicio base.
- `POST /api/v1/tile-calculator/calculate` — calcula piezas, área comprada y costo para un espacio + material.
- `POST /api/v1/tile-calculator/offcuts` — calcula sobrantes reutilizables y descartes.
- `POST /api/v1/tile-calculator/projects/:id/calculate` — calcula el presupuesto completo de un proyecto guardado.

## Implementation Notes

1. **Persistencia:** El frontend guarda en `localStorage` como respaldo inmediato y sincroniza con el backend vía `PUT /tile-calculator/projects/:id` con debounce de 500ms.

2. **Canvas:** Implementado con HTML/CSS posicionado absolutamente (no Canvas API). Las tarjetas de espacio son divs arrastrables con `pointermove`. Las conexiones son divs rotados con CSS `transform: rotate()`.

3. **SVG:** La visualización usa SVG nativo con `<rect>` para piezas y `<pattern>` para patrones diagonales.

4. **Cálculos:** La lógica matemática puede correr tanto en el frontend (respuesta inmediata) como en los endpoints stateless del backend para validación, reportes y sincronización.

5. **Offline:** El módulo funciona completamente offline con `localStorage`. Se sincroniza con backend cuando hay conexión.

---

*Documento generado para ELEMENT Cotizador — Módulo Calculadora de Enchapes*
