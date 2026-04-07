import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';

const schema = z.object({
    phone: z.string().optional(),
    userId: z.string().uuid().optional(),
    amount: z.number().min(0.01),
}).refine(d => d.phone || d.userId, { message: 'phone o userId requerido' });

export async function POST(req: Request) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'waiter')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const { phone, userId, amount } = parsed.data;

        let customer;
        if (userId) {
            customer = await db`
                SELECT id, name, available_points, total_points, vip_level
                FROM users WHERE id = ${userId} LIMIT 1
            `;
        } else {
            const last9 = (phone || '').replace(/\D/g, '').slice(-9);
            customer = await db`
                SELECT id, name, available_points, total_points, vip_level
                FROM users
                WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ${last9}
                LIMIT 1
            `;
        }

        if (customer.length === 0) {
            return NextResponse.json({ error: 'Cliente no encontrado. Debe registrarse primero.' }, { status: 404 });
        }

        const user = customer[0];
        const pointsToAdd = Math.floor(amount); // 1 sol = 1 punto

        await db`UPDATE users SET
            available_points = available_points + ${pointsToAdd},
            total_points = total_points + ${pointsToAdd},
            vip_level = CASE
                WHEN total_points + ${pointsToAdd} >= 5000 THEN 'inca'
                WHEN total_points + ${pointsToAdd} >= 1500 THEN 'oro'
                WHEN total_points + ${pointsToAdd} >= 500 THEN 'plata'
                ELSE 'bronce'
            END
            WHERE id = ${user.id}`;

        const desc = `Consumo S/${amount.toFixed(2)}`;
        await db`INSERT INTO point_transactions (user_id, type, points, description, reference_amount, performed_by)
            VALUES (${user.id}, 'earn', ${pointsToAdd}, ${desc}, ${amount}, ${session.userId})`;

        const updated = await db`SELECT available_points, total_points, vip_level FROM users WHERE id = ${user.id}`;

        return NextResponse.json({
            success: true,
            customer: user.name,
            pointsAdded: pointsToAdd,
            newBalance: updated[0].available_points,
            vipLevel: updated[0].vip_level,
        });
    } catch (error: any) {
        console.error('Admin points error:', error);
        return NextResponse.json({ error: 'Error al asignar puntos' }, { status: 500 });
    }
}
