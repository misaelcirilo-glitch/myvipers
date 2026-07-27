import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Retail — catálogo de productos (PRP-myvipers-001, Fase 3). Aislado por tenant
// (restaurant_id de la sesión). Gestión solo admin. Zod v4 (error.issues).

const createSchema = z.object({
    name: z.string().trim().min(1, 'Nombre requerido'),
    description: z.string().trim().optional().nullable(),
    category: z.string().trim().optional().nullable(),           // texto libre legacy (PRP-001)
    category_id: z.string().uuid('Categoría inválida').optional().nullable(),
    base_price: z.number().nonnegative('Precio inválido').default(0),
    image_url: z.string().trim().optional().nullable(),
    sort_order: z.number().int().optional().default(0),
});

const updateSchema = z.object({
    id: z.string().uuid('ID inválido'),
    name: z.string().trim().min(1, 'Nombre requerido'),
    description: z.string().trim().optional().nullable(),
    category: z.string().trim().optional().nullable(),
    category_id: z.string().uuid('Categoría inválida').optional().nullable(),
    base_price: z.number().nonnegative('Precio inválido'),
    image_url: z.string().trim().optional().nullable(),
    sort_order: z.number().int().optional().default(0),
});

const deleteSchema = z.object({ id: z.string().uuid('ID inválido') });

async function requireAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

// La categoría asignada debe existir y ser del mismo tenant (evita fuga cross-tenant).
async function categoryBelongsToTenant(categoryId: string, restaurantId: string) {
    const rows = await db`
        SELECT 1 FROM retail_categories
        WHERE id = ${categoryId} AND restaurant_id = ${restaurantId} AND is_active = true
        LIMIT 1
    `;
    return rows.length > 0;
}

export async function GET() {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const products = await db`
        SELECT p.id, p.name, p.description, p.category, p.category_id, c.name AS category_name,
               p.base_price, p.image_url, p.sort_order, p.is_active, p.created_at
        FROM retail_products p
        LEFT JOIN retail_categories c ON c.id = p.category_id AND c.restaurant_id = p.restaurant_id
        WHERE p.restaurant_id = ${session.restaurantId} AND p.is_active = true
        ORDER BY p.sort_order ASC, p.created_at DESC
    `;
    const variants = await db`
        SELECT id, product_id, size, color, sku, price, stock, low_stock_threshold, is_active, created_at
        FROM retail_variants
        WHERE restaurant_id = ${session.restaurantId} AND is_active = true
        ORDER BY created_at ASC
    `;

    const byProduct: Record<string, unknown[]> = {};
    for (const v of variants) {
        (byProduct[v.product_id as string] ||= []).push(v);
    }
    const result = products.map(p => ({ ...p, variants: byProduct[p.id as string] || [] }));

    return NextResponse.json({ products: result });
}

export async function POST(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { name, description, category, category_id, base_price, image_url, sort_order } = parsed.data;

    // La categoría (si viene) debe pertenecer al tenant.
    if (category_id && !(await categoryBelongsToTenant(category_id, session.restaurantId))) {
        return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 400 });
    }

    const rows = await db`
        INSERT INTO retail_products (restaurant_id, name, description, category, category_id, base_price, image_url, sort_order)
        VALUES (${session.restaurantId}, ${name}, ${description || null}, ${category || null}, ${category_id || null}, ${base_price}, ${image_url || null}, ${sort_order})
        RETURNING id, name, description, category, category_id, base_price, image_url, sort_order, is_active, created_at
    `;
    return NextResponse.json({ product: { ...rows[0], variants: [] } });
}

async function handleUpdate(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, name, description, category, category_id, base_price, image_url, sort_order } = parsed.data;

    if (category_id && !(await categoryBelongsToTenant(category_id, session.restaurantId))) {
        return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 400 });
    }

    const rows = await db`
        UPDATE retail_products
        SET name = ${name}, description = ${description || null}, category = ${category || null},
            category_id = ${category_id || null},
            base_price = ${base_price}, image_url = ${image_url || null}, sort_order = ${sort_order},
            updated_at = now()
        WHERE id = ${id} AND restaurant_id = ${session.restaurantId}
        RETURNING id, name, description, category, category_id, base_price, image_url, sort_order, is_active, created_at
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    return NextResponse.json({ product: rows[0] });
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

    // Soft-delete: el producto y sus variantes dejan de listarse, se conserva el histórico.
    const rows = await db`
        UPDATE retail_products
        SET is_active = false, updated_at = now()
        WHERE id = ${parsed.data.id} AND restaurant_id = ${session.restaurantId}
        RETURNING id
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
