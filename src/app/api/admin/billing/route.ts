import { NextResponse } from 'next/server';
import { getSession } from '@/shared/lib/auth';
import { db } from '@/shared/lib/db';
import { billingStateFromStatus, isTrialEligible, regionForCountry, TRIAL_DAYS } from '@/shared/lib/billing';
import { getPlanPrices, type PlanPrices } from '@/shared/lib/pricing';

// Estado de facturación del negocio para el panel del dueño, con los precios
// REALES de Stripe para su región (no se hardcodean importes en la app).
export async function GET() {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const rows = await db`
        SELECT country, subscription_status, plan_lookup_key,
               subscription_current_period_end, stripe_customer_id, stripe_subscription_id
        FROM restaurants WHERE id = ${session.restaurantId} LIMIT 1
    `;
    const r = rows[0];
    if (!r) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    const region = regionForCountry(r.country as string | null);
    let prices: PlanPrices = { mensual: null, anual: null };
    const paymentsEnabled = !!process.env.STRIPE_SECRET_KEY;

    if (paymentsEnabled) {
        try {
            prices = await getPlanPrices(region);
        } catch (e) {
            // Stripe caído: el panel muestra el estado sin precios.
            console.error('[admin/billing] no se pudieron leer precios', e);
        }
    }

    return NextResponse.json({
        state: billingStateFromStatus(r.subscription_status as string | null),
        planLookupKey: (r.plan_lookup_key as string | null) ?? null,
        currentPeriodEnd: r.subscription_current_period_end ?? null,
        region,
        hasCustomer: !!r.stripe_customer_id,
        paymentsEnabled,
        prices,
        // Días de prueba que tendría al suscribirse ahora (0 si ya la disfrutó).
        trialDays: isTrialEligible(r.stripe_subscription_id as string | null) ? TRIAL_DAYS : 0,
    });
}
