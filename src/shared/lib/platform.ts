import { getSession, type Session } from './auth';
import { db } from './db';

/**
 * Gate del panel de PLATAFORMA (transversal). Devuelve la sesión solo si el usuario
 * tiene `is_platform_admin = true` en BD (autoridad server-side, no confía en el token
 * ni en la UI — lección del incidente demo-login). Úsalo en todo endpoint /api/platform/*.
 */
export async function requirePlatformAdmin(): Promise<Session | null> {
    const session = await getSession();
    if (!session) return null;
    const rows = await db`SELECT is_platform_admin FROM users WHERE id = ${session.userId} LIMIT 1`;
    if (rows.length === 0 || rows[0].is_platform_admin !== true) return null;
    return session;
}
