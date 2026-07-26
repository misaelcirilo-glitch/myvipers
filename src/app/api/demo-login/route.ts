import { NextResponse } from 'next/server';

// DESACTIVADO (2026-07-26) por seguridad.
// Este endpoint concedía una sesión de ADMIN real sobre el tenant de PRODUCCIÓN
// de El Machay (usuario con teléfono 944933545, rol admin) SIN contraseña: una
// simple petición POST devolvía una cookie de sesión válida y permitía leer y
// modificar datos reales de clientes (nombres, puntos, transacciones).
// Se apaga (404) hasta reconstruir la demo sobre un tenant desechable aislado,
// sin acceso a datos reales. No afecta al login normal (/api/auth/login).
export async function POST() {
    return NextResponse.json({ error: 'Demo no disponible' }, { status: 404 });
}
