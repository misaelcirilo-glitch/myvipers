import { db } from '@/shared/lib/db';
import { getStripe } from '@/shared/lib/stripe';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

// Webhook de Stripe: mantiene el estado de suscripción del tenant (restaurants).
// Verifica la firma con STRIPE_WEBHOOK_SECRET y usa el cuerpo CRUDO (request.text()).
export const runtime = 'nodejs';

export async function POST(request: Request) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });

    let stripe;
    try {
        stripe = getStripe();
    } catch {
        return NextResponse.json({ error: 'Pagos no configurados' }, { status: 503 });
    }

    const sig = request.headers.get('stripe-signature');
    if (!sig) return NextResponse.json({ error: 'Falta firma' }, { status: 400 });

    const body = await request.text();
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, sig, secret);
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'firma inválida';
        return NextResponse.json({ error: `Firma inválida: ${msg}` }, { status: 400 });
    }

    async function syncSubscription(sub: Stripe.Subscription) {
        const restaurantId = sub.metadata?.restaurant_id || null;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const lookupKey = sub.items.data[0]?.price?.lookup_key || null;
        // current_period_end vive en la suscripción o (API nuevas) en el item.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cpe = (sub as any).current_period_end ?? (sub.items.data[0] as any)?.current_period_end ?? null;
        const periodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

        // Localiza el tenant por metadata (fiable) o, si falta, por el customer.
        if (restaurantId) {
            await db`
                UPDATE restaurants SET
                    stripe_subscription_id = ${sub.id},
                    subscription_status = ${sub.status},
                    plan_lookup_key = ${lookupKey},
                    subscription_current_period_end = ${periodEnd},
                    stripe_customer_id = COALESCE(stripe_customer_id, ${customerId})
                WHERE id = ${restaurantId}
            `;
        } else {
            await db`
                UPDATE restaurants SET
                    stripe_subscription_id = ${sub.id},
                    subscription_status = ${sub.status},
                    plan_lookup_key = ${lookupKey},
                    subscription_current_period_end = ${periodEnd}
                WHERE stripe_customer_id = ${customerId}
            `;
        }
    }

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                await syncSubscription(event.data.object as Stripe.Subscription);
                break;
            default:
                break; // otros eventos se ignoran silenciosamente
        }
    } catch (e) {
        console.error('Stripe webhook handler error:', e);
        return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
