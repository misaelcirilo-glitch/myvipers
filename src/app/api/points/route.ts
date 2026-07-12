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

        const user = await db`SELECT available_points FROM users WHERE id = ${session.userId}`;
        if (user[0].available_points < reward[0].points_cost) {
            return NextResponse.json({ error: 'No tienes suficientes puntos' }, { status: 400 });
        }

        // Deduct points
        await db`UPDATE users SET available_points = available_points - ${reward[0].points_cost} WHERE id = ${session.userId}`;

        // Log transaction
        await db`INSERT INTO point_transactions (user_id, restaurant_id, type, points, description) VALUES (${session.userId}, ${session.restaurantId}, 'redeem', ${-reward[0].points_cost}, ${`Canje: ${reward[0].name}`})`;

        // Create redemption
        await db`INSERT INTO redemptions (user_id, reward_id, points_spent, restaurant_id) VALUES (${session.userId}, ${rewardId}, ${reward[0].points_cost}, ${session.restaurantId})`;

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
