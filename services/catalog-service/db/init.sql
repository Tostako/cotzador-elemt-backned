-- ============================================================
-- catalog_db — Catalog Service (materiales del cotizador)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE quote_catalog_categories (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID         NOT NULL,
  customer_id      UUID         NOT NULL,
  main_category_id UUID,
  name             VARCHAR(100) NOT NULL,
  description      TEXT,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT qc_categories_name_unique UNIQUE (shop_id, customer_id, name)
);
CREATE TRIGGER qc_categories_updated_at BEFORE UPDATE ON quote_catalog_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE quote_catalog_products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID         NOT NULL,
  customer_id     UUID         NOT NULL,
  category_id     UUID         NOT NULL REFERENCES quote_catalog_categories(id) ON DELETE RESTRICT,
  main_product_id UUID,
  sku             VARCHAR(100),
  name            VARCHAR(200) NOT NULL,
  description     TEXT,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT qc_products_name_unique UNIQUE (shop_id, customer_id, category_id, name)
);
CREATE TRIGGER qc_products_updated_at BEFORE UPDATE ON quote_catalog_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE quote_catalog_product_prices (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID          NOT NULL,
  customer_id    UUID          NOT NULL,
  product_id     UUID          NOT NULL REFERENCES quote_catalog_products(id) ON DELETE CASCADE,
  hardware_store VARCHAR(150)  NOT NULL,
  brand          VARCHAR(120),
  price          NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  notes          TEXT,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE TRIGGER qc_prices_updated_at BEFORE UPDATE ON quote_catalog_product_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE quote_catalog_orders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID          NOT NULL,
  customer_id UUID          NOT NULL,
  status      VARCHAR(20)   NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','pending','completed','cancelled')),
  notes       TEXT,
  subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  total       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE TRIGGER qc_orders_updated_at BEFORE UPDATE ON quote_catalog_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE quote_catalog_order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID          NOT NULL,
  customer_id     UUID          NOT NULL,
  order_id        UUID          NOT NULL REFERENCES quote_catalog_orders(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES quote_catalog_products(id) ON DELETE RESTRICT,
  price_id        UUID          NOT NULL REFERENCES quote_catalog_product_prices(id) ON DELETE RESTRICT,
  main_product_id UUID,
  quantity        INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal        NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qc_categories_owner ON quote_catalog_categories(shop_id, customer_id);
CREATE INDEX idx_qc_products_owner   ON quote_catalog_products(shop_id, customer_id, category_id);
CREATE INDEX idx_qc_prices_product   ON quote_catalog_product_prices(shop_id, customer_id, product_id, price);
CREATE INDEX idx_qc_orders_owner     ON quote_catalog_orders(shop_id, customer_id, created_at DESC);
CREATE INDEX idx_qc_order_items      ON quote_catalog_order_items(order_id);
