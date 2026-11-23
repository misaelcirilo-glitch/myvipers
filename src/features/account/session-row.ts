import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { normalizeE164, rowPhoneMatchesE164 } from './phone';

// Quién pide o comprueba un código: SIEMPRE un cliente con sesión, y el número tiene que ser
// el de su propia fila (el cliente solo elige el prefijo de país). El personal no entra.

export type SessionRowResult =
    | { ok: true; userId: string; e164: string; alreadyVerified: boolean }
    | { ok: false; status: number; error: string };

export async function customerRowForPhone(rawPhone: string): Promise<SessionRowResult> {
    const session = await getSession();
    if (!session) return { ok: false, status: 401, error: 'Inicia sesión para verificar tu número' };
    if (session.role !== 'customer') return { ok: false, status: 403, error: 'Solo los clientes verifican su número' };

    const rows = await db`SELECT id, phone, role, account_id FROM users WHERE id = ${session.userId} LIMIT 1`;
    const row = rows[0] as { id: string; phone: string; role: string; account_id: string | null } | undefined;
    if (!row || row.role !== 'customer') return { ok: false, status: 403, error: 'Solo los clientes verifican su número' };

    const e164 = normalizeE164(rawPhone);
    if (!e164 || !rowPhoneMatchesE164(row.phone, e164)) {
        return { ok: false, status: 400, error: 'El número no coincide con el de tu cuenta. Revisa el prefijo de país.' };
    }
    return { ok: true, userId: row.id, e164, alreadyVerified: row.account_id !== null };
}
