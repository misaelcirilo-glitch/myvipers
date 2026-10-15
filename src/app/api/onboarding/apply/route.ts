import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/shared/lib/db';
import { isValidVertical } from '@/shared/lib/verticals';

// Alta de negocio (PRP-003, F2). Público SIN sesión: solo crea una SOLICITUD inerte
// (tenant_applications, status pending). NO crea tenant ni usuario — eso ocurre al
// aprobar desde el panel de plataforma.

const schema = z.object({
    businessName: z.string().min(2, 'Nombre del negocio muy corto'),
    slug: z.string().regex(/^[a-z0-9-]{3,40}$/, 'Identificador inválido (minúsculas, números y guiones, 3-40)'),
    businessType: z.string(),
    adminName: z.string().min(2, 'Nombre del administrador muy corto'),
    adminPhone: z.string().min(9, 'Teléfono inválido'),
    adminEmail: z.string().email('Email inválido').optional().or(z.literal('')),
    password: z.string().min(6, 'Mínimo 6 caracteres'),
    country: z.string().optional(),
    notes: z.string().max(500).optional(),
    website: z.string().optional(), // honeypot anti-spam: debe venir vacío
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
        const d = parsed.data;

        // Honeypot: si un bot rellena el campo oculto, fingimos éxito sin guardar.
        if (d.website && d.website.trim() !== '') return NextResponse.json({ success: true }, { status: 201 });

        if (!isValidVertical(d.businessType)) {
            return NextResponse.json({ error: 'Tipo de negocio no válido' }, { status: 400 });
        }
        const phone = d.adminPhone.replace(/\D/g, '');

        // Slug libre (ni tenant existente ni otra solicitud pendiente)
        const slugTaken = await db`SELECT 1 FROM restaurants WHERE slug = ${d.slug} LIMIT 1`;
        if (slugTaken.length > 0) {
            return NextResponse.json({ error: 'Ese identificador ya está en uso' }, { status: 409 });
        }
        const slugPending = await db`SELECT 1 FROM tenant_applications WHERE slug = ${d.slug} AND status = 'pending' LIMIT 1`;
        if (slugPending.length > 0) {
            return NextResponse.json({ error: 'Ya hay una solicitud pendiente con ese identificador' }, { status: 409 });
        }

        // Anti-spam ligero: una solicitud pendiente por teléfono.
        const dupe = await db`SELECT 1 FROM tenant_applications WHERE admin_phone = ${phone} AND status = 'pending' LIMIT 1`;
        if (dupe.length > 0) {
            return NextResponse.json({ error: 'Ya tienes una solicitud pendiente de revisión' }, { status: 409 });
        }

        const passwordHash = await bcrypt.hash(d.password, 10);
        await db`
            INSERT INTO tenant_applications
                (business_name, slug, business_type, admin_name, admin_phone, admin_email, admin_password_hash, country, notes)
            VALUES
                (${d.businessName}, ${d.slug}, ${d.businessType}, ${d.adminName}, ${phone}, ${d.adminEmail || null}, ${passwordHash}, ${d.country || null}, ${d.notes || null})
        `;

        return NextResponse.json(
            { success: true, message: 'Solicitud recibida. Te avisaremos cuando esté aprobada.' },
            { status: 201 },
        );
    } catch (error) {
        console.error('Onboarding apply error:', error);
        return NextResponse.json({ error: 'Error al enviar la solicitud' }, { status: 500 });
    }
}
