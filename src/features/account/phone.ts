import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';

// La cuenta global se identifica por el número COMPLETO con prefijo (E.164, +51934879292).
// Los teléfonos de `users` están guardados sin prefijo (9 cifras), y Perú y España usan
// ambos 9 cifras: comparar solo las últimas cifras uniría a dos personas de dos países.

const digits = (s: string) => s.replace(/\D/g, '');

/** Devuelve el número en E.164 si es un teléfono válido escrito con prefijo; si no, null. */
export function normalizeE164(input: string): string | null {
    const compact = input.replace(/[\s().-]/g, '');
    if (!/^\+[1-9][0-9]{7,14}$/.test(compact)) return null;
    const parsed = parsePhoneNumberFromString(compact);
    return parsed && parsed.isValid() ? parsed.number : null;
}

/**
 * ¿El número verificado es el de esta fila? La fila guarda el número nacional (lo normal)
 * o el número completo. Se usa para la fila de la sesión: el cliente elige el prefijo.
 */
export function rowPhoneMatchesE164(rowPhone: string, e164: string): boolean {
    const row = digits(rowPhone);
    if (row.length < 7) return false;
    const parsed = parsePhoneNumberFromString(e164);
    if (!parsed) return false;
    return row === parsed.nationalNumber || row === digits(e164);
}

/** País (ISO de 2 letras) → prefijo telefónico, para comparar números completos en SQL. */
export function callingCodeTable(): { countries: string[]; codes: string[] } {
    const countries = getCountries() as string[];
    return { countries, codes: countries.map((c) => getCountryCallingCode(c as Parameters<typeof getCountryCallingCode>[0])) };
}
