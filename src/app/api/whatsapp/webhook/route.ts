import { NextResponse, type NextRequest } from 'next/server';
import { extractInboundMessage, getMetaConfig, verifyMetaSignature, WebhookPayloadSchema } from '@/features/whatsapp-agent/meta';
import { processInbound } from '@/features/whatsapp-agent/process-inbound';

// Webhook del agente de ventas de MyVipers por WhatsApp (PRP-myvipers-005).
// App de Meta y número propios; nada compartido con el agente de Verioska.
// Sin las env MV_WA_* (p. ej. en el-machay) responde 503 y no hace nada.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET: verificación inicial de Meta (hub.challenge).
export async function GET(req: NextRequest) {
    const { verifyToken } = getMetaConfig();
    if (!verifyToken) return new NextResponse('Webhook no configurado', { status: 503 });

    const url = new URL(req.url);
    if (url.searchParams.get('hub.mode') === 'subscribe'
        && url.searchParams.get('hub.verify_token') === verifyToken
        && url.searchParams.get('hub.challenge')) {
        return new NextResponse(url.searchParams.get('hub.challenge'), { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new NextResponse('Forbidden', { status: 403 });
}

// POST: mensajes entrantes. La firma se valida sobre el body CRUDO.
export async function POST(req: NextRequest) {
    const { appSecret, phoneNumberId } = getMetaConfig();
    if (!appSecret || !phoneNumberId) return new NextResponse('Webhook no configurado', { status: 503 });

    const rawBody = await req.text();
    if (!verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256'), appSecret)) {
        return new NextResponse('Firma inválida', { status: 401 });
    }

    let json: unknown;
    try {
        json = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const parsed = WebhookPayloadSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Payload no reconocido' }, { status: 400 });

    const message = extractInboundMessage(parsed.data);
    if (!message) return NextResponse.json({ ok: true, processed: false });

    try {
        const result = await processInbound(message);
        console.info('[wa-agent] procesado', { kind: result.kind, messageId: message.messageId });
        return NextResponse.json({ ok: true, processed: true });
    } catch (e) {
        // 200 igualmente: si devolvemos error, Meta reintenta el mismo mensaje en bucle.
        console.error('[wa-agent] fallo procesando', { messageId: message.messageId, error: e instanceof Error ? e.message : e });
        return NextResponse.json({ ok: true, processed: false, error: 'internal' });
    }
}
