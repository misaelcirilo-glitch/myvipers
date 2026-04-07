import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';
import { getSession } from '@/shared/lib/auth';

export async function GET(req: Request) {
    const session = await getSession();
    if (!session || (session.role !== 'admin' && session.role !== 'waiter')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    if (q.length < 2) return NextResponse.json({ customers: [] });

    const digits = q.replace(/\D/g, '');
    const term = `%${q}%`;

    let customers;
    if (digits.length >= 3) {
        // Buscar por nombre O por digitos en el telefono
        const phoneTerm = `%${digits}%`;
        customers = await db`
            SELECT id, name, phone, available_points, vip_level
            FROM users
            WHERE role = 'customer'
              AND (name ILIKE ${term} OR REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE ${phoneTerm})
            ORDER BY name
            LIMIT 10
        `;
    } else {
        customers = await db`
            SELECT id, name, phone, available_points, vip_level
            FROM users
            WHERE role = 'customer' AND name ILIKE ${term}
            ORDER BY name
            LIMIT 10
        `;
    }

    return NextResponse.json({ customers });
}
