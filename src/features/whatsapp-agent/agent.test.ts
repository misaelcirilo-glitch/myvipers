import { createHmac } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { fallbackReply, normalizeHistory, parseAgentReply } from './llm';
import { extractInboundMessage, verifyMetaSignature, WebhookPayloadSchema } from './meta';
import { buildSystemPrompt, SIGNUP_RESTAURANT_URL, SIGNUP_RETAIL_URL } from './prompt';
import { classifyTemplateButton, countryFromPhone, nextLeadStatus } from './utils';

function payload(message: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return WebhookPayloadSchema.parse({
        object: 'whatsapp_business_account',
        entry: [{
            id: 'waba',
            changes: [{
                field: 'messages',
                value: {
                    messaging_product: 'whatsapp',
                    contacts: [{ profile: { name: 'Rosa' }, wa_id: '51999123456' }],
                    messages: [{ from: '51999123456', id: 'wamid.1', timestamp: '1', ...message }],
                    ...extra,
                },
            }],
        }],
    });
}

describe('verifyMetaSignature', () => {
    const body = '{"a":1}';
    const sig = 'sha256=' + createHmac('sha256', 's3cret').update(body, 'utf8').digest('hex');
    test('firma correcta', () => expect(verifyMetaSignature(body, sig, 's3cret')).toBe(true));
    test('secreto distinto', () => expect(verifyMetaSignature(body, sig, 'otro')).toBe(false));
    test('body alterado', () => expect(verifyMetaSignature('{"a":2}', sig, 's3cret')).toBe(false));
    test('sin cabecera o prefijo raro', () => {
        expect(verifyMetaSignature(body, null, 's3cret')).toBe(false);
        expect(verifyMetaSignature(body, 'md5=abc', 's3cret')).toBe(false);
    });
});

describe('extractInboundMessage', () => {
    test('texto → E.164 con + y nombre de perfil', () => {
        const m = extractInboundMessage(payload({ type: 'text', text: { body: 'Hola' } }));
        expect(m).toMatchObject({ phone: '+51999123456', profileName: 'Rosa', type: 'text', content: 'Hola' });
    });
    test('botón de plantilla → texto con buttonReply', () => {
        const m = extractInboundMessage(payload({ type: 'button', button: { text: 'Ahora no, gracias', payload: 'NO' } }));
        expect(m).toMatchObject({ type: 'text', content: 'Ahora no, gracias', buttonReply: { text: 'Ahora no, gracias', payload: 'NO' } });
    });
    test('audio → unsupported con el tipo', () => {
        expect(extractInboundMessage(payload({ type: 'audio' }))).toMatchObject({ type: 'unsupported', content: 'audio' });
    });
    test('status update → null', () => {
        const p = WebhookPayloadSchema.parse({
            object: 'whatsapp_business_account',
            entry: [{ id: 'w', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', statuses: [{}] } }] }],
        });
        expect(extractInboundMessage(p)).toBeNull();
    });
});

describe('parseAgentReply', () => {
    test('JSON válido', () => {
        const r = parseAgentReply('{"reply":"¿Es restaurante o tienda?","business_type":null,"country":"pe","status":"qualifying","wants_human":false}', 'm');
        expect(r).toMatchObject({ reply: '¿Es restaurante o tienda?', businessType: null, country: 'PE', status: 'qualifying', wantsHuman: false });
    });
    test('JSON rodeado de texto', () => {
        const r = parseAgentReply('Aquí va:\n{"reply":"Hola","status":"qualifying"}\nfin', 'm');
        expect(r.reply).toBe('Hola');
    });
    test('el enlace de alta en el mensaje fuerza directed_to_signup', () => {
        const r = parseAgentReply(JSON.stringify({ reply: `Créalo aquí: ${SIGNUP_RESTAURANT_URL}`, status: 'qualifying' }), 'm');
        expect(r.status).toBe('directed_to_signup');
    });
    test('not_interested se respeta aunque haya enlace', () => {
        const r = parseAgentReply(JSON.stringify({ reply: `Vale, por si acaso: ${SIGNUP_RETAIL_URL}`, status: 'not_interested' }), 'm');
        expect(r.status).toBe('not_interested');
    });
    test('texto plano → se usa como mensaje', () => {
        expect(parseAgentReply('Hola, ¿qué tal?', 'm')).toMatchObject({ reply: 'Hola, ¿qué tal?', status: 'qualifying' });
    });
    test('campo secundario inválido → se descarta, el mensaje se conserva', () => {
        const r = parseAgentReply('{"reply":"x","business_type":"bar","country":"Perú","wants_human":"si"}', 'm');
        expect(r).toMatchObject({ reply: 'x', businessType: null, country: null, wantsHuman: false });
    });
});

describe('fallbackReply', () => {
    test('restaurante → enlace de alta inmediata', () => expect(fallbackReply('restaurant').reply).toContain(SIGNUP_RESTAURANT_URL));
    test('tienda → registrar-negocio', () => expect(fallbackReply('retail').reply).toContain(SIGNUP_RETAIL_URL));
    test('desconocido → ambos enlaces', () => {
        const r = fallbackReply(null).reply;
        expect(r).toContain(SIGNUP_RESTAURANT_URL);
        expect(r).toContain(SIGNUP_RETAIL_URL);
    });
});

describe('normalizeHistory', () => {
    test('fusiona turnos seguidos y quita assistant inicial', () => {
        expect(normalizeHistory([
            { role: 'assistant', content: 'a' },
            { role: 'user', content: 'u1' },
            { role: 'user', content: 'u2' },
            { role: 'assistant', content: 'b' },
        ])).toEqual([{ role: 'user', content: 'u1\nu2' }, { role: 'assistant', content: 'b' }]);
    });
});

describe('classifyTemplateButton', () => {
    test.each([
        ['Ahora no, gracias', 'decline'],
        ['No me interesa', 'decline'],
        ['Sí, cuéntame', 'interested'],
        ['Me interesa', 'interested'],
        ['Siempre abierto', null],
    ])('%s → %s', (text, expected) => {
        expect(classifyTemplateButton({ text })).toBe(expected);
    });
    test('sin botón → null', () => expect(classifyTemplateButton(undefined)).toBeNull());
});

describe('countryFromPhone', () => {
    test.each([
        ['+51999123456', 'PE'],
        ['+34678080701', 'ES'],
        ['+5215512345678', 'MX'],
        ['+123', null],
    ])('%s → %s', (phone, country) => expect(countryFromPhone(phone)).toBe(country));
});

describe('nextLeadStatus', () => {
    test('no retrocede de enlace enviado a cualificando', () => expect(nextLeadStatus('directed_to_signup', 'qualifying')).toBe('directed_to_signup'));
    test('puede pasar a no interesado', () => expect(nextLeadStatus('directed_to_signup', 'not_interested')).toBe('not_interested'));
    test('un no interesado que vuelve se re-cualifica', () => expect(nextLeadStatus('not_interested', 'qualifying')).toBe('qualifying'));
    test('dado de alta se mantiene', () => expect(nextLeadStatus('signed_up', 'directed_to_signup')).toBe('signed_up'));
});

describe('buildSystemPrompt', () => {
    const lead = { source: 'organic' as const, businessType: null, country: 'PE' };
    test('precios reales por región, con decimales solo si hacen falta', () => {
        const p = buildSystemPrompt({
            lead,
            prices: { pen: { mensual: { amount: 49, currency: 'PEN' }, anual: { amount: 490, currency: 'PEN' } }, latam: { mensual: { amount: 15.5, currency: 'USD' }, anual: null } },
        });
        expect(p).toContain('Perú: 49 PEN/mes o 490 PEN/año');
        expect(p).toContain('15.50 USD/mes');
        expect(p).not.toContain('Europa (España incluida):');
    });
    test('sin precios → prohíbe inventar cifras', () => {
        expect(buildSystemPrompt({ lead, prices: null })).toContain('No inventes cifras');
    });
    test('bloque de contacto en frío solo si aplica', () => {
        expect(buildSystemPrompt({ lead, prices: null })).not.toContain('<apertura_contacto_frio>');
        const p = buildSystemPrompt({ lead: { ...lead, source: 'outbound_cold' }, prices: null, coldOutreach: { businessName: 'Tienda Rosa', city: 'Lima' } });
        expect(p).toContain('<apertura_contacto_frio>');
        expect(p).toContain('Tienda Rosa, Lima');
    });
});
