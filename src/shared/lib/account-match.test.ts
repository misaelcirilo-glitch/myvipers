import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { mustChangePassword, resolveLogin, phoneKey } from './account-match';

// Comparador falso: la "hash" es la contraseña en claro con prefijo, para no gastar bcrypt.
const fake = async (plain: string, hash: string) => hash === `h:${plain}`;

describe('resolveLogin (mismo teléfono en varias tiendas)', () => {
    const machay = { id: 'a', password_hash: 'h:1234', restaurant: 'El Machay' };
    const elsita = { id: 'b', password_hash: 'h:clave', restaurant: 'Desayunos Elsita' };
    const otra = { id: 'c', password_hash: 'h:clave', restaurant: 'Otra' };

    it('sin cuentas → none', async () => {
        expect(await resolveLogin([], 'x', fake)).toEqual({ kind: 'none' });
    });

    it('contraseña que no coincide con ninguna → none', async () => {
        expect(await resolveLogin([machay, elsita], 'mala', fake)).toEqual({ kind: 'none' });
    });

    it('la contraseña elige la cuenta aunque haya varias tiendas', async () => {
        expect(await resolveLogin([machay, elsita], '1234', fake)).toEqual({ kind: 'one', account: machay });
        expect(await resolveLogin([machay, elsita], 'clave', fake)).toEqual({ kind: 'one', account: elsita });
    });

    it('misma contraseña en dos tiendas → hay que elegir (solo esas dos)', async () => {
        expect(await resolveLogin([machay, elsita, otra], 'clave', fake)).toEqual({ kind: 'choose', accounts: [elsita, otra] });
    });

    it('cuenta sin hash no entra', async () => {
        expect(await resolveLogin([{ id: 'z', password_hash: '' }], '', fake)).toEqual({ kind: 'none' });
    });

    it('usa bcrypt por defecto', async () => {
        const hash = await bcrypt.hash('secreta', 4);
        const r = await resolveLogin([{ id: 'x', password_hash: hash }], 'secreta');
        expect(r.kind).toBe('one');
    });
});

describe('mustChangePassword', () => {
    it('cuenta marcada: siempre', () => {
        expect(mustChangePassword({ phone: '934879292', must_change_password: true }, 'una-buena-clave')).toBe(true);
    });
    it('contraseña = 4 últimas cifras del teléfono (con o sin prefijo)', () => {
        expect(mustChangePassword({ phone: '934879292' }, '9292')).toBe(true);
        expect(mustChangePassword({ phone: '+51 934 879 292', must_change_password: false }, '9292')).toBe(true);
    });
    it('contraseña propia y cuenta sin marcar: no', () => {
        expect(mustChangePassword({ phone: '934879292', must_change_password: false }, 'mi-clave-larga')).toBe(false);
        expect(mustChangePassword({ phone: '934879292' }, '1234')).toBe(false);
    });
});

describe('phoneKey', () => {
    it('últimos 9 dígitos, sin prefijo ni símbolos', () => {
        expect(phoneKey('+51 934 879 292')).toBe('934879292');
        expect(phoneKey('934879292')).toBe('934879292');
        expect(phoneKey('(+34) 633-88-15-39')).toBe('633881539');
    });
});
