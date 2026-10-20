import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/shared/lib/db';
import { createToken, setSessionCookie } from '@/shared/lib/auth';
import { starterKitQueries } from '@/shared/lib/tenant-starter';

const schema = z.object({
    restaurantName: z.string().trim().min(2, 'Nombre del restaurante requerido'),
    ownerName: z.string().trim().min(2, 'Tu nombre es requerido'),
    phone: z.string().trim().min(9, 'Teléfono inválido'),
    email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
    password: z.string().min(4, 'Mínimo 4 caracteres'),
    city: z.string().trim().optional(),
    country: z.enum(['PE', 'MX', 'CO', 'ES', 'AR', 'CL']).default('PE'),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const { restaurantName, ownerName, phone, email, password, city, country } = parsed.data;

        // Generar slug
        let slug = restaurantName
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        // Verificar slug único
        const existingSlug = await db`SELECT id FROM restaurants WHERE slug = ${slug}`;
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now().toString(36)}`;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const normalizedPhone = phone.replace(/\D/g, '');
        const referralCode = ownerName.substring(0, 3).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
        const restId = crypto.randomUUID();
        const userId = crypto.randomUUID();

        // Restaurante + dueño + kit de inicio (mesas y recompensas) en UNA transacción: si algo
        // falla no queda un restaurante a medias (antes cada reintento dejaba uno huérfano).
        // El dueño puede tener ya cuenta en otra tienda con el mismo teléfono.
        await db.transaction([
            db`
                INSERT INTO restaurants (id, name, slug, city, country, email, phone)
                VALUES (${restId}, ${restaurantName}, ${slug}, ${city || null}, ${country}, ${email || null}, ${phone})
            `,
            db`
                INSERT INTO users (id, name, phone, email, password_hash, role, restaurant_id, referral_code)
                VALUES (${userId}, ${ownerName}, ${normalizedPhone}, ${email || null}, ${passwordHash}, 'admin', ${restId}, ${referralCode})
            `,
            ...starterKitQueries(restId, 'restaurant'),
        ]);

        const token = await createToken({
            userId,
            name: ownerName,
            phone: normalizedPhone,
            role: 'admin',
            vipLevel: 'bronce',
            restaurantId: restId,
            restaurantSlug: slug,
        });

        await setSessionCookie(token);

        return NextResponse.json({
            success: true,
            restaurant: { id: restId, slug, name: restaurantName },
            user: { id: userId, name: ownerName },
        }, { status: 201 });
    } catch (error) {
        console.error('Create restaurant error:', error);
        // No se devuelve el error de la BD al navegador.
        const pg = error as { code?: string; constraint?: string };
        if (pg.code === '23505' && pg.constraint === 'restaurants_slug_key') {
            return NextResponse.json({ error: 'Ya existe un restaurante con ese nombre. Prueba con otro.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'No se pudo crear el restaurante. Inténtalo de nuevo.' }, { status: 500 });
    }
}

// GET: lista restaurantes públicos (para landing)
export async function GET() {
    try {
        const restaurants = await db`
            SELECT slug, name, description, logo_url, city, country
            FROM restaurants WHERE is_active = true
            ORDER BY created_at DESC LIMIT 50
        `;
        return NextResponse.json({ data: restaurants });
    } catch {
        return NextResponse.json({ data: [] });
    }
}
