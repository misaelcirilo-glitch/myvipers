-- 010: Producto retail enriquecido (PRP-myvipers-002, Fase 2). ADITIVA.
--   · brand           marca (opcional)
--   · discount_price  precio con descuento (opcional); si es NULL no hay oferta
--   · season          temporada (opcional, texto libre: 'Verano 2026', etc.)
-- Todas nullable → los productos de PRP-001 siguen válidos sin tocar nada.
-- is_active y description YA existen (008) → no se añaden. Nada se borra ni renombra.

ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS brand          TEXT;
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10,2);
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS season         TEXT;
