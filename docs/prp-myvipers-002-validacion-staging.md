# PRP-myvipers-002 — Validación en staging

> Todo verificado en **staging** (`bold-dream-82086274`, branch `br-holy-queen-am3yec6u`
> = endpoint `ep-nameless-snow-amidpyes`). **Nada aplicado a producción todavía.**

## Migraciones (aditivas, idempotentes)
- `009-retail-categories.sql` — `retail_categories` (jerárquica, `parent_id`) + `retail_products.category_id` (nullable, FK ON DELETE SET NULL).
- `010-retail-product-fields.sql` — `brand`, `discount_price`, `season` en `retail_products` (nullable).
- `011-retail-variant-axes.sql` — `axis1_label`, `axis2_label` en `retail_products` (DEFAULT 'Talla'/'Color').

Ninguna borra ni renombra nada. `size`/`color` en `retail_variants` se conservan y se
reinterpretan como slots de valor (eje1/eje2); cero migración de datos de variantes.

## Tests automatizados — **15/15 verde en staging**
`TEST_DATABASE_URL="…ep-nameless-snow-amidpyes…" npm test`
- `tenant-isolation.test.ts` (**10**): finance, boletas, users + **retail_categories** y
  **retail_products** (con campos nuevos) — un tenant nunca ve datos de otro; control por filtro.
- `retail-e2e.test.ts` (**5**): categoría jerárquica (Polos→Ropa) · producto con
  marca/oferta/temporada/foto + join de categoría · variantes de los 3 tipos sobre la misma
  estructura (Talla=M, Numeración=42, accesorio sin ejes) · stock +10/+5/-3 = **12** con guard
  anti-negativo (misma CTE atómica del endpoint) · promoción del core activa para el tenant retail.

## Regresión
- **El Machay** (`a0000000-…-0001`): sigue `business_type=restaurant`, `enabled_modules=["restaurant"]`,
  0 productos/categorías retail. No ve el módulo. Intacto.
- Producto **legacy PRP-001** (campos nuevos NULL, ejes por DEFAULT Talla/Color): sigue válido.

## Herencia del core
Puntos y promociones del core operan para el tenant retail (validado en PRP-001 y re-confirmado
aquí con la promo activa scopeada por `restaurant_id`).

## Pendiente para el cierre (`prp-myvipers-002-complete`)
Cutover a producción con el procedimiento seguro del PRP-001 → ver `prp-myvipers-002-cutover.md`.
