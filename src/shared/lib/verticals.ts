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

export interface VerticalPreset {
    /** Discriminador guardado en restaurants.business_type. */
    type: string;
    /** Etiqueta mostrada en el selector de onboarding. */
    label: string;
    /** Módulos por defecto para este tipo → restaurants.enabled_modules al aprobar. */
    modules: string[];
    /** Si se ofrece actualmente en el onboarding público. */
    enabled: boolean;
}

export const VERTICALS: VerticalPreset[] = [
    { type: "restaurant", label: "Restaurante", modules: ["restaurant"], enabled: true },
    {
        type: "retail",
        label: "Tienda / Retail (moda, calzado, accesorios)",
        modules: ["retail"],
        enabled: true,
    },
    // Futuros verticales (cosmética, cafetería, …): añadir aquí cuando exista su módulo.
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
