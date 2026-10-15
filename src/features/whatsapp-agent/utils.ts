import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

// País ISO-2 del lead a partir de su número E.164 (+51… → PE). null si no se sabe.
export function countryFromPhone(phoneE164: string): string | null {
    const parsed = parsePhoneNumberFromString(phoneE164);
    return parsed?.country ?? null;
}

function normalizeText(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Botón pulsado en la plantilla de contacto en frío. Se mira el payload y el
// rótulo porque la plantilla de MyVipers aún no está fijada: se aceptan los
// rótulos habituales de "sí" y "no".
export function classifyTemplateButton(
    button: { text: string; payload?: string } | undefined,
): 'interested' | 'decline' | null {
    if (!button) return null;
    for (const raw of [button.payload, button.text]) {
        if (!raw) continue;
        const t = normalizeText(raw);
        if (/^(ahora no|no me interesa|no gracias)\b/.test(t)) return 'decline';
        if (/^(si|me interesa|cuentame|quiero|mas info)\b/.test(t)) return 'interested';
    }
    return null;
}

export const COLD_DECLINE_REPLY =
    '¡Entendido, gracias por responder! No te molestamos más. Si algún día quieres probar MyVipers, escríbenos por aquí. ¡Un saludo!';

export type LeadStatus = 'qualifying' | 'directed_to_signup' | 'signed_up' | 'not_interested';

// El estado nunca retrocede de "enlace enviado"/"dado de alta" a "cualificando".
export function nextLeadStatus(current: LeadStatus, proposed: LeadStatus): LeadStatus {
    if (proposed === 'qualifying' && (current === 'directed_to_signup' || current === 'signed_up')) return current;
    if (current === 'signed_up' && proposed !== 'not_interested') return current;
    return proposed;
}
