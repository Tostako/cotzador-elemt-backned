-- ============================================================
-- cost_pro — Migración Fase 2 (CostPro)
-- Diferencia esquematizada del service para presupuestación en
-- Supabase SQL Editor. Idempotente: se puede correr dos veces.
--
-- Qué incluye:
--  1. Fase 2 NO agrega tablas nuevas: usa projects, chapters,
--     supplies, supply_prices, apus, apu_components, budget_items,
--     budget_events y documents ya creadas en Fase 1.
--  2. documents.tipo amplía su dominio (tipos agregados de la
--     Fase 2): 'PDF_CLIENTE','PDF_INTERNO','PDF_COSTOS_APU',
--     'XLSX_PRESUPUESTO','XLSX_INSUMOS','XLSX_APUS'. La columna ya
--     es VARCHAR(30), suficiente; aquí se garantiza y documenta.
--  3. Índice de búsqueda de texto para el catálogo e IA local
--     (búsquedas ILIKE sobre código y descripción de APUs).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Garantizar longitud para los nuevos tipos de documento -----
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'cost_pro'
      AND table_name = 'documents'
      AND column_name = 'tipo'
      AND character_maximum_length >= 30
  ) THEN
    ALTER TABLE cost_pro.documents ALTER COLUMN tipo TYPE VARCHAR(30);
  END IF;
END $$;

-- 2. Verificación visible de los tipos admitidos (no cambia datos)
--    Nota: la columna NO tiene CHECK constraint, por lo que acepta
--    los nuevos valores sin reiniciar nada.

-- 3. Índice trigramas sobre APUs para búsqueda ILIKE (catálogo + IA)
CREATE INDEX IF NOT EXISTS idx_apus_shop_codigo_desc_trgm
  ON cost_pro.apus USING gin (
    codigo gin_trgm_ops,
    descripcion gin_trgm_ops
  );

-- 4. Índice trigramas sobre insumos (búsqueda en catálogo de insumos)
CREATE INDEX IF NOT EXISTS idx_supplies_desc_trgm
  ON cost_pro.supplies USING gin (descripcion gin_trgm_ops);