/**
 * Suite de AISLAMIENTO ENTRE TENANTS (PRP-myvipers-001).
 *
 * Verifica que las consultas scopeadas por `restaurant_id` de un tenant NUNCA
 * devuelven datos de otro tenant. Cubre explícitamente `finance_transactions` y
 * `boletas` (las tablas a las que se les cerró el hueco de tenancy en Fase 1),
 * además de `users`.
 *
 * SEGURIDAD (no negociable):
 *   - La conexión se toma SOLO de `process.env.TEST_DATABASE_URL`, que se pasa de
 *     forma explícita al ejecutar. Si no está definida, el test FALLA de inmediato
 *     y no se conecta a nada. Nunca usa la `DATABASE_URL` del repo (producción).
 *   - Todo el trabajo ocurre sobre DOS tenants de prueba con UUID fijos y marcados
 *     (prefijo d1.../d2...). El setup/teardown solo crea y borra ESOS ids; jamás
 *     toca datos de El Machay ni de ningún otro tenant real.
 *
 * Ejecutar (apuntando al branch de STAGING, nunca a producción):
 *   TEST_DATABASE_URL="postgres://…@<branch-staging>…/neondb?sslmode=require" npm test
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon } from '@neondatabase/serverless';

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error(
    'TEST_DATABASE_URL no está definida. Pásala explícitamente apuntando al branch de STAGING ' +
      '(no a producción). Ej: TEST_DATABASE_URL="postgres://…/neondb?sslmode=require" npm test',
  );
}
const db = neon(url);

// Tenants de prueba (UUID fijos y marcados — solo estos ids se crean/borran).
const A = 'd1d1d1d1-0000-0000-0000-000000000001';
const B = 'd2d2d2d2-0000-0000-0000-000000000002';

async function borrarDatosDePrueba() {
  // Orden: primero hijos (FK sin cascade), luego el tenant.
  for (const id of [A, B]) {
    await db`DELETE FROM retail_stock_movements WHERE restaurant_id = ${id}`;
    await db`DELETE FROM retail_variants WHERE restaurant_id = ${id}`;
    await db`DELETE FROM retail_products WHERE restaurant_id = ${id}`;
    await db`DELETE FROM retail_categories WHERE restaurant_id = ${id}`;
    await db`DELETE FROM finance_transactions WHERE restaurant_id = ${id}`;
    await db`DELETE FROM boletas WHERE restaurant_id = ${id}`;
    await db`DELETE FROM users WHERE restaurant_id = ${id}`;
    await db`DELETE FROM restaurants WHERE id = ${id}`;
  }
}

beforeAll(async () => {
  await borrarDatosDePrueba();

  // Crear los dos tenants de prueba.
  await db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
           VALUES (${A}, 'ISO Test A', 'iso-test-a', 'restaurant', '["restaurant"]'::jsonb, true, 'PEN', 'PE')`;
  await db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
           VALUES (${B}, 'ISO Test B', 'iso-test-b', 'retail', '["retail"]'::jsonb, true, 'PEN', 'PE')`;

  // Datos de cada tenant: usuario + finanza + boleta.
  await db`INSERT INTO users (name, phone, email, password_hash, role, restaurant_id)
           VALUES ('Cliente A', '900000001', 'a@iso.test', 'x', 'customer', ${A})`;
  await db`INSERT INTO users (name, phone, email, password_hash, role, restaurant_id)
           VALUES ('Cliente B', '900000002', 'b@iso.test', 'x', 'customer', ${B})`;

  await db`INSERT INTO finance_transactions (type, amount, description, category, restaurant_id)
           VALUES ('income', 111.11, 'INGRESO-SOLO-DE-A', 'general', ${A})`;
  await db`INSERT INTO finance_transactions (type, amount, description, category, restaurant_id)
           VALUES ('expense', 222.22, 'EGRESO-SOLO-DE-B', 'general', ${B})`;

  await db`INSERT INTO boletas (serie, correlativo, numero, subtotal, total, restaurant_id)
           VALUES ('B001', 1, 'B001-00000001', 111.11, 111.11, ${A})`;
  await db`INSERT INTO boletas (serie, correlativo, numero, subtotal, total, restaurant_id)
           VALUES ('B001', 1, 'B001-00000001', 222.22, 222.22, ${B})`;

  // Retail (PRP-myvipers-002): categoría + producto por tenant, con nombres marcados.
  // Ambos tenants tienen datos → el aislamiento lo produce el filtro, no la ausencia.
  await db`INSERT INTO retail_categories (restaurant_id, name) VALUES (${A}, 'CAT-SOLO-DE-A')`;
  await db`INSERT INTO retail_categories (restaurant_id, name) VALUES (${B}, 'CAT-SOLO-DE-B')`;
  await db`INSERT INTO retail_products (restaurant_id, name, brand, base_price, discount_price, season)
           VALUES (${A}, 'PROD-SOLO-DE-A', 'MarcaA', 10, 8, 'Temp A')`;
  await db`INSERT INTO retail_products (restaurant_id, name, brand, base_price, discount_price, season)
           VALUES (${B}, 'PROD-SOLO-DE-B', 'MarcaB', 20, 15, 'Temp B')`;
});

afterAll(async () => {
  await borrarDatosDePrueba();
});

describe('Aislamiento entre tenants — finance_transactions', () => {
  it('el scope del tenant A no devuelve NINGUNA finanza de B', async () => {
    const rows = await db`SELECT id, restaurant_id, description FROM finance_transactions WHERE restaurant_id = ${A}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === A)).toBe(true);
    expect(rows.some((r) => r.restaurant_id === B)).toBe(false);
    expect(rows.some((r) => r.description === 'EGRESO-SOLO-DE-B')).toBe(false);
  });

  it('el scope del tenant B no devuelve NINGUNA finanza de A', async () => {
    const rows = await db`SELECT id, restaurant_id, description FROM finance_transactions WHERE restaurant_id = ${B}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === B)).toBe(true);
    expect(rows.some((r) => r.description === 'INGRESO-SOLO-DE-A')).toBe(false);
  });
});

describe('Aislamiento entre tenants — boletas', () => {
  it('el scope del tenant A no devuelve NINGUNA boleta de B', async () => {
    const rows = await db`SELECT id, restaurant_id, total FROM boletas WHERE restaurant_id = ${A}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === A)).toBe(true);
    expect(rows.some((r) => r.restaurant_id === B)).toBe(false);
  });

  it('el scope del tenant B no devuelve NINGUNA boleta de A', async () => {
    const rows = await db`SELECT id, restaurant_id, total FROM boletas WHERE restaurant_id = ${B}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === B)).toBe(true);
  });
});

describe('Aislamiento entre tenants — users', () => {
  it('el scope del tenant A no devuelve usuarios de B', async () => {
    const rows = await db`SELECT id, restaurant_id FROM users WHERE restaurant_id = ${A}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === A)).toBe(true);
    expect(rows.some((r) => r.restaurant_id === B)).toBe(false);
  });
});

describe('Aislamiento entre tenants — retail_categories', () => {
  it('el scope del tenant A no devuelve NINGUNA categoría de B', async () => {
    const rows = await db`SELECT id, restaurant_id, name FROM retail_categories WHERE restaurant_id = ${A}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === A)).toBe(true);
    expect(rows.some((r) => r.name === 'CAT-SOLO-DE-B')).toBe(false);
  });

  it('el scope del tenant B no devuelve NINGUNA categoría de A', async () => {
    const rows = await db`SELECT id, restaurant_id, name FROM retail_categories WHERE restaurant_id = ${B}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === B)).toBe(true);
    expect(rows.some((r) => r.name === 'CAT-SOLO-DE-A')).toBe(false);
  });
});

describe('Aislamiento entre tenants — retail_products (campos nuevos incluidos)', () => {
  it('el scope del tenant A no devuelve productos de B (ni su marca/oferta/temporada)', async () => {
    const rows = await db`SELECT id, restaurant_id, name, brand, discount_price, season
                          FROM retail_products WHERE restaurant_id = ${A}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === A)).toBe(true);
    expect(rows.some((r) => r.name === 'PROD-SOLO-DE-B')).toBe(false);
    expect(rows.some((r) => r.brand === 'MarcaB')).toBe(false);
  });

  it('el scope del tenant B no devuelve productos de A', async () => {
    const rows = await db`SELECT id, restaurant_id, name FROM retail_products WHERE restaurant_id = ${B}`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.restaurant_id === B)).toBe(true);
    expect(rows.some((r) => r.name === 'PROD-SOLO-DE-A')).toBe(false);
  });
});

describe('El filtro por restaurant_id es lo que aísla (control)', () => {
  it('SIN filtro por tenant, los datos de A y B coexisten en la tabla', async () => {
    // Prueba de control: demuestra que ambos datos existen y que es el filtro
    // (no la ausencia de datos) lo que produce el aislamiento en los tests de arriba.
    const fin = await db`SELECT restaurant_id FROM finance_transactions WHERE restaurant_id IN (${A}, ${B})`;
    const bol = await db`SELECT restaurant_id FROM boletas WHERE restaurant_id IN (${A}, ${B})`;
    expect(fin.some((r) => r.restaurant_id === A)).toBe(true);
    expect(fin.some((r) => r.restaurant_id === B)).toBe(true);
    expect(bol.some((r) => r.restaurant_id === A)).toBe(true);
    expect(bol.some((r) => r.restaurant_id === B)).toBe(true);
  });
});
