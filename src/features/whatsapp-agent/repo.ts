import 'server-only';
import { db } from '@/shared/lib/db';
import type { ChatTurn } from './llm';
import { nextLeadStatus, type LeadStatus } from './utils';

export type { LeadStatus };

export type LeadSource = 'organic' | 'outbound_cold' | 'ads';

export interface Lead {
    id: string;
    wa_phone_e164: string;
    profile_name: string | null;
    business_type: 'restaurant' | 'retail' | null;
    country: string | null;
    source: LeadSource;
    status: LeadStatus;
}

export interface OutreachContact {
    id: string;
    business_name: string | null;
    city: string | null;
    country: string | null;
    status: 'pending' | 'sent' | 'responded' | 'not_interested' | 'bounced';
}

export async function findLead(phone: string): Promise<Lead | null> {
    const rows = await db`
        SELECT id, wa_phone_e164, profile_name, business_type, country, source, status
        FROM mv_leads WHERE wa_phone_e164 = ${phone} LIMIT 1`;
    return (rows[0] as Lead | undefined) ?? null;
}

export async function createLead(input: {
    phone: string; profileName?: string | null; country: string | null;
    source: LeadSource; outreachContactId?: string | null;
}): Promise<Lead> {
    // ON CONFLICT: dos webhooks casi simultáneos del mismo número nuevo.
    const rows = await db`
        INSERT INTO mv_leads (wa_phone_e164, profile_name, country, source, outreach_contact_id, last_message_at)
        VALUES (${input.phone}, ${input.profileName ?? null}, ${input.country}, ${input.source},
                ${input.outreachContactId ?? null}, now())
        ON CONFLICT (wa_phone_e164) DO UPDATE SET last_message_at = now()
        RETURNING id, wa_phone_e164, profile_name, business_type, country, source, status`;
    return rows[0] as Lead;
}

/** Guarda el mensaje entrante. false = ya existía (reintento de Meta). */
export async function insertInbound(leadId: string, waMessageId: string, type: string, content: string): Promise<boolean> {
    const rows = await db`
        INSERT INTO mv_messages (lead_id, direction, wa_message_id, message_type, content)
        VALUES (${leadId}, 'inbound', ${waMessageId}, ${type}, ${content})
        ON CONFLICT (wa_message_id) DO NOTHING
        RETURNING id`;
    return rows.length > 0;
}

export async function insertOutbound(leadId: string, content: string, opts: {
    waMessageId: string | null; model: string | null; type?: string;
}): Promise<void> {
    await db`
        INSERT INTO mv_messages (lead_id, direction, wa_message_id, message_type, content, model)
        VALUES (${leadId}, 'outbound', ${opts.waMessageId}, ${opts.type ?? 'text'}, ${content}, ${opts.model})`;
}

/** Últimos mensajes de texto del lead, en orden cronológico. */
export async function recentHistory(leadId: string, limit = 20): Promise<ChatTurn[]> {
    const rows = await db`
        SELECT direction, content FROM (
            SELECT direction, content, created_at FROM mv_messages
            WHERE lead_id = ${leadId} AND message_type IN ('text', 'fallback')
            ORDER BY created_at DESC LIMIT ${limit}
        ) t ORDER BY created_at ASC`;
    return rows.map((r) => ({
        role: r.direction === 'inbound' ? 'user' : 'assistant',
        content: r.content as string,
    }));
}

export async function updateLead(lead: Lead, patch: {
    businessType?: 'restaurant' | 'retail' | null; country?: string | null; status?: LeadStatus;
}): Promise<void> {
    const businessType = patch.businessType ?? lead.business_type;
    const country = patch.country ?? lead.country;
    const status = patch.status ? nextLeadStatus(lead.status, patch.status) : lead.status;
    await db`
        UPDATE mv_leads SET business_type = ${businessType}, country = ${country}, status = ${status},
               last_message_at = now(), updated_at = now()
        WHERE id = ${lead.id}`;
}

export async function findOutreachContact(phone: string): Promise<OutreachContact | null> {
    const rows = await db`
        SELECT id, business_name, city, country, status
        FROM mv_outreach_contacts WHERE wa_phone_e164 = ${phone} LIMIT 1`;
    return (rows[0] as OutreachContact | undefined) ?? null;
}

export async function markOutreach(id: string, status: 'responded' | 'not_interested', setRespondedAt: boolean): Promise<void> {
    await db`
        UPDATE mv_outreach_contacts
        SET status = ${status}, updated_at = now(),
            responded_at = CASE WHEN ${setRespondedAt} THEN COALESCE(responded_at, now()) ELSE responded_at END
        WHERE id = ${id}`;
}
