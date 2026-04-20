import { db } from '@/shared/lib/db';
import { createToken, setSessionCookie } from '@/shared/lib/auth';
import { NextResponse } from 'next/server';

const DEMO_PHONE = '944933545';

export async function POST() {
    try {
        const rows = await db`
            SELECT u.id, u.name, u.phone, u.role, u.vip_level, u.restaurant_id, r.slug
            FROM users u
            LEFT JOIN restaurants r ON r.id = u.restaurant_id
            WHERE u.phone = ${DEMO_PHONE} AND u.role = 'admin'
            LIMIT 1
        `;

        if (rows.length === 0) {
            return NextResponse.json({ error: 'Demo no disponible' }, { status: 404 });
        }

        const user = rows[0];
        const token = await createToken({
            userId: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            vipLevel: user.vip_level || 'bronce',
            restaurantId: user.restaurant_id || '',
            restaurantSlug: user.slug || '',
        });

        await setSessionCookie(token);

        return NextResponse.json({
            ok: true,
            user: { id: user.id, name: user.name, role: user.role, isDemo: true },
        });
    } catch (e) {
        console.error('Demo login error:', e);
        return NextResponse.json({ error: 'Error iniciando demo' }, { status: 500 });
    }
}
