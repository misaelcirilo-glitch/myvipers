import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/db';

// El alta directa de negocios está CERRADA: creaba un negocio y una sesión de admin sin
// autenticación ni revisión. El alta va por la solicitud (/registrar-negocio →
// /api/onboarding/apply), que el equipo aprueba desde /plataforma/solicitudes.
export async function POST() {
    return NextResponse.json(
        { error: 'El alta directa ya no está disponible. Solicita tu cuenta en /registrar-negocio.' },
        { status: 410 },
    );
}

// GET: lista restaurantes públicos (para landing)
export async function GET() {
    try {
        const restaurants = await db`
            SELECT slug, name, description, logo_url, city, country
            FROM restaurants WHERE is_active = true
            ORDER BY created_at DESC LIMIT 50
        `;
        return NextResponse.json({ data: restaurants });
    } catch {
        return NextResponse.json({ data: [] });
    }
}
