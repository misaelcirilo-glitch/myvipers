/**
 * Config de VERTICALES (tipos de negocio) de MyVipers — SIN dependencias de servidor.
 *
 * Fuente de verdad de qué tipos de negocio existen y qué módulos trae cada uno.
 * La consume el onboarding (formulario público + aprobación) y componentes cliente,
 * así que NO debe importar `db`/`neon` ni nada server-only (misma regla que modules.ts).
 *
 * Añadir un vertical nuevo = añadir una entrada aquí (+ construir su módulo). El
 * onboarding lo ofrece solo; la aprobación activa sus módulos. Nada hardcodeado.
 */

/** Categorías que admite rewards.category (CHECK en BD). */
export type RewardCategory = "discount" | "free_item" | "experience" | "merchandise";

export interface StarterReward {
    name: string;
    description: string;
    points_cost: number;
    category: RewardCategory;
}

/**
 * Lo que se crea junto con el negocio en su alta (por cualquier vía: /crear-restaurante
 * o aprobación de /registrar-negocio) para que nunca empiece vacío. El dueño luego lo
 * edita desde su panel.
 */
export interface StarterKit {
    /** Mesas 1..N (solo verticales con sala; 0 = sin mesas). */
    tables: number;
    /** Recompensas iniciales del programa de puntos (al menos una). */
    rewards: StarterReward[];
}

export interface VerticalPreset {
    /** Discriminador guardado en restaurants.business_type. */
    type: string;
    /** Etiqueta mostrada en el selector de onboarding. */
    label: string;
    /** Módulos por defecto para este tipo → restaurants.enabled_modules al aprobar. */
    modules: string[];
    /** Si se ofrece actualmente en el onboarding público. */
    enabled: boolean;
    /** Kit de inicio que se crea en el alta. Obligatorio: lo comprueba verticals.test.ts. */
    starter: StarterKit;
}

export const VERTICALS: VerticalPreset[] = [
    {
        type: "restaurant",
        label: "Restaurante",
        modules: ["restaurant"],
        enabled: true,
        starter: {
            tables: 5,
            rewards: [
                { name: "Bebida gratis", description: "Una bebida de cortesía", points_cost: 100, category: "free_item" },
                { name: "Postre gratis", description: "Un postre de la casa", points_cost: 200, category: "free_item" },
                { name: "10% descuento", description: "Descuento en tu próxima visita", points_cost: 300, category: "discount" },
            ],
        },
    },
    {
        type: "retail",
        label: "Tienda / Retail (moda, calzado, accesorios)",
        modules: ["retail"],
        enabled: true,
        starter: {
            tables: 0,
            rewards: [
                { name: "10% descuento", description: "Descuento en tu próxima compra", points_cost: 300, category: "discount" },
                { name: "Regalo sorpresa", description: "Un detalle de la tienda", points_cost: 800, category: "free_item" },
                { name: "20% descuento", description: "Descuento en una prenda a elegir", points_cost: 1000, category: "discount" },
            ],
        },
    },
    // Futuros verticales (peluquería, cosmética, cafetería, …): añadir aquí cuando exista
    // su módulo, CON su `starter` (p. ej. peluquería: tables 0, "Lavado gratis", "Corte gratis").
];

/** Preset de un tipo de negocio (o undefined si no existe). */
export function getVertical(type: string): VerticalPreset | undefined {
    return VERTICALS.find((v) => v.type === type);
}

/** Verticales ofrecidos en el onboarding público. */
export function enabledVerticals(): VerticalPreset[] {
    return VERTICALS.filter((v) => v.enabled);
}

/** ¿Es un tipo de negocio válido y ofertado? (validación en app, sin CHECK en BD). */
export function isValidVertical(type: string): boolean {
    return enabledVerticals().some((v) => v.type === type);
}

/** Módulos por defecto de un tipo (vacío si el tipo no existe). */
export function modulesForVertical(type: string): string[] {
    return getVertical(type)?.modules ?? [];
}
