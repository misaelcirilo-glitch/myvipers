/**
 * Helpers de módulos multivertical — SIN dependencias de servidor.
 *
 * IMPORTANTE: este archivo NO debe importar `db`/`neon` ni nada server-only.
 * Lo consumen componentes cliente ('use client': layout, carta, reservar, admin).
 * Si arrastrara el cliente Neon al bundle del navegador, `neon()` se evaluaría en
 * el cliente sin DATABASE_URL y rompería la página con:
 *   "No database connection string was provided to `neon()`".
 * Por eso `hasModule` vive aquí, separado de `tenant.ts` (que sí toca la BD).
 */
export function hasModule(enabledModules: string[], module: string): boolean {
    return enabledModules.includes(module);
}
