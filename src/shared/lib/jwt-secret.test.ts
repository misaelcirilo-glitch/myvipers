import { describe, expect, test } from 'vitest';
import { jwtSecret } from './jwt-secret';

describe('jwtSecret', () => {
    test('sin JWT_SECRET falla (no hay clave de reserva)', () => {
        expect(() => jwtSecret({})).toThrow(/JWT_SECRET/);
    });
    test('una clave corta falla', () => {
        expect(() => jwtSecret({ JWT_SECRET: 'myvipers-secret-2026' })).toThrow(/JWT_SECRET/);
    });
    test('una clave de 32+ caracteres vale', () => {
        expect(jwtSecret({ JWT_SECRET: 'x'.repeat(32) })).toHaveLength(32);
    });
});
