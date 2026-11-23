/**
 * CUENTA GLOBAL — F2: códigos por WhatsApp y unión de filas (PRP-myvipers-006).
 *
 * Se llama a las RUTAS REALES y al servicio con la base de datos de staging. El envío es
 * SIMULADO (interruptor ACCOUNT_OTP_SEND_ENABLED apagado): ningún mensaje sale hacia Meta,
 * y la prueba falla si alguien intenta llamar a graph.facebook.com.
 *
 * SEGURIDAD: conexión SOLO de TEST_DATABASE_URL (rama de STAGING, con la 019 aplicada). Solo
 * crea y borra los negocios marcados d9…/da…/db…/dc…/dd… y los teléfonos …0000008x / …0000009x.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error('TEST_DATABASE_URL no está definida. Pásala apuntando a la rama de STAGING (no a producción).');
}

const PEPPER = 'clave-de-huellas-solo-para-pruebas-0123456789';
const state = vi.hoisted(() => {
  process.env.JWT_SECRET = 'clave-solo-para-pruebas-0123456789abcdef';
  process.env.OTP_PEPPER = 'clave-de-huellas-solo-para-pruebas-0123456789';
  process.env.ACCOUNT_GLOBAL_ENABLED = '1';
  delete process.env.ACCOUNT_OTP_SEND_ENABLED; // envío real APAGADO
  delete process.env.OTP_DAILY_CAP;
  return {
    session: null as unknown,
    codes: new Map<string, string>(),
    sends: [] as { e164: string; simulated: boolean }[],
    emails: [] as unknown[],
  };
});

vi.mock('@/shared/lib/db', async () => {
  const { neon: connect } = await import('@neondatabase/serverless');
  return { db: connect(process.env.TEST_DATABASE_URL!) };
});
vi.mock('@/shared/lib/auth', async (original) => ({
  ...(await original<typeof import('@/shared/lib/auth')>()),
  getSession: async () => state.session,
  setSessionCookie: async () => {},
}));
vi.mock('@/shared/lib/email', () => ({
  sendPasswordResetEmail: async (o: unknown) => { state.emails.push(o); return { ok: true }; },
  sendAgentHandoffEmail: async () => ({ ok: true }),
  sendOtpCapAlertEmail: async () => ({ ok: true }),
}));
// El envío es el de verdad (con el interruptor apagado → simulado); solo se apunta el código.
vi.mock('@/features/account/sender', async (original) => {
  const real = await original<typeof import('@/features/account/sender')>();
  return {
    ...real,
    defaultSender: () => async (e164: string, code: string) => {
      const result = await real.defaultSender()(e164, code);
      state.codes.set(e164, code);
      state.sends.push({ e164, simulated: result.simulated });
      return result;
    },
  };
});

import * as otpRequest from '@/app/api/account/otp/request/route';
import * as otpVerify from '@/app/api/account/otp/verify/route';
import * as login from '@/app/api/auth/login/route';
import * as forgot from '@/app/api/auth/forgot-password/route';
import * as reset from '@/app/api/auth/reset-password/route';
import { createResetToken } from '@/shared/lib/auth';
import { OTP_LIMITS } from '@/features/account/config';
import { codeHash, ipHash, phoneHash } from '@/features/account/hash';
import { LOCKED_PASSWORD_HASH } from '@/features/account/locked-password';
import { requestOtp, verifyOtpAndLink, type CapAlert } from '@/features/account/otp';
import type { OtpSender } from '@/features/account/sender';

const db = neon(url);

// Negocios: A y B en Perú, STAFF en Perú (solo personal), ES en España, SINPAIS sin país.
const T = {
  A: 'd9d9d9d9-0000-4000-8000-000000000009',
  B: 'dadadada-0000-4000-8000-00000000000a',
  STAFF: 'dbdbdbdb-0000-4000-8000-00000000000b',
  ES: 'dcdcdcdc-0000-4000-8000-00000000000c',
  SINPAIS: 'dddddddd-0000-4000-8000-00000000000d',
};
const TENANTS = Object.values(T);
const U = {
  clienteA: 'd9d9d9d9-0000-4000-8000-0000000000c1',   // la fila de la sesión
  otroA: 'd9d9d9d9-0000-4000-8000-0000000000c2',      // otro cliente, otro número
  adminA: 'd9d9d9d9-0000-4000-8000-0000000000a1',
  clienteB: 'dadadada-0000-4000-8000-0000000000c1',   // mismo número completo, otro negocio
  adminStaff: 'dbdbdbdb-0000-4000-8000-0000000000a1', // personal con el mismo número
  camareroStaff: 'dbdbdbdb-0000-4000-8000-0000000000a2',
  clienteES: 'dcdcdcdc-0000-4000-8000-0000000000c1',  // mismas 9 cifras, otro país
  clienteSinPais: 'dddddddd-0000-4000-8000-0000000000c1',
};
const N9 = '900000081';
const TEL = '+51900000081';
const TEL_ES = '+34900000081';
const TEL_OTRO = '+51900000082';
/** Teléfonos sin fila de usuario, para probar límites a nivel de servicio. */
const SUELTOS = Array.from({ length: 9 }, (_, i) => `+5190000009${i + 1}`);
const TELS = [TEL, TEL_ES, TEL_OTRO, ...SUELTOS];
const IPS = ['198.51.100.1', '198.51.100.2', '198.51.100.3', '198.51.100.4', '198.51.100.5', '198.51.100.6', '198.51.100.7', '198.51.100.8'];
const RELLENO = 'prueba-f2-relleno';
const CAP_PRUEBA = 10;
const CLAVE_B = 'clave-de-quien-registro-b';

const ph = (tel: string) => phoneHash(PEPPER, tel);
const ih = (ip: string) => ipHash(PEPPER, ip);

const post = (handler: (r: Request) => Promise<Response>, body: unknown, ip = IPS[0]) =>
  handler(new Request('http://test.local/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }));

const sesion = (userId: string, restaurantId: string, role: 'customer' | 'admin' | 'waiter' = 'customer') => {
  state.session = { userId, name: 'x', phone: N9, role, vipLevel: 'bronze', restaurantId, restaurantSlug: 'x' };
};
const sinSesion = () => { state.session = null; };

/** Envío falso para el servicio: apunta el código y dice «simulado». Nunca llama a nadie. */
const codigos = new Map<string, string>();
const envioPrueba: OtpSender = async (e164, code) => { codigos.set(e164, code); return { ok: true, simulated: true }; };
const pedir = (e164: string, ip = IPS[0], extra: Partial<Parameters<typeof requestOtp>[1]> = {}) =>
  requestOtp({ e164, ip }, { sender: envioPrueba, minResponseMs: 0, ...extra });

const fila = async (id: string) =>
  (await db`SELECT account_id, password_hash, must_change_password, sessions_valid_after FROM users WHERE id = ${id}`)[0];
const conCuenta = async () =>
  (await db`SELECT id FROM users WHERE account_id IS NOT NULL ORDER BY id`).map((r) => r.id as string);
const cuentas = async () => (await db`SELECT id, phone_e164 FROM customer_accounts WHERE phone_e164 = ANY(${TELS})`);
const otps = async (tel: string) =>
  await db`SELECT status, attempts, code_hash, sent_at, expires_at FROM phone_otp WHERE phone_hash = ${ph(tel)} ORDER BY id`;

/** Todo lo que NO puede cambiar al unir: puntos, negocio, movimientos, canjes y reservas. */
async function fotoDeDatos() {
  return {
    users: await db`SELECT id, restaurant_id, name, phone, email, role, vip_level, total_points, available_points, referral_code
                    FROM users WHERE restaurant_id = ANY(${TENANTS}) ORDER BY id`,
    movimientos: await db`SELECT user_id, restaurant_id, type, points, description FROM point_transactions
                          WHERE restaurant_id = ANY(${TENANTS}) ORDER BY user_id, description`,
    canjes: await db`SELECT user_id, restaurant_id, reward_id, points_spent FROM redemptions
                     WHERE restaurant_id = ANY(${TENANTS}) ORDER BY user_id`,
    reservas: await db`SELECT id, user_id, restaurant_id, date::text, time::text, party_size, status FROM reservations
                       WHERE restaurant_id = ANY(${TENANTS}) ORDER BY id`,
  };
}

async function limpiarCodigos() {
  await db`DELETE FROM phone_otp WHERE phone_hash = ANY(${TELS.map(ph)}) OR ip_hash = ANY(${IPS.map(ih)}) OR phone_hash LIKE ${RELLENO + '%'}`;
  await db`DELETE FROM account_events WHERE event LIKE 'otp_cap_%' AND (detail->>'cap')::int = ${CAP_PRUEBA}`;
}
async function limpiarCuentas() {
  await limpiarCodigos();
  await db`UPDATE users SET account_id = NULL, sessions_valid_after = NULL, data_consent_at = NULL, must_change_password = false
           WHERE restaurant_id = ANY(${TENANTS})`;
  await db`UPDATE users SET password_hash = 'x' WHERE restaurant_id = ANY(${TENANTS}) AND id <> ${U.clienteB}`;
  await db`UPDATE users SET password_hash = ${hashB} WHERE id = ${U.clienteB}`;
  await db`DELETE FROM account_events WHERE account_id IN (SELECT id FROM customer_accounts WHERE phone_e164 = ANY(${TELS}))`;
  await db`DELETE FROM customer_accounts WHERE phone_e164 = ANY(${TELS})`;
  state.codes.clear(); state.sends.length = 0; state.emails.length = 0; codigos.clear();
}
async function limpiarTodo() {
  await limpiarCuentas();
  for (const id of TENANTS) {
    await db`DELETE FROM redemptions WHERE restaurant_id = ${id}`;
    await db`DELETE FROM point_transactions WHERE restaurant_id = ${id}`;
    await db`DELETE FROM reservations WHERE restaurant_id = ${id}`;
    await db`DELETE FROM rewards WHERE restaurant_id = ${id}`;
    await db`DELETE FROM tables WHERE restaurant_id = ${id}`;
    await db`DELETE FROM users WHERE restaurant_id = ${id}`;
    await db`DELETE FROM restaurants WHERE id = ${id}`;
  }
}

let hashB = 'x';
const fetchReal = globalThis.fetch;

beforeAll(async () => {
  hashB = await bcrypt.hash(CLAVE_B, 4);
  // Cualquier intento de hablar con Meta rompe la prueba.
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const destino = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (destino.includes('facebook.com')) throw new Error('PROHIBIDO: la prueba intentó llamar a Meta');
    return fetchReal(input, init);
  }) as typeof fetch;

  await limpiarTodo();
  const negocio = (id: string, slug: string, country: string | null) =>
    db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
       VALUES (${id}, ${'ISO Código ' + slug}, ${slug}, 'restaurant', '["restaurant"]'::jsonb, true, 'PEN', ${country})`;
  await negocio(T.A, 'iso-otp-a', 'PE');
  await negocio(T.B, 'iso-otp-b', 'PE');
  await negocio(T.STAFF, 'iso-otp-staff', 'PE');
  await negocio(T.ES, 'iso-otp-es', 'ES');
  await negocio(T.SINPAIS, 'iso-otp-sinpais', null);

  const usuario = (id: string, name: string, phone: string, role: string, tenant: string, points: number, hash = 'x', email: string | null = null) =>
    db`INSERT INTO users (id, name, phone, email, password_hash, role, restaurant_id, total_points, available_points)
       VALUES (${id}, ${name}, ${phone}, ${email}, ${hash}, ${role}, ${tenant}, ${points}, ${points})`;
  await usuario(U.clienteA, 'Cliente en A', N9, 'customer', T.A, 100);
  await usuario(U.otroA, 'Otro cliente en A', '900000082', 'customer', T.A, 7);
  await usuario(U.adminA, 'Admin de A', '900000083', 'admin', T.A, 0);
  await usuario(U.clienteB, 'Quien registró B', N9, 'customer', T.B, 30, hashB, 'quien-registro-b@prueba.invalid');
  await usuario(U.adminStaff, 'Admin mismo número', N9, 'admin', T.STAFF, 0);
  await usuario(U.camareroStaff, 'Camarero', '900000084', 'waiter', T.STAFF, 0);
  await usuario(U.clienteES, 'Cliente en España', N9, 'customer', T.ES, 55);
  await usuario(U.clienteSinPais, 'Cliente sin país', N9, 'customer', T.SINPAIS, 12);

  for (const [user, tenant, puntos] of [[U.clienteA, T.A, 100], [U.clienteB, T.B, 30], [U.clienteES, T.ES, 55]] as const) {
    await db`INSERT INTO point_transactions (user_id, restaurant_id, type, points, description) VALUES (${user}, ${tenant}, 'earn', ${puntos}, ${'MOV-' + tenant.slice(0, 2)})`;
  }
  const premioB = 'dadadada-0000-4000-8000-0000000000e1';
  const mesaB = 'dadadada-0000-4000-8000-0000000000b1';
  await db`INSERT INTO rewards (id, name, points_cost, category, is_active, sort_order, restaurant_id) VALUES (${premioB}, 'PREMIO-DE-B', 10, 'discount', true, 1, ${T.B})`;
  await db`INSERT INTO redemptions (user_id, reward_id, points_spent, restaurant_id) VALUES (${U.clienteB}, ${premioB}, 10, ${T.B})`;
  await db`INSERT INTO tables (id, number, capacity, is_active, restaurant_id) VALUES (${mesaB}, 1, 4, true, ${T.B})`;
  await db`INSERT INTO reservations (id, user_id, restaurant_id, table_id, date, time, party_size, status)
           VALUES ('dadadada-0000-4000-8000-0000000000d1', ${U.clienteB}, ${T.B}, ${mesaB}, '2030-01-15', '20:00', 2, 'confirmed')`;
});
beforeEach(async () => { await limpiarCuentas(); sinSesion(); });
afterAll(async () => {
  await limpiarTodo();
  globalThis.fetch = fetchReal;
});

describe('interruptor general', () => {
  it('con ACCOUNT_GLOBAL_ENABLED apagado las rutas no existen y no se escribe nada', async () => {
    sesion(U.clienteA, T.A);
    delete process.env.ACCOUNT_GLOBAL_ENABLED;
    try {
      expect((await post(otpRequest.POST, { phone: TEL })).status).toBe(404);
      expect((await post(otpVerify.POST, { phone: TEL, code: '123456' })).status).toBe(404);
    } finally {
      process.env.ACCOUNT_GLOBAL_ENABLED = '1';
    }
    expect(await otps(TEL)).toEqual([]);
    expect(await conCuenta()).toEqual([]);
  });
});

describe('quién puede pedir un código', () => {
  it('sin sesión, o con sesión de personal, no se pide ni se comprueba nada', async () => {
    sinSesion();
    expect((await post(otpRequest.POST, { phone: TEL })).status).toBe(401);
    expect((await post(otpVerify.POST, { phone: TEL, code: '123456' })).status).toBe(401);
    sesion(U.adminStaff, T.STAFF, 'admin');
    expect((await post(otpRequest.POST, { phone: TEL })).status).toBe(403);
    sesion(U.camareroStaff, T.STAFF, 'waiter');
    expect((await post(otpRequest.POST, { phone: '+51900000084' })).status).toBe(403);
    // Sesión que dice «cliente» pero cuya fila es de personal: manda la base de datos.
    sesion(U.adminStaff, T.STAFF, 'customer');
    expect((await post(otpRequest.POST, { phone: TEL })).status).toBe(403);
    expect(await otps(TEL)).toEqual([]);
  });

  it('solo para el número de la propia fila: el de otro cliente se rechaza', async () => {
    sesion(U.clienteA, T.A);
    for (const phone of [TEL_OTRO, N9, '51900000081', 'hola']) {
      expect((await post(otpRequest.POST, { phone })).status, phone).toBe(400);
    }
    expect(await otps(TEL_OTRO)).toEqual([]);
    expect(state.sends).toEqual([]);
  });
});

describe('pedir y comprobar el código (rutas reales, envío simulado)', () => {
  it('REGLA CLAVE: pedir un código no une nada; sin verificar ninguna fila tiene cuenta', async () => {
    sesion(U.clienteA, T.A);
    const res = await post(otpRequest.POST, { phone: TEL });
    expect(res.status).toBe(200);
    expect(state.sends).toEqual([{ e164: TEL, simulated: true }]);
    expect(await conCuenta()).toEqual([]);
    expect(await cuentas()).toEqual([]);
  });

  it('en la base de datos no queda el código ni el teléfono, solo huellas; caduca a los 5 minutos', async () => {
    sesion(U.clienteA, T.A);
    await post(otpRequest.POST, { phone: TEL });
    const code = state.codes.get(TEL)!;
    expect(code).toMatch(/^[0-9]{6}$/);
    const todo = JSON.stringify(await db`SELECT * FROM phone_otp WHERE phone_hash = ${ph(TEL)}`);
    expect(todo).not.toContain(code);
    expect(todo).not.toContain(N9);
    const [o] = await db`SELECT status, code_hash, extract(epoch FROM (expires_at - created_at))::int AS vida FROM phone_otp WHERE phone_hash = ${ph(TEL)}`;
    expect(o).toMatchObject({ status: 'sent', code_hash: codeHash(PEPPER, TEL, code), vida: OTP_LIMITS.ttlMinutes * 60 });
  });

  it('código incorrecto: no entra, no crea cuenta y gasta un intento', async () => {
    sesion(U.clienteA, T.A);
    await post(otpRequest.POST, { phone: TEL });
    const malo = state.codes.get(TEL) === '000000' ? '111111' : '000000';
    const res = await post(otpVerify.POST, { phone: TEL, code: malo });
    expect(res.status).toBe(400);
    expect(await cuentas()).toEqual([]);
    expect(await conCuenta()).toEqual([]);
    expect((await otps(TEL))[0]).toMatchObject({ status: 'sent', attempts: 1 });
  });

  it('código correcto: crea la cuenta del número completo y une las filas que tocan', async () => {
    sesion(U.clienteA, T.A);
    await post(otpRequest.POST, { phone: TEL });
    const res = await post(otpVerify.POST, { phone: TEL, code: state.codes.get(TEL) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, businesses: 2 });

    const [cuenta] = await cuentas();
    expect(cuenta.phone_e164).toBe(TEL);
    // Se unen: la fila de la sesión (A) y la del mismo número completo en otro negocio de Perú (B).
    // NO se unen: personal con ese número, las mismas 9 cifras en España, el negocio sin país, otro número.
    expect(await conCuenta()).toEqual([U.clienteA, U.clienteB].sort());
    expect((await otps(TEL))[0]).toMatchObject({ status: 'verified', attempts: 1 });
  });

  it('usado dos veces: el segundo intento no vale', async () => {
    sesion(U.clienteA, T.A);
    await post(otpRequest.POST, { phone: TEL });
    const code = state.codes.get(TEL)!;
    expect((await verifyOtpAndLink({ e164: TEL, code, sessionUserId: U.clienteA })).ok).toBe(true);
    expect(await verifyOtpAndLink({ e164: TEL, code, sessionUserId: U.clienteA })).toEqual({ ok: false });
  });

  it('dos comprobaciones a la vez del mismo código: solo una entra', async () => {
    await pedir(TEL);
    const code = codigos.get(TEL)!;
    const r = await Promise.all([1, 2, 3].map(() => verifyOtpAndLink({ e164: TEL, code, sessionUserId: U.clienteA })));
    expect(r.filter((x) => x.ok).length).toBe(1);
    expect((await cuentas()).length).toBe(1);
  });

  it('caducado (más de 5 minutos): no vale aunque sea el correcto', async () => {
    sesion(U.clienteA, T.A);
    await post(otpRequest.POST, { phone: TEL });
    await db`UPDATE phone_otp SET expires_at = now() - interval '1 second' WHERE phone_hash = ${ph(TEL)}`;
    const res = await post(otpVerify.POST, { phone: TEL, code: state.codes.get(TEL) });
    expect(res.status).toBe(400);
    expect(await conCuenta()).toEqual([]);
  });

  it('5 intentos por código: al 6.º ya no vale ni el correcto, y el número queda bloqueado un rato', async () => {
    await pedir(TEL);
    const code = codigos.get(TEL)!;
    const malo = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < OTP_LIMITS.maxAttempts; i++) {
      expect(await verifyOtpAndLink({ e164: TEL, code: malo, sessionUserId: U.clienteA })).toEqual({ ok: false });
    }
    expect((await otps(TEL))[0]).toMatchObject({ status: 'expired', attempts: 5 });
    expect(await verifyOtpAndLink({ e164: TEL, code, sessionUserId: U.clienteA })).toEqual({ ok: false });
    expect(await conCuenta()).toEqual([]);

    // Bloqueo temporal: no se emite otro código para ese número…
    expect(await pedir(TEL)).toEqual({ status: 'blocked', reason: 'locked' });
    // …hasta que pasan los 15 minutos.
    await db`UPDATE phone_otp SET created_at = created_at - make_interval(mins => ${OTP_LIMITS.lockMinutes + 1}) WHERE phone_hash = ${ph(TEL)}`;
    expect(await pedir(TEL)).toEqual({ status: 'sent', simulated: true });
  });

  it('un código nuevo deja sin efecto el anterior', async () => {
    await pedir(TEL);
    const primero = codigos.get(TEL)!;
    await pedir(TEL);
    const segundo = codigos.get(TEL)!;
    if (primero !== segundo) expect(await verifyOtpAndLink({ e164: TEL, code: primero, sessionUserId: U.clienteA })).toEqual({ ok: false });
    expect((await verifyOtpAndLink({ e164: TEL, code: segundo, sessionUserId: U.clienteA })).ok).toBe(true);
  });

  it('el código de un número no sirve para otro', async () => {
    await pedir(TEL);
    await pedir(TEL_OTRO, IPS[1]);
    expect(await verifyOtpAndLink({ e164: TEL_OTRO, code: codigos.get(TEL)!, sessionUserId: U.otroA })).toEqual(
      codigos.get(TEL) === codigos.get(TEL_OTRO) ? expect.anything() : { ok: false });
    expect((await fila(U.otroA)).account_id).toBeNull();
  });
});

describe('la unión: qué filas, y qué les pasa', () => {
  const verificarComoA = async () => {
    await pedir(TEL);
    return verifyOtpAndLink({ e164: TEL, code: codigos.get(TEL)!, sessionUserId: U.clienteA });
  };

  it('no une personal, ni un número igual de otro país, ni el negocio sin país, ni otro número', async () => {
    expect(await verificarComoA()).toMatchObject({ ok: true, linked: 2, foreign: 1 });
    for (const id of [U.adminStaff, U.camareroStaff, U.adminA, U.clienteES, U.clienteSinPais, U.otroA]) {
      expect((await fila(id)).account_id, id).toBeNull();
    }
  });

  it('la fila de la sesión queda igual; la ajena pierde contraseña y sesiones', async () => {
    const antes = Date.now();
    await verificarComoA();
    const propia = await fila(U.clienteA);
    expect(propia).toMatchObject({ password_hash: 'x', must_change_password: false, sessions_valid_after: null });
    const ajena = await fila(U.clienteB);
    expect(ajena).toMatchObject({ password_hash: LOCKED_PASSWORD_HASH, must_change_password: true });
    expect(new Date(ajena.sessions_valid_after).getTime()).toBeGreaterThan(antes - 60_000);
  });

  it('GARANTÍA DE CONSERVACIÓN: puntos, negocio, movimientos, canjes y reservas quedan idénticos', async () => {
    const antes = await fotoDeDatos();
    expect(antes.movimientos.length).toBe(3);
    expect(antes.canjes.length).toBe(1);
    expect(antes.reservas.length).toBe(1);
    await verificarComoA();
    expect(await fotoDeDatos()).toEqual(antes);
  });

  it('el dueño verificado tiene sus dos negocios, con los puntos separados', async () => {
    const r = await verificarComoA();
    if (!r.ok) throw new Error('no verificó');
    const mios = await db`SELECT restaurant_id, available_points FROM users WHERE account_id = ${r.accountId} ORDER BY available_points`;
    expect(mios).toEqual([{ restaurant_id: T.B, available_points: 30 }, { restaurant_id: T.A, available_points: 100 }]);
  });

  it('quien registró la fila ajena ya no puede entrar: ni con su contraseña ni recuperándola por correo', async () => {
    const paseAntiguo = await createResetToken(U.clienteB, hashB);
    // Antes de la unión, su contraseña funciona.
    expect((await post(login.POST, { phone: N9, password: CLAVE_B, restaurantSlug: 'iso-otp-b' })).status).toBe(200);
    await verificarComoA();

    const entrar = await post(login.POST, { phone: N9, password: CLAVE_B, restaurantSlug: 'iso-otp-b' });
    expect(entrar.status).toBe(401);
    // Recuperar por correo: no se envía ningún enlace a esa fila.
    state.emails.length = 0;
    const recuperar = await post(forgot.POST, { phone: N9, restaurantSlug: 'iso-otp-b' });
    expect(await recuperar.json()).toEqual({ status: 'no_email' });
    expect(state.emails).toEqual([]);
    // Un pase de restablecer (antiguo o nuevo) tampoco sirve.
    for (const token of [paseAntiguo, await createResetToken(U.clienteB, LOCKED_PASSWORD_HASH)]) {
      expect((await post(reset.POST, { token, password: 'otra-clave-nueva' })).status).toBe(400);
    }
    expect((await fila(U.clienteB)).password_hash).toBe(LOCKED_PASSWORD_HASH);
  });

  it('las mismas 9 cifras con prefijo de España son OTRA cuenta y no tocan las filas de Perú', async () => {
    sesion(U.clienteES, T.ES);
    await post(otpRequest.POST, { phone: TEL_ES });
    const res = await post(otpVerify.POST, { phone: TEL_ES, code: state.codes.get(TEL_ES) });
    expect(await res.json()).toEqual({ success: true, businesses: 1 });
    expect(await conCuenta()).toEqual([U.clienteES]);
    expect((await cuentas()).map((c) => c.phone_e164)).toEqual([TEL_ES]);
  });

  it('el negocio sin país solo se une cuando el cliente entra en él y lo confirma', async () => {
    await verificarComoA();
    expect((await fila(U.clienteSinPais)).account_id).toBeNull();

    sesion(U.clienteSinPais, T.SINPAIS);
    await db`UPDATE phone_otp SET created_at = created_at - interval '2 hours' WHERE phone_hash = ${ph(TEL)}`;
    await post(otpRequest.POST, { phone: TEL });
    const res = await post(otpVerify.POST, { phone: TEL, code: state.codes.get(TEL) });
    expect(await res.json()).toEqual({ success: true, businesses: 1 });
    expect((await cuentas()).length).toBe(1); // la misma cuenta, no otra
    expect(await conCuenta()).toEqual([U.clienteA, U.clienteB, U.clienteSinPais].sort());
    // Su propia fila no pierde la contraseña.
    expect(await fila(U.clienteSinPais)).toMatchObject({ password_hash: 'x', must_change_password: false });
  });

  it('una fila ya unida no vuelve a pedir código', async () => {
    await verificarComoA();
    sesion(U.clienteA, T.A);
    const res = await post(otpRequest.POST, { phone: TEL });
    expect(await res.json()).toEqual({ alreadyVerified: true });
  });

  it('queda apuntado en el registro, sin nombres ni teléfonos', async () => {
    const r = await verificarComoA();
    if (!r.ok) throw new Error('no verificó');
    const ev = await db`SELECT event, detail FROM account_events WHERE account_id = ${r.accountId}`;
    expect(ev.length).toBe(1);
    expect(ev[0].event).toBe('verified');
    expect(ev[0].detail).toMatchObject({ rows_linked: 2, rows_foreign: 1 });
    const texto = JSON.stringify(ev);
    for (const dato of [N9, 'Cliente', 'Quien']) expect(texto).not.toContain(dato);
  });

  it('AISLAMIENTO: fuera de los negocios de la prueba no se toca ninguna fila', async () => {
    const fuera = () => db`SELECT md5(string_agg(md5(u::text), ',' ORDER BY u.id)) AS huella, count(*)::int AS n
                           FROM users u WHERE u.restaurant_id IS NULL OR NOT (u.restaurant_id = ANY(${TENANTS}))`;
    const [antes] = await fuera();
    await verificarComoA();
    expect((await fuera())[0]).toEqual(antes);
    expect(antes.n).toBeGreaterThan(0);
  });
});

describe('límites', () => {
  it('por número: 3 códigos por hora; el 4.º se bloquea', async () => {
    for (let i = 0; i < OTP_LIMITS.perPhoneHour; i++) expect((await pedir(TEL, IPS[i])).status).toBe('sent');
    expect(await pedir(TEL, IPS[5])).toEqual({ status: 'blocked', reason: 'phone_hour' });
    const filas = await otps(TEL);
    expect(filas.filter((f) => f.status !== 'blocked').length).toBe(3);
    // La petición bloqueada queda apuntada, sin código.
    expect(filas.at(-1)).toMatchObject({ status: 'blocked', code_hash: null, sent_at: null });
    // Otro número no se ve afectado.
    expect((await pedir(TEL_OTRO, IPS[6])).status).toBe('sent');
  });

  it('por número: 3 peticiones a la vez no se saltan el límite', async () => {
    const r = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => pedir(TEL, IPS[i])));
    expect(r.filter((x) => x.status === 'sent').length).toBe(OTP_LIMITS.perPhoneHour);
    expect(r.filter((x) => x.status === 'blocked').length).toBe(3);
  });

  it('por número: máximo diario de 8 aunque se repartan en varias horas', async () => {
    for (let i = 0; i < OTP_LIMITS.perPhoneDay; i++) {
      await db`INSERT INTO phone_otp (phone_hash, ip_hash, purpose, status, created_at)
               VALUES (${ph(TEL)}, ${ih(IPS[7])}, 'verify', 'expired', now() - make_interval(hours => ${2 + i}))`;
    }
    expect(await pedir(TEL)).toEqual({ status: 'blocked', reason: 'phone_day' });
    // Pasadas las 24 h vuelve a poder.
    await db`UPDATE phone_otp SET created_at = created_at - interval '24 hours' WHERE phone_hash = ${ph(TEL)}`;
    expect((await pedir(TEL)).status).toBe('sent');
  });

  it('por conexión: 20 peticiones por hora, y las bloqueadas no llenan la tabla', async () => {
    for (let i = 0; i < OTP_LIMITS.perIpHour; i++) {
      await db`INSERT INTO phone_otp (phone_hash, ip_hash, purpose, status) VALUES (${RELLENO + '-ip-' + i}, ${ih(IPS[2])}, 'verify', 'expired')`;
    }
    expect(await pedir(SUELTOS[0], IPS[2])).toEqual({ status: 'blocked', reason: 'ip_hour' });
    expect(await pedir(SUELTOS[1], IPS[2])).toEqual({ status: 'blocked', reason: 'ip_hour' });
    expect(await otps(SUELTOS[0])).toEqual([]);
    const [{ n }] = await db`SELECT count(*)::int AS n FROM phone_otp WHERE ip_hash = ${ih(IPS[2])}`;
    expect(n).toBe(OTP_LIMITS.perIpHour);
    // Desde otra conexión, ese mismo número sí puede.
    expect((await pedir(SUELTOS[0], IPS[3])).status).toBe('sent');
  });

  it('tope global diario con alerta al 80 % y al alcanzarlo (una vez cada una)', async () => {
    const [{ n: hoy }] = await db`SELECT count(*)::int AS n FROM phone_otp WHERE status <> 'blocked' AND created_at >= date_trunc('day', now())`;
    if (hoy > 7) throw new Error(`staging tiene ${hoy} códigos de hoy ajenos a la prueba; límpialos antes de probar el tope`);
    for (let i = hoy; i < 7; i++) {
      await db`INSERT INTO phone_otp (phone_hash, purpose, status) VALUES (${RELLENO + '-tope-' + i}, 'verify', 'expired')`;
    }
    const alertas: CapAlert[] = [];
    const conTope = { env: { ...process.env, OTP_DAILY_CAP: String(CAP_PRUEBA) }, alert: async (a: CapAlert) => { alertas.push(a); } };

    expect((await pedir(SUELTOS[0], IPS[0], conTope)).status).toBe('sent');   // 8 de 10 → aviso del 80 %
    expect(alertas).toMatchObject([{ level: 'warning', count: 8, cap: CAP_PRUEBA }]);
    expect((await pedir(SUELTOS[1], IPS[1], conTope)).status).toBe('sent');   // 9 de 10 → sin aviso nuevo
    expect(alertas.length).toBe(1);
    expect((await pedir(SUELTOS[2], IPS[2], conTope)).status).toBe('sent');   // 10 de 10 → tope alcanzado
    expect(alertas[1]).toMatchObject({ level: 'reached', count: 10, cap: CAP_PRUEBA });
    expect(await pedir(SUELTOS[3], IPS[3], conTope)).toEqual({ status: 'blocked', reason: 'global_day' });
    expect(await pedir(SUELTOS[4], IPS[4], conTope)).toEqual({ status: 'blocked', reason: 'global_day' });
    expect(alertas.length).toBe(2);

    const apuntes = await db`SELECT event FROM account_events WHERE event LIKE 'otp_cap_%' AND (detail->>'cap')::int = ${CAP_PRUEBA} ORDER BY event`;
    expect(apuntes.map((a) => a.event)).toEqual(['otp_cap_100', 'otp_cap_80']);
  });

  it('si el aviso por correo falla, la petición sigue adelante', async () => {
    const [{ n: hoy }] = await db`SELECT count(*)::int AS n FROM phone_otp WHERE status <> 'blocked' AND created_at >= date_trunc('day', now())`;
    for (let i = hoy; i < 7; i++) await db`INSERT INTO phone_otp (phone_hash, purpose, status) VALUES (${RELLENO + '-tope-' + i}, 'verify', 'expired')`;
    const r = await pedir(SUELTOS[5], IPS[5], { env: { ...process.env, OTP_DAILY_CAP: String(CAP_PRUEBA) }, alert: async () => { throw new Error('correo caído'); } });
    expect(r.status).toBe('sent');
  });

  it('si el envío falla, el código queda como fallido y no se puede usar', async () => {
    let code = '';
    const r = await requestOtp({ e164: TEL, ip: IPS[0] }, { minResponseMs: 0, sender: async (_t, c) => { code = c; return { ok: false, simulated: false, error: 'Meta caído' }; } });
    expect(r).toEqual({ status: 'failed' });
    expect((await otps(TEL))[0]).toMatchObject({ status: 'failed', sent_at: null });
    expect(await verifyOtpAndLink({ e164: TEL, code, sessionUserId: U.clienteA })).toEqual({ ok: false });
  });

  it('los registros de más de 30 días se borran solos', async () => {
    await db`INSERT INTO phone_otp (phone_hash, purpose, status, created_at) VALUES (${RELLENO + '-viejo'}, 'verify', 'expired', now() - interval '31 days')`;
    await db`INSERT INTO phone_otp (phone_hash, purpose, status, created_at) VALUES (${RELLENO + '-reciente'}, 'verify', 'expired', now() - interval '29 days')`;
    await pedir(TEL);
    const quedan = await db`SELECT phone_hash FROM phone_otp WHERE phone_hash LIKE ${RELLENO + '-%'} ORDER BY phone_hash`;
    expect(quedan.map((q) => q.phone_hash)).toEqual([RELLENO + '-reciente']);
  });
});

describe('la respuesta no revela nada', () => {
  it('misma respuesta y misma duración se envíe o se bloquee', async () => {
    sesion(U.clienteA, T.A);
    const medir = async () => {
      const t = Date.now();
      const res = await post(otpRequest.POST, { phone: TEL });
      return { ms: Date.now() - t, status: res.status, body: await res.json() };
    };
    const enviado = await medir();
    // Se agota el límite por hora y se vuelve a pedir: ahora se bloquea.
    for (let i = 1; i < OTP_LIMITS.perPhoneHour; i++) await pedir(TEL, IPS[i]);
    const bloqueado = await medir();

    expect(state.sends.length).toBe(1); // el segundo NO se envió
    expect((await otps(TEL)).at(-1)).toMatchObject({ status: 'blocked' });
    expect(bloqueado.status).toBe(enviado.status);
    expect(bloqueado.body).toEqual(enviado.body);
    for (const m of [enviado, bloqueado]) expect(m.ms).toBeGreaterThanOrEqual(OTP_LIMITS.minResponseMs - 20);
    expect(Math.abs(enviado.ms - bloqueado.ms)).toBeLessThan(600);
  });
});
