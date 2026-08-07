-- ============================================================
-- cost_pro — Cost Service (CostPro)
-- Presupuestos de obra: proyectos, capítulos, APUs, insumos,
-- precios históricos, items de presupuesto y documentos.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS cost_pro;

CREATE OR REPLACE FUNCTION cost_pro.update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------
-- Proyectos
-- ------------------------------------------------------------------
CREATE TABLE cost_pro.projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID         NOT NULL,
  customer_id UUID         NOT NULL,
  nombre      VARCHAR(120) NOT NULL,
  cliente     VARCHAR(120),
  ubicacion   VARCHAR(160),
  area_m2     NUMERIC      NOT NULL DEFAULT 0,
  tipo_obra   VARCHAR(30),
  fecha       DATE,
  estado      VARCHAR(20)  NOT NULL DEFAULT 'BORRADOR',
  aiu         JSONB        NOT NULL DEFAULT '{}',
  version     INTEGER      NOT NULL DEFAULT 1,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON cost_pro.projects
  FOR EACH ROW EXECUTE FUNCTION cost_pro.update_updated_at();
CREATE INDEX idx_projects_owner ON cost_pro.projects(shop_id, customer_id);
CREATE INDEX idx_projects_owner_created ON cost_pro.projects(shop_id, customer_id, created_at DESC);

-- ------------------------------------------------------------------
-- Capítulos del catálogo
-- ------------------------------------------------------------------
CREATE TABLE cost_pro.chapters (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id    UUID         NOT NULL,
  nombre     VARCHAR(120) NOT NULL,
  codigo     VARCHAR(30),
  orden      INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER cost_pro_chapters_updated_at BEFORE UPDATE ON cost_pro.chapters
  FOR EACH ROW EXECUTE FUNCTION cost_pro.update_updated_at();
CREATE INDEX idx_chapters_shop ON cost_pro.chapters(shop_id);

-- ------------------------------------------------------------------
-- Insumos y precios históricos
-- ------------------------------------------------------------------
CREATE TABLE cost_pro.supplies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  unidad      VARCHAR(20)  NOT NULL,
  grupo       VARCHAR(20)  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER cost_pro_supplies_updated_at BEFORE UPDATE ON cost_pro.supplies
  FOR EACH ROW EXECUTE FUNCTION cost_pro.update_updated_at();
CREATE INDEX idx_supplies_shop_group ON cost_pro.supplies(shop_id, grupo);

CREATE TABLE cost_pro.supply_prices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supply_id     UUID NOT NULL REFERENCES cost_pro.supplies(id) ON DELETE CASCADE,
  valor         NUMERIC NOT NULL,
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usuario       VARCHAR(120),
  motivo        VARCHAR(300),
  origen        VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_supply_prices_supply ON cost_pro.supply_prices(supply_id);
CREATE INDEX idx_supply_prices_vigente ON cost_pro.supply_prices(supply_id, vigente_desde DESC);

-- ------------------------------------------------------------------
-- APUs (catálogo) y sus componentes
-- ------------------------------------------------------------------
CREATE TABLE cost_pro.apus (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL,
  chapter_id  UUID REFERENCES cost_pro.chapters(id),
  codigo      VARCHAR(30) NOT NULL,
  descripcion VARCHAR(200) NOT NULL,
  unidad      VARCHAR(20) NOT NULL,
  origen      VARCHAR(20) NOT NULL DEFAULT 'PERSONALIZADO',
  version     INTEGER    NOT NULL DEFAULT 1,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER cost_pro_apus_updated_at BEFORE UPDATE ON cost_pro.apus
  FOR EACH ROW EXECUTE FUNCTION cost_pro.update_updated_at();
CREATE INDEX idx_apus_shop ON cost_pro.apus(shop_id);
CREATE INDEX idx_apus_shop_chapter ON cost_pro.apus(shop_id, chapter_id);
CREATE UNIQUE INDEX idx_apus_shop_codigo ON cost_pro.apus(shop_id, codigo) WHERE deleted_at IS NULL;

CREATE TABLE cost_pro.apu_components (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  apu_id     UUID NOT NULL REFERENCES cost_pro.apus(id) ON DELETE CASCADE,
  insumo_id  UUID NOT NULL REFERENCES cost_pro.supplies(id) ON DELETE RESTRICT,
  rendimiento NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_apu_components_apu ON cost_pro.apu_components(apu_id);
CREATE INDEX idx_apu_components_insumo ON cost_pro.apu_components(apu_id, insumo_id);

-- ------------------------------------------------------------------
-- Items del presupuesto (snapshot congelado del APU)
-- ------------------------------------------------------------------
CREATE TABLE cost_pro.budget_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id     UUID NOT NULL REFERENCES cost_pro.projects(id) ON DELETE CASCADE,
  chapter_id     UUID REFERENCES cost_pro.chapters(id),
  apu_id         UUID REFERENCES cost_pro.apus(id) ON DELETE SET NULL,
  apu_snapshot   JSONB NOT NULL,
  descripcion    VARCHAR(200) NOT NULL,
  unidad         VARCHAR(20) NOT NULL,
  cantidad       NUMERIC NOT NULL DEFAULT 0,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER cost_pro_budget_items_updated_at BEFORE UPDATE ON cost_pro.budget_items
  FOR EACH ROW EXECUTE FUNCTION cost_pro.update_updated_at();
CREATE INDEX idx_budget_items_project_chapter ON cost_pro.budget_items(project_id, chapter_id);
CREATE INDEX idx_budget_items_project_deleted ON cost_pro.budget_items(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_budget_items_project_apu ON cost_pro.budget_items(project_id, apu_id);

-- ------------------------------------------------------------------
-- Eventos del presupuesto (para deshacer)
-- ------------------------------------------------------------------
CREATE TABLE cost_pro.budget_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES cost_pro.projects(id) ON DELETE CASCADE,
  tipo        VARCHAR(40) NOT NULL,
  undo_token  UUID,
  estado_antes JSONB NOT NULL DEFAULT '{}',
  estado_despues JSONB NOT NULL DEFAULT '{}',
  usuario     VARCHAR(120),
  undone_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_budget_events_project ON cost_pro.budget_events(project_id);
CREATE INDEX idx_budget_events_undo ON cost_pro.budget_events(undo_token) WHERE undone_at IS NULL;

-- ------------------------------------------------------------------
-- Documentos (cotizaciones / ofertas)
-- ------------------------------------------------------------------
CREATE TABLE cost_pro.documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES cost_pro.projects(id) ON DELETE CASCADE,
  tipo            VARCHAR(30) NOT NULL,
  estado          VARCHAR(20) NOT NULL DEFAULT 'GENERANDO',
  referencia      VARCHAR(80),
  total_congelado NUMERIC,
  file_path       VARCHAR(250),
  error           VARCHAR(400),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_documents_project ON cost_pro.documents(project_id);