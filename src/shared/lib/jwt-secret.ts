// Clave con la que se firman las sesiones. Obligatoria: NO hay clave de reserva en el código.
// Sin imports de servidor a propósito, para poder comprobarla al arrancar (instrumentation.ts).
export const JWT_SECRET_MIN_LENGTH = 32;

// Claves que estuvieron escritas en el código o en el historial del repositorio: son públicas.
// Se rechazan aunque tengan 32+ caracteres (la antigua de producción tenía 35 y pasaba el mínimo).
const KNOWN_WEAK_SECRETS = new Set([
    'el-machay-pomabamba-2026-secret-key',
    'myvipers-secret-2026',
]);

export function jwtSecret(env: Record<string, string | undefined> = process.env): Uint8Array {
    const value = env.JWT_SECRET;
    if (!value || value.length < JWT_SECRET_MIN_LENGTH) {
        throw new Error(`Falta JWT_SECRET o tiene menos de ${JWT_SECRET_MIN_LENGTH} caracteres: la app no puede firmar sesiones.`);
    }
    if (KNOWN_WEAK_SECRETS.has(value.trim())) {
        throw new Error('JWT_SECRET es una clave antigua conocida (estuvo en el código): pon una nueva al azar de 32+ caracteres.');
    }
    return new TextEncoder().encode(value);
}
