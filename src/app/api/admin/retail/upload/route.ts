import { put } from '@vercel/blob';
import { getSession } from '@/shared/lib/auth';
import { NextResponse } from 'next/server';

// Retail — subida de la foto principal del producto a Vercel Blob (PRP-myvipers-002,
// Fase 4). Solo admin. El binario vive en Blob; en la BD solo se guarda la URL
// (la escribe /admin/retail/products al guardar el producto). Aislado por tenant
// vía el prefijo de ruta retail/<restaurant_id>/. El token BLOB_READ_WRITE_TOKEN
// lo inyecta Vercel al conectar el store (nunca va en código).

const MAX_BYTES = 5 * 1024 * 1024;                 // 5 MB (el cliente ya recomprime antes)
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

async function requireAdmin() {
    const session = await getSession();
    if (!session || session.role !== 'admin') return null;
    return session;
}

export async function POST(req: Request) {
    const session = await requireAdmin();
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json({ error: 'Almacenamiento de imágenes no configurado' }, { status: 503 });
    }

    let file: File | null = null;
    try {
        const form = await req.formData();
        const f = form.get('file');
        if (f instanceof File) file = f;
    } catch {
        return NextResponse.json({ error: 'Archivo inválido' }, { status: 400 });
    }
    if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
    if (!ALLOWED.includes(file.type)) {
        return NextResponse.json({ error: 'Formato no permitido (JPG, PNG o WebP)' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'La imagen supera los 5 MB' }, { status: 400 });
    }

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    // randomUUID en el path evita colisiones y hace la URL no adivinable.
    const key = `retail/${session.restaurantId}/${crypto.randomUUID()}.${ext}`;

    const blob = await put(key, file, { access: 'public', contentType: file.type });
    return NextResponse.json({ url: blob.url });
}
