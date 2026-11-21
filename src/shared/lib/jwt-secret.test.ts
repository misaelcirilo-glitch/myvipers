import { describe, expect, test } from 'vitest';
import { jwtSecret } from './jwt-secret';

describe('jwtSecret', () => {
    test('sin JWT_SECRET falla (no hay clave de reserva)', () => {
        expect(() => jwtSecret({})).toThrow(/JWT_SECRET/);
    });
    test('una clave corta falla', () => {
        expect(() => jwtSecret({ JWT_SECRET: 'myvipers-secret-2026' })).toThrow(/JWT_SECRET/);
    });
    test('la clave antigua de producción (35 caracteres) falla aunque pase el mínimo', () => {
        expect(() => jwtSecret({ JWT_SECRET: 'el-machay-pomabamba-2026-secret-key' })).toThrow(/clave antigua conocida/);
        expect(() => jwtSecret({ JWT_SECRET: ' el-machay-pomabamba-2026-secret-key ' })).toThrow(/clave antigua conocida/);
    });
    test('una clave de 32+ caracteres vale', () => {
        expect(jwtSecret({ JWT_SECRET: 'x'.repeat(32) })).toHaveLength(32);
    });
});
