import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/shared/lib/auth';
import { db } from '@/shared/lib/db';

export async function GET() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rows = await db`
        SELECT id, name, slug, description, logo_url, phone, city, country, currency, timezone
        FROM restaurants
        WHERE id = ${session.restaurantId}
        LIMIT 1
    `;

    if (rows.length === 0) {
        return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
}

const patchSchema = z.object({
    name: z.string().trim().min(1, 'El nombre es requerido').max(200),
    city: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(30).optional(),
    country: z.string().trim().max(10).optional(),
    currency: z.string().trim().max(10).optional(),
    timezone: z.string().trim().max(60).optional(),
});

// Datos propios del tenant (restaurants): lo que el admin edita desde el tab
// "Config". A diferencia de `config` (tabla legacy, 1 fila por clave global de
// El Machay), `restaurants` ya es multi-tenant real desde su creación.
export async function PATCH(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const { name, city, phone, country, currency, timezone } = parsed.data;

    const rows = await db`
        UPDATE restaurants
        SET name = ${name}, city = ${city || null}, phone = ${phone || null},
            country = ${country || 'PE'}, currency = ${currency || 'PEN'},
            timezone = ${timezone || 'America/Lima'}, updated_at = now()
        WHERE id = ${session.restaurantId}
        RETURNING id, name, slug, description, logo_url, phone, city, country, currency, timezone
    `;

    if (rows.length === 0) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 });
    return NextResponse.json(rows[0]);
}
