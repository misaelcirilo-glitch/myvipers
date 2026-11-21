-- 017: Borrar dos tablas de copia que quedaron en producción el 2026-10-19. Idempotente.
--
--   · users_password_backup: 1 fila. Hash de la contraseña ANTERIOR de un cliente, guardado
--     cuando el administrador le puso una temporal. Ya no coincide con la actual; conservarlo
--     es guardar una credencial antigua sin uso.
--   · restaurants_backup_20261019_huerfanos: 2 filas. Copia de dos negocios de prueba que ya
--     no existen en `restaurants`.
--
-- Ninguna parte de la app lee estas tablas ni hay claves ajenas que apunten a ellas.
-- NO es reversible: los datos se pierden. Si hicieran falta, existen en las copias de Neon
-- (ramas backup-* y la recuperación a un momento anterior).
--
-- Comprobación previa (debe devolver 1 y 2):
--   SELECT (SELECT count(*) FROM users_password_backup), (SELECT count(*) FROM restaurants_backup_20261019_huerfanos);

BEGIN;
DROP TABLE IF EXISTS users_password_backup;
DROP TABLE IF EXISTS restaurants_backup_20261019_huerfanos;
COMMIT;

-- Comprobación posterior (debe devolver 0 filas):
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN ('users_password_backup', 'restaurants_backup_20261019_huerfanos');
