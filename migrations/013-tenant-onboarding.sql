-- 013: Onboarding multi-vertical con aprobación (PRP-myvipers-003, F1). ADITIVA e idempotente.
--   · tenant_applications: solicitudes de alta (INERTES; no crean tenant hasta aprobar).
--   · users.is_platform_admin: admin transversal de plataforma (revisa/aprueba altas).
--   · Se QUITA el CHECK de business_type → los tipos de negocio se validan en la app
--     (src/shared/lib/verticals.ts), para añadir verticales sin tocar el schema.
-- El tenant sigue siendo la tabla `restaurants`.

-- Admin de plataforma (flag transversal, independiente del tenant)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

-- business_type: quitar el CHECK rígido (validación pasa a la app / verticals.ts)
ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS restaurants_business_type_chk;

-- Solicitudes de alta de negocio
CREATE TABLE IF NOT EXISTS tenant_applications (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name       text NOT NULL,
    slug                text NOT NULL,
    business_type       text NOT NULL,
    admin_name          text NOT NULL,
    admin_phone         text NOT NULL,
    admin_email         text,
    admin_password_hash text NOT NULL,
    country             text,
    notes               text,
    status              text NOT NULL DEFAULT 'pending',
    review_notes        text,
    reviewed_by         uuid REFERENCES users(id),
    reviewed_at         timestamptz,
    created_tenant_id   uuid REFERENCES restaurants(id),
    created_at          timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE constraint_name = 'tenant_applications_status_chk'
    ) THEN
        ALTER TABLE tenant_applications ADD CONSTRAINT tenant_applications_status_chk
            CHECK (status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_applications_status ON tenant_applications(status);
CREATE INDEX IF NOT EXISTS idx_tenant_applications_slug ON tenant_applications(slug);
