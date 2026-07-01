-- ============================================================
-- quotes_db — Quotes Service
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID          NOT NULL,
  customer_id     UUID          NOT NULL,
  client          VARCHAR(255)  NOT NULL,
  project         VARCHAR(255)  NOT NULL,
  area            NUMERIC(12,2) NOT NULL,
  price           NUMERIC(12,2) NOT NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','sent','paid','completed')),
  data            JSONB         NOT NULL DEFAULT '{}',
  date            DATE          NOT NULL DEFAULT CURRENT_DATE,
  payment_plan_id UUID,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_quotes_shop_id     ON quotes(shop_id);
CREATE INDEX idx_quotes_customer_id ON quotes(shop_id, customer_id);
CREATE INDEX idx_quotes_status      ON quotes(shop_id, status);
CREATE INDEX idx_quotes_created     ON quotes(shop_id, created_at DESC);

-- Nota: shop_id/customer_id NO son FK aquí (viven en auth_db).
-- La integridad cross-service se valida vía token/Gateway.
