import { describe, it, expect } from 'vitest';
import { VERTICALS, getVertical } from './verticals';

// Cada tipo de negocio tiene que traer un kit de inicio válido: si se añade un vertical
// (peluquería, cosmética…) sin `starter` o con datos que la BD rechazaría, el alta
// volvería a quedarse a medias. Este test lo impide.
const CATEGORIAS_BD = ['discount', 'free_item', 'experience', 'merchandise'];

describe.each(VERTICALS.map(v => [v.type, v] as const))('kit de inicio de %s', (_type, v) => {
    it('número de mesas válido', () => {
        expect(Number.isInteger(v.starter.tables)).toBe(true);
        expect(v.starter.tables).toBeGreaterThanOrEqual(0);
        expect(v.starter.tables).toBeLessThanOrEqual(100);
    });

    it('al menos una recompensa, con datos que acepta la BD', () => {
        expect(v.starter.rewards.length).toBeGreaterThan(0);
        for (const r of v.starter.rewards) {
            expect(r.name.trim()).not.toBe('');
            expect(CATEGORIAS_BD).toContain(r.category);
            expect(Number.isInteger(r.points_cost) && r.points_cost > 0).toBe(true);
        }
    });

    it('sin recompensas repetidas', () => {
        const nombres = v.starter.rewards.map(r => r.name);
        expect(new Set(nombres).size).toBe(nombres.length);
    });
});

describe('restaurante', () => {
    it('trae mesas', () => {
        expect(getVertical('restaurant')!.starter.tables).toBeGreaterThan(0);
    });
});
