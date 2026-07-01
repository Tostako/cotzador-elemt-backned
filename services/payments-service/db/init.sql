-- ============================================================
-- payments_db — Payments & Plans Service
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE payment_plans (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID         NOT NULL,
  customer_id  UUID         NOT NULL,
  name         VARCHAR(120) NOT NULL,
  description  TEXT,
  installments JSONB        NOT NULL,
  is_default   BOOLEAN      DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER payment_plans_updated_at BEFORE UPDATE ON payment_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_pp_shop     ON payment_plans(shop_id);
CREATE INDEX idx_pp_customer ON payment_plans(shop_id, customer_id);

CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id           UUID          NOT NULL,
  customer_id       UUID          NOT NULL,
  quote_id          UUID          NOT NULL,
  installment_index INT           NOT NULL,
  amount            NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method            VARCHAR(20)   NOT NULL
                       CHECK (method IN ('card','pse','manual','cash','transfer','wompi','other')),
  notes             TEXT,
  status            VARCHAR(20)   NOT NULL DEFAULT 'confirmed'
                       CHECK (status IN ('pending','approved','rejected','cancelled','refunded','in_process','confirmed')),
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_payments_quote ON payments(shop_id, customer_id, quote_id);
