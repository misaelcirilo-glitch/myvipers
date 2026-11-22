-- 018: Marca "debe cambiar la contraseña en su próximo acceso". Aditiva e idempotente.
--
-- La usan las cuentas que crea el administrador (contraseña temporal que él conoce): el
-- login no abre sesión hasta que el cliente elige una contraseña propia.
-- Las cuentas existentes quedan en false. Las antiguas cuya contraseña son las 4 últimas
-- cifras del teléfono las detecta el propio login (no hace falta marcarlas aquí).
--
-- Aplicar ANTES de desplegar el código que la lee.
-- Para revertir: ALTER TABLE users DROP COLUMN IF EXISTS must_change_password;

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
