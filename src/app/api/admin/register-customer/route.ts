import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';

const schema = z.object({
    name: z.string().min(2, 'Nombre requerido'),
    phone: z.string().min(9, 'Teléfono inválido'),
    email: z.string().email().optional().or(z.literal('')),
    password: z.string().min(4).optional(),
});

export async function POST(req: Request) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'waiter')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

    const { name, email } = parsed.data;
    const phone = parsed.data.phone.replace(/\D/g, '');
    // Password por defecto: últimos 4 dígitos del teléfono
    const password = parsed.data.password || phone.slice(-4);

    // Verificar si ya existe en este restaurante
    const existing = await db`
        SELECT id FROM users
        WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ${phone.slice(-9)}
          AND restaurant_id = ${session.restaurantId}
    `;
    if (existing.length > 0) {
        return NextResponse.json({ error: 'Este número ya está registrado' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const referralCode = name.substring(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

    const result = await db`
        INSERT INTO users (name, phone, email, password_hash, role, restaurant_id, referral_code, total_points, available_points)
        VALUES (${name}, ${phone}, ${email || null}, ${passwordHash}, 'customer', ${session.restaurantId}, ${referralCode}, 50, 50)
        RETURNING id, name, phone, vip_level, available_points
    `;

    // Puntos de bienvenida
    await db`INSERT INTO point_transactions (user_id, type, points, description, restaurant_id)
        VALUES (${result[0].id}, 'bonus', 50, 'Bienvenida VIP (registrado por staff)', ${session.restaurantId})`;

    return NextResponse.json({
        success: true,
        customer: result[0].name,
        phone: result[0].phone,
        points: 50,
        password: password,
    }, { status: 201 });
}
