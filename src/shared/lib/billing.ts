// Lógica pura de facturación de la plataforma MyVipers (sin dependencias de
// servidor → testeable y usable desde componentes cliente).
//
// El precio es el MISMO para todos los verticales (restaurante, retail…); solo
// varía por REGIÓN y PERIODO. Los precios ya existen en Stripe y se resuelven
// por `lookup_key` (myvipers_<periodo>_<región>).

export type Region = 'eur' | 'latam' | 'pen';
export type Billing = 'mensual' | 'anual';

export function planLookupKey(billing: Billing, region: Region): string {
    return `myvipers_${billing}_${region}`;
}

// Lista blanca: los ÚNICOS precios de MyVipers. La cuenta de Stripe es compartida
// con Verioska Dental Cloud; el webhook ignora cualquier suscripción cuyo precio
// no esté aquí, para no tocar nunca datos de otro producto.
export const VALID_LOOKUP_KEYS = [
    'myvipers_mensual_eur',
    'myvipers_anual_eur',
    'myvipers_mensual_latam',
    'myvipers_anual_latam',
    'myvipers_mensual_pen',
    'myvipers_anual_pen',
] as const;

export function isMyvipersLookupKey(key: string | null | undefined): boolean {
    return !!key && (VALID_LOOKUP_KEYS as readonly string[]).includes(key);
}

// Países que pagan en euros (UE + EEE + microestados con euro).
const EUR_COUNTRIES = new Set([
    'ES', 'PT', 'FR', 'IT', 'DE', 'AT', 'BE', 'NL', 'LU', 'IE', 'FI', 'EE', 'LV',
    'LT', 'SK', 'SI', 'GR', 'CY', 'MT', 'HR', 'AD', 'MC', 'SM', 'VA', 'PL', 'CZ',
    'HU', 'RO', 'BG', 'DK', 'SE', 'NO', 'IS', 'LI', 'CH', 'GB',
]);

/**
 * Región de cobro a partir del país del negocio. Se decide en el SERVIDOR (nunca
 * desde el cliente): con tarifas distintas por región, confiar en el cliente
 * permitiría elegir la más barata.
 *   - Perú → `pen` (soles, evita el cargo por conversión del banco del cliente).
 *   - Europa → `eur`.
 *   - Resto de LATAM y demás → `latam` (USD).
 *   - Sin país → `eur` (la tarifa completa; ante la duda no se abarata).
 */
export function regionForCountry(country: string | null | undefined): Region {
    const c = (country || '').trim().toUpperCase();
    if (!c) return 'eur';
    if (c === 'PE') return 'pen';
    if (EUR_COUNTRIES.has(c)) return 'eur';
    return 'latam';
}

// Estado de facturación mostrado al dueño. `subscription_status` guarda el
// estado nativo de Stripe; NULL = nunca se suscribió (plan gratuito).
export type BillingState = 'free' | 'trialing' | 'active' | 'past_due' | 'canceled';

export function billingStateFromStatus(status: string | null | undefined): BillingState {
    switch (status) {
        case null:
        case undefined:
        case '':
            return 'free';
        case 'trialing':
            return 'trialing';
        case 'active':
            return 'active';
        case 'past_due':
        case 'unpaid':
            return 'past_due';
        case 'incomplete':
            // Checkout empezado pero el primer pago no se completó: sigue gratis.
            return 'free';
        default:
            // canceled, incomplete_expired, paused…
            return 'canceled';
    }
}

/** ¿Tiene una suscripción viva que deba gestionarse en el portal (no re-comprarse)? */
export function hasLiveSubscription(status: string | null | undefined): boolean {
    const s = billingStateFromStatus(status);
    return s === 'active' || s === 'trialing' || s === 'past_due';
}

// ─── Extracción de IDs de eventos de Stripe (formas de API antigua y nueva) ───

function idOf(v: unknown): string | null {
    if (typeof v === 'string') return v || null;
    if (v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string') {
        return (v as { id: string }).id;
    }
    return null;
}

/**
 * Id de la suscripción de una factura. En APIs recientes de Stripe ya no está en
 * `invoice.subscription` sino en `invoice.parent.subscription_details.subscription`.
 */
export function subscriptionIdFromInvoice(invoice: unknown): string | null {
    if (!invoice || typeof invoice !== 'object') return null;
    const inv = invoice as Record<string, unknown>;
    const parent = inv.parent as Record<string, unknown> | undefined;
    const details = parent?.subscription_details as Record<string, unknown> | undefined;
    return idOf(details?.subscription) ?? idOf(inv.subscription);
}

/** Id de la suscripción de una Checkout Session (solo `mode: subscription`). */
export function subscriptionIdFromCheckoutSession(session: unknown): string | null {
    if (!session || typeof session !== 'object') return null;
    const s = session as Record<string, unknown>;
    if (s.mode !== 'subscription') return null;
    return idOf(s.subscription);
}
