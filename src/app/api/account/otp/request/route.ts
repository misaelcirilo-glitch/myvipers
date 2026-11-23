import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountGlobalEnabled } from '@/features/account/config';
import { requestOtp } from '@/features/account/otp';
import { defaultSender } from '@/features/account/sender';
import { customerRowForPhone } from '@/features/account/session-row';
import { sendOtpCapAlertEmail } from '@/shared/lib/email';

// Pedir un código por WhatsApp para verificar el número (PRP-myvipers-006, F2).
// Detrás del interruptor ACCOUNT_GLOBAL_ENABLED: apagado, esta ruta no existe.

const schema = z.object({
    /** Número completo con prefijo de país: +51934879292. */
    phone: z.string().min(8).max(24),
});

function clientIp(req: Request): string | null {
    const forwarded = req.headers.get('x-forwarded-for');
    return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
}

export async function POST(req: Request) {
    if (!accountGlobalEnabled()) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    try {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: 'Teléfono inválido' }, { status: 400 });

        const who = await customerRowForPhone(parsed.data.phone);
        if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
        if (who.alreadyVerified) return NextResponse.json({ alreadyVerified: true });

        // El resultado (enviado, bloqueado por un límite, fallo de Meta) NO se devuelve: la
        // respuesta es la misma y tarda lo mismo en todos los casos.
        await requestOtp({ e164: who.e164, ip: clientIp(req) }, { sender: defaultSender(), alert: sendOtpCapAlertEmail });

        return NextResponse.json({
            ok: true,
            message: 'Si todo está en orden, te llegará un código por WhatsApp. Caduca en 5 minutos.',
        });
    } catch (error) {
        console.error('otp request error:', error);
        return NextResponse.json({ error: 'No se pudo pedir el código' }, { status: 500 });
    }
}
