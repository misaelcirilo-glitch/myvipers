import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Retail — categorías jerárquicas (PRP-myvipers-002, Fase 1). Aislado por tenant
// (restaurant_id de la sesión). Gestión solo admin. Zod v4 (error.issues).

const createSchema = z.object({
    name: z.string().trim().min(1, 'Nombre requerido'),
    parent_id: z.string().uuid('Categoría padre inválida').optional().nullable(),
    sort_order: z.number().int().optional().default(0),
});

const updateSchema = z.object({
    id: z.string().uuid('ID inválido'),
    name: z.string().trim().min(1, 'Nombre requerido'),
    parent_id: z.string().uuid('Categoría padre inválida').optional().nullable(),
    sort_order: z.number().int().optional().default(0),
});

const deleteSchema = z.object({ id: z.string().uuid('ID inválido') });

async function requireAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

export async function GET() {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const categories = await db`
        SELECT id, name, parent_id, sort_order
        FROM retail_categories
        WHERE restaurant_id = ${session.restaurantId} AND is_active = true
        ORDER BY sort_order ASC, name ASC
    `;
    return NextResponse.json({ categories });
}

// La categoría padre (si viene) debe existir y pertenecer al tenant.
async function parentBelongsToTenant(parentId: string | null | undefined, restaurantId: string) {
    if (!parentId) return true;
    const rows = await db`
        SELECT 1 FROM retail_categories
        WHERE id = ${parentId} AND restaurant_id = ${restaurantId} AND is_active = true
        LIMIT 1
    `;
    return rows.length > 0;
}

export async function POST(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, parent_id, sort_order } = parsed.data;

    if (!(await parentBelongsToTenant(parent_id, session.restaurantId))) {
        return NextResponse.json({ error: 'Categoría padre no encontrada' }, { status: 400 });
    }

    const rows = await db`
        INSERT INTO retail_categories (restaurant_id, name, parent_id, sort_order)
        VALUES (${session.restaurantId}, ${name}, ${parent_id || null}, ${sort_order})
        RETURNING id, name, parent_id, sort_order
    `;
    return NextResponse.json({ category: rows[0] });
}

async function handleUpdate(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, name, parent_id, sort_order } = parsed.data;

    if (parent_id === id) {
        return NextResponse.json({ error: 'Una categoría no puede ser su propia padre' }, { status: 400 });
    }
    if (!(await parentBelongsToTenant(parent_id, session.restaurantId))) {
        return NextResponse.json({ error: 'Categoría padre no encontrada' }, { status: 400 });
    }

    const rows = await db`
        UPDATE retail_categories
        SET name = ${name}, parent_id = ${parent_id || null}, sort_order = ${sort_order}
        WHERE id = ${id} AND restaurant_id = ${session.restaurantId}
        RETURNING id, name, parent_id, sort_order
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    return NextResponse.json({ category: rows[0] });
}

export const PUT = handleUpdate;
export const PATCH = handleUpdate;

export async function DELETE(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Bloquea si tiene subcategorías activas (evita borrar una rama por accidente).
    const children = await db`
        SELECT 1 FROM retail_categories
        WHERE parent_id = ${parsed.data.id} AND restaurant_id = ${session.restaurantId} AND is_active = true
        LIMIT 1
    `;
    if (children.length > 0) {
        return NextResponse.json({ error: 'Elimina primero las subcategorías' }, { status: 400 });
    }

    // Hard-delete: la FK en retail_products es ON DELETE SET NULL → los productos
    // de esta categoría quedan sin categoría, no se borran.
    const rows = await db`
        DELETE FROM retail_categories
        WHERE id = ${parsed.data.id} AND restaurant_id = ${session.restaurantId}
        RETURNING id
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
