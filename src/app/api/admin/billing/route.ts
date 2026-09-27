import { NextResponse } from 'next/server';
import { getSession } from '@/shared/lib/auth';
import { db } from '@/shared/lib/db';
import { billingStateFromStatus, planLookupKey, regionForCountry, type Billing } from '@/shared/lib/billing';
import { getStripe } from '@/shared/lib/stripe';

type PriceInfo = { amount: number; currency: string } | null;

// Estado de facturación del negocio para el panel del dueño, con los precios
// REALES de Stripe para su región (no se hardcodean importes en la app).
export async function GET() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rows = await db`
        SELECT country, subscription_status, plan_lookup_key,
               subscription_current_period_end, stripe_customer_id
        FROM restaurants WHERE id = ${session.restaurantId} LIMIT 1
    `;
    const r = rows[0];
    if (!r) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    const region = regionForCountry(r.country as string | null);
    const prices: Record<Billing, PriceInfo> = { mensual: null, anual: null };
    let paymentsEnabled = false;

    try {
        const stripe = getStripe();
        paymentsEnabled = true;
        for (const billing of ['mensual', 'anual'] as const) {
            // Misma regla que el checkout: PEN sin precio → tarifa LATAM.
            const keys = [planLookupKey(billing, region)];
            if (region === 'pen') keys.push(planLookupKey(billing, 'latam'));
            for (const key of keys) {
                const list = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
                const p = list.data[0];
                if (p && p.unit_amount != null) {
                    prices[billing] = { amount: p.unit_amount / 100, currency: p.currency.toUpperCase() };
                    break;
                }
            }
        }
    } catch (e) {
        // Sin clave o Stripe caído: el panel muestra el estado sin precios.
        if (paymentsEnabled) console.error('[admin/billing] no se pudieron leer precios', e);
    }

    return NextResponse.json({
        state: billingStateFromStatus(r.subscription_status as string | null),
        planLookupKey: (r.plan_lookup_key as string | null) ?? null,
        currentPeriodEnd: r.subscription_current_period_end ?? null,
        region,
        hasCustomer: !!r.stripe_customer_id,
        paymentsEnabled,
        prices,
    });
}
