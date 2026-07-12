-- 008: Módulo RETAIL (PRP-myvipers-001, Fase 3). Tablas NUEVAS, aisladas del
-- restaurante. Todas multitenant por restaurant_id. No tocan ningún flujo existente.

-- Productos (cabecera)
CREATE TABLE IF NOT EXISTS retail_products (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    name          TEXT NOT NULL,
    description   TEXT,
    category      TEXT,
    base_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
    image_url     TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retail_products_restaurant ON retail_products (restaurant_id);

-- Variantes (talla / color / SKU / stock). El stock vive aquí.
CREATE TABLE IF NOT EXISTS retail_variants (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    product_id    UUID NOT NULL REFERENCES retail_products(id) ON DELETE CASCADE,
    size          TEXT,                                   -- talla (S/M/L/38/40...)
    color         TEXT,
    sku           TEXT,
    price         NUMERIC(10,2),                          -- override opcional del base_price
    stock         INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 3,       -- alerta de stock bajo
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retail_variants_restaurant ON retail_variants (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_retail_variants_product ON retail_variants (product_id);
-- SKU único por tenant (cuando existe)
CREATE UNIQUE INDEX IF NOT EXISTS uq_retail_variant_sku
    ON retail_variants (restaurant_id, sku) WHERE sku IS NOT NULL;

-- Movimientos de stock (auditoría y ajuste). El stock de la variante se actualiza
-- junto con cada movimiento desde la capa de aplicación.
CREATE TABLE IF NOT EXISTS retail_stock_movements (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    variant_id    UUID NOT NULL REFERENCES retail_variants(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('entrada','salida','ajuste')),
    quantity      INTEGER NOT NULL,                       -- delta aplicado (+/-)
    reason        TEXT,
    created_by    UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retail_movements_restaurant ON retail_stock_movements (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_retail_movements_variant ON retail_stock_movements (variant_id, created_at DESC);
