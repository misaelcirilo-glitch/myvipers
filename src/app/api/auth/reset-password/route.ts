import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/shared/lib/db';
import { verifyResetToken } from '@/shared/lib/auth';

const schema = z.object({
    token: z.string().min(10, 'Token inválido'),
    password: z.string().min(4, 'Mínimo 4 caracteres'),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

        const { token, password } = parsed.data;

        const payload = await verifyResetToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'El enlace no es válido o expiró' }, { status: 400 });
        }

        const rows = await db`SELECT id, password_hash FROM users WHERE id = ${payload.userId} LIMIT 1`;
        if (rows.length === 0) {
            return NextResponse.json({ error: 'El enlace no es válido o expiró' }, { status: 400 });
        }

        // Single-use: si el hash ya cambió, la huella no coincide → token consumido
        if (rows[0].password_hash.slice(-12) !== payload.fp) {
            return NextResponse.json({ error: 'Este enlace ya fue usado. Solicita uno nuevo.' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await db`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${payload.userId}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('reset-password error:', error);
        return NextResponse.json({ error: 'Error al restablecer la contraseña' }, { status: 500 });
    }
}
