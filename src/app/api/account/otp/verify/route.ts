import { NextResponse } from 'next/server';
import { z } from 'zod';
import { accountGlobalEnabled } from '@/features/account/config';
import { verifyOtpAndLink } from '@/features/account/otp';
import { customerRowForPhone } from '@/features/account/session-row';

// Comprobar el código y, si es correcto, unir las filas del cliente a su cuenta global
// (PRP-myvipers-006, F2). Detrás de ACCOUNT_GLOBAL_ENABLED: apagado, esta ruta no existe.

const schema = z.object({
    phone: z.string().min(8).max(24),
    code: z.string().regex(/^[0-9]{6}$/),
});

export async function POST(req: Request) {
    if (!accountGlobalEnabled()) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    try {
        const parsed = schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: 'Código incorrecto o caducado' }, { status: 400 });

        const who = await customerRowForPhone(parsed.data.phone);
        if (!who.ok) return NextResponse.json({ error: who.error }, { status: who.status });
        if (who.alreadyVerified) return NextResponse.json({ alreadyVerified: true });

        const result = await verifyOtpAndLink({ e164: who.e164, code: parsed.data.code, sessionUserId: who.userId });
        // Incorrecto, caducado, ya usado o sin intentos: la misma respuesta.
        if (!result.ok) return NextResponse.json({ error: 'Código incorrecto o caducado' }, { status: 400 });

        return NextResponse.json({ success: true, businesses: result.linked });
    } catch (error) {
        console.error('otp verify error:', error);
        return NextResponse.json({ error: 'No se pudo comprobar el código' }, { status: 500 });
    }
}
