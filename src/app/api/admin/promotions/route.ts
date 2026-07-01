import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { sendPushToRestaurant } from '@/shared/lib/push-server';

export async function GET() {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'waiter')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const promotions = await db`
        SELECT * FROM promotions WHERE restaurant_id = ${session.restaurantId} ORDER BY created_at DESC
    `;

    return NextResponse.json({ promotions });
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, discount_type, discount_value, min_points, valid_from, valid_until, notify } = body;

    if (!title) return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 });

    const result = await db`
        INSERT INTO promotions (restaurant_id, title, description, discount_type, discount_value, min_points, valid_from, valid_until)
        VALUES (${session.restaurantId}, ${title}, ${description || null}, ${discount_type || null}, ${discount_value || null}, ${min_points || 0}, ${valid_from || null}, ${valid_until || null})
        RETURNING *
    `;

    let push = null;
    if (notify) {
        push = await sendPushToRestaurant(session.restaurantId, {
            title,
            body: description || '¡Aprovecha esta promoción!',
            url: '/puntos',
            tag: `promo-${result[0].id}`,
        });
    }

    return NextResponse.json({ promotion: result[0], push });
}

export async function PATCH(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, is_active } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await db`UPDATE promotions SET is_active = ${is_active} WHERE id = ${id} AND restaurant_id = ${session.restaurantId}`;

    return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    await db`DELETE FROM promotions WHERE id = ${id} AND restaurant_id = ${session.restaurantId}`;

    return NextResponse.json({ success: true });
}
