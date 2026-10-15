import 'server-only';
import Stripe from 'stripe';

// Cliente Stripe diferido (no instancia sin clave, para no romper el build).
let cached: Stripe | null = null;
export function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY no configurada');
    if (!cached) cached = new Stripe(key);
    return cached;
}

// La lógica pura (regiones, lookup_keys, lista blanca, estados) vive en
// `billing.ts` para poder testearla y usarla desde el cliente.
export {
    planLookupKey,
    VALID_LOOKUP_KEYS,
    isMyvipersLookupKey,
    regionForCountry,
    type Region,
    type Billing,
} from './billing';
