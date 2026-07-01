import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';

// GET: promociones activas y vigentes. Por slug (público) o por sesión del cliente.
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    let restaurantId: string | null = null;

    if (slug) {
        const r = await db`SELECT id FROM restaurants WHERE slug = ${slug} AND is_active = true LIMIT 1`;
        if (r.length === 0) return NextResponse.json({ promotions: [] });
        restaurantId = r[0].id;
    } else {
        const session = await getSession();
        if (session?.restaurantId) restaurantId = session.restaurantId;
    }

    if (!restaurantId) return NextResponse.json({ promotions: [] });

    const promotions = await db`
        SELECT id, title, description, image_url, discount_type, discount_value,
               min_points, valid_from, valid_until
        FROM promotions
        WHERE restaurant_id = ${restaurantId}
          AND is_active = true
          AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
        ORDER BY created_at DESC
    `;

    return NextResponse.json({ promotions });
}
