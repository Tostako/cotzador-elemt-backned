-- ============================================================
-- config_db — Config Service
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE customer_configs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID        NOT NULL,
  customer_id      UUID        NOT NULL,
  services         JSONB       NOT NULL DEFAULT '{}',
  sub_packages     JSONB       NOT NULL DEFAULT '{}',
  complete_package JSONB       NOT NULL DEFAULT '{}',
  payment_plan     JSONB       NOT NULL DEFAULT '{}',
  invoice          JSONB       NOT NULL DEFAULT '{}',
  estimation       JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_configs_customer_unique UNIQUE (shop_id, customer_id)
);
CREATE TRIGGER customer_configs_updated_at BEFORE UPDATE ON customer_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_customer_configs_customer ON customer_configs(shop_id, customer_id);
