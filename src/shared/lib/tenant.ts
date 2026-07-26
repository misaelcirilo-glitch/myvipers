import { db } from './db';
import type { Session } from './auth';

/**
 * Base multivertical (PRP-myvipers-001, Fase 1).
 * El tenant es la fila de `restaurants`; su id viaja en `session.restaurantId`.
 * Estos helpers centralizan la lectura de la vertical/módulos de un tenant y
 * el acceso consistente al `restaurantId` para inyectarlo en queries.
 */

export interface TenantConfig {
    businessType: string;
    enabledModules: string[];
}

/**
 * Lee la vertical (`business_type`) y los módulos habilitados (`enabled_modules`)
 * de un tenant. Retrocompatible: si faltara la fila, devuelve el default
 * 'restaurant' con el módulo 'restaurant'.
 */
export async function getTenantConfig(restaurantId: string): Promise<TenantConfig> {
    const rows = await db`
        SELECT business_type, enabled_modules
        FROM restaurants
        WHERE id = ${restaurantId}
        LIMIT 1
    `;

    if (rows.length === 0) {
        return { businessType: 'restaurant', enabledModules: ['restaurant'] };
    }

    const row = rows[0];
    // enabled_modules es jsonb; el driver lo devuelve ya parseado (array).
    const enabledModules = Array.isArray(row.enabled_modules)
        ? (row.enabled_modules as string[])
        : ['restaurant'];

    return {
        businessType: (row.business_type as string) || 'restaurant',
        enabledModules,
    };
}

// `hasModule` se movió a `./modules` (client-safe, sin importar la BD): los
// componentes cliente lo importan desde allí para no arrastrar `neon()` al bundle.

/**
 * Extrae el `restaurantId` de la sesión de forma consistente, para inyectarlo
 * en las queries multitenant. El aislamiento es a nivel de app (no hay RLS):
 * toda query debe filtrar/asignar por este valor.
 */
export function tenantId(session: Session): string {
    return session.restaurantId;
}
