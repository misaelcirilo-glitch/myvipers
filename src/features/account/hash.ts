import { createHmac, randomInt } from 'node:crypto';
import { OTP_PEPPER_MIN_LENGTH } from './config';

// En la base de datos no se guarda ni el teléfono ni el código: solo sus huellas (HMAC con
// la clave secreta OTP_PEPPER). Sin la clave, las huellas no se pueden deshacer ni comparar.

export function otpPepper(env: Record<string, string | undefined> = process.env): string {
    const value = env.OTP_PEPPER;
    if (!value || value.length < OTP_PEPPER_MIN_LENGTH) {
        throw new Error(`Falta OTP_PEPPER o tiene menos de ${OTP_PEPPER_MIN_LENGTH} caracteres: no se pueden emitir códigos.`);
    }
    return value;
}

const hmac = (pepper: string, value: string) => createHmac('sha256', pepper).update(value, 'utf8').digest('hex');

export const phoneHash = (pepper: string, e164: string) => hmac(pepper, `phone:${e164}`);
export const ipHash = (pepper: string, ip: string) => hmac(pepper, `ip:${ip}`);
/** La huella del código va atada al número: el mismo código para otro número da otra huella. */
export const codeHash = (pepper: string, e164: string, code: string) => hmac(pepper, `code:${e164}:${code}`);

/** Código de 6 cifras, con generador criptográfico. */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
