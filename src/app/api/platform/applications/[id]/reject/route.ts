import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requirePlatformAdmin } from '@/shared/lib/platform';

// Rechazar una solicitud pendiente (con nota opcional). No crea nada.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requirePlatformAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 500) : null;

    const upd = await db`
        UPDATE tenant_applications
        SET status = 'rejected', review_notes = ${notes}, reviewed_by = ${session.userId}, reviewed_at = now()
        WHERE id = ${id} AND status = 'pending'
        RETURNING id
    `;
    if (upd.length === 0) return NextResponse.json({ error: 'No se pudo rechazar (¿ya procesada?)' }, { status: 409 });
    return NextResponse.json({ success: true });
}
