import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/shared/lib/db';
import { createToken, setSessionCookie } from '@/shared/lib/auth';

const schema = z.object({
    name: z.string().min(2, 'Nombre muy corto'),
    phone: z.string().min(9, 'Teléfono inválido'),
    email: z.string().email('Email inválido').optional().or(z.literal('')),
    password: z.string().min(4, 'Mínimo 4 caracteres'),
    referralCode: z.string().optional(),
    restaurantSlug: z.string().optional(),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const { name, email, password, referralCode, restaurantSlug } = parsed.data;
        const phone = parsed.data.phone.replace(/\D/g, '');

        // Verificar restaurante (fallback al primero si no viene slug)
        let restaurant;
        if (restaurantSlug) {
            restaurant = await db`SELECT id, slug, name, business_type FROM restaurants WHERE slug = ${restaurantSlug} AND is_active = true`;
        } else {
            restaurant = await db`SELECT id, slug, name, business_type FROM restaurants WHERE is_active = true ORDER BY created_at ASC LIMIT 1`;
        }
        if (restaurant.length === 0) {
            return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
        }
        const restaurantId = restaurant[0].id;
        const finalSlug = restaurant[0].slug;

        // Verificar si ya existe en este restaurante
        const existing = await db`
            SELECT id FROM users
            WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ${phone.slice(-9)}
              AND restaurant_id = ${restaurantId}
        `;
        if (existing.length > 0) {
            return NextResponse.json({ error: 'Este número ya está registrado en este restaurante' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const myReferralCode = name.substring(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

        let referredBy = null;
        if (referralCode) {
            const referrer = await db`SELECT id FROM users WHERE referral_code = ${referralCode.toUpperCase()} AND restaurant_id = ${restaurantId}`;
            if (referrer.length > 0) referredBy = referrer[0].id;
        }

        const result = await db`
            INSERT INTO users (name, phone, email, password_hash, referral_code, referred_by, restaurant_id)
            VALUES (${name}, ${phone}, ${email || null}, ${passwordHash}, ${myReferralCode}, ${referredBy}, ${restaurantId})
            RETURNING id, name, phone, role, vip_level
        `;

        const user = result[0];

        await db`INSERT INTO point_transactions (user_id, type, points, description, restaurant_id) VALUES (${user.id}, 'bonus', 50, 'Bienvenida VIP', ${restaurantId})`;
        await db`UPDATE users SET total_points = 50, available_points = 50 WHERE id = ${user.id}`;

        if (referredBy) {
            await db`INSERT INTO point_transactions (user_id, type, points, description, restaurant_id) VALUES (${referredBy}, 'referral', 100, ${`Referido: ${name}`}, ${restaurantId})`;
            await db`UPDATE users SET total_points = total_points + 100, available_points = available_points + 100 WHERE id = ${referredBy}`;
        }

        const token = await createToken({
            userId: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            vipLevel: user.vip_level,
            restaurantId,
            restaurantSlug: finalSlug,
        });

        await setSessionCookie(token);

        return NextResponse.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, vipLevel: user.vip_level, points: 50, restaurantSlug: finalSlug, businessType: restaurant[0].business_type || 'restaurant' } });
    } catch (error: any) {
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Error al registrar' }, { status: 500 });
    }
}
