/**
 * Cuenta/tenant de DEMO para vendedores — AISLADO de datos reales.
 *
 * El admin demo (teléfono DEMO_PHONE) pertenece al tenant "Restaurante Demo"
 * (id d0000000-…-0001), con datos ficticios sembrados. `/api/demo-login` entra
 * como ese admin, así los vendedores muestran el producto sin tocar clientes
 * reales (p.ej. El Machay). Este archivo NO importa `db` ni nada server-only,
 * para poder usarse también desde el panel (componente cliente).
 */
export const DEMO_PHONE = '999000000';
