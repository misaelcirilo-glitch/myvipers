import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { sendPushToRestaurant } from '@/shared/lib/push-server';

export async function POST(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { promotionId } = await req.json();
    if (!promotionId) return NextResponse.json({ error: 'promotionId requerido' }, { status: 400 });

    const rows = await db`
        SELECT id, title, description
        FROM promotions
        WHERE id = ${promotionId} AND restaurant_id = ${session.restaurantId}
        LIMIT 1
    ` as Array<{ id: string; title: string; description: string | null }>;

    if (rows.length === 0) return NextResponse.json({ error: 'Promoción no encontrada' }, { status: 404 });

    const p = rows[0];
    const result = await sendPushToRestaurant(session.restaurantId, {
        title: p.title,
        body: p.description || '¡Aprovecha esta promoción!',
        url: '/puntos',
        tag: `promo-${p.id}`,
    });

    if (result.skipped) {
        return NextResponse.json({
            error: 'Web Push no configurado. Define VAPID_PRIVATE_KEY y NEXT_PUBLIC_VAPID_PUBLIC_KEY.',
        }, { status: 503 });
    }

    return NextResponse.json({ success: true, sent: result.sent, failed: result.failed });
}
