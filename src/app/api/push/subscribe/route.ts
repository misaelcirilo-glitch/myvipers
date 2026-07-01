import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { z } from 'zod';

const schema = z.object({
    endpoint: z.string().url(),
    p256dh: z.string().min(1),
    auth: z.string().min(1),
    userAgent: z.string().optional(),
});

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { endpoint, p256dh, auth, userAgent } = parsed.data;

    await db`
        INSERT INTO push_subscriptions (user_id, restaurant_id, endpoint, p256dh, auth, user_agent)
        VALUES (${session.userId}, ${session.restaurantId}, ${endpoint}, ${p256dh}, ${auth}, ${userAgent || null})
        ON CONFLICT (endpoint) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            restaurant_id = EXCLUDED.restaurant_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent,
            last_used_at = NOW()
    `;

    return NextResponse.json({ success: true });
}
