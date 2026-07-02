'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { es } from './translations/es';
import { en } from './translations/en';
import { pt } from './translations/pt';
import type { Locale, CurrencyConfig } from './types';
import { getCurrencyConfig } from './types';
import type { Translations } from './translations/es';

const translations: Record<Locale, Translations> = { es, en, pt };

interface I18nContextValue {
    locale: Locale;
    setLocale: (l: Locale) => void;
    t: Translations;
    currencyCode: string;
    currencyConfig: CurrencyConfig;
    formatPrice: (price: number) => string;
    formatDate: (date: string) => string;
}

export const I18nContext = createContext<I18nContextValue>(null!);

export function useI18nProvider(baseCurrency?: string) {
    const [locale, setLocaleState] = useState<Locale>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('myvipers-locale') as Locale) || 'es';
        }
        return 'es';
    });

    const currencyCode = baseCurrency || 'PEN';
    const currencyConfig = getCurrencyConfig(currencyCode);

    const setLocale = useCallback((l: Locale) => {
        setLocaleState(l);
        localStorage.setItem('myvipers-locale', l);
        document.documentElement.lang = l;
    }, []);

    const formatPrice = useCallback((price: number) => {
        // La API devuelve montos numéricos como string (driver Postgres/Neon),
        // así que coercionamos antes de formatear para evitar `toFixed is not a
        // function`. NaN → 0 por seguridad.
        const n = Number(price);
        return `${currencyConfig.symbol}${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
    }, [currencyConfig]);

    const dateLocales: Record<Locale, string> = { es: 'es-PE', en: 'en-US', pt: 'pt-BR' };

    const formatDate = useCallback((date: string) => {
        return new Date(date + 'T00:00').toLocaleDateString(dateLocales[locale], {
            weekday: 'short', day: 'numeric', month: 'short',
        });
    }, [locale]);

    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);

    return {
        locale,
        setLocale,
        t: translations[locale],
        currencyCode,
        currencyConfig,
        formatPrice,
        formatDate,
    };
}

export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n must be used within I18nProvider');
    return ctx;
}

export { type Locale } from './types';
export { LOCALE_LABELS, LOCALE_FLAGS, COMMON_CURRENCIES, getCurrencyConfig } from './types';
