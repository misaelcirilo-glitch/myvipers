/**
 * E2E RETAIL (PRP-myvipers-002) — flujo completo sobre un tenant retail desechable.
 *
 * Ejercita, tal como lo hace la app, el ciclo: categoría jerárquica → producto con
 * marca/oferta/temporada/foto y ejes → variantes de los 3 tipos (ropa/calzado/accesorio)
 * → movimientos de stock (misma CTE atómica del endpoint) → promoción del core.
 *
 * Conexión SOLO desde TEST_DATABASE_URL (branch de STAGING). Ver cabecera de
 * tenant-isolation.test.ts. Trabaja sobre un UUID marcado (e3...) y hace teardown.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon } from '@neondatabase/serverless';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL no definida (apunta al branch de STAGING).');
const db = neon(url);

const T = 'e3e3e3e3-0000-0000-0000-000000000003';

// Réplica de la CTE atómica de src/app/api/admin/retail/stock/route.ts.
async function moveStock(variantId: string, delta: number, type: 'entrada' | 'salida' | 'ajuste') {
  const rows = await db`
    WITH mv AS (
      UPDATE retail_variants SET stock = stock + ${delta}
      WHERE id = ${variantId} AND restaurant_id = ${T} AND is_active = true AND stock + ${delta} >= 0
      RETURNING id, stock
    ), ins AS (
      INSERT INTO retail_stock_movements (restaurant_id, variant_id, type, quantity)
      SELECT ${T}, id, ${type}, ${delta} FROM mv RETURNING id, variant_id
    )
    SELECT mv.stock AS new_stock FROM ins JOIN mv ON mv.id = ins.variant_id`;
  return rows[0]?.new_stock ?? null;
}

async function limpiar() {
  await db`DELETE FROM retail_stock_movements WHERE restaurant_id = ${T}`;
  await db`DELETE FROM retail_variants WHERE restaurant_id = ${T}`;
  await db`DELETE FROM retail_products WHERE restaurant_id = ${T}`;
  await db`DELETE FROM retail_categories WHERE restaurant_id = ${T}`;
  await db`DELETE FROM promotions WHERE restaurant_id = ${T}`;
  await db`DELETE FROM restaurants WHERE id = ${T}`;
}

beforeAll(async () => {
  await limpiar();
  await db`INSERT INTO restaurants (id, name, slug, business_type, enabled_modules, is_active, currency, country)
           VALUES (${T}, 'E2E Retail', 'e2e-retail', 'retail', '["retail"]'::jsonb, true, 'PEN', 'PE')`;
});

afterAll(async () => { await limpiar(); });

describe('E2E retail — catálogo, variantes de 3 tipos, stock y promo del core', () => {
  it('categoría jerárquica: Polos cuelga de Ropa', async () => {
    const [root] = await db`INSERT INTO retail_categories (restaurant_id, name) VALUES (${T}, 'Ropa') RETURNING id`;
    const [child] = await db`INSERT INTO retail_categories (restaurant_id, name, parent_id) VALUES (${T}, 'Polos', ${root.id}) RETURNING id`;
    const join = await db`
      SELECT c.name AS categoria, parent.name AS padre
      FROM retail_categories c LEFT JOIN retail_categories parent ON parent.id = c.parent_id
      WHERE c.id = ${child.id}`;
    expect(join[0].categoria).toBe('Polos');
    expect(join[0].padre).toBe('Ropa');
  });

  it('producto enriquecido: marca, oferta, temporada, foto y categoría se guardan y se leen con join', async () => {
    const [cat] = await db`SELECT id FROM retail_categories WHERE restaurant_id = ${T} AND name = 'Polos'`;
    const [p] = await db`
      INSERT INTO retail_products (restaurant_id, name, category_id, brand, base_price, discount_price, season, image_url, axis1_label, axis2_label)
      VALUES (${T}, 'Polo Premium', ${cat.id}, 'North Peak', 79.90, 59.90, 'Verano 2026', 'https://x.public.blob.vercel-storage.com/retail/foo.jpg', 'Talla', 'Color')
      RETURNING id`;
    const rows = await db`
      SELECT p.name, p.brand, p.base_price, p.discount_price, p.season, p.image_url, c.name AS category_name
      FROM retail_products p LEFT JOIN retail_categories c ON c.id = p.category_id
      WHERE p.id = ${p.id}`;
    const r = rows[0];
    expect(r.brand).toBe('North Peak');
    expect(Number(r.discount_price)).toBe(59.9);
    expect(r.season).toBe('Verano 2026');
    expect(r.category_name).toBe('Polos');
    expect(String(r.image_url)).toContain('blob.vercel-storage.com');
  });

  it('variantes de los 3 tipos usan la misma estructura (size/color como slots)', async () => {
    const [ropa] = await db`SELECT id FROM retail_products WHERE restaurant_id = ${T} AND name = 'Polo Premium'`;
    const [calz] = await db`INSERT INTO retail_products (restaurant_id, name, base_price, axis1_label, axis2_label)
                            VALUES (${T}, 'Zapatilla', 199, 'Numeración', 'Color') RETURNING id`;
    const [acc]  = await db`INSERT INTO retail_products (restaurant_id, name, base_price, axis1_label, axis2_label)
                            VALUES (${T}, 'Correa', 49, NULL, NULL) RETURNING id`;
    await db`INSERT INTO retail_variants (restaurant_id, product_id, size, color, stock) VALUES (${T}, ${ropa.id}, 'M', 'Rojo', 0)`;
    await db`INSERT INTO retail_variants (restaurant_id, product_id, size, color, stock) VALUES (${T}, ${calz.id}, '42', 'Negro', 0)`;
    await db`INSERT INTO retail_variants (restaurant_id, product_id, size, color, stock) VALUES (${T}, ${acc.id}, NULL, NULL, 0)`;

    const all = await db`
      SELECT p.axis1_label, v.size AS eje1, v.color AS eje2
      FROM retail_products p JOIN retail_variants v ON v.product_id = p.id
      WHERE p.restaurant_id = ${T} ORDER BY p.name`;
    // Correa (sin ejes), Polo Premium (Talla=M), Zapatilla (Numeración=42)
    expect(all.find((x) => x.axis1_label === 'Numeración')?.eje1).toBe('42');
    expect(all.find((x) => x.axis1_label === 'Talla')?.eje1).toBe('M');
    expect(all.some((x) => x.axis1_label === null && x.eje1 === null)).toBe(true);
  });

  it('stock: +10, +5, -3 → 12 (CTE atómica, guard anti-negativo)', async () => {
    const [ropa] = await db`SELECT id FROM retail_products WHERE restaurant_id = ${T} AND name = 'Polo Premium'`;
    const [v] = await db`SELECT id FROM retail_variants WHERE product_id = ${ropa.id} LIMIT 1`;
    expect(await moveStock(v.id, 10, 'entrada')).toBe(10);
    expect(await moveStock(v.id, 5, 'entrada')).toBe(15);
    expect(await moveStock(v.id, -3, 'salida')).toBe(12);
    // Guard: una salida mayor al stock no aplica (devuelve null, no negativo).
    expect(await moveStock(v.id, -999, 'salida')).toBe(null);
    const [after] = await db`SELECT stock FROM retail_variants WHERE id = ${v.id}`;
    expect(after.stock).toBe(12);
  });

  it('promoción del core opera para el tenant retail (scope + vigencia)', async () => {
    await db`INSERT INTO promotions (title, restaurant_id, is_active, valid_from, valid_until, min_points)
             VALUES ('2x1 Polos', ${T}, true, CURRENT_DATE - 1, CURRENT_DATE + 30, 100)`;
    const activas = await db`
      SELECT title FROM promotions
      WHERE restaurant_id = ${T} AND is_active = true
        AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)`;
    expect(activas.some((r) => r.title === '2x1 Polos')).toBe(true);
  });
});
