-- Migracion Plantillas personalizadas (CRUD HU-02 ampliada)
-- Tabla cost_pro.templates: plantillas propias del shop creadas desde cero o
-- a partir de un proyecto. Las actividades guardan referencias a APUs del
-- catalogo (apu_id + cantidad).
-- Idempotente: se puede ejecutar varias veces en el SQL Editor de Supabase.

BEGIN;

CREATE TABLE IF NOT EXISTS cost_pro.templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          uuid NOT NULL,
  codigo           varchar(30) NOT NULL,
  nombre           varchar(120) NOT NULL,
  alcance          varchar(500) DEFAULT NULL,
  area_referencia  numeric(12,2) NOT NULL DEFAULT 0,
  actividades      jsonb NOT NULL DEFAULT '[]',
  deleted_at       timestamptz DEFAULT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_shop_id ON cost_pro.templates (shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_templates_shop_codigo
  ON cost_pro.templates (shop_id, codigo)
  WHERE deleted_at IS NULL;

COMMIT;
