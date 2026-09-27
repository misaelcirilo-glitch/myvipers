import { describe, expect, test } from 'vitest';
import {
    billingStateFromStatus,
    hasLiveSubscription,
    isMyvipersLookupKey,
    isTrialEligible,
    TRIAL_DAYS,
    planLookupKey,
    regionForCountry,
    subscriptionIdFromCheckoutSession,
    subscriptionIdFromInvoice,
} from './billing';

describe('regionForCountry — la región se decide en servidor', () => {
    test.each([
        ['PE', 'pen'],
        ['pe', 'pen'],
        ['ES', 'eur'],
        ['PT', 'eur'],
        ['CO', 'latam'],
        ['MX', 'latam'],
        ['US', 'latam'],
        [null, 'eur'],
        ['', 'eur'],
    ])('%s → %s', (country, region) => {
        expect(regionForCountry(country)).toBe(region);
    });
});

describe('lista blanca de precios (cuenta Stripe compartida con Dental Cloud)', () => {
    test('los 6 lookup_keys de MyVipers se aceptan', () => {
        for (const b of ['mensual', 'anual'] as const) {
            for (const r of ['eur', 'latam', 'pen'] as const) {
                expect(isMyvipersLookupKey(planLookupKey(b, r))).toBe(true);
            }
        }
    });

    test.each([null, undefined, '', 'verioska_premium_mensual', 'esencial', 'myvipers_semanal_eur'])(
        'rechaza %s',
        (key) => {
            expect(isMyvipersLookupKey(key)).toBe(false);
        },
    );
});

describe('billingStateFromStatus', () => {
    test.each([
        [null, 'free'],
        [undefined, 'free'],
        ['incomplete', 'free'],
        ['trialing', 'trialing'],
        ['active', 'active'],
        ['past_due', 'past_due'],
        ['unpaid', 'past_due'],
        ['canceled', 'canceled'],
        ['incomplete_expired', 'canceled'],
    ])('%s → %s', (status, state) => {
        expect(billingStateFromStatus(status)).toBe(state);
    });

    test('suscripción viva = active/trialing/past_due (no se permite un 2º checkout)', () => {
        expect(hasLiveSubscription('active')).toBe(true);
        expect(hasLiveSubscription('trialing')).toBe(true);
        expect(hasLiveSubscription('past_due')).toBe(true);
        expect(hasLiveSubscription('canceled')).toBe(false);
        expect(hasLiveSubscription(null)).toBe(false);
    });
});

describe('extracción del id de suscripción de los eventos', () => {
    test('invoice con forma de API nueva (parent.subscription_details)', () => {
        expect(
            subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: 'sub_new' } } }),
        ).toBe('sub_new');
    });

    test('invoice con forma antigua (invoice.subscription string u objeto)', () => {
        expect(subscriptionIdFromInvoice({ subscription: 'sub_old' })).toBe('sub_old');
        expect(subscriptionIdFromInvoice({ subscription: { id: 'sub_obj' } })).toBe('sub_obj');
    });

    test('invoice sin suscripción (pago suelto) → null', () => {
        expect(subscriptionIdFromInvoice({ parent: null })).toBeNull();
        expect(subscriptionIdFromInvoice(null)).toBeNull();
    });

    test('checkout session: solo mode subscription', () => {
        expect(subscriptionIdFromCheckoutSession({ mode: 'subscription', subscription: 'sub_1' })).toBe('sub_1');
        expect(subscriptionIdFromCheckoutSession({ mode: 'payment', subscription: null })).toBeNull();
    });
});

describe('prueba gratis', () => {
    test('30 días', () => expect(TRIAL_DAYS).toBe(30));
    test('primera suscripción → con prueba', () => {
        expect(isTrialEligible(null)).toBe(true);
        expect(isTrialEligible(undefined)).toBe(true);
    });
    test('ya tuvo suscripción (aunque cancelada) → sin prueba', () => expect(isTrialEligible('sub_123')).toBe(false));
});
