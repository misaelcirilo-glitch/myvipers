import { defineConfig } from 'vitest/config';

// Runner de tests. Entorno Node (los tests hablan con Postgres/Neon vía HTTP).
// IMPORTANTE: NO cargamos ningún archivo .env aquí a propósito, para que el test
// NUNCA tome por accidente la DATABASE_URL de producción del repo. La conexión se
// pasa SIEMPRE de forma explícita por la variable TEST_DATABASE_URL al ejecutar.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Sin globales; se importan desde 'vitest' en cada archivo.
    globals: false,
    // Un solo hilo: los tests comparten datos semilla en la BD de staging.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
