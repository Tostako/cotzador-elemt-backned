-- ============================================================
-- auth_db — Auth & Tenant Service
-- Tablas: shops (tenant raíz) + customers (con auth) + refresh_tokens
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

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  shop_id     UUID         NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  jti         UUID         NOT NULL UNIQUE,
  issued_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ  NOT NULL,
  revoked_at  TIMESTAMPTZ,
  replaced_by UUID         REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER refresh_tokens_updated_at BEFORE UPDATE ON refresh_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX idx_refresh_tokens_customer_id ON refresh_tokens(customer_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_jti ON refresh_tokens(jti);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Tienda de ejemplo (slug por defecto del frontend)
INSERT INTO shops (name, slug, email) VALUES ('Elemet Haus', 'elemet-haus', 'admin@elemet-haus.com')
  ON CONFLICT DO NOTHING;
