import { isValidPhoneNumber } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';

/**
 * Validación de teléfono multi-país (multivertical, Fase 2 — fix). Antes se
 * exigía `.min(9)` sin más, asumiendo implícitamente el formato de España/Perú
 * (9 dígitos); un tenant de otro país con otro largo de número quedaba
 * bloqueado sin mensaje claro.
 *
 * Si el tenant tiene `country` configurado, se intenta validar contra el
 * formato real de ese país (libphonenumber-js, ya dependencia del proyecto).
 * Si no hay país, o el número no calza con el país pero sí es un teléfono
 * razonable, se acepta con el fallback permisivo (7-15 dígitos) — mejor
 * aceptar un número válido de más que rechazar uno legítimo.
 */
export function isValidTenantPhone(phone: string, country?: string | null): boolean {
    const digits = phone.replace(/\D/g, '');
    const fallback = digits.length >= 7 && digits.length <= 15;
    if (!country) return fallback;

    try {
        if (isValidPhoneNumber(phone, country as CountryCode)) return true;
    } catch {
        // Código de país no reconocido por la librería → cae al fallback.
    }
    return fallback;
}
