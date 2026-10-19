import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveLogin } from '@/shared/lib/account-match';
import { db } from '@/shared/lib/db';
import { createToken, setSessionCookie } from '@/shared/lib/auth';

// Login del admin de PLATAFORMA (transversal, sin tenant). Autentica por teléfono +
// contraseña SOLO contra usuarios con is_platform_admin = true.

const schema = z.object({
    phone: z.string().min(6, 'Teléfono inválido'),
    password: z.string().min(1, 'Contraseña requerida'),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const phone = parsed.data.phone.replace(/\D/g, '');
        const rows = await db`
            SELECT id, name, phone, password_hash
            FROM users
            WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ${phone.slice(-9)}
              AND is_platform_admin = true
        `;
        if (rows.length === 0) return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });

        // El teléfono puede tener varias cuentas (una por tienda): vale la que acepte la contraseña.
        const match = await resolveLogin(rows as { id: string; name: string; phone: string; password_hash: string }[], parsed.data.password);
        if (match.kind === 'none') return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
        const admin = match.kind === 'one' ? match.account : match.accounts[0];

        const token = await createToken({
            userId: admin.id,
            name: admin.name,
            phone: admin.phone,
            role: 'superadmin',
            vipLevel: 'bronce',
            restaurantId: '',
            restaurantSlug: '',
        });
        await setSessionCookie(token);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Platform login error:', error);
        return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
    }
}
