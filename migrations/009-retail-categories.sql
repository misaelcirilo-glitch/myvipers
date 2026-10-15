-- 009: Categorías retail jerárquicas (PRP-myvipers-002, Fase 1). ADITIVA.
--   · Tabla retail_categories (multitenant por restaurant_id, jerarquía vía parent_id).
--   · retail_products.category_id (nullable, FK) — el `category` texto libre existente
--     se CONSERVA (retrocompat de PRP-001); los productos viejos quedan sin category_id.
-- Nada se borra ni se renombra. Idempotente (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS retail_categories (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    name          TEXT NOT NULL,
    parent_id     UUID REFERENCES retail_categories(id) ON DELETE CASCADE,  -- jerarquía; borrar padre borra rama
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_retail_categories_restaurant ON retail_categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_retail_categories_parent ON retail_categories (parent_id);

-- Asociación producto → categoría (aditiva, nullable). ON DELETE SET NULL: borrar una
-- categoría no borra productos, solo los deja sin categoría.
ALTER TABLE retail_products
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES retail_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_retail_products_category ON retail_products (category_id);
