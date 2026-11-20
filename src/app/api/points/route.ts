import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { getTenantConfig } from '@/shared/lib/tenant';
import { z } from 'zod';

// GET: history + rewards
export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const [history, rewards, user] = await Promise.all([
        db`SELECT type, points, description, created_at FROM point_transactions WHERE user_id = ${session.userId} AND restaurant_id = ${session.restaurantId} ORDER BY created_at DESC LIMIT 30`,
        db`SELECT id, name, description, points_cost, category FROM rewards WHERE is_active = true AND restaurant_id = ${session.restaurantId} ORDER BY sort_order`,
        db`SELECT total_points, available_points, vip_level FROM users WHERE id = ${session.userId}`,
    ]);

    return NextResponse.json({ history, rewards, user: user[0] });
}

// POST: redeem reward
const redeemSchema = z.object({ rewardId: z.string().uuid() });

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    try {
        const body = await req.json();
        const parsed = redeemSchema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

        const { rewardId } = parsed.data;

        const reward = await db`SELECT id, name, points_cost FROM rewards WHERE id = ${rewardId} AND is_active = true AND restaurant_id = ${session.restaurantId}`;
        if (reward.length === 0) return NextResponse.json({ error: 'Premio no encontrado' }, { status: 404 });

        // Comprobar el saldo, descontarlo y apuntar el canje es UNA sola sentencia: el UPDATE solo
        // descuenta si el saldo alcanza, y el movimiento y el canje solo se escriben si descontó.
        // Dos canjes simultáneos ya no pueden gastar el mismo saldo.
        const cost = reward[0].points_cost;
        const done = await db`
            WITH spent AS (
                UPDATE users SET available_points = available_points - ${cost}::int
                WHERE id = ${session.userId} AND restaurant_id = ${session.restaurantId} AND available_points >= ${cost}::int
                RETURNING id
            ), tx AS (
                INSERT INTO point_transactions (user_id, restaurant_id, type, points, description)
                SELECT id, ${session.restaurantId}::uuid, 'redeem', ${-cost}::int, ${`Canje: ${reward[0].name}`}::text FROM spent
            ), red AS (
                INSERT INTO redemptions (user_id, reward_id, points_spent, restaurant_id)
                SELECT id, ${rewardId}::uuid, ${cost}::int, ${session.restaurantId}::uuid FROM spent
            )
            SELECT count(*)::int AS n FROM spent
        `;
        if (done[0].n === 0) {
            return NextResponse.json({ error: 'No tienes suficientes puntos' }, { status: 400 });
        }

        // Copy vertical-aware: el restaurante conserva su wording exacto ("al mesero");
        // el retail recibe uno apropiado (mostrar en caja). Default 'restaurant'.
        const { businessType } = await getTenantConfig(session.restaurantId);
        const message = businessType === 'retail'
            ? `¡Canjeaste "${reward[0].name}"! Muéstralo en caja para usarlo.`
            : `¡Canjeaste "${reward[0].name}"! Muestra esto al mesero.`;

        return NextResponse.json({ success: true, message });
    } catch (error: any) {
        console.error('Redeem error:', error);
        return NextResponse.json({ error: 'Error al canjear' }, { status: 500 });
    }
}
