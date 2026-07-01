-- ============================================================
-- site_db — Public / Site Service
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- Read-model local del tenant (sincronizado desde Auth vía evento ShopCreated)
CREATE TABLE shops (
  id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug CITEXT NOT NULL UNIQUE,
  name VARCHAR(150)
);

CREATE TABLE site_configs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID         NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  section     VARCHAR(50)  NOT NULL,
  key         VARCHAR(100) NOT NULL,
  value       TEXT         NOT NULL,
  value_type  VARCHAR(20)  NOT NULL DEFAULT 'text'
                          CHECK (value_type IN ('text','markdown','image_url','color','json','boolean')),
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT site_configs_shop_section_key_unique UNIQUE (shop_id, section, key)
);
CREATE TRIGGER site_configs_updated_at BEFORE UPDATE ON site_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_site_configs_section ON site_configs(shop_id, section);

CREATE TABLE landing_images (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  type        VARCHAR(30) NOT NULL,
  url         TEXT        NOT NULL,
  alt         VARCHAR(255),
  "order"     INTEGER     NOT NULL DEFAULT 0,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER landing_images_updated_at BEFORE UPDATE ON landing_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_landing_images_type ON landing_images(shop_id, type, "order");

-- Seed de ejemplo
INSERT INTO shops (slug, name) VALUES ('elemet-haus', 'Elemet Haus') ON CONFLICT DO NOTHING;
