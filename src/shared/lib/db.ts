import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Inicialización PEREZOSA del cliente Neon.
//
// `neon(connectionString)` valida la cadena de conexión en el acto y lanza si
// falta. Si instanciáramos el cliente en la evaluación del módulo (top-level),
// `next build` reventaría en la fase "Collecting page data": esa fase evalúa
// cada módulo de ruta que importa `db` SIN que DATABASE_URL tenga por qué estar
// disponible, y un throw ahí aborta el build entero → no se despliega nada y el
// sitio "no carga". Difiriendo la creación al primer uso real (una query en
// tiempo de request), el import es libre de efectos y el build no toca la BD.
let client: NeonQueryFunction<false, false> | null = null;

function getClient(): NeonQueryFunction<false, false> {
    if (!client) {
        const url = process.env.DATABASE_URL;
        if (!url) {
            throw new Error('DATABASE_URL no está definida');
        }
        client = neon(url);
    }
    return client;
}

// Proxy que preserva el uso como tagged template (`db\`SELECT ...\``) y también
// el acceso a métodos del cliente (p. ej. `db.transaction(...)`), delegando todo
// al cliente creado perezosamente.
export const db: NeonQueryFunction<false, false> = new Proxy(
    function () {} as unknown as NeonQueryFunction<false, false>,
    {
        apply(_target, _thisArg, args: unknown[]) {
            return (getClient() as unknown as (...a: unknown[]) => unknown)(...args);
        },
        get(_target, prop: string | symbol) {
            const value = (getClient() as unknown as Record<string | symbol, unknown>)[prop];
            return typeof value === 'function' ? value.bind(getClient()) : value;
        },
    },
);
