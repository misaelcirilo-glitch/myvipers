-- 019: Esquema de la cuenta global de cliente (PRP-myvipers-006, fase F1). ADITIVA e idempotente.
--
-- BORRADOR: no aplicar en producción hasta que Misael apruebe el PRP y esta migración.
--
-- No mueve ni modifica ningún dato existente. Añade:
--   · customer_accounts: la cuenta global, una por teléfono VERIFICADO (verified_at obligatorio:
--     no existen cuentas «pendientes»).
--   · users.account_id: a qué cuenta pertenece esa fila (cliente en un negocio). Vacía en todas
--     las filas al aplicar. REGLA CLAVE: solo se rellena DESPUÉS de verificar el teléfono (F2).
--   · users.sessions_valid_after: las sesiones emitidas antes de esa fecha dejan de valer (F3).
--   · users.data_consent_at: cuándo aceptó «Este negocio verá tu nombre y teléfono» (F5).
--   · phone_otp: códigos por WhatsApp. Sin teléfonos ni códigos en claro, solo huellas (HMAC).
--   · account_events: registro de lo que pasa con las cuentas, sin datos personales.
--
-- Nadie lee todavía nada de esto: con la 019 aplicada la app funciona exactamente igual.
-- Sin RLS, como el resto de la BD de MyVipers: el acceso es solo desde el servidor.
-- Reversa: migrations/rollback/019-cuenta-global-esquema-DOWN.sql

CREATE TABLE IF NOT EXISTS customer_accounts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_e164     TEXT NOT NULL UNIQUE
                   CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),   -- +51934879292
    verified_at    TIMESTAMPTZ NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS data_consent_at TIMESTAMPTZ;

DO $$
BEGIN
    -- Borrar una cuenta no borra al cliente de ningún negocio: solo lo desvincula.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_account_id_fkey') THEN
        ALTER TABLE users ADD CONSTRAINT users_account_id_fkey
            FOREIGN KEY (account_id) REFERENCES customer_accounts(id) ON DELETE SET NULL;
    END IF;
    -- El personal (admin, camarero, superadmin) nunca entra por la cuenta global.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_account_only_customers') THEN
        ALTER TABLE users ADD CONSTRAINT users_account_only_customers
            CHECK (account_id IS NULL OR role = 'customer');
    END IF;
END $$;

-- Una cuenta tiene como mucho una fila por negocio.
CREATE UNIQUE INDEX IF NOT EXISTS users_account_restaurant_uniq
    ON users (account_id, restaurant_id) WHERE account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS phone_otp (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_hash  TEXT NOT NULL,                 -- HMAC del teléfono completo; nunca el número
    ip_hash     TEXT,                          -- HMAC de la conexión
    code_hash   TEXT,                          -- HMAC del código; nunca el código
    purpose     TEXT NOT NULL CHECK (purpose IN ('verify', 'recover')),
    status      TEXT NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'sent', 'failed', 'blocked', 'verified', 'expired')),
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at     TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS phone_otp_phone_created_idx ON phone_otp (phone_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS phone_otp_ip_created_idx ON phone_otp (ip_hash, created_at DESC) WHERE ip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS phone_otp_created_idx ON phone_otp (created_at);

CREATE TABLE IF NOT EXISTS account_events (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id  UUID REFERENCES customer_accounts(id) ON DELETE SET NULL,
    event       TEXT NOT NULL,                 -- verified, rows_linked, recovered, switched, joined…
    detail      JSONB NOT NULL DEFAULT '{}',   -- ids y recuentos; sin nombres ni teléfonos
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_events_account_idx ON account_events (account_id, created_at DESC);

-- Comprobación posterior (debe devolver 0: ninguna fila tiene cuenta todavía):
--   SELECT count(*) FROM users WHERE account_id IS NOT NULL;
