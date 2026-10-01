import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// WhatsApp Cloud API (Meta) para el agente de ventas de MyVipers.
// Portado del agente de Verioska. App de Meta y número PROPIOS de MyVipers:
// el phone_number_id sale SIEMPRE de la env, nunca de un argumento, para que
// este código no pueda enviar desde el número de Verioska.

export const META_API_VERSION = 'v25.0';

export function getMetaConfig() {
    return {
        verifyToken: process.env.MV_WA_VERIFY_TOKEN,
        appSecret: process.env.MV_WA_APP_SECRET,
        phoneNumberId: process.env.MV_WA_PHONE_NUMBER_ID,
        accessToken: process.env.MV_WA_ACCESS_TOKEN,
    };
}

// ─── Firma HMAC ───────────────────────────────────────────────────────
// Se calcula sobre los bytes EXACTOS del body: nunca re-stringificar el JSON.
export function verifyMetaSignature(rawBody: string, header: string | null, secret: string): boolean {
    if (!header || !header.startsWith('sha256=')) return false;
    const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const a = Buffer.from(header, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Payload ──────────────────────────────────────────────────────────
// Schema tolerante: Meta añade tipos y campos sin aviso.
const MessageSchema = z.object({
    from: z.string(),
    id: z.string(),
    type: z.string(),
    text: z.object({ body: z.string() }).optional(),
    button: z.object({ text: z.string().optional(), payload: z.string().optional() }).passthrough().optional(),
    interactive: z.object({
        button_reply: z.object({ id: z.string().optional(), title: z.string().optional() }).passthrough().optional(),
    }).passthrough().optional(),
}).passthrough();

const ValueSchema = z.object({
    messaging_product: z.literal('whatsapp'),
    contacts: z.array(z.object({ profile: z.object({ name: z.string() }).partial().optional(), wa_id: z.string() }).passthrough()).optional(),
    messages: z.array(MessageSchema).optional(),
    statuses: z.array(z.unknown()).optional(),
}).passthrough();

export const WebhookPayloadSchema = z.object({
    object: z.literal('whatsapp_business_account'),
    entry: z.array(z.object({
        id: z.string(),
        changes: z.array(z.object({ field: z.string(), value: ValueSchema }).passthrough()),
    }).passthrough()),
}).passthrough();

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export type InboundMessage = {
    phone: string;              // E.164 con '+'
    profileName?: string;
    messageId: string;
    /** 'text' también para botones (su rótulo es lo que "dijo" el lead). */
    type: 'text' | 'unsupported';
    content: string;            // texto, o el tipo de media si unsupported
    buttonReply?: { text: string; payload?: string };
};

// Primer mensaje del primer change (Meta envía uno por webhook en la práctica).
// Status updates (entregado/leído) → null.
export function extractInboundMessage(payload: WebhookPayload): InboundMessage | null {
    const change = payload.entry[0]?.changes[0];
    if (!change || change.field !== 'messages') return null;
    const value = change.value;
    const message = value.messages?.[0];
    if (!message) return null;

    const base = {
        phone: message.from.startsWith('+') ? message.from : `+${message.from}`,
        profileName: value.contacts?.[0]?.profile?.name,
        messageId: message.id,
    };

    if (message.type === 'text' && message.text?.body) {
        return { ...base, type: 'text', content: message.text.body };
    }
    const button = extractButtonReply(message);
    if (button) return { ...base, type: 'text', content: button.text, buttonReply: button };
    return { ...base, type: 'unsupported', content: message.type };
}

function extractButtonReply(message: z.infer<typeof MessageSchema>): { text: string; payload?: string } | null {
    if (message.type === 'button' && message.button) {
        const text = message.button.text ?? message.button.payload;
        if (text) return { text, payload: message.button.payload };
    }
    const reply = message.interactive?.button_reply;
    if (message.type === 'interactive' && reply) {
        const text = reply.title ?? reply.id;
        if (text) return { text, payload: reply.id };
    }
    return null;
}

// ─── Envío ────────────────────────────────────────────────────────────
export async function sendWhatsAppText(to: string, body: string): Promise<string> {
    const { phoneNumberId, accessToken } = getMetaConfig();
    if (!phoneNumberId || !accessToken) throw new Error('MV_WA_PHONE_NUMBER_ID / MV_WA_ACCESS_TOKEN no configuradas');

    const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            // preview_url: el enlace de alta se ve con su tarjeta de vista previa.
            text: { preview_url: true, body },
        }),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!res.ok || !data.messages?.[0]?.id) {
        throw new Error(`Meta API ${res.status}: ${data.error?.message ?? 'sin messageId'} (code ${data.error?.code ?? '-'})`);
    }
    return data.messages[0].id;
}
