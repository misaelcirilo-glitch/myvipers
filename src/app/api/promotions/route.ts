import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';

// GET: promociones activas y vigentes para el cliente autenticado
export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const promotions = await db`
        SELECT id, title, description, image_url, discount_type, discount_value, min_points, valid_from, valid_until
        FROM promotions
        WHERE restaurant_id = ${session.restaurantId}
          AND is_active = true
          AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
        ORDER BY created_at DESC
    `;

    return NextResponse.json({ promotions });
}
