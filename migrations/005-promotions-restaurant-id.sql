-- 005: multi-tenant en promociones
-- La columna promotions.restaurant_id ya existe en la BD de producción pero no
-- estaba declarada en ninguna migración (drift). Esta migración es idempotente y
-- documenta el esquema real para que un re-provisionamiento desde cero no rompa
-- /api/promotions (que filtra por restaurant_id).

ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_promotions_restaurant_active
    ON promotions (restaurant_id, is_active);
