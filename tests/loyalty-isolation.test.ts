/**
 * AISLAMIENTO ENTRE NEGOCIOS — puntos, canjes, reservas, recompensas y promociones.
 *
 * A diferencia de `tenant-isolation.test.ts` (que comprueba consultas), aquí se llama a
 * las RUTAS REALES de la API con una sesión del negocio A y se intenta leer o tocar datos
 * del negocio B. Solo se sustituyen la sesión (cookie) y la conexión a la base de datos.
 *
 * SEGURIDAD (igual que el resto de pruebas con BD):
 *   - La conexión sale SOLO de TEST_DATABASE_URL (rama de STAGING, nunca producción).
 *   - Solo se crean y se borran los dos negocios marcados d3…/d4…
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { neon } from '@neondatabase/serverless';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL no está definida. Pásala apuntando a la rama de STAGING (no a producción).');
}

type TestSession = {
  userId: string; name: string; phone: string; role: 'customer' | 'admin';
  vipLevel: string; restaurantId: string; restaurantSlug: string;
};
const state = vi.hoisted(() => ({ session: null as unknown }));

vi.mock('@/shared/lib/db', async () => {
  const { neon: connect } = await import('@neondatabase/serverless');
  return { db: connect(process.env.TEST_DATABASE_URL!) };
});
vi.mock('@/shared/lib/auth', () => ({ getSession: async () => state.session }));
vi.mock('@/shared/lib/push-server', () => ({ sendPushToRestaurant: async () => ({ sent: 0 }) }));

import * as adminPoints from '@/app/api/admin/points/route';
import * as points from '@/app/api/points/route';
import * as reservations from '@/app/api/reservations/route';
import * as adminRewards from '@/app/api/admin/rewards/route';
import * as adminPromotions from '@/app/api/admin/promotions/route';
import * as promotions from '@/app/api/promotions/route';
import * as adminCustomers from '@/app/api/admin/customers/route';

const db = neon(url);

const A = 'd3d3d3d3-0000-4000-8000-000000000003';
const B = 'd4d4d4d4-0000-4000-8000-000000000004';
const ids = {
  adminA: 'd3d3d3d3-0000-4000-8000-0000000000a1',
  custA: 'd3d3d3d3-0000-4000-8000-0000000000c1',
  custB: 'd4d4d4d4-0000-4000-8000-0000000000c2',
  rewardA: 'd3d3d3d3-0000-4000-8000-0000000000e1',
  rewardB: 'd4d4d4d4-0000-4000-8000-0000000000e2',
  promoA: 'd3d3d3d3-0000-4000-8000-0000000000f1',
  promoB: 'd4d4d4d4-0000-4000-8000-0000000000f2',
  tableA: 'd3d3d3d3-0000-4000-8000-0000000000b1',
  tableB: 'd4d4d4d4-0000-4000-8000-0000000000b2',
  reservaB: 'd4d4d4d4-0000-4000-8000-0000000000d2',
};
const PHONE_B = '900000042';

const asAdminA = () => { state.session = { userId: ids.adminA, name: 'Admin A', phone: '900000040', role: 'admin', vipLevel: 'bronze', restaurantId: A, restaurantSlug: 'iso-fid-a' } satisfies TestSession; };
const asCustomerA = () => { state.session = { userId: ids.custA, name: 'Cliente A', phone: '900000041', role: 'customer', vipLevel: 'bronze', restaurantId: A, restaurantSlug: 'iso-fid-a' } satisfies TestSession; };

const req = (method: string, body?: unknown, path = '/api/x') =>
  new Request(`http://test.local${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function limpiar() {
  for (const id of [A, B]) {
    await db`DELETE FROM redemptions WHERE restaurant_id = ${id}`;
    await db`DELETE FROM point_transactions WHERE restaurant_id = ${id}`;
    await db`DELETE FROM reservations WHERE restaurant_id = ${id}`;
    await db`DELETE FROM promotions WHERE restaurant_id = ${id}`;
    await db`DELETE FROM rewards WHERE restaurant_id = ${id}`;
    await db`DELETE FROM tables WHERE restaurant_id = ${id}`;
    await db`DELETE FROM users WHERE restaurant_id = ${id}`;
    await db`DELETE FROM restaurants WHERE id = ${id}`;
  }
}

const saldo = async (userId: string) =>
  (await db`SELECT available_points, total_points FROM users WHERE id = ${userId}`)[0];

beforeAll(async () => {
  await limpiar();
  await db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
           VALUES (${A}, 'ISO Fidelidad A', 'iso-fid-a', 'restaurant', '["restaurant"]'::jsonb, true, 'PEN', 'PE')`;
  await db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
           VALUES (${B}, 'ISO Fidelidad B', 'iso-fid-b', 'restaurant', '["restaurant"]'::jsonb, true, 'PEN', 'PE')`;

  await db`INSERT INTO users (id, name, phone, password_hash, role, restaurant_id) VALUES (${ids.adminA}, 'Admin A', '900000040', 'x', 'admin', ${A})`;
  await db`INSERT INTO users (id, name, phone, password_hash, role, restaurant_id, total_points, available_points)
           VALUES (${ids.custA}, 'Cliente A', '900000041', 'x', 'customer', ${A}, 500, 500)`;
  await db`INSERT INTO users (id, name, phone, password_hash, role, restaurant_id, total_points, available_points)
           VALUES (${ids.custB}, 'CLIENTE-SOLO-DE-B', ${PHONE_B}, 'x', 'customer', ${B}, 500, 500)`;

  await db`INSERT INTO point_transactions (user_id, restaurant_id, type, points, description) VALUES (${ids.custA}, ${A}, 'earn', 500, 'MOV-SOLO-DE-A')`;
  await db`INSERT INTO point_transactions (user_id, restaurant_id, type, points, description) VALUES (${ids.custB}, ${B}, 'earn', 500, 'MOV-SOLO-DE-B')`;

  await db`INSERT INTO rewards (id, name, points_cost, category, is_active, sort_order, restaurant_id) VALUES (${ids.rewardA}, 'PREMIO-SOLO-DE-A', 100, 'discount', true, 1, ${A})`;
  await db`INSERT INTO rewards (id, name, points_cost, category, is_active, sort_order, restaurant_id) VALUES (${ids.rewardB}, 'PREMIO-SOLO-DE-B', 100, 'discount', true, 1, ${B})`;

  await db`INSERT INTO promotions (id, title, is_active, restaurant_id) VALUES (${ids.promoA}, 'PROMO-SOLO-DE-A', true, ${A})`;
  await db`INSERT INTO promotions (id, title, is_active, restaurant_id) VALUES (${ids.promoB}, 'PROMO-SOLO-DE-B', true, ${B})`;

  await db`INSERT INTO tables (id, number, capacity, is_active, restaurant_id) VALUES (${ids.tableA}, 1, 4, true, ${A})`;
  await db`INSERT INTO tables (id, number, capacity, is_active, restaurant_id) VALUES (${ids.tableB}, 1, 4, true, ${B})`;
  await db`INSERT INTO reservations (id, user_id, restaurant_id, table_id, date, time, party_size, status)
           VALUES (${ids.reservaB}, ${ids.custB}, ${B}, ${ids.tableB}, '2030-01-15', '20:00', 2, 'confirmed')`;
});

afterAll(async () => {
  await limpiar();
});

describe('Puntos', () => {
  it('el admin de A no puede dar puntos a un cliente de B por su id', async () => {
    asAdminA();
    const antes = await saldo(ids.custB);
    const res = await adminPoints.POST(req('POST', { userId: ids.custB, amount: 50 }));
    expect(res.status).toBe(404);
    expect(await saldo(ids.custB)).toEqual(antes);
  });

  it('el admin de A no puede dar puntos a un cliente de B por su teléfono', async () => {
    asAdminA();
    const antes = await saldo(ids.custB);
    const res = await adminPoints.POST(req('POST', { phone: PHONE_B, amount: 50 }));
    expect(res.status).toBe(404);
    expect(await saldo(ids.custB)).toEqual(antes);
    const movs = await db`SELECT 1 FROM point_transactions WHERE user_id = ${ids.custB} AND restaurant_id = ${A}`;
    expect(movs.length).toBe(0);
  });

  it('control: el admin de A sí da puntos a su cliente, y el movimiento queda en A', async () => {
    asAdminA();
    const res = await adminPoints.POST(req('POST', { userId: ids.custA, amount: 50 }));
    expect(res.status).toBe(200);
    const movs = await db`SELECT restaurant_id FROM point_transactions WHERE user_id = ${ids.custA} AND type = 'earn' AND points = 50`;
    expect(movs.length).toBe(1);
    expect(movs[0].restaurant_id).toBe(A);
  });

  it('el cliente de A solo ve su historial y los premios de A', async () => {
    asCustomerA();
    const data = await (await points.GET()).json();
    expect(data.history.length).toBeGreaterThan(0);
    expect(data.history.some((h: { description: string }) => h.description === 'MOV-SOLO-DE-B')).toBe(false);
    expect(data.rewards.map((r: { name: string }) => r.name)).toEqual(['PREMIO-SOLO-DE-A']);
  });
});

describe('Canjes', () => {
  it('el cliente de A no puede canjear un premio de B', async () => {
    asCustomerA();
    const antes = await saldo(ids.custA);
    const res = await points.POST(req('POST', { rewardId: ids.rewardB }));
    expect(res.status).toBe(404);
    expect(await saldo(ids.custA)).toEqual(antes);
    const canjes = await db`SELECT 1 FROM redemptions WHERE reward_id = ${ids.rewardB}`;
    expect(canjes.length).toBe(0);
  });

  it('control: canjea un premio de A y el canje queda en A', async () => {
    asCustomerA();
    const res = await points.POST(req('POST', { rewardId: ids.rewardA }));
    expect(res.status).toBe(200);
    const canjes = await db`SELECT restaurant_id, user_id FROM redemptions WHERE reward_id = ${ids.rewardA}`;
    expect(canjes.length).toBe(1);
    expect(canjes[0].restaurant_id).toBe(A);
    expect(canjes[0].user_id).toBe(ids.custA);
  });
});

describe('Reservas', () => {
  it('el cliente de A no ve reservas de B', async () => {
    asCustomerA();
    const data = await (await reservations.GET()).json();
    expect(data.reservations.some((r: { id: string }) => r.id === ids.reservaB)).toBe(false);
  });

  it('una reserva del cliente de A usa una mesa de A, nunca de B', async () => {
    asCustomerA();
    const res = await reservations.POST(req('POST', { date: '2030-01-15', time: '20:00', partySize: 2 }));
    expect(res.status).toBe(200);
    const { reservation } = await res.json();
    const fila = (await db`SELECT restaurant_id, table_id FROM reservations WHERE id = ${reservation.id}`)[0];
    expect(fila.restaurant_id).toBe(A);
    expect(fila.table_id).toBe(ids.tableA);
  });
});

describe('Recompensas', () => {
  it('el admin de A solo lista las recompensas de A', async () => {
    asAdminA();
    const data = await (await adminRewards.GET()).json();
    const nombres = (data.rewards ?? data.data ?? []).map((r: { name: string }) => r.name);
    expect(nombres).toContain('PREMIO-SOLO-DE-A');
    expect(nombres).not.toContain('PREMIO-SOLO-DE-B');
  });

  it('el admin de A no puede modificar ni borrar una recompensa de B', async () => {
    asAdminA();
    await adminRewards.PATCH(req('PATCH', { id: ids.rewardB, name: 'HACKEADO', is_active: false }));
    await adminRewards.DELETE(req('DELETE', { id: ids.rewardB }));
    const fila = await db`SELECT name, is_active FROM rewards WHERE id = ${ids.rewardB}`;
    expect(fila.length).toBe(1);
    expect(fila[0]).toMatchObject({ name: 'PREMIO-SOLO-DE-B', is_active: true });
  });
});

describe('Promociones', () => {
  it('el admin de A solo lista las promociones de A', async () => {
    asAdminA();
    const data = await (await adminPromotions.GET()).json();
    const titulos = (data.promotions ?? data.data ?? []).map((p: { title: string }) => p.title);
    expect(titulos).toContain('PROMO-SOLO-DE-A');
    expect(titulos).not.toContain('PROMO-SOLO-DE-B');
  });

  it('el admin de A no puede desactivar ni borrar una promoción de B', async () => {
    asAdminA();
    await adminPromotions.PATCH(req('PATCH', { id: ids.promoB, is_active: false }));
    await adminPromotions.DELETE(req('DELETE', { id: ids.promoB }, `/api/admin/promotions?id=${ids.promoB}`));
    const fila = await db`SELECT is_active FROM promotions WHERE id = ${ids.promoB}`;
    expect(fila.length).toBe(1);
    expect(fila[0].is_active).toBe(true);
  });

  it('la lista pública de A (por enlace) no incluye promociones de B', async () => {
    state.session = null;
    const data = await (await promotions.GET(req('GET', undefined, '/api/promotions?slug=iso-fid-a'))).json();
    expect(data.promotions.map((p: { title: string }) => p.title)).toEqual(['PROMO-SOLO-DE-A']);
  });
});

describe('Clientes', () => {
  it('el admin de A no ve al cliente de B, ni buscándolo por nombre o teléfono', async () => {
    asAdminA();
    for (const q of ['', 'CLIENTE-SOLO', PHONE_B]) {
      const res = await adminCustomers.GET(req('GET', undefined, `/api/admin/customers?q=${encodeURIComponent(q)}`));
      const texto = JSON.stringify(await res.json());
      expect(texto).not.toContain('CLIENTE-SOLO-DE-B');
    }
  });
});
