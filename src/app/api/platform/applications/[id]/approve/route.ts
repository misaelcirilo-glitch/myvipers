import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { requirePlatformAdmin } from '@/shared/lib/platform';
import { isValidVertical, modulesForVertical } from '@/shared/lib/verticals';

// Aprobar una solicitud: crea el tenant (restaurants) con los módulos del preset del
// vertical + su usuario admin (reusando el hash del solicitante) y marca la solicitud
// aprobada. Idempotente: si ya está aprobada, no duplica.

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await requirePlatformAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { id } = await params;
    const rows = await db`SELECT * FROM tenant_applications WHERE id = ${id} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    const app = rows[0];

    if (app.status === 'approved' && app.created_tenant_id) {
        return NextResponse.json({ success: true, alreadyApproved: true, slug: app.slug, loginUrl: `/r/${app.slug}/login` });
    }
    if (app.status === 'rejected') {
        return NextResponse.json({ error: 'La solicitud fue rechazada' }, { status: 409 });
    }
    if (!isValidVertical(app.business_type)) {
        return NextResponse.json({ error: 'Tipo de negocio no válido' }, { status: 400 });
    }

    // Slug debe seguir libre.
    const taken = await db`SELECT 1 FROM restaurants WHERE slug = ${app.slug} LIMIT 1`;
    if (taken.length > 0) return NextResponse.json({ error: 'El identificador ya está ocupado' }, { status: 409 });

    const modules = modulesForVertical(app.business_type);

    // Crear tenant.
    const rest = await db`
        INSERT INTO restaurants (name, slug, business_type, enabled_modules)
        VALUES (${app.business_name}, ${app.slug}, ${app.business_type}, ${JSON.stringify(modules)}::jsonb)
        RETURNING id
    `;
    const restaurantId = rest[0].id;

    // Crear usuario admin del tenant (reusa el hash de la solicitud).
    await db`
        INSERT INTO users (name, phone, email, password_hash, role, restaurant_id)
        VALUES (${app.admin_name}, ${app.admin_phone}, ${app.admin_email || null}, ${app.admin_password_hash}, 'admin', ${restaurantId})
    `;

    // Marcar aprobada.
    await db`
        UPDATE tenant_applications
        SET status = 'approved', reviewed_by = ${session.userId}, reviewed_at = now(), created_tenant_id = ${restaurantId}
        WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, slug: app.slug, loginUrl: `/r/${app.slug}/login` });
}
