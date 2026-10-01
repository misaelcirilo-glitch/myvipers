import { z } from 'zod';
import { SIGNUP_RESTAURANT_URL, SIGNUP_RETAIL_URL } from './prompt';

export const AGENT_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 25_000;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// Solo `reply` es obligatorio: un campo secundario mal formado se descarta
// (nunca debe acabar enviándose el JSON crudo al lead).
// "unknown" / "" son los valores "sin dato" del esquema estructurado (OUTPUT_SCHEMA).
const AgentReplySchema = z.object({
    reply: z.string().min(1),
    business_type: z.enum(['restaurant', 'retail']).nullable().optional().catch(null),
    country: z.string().regex(/^[A-Za-z]{2}$/).nullable().optional().catch(null),
    status: z.enum(['qualifying', 'directed_to_signup', 'not_interested']).optional().catch(undefined),
    wants_human: z.boolean().optional().catch(false),
});

// Salida estructurada impuesta por la API: sin ella, en conversaciones largas
// el modelo acababa respondiendo texto plano y el lead no se actualizaba.
const OUTPUT_SCHEMA = {
    type: 'object',
    properties: {
        reply: { type: 'string' },
        business_type: { type: 'string', enum: ['restaurant', 'retail', 'unknown'] },
        country: { type: 'string' },
        status: { type: 'string', enum: ['qualifying', 'directed_to_signup', 'not_interested'] },
        wants_human: { type: 'boolean' },
    },
    required: ['reply', 'business_type', 'country', 'status', 'wants_human'],
    additionalProperties: false,
} as const;

export type AgentReply = {
    reply: string;
    businessType: 'restaurant' | 'retail' | null;
    country: string | null;
    status: 'qualifying' | 'directed_to_signup' | 'not_interested';
    wantsHuman: boolean;
    model: string;
};

// Extrae y valida el JSON del modelo. Si el modelo respondió texto plano
// (no debería), se usa tal cual como mensaje: mejor contestar que callar.
export function parseAgentReply(raw: string, model: string): AgentReply {
    const text = raw.trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
        try {
            const parsed = AgentReplySchema.safeParse(JSON.parse(text.slice(start, end + 1)));
            if (parsed.success) {
                const d = parsed.data;
                const directed = d.reply.includes(SIGNUP_RESTAURANT_URL) || d.reply.includes(SIGNUP_RETAIL_URL);
                return {
                    reply: d.reply.trim(),
                    businessType: d.business_type ?? null,
                    country: d.country ? d.country.toUpperCase() : null,
                    // El enlace en el mensaje manda: evita que el modelo se olvide de marcarlo.
                    status: directed && d.status !== 'not_interested' ? 'directed_to_signup' : (d.status ?? 'qualifying'),
                    wantsHuman: d.wants_human ?? false,
                    model,
                };
            }
        } catch {
            // JSON inválido → cae al texto plano.
        }
    }
    return { reply: text, businessType: null, country: null, status: 'qualifying', wantsHuman: false, model };
}

// Respuesta sin IA (sin ANTHROPIC_API_KEY o si Anthropic falla): útil y honesta.
export function fallbackReply(businessType: 'restaurant' | 'retail' | null): AgentReply {
    let reply: string;
    if (businessType === 'restaurant') {
        reply = `¡Hola! Gracias por escribir a MyVipers. Puedes crear tu restaurante gratis y sin tarjeta en un minuto aquí: ${SIGNUP_RESTAURANT_URL}`;
    } else if (businessType === 'retail') {
        reply = `¡Hola! Gracias por escribir a MyVipers. Puedes registrar tu tienda gratis aquí: ${SIGNUP_RETAIL_URL} (la cuenta se activa tras una revisión rápida).`;
    } else {
        reply = `¡Hola! Gracias por escribir a MyVipers, la plataforma de puntos VIP y fidelización para negocios. Si tienes un restaurante, créalo gratis aquí: ${SIGNUP_RESTAURANT_URL}. Si tienes una tienda, regístrala aquí: ${SIGNUP_RETAIL_URL}`;
    }
    return { reply, businessType, country: null, status: 'directed_to_signup', wantsHuman: false, model: 'fallback' };
}

// Anthropic exige alternancia user/assistant empezando por user: se fusionan
// turnos seguidos del mismo rol y se descarta un assistant inicial.
export function normalizeHistory(turns: ChatTurn[]): ChatTurn[] {
    const out: ChatTurn[] = [];
    for (const t of turns) {
        const last = out[out.length - 1];
        if (last && last.role === t.role) last.content += `\n${t.content}`;
        else out.push({ ...t });
    }
    while (out.length && out[0].role === 'assistant') out.shift();
    return out;
}

export async function callAgentModel(system: string, history: ChatTurn[]): Promise<AgentReply> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
            model: AGENT_MODEL,
            max_tokens: MAX_TOKENS,
            system,
            messages: normalizeHistory(history),
            // Chat de WhatsApp: esfuerzo bajo = respuestas rápidas y sin gastar el tope en razonar.
            output_config: { effort: 'low', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
    // JSON cortado o rechazo → respuesta de reserva (nunca enviar JSON a medias).
    if (data.stop_reason === 'max_tokens' || data.stop_reason === 'refusal') {
        throw new Error(`Anthropic stop_reason=${data.stop_reason}`);
    }
    const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
    if (!text.trim()) throw new Error('Anthropic devolvió una respuesta vacía');
    return parseAgentReply(text, AGENT_MODEL);
}
