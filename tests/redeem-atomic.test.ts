/**
 * CANJE ATÓMICO — dos (o más) canjes simultáneos no pueden gastar el mismo saldo.
 *
 * Llama a la ruta real POST /api/points varias veces A LA VEZ con un cliente que solo tiene
 * saldo para UN canje. Debe salir bien exactamente uno.
 *
 * SEGURIDAD: conexión SOLO de TEST_DATABASE_URL (rama de STAGING). Solo crea y borra el
 * negocio marcado d5…
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { neon } from '@neondatabase/serverless';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL no está definida. Pásala apuntando a la rama de STAGING (no a producción).');
}

const T = 'd5d5d5d5-0000-0000-0000-000000000005';
const CUST = 'd5d5d5d5-0000-0000-0000-0000000000c1';
const REWARD = 'd5d5d5d5-0000-0000-0000-0000000000e1';
const COST = 100;

vi.mock('@/shared/lib/db', async () => {
  const { neon: connect } = await import('@neondatabase/serverless');
  return { db: connect(process.env.TEST_DATABASE_URL!) };
});
vi.mock('@/shared/lib/auth', () => ({
  getSession: async () => ({
    userId: 'd5d5d5d5-0000-0000-0000-0000000000c1', name: 'Cliente canje', phone: '900000051', role: 'customer',
    vipLevel: 'bronze', restaurantId: 'd5d5d5d5-0000-0000-0000-000000000005', restaurantSlug: 'iso-canje',
  }),
}));

import * as points from '@/app/api/points/route';

const db = neon(url);

const canjear = () =>
  points.POST(new Request('http://test.local/api/points', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rewardId: REWARD }),
  }));

async function limpiar() {
  await db`DELETE FROM redemptions WHERE restaurant_id = ${T}`;
  await db`DELETE FROM point_transactions WHERE restaurant_id = ${T}`;
  await db`DELETE FROM rewards WHERE restaurant_id = ${T}`;
  await db`DELETE FROM users WHERE restaurant_id = ${T}`;
  await db`DELETE FROM restaurants WHERE id = ${T}`;
}

beforeAll(async () => {
  await limpiar();
  await db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
           VALUES (${T}, 'ISO Canje', 'iso-canje', 'restaurant', '["restaurant"]'::jsonb, true, 'PEN', 'PE')`;
  await db`INSERT INTO users (id, name, phone, password_hash, role, restaurant_id, total_points, available_points)
           VALUES (${CUST}, 'Cliente canje', '900000051', 'x', 'customer', ${T}, ${COST}, ${COST})`;
  await db`INSERT INTO rewards (id, name, points_cost, category, is_active, sort_order, restaurant_id)
           VALUES (${REWARD}, 'PREMIO-CANJE', ${COST}, 'discount', true, 1, ${T})`;
});

beforeEach(async () => {
  await db`DELETE FROM redemptions WHERE restaurant_id = ${T}`;
  await db`DELETE FROM point_transactions WHERE restaurant_id = ${T}`;
  await db`UPDATE users SET available_points = ${COST} WHERE id = ${CUST}`;
});

afterAll(async () => {
  await limpiar();
});

async function estado() {
  const [u] = await db`SELECT available_points FROM users WHERE id = ${CUST}`;
  const canjes = await db`SELECT points_spent FROM redemptions WHERE user_id = ${CUST}`;
  const movs = await db`SELECT points FROM point_transactions WHERE user_id = ${CUST} AND type = 'redeem'`;
  return { saldo: u.available_points, canjes: canjes.length, movimientos: movs.length };
}

describe('Canje de puntos', () => {
  it('con saldo para un solo canje, 8 canjes simultáneos: sale bien exactamente uno', async () => {
    const respuestas = await Promise.all(Array.from({ length: 8 }, canjear));
    const codigos = respuestas.map((r) => r.status);
    expect(codigos.filter((c) => c === 200).length).toBe(1);
    expect(codigos.filter((c) => c === 400).length).toBe(7);
    expect(await estado()).toEqual({ saldo: 0, canjes: 1, movimientos: 1 });
  });

  it('un canje normal descuenta el saldo y deja un canje y un movimiento', async () => {
    const res = await canjear();
    expect(res.status).toBe(200);
    expect(await estado()).toEqual({ saldo: 0, canjes: 1, movimientos: 1 });
  });

  it('sin saldo suficiente no descuenta ni apunta nada', async () => {
    await db`UPDATE users SET available_points = ${COST - 1} WHERE id = ${CUST}`;
    const res = await canjear();
    expect(res.status).toBe(400);
    expect(await estado()).toEqual({ saldo: COST - 1, canjes: 0, movimientos: 0 });
  });
});
