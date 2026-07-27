# PRP-myvipers-002 · Fase 0 — Mapeo de lo existente

> Verificado contra el **esquema real de staging** (`bold-dream-82086274`,
> branch `br-holy-queen-am3yec6u` = endpoint `ep-nameless-snow-amidpyes`),
> solo lectura, 2026-07-27. Coincide 1:1 con las migraciones `007`/`008`
> (ya en producción tras el cutover del PRP-001).

## 1. Estado actual de las tablas retail (producción)

### `retail_products`
| Columna | Tipo | Null | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| restaurant_id | uuid | NO | — (FK restaurants) |
| name | text | NO | — |
| description | text | SÍ | — |
| **category** | text | SÍ | — (texto libre) |
| base_price | numeric(10,2) | NO | 0 |
| **image_url** | text | SÍ | — |
| sort_order | integer | NO | 0 |
| **is_active** | boolean | NO | true |
| created_at / updated_at | timestamptz | NO | now() |

### `retail_variants`
| Columna | Tipo | Null | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| restaurant_id | uuid | NO | — (FK) |
| product_id | uuid | NO | — (FK, ON DELETE CASCADE) |
| **size** | text | SÍ | — (S/M/L o 38/40…) |
| **color** | text | SÍ | — |
| sku | text | SÍ | — (índice único parcial por tenant) |
| price | numeric(10,2) | SÍ | — (override del base) |
| stock | integer | NO | 0 |
| low_stock_threshold | integer | NO | 3 |
| is_active | boolean | NO | true |
| created_at | timestamptz | NO | now() |

### `retail_stock_movements`
Auditoría de stock: `type` (entrada/salida/ajuste), `quantity` (delta con signo),
`reason`, `created_by`. El stock se actualiza atómicamente vía CTE (`stock/route.ts`).
**No se toca en este PRP.**

### Contexto core reutilizable
- `restaurants.business_type` (`'restaurant'|'retail'` CHECK) + `enabled_modules` jsonb → el gating de módulo ya existe.
- `promotions.restaurant_id` (nullable) → las promos del core **ya filtran por tenant**. No se duplica nada; retail las hereda tal cual (validado en PRP-001).

## 2. Qué se AÑADE vs qué se GENERALIZA vs qué YA EXISTE

| Campo/tabla del PRP-002 | Situación | Acción |
|---|---|---|
| `retail_categories` (jerárquica) | No existe | **AÑADIR** (Fase 1) |
| `retail_products.category_id` | No existe | **AÑADIR** nullable + FK (Fase 1). El `category` texto libre **se conserva** (retrocompat), queda en desuso para nuevos productos |
| `retail_products.brand` | No existe | **AÑADIR** nullable (Fase 2) |
| `retail_products.discount_price` | No existe | **AÑADIR** nullable (Fase 2) |
| `retail_products.season` | No existe | **AÑADIR** nullable (Fase 2) |
| `retail_products.is_active` | **Ya existe** | Solo confirmar (Fase 2) |
| `retail_products.description` | **Ya existe** | Solo confirmar (Fase 2) |
| `retail_products.image_url` | **Ya existe** | Fase 4 es **solo integración Blob** (subida/almacén), la columna ya está |
| Ejes de variante flexibles | `size`/`color` fijos hoy | **GENERALIZAR** (Fase 3, ver §3) |
| Herencia de puntos/promos | Ya funciona (PRP-001) | Solo re-verificar (Fase 5) |

## 3. Diseño de ejes de variante flexibles (Fase 3) — decisión técnica central

**Recomendado (mínimo y sin migración de datos de variantes):**
tratar `retail_variants.size` y `color` como **dos slots de valor genéricos**
(slot 1 y slot 2), y mover solo la **etiqueta semántica** al producto.

- Añadir a `retail_products`: `axis1_label` y `axis2_label` (text, nullable).
- `size` = valor del eje 1 · `color` = valor del eje 2 (los datos actuales ya encajan: talla→eje1, color→eje2).
- La UI etiqueta los dos campos de variante según el producto:
  - Ropa → eje1 "Talla", eje2 "Color"
  - Calzado → eje1 "Numeración", eje2 "Color"
  - Accesorios → sin ejes (variante "Estándar") o solo eje2 "Color"
- `axis*_label` nulo ⇒ la UI cae a "Talla"/"Color" ⇒ **los productos y variantes de PRP-001 no cambian ni un dato**.

**Por qué no columnas `axis1_name/value` nuevas en la variante:** duplicarían la
etiqueta en cada fila y crearían doble fuente de verdad con `size`/`color`.
Reusar `size`/`color` como slots + etiqueta en el producto es más limpio, cero
migración de datos y 100 % retrocompatible. (Nada se renombra: `size`/`color`
mantienen su nombre físico, solo cambia su interpretación como slot 1/2.)

## 4. Plan de migraciones (numeración continua)

- `009-retail-categories.sql` → tabla `retail_categories` + `retail_products.category_id`.
- `010-retail-product-fields.sql` → `brand`, `discount_price`, `season`, `axis1_label`, `axis2_label` en `retail_products`.

Todas ADITIVAS (nullable / con default). Nada se borra ni renombra. Validación en
staging antes de cutover a producción (mismo procedimiento del PRP-001: backup
branch Neon + aplicar en staging + verificar + cutover).

## 5. Cierre Fase 0
Mapa confirmado contra esquema real. Pendiente: **OK de Misael** para arrancar Fase 1.
