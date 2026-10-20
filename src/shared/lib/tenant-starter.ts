import { db } from '@/shared/lib/db';
import { getVertical } from '@/shared/lib/verticals';

/**
 * Consultas que crean el kit de inicio de un negocio recién dado de alta (mesas y
 * recompensas según su vertical). Se devuelven SIN ejecutar para meterlas en la misma
 * `db.transaction` que crea el negocio y su admin: o se crea todo o nada.
 */
export function starterKitQueries(restaurantId: string, businessType: string) {
    const kit = getVertical(businessType)?.starter;
    if (!kit) return [];

    const queries = [];
    if (kit.tables > 0) {
        queries.push(db`
            INSERT INTO tables (restaurant_id, number, capacity)
            SELECT ${restaurantId}, n, 4 FROM generate_series(1, ${kit.tables}::int) AS n
        `);
    }
    kit.rewards.forEach((r, i) => {
        queries.push(db`
            INSERT INTO rewards (restaurant_id, name, description, points_cost, category, sort_order)
            VALUES (${restaurantId}, ${r.name}, ${r.description}, ${r.points_cost}, ${r.category}, ${i + 1})
        `);
    });
    return queries;
}
