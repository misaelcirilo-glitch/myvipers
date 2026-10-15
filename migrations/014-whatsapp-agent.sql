-- 014: Agente de ventas por WhatsApp de MyVipers (PRP-myvipers-005). ADITIVA.
-- Tablas nuevas con prefijo mv_; no toca nada existente. Idempotente.
-- Sin RLS: igual que el resto de la BD de MyVipers, el acceso es solo desde
-- API routes del servidor (el webhook), nunca desde el cliente.
-- Un lead = una conversación (un número de WhatsApp), por eso no hay tabla
-- de conversaciones aparte: los mensajes cuelgan del lead.

CREATE TABLE IF NOT EXISTS mv_outreach_contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_phone_e164   TEXT NOT NULL UNIQUE,              -- +51999123456
    business_name   TEXT,
    business_type   TEXT,                              -- restaurant | retail (informativo)
    city            TEXT,
    country         TEXT,                              -- ISO-2 (PE, ES…)
    source          TEXT,                              -- de dónde salió el contacto (google maps, feria…)
    template_name   TEXT,                              -- plantilla de Meta enviada
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','responded','not_interested','bounced')),
    sent_at         TIMESTAMPTZ,
    responded_at    TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mv_leads (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_phone_e164        TEXT NOT NULL UNIQUE,
    profile_name         TEXT,                          -- nombre de perfil de WhatsApp
    business_type        TEXT CHECK (business_type IN ('restaurant','retail')),
    country              TEXT,                          -- ISO-2; por defecto el del prefijo del número
    source               TEXT NOT NULL DEFAULT 'organic'
                         CHECK (source IN ('organic','outbound_cold','ads')),
    status               TEXT NOT NULL DEFAULT 'qualifying'
                         CHECK (status IN ('qualifying','directed_to_signup','signed_up','not_interested')),
    outreach_contact_id  UUID REFERENCES mv_outreach_contacts(id) ON DELETE SET NULL,
    restaurant_id        UUID REFERENCES restaurants(id) ON DELETE SET NULL,  -- futuro: cruce con el alta real
    last_message_at      TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mv_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES mv_leads(id) ON DELETE CASCADE,
    direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
    wa_message_id   TEXT UNIQUE,                        -- dedupe de reintentos de Meta
    message_type    TEXT NOT NULL DEFAULT 'text',       -- text | button | image… | fallback
    content         TEXT NOT NULL,
    model           TEXT,                               -- modelo que generó la respuesta (outbound)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mv_messages_lead_created ON mv_messages (lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mv_leads_status ON mv_leads (status);
