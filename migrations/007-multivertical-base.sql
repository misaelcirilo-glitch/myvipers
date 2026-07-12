-- 007: Base multivertical (PRP-myvipers-001, Fase 1). ADITIVA y RETROCOMPATIBLE.
--   · business_type en el tenant (restaurants), default 'restaurant' → El Machay intacto.
--   · enabled_modules (jsonb) por tenant, default ['restaurant'].
--   · Tapa el hueco de tenancy: restaurant_id en finance_transactions y boletas
--     (backfill al único tenant existente = El Machay), luego NOT NULL + FK.
-- Idempotente (guards IF NOT EXISTS). El tenant es la tabla `restaurants` (NO se renombra).

DO $$
DECLARE v_rest uuid;
BEGIN
  SELECT id INTO v_rest FROM restaurants ORDER BY created_at ASC LIMIT 1;

  -- business_type (discriminador de vertical)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='restaurants' AND column_name='business_type') THEN
    ALTER TABLE restaurants ADD COLUMN business_type TEXT NOT NULL DEFAULT 'restaurant';
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_business_type_chk
      CHECK (business_type IN ('restaurant','retail'));
  END IF;

  -- enabled_modules (feature flags de módulos por tenant)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='restaurants' AND column_name='enabled_modules') THEN
    ALTER TABLE restaurants ADD COLUMN enabled_modules jsonb NOT NULL DEFAULT '["restaurant"]'::jsonb;
  END IF;

  -- finance_transactions: cerrar hueco de tenancy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='finance_transactions' AND column_name='restaurant_id') THEN
    ALTER TABLE finance_transactions ADD COLUMN restaurant_id uuid;
    UPDATE finance_transactions SET restaurant_id = v_rest WHERE restaurant_id IS NULL;
    ALTER TABLE finance_transactions ALTER COLUMN restaurant_id SET NOT NULL;
    ALTER TABLE finance_transactions ADD CONSTRAINT finance_transactions_restaurant_fk
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
    CREATE INDEX idx_finance_restaurant ON finance_transactions(restaurant_id);
  END IF;

  -- boletas: cerrar hueco de tenancy
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='boletas' AND column_name='restaurant_id') THEN
    ALTER TABLE boletas ADD COLUMN restaurant_id uuid;
    UPDATE boletas SET restaurant_id = v_rest WHERE restaurant_id IS NULL;
    ALTER TABLE boletas ALTER COLUMN restaurant_id SET NOT NULL;
    ALTER TABLE boletas ADD CONSTRAINT boletas_restaurant_fk
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id);
    CREATE INDEX idx_boletas_restaurant ON boletas(restaurant_id);
  END IF;
END $$;
