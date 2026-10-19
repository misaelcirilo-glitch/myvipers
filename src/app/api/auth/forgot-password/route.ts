import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/shared/lib/db';
import { createResetToken } from '@/shared/lib/auth';
import { sendPasswordResetEmail } from '@/shared/lib/email';

const schema = z.object({
    phone: z.string().min(9, 'Teléfono inválido'),
    restaurantSlug: z.string().optional(),
});

function maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const head = user.slice(0, 1);
    return `${head}${'*'.repeat(Math.max(user.length - 1, 2))}@${domain}`;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const { restaurantSlug } = parsed.data;
        const last9 = parsed.data.phone.replace(/\D/g, '').slice(-9);

        // Un teléfono puede tener cuenta en varias tiendas: con slug hay como mucho una; sin
        // slug se envía un enlace por cada cuenta con correo (cada uno restablece SU cuenta).
        const rows = restaurantSlug
            ? await db`
                SELECT u.id, u.name, u.email, u.password_hash, r.name AS restaurant_name
                FROM users u JOIN restaurants r ON r.id = u.restaurant_id
                WHERE RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = ${last9}
                  AND r.slug = ${restaurantSlug}
                LIMIT 1`
            : await db`
                SELECT u.id, u.name, u.email, u.password_hash, r.name AS restaurant_name
                FROM users u LEFT JOIN restaurants r ON r.id = u.restaurant_id
                WHERE RIGHT(REGEXP_REPLACE(u.phone, '[^0-9]', '', 'g'), 9) = ${last9}`;

        if (rows.length === 0) {
            return NextResponse.json({ status: 'not_found' });
        }

        const withEmail = rows.filter(u => u.email);
        if (withEmail.length === 0) {
            return NextResponse.json({ status: 'no_email' });
        }

        // URL base a partir del request → funciona en cualquier dominio (el-machay / myvipers)
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'myvipers.es';
        const proto = req.headers.get('x-forwarded-proto') || 'https';
        const base = `${proto}://${host}`;

        const sentTo: string[] = [];
        let lastError: { skipped?: boolean; error?: string } | null = null;
        for (const user of withEmail) {
            const token = await createResetToken(user.id, user.password_hash);
            const resetUrl = `${base}/restablecer?token=${encodeURIComponent(token)}`;

            const sent = await sendPasswordResetEmail({
                to: user.email,
                name: user.name,
                resetUrl,
                restaurantName: user.restaurant_name || 'MyVipers',
            });
            if (sent.ok) sentTo.push(maskEmail(user.email));
            else lastError = sent;
        }

        if (sentTo.length === 0) {
            return NextResponse.json(
                { status: 'error', error: lastError?.skipped ? 'El envío de correos no está configurado' : (lastError?.error || 'No se pudo enviar el correo') },
                { status: 502 }
            );
        }

        return NextResponse.json({ status: 'sent', email: [...new Set(sentTo)].join(', ') });
    } catch (error) {
        console.error('forgot-password error:', error);
        return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
    }
}
