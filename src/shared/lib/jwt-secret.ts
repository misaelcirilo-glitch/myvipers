// Clave con la que se firman las sesiones. Obligatoria: NO hay clave de reserva en el código.
// Sin imports de servidor a propósito, para poder comprobarla al arrancar (instrumentation.ts).
export const JWT_SECRET_MIN_LENGTH = 32;

export function jwtSecret(env: Record<string, string | undefined> = process.env): Uint8Array {
    const value = env.JWT_SECRET;
    if (!value || value.length < JWT_SECRET_MIN_LENGTH) {
        throw new Error(`Falta JWT_SECRET o tiene menos de ${JWT_SECRET_MIN_LENGTH} caracteres: la app no puede firmar sesiones.`);
    }
    return new TextEncoder().encode(value);
}
