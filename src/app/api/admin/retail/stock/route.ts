import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Retail — movimientos de stock. Cada movimiento actualiza retail_variants.stock
// Y registra la fila en retail_stock_movements de forma ATÓMICA en UNA sola
// sentencia CTE (el driver HTTP de Neon ejecuta una sentencia por llamada, no
// hay transacciones multi-statement). Aislado por tenant. Gestión solo admin.

const movementSchema = z.object({
    variant_id: z.string().uuid('Variante inválida'),
    type: z.enum(['entrada', 'salida', 'ajuste']),
    // Magnitud (>0) para entrada/salida; delta con signo para ajuste (!= 0).
    quantity: z.number().int('Cantidad inválida').refine(n => n !== 0, 'Cantidad no puede ser 0'),
    reason: z.string().trim().optional().nullable(),
});

async function requireAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

export async function GET(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const variantId = new URL(req.url).searchParams.get('variant_id');
    if (!variantId) return NextResponse.json({ error: 'variant_id requerido' }, { status: 400 });

    const movements = await db`
        SELECT id, variant_id, type, quantity, reason, created_by, created_at
        FROM retail_stock_movements
        WHERE restaurant_id = ${session.restaurantId} AND variant_id = ${variantId}
        ORDER BY created_at DESC
        LIMIT 100
    `;
    return NextResponse.json({ movements });
}

export async function POST(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const parsed = movementSchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const { variant_id, type, quantity, reason } = parsed.data;

    // Delta con signo según el tipo. entrada/salida requieren magnitud positiva.
    let delta: number;
    if (type === 'entrada') {
        if (quantity <= 0) return NextResponse.json({ error: 'La entrada debe ser positiva' }, { status: 400 });
        delta = quantity;
    } else if (type === 'salida') {
        if (quantity <= 0) return NextResponse.json({ error: 'La salida debe ser positiva' }, { status: 400 });
        delta = -quantity;
    } else {
        delta = quantity; // ajuste: puede ser +/-
    }

    // Atómico: el UPDATE con guard (stock + delta >= 0) impide stock negativo; si
    // no afecta filas (variante inexistente/otro tenant, o quedaría negativo) el
    // INSERT no ocurre y RETURNING viene vacío. La causa exacta se aclara luego.
    const rows = await db`
        WITH mv AS (
            UPDATE retail_variants
            SET stock = stock + ${delta}
            WHERE id = ${variant_id}
              AND restaurant_id = ${session.restaurantId}
              AND is_active = true
              AND stock + ${delta} >= 0
            RETURNING id, stock, low_stock_threshold
        ), ins AS (
            INSERT INTO retail_stock_movements (restaurant_id, variant_id, type, quantity, reason, created_by)
            SELECT ${session.restaurantId}, id, ${type}, ${delta}, ${reason || null}, ${session.userId}
            FROM mv
            RETURNING id, variant_id, type, quantity, reason, created_at
        )
        SELECT ins.id, ins.variant_id, ins.type, ins.quantity, ins.reason, ins.created_at,
               mv.stock AS new_stock, mv.low_stock_threshold
        FROM ins JOIN mv ON mv.id = ins.variant_id
    `;

    if (rows.length === 0) {
        // Distinguir "no existe" de "stock insuficiente" para un mensaje claro.
        const found = await db`
            SELECT stock FROM retail_variants
            WHERE id = ${variant_id} AND restaurant_id = ${session.restaurantId} AND is_active = true
            LIMIT 1
        `;
        if (found.length === 0) return NextResponse.json({ error: 'Variante no encontrada' }, { status: 404 });
        return NextResponse.json({ error: 'Stock insuficiente para esta salida' }, { status: 400 });
    }

    return NextResponse.json({ movement: rows[0] });
}
