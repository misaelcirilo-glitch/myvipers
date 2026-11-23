---
name: prp-006-f1-019-en-produccion
description: F1 del PRP-006 (migración 019, cuenta global) aplicada en producción el 2026-11-23; cómo volver atrás y regla de reversa a partir de la F2
metadata:
  type: project
---

**F1 del PRP-006 en producción desde el 2026-11-23 (09:55, hora de España), con OK expreso de Misael.**

- Copia previa en Neon (proyecto `myvipers`): rama `copia-antes-019-20261123`, tomada de producción justo antes, sin fecha de borrado.
- 019 aplicada en una transacción sobre la rama `main` de Neon. Después: 26 tablas (23 + `customer_accounts`, `phone_otp`, `account_events`, vacías) y `users` con 18 columnas (15 + `account_id`, `sessions_valid_after`, `data_consent_at`, vacías en todas las filas). Conteos iguales: users 132, restaurants 6, point_transactions 414; huella de usuarios idéntica a la de antes.
- PR #9 (`5c3e829`) y PR #11 (`5172cd2`) fusionados. Producción: `mvipers-gojt2ysb2` (myvipers.es) y `el-machay-7zuju5zg3` (el-machay.vercel.app). Login comprobado en las dos con un número inexistente (401 «Número no registrado»); no se entró con ninguna cuenta real.
- `mvipers` se despliega solo al fusionar en `main`; `el-machay` NO está conectado a GitHub: hay que lanzar `npx vercel deploy --prod` desde la carpeta del proyecto (está enlazada a el-machay).

## Vuelta atrás

**Mientras solo exista la F1 (nada lee ni escribe las tablas nuevas):** aplicar en producción el fichero
`migrations/rollback/019-cuenta-global-esquema-DOWN.sql` (9 sentencias: quita el índice, las 2 restricciones, las 3 columnas y las 3 tablas). No toca puntos, canjes, reservas ni clientes. Probado dos veces en staging. El código no hace falta revertirlo: no usa nada de la 019. Si aun así se quiere la versión anterior de la app:
`npx vercel rollback mvipers-d3th4vgcr-misael-cirilo-vidals-projects.vercel.app` y
`npx vercel rollback el-machay-953560t0z-misael-cirilo-vidals-projects.vercel.app`.

**A partir de la F2 (cuando haya cuentas, vínculos o códigos reales): el DOWN ya NO es la vuelta atrás segura**, porque borra esas cuentas, vínculos y consentimientos. La vuelta atrás segura pasa a ser la copia de Neon: antes de cada fase, copia nueva desde producción (sin fecha de borrado) y, si algo falla, restaurar desde esa copia. Neon solo guarda 6 horas de historial en este proyecto, así que la copia en rama es la única red.

**Why:** decisión de Misael al dar el OK de la F1 (2026-11-23). **How to apply:** leer antes de tocar la BD de producción en el PRP-006. F2 en adelante NO se empiezan sin OK expreso de Misael.
