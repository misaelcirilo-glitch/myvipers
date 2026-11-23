---
name: capturas-con-build-de-produccion
description: Para capturas y pruebas visuales usar build de producción (next build + next start), nunca next dev, y cerrar el servidor al terminar
metadata:
  type: feedback
---

Para capturas de pantalla y pruebas visuales: levantar la app con **build de producción** (`next build` + `next start`), **nunca** con `next dev`. Al terminar, **cerrar el servidor** y comprobar que no queda ningún proceso suyo.

**Why:** el 2026-11-22 el `next dev` de este proyecto acumuló 949 procesos `node` huérfanos (`.next\dev\build\postcss.js`, unos 43 GB reservados) y agotó la memoria del ordenador; los builds de otros proyectos fallaban por falta de memoria hasta que se cerraron a mano. Instrucción de Misael, 2026-11-22.

**How to apply:** en cualquier sesión que necesite ver la app en un navegador (Playwright, capturas, revisión visual). Si aun así hay que usar `next dev` para desarrollar, cerrarlo al acabar y comprobar que no quedan procesos `node` con la ruta del proyecto. La causa de la acumulación no está investigada.
