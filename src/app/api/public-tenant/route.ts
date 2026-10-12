import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';

// Lookup público mínimo por slug: qué vertical es el tenant (restaurant | retail)
// para que la página pública (`/r/[slug]`) sepa qué interfaz renderizar antes de
// pedir el catálogo real. Sin sesión, solo tenants activos.
export async function GET(req: Request) {
    const slug = new URL(req.url).searchParams.get('slug');
    if (!slug) return NextResponse.json({ error: 'Falta slug' }, { status: 400 });

    const rows = await db`
        SELECT id, name, slug, description, logo_url, phone, city, business_type
        FROM restaurants WHERE slug = ${slug} AND is_active = true LIMIT 1
    `;
    if (rows.length === 0) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const { business_type, ...restaurant } = rows[0];
    return NextResponse.json({ restaurant, businessType: business_type || 'restaurant' });
}
