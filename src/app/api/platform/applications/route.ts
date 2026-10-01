import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requirePlatformAdmin } from '@/shared/lib/platform';

// Lista de solicitudes de alta (solo admin de plataforma). Nunca devuelve el hash.
export async function GET(req: Request) {
    const session = await requirePlatformAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || 'pending';
    if (!['pending', 'approved', 'rejected'].includes(status)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const data = await db`
        SELECT id, business_name, slug, business_type, admin_name, admin_phone, admin_email,
               country, notes, status, review_notes, created_tenant_id, created_at, reviewed_at
        FROM tenant_applications
        WHERE status = ${status}
        ORDER BY created_at DESC
    `;
    return NextResponse.json({ data });
}
