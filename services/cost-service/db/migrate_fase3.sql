-- Migracion Fase 3 - CostPro
-- HU-22 cotizaciones desde consolidado de materiales
-- HU-24 propuestas de APU generadas por IA
-- HU-25 marca / configuracion org
-- Idempotente: se puede ejecutar varias veces en el SQL Editor de Supabase.
-- Ejecutar SIEMPRE primero db/migrate_fase2.sql si no esta aplicado.

BEGIN;

-- ======================================================================
-- HU-22: Cotizaciones
-- ======================================================================
CREATE TABLE IF NOT EXISTS cost_pro.quotations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid NOT NULL,
  project_id   uuid NOT NULL,
  customer_id  uuid NOT NULL,
  creada_en    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, id)
);

CREATE INDEX IF NOT EXISTS idx_quotations_shop_id ON cost_pro.quotations (shop_id);
CREATE INDEX IF NOT EXISTS idx_quotations_project_id ON cost_pro.quotations (project_id);

CREATE TABLE IF NOT EXISTS cost_pro.quotation_lines (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id         uuid NOT NULL,
  insumo_id            uuid NOT NULL,
  descripcion          varchar(200) NOT NULL,
  unidad               varchar(20) NOT NULL,
  cantidad_total       numeric NOT NULL DEFAULT '0',
  precio_presupuestado numeric NOT NULL DEFAULT '0',
  proveedor            varchar(160),
  precio_cotizado      numeric,
  estado               varchar(20) NOT NULL DEFAULT 'PENDIENTE',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_lines_quotation_id ON cost_pro.quotation_lines (quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_lines_insumo_id ON cost_pro.quotation_lines (insumo_id);

-- ======================================================================
-- HU-24: Propuestas de APU generadas por IA
-- ======================================================================
CREATE TABLE IF NOT EXISTS cost_pro.ai_apu_proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid NOT NULL,
  solicitud        varchar(500) NOT NULL,
  capitulo_sugerido varchar(160),
  descripcion      varchar(200) NOT NULL,
  unidad           varchar(20) NOT NULL,
  costo_calculado  numeric NOT NULL DEFAULT '0',
  componentes      jsonb NOT NULL DEFAULT '[]',
  cuota_restante   integer NOT NULL DEFAULT 20,
  estado           varchar(20) NOT NULL DEFAULT 'EN_ESPERA',
  created_at       timestamptz NOT NULL DEFAULT now(),
  accepted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_apu_proposals_shop_id ON cost_pro.ai_apu_proposals (shop_id);
CREATE INDEX IF NOT EXISTS idx_ai_apu_proposals_estado ON cost_pro.ai_apu_proposals (estado);

-- ======================================================================
-- HU-25: Marca / configuracion de la organizacion
-- ======================================================================
CREATE TABLE IF NOT EXISTS cost_pro.org_branding (
  shop_id            uuid PRIMARY KEY,
  razon_social       varchar(160),
  nombre_comercial   varchar(160),
  nit                varchar(30),
  ciudad             varchar(80),
  correo_soporte     varchar(160),
  sitio_web          varchar(200),
  logo_url           varchar(300),
  color_acento       varchar(7) NOT NULL DEFAULT '#0EA5E9',
  plantilla_documento varchar(20) NOT NULL DEFAULT 'CLASICA',
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMIT;