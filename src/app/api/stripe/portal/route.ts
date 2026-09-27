import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';
import { getStripe } from '@/shared/lib/stripe';
import { NextResponse } from 'next/server';

// Billing Portal de Stripe: el dueño cambia tarjeta, descarga facturas o cancela
// su suscripción sin pasar por soporte. Requiere que el tenant ya tenga customer.
export async function POST(request: Request) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let stripe;
    try {
        stripe = getStripe();
    } catch {
        return NextResponse.json({ error: 'Pagos no configurados. Contacta soporte.' }, { status: 503 });
    }

    const rows = await db`
        SELECT stripe_customer_id FROM restaurants WHERE id = ${session.restaurantId} LIMIT 1
    `;
    const customerId = rows[0]?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
        return NextResponse.json({ error: 'Tu negocio aún no tiene una suscripción.' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/admin?tab=config`,
    });

    return NextResponse.json({ url: portal.url });
}
