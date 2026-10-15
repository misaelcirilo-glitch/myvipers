import 'server-only';
import type { Region } from '@/shared/lib/billing';
import { sendAgentHandoffEmail } from '@/shared/lib/email';
import { getPlanPrices, type PlanPrices } from '@/shared/lib/pricing';
import { callAgentModel, fallbackReply, type AgentReply } from './llm';
import type { InboundMessage } from './meta';
import { sendWhatsAppText } from './meta';
import { buildSystemPrompt } from './prompt';
import * as repo from './repo';
import { classifyTemplateButton, COLD_DECLINE_REPLY, countryFromPhone } from './utils';

const UNSUPPORTED_REPLY = 'Por ahora solo puedo leer mensajes de texto. ¿Me lo escribes, por favor?';

export type ProcessResult =
    | { kind: 'duplicate' }
    | { kind: 'replied'; model: string }
    | { kind: 'send_failed'; error: string };

// ─── Precios (caché en memoria de la instancia, 10 min) ───────────────
type AllPrices = Partial<Record<Region, PlanPrices>>;
let priceCache: { at: number; value: AllPrices | null } | null = null;

async function getAllPrices(): Promise<AllPrices | null> {
    if (priceCache && Date.now() - priceCache.at < 10 * 60_000) return priceCache.value;
    let value: AllPrices | null = null;
    if (process.env.STRIPE_SECRET_KEY) {
        try {
            const regions: Region[] = ['eur', 'latam', 'pen'];
            const list = await Promise.all(regions.map((r) => getPlanPrices(r)));
            value = Object.fromEntries(regions.map((r, i) => [r, list[i]]));
        } catch (e) {
            console.error('[wa-agent] no se pudieron leer precios de Stripe', e);
        }
    }
    priceCache = { at: Date.now(), value };
    return value;
}

// ─── Envío + registro ─────────────────────────────────────────────────
async function sendAndStore(lead: repo.Lead, text: string, model: string | null, type = 'text'): Promise<ProcessResult> {
    try {
        const waMessageId = await sendWhatsAppText(lead.wa_phone_e164, text);
        await repo.insertOutbound(lead.id, text, { waMessageId, model, type });
        return { kind: 'replied', model: model ?? type };
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[wa-agent] envío a Meta falló', { lead: lead.id, error });
        // Se guarda igualmente para poder reenviarlo a mano.
        await repo.insertOutbound(lead.id, text, { waMessageId: null, model, type: 'send_failed' });
        return { kind: 'send_failed', error };
    }
}

async function generateReply(lead: repo.Lead, coldOpening: repo.OutreachContact | null): Promise<AgentReply> {
    const [history, prices] = await Promise.all([repo.recentHistory(lead.id), getAllPrices()]);
    const system = buildSystemPrompt({
        lead: {
            profileName: lead.profile_name,
            businessType: lead.business_type,
            country: lead.country,
            source: lead.source,
        },
        prices,
        coldOutreach: coldOpening ? { businessName: coldOpening.business_name, city: coldOpening.city } : null,
    });
    try {
        return await callAgentModel(system, history);
    } catch (e) {
        console.error('[wa-agent] modelo no disponible, respuesta de reserva', e instanceof Error ? e.message : e);
        return fallbackReply(lead.business_type);
    }
}

// ─── Pipeline ─────────────────────────────────────────────────────────
export async function processInbound(msg: InboundMessage): Promise<ProcessResult> {
    const existing = await repo.findLead(msg.phone);
    const contact = await repo.findOutreachContact(msg.phone);
    const button = classifyTemplateButton(msg.buttonReply);

    // Contacto en frío: el número está registrado y se le envió la plantilla.
    const isDecline = !!contact && button === 'decline' && (contact.status === 'sent' || contact.status === 'responded');
    const isColdOpening = !!contact && !existing && contact.status === 'sent';
    const isCold = !!contact && (contact.status === 'sent' || contact.status === 'responded' || contact.status === 'not_interested');

    const lead = existing ?? await repo.createLead({
        phone: msg.phone,
        profileName: msg.profileName,
        country: contact?.country ?? countryFromPhone(msg.phone),
        source: isCold ? 'outbound_cold' : 'organic',
        outreachContactId: contact?.id ?? null,
    });

    // message_type: 'text' (también botones) o el tipo de media no soportado (image, audio…).
    const inserted = await repo.insertInbound(lead.id, msg.messageId, msg.type === 'text' ? 'text' : msg.content, msg.content);
    if (!inserted) return { kind: 'duplicate' };

    if (isDecline) {
        await repo.markOutreach(contact!.id, 'not_interested', true);
        await repo.updateLead(lead, { status: 'not_interested' });
        return sendAndStore(lead, COLD_DECLINE_REPLY, null, 'text');
    }

    if (msg.type === 'unsupported') {
        await repo.updateLead(lead, {});
        return sendAndStore(lead, UNSUPPORTED_REPLY, null, 'unsupported_reply');
    }

    const reply = await generateReply(lead, isColdOpening ? contact : null);
    await repo.updateLead(lead, {
        businessType: reply.businessType,
        country: reply.country,
        status: reply.status,
    });
    if (isColdOpening) await repo.markOutreach(contact!.id, 'responded', true);

    if (reply.wantsHuman) {
        const r = await sendAgentHandoffEmail({ phone: lead.wa_phone_e164, profileName: lead.profile_name, lastMessage: msg.content });
        if (!r.ok && !r.skipped) console.error('[wa-agent] aviso a Misael falló', r.error);
    }

    return sendAndStore(lead, reply.reply, reply.model, reply.model === 'fallback' ? 'fallback' : 'text');
}
