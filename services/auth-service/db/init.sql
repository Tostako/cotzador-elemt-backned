-- ============================================================
-- auth_db — Auth & Tenant Service
-- Tablas: shops (tenant raíz) + customers (con auth)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE shops (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(150) NOT NULL,
  slug        CITEXT       NOT NULL UNIQUE,
  email       CITEXT       NOT NULL UNIQUE,
  phone       VARCHAR(30),
  address     TEXT,
  logo_url    TEXT,
  currency    CHAR(3)      NOT NULL DEFAULT 'USD',
  timezone    VARCHAR(60)  NOT NULL DEFAULT 'UTC',
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  plan        VARCHAR(30)  NOT NULL DEFAULT 'free'
                           CHECK (plan IN ('free','basic','pro','enterprise')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER shops_updated_at BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID         NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  email       CITEXT       NOT NULL,
  phone       VARCHAR(30),
  address     TEXT,
  notes       TEXT,
  password    VARCHAR(72),
  last_login  TIMESTAMPTZ,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  can_manage_quote_catalog BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT customers_shop_email_unique UNIQUE (shop_id, email)
);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_customers_shop_id    ON customers(shop_id);
CREATE INDEX idx_customers_shop_email ON customers(shop_id, email);

-- Tienda de ejemplo (slug por defecto del frontend)
INSERT INTO shops (name, slug, email) VALUES ('Elemet Haus', 'elemet-haus', 'admin@elemet-haus.com')
  ON CONFLICT DO NOTHING;
