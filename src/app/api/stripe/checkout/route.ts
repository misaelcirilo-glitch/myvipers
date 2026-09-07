import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { getStripe, planLookupKey } from '@/shared/lib/stripe';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Checkout de suscripción a la plataforma MyVipers. El dueño (admin) del tenant
// suscribe su negocio. Precio ÚNICO para todos los verticales; varía por región y
// periodo → se resuelve por lookup_key (NO por price ID). Patrón: crear/reutilizar
// customer en el tenant (restaurants) y abrir checkout.sessions (mode subscription).

const schema = z.object({
    // TODO(seguridad): la región llega del cliente. Con tarifas distintas por región
    // (49 € / $15 / S/ 49) cualquiera puede pedir la más barata. Derivarla en servidor
    // desde el tenant (país/moneda del negocio) en lugar de confiar en el body.
    region: z.enum(['eur', 'latam', 'pen']),
    billing: z.enum(['mensual', 'anual']),
});

export async function POST(request: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const lookupKey = planLookupKey(parsed.data.billing, parsed.data.region);

    let stripe;
    try {
        stripe = getStripe();
    } catch {
        return NextResponse.json({ error: 'Pagos no configurados. Contacta soporte.' }, { status: 503 });
    }

    // Resolver el precio por lookup_key (los precios ya existen en el panel de Stripe).
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) {
        return NextResponse.json({ error: `No se encontró el precio ${lookupKey} en Stripe` }, { status: 400 });
    }

    // Tenant (restaurants) — customer de Stripe se guarda aquí.
    const rows = await db`
        SELECT id, name, email, stripe_customer_id
        FROM restaurants WHERE id = ${session.restaurantId} LIMIT 1
    `;
    const tenant = rows[0];
    if (!tenant) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    // Crear o reutilizar el customer de Stripe del tenant.
    let customerId = tenant.stripe_customer_id as string | null;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: (tenant.email as string) || undefined,
            name: (tenant.name as string) || undefined,
            metadata: { restaurant_id: session.restaurantId },
        });
        customerId = customer.id;
        await db`UPDATE restaurants SET stripe_customer_id = ${customerId} WHERE id = ${session.restaurantId}`;
    }

    // Base URL: el origen de la petición (funciona en myvipers.es), con fallback a env.
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    const checkout = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        client_reference_id: session.restaurantId,
        subscription_data: {
            metadata: { restaurant_id: session.restaurantId, plan_lookup_key: lookupKey },
        },
        success_url: `${origin}/admin?checkout=ok`,
        cancel_url: `${origin}/admin?checkout=cancel`,
    });

    if (!checkout.url) {
        return NextResponse.json({ error: 'No se pudo crear la sesión de pago' }, { status: 500 });
    }
    return NextResponse.json({ url: checkout.url });
}
