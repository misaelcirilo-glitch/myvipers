/**
 * CUENTA GLOBAL — F1 (migración 019): reglas del esquema y aislamiento entre negocios.
 *
 * Comprueba que la base de datos, por sí sola, impide lo que el PRP-006 prohíbe: cuentas sin
 * teléfono verificado, personal dentro de una cuenta global, dos filas de la misma cuenta en
 * un negocio, y que compartir cuenta no mezcla datos ni puntos entre negocios.
 *
 * SEGURIDAD: conexión SOLO de TEST_DATABASE_URL (rama de STAGING, con la 019 aplicada). Solo
 * crea y borra los negocios marcados d7…/d8… y las cuentas con teléfono +5190000007x.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { neon } from '@neondatabase/serverless';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL no está definida. Pásala apuntando a la rama de STAGING (no a producción).');
}
const db = neon(url);

const A = 'd7d7d7d7-0000-4000-8000-000000000007';
const B = 'd8d8d8d8-0000-4000-8000-000000000008';
const U = {
  clienteA: 'd7d7d7d7-0000-4000-8000-0000000000c1',
  cliente2A: 'd7d7d7d7-0000-4000-8000-0000000000c2',
  adminA: 'd7d7d7d7-0000-4000-8000-0000000000a1',
  camareroA: 'd7d7d7d7-0000-4000-8000-0000000000a2',
  clienteB: 'd8d8d8d8-0000-4000-8000-0000000000c1',
};
const TEL = '+51900000071';
const TEL2 = '+51900000072';

/** Devuelve el mensaje de error de la base de datos, o null si la operación entra. */
const rechazo = (p: Promise<unknown>) => p.then(() => null, (e: Error) => e.message);
const cuenta = async (phone = TEL) =>
  (await db`INSERT INTO customer_accounts (phone_e164, verified_at) VALUES (${phone}, now()) RETURNING id`)[0].id as string;
const vincular = (userId: string, accountId: string) => db`UPDATE users SET account_id = ${accountId} WHERE id = ${userId}`;

async function limpiarCuentas() {
  await db`UPDATE users SET account_id = NULL, sessions_valid_after = NULL, data_consent_at = NULL WHERE restaurant_id IN (${A}, ${B})`;
  await db`DELETE FROM account_events WHERE detail->>'prueba' = 'f1'`;
  await db`DELETE FROM phone_otp WHERE phone_hash LIKE 'prueba-f1-%'`;
  await db`DELETE FROM customer_accounts WHERE phone_e164 LIKE '+5190000007%'`;
}
async function limpiarTodo() {
  await limpiarCuentas();
  await db`DELETE FROM point_transactions WHERE restaurant_id IN (${A}, ${B})`;
  await db`DELETE FROM users WHERE restaurant_id IN (${A}, ${B})`;
  await db`DELETE FROM restaurants WHERE id IN (${A}, ${B})`;
}

beforeAll(async () => {
  await limpiarTodo();
  for (const [id, slug] of [[A, 'iso-cuenta-a'], [B, 'iso-cuenta-b']]) {
    await db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
             VALUES (${id}, ${'ISO Cuenta ' + slug.slice(-1)}, ${slug}, 'restaurant', '["restaurant"]'::jsonb, true, 'PEN', 'PE')`;
  }
  const fila = (id: string, name: string, phone: string, role: string, tenant: string, points: number) =>
    db`INSERT INTO users (id, name, phone, password_hash, role, restaurant_id, total_points, available_points)
       VALUES (${id}, ${name}, ${phone}, 'x', ${role}, ${tenant}, ${points}, ${points})`;
  await fila(U.clienteA, 'Cliente en A', '900000071', 'customer', A, 100);
  await fila(U.cliente2A, 'Otro cliente en A', '900000072', 'customer', A, 5);
  await fila(U.adminA, 'Admin de A', '900000073', 'admin', A, 0);
  await fila(U.camareroA, 'Camarero de A', '900000074', 'waiter', A, 0);
  await fila(U.clienteB, 'Cliente en B', '900000071', 'customer', B, 30);
});
beforeEach(limpiarCuentas);
afterAll(limpiarTodo);

describe('019 es aditiva: nada existente cambia', () => {
  it('ninguna fila de cliente tiene cuenta, consentimiento ni corte de sesiones al aplicar', async () => {
    const [r] = await db`SELECT count(*)::int AS n FROM users
                         WHERE account_id IS NOT NULL OR sessions_valid_after IS NOT NULL OR data_consent_at IS NOT NULL`;
    expect(r.n).toBe(0);
  });
  it('las tablas nuevas existen y no guardan teléfonos ni códigos en claro (salvo el de la cuenta verificada)', async () => {
    const cols = await db`SELECT table_name, column_name FROM information_schema.columns
                          WHERE table_schema = 'public' AND table_name IN ('customer_accounts', 'phone_otp', 'account_events')`;
    const de = (t: string) => cols.filter((c) => c.table_name === t).map((c) => c.column_name).sort();
    expect(de('customer_accounts')).toEqual(['created_at', 'id', 'last_login_at', 'phone_e164', 'verified_at']);
    expect(de('phone_otp')).toEqual(['attempts', 'code_hash', 'created_at', 'expires_at', 'id', 'ip_hash', 'phone_hash', 'purpose', 'sent_at', 'status']);
    expect(de('account_events')).toEqual(['account_id', 'created_at', 'detail', 'event', 'id']);
  });
});

describe('cuenta global: solo con teléfono verificado y bien escrito', () => {
  it('no existe cuenta «pendiente»: sin fecha de verificación no entra', async () => {
    expect(await rechazo(db`INSERT INTO customer_accounts (phone_e164) VALUES (${TEL})`)).toMatch(/verified_at/);
  });
  it('el teléfono va en formato internacional (+51…); cualquier otro se rechaza', async () => {
    for (const malo of ['900000071', '51900000071', '+0900000071', '+51 900 000 071', '+51abc000071', '+519']) {
      expect(await rechazo(cuenta(malo)), malo).toMatch(/check constraint/);
    }
    expect(await rechazo(cuenta(TEL))).toBeNull();
  });
  it('un teléfono = una sola cuenta', async () => {
    await cuenta(TEL);
    expect(await rechazo(cuenta(TEL))).toMatch(/duplicate key/);
  });
});

describe('qué filas pueden entrar en una cuenta', () => {
  it('un cliente sí; el personal (admin, camarero) nunca', async () => {
    const id = await cuenta();
    expect(await rechazo(vincular(U.clienteA, id))).toBeNull();
    expect(await rechazo(vincular(U.adminA, id))).toMatch(/users_account_only_customers/);
    expect(await rechazo(vincular(U.camareroA, id))).toMatch(/users_account_only_customers/);
  });
  it('un cliente con cuenta no puede pasar a ser personal sin soltarla antes', async () => {
    await vincular(U.clienteA, await cuenta());
    expect(await rechazo(db`UPDATE users SET role = 'admin' WHERE id = ${U.clienteA}`)).toMatch(/users_account_only_customers/);
  });
  it('una cuenta tiene como mucho una fila por negocio, y sí una en cada negocio', async () => {
    const id = await cuenta();
    await vincular(U.clienteA, id);
    expect(await rechazo(vincular(U.cliente2A, id))).toMatch(/users_account_restaurant_uniq/);
    expect(await rechazo(vincular(U.clienteB, id))).toBeNull();
  });
  it('no se puede apuntar a una cuenta que no existe', async () => {
    expect(await rechazo(vincular(U.clienteA, 'd7d7d7d7-0000-4000-8000-00000000dead'))).toMatch(/users_account_id_fkey/);
  });
});

describe('aislamiento entre negocios con la cuenta compartida', () => {
  it('la misma cuenta en dos negocios no mezcla clientes: cada negocio solo ve su fila', async () => {
    const id = await cuenta();
    await vincular(U.clienteA, id);
    await vincular(U.clienteB, id);
    const deA = await db`SELECT id, restaurant_id FROM users WHERE restaurant_id = ${A}`;
    const deB = await db`SELECT id, restaurant_id FROM users WHERE restaurant_id = ${B}`;
    expect(deA.every((r) => r.restaurant_id === A)).toBe(true);
    expect(deA.map((r) => r.id)).not.toContain(U.clienteB);
    expect(deB.map((r) => r.id)).toEqual([U.clienteB]);
    // Buscar por cuenta dentro de un negocio da una sola fila, la de ese negocio.
    const enA = await db`SELECT id FROM users WHERE account_id = ${id} AND restaurant_id = ${A}`;
    expect(enA.map((r) => r.id)).toEqual([U.clienteA]);
  });
  it('los puntos son de cada negocio: mover los de A no toca los de B', async () => {
    const id = await cuenta();
    await vincular(U.clienteA, id);
    await vincular(U.clienteB, id);
    await db`UPDATE users SET available_points = available_points - 40 WHERE id = ${U.clienteA}`;
    await db`INSERT INTO point_transactions (user_id, type, points, description, restaurant_id)
             VALUES (${U.clienteA}, 'redeem', -40, 'Canje de prueba F1', ${A})`;
    const filas = await db`SELECT id, available_points FROM users WHERE account_id = ${id} ORDER BY restaurant_id`;
    expect(Object.fromEntries(filas.map((r) => [r.id, r.available_points]))).toEqual({ [U.clienteA]: 60, [U.clienteB]: 30 });
    const movB = await db`SELECT 1 FROM point_transactions WHERE restaurant_id = ${B}`;
    expect(movB).toHaveLength(0);
    await db`UPDATE users SET available_points = 100 WHERE id = ${U.clienteA}`;
    await db`DELETE FROM point_transactions WHERE restaurant_id = ${A}`;
  });
  it('dos cuentas distintas nunca comparten fila', async () => {
    const [c1, c2] = [await cuenta(TEL), await cuenta(TEL2)];
    await vincular(U.clienteA, c1);
    await vincular(U.cliente2A, c2);
    const deC2 = await db`SELECT id FROM users WHERE account_id = ${c2}`;
    expect(deC2.map((r) => r.id)).toEqual([U.cliente2A]);
  });
});

describe('borrar una cuenta no borra clientes ni puntos', () => {
  it('las filas quedan sueltas (sin cuenta) con su nombre y sus puntos intactos', async () => {
    const id = await cuenta();
    await vincular(U.clienteA, id);
    await vincular(U.clienteB, id);
    await db`INSERT INTO account_events (account_id, event, detail) VALUES (${id}, 'verified', '{"prueba":"f1"}')`;
    await db`DELETE FROM customer_accounts WHERE id = ${id}`;
    const filas = await db`SELECT id, account_id, available_points FROM users WHERE id IN (${U.clienteA}, ${U.clienteB}) ORDER BY restaurant_id`;
    expect(filas.map((r) => [r.account_id, r.available_points])).toEqual([[null, 100], [null, 30]]);
    const ev = await db`SELECT account_id FROM account_events WHERE detail->>'prueba' = 'f1'`;
    expect(ev).toEqual([{ account_id: null }]); // el registro se conserva, sin apuntar a nadie
  });
});

describe('códigos por WhatsApp (phone_otp)', () => {
  const otp = (purpose: string, status: string) =>
    db`INSERT INTO phone_otp (phone_hash, code_hash, purpose, status) VALUES ('prueba-f1-a', 'huella', ${purpose}, ${status})`;
  it('solo admite los usos y estados previstos', async () => {
    expect(await rechazo(otp('verify', 'requested'))).toBeNull();
    expect(await rechazo(otp('recover', 'sent'))).toBeNull();
    expect(await rechazo(otp('login', 'sent'))).toMatch(/check constraint/);
    expect(await rechazo(otp('verify', 'aprobado'))).toMatch(/check constraint/);
  });
  it('un código nuevo nace sin intentos y como «pedido»', async () => {
    const [r] = await db`INSERT INTO phone_otp (phone_hash, purpose) VALUES ('prueba-f1-b', 'verify') RETURNING attempts, status`;
    expect(r).toEqual({ attempts: 0, status: 'requested' });
  });
});
