import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Retail — variantes (talla/color/SKU/precio/stock) por producto. Aislado por
// tenant. Gestión solo admin. Zod v4 (error.issues).

const optionalText = z.string().trim().optional().nullable();

const createSchema = z.object({
    product_id: z.string().uuid('Producto inválido'),
    size: optionalText,
    color: optionalText,
    sku: optionalText,
    price: z.number().nonnegative('Precio inválido').optional().nullable(),
    stock: z.number().int().min(0, 'Stock inválido').default(0),
    low_stock_threshold: z.number().int().min(0).default(3),
});

const updateSchema = z.object({
    id: z.string().uuid('ID inválido'),
    size: optionalText,
    color: optionalText,
    sku: optionalText,
    price: z.number().nonnegative('Precio inválido').optional().nullable(),
    low_stock_threshold: z.number().int().min(0).default(3),
});

const deleteSchema = z.object({ id: z.string().uuid('ID inválido') });

async function requireAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

export async function GET(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const productId = new URL(req.url).searchParams.get('product_id');
    const variants = productId
        ? await db`
            SELECT id, product_id, size, color, sku, price, stock, low_stock_threshold, is_active, created_at
            FROM retail_variants
            WHERE restaurant_id = ${session.restaurantId} AND is_active = true AND product_id = ${productId}
            ORDER BY created_at ASC`
        : await db`
            SELECT id, product_id, size, color, sku, price, stock, low_stock_threshold, is_active, created_at
            FROM retail_variants
            WHERE restaurant_id = ${session.restaurantId} AND is_active = true
            ORDER BY created_at ASC`;

    return NextResponse.json({ variants });
}

export async function POST(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { product_id, size, color, sku, price, stock, low_stock_threshold } = parsed.data;

    // El producto debe pertenecer al tenant (FK + scope de seguridad).
    const owner = await db`
        SELECT 1 FROM retail_products
        WHERE id = ${product_id} AND restaurant_id = ${session.restaurantId} AND is_active = true
        LIMIT 1
    `;
    if (owner.length === 0) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    try {
        const rows = await db`
            INSERT INTO retail_variants (restaurant_id, product_id, size, color, sku, price, stock, low_stock_threshold)
            VALUES (${session.restaurantId}, ${product_id}, ${size || null}, ${color || null}, ${sku || null}, ${price ?? null}, ${stock}, ${low_stock_threshold})
            RETURNING id, product_id, size, color, sku, price, stock, low_stock_threshold, is_active, created_at
        `;
        return NextResponse.json({ variant: rows[0] });
    } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('uq_retail_variant_sku')) {
            return NextResponse.json({ error: 'SKU ya existe en este catálogo' }, { status: 400 });
        }
        throw e;
    }
}

async function handleUpdate(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { id, size, color, sku, price, low_stock_threshold } = parsed.data;

    // El stock NO se edita aquí: se mueve vía /stock (auditado). Aquí solo atributos.
    try {
        const rows = await db`
            UPDATE retail_variants
            SET size = ${size || null}, color = ${color || null}, sku = ${sku || null},
                price = ${price ?? null}, low_stock_threshold = ${low_stock_threshold}
            WHERE id = ${id} AND restaurant_id = ${session.restaurantId}
            RETURNING id, product_id, size, color, sku, price, stock, low_stock_threshold, is_active, created_at
        `;
        if (rows.length === 0) return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 });
        return NextResponse.json({ variant: rows[0] });
    } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('uq_retail_variant_sku')) {
            return NextResponse.json({ error: 'SKU ya existe en este catálogo' }, { status: 400 });
        }
        throw e;
    }
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

    const rows = await db`
        UPDATE retail_variants
        SET is_active = false
        WHERE id = ${parsed.data.id} AND restaurant_id = ${session.restaurantId}
        RETURNING id
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true });
}
