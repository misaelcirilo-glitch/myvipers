import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';

// Catálogo público de un tenant retail (lectura, sin sesión) — equivalente a
// `/api/menu` para los tenants con el módulo 'restaurant'. Solo productos y
// categorías activos; las variantes exponen talla/color y si hay stock (nunca
// el conteo exacto, eso es dato de gestión interna).
export async function GET(req: Request) {
    try {
        const slug = new URL(req.url).searchParams.get('slug');
        if (!slug) return NextResponse.json({ error: 'Falta slug' }, { status: 400 });

        const restaurant = await db`
            SELECT id, name, slug, description, logo_url, phone, city
            FROM restaurants WHERE slug = ${slug} AND is_active = true LIMIT 1
        `;
        if (restaurant.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
        const restaurantId = restaurant[0].id;

        const categories = await db`
            SELECT id, name, parent_id, sort_order FROM retail_categories
            WHERE restaurant_id = ${restaurantId} AND is_active = true ORDER BY sort_order
        `;

        const products = await db`
            SELECT p.id, p.name, p.description, p.brand, p.category_id,
                   p.base_price, p.discount_price, p.image_url, p.sort_order
            FROM retail_products p
            WHERE p.restaurant_id = ${restaurantId} AND p.is_active = true
            ORDER BY p.sort_order ASC, p.created_at DESC
        `;

        const variants = await db`
            SELECT id, product_id, size, color, stock FROM retail_variants
            WHERE restaurant_id = ${restaurantId} AND is_active = true
        `;
        const stockByProduct: Record<string, boolean> = {};
        const variantsByProduct: Record<string, { size: string | null; color: string | null }[]> = {};
        for (const v of variants) {
            const pid = v.product_id as string;
            if ((v.stock as number) > 0) stockByProduct[pid] = true;
            (variantsByProduct[pid] ||= []).push({ size: v.size as string | null, color: v.color as string | null });
        }

        const catalog = products.map((p) => ({
            ...p,
            inStock: variantsByProduct[p.id] ? !!stockByProduct[p.id] : true, // sin variantes = producto simple, se asume disponible
            variants: variantsByProduct[p.id] || [],
        }));

        return NextResponse.json({ restaurant: restaurant[0], categories, products: catalog });
    } catch (error) {
        console.error('Retail catalog error:', error);
        return NextResponse.json({ error: 'Error al cargar el catálogo' }, { status: 500 });
    }
}
