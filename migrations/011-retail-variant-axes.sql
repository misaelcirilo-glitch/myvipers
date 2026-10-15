-- 011: Ejes de variante flexibles (PRP-myvipers-002, Fase 3). ADITIVA.
-- Diseño (Fase 0): NO se tocan las variantes. retail_variants.size y .color siguen
-- siendo los DOS slots de valor (slot1=size, slot2=color). Solo se mueve la ETIQUETA
-- semántica al producto, para renombrar los ejes según el tipo de artículo:
--   · Ropa      → 'Talla'      / 'Color'
--   · Calzado   → 'Numeración' / 'Color'
--   · Accesorio → etiqueta vacía/NULL en un eje ⇒ ese eje se oculta (variante única / solo color)
--
-- DEFAULT 'Talla'/'Color' → los productos y variantes de PRP-001 quedan idénticos
-- (los slots existentes se reinterpretan como Talla/Color, sin migrar ni un dato).
-- Nada se borra ni se renombra: 'size'/'color' conservan su nombre físico de columna.

ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS axis1_label TEXT DEFAULT 'Talla';
ALTER TABLE retail_products ADD COLUMN IF NOT EXISTS axis2_label TEXT DEFAULT 'Color';
