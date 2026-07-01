-- ============================================================
-- tile_calculator_db — Tile Calculator Service
-- Guarda proyectos de calculadora de enchapes como documentos JSONB.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE tile_projects (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID         NOT NULL,
  customer_id      UUID         NOT NULL,
  nombre           VARCHAR(255) NOT NULL,
  propietario      VARCHAR(255),
  ubicacion        VARCHAR(255),
  niveles          JSONB        NOT NULL DEFAULT '[]',
  materiales       JSONB        NOT NULL DEFAULT '[]',
  banco_sobrantes  JSONB        NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER tile_projects_updated_at BEFORE UPDATE ON tile_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_tile_projects_owner  ON tile_projects(shop_id, customer_id);
CREATE INDEX idx_tile_projects_created ON tile_projects(shop_id, customer_id, created_at DESC);

-- Índices GIN para consultas dentro de los documentos JSONB
CREATE INDEX idx_tile_projects_niveles_gin ON tile_projects USING GIN (niveles jsonb_path_ops);
CREATE INDEX idx_tile_projects_materiales_gin ON tile_projects USING GIN (materiales jsonb_path_ops);
