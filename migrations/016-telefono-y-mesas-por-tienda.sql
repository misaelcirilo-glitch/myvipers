-- 016: Teléfono y número de mesa únicos POR TIENDA, no globales. Idempotente, en una transacción.
--
--   · users: antes `users_phone_key UNIQUE (phone)` impedía que una persona tuviera cuenta en
--     dos tiendas (ni como cliente ni como admin de otra). Ahora el teléfono es único dentro
--     de cada tienda, comparando los últimos 9 dígitos (igual que login/registro).
--     Las cuentas sin tienda (restaurant_id NULL, p. ej. admin de plataforma) siguen siendo
--     únicas por teléfono entre ellas.
--   · tables: antes `tables_number_key UNIQUE (number)` hacía que solo UNA tienda pudiera
--     tener la "Mesa 1"; por eso fallaba el alta de cualquier restaurante nuevo. Ahora el
--     número de mesa es único dentro de cada tienda.
--
-- Para revertir (solo si ningún teléfono/mesa se repite ya entre tiendas):
--   DROP INDEX IF EXISTS users_restaurant_phone9_uniq, users_sin_tienda_phone9_uniq;
--   ALTER TABLE users ADD CONSTRAINT users_phone_key UNIQUE (phone);
--   ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_restaurant_number_key;
--   ALTER TABLE tables ADD CONSTRAINT tables_number_key UNIQUE (number);

BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS users_restaurant_phone9_uniq
    ON users (restaurant_id, (RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9)))
    WHERE restaurant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_sin_tienda_phone9_uniq
    ON users ((RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9)))
    WHERE restaurant_id IS NULL;

ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_number_key;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tables_restaurant_number_key') THEN
        ALTER TABLE tables ADD CONSTRAINT tables_restaurant_number_key UNIQUE (restaurant_id, number);
    END IF;
END $$;

COMMIT;
