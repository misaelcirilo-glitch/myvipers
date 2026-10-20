-- 015: Config multi-tenant real (fix de PRP-myvipers-001/002).
--   La tabla `config` quedó con PRIMARY KEY (key) desde el esquema single-tenant
--   original (001). `restaurant_id` se agregó después pero sin tocar la PK, así
--   que CUALQUIER tenant que no sea el primero (El Machay) choca con
--   "duplicate key" al intentar guardar su propia fila 'restaurant'/'vip_levels'/
--   'hours' — el INSERT ni siquiera llega a filtrar por tenant.
--   Fix: PK compuesta (restaurant_id, key) + restaurant_id NOT NULL.
-- Idempotente. El Machay conserva sus 3 filas intactas (ya tienen restaurant_id).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'config_pkey'
             AND conrelid = 'config'::regclass
             AND array_length(conkey, 1) = 1) THEN
    ALTER TABLE config ALTER COLUMN restaurant_id SET NOT NULL;
    ALTER TABLE config DROP CONSTRAINT config_pkey;
    ALTER TABLE config ADD CONSTRAINT config_pkey PRIMARY KEY (restaurant_id, key);
  END IF;
END $$;
