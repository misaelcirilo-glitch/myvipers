-- 006: Boletas de venta simples (documento imprimible, NO comprobante electrónico SUNAT)
-- Un solo restaurante (El Machay), sin restaurant_id, misma convención que finance_transactions.

-- Secuencia para correlativo atómico (evita colisiones bajo concurrencia).
CREATE SEQUENCE IF NOT EXISTS boletas_correlativo_seq START 1;

CREATE TABLE IF NOT EXISTS boletas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    serie TEXT NOT NULL DEFAULT 'B001',
    correlativo INT NOT NULL,
    numero TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    cliente_nombre TEXT,
    cliente_doc TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC(10,2),
    total NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boletas_created_at ON boletas (created_at DESC);
