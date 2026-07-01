import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';

export async function POST(req: Request) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: 'endpoint requerido' }, { status: 400 });

    await db`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${session.userId}`;
    return NextResponse.json({ success: true });
}
