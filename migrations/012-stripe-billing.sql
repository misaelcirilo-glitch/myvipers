-- 012: Suscripciones Stripe por tenant (plataforma MyVipers). ADITIVA.
-- El tenant es `restaurants` (sirva el vertical que sirva: restaurante, retail…).
-- El precio es el mismo para todos; solo varía región/periodo (plan_lookup_key).
-- Todas nullable → nada previo se rompe. Idempotente.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS subscription_status    TEXT;   -- active / past_due / canceled… (null = sin suscripción)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS plan_lookup_key        TEXT;   -- p.ej. myvipers_anual_eur
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_restaurants_stripe_customer ON restaurants (stripe_customer_id);
