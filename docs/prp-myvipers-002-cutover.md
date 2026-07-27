# PRP-myvipers-002 — Plan de cutover a producción

> Mismo rigor que PRP-001. **Producción = endpoint `ep-falling-smoke-am68e6gk`.**
> Requiere OK explícito de Misael antes de escribir en producción.

## Pre-requisitos
- Rama `retail-base` con Fases 1-5 commiteadas y **15/15 verde en staging**.
- Cadena de producción en `.prod-url` (gitignored, efímera). Verificar que el host
  contiene `ep-falling-smoke-am68e6gk` y **NO** `ep-nameless-snow-amidpyes`.

## Pasos (en orden)

1. **Backup**: crear branch de respaldo en Neon desde producción (point-in-time),
   por si hay que revertir. Las migraciones son aditivas, pero el backup es la red.

2. **Aplicar migraciones a producción** (idempotentes, aditivas), en orden:
   `009-retail-categories.sql` → `010-retail-product-fields.sql` → `011-retail-variant-axes.sql`.

3. **Verificar en producción** (solo lectura tras aplicar):
   - `retail_categories` existe; `retail_products` tiene `category_id`, `brand`,
     `discount_price`, `season`, `axis1_label`, `axis2_label`.
   - El Machay sigue `restaurant` / `["restaurant"]`, sin datos retail.
   - Productos retail existentes en prod (si los hay) siguen válidos (campos nuevos NULL,
     ejes por DEFAULT Talla/Color).

4. **Vercel Blob** (credencial — la pega Misael en el panel de Vercel, no por CLI):
   conectar un Blob store al/los proyecto(s) donde corra el módulo retail → Vercel
   inyecta `BLOB_READ_WRITE_TOKEN`. Sin él, la subida de foto degrada a 503 (el resto
   del módulo funciona). Guardar solo la URL en BD ya está implementado.

5. **Git**: merge `retail-base` → `main`, tag anotado `prp-myvipers-002-complete`.

6. **Deploy Vercel** (`vercel --prod`): `mvipers` (myvipers.es) y `el-machay`
   (el-machay.vercel.app). Orden y verificación de alias como en PRP-001.

7. **Smoke test post-deploy**: en un tenant retail real, el panel admin carga el módulo,
   se crea categoría + producto con marca/oferta/temporada, se sube foto (si Blob está
   conectado) y se ve la URL persistida.

## Rollback
Migraciones aditivas → revertir código (redeploy del commit previo) deja las columnas
nuevas sin usar, sin romper nada. Si hiciera falta, restaurar desde el branch de backup.

## Riesgos
- **Producción es producción**: verificar host `.prod-url` antes de cada escritura.
- El único paso con credencial (Blob token) lo hace Misael en el panel; nunca en código ni chat.
