import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { createToken, setSessionCookie } from '@/shared/lib/auth';
import { phoneKey, resolveLogin } from '@/shared/lib/account-match';

const schema = z.object({
    phone: z.string().min(9),
    password: z.string().min(1),
    restaurantSlug: z.string().optional(),
    // Tras elegir tienda en /login: la cuenta concreta (la contraseña se vuelve a comprobar).
    accountId: z.string().uuid().optional(),
});

type Account = {
    id: string; name: string; phone: string; password_hash: string; role: 'customer' | 'admin' | 'waiter';
    vip_level: string; available_points: number; restaurant_id: string; // NULL solo en la cuenta de plataforma
    restaurant_slug: string | null; restaurant_name: string | null; business_type: string | null;
};

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const { password, restaurantSlug, accountId } = parsed.data;
        const last9 = phoneKey(parsed.data.phone);

        // Un teléfono puede tener cuenta en varias tiendas: con slug hay como mucho una;
        // sin slug se traen todas y decide la contraseña.
        const result = (restaurantSlug
            ? await db`
                SELECT u.id, u.name, u.phone, u.password_hash, u.role, u.vip_level, u.available_points,
                       u.restaurant_id, r.slug as restaurant_slug, r.name as restaurant_name, r.business_type
                FROM users u
                JOIN restaurants r ON r.id = u.restaurant_id
                WHERE RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = ${last9}
                  AND r.slug = ${restaurantSlug}
                LIMIT 1
            `
            : await db`
                SELECT u.id, u.name, u.phone, u.password_hash, u.role, u.vip_level, u.available_points,
                       u.restaurant_id, r.slug as restaurant_slug, r.name as restaurant_name, r.business_type
                FROM users u
                LEFT JOIN restaurants r ON r.id = u.restaurant_id
                WHERE RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = ${last9}
                ORDER BY r.name NULLS LAST
            `) as Account[];

        const candidates = accountId ? result.filter(u => u.id === accountId) : result;
        if (candidates.length === 0) {
            return NextResponse.json({ error: 'Número no registrado' }, { status: 401 });
        }

        const resolution = await resolveLogin(candidates, password);
        if (resolution.kind === 'none') {
            return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
        }
        if (resolution.kind === 'choose') {
            // Solo se listan las tiendas cuya contraseña ya coincide.
            return NextResponse.json({
                choose: true,
                accounts: resolution.accounts.map(a => ({
                    accountId: a.id,
                    restaurantName: a.restaurant_name || 'MyVipers',
                    role: a.role,
                })),
            });
        }

        const user = resolution.account;

        const token = await createToken({
            userId: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            vipLevel: user.vip_level,
            restaurantId: user.restaurant_id,
            restaurantSlug: user.restaurant_slug || '',
        });

        await setSessionCookie(token);

        return NextResponse.json({
            success: true,
            user: {
                id: user.id, name: user.name, phone: user.phone, role: user.role,
                vipLevel: user.vip_level, points: user.available_points,
                restaurantSlug: user.restaurant_slug, businessType: user.business_type || 'restaurant',
            }
        });
    } catch (error: any) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
    }
}
