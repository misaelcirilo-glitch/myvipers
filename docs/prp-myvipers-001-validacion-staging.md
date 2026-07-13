# PRP-myvipers-001 (multivertical) — Validación en STAGING

> Fecha: 2026-07-13 · Branch: `multivertical` · Ejecutado **SOLO contra staging**, sin cutover, sin tocar producción ni `main`.

## Endpoints Neon (NO confundir)

Las cadenas de conexión de Neon contienen el **endpoint id** (`ep-…`), no el branch id (`br-…`).

| Rol | Branch | Endpoint (host) |
|-----|--------|-----------------|
| **STAGING** ✅ (aquí se testea) | `br-holy-queen-am3yec6u` | **`ep-nameless-snow-amidpyes`** (`…-amidpyes[-pooler].c-5.us-east-1.aws.neon.tech`) |
| **PRODUCCIÓN / main** ❌ (prohibido testear) | main | **`ep-falling-smoke-am68e6gk`** (`ep-falling-smoke-am68e6gk-pooler.c-5.us-east-1.aws.neon.tech/neondb`) |

**Regla previa a cualquier ejecución**: el host de `TEST_DATABASE_URL` DEBE contener `ep-nameless-snow-amidpyes` y NO `ep-falling-smoke-am68e6gk`. Si no cuadra → detenerse sin ejecutar.

## Migraciones aplicadas en staging

- `007-multivertical-base.sql` — `business_type` + `enabled_modules` en `restaurants`; `restaurant_id` en finanzas (`finance_transactions`) y `boletas` (cierre del hueco de tenancy).
- `008-retail.sql` — `retail_products`, `retail_variants`, `retail_stock_movements`.

## Resultados

1. **Fix de tenancy financiero** — 0 filas huérfanas (finanzas/boletas sin `restaurant_id`) tras la migración.
2. **Aislamiento entre tenants** (`tests/tenant-isolation.test.ts`) — **6/6 verde**. El scope por `restaurant_id` nunca filtra datos entre tenants en `finance_transactions`, `boletas` y `users`.
3. **Retail end-to-end** — **5/5 verde**:
   1. Crear producto en `retail_products`.
   2. Variantes talla/color en `retail_variants`.
   3. Movimientos de stock (entrada +10, entrada +5, salida −3 → **stock final 12** = suma de deltas). Replica la CTE atómica de `src/app/api/admin/retail/stock/route.ts`: `quantity` se guarda como delta con signo y el `stock` de la variante se actualiza en la misma sentencia con guard anti-negativo (`stock + delta >= 0`).
   4. Puntos y promociones del core funcionan para el tenant retail.
   5. **El Machay** (tenant restaurante, id `a0000000-0000-0000-0000-000000000001`) **NO ve** los productos/variantes retail de otro tenant.

Los tenants de prueba se crean con UUID marcados y se borran en teardown (verificado a 0). Nunca se tocan datos reales de El Machay.

## Cómo se ejecutó (de forma segura)

- La cadena de staging se pasa por un archivo efímero **gitignored** `.staging-url`; se lee sin imprimir la contraseña y se borra al terminar.
- `vitest.config.ts` NO carga ningún `.env` a propósito → la conexión SOLO viene de `TEST_DATABASE_URL` explícita.
- `TEST_DATABASE_URL="$(cat .staging-url)" npm test`.

## Pendiente (NO hecho en esta sesión)

- Cutover a producción: aplicar `007`/`008` a main con el mismo rigor (verificar host, backup previo).
- Merge de `multivertical` a `main`.
