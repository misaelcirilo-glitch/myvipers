// Se ejecuta una vez al arrancar el servidor. Si falta JWT_SECRET (o es corta) el arranque
// falla aquí, con un mensaje claro, en vez de firmar sesiones con una clave conocida.
export async function register() {
    if (process.env.NEXT_RUNTIME === 'edge') return;
    const { jwtSecret } = await import('@/shared/lib/jwt-secret');
    jwtSecret();
}
