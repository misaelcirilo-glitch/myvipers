---
name: prp-006-f2-codigos
description: F2 del PRP-006 (códigos por WhatsApp y unión de filas): hecha solo en staging con envío simulado; qué falta y qué NO hacer sin OK
metadata:
  type: project
---

**F2 del PRP-006: escrita y probada SOLO en staging, con envío simulado (2026-11-23).** Rama `prp-006/f2-codigos`. No se fusiona ni llega a producción sin OK expreso de Misael (fusionar en `main` despliega `mvipers` solo), con copia previa de Neon y fuera del horario de El Machay. No necesita migración: usa las tablas de la 019.

- Dos interruptores, apagados por defecto: `ACCOUNT_GLOBAL_ENABLED` (sin él las rutas `/api/account/otp/*` dan 404) y `ACCOUNT_OTP_SEND_ENABLED` (sin él el envío es simulado y no se llama a Meta).
- Límites (decididos por Misael el 2026-11-23): 3 códigos por hora y 8 al día por número, 20 por hora por conexión, tope global 300/día (`OTP_DAILY_CAP`) con aviso al 80 % y al llegar; caduca a los 5 min, 5 intentos, bloqueo de 15 min. El PRP decía 3 cada 15 min: manda lo del 2026-11-23.
- En F2 solo existe «verificar» (cliente con sesión). «Recuperar acceso con código» es F4.
- Hallazgo: marcar `must_change_password` NO impide entrar a quien registró una fila ajena (el login le da un pase para elegir contraseña nueva). Por eso la fila ajena recibe además una contraseña inservible (`!cuenta-global`) y queda fuera de recuperar/restablecer por correo. Consecuencia: el dueño verificado no puede entrar en esas filas hasta la F3/F4 → no encender `ACCOUNT_GLOBAL_ENABLED` en producción antes de tener la F4.
- `users.sessions_valid_after` se escribe en F2, pero no cierra sesiones hasta la F3 (que es la que lo comprueba).
- Staging: la 019 se aplicó a mano el 2026-11-23 (no se rehízo como copia de producción). Las pruebas se lanzan con `TEST_DATABASE_URL` apuntando a staging; `.env.local` apunta a PRODUCCIÓN, no usarlo nunca para pruebas.

**Why:** retomar sin re-derivar. **How to apply:** leer antes de seguir con el PRP-006. F3 en adelante, solo con OK expreso.
