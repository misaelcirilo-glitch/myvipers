import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { hasLiveSubscription, isTrialEligible, TRIAL_DAYS } from '@/shared/lib/billing';
import { getStripe, planLookupKey, regionForCountry } from '@/shared/lib/stripe';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Checkout de suscripción a la plataforma MyVipers. El dueño (admin) del tenant
// suscribe su negocio. Precio ÚNICO para todos los verticales; varía por región y
// periodo → se resuelve por lookup_key (NO por price ID). Patrón: crear/reutilizar
// customer en el tenant (restaurants) y abrir checkout.sessions (mode subscription).
//
// La REGIÓN se decide aquí, en servidor, a partir del país del negocio: con
// tarifas distintas (49 € / $15 / S/) no se puede confiar en lo que mande el
// cliente. El cliente solo elige el periodo.

const schema = z.object({
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

    let stripe;
    try {
        stripe = getStripe();
    } catch {
        return NextResponse.json({ error: 'Pagos no configurados. Contacta soporte.' }, { status: 503 });
    }

    // Tenant (restaurants) — customer de Stripe se guarda aquí.
    const rows = await db`
        SELECT id, name, email, country, stripe_customer_id, stripe_subscription_id, subscription_status
        FROM restaurants WHERE id = ${session.restaurantId} LIMIT 1
    `;
    const tenant = rows[0];
    if (!tenant) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    // Ya suscrito: cambiar de plan / tarjeta / cancelar va por el portal, no por
    // un segundo checkout (evita dos suscripciones cobrando a la vez).
    if (hasLiveSubscription(tenant.subscription_status as string | null)) {
        return NextResponse.json(
            { error: 'Tu negocio ya tiene una suscripción activa. Gestiónala desde "Gestionar suscripción".' },
            { status: 409 },
        );
    }

    // Resolver el precio por lookup_key. Si la región PEN no tiene precio en
    // Stripe, se cobra la tarifa LATAM (USD) en vez de fallar.
    const region = regionForCountry(tenant.country as string | null);
    const candidates = [planLookupKey(parsed.data.billing, region)];
    if (region === 'pen') candidates.push(planLookupKey(parsed.data.billing, 'latam'));

    let price = null;
    let lookupKey = candidates[0];
    for (const key of candidates) {
        const prices = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
        if (prices.data[0]) {
            price = prices.data[0];
            lookupKey = key;
            break;
        }
    }
    if (!price) {
        return NextResponse.json({ error: `No se encontró el precio ${candidates[0]} en Stripe` }, { status: 400 });
    }

    // Crear o reutilizar el customer de Stripe del tenant.
    let customerId = tenant.stripe_customer_id as string | null;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: (tenant.email as string) || undefined,
            name: (tenant.name as string) || undefined,
            metadata: { restaurant_id: session.restaurantId, product: 'myvipers' },
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
        metadata: { restaurant_id: session.restaurantId, plan_lookup_key: lookupKey, product: 'myvipers' },
        subscription_data: {
            metadata: { restaurant_id: session.restaurantId, plan_lookup_key: lookupKey, product: 'myvipers' },
            // 30 días gratis solo en la primera suscripción del negocio. Se pide la
            // tarjeta igualmente: al acabar la prueba se cobra sin más pasos.
            ...(isTrialEligible(tenant.stripe_subscription_id as string | null) ? { trial_period_days: TRIAL_DAYS } : {}),
        },
        success_url: `${origin}/admin?checkout=ok`,
        cancel_url: `${origin}/admin?checkout=cancel`,
        // La cuenta Stripe es compartida con Verioska: sin esto la cabecera del
        // pago muestra "VERIOSKA". Recibos y extracto siguen usando el nombre de la cuenta.
        branding_settings: {
            display_name: 'MyVipers',
            icon: { type: 'url', url: `${origin}/icon-512.png` },
        },
    });

    if (!checkout.url) {
        return NextResponse.json({ error: 'No se pudo crear la sesión de pago' }, { status: 500 });
    }
    return NextResponse.json({ url: checkout.url });
}
