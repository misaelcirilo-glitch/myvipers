import { db } from '@/shared/lib/db';
import {
    isMyvipersLookupKey,
    subscriptionIdFromCheckoutSession,
    subscriptionIdFromInvoice,
} from '@/shared/lib/billing';
import { getStripe } from '@/shared/lib/stripe';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

// Webhook de Stripe de MyVipers: mantiene el estado de suscripción del tenant
// (restaurants). Es un endpoint PROPIO registrado aparte en Stripe; el endpoint
// de Verioska Dental Cloud (Edge Function de Supabase) no se toca.
//
// La cuenta de Stripe es COMPARTIDA con Dental Cloud, así que cualquier
// suscripción cuyo precio no sea de MyVipers (lista blanca de lookup_keys) se
// ignora ANTES de tocar la BD.
//
// Siempre se sincroniza desde el estado ACTUAL de la suscripción en Stripe (no
// desde el payload del evento): los eventos pueden llegar desordenados o
// repetidos, y así el resultado es idempotente.
//
// Verifica la firma con el cuerpo CRUDO (request.text()).
export const runtime = 'nodejs';

const HANDLED = new Set([
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
]);

export async function POST(request: Request) {
    // Nombre propio recomendado en el PRP; se acepta el genérico por compatibilidad.
    const secret = process.env.STRIPE_WEBHOOK_SECRET_MYVIPERS || process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: 'Webhook no configurado' }, { status: 503 });

    let stripe: Stripe;
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

    if (!HANDLED.has(event.type)) return NextResponse.json({ received: true, ignored: event.type });

    // 1. ¿Qué suscripción toca este evento?
    const obj = event.data.object as unknown;
    let subscriptionId: string | null = null;
    if (event.type === 'checkout.session.completed') {
        subscriptionId = subscriptionIdFromCheckoutSession(obj);
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
        subscriptionId = subscriptionIdFromInvoice(obj);
    } else {
        subscriptionId = (obj as { id?: string }).id ?? null;
    }
    if (!subscriptionId) {
        return NextResponse.json({ received: true, ignored: 'sin suscripción' });
    }

    try {
        // 2. Estado actual en Stripe (fuente de verdad).
        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        // 3. Lista blanca: solo precios de MyVipers.
        const lookupKey = sub.items.data[0]?.price?.lookup_key ?? null;
        if (!isMyvipersLookupKey(lookupKey)) {
            return NextResponse.json({ received: true, ignored: 'precio ajeno a MyVipers' });
        }

        await syncSubscription(sub, lookupKey as string);
    } catch (e) {
        console.error('[stripe-webhook] error procesando', event.type, e);
        return NextResponse.json({ error: 'Error procesando el evento' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}

async function syncSubscription(sub: Stripe.Subscription, lookupKey: string) {
    const restaurantId = sub.metadata?.restaurant_id || null;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    // current_period_end vive en la suscripción o (API nuevas) en el item.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cpe = (sub as any).current_period_end ?? (sub.items.data[0] as any)?.current_period_end ?? null;
    const periodEnd = cpe ? new Date(cpe * 1000).toISOString() : null;

    // Localiza el tenant por metadata (fiable) o, si falta, por el customer.
    const updated = restaurantId
        ? await db`
            UPDATE restaurants SET
                stripe_subscription_id = ${sub.id},
                subscription_status = ${sub.status},
                plan_lookup_key = ${lookupKey},
                subscription_current_period_end = ${periodEnd},
                stripe_customer_id = COALESCE(stripe_customer_id, ${customerId})
            WHERE id = ${restaurantId}
            RETURNING id
        `
        : await db`
            UPDATE restaurants SET
                stripe_subscription_id = ${sub.id},
                subscription_status = ${sub.status},
                plan_lookup_key = ${lookupKey},
                subscription_current_period_end = ${periodEnd}
            WHERE stripe_customer_id = ${customerId}
            RETURNING id
        `;

    if (updated.length === 0) {
        console.warn('[stripe-webhook] suscripción de MyVipers sin tenant', {
            subscription: sub.id,
            customer: customerId,
            restaurant_id: restaurantId,
        });
    }
}
