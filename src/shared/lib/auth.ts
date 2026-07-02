import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'myvipers-secret-2026');

export interface Session {
    userId: string;
    name: string;
    phone: string;
    role: 'customer' | 'admin' | 'waiter' | 'superadmin';
    vipLevel: string;
    restaurantId: string;
    restaurantSlug: string;
}

export async function createToken(payload: Session): Promise<string> {
    return new SignJWT(payload as any)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('30d')
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<Session | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as unknown as Session;
    } catch {
        return null;
    }
}

// --- Recuperación de contraseña ---
// Token de reseteo firmado (sin tabla): incluye una huella del password_hash
// actual, de modo que al cambiar la contraseña el token deja de ser válido
// (single-use). Expira en 1 hora.
export async function createResetToken(userId: string, passwordHash: string): Promise<string> {
    return new SignJWT({ userId, type: 'pwreset', fp: passwordHash.slice(-12) })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('1h')
        .sign(JWT_SECRET);
}

export async function verifyResetToken(token: string): Promise<{ userId: string; fp: string } | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        if ((payload as any).type !== 'pwreset' || !payload.userId) return null;
        return { userId: payload.userId as string, fp: (payload as any).fp as string };
    } catch {
        return null;
    }
}

export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    const session = await verifyToken(token);
    if (!session) return null;

    // Compatibilidad con tokens antiguos (sin restaurantId): resolver desde BD
    if (!session.restaurantId) {
        try {
            const rows = await db`
                SELECT u.restaurant_id, r.slug
                FROM users u
                LEFT JOIN restaurants r ON r.id = u.restaurant_id
                WHERE u.id = ${session.userId}
                LIMIT 1
            `;
            if (rows.length > 0 && rows[0].restaurant_id) {
                session.restaurantId = rows[0].restaurant_id;
                session.restaurantSlug = rows[0].slug || '';
            }
        } catch (e) {
            console.error('Error resolving restaurant from session:', e);
        }
    }

    return session;
}

export async function setSessionCookie(token: string) {
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
    });
}

export async function clearSession() {
    const cookieStore = await cookies();
    cookieStore.delete('token');
}
