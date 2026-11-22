/**
 * CAMBIO OBLIGATORIO DE CONTRASEÑA — recorrido completo por las rutas reales
 * (login → pase de un solo uso → nueva contraseña → login).
 *
 * SEGURIDAD: conexión SOLO de TEST_DATABASE_URL (rama de STAGING). Solo crea y borra el
 * negocio marcado d6…
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL no está definida. Pásala apuntando a la rama de STAGING (no a producción).');
}

const mocks = vi.hoisted(() => {
  process.env.JWT_SECRET = 'clave-solo-para-pruebas-0123456789abcdef';
  return { setSessionCookie: vi.fn(async () => {}) };
});

vi.mock('@/shared/lib/db', async () => {
  const { neon: connect } = await import('@neondatabase/serverless');
  return { db: connect(process.env.TEST_DATABASE_URL!) };
});
vi.mock('@/shared/lib/auth', async (original) => ({
  ...(await original<typeof import('@/shared/lib/auth')>()),
  setSessionCookie: mocks.setSessionCookie,
}));

import * as login from '@/app/api/auth/login/route';
import * as reset from '@/app/api/auth/reset-password/route';

const db = neon(url);
const T = 'd6d6d6d6-0000-4000-8000-000000000006';
const SLUG = 'iso-clave';
const ANTIGUA = { id: 'd6d6d6d6-0000-4000-8000-0000000000c1', phone: '900000061' }; // contraseña = 4 últimas cifras
const MARCADA = { id: 'd6d6d6d6-0000-4000-8000-0000000000c2', phone: '900000062' }; // creada por el admin
const NORMAL = { id: 'd6d6d6d6-0000-4000-8000-0000000000c3', phone: '900000063' };

const post = (handler: (r: Request) => Promise<Response>, body: unknown) =>
  handler(new Request('http://test.local/api/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const entrar = (phone: string, password: string) => post(login.POST, { phone, password, restaurantSlug: SLUG });
const marca = async (id: string) => (await db`SELECT must_change_password FROM users WHERE id = ${id}`)[0].must_change_password;

async function limpiar() {
  await db`DELETE FROM users WHERE restaurant_id = ${T}`;
  await db`DELETE FROM restaurants WHERE id = ${T}`;
}

beforeAll(async () => {
  await limpiar();
  await db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
           VALUES (${T}, 'ISO Clave', ${SLUG}, 'restaurant', '["restaurant"]'::jsonb, true, 'PEN', 'PE')`;
  const h = (p: string) => bcrypt.hash(p, 4);
  await db`INSERT INTO users (id, name, phone, password_hash, role, restaurant_id, must_change_password)
           VALUES (${ANTIGUA.id}, 'Antigua', ${ANTIGUA.phone}, ${await h('0061')}, 'customer', ${T}, false)`;
  await db`INSERT INTO users (id, name, phone, password_hash, role, restaurant_id, must_change_password)
           VALUES (${MARCADA.id}, 'Marcada', ${MARCADA.phone}, ${await h('48213975')}, 'customer', ${T}, true)`;
  await db`INSERT INTO users (id, name, phone, password_hash, role, restaurant_id, must_change_password)
           VALUES (${NORMAL.id}, 'Normal', ${NORMAL.phone}, ${await h('mi-clave-propia')}, 'customer', ${T}, false)`;
});

beforeEach(() => mocks.setSessionCookie.mockClear());

afterAll(async () => {
  await limpiar();
});

describe('Cambio obligatorio de contraseña', () => {
  it('una cuenta normal entra directamente', async () => {
    const data = await (await entrar(NORMAL.phone, 'mi-clave-propia')).json();
    expect(data.success).toBe(true);
    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);
  });

  it('contraseña = 4 últimas cifras: no abre sesión; tras elegir una propia, entra', async () => {
    const res = await entrar(ANTIGUA.phone, '0061');
    const data = await res.json();
    expect(data.mustChangePassword).toBe(true);
    expect(data.success).toBeUndefined();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();

    // Una contraseña corta no vale.
    expect((await post(reset.POST, { token: data.resetToken, password: '1234567' })).status).toBe(400);
    // Con 8 o más, sí.
    expect((await post(reset.POST, { token: data.resetToken, password: 'nueva-clave-1' })).status).toBe(200);
    // El pase es de un solo uso.
    expect((await post(reset.POST, { token: data.resetToken, password: 'otra-clave-22' })).status).toBe(400);

    // La contraseña antigua ya no sirve y la nueva abre sesión.
    expect((await entrar(ANTIGUA.phone, '0061')).status).toBe(401);
    const ok = await (await entrar(ANTIGUA.phone, 'nueva-clave-1')).json();
    expect(ok.success).toBe(true);
    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);
  });

  it('cuenta creada por el admin (marcada): no abre sesión hasta cambiarla, y se quita la marca', async () => {
    const data = await (await entrar(MARCADA.phone, '48213975')).json();
    expect(data.mustChangePassword).toBe(true);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(await marca(MARCADA.id)).toBe(true);

    expect((await post(reset.POST, { token: data.resetToken, password: 'clave-del-cliente' })).status).toBe(200);
    expect(await marca(MARCADA.id)).toBe(false);

    const ok = await (await entrar(MARCADA.phone, 'clave-del-cliente')).json();
    expect(ok.success).toBe(true);
    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);
  });

  it('con contraseña incorrecta no se entrega ningún pase', async () => {
    const res = await entrar(MARCADA.phone, 'no-es-esta');
    expect(res.status).toBe(401);
    expect((await res.json()).resetToken).toBeUndefined();
  });
});
