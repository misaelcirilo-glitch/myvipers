import bcrypt from 'bcryptjs';

/**
 * Un mismo teléfono puede tener cuenta en varias tiendas (cliente en una, admin en otra…),
 * cada una con su propia contraseña. Cuando el login llega SIN tienda (/login genérico),
 * se buscan todas las cuentas del teléfono y se quedan las que aceptan la contraseña:
 *   · 0 → contraseña incorrecta
 *   · 1 → se entra en esa cuenta
 *   · 2+ → el usuario elige tienda (se reenvía el login con restaurantSlug)
 */
export type LoginResolution<T> =
    | { kind: 'none' }
    | { kind: 'one'; account: T }
    | { kind: 'choose'; accounts: T[] };

export async function resolveLogin<T extends { password_hash: string }>(
    accounts: T[],
    password: string,
    compare: (plain: string, hash: string) => Promise<boolean> = bcrypt.compare,
): Promise<LoginResolution<T>> {
    const results = await Promise.all(
        accounts.map(a => (a.password_hash ? compare(password, a.password_hash) : Promise.resolve(false))),
    );
    const valid = accounts.filter((_, i) => results[i]);
    if (valid.length === 0) return { kind: 'none' };
    if (valid.length === 1) return { kind: 'one', account: valid[0] };
    return { kind: 'choose', accounts: valid };
}

/** Últimos 9 dígitos del teléfono: la misma clave que usan login, registro y el índice único. */
export function phoneKey(phone: string): string {
    return phone.replace(/\D/g, '').slice(-9);
}
