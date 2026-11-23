-- Reversa de 019. Deja el esquema como antes. PIERDE las cuentas, los vínculos fila-cuenta,
-- los consentimientos y el registro de códigos; no toca puntos, canjes, reservas ni clientes.
-- Solo tiene sentido mientras ninguna fase posterior (F2+) esté en uso.

DROP INDEX IF EXISTS users_account_restaurant_uniq;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_only_customers;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_id_fkey;
ALTER TABLE users DROP COLUMN IF EXISTS account_id;
ALTER TABLE users DROP COLUMN IF EXISTS sessions_valid_after;
ALTER TABLE users DROP COLUMN IF EXISTS data_consent_at;
DROP TABLE IF EXISTS account_events;
DROP TABLE IF EXISTS phone_otp;
DROP TABLE IF EXISTS customer_accounts;
