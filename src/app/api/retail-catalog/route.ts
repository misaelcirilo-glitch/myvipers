import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { descendantIds } from '@/shared/lib/category-tree';

// Catálogo público de un tenant retail (lectura, sin sesión) — equivalente a
// `/api/menu` para los tenants con el módulo 'restaurant'. Solo productos y
// categorías activos; las variantes exponen talla/color y si hay stock (nunca
// el conteo exacto, eso es dato de gestión interna).
//
// `categories` se devuelve siempre completa y plana (con `parent_id`): el
// cliente arma el árbol y navega (igual que ya hace el admin en RetailTab).
// `?category_id=` (opcional) filtra `products` a esa categoría + todos sus
// descendientes — útil para un deep-link directo a una categoría.
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const slug = searchParams.get('slug');
        const categoryId = searchParams.get('category_id');
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

        let catalog = products.map((p) => ({
            ...p,
            category_id: p.category_id as string | null,
            inStock: variantsByProduct[p.id] ? !!stockByProduct[p.id] : true, // sin variantes = producto simple, se asume disponible
            variants: variantsByProduct[p.id] || [],
        }));

        if (categoryId) {
            const allowed = descendantIds(categories as { id: string; name: string; parent_id: string | null }[], categoryId);
            catalog = catalog.filter((p) => p.category_id && allowed.has(p.category_id));
        }

        return NextResponse.json({ restaurant: restaurant[0], categories, products: catalog });
    } catch (error) {
        console.error('Retail catalog error:', error);
        return NextResponse.json({ error: 'Error al cargar el catálogo' }, { status: 500 });
    }
}
