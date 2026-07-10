import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const itemSchema = z.object({
    descripcion: z.string().trim().min(1, 'Descripción requerida'),
    cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
    precio: z.number().nonnegative('Precio inválido'),
});

const bodySchema = z.object({
    items: z.array(itemSchema).min(1, 'Agrega al menos un ítem'),
    cliente_nombre: z.string().trim().optional().nullable(),
    cliente_doc: z.string().trim().optional().nullable(),
});

export async function GET() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const boletas = await db`
        SELECT id, serie, correlativo, numero, fecha, cliente_nombre, cliente_doc, items, subtotal, total, created_at
        FROM boletas
        ORDER BY created_at DESC
        LIMIT 100
    `;

    return NextResponse.json({ boletas });
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { items, cliente_nombre, cliente_doc } = parsed.data;

    // Totales calculados en el servidor (redondeo a 2 decimales).
    const subtotal = Math.round(items.reduce((acc, it) => acc + it.cantidad * it.precio, 0) * 100) / 100;
    const total = subtotal;
    const itemsJson = JSON.stringify(items);

    // Correlativo atómico vía secuencia; número formateado B001-00000001.
    const rows = await db`
        INSERT INTO boletas (serie, correlativo, numero, fecha, cliente_nombre, cliente_doc, items, subtotal, total)
        SELECT
            'B001',
            c.correlativo,
            'B001-' || LPAD(c.correlativo::text, 8, '0'),
            CURRENT_DATE,
            ${cliente_nombre || null},
            ${cliente_doc || null},
            ${itemsJson}::jsonb,
            ${subtotal},
            ${total}
        FROM (SELECT nextval('boletas_correlativo_seq') AS correlativo) c
        RETURNING id, serie, correlativo, numero, fecha, cliente_nombre, cliente_doc, items, subtotal, total, created_at
    `;

    return NextResponse.json({ boleta: rows[0] });
}
