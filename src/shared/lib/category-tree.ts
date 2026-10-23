// Árbol de categorías retail (jerarquía sin límite de niveles). Client-safe
// (sin `db`/`neon`): lo usan tanto `/api/retail-catalog` (server) como la
// página pública `/r/[slug]` (cliente) sobre la misma lista plana con `parent_id`.

export interface CategoryNode {
    id: string;
    name: string;
    parent_id: string | null;
}

/** IDs de una categoría + todos sus descendientes (recursivo, cualquier profundidad). */
export function descendantIds<T extends CategoryNode>(categories: T[], rootId: string): Set<string> {
    const byParent = new Map<string, T[]>();
    for (const c of categories) {
        const key = c.parent_id || 'root';
        (byParent.get(key) || byParent.set(key, []).get(key)!).push(c);
    }
    const ids = new Set<string>([rootId]);
    const walk = (id: string) => {
        for (const child of byParent.get(id) || []) {
            if (!ids.has(child.id)) { ids.add(child.id); walk(child.id); }
        }
    };
    walk(rootId);
    return ids;
}

/** Hijos directos de `parentId` (null = raíz), ordenados. */
export function childrenOf<T extends CategoryNode>(categories: T[], parentId: string | null): T[] {
    return categories.filter(c => (c.parent_id || null) === parentId);
}

/** Camino raíz→...→categoría (breadcrumb), siguiendo `parent_id` hacia arriba. */
export function categoryPath<T extends CategoryNode>(categories: T[], id: string | null): T[] {
    const byId = new Map(categories.map(c => [c.id, c]));
    const path: T[] = [];
    let current = id ? byId.get(id) : undefined;
    while (current) {
        path.unshift(current);
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return path;
}
