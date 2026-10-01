import 'server-only';
import { planLookupKey, type Billing, type Region } from './billing';
import { getStripe } from './stripe';

export type PriceInfo = { amount: number; currency: string } | null;
export type PlanPrices = Record<Billing, PriceInfo>;

// Precios REALES de Stripe para una región (no se hardcodean importes).
// Misma regla que el checkout: PEN sin precio → tarifa LATAM.
// Lanza si no hay STRIPE_SECRET_KEY; el caller decide el fallback.
export async function getPlanPrices(region: Region): Promise<PlanPrices> {
    const stripe = getStripe();
    const prices: PlanPrices = { mensual: null, anual: null };
    for (const billing of ['mensual', 'anual'] as const) {
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
    return prices;
}
