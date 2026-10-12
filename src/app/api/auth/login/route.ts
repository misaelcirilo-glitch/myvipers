import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/shared/lib/db';
import { createToken, setSessionCookie } from '@/shared/lib/auth';

const schema = z.object({
    phone: z.string().min(9),
    password: z.string().min(1),
    restaurantSlug: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const { password, restaurantSlug } = parsed.data;
        const last9 = parsed.data.phone.replace(/\D/g, '').slice(-9);

        let result;
        if (restaurantSlug) {
            result = await db`
                SELECT u.id, u.name, u.phone, u.password_hash, u.role, u.vip_level, u.available_points,
                       u.restaurant_id, r.slug as restaurant_slug, r.business_type
                FROM users u
                JOIN restaurants r ON r.id = u.restaurant_id
                WHERE RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = ${last9}
                  AND r.slug = ${restaurantSlug}
                LIMIT 1
            `;
        } else {
            result = await db`
                SELECT u.id, u.name, u.phone, u.password_hash, u.role, u.vip_level, u.available_points,
                       u.restaurant_id, r.slug as restaurant_slug, r.business_type
                FROM users u
                LEFT JOIN restaurants r ON r.id = u.restaurant_id
                WHERE RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = ${last9}
                LIMIT 1
            `;
        }

        if (result.length === 0) {
            return NextResponse.json({ error: 'Número no registrado' }, { status: 401 });
        }

        const user = result[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
        }

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
