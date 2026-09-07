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

// MyVipers es una plataforma multi-negocio: el precio es el MISMO para todos los
// verticales (restaurante, retail…). Solo varía por REGIÓN y PERIODO. Los precios y
// sus lookup_key ya están creados en el panel de Stripe.
// `pen` = Perú, cobrado en soles. Se factura en moneda local para evitar que el
// banco del cliente le cargue conversión sobre un importe en USD; el coste de
// conversión a EUR lo asume la cuenta igual que ya ocurría con `latam`.
export type Region = 'eur' | 'latam' | 'pen';
export type Billing = 'mensual' | 'anual';

export function planLookupKey(billing: Billing, region: Region): string {
    return `myvipers_${billing}_${region}`;
}

export const VALID_LOOKUP_KEYS = [
    'myvipers_mensual_eur',
    'myvipers_anual_eur',
    'myvipers_mensual_latam',
    'myvipers_anual_latam',
    'myvipers_mensual_pen',
    'myvipers_anual_pen',
] as const;
