/**
 * CUENTA GLOBAL — F2: piezas sin base de datos (interruptores, huellas, teléfonos y envío).
 * Ninguna de estas pruebas llama a Meta: el envío real se comprueba con un `fetch` falso.
 */
import { describe, expect, it, vi } from 'vitest';
import { accountGlobalEnabled, otpDailyCap, otpSendEnabled, otpSenderConfig } from './config';
import { codeHash, ipHash, newCode, otpPepper, phoneHash } from './hash';
import { callingCodeTable, normalizeE164, rowPhoneMatchesE164 } from './phone';
import { defaultSender, metaSender, simulatedSender } from './sender';

const PEPPER = 'clave-de-huellas-solo-para-pruebas-0123456789';

describe('interruptores: todo apagado por defecto', () => {
  it('sin variables, ni la cuenta global ni el envío real están activos', () => {
    expect(accountGlobalEnabled({})).toBe(false);
    expect(otpSendEnabled({})).toBe(false);
  });
  it('solo «1» o «true» encienden; cualquier otro valor deja apagado', () => {
    for (const v of ['1', 'true']) expect(otpSendEnabled({ ACCOUNT_OTP_SEND_ENABLED: v })).toBe(true);
    for (const v of ['', '0', 'false', 'si', 'on', 'TRUE ']) expect(otpSendEnabled({ ACCOUNT_OTP_SEND_ENABLED: v })).toBe(false);
  });
  it('el tope diario es 300 salvo que OTP_DAILY_CAP diga otro entero positivo', () => {
    expect(otpDailyCap({})).toBe(300);
    expect(otpDailyCap({ OTP_DAILY_CAP: '50' })).toBe(50);
    for (const v of ['0', '-5', 'abc', '2.5']) expect(otpDailyCap({ OTP_DAILY_CAP: v })).toBe(300);
  });
});

describe('huellas: nada en claro', () => {
  it('sin OTP_PEPPER (o corta) no se emiten códigos', () => {
    expect(() => otpPepper({})).toThrow(/OTP_PEPPER/);
    expect(() => otpPepper({ OTP_PEPPER: 'corta' })).toThrow(/OTP_PEPPER/);
    expect(otpPepper({ OTP_PEPPER: PEPPER })).toBe(PEPPER);
  });
  it('la huella no contiene el teléfono ni el código, y cambia con la clave', () => {
    const h = phoneHash(PEPPER, '+51900000081');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('900000081');
    expect(phoneHash(PEPPER + 'x', '+51900000081')).not.toBe(h);
    expect(ipHash(PEPPER, '203.0.113.7')).not.toContain('203');
  });
  it('el mismo código para otro número da otra huella', () => {
    expect(codeHash(PEPPER, '+51900000081', '123456')).not.toBe(codeHash(PEPPER, '+34900000081', '123456'));
  });
  it('el código son siempre 6 cifras', () => {
    for (let i = 0; i < 200; i++) expect(newCode()).toMatch(/^[0-9]{6}$/);
  });
});

describe('teléfono completo con prefijo', () => {
  it('acepta solo números con prefijo de país', () => {
    expect(normalizeE164('+51 900 000 081')).toBe('+51900000081');
    expect(normalizeE164('+34600000081')).toBe('+34600000081');
    for (const malo of ['900000081', '51900000081', '+51', '+51abc', '+5190000008', '']) expect(normalizeE164(malo), malo).toBeNull();
  });
  it('la fila coincide si su número es el nacional (o el completo) del verificado', () => {
    expect(rowPhoneMatchesE164('900000081', '+51900000081')).toBe(true);
    expect(rowPhoneMatchesE164('900 000 081', '+34900000081')).toBe(true);
    expect(rowPhoneMatchesE164('51900000081', '+51900000081')).toBe(true);
    expect(rowPhoneMatchesE164('900000082', '+51900000081')).toBe(false);
    expect(rowPhoneMatchesE164('000081', '+51900000081')).toBe(false);
  });
  it('la tabla de prefijos distingue Perú de España', () => {
    const { countries, codes } = callingCodeTable();
    expect(codes[countries.indexOf('PE')]).toBe('51');
    expect(codes[countries.indexOf('ES')]).toBe('34');
  });
});

describe('envío', () => {
  it('con el interruptor apagado el envío es simulado y no llama a Meta', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await defaultSender({ WHATSAPP_OTP_PHONE_NUMBER_ID: '111', WHATSAPP_OTP_ACCESS_TOKEN: 't' })('+51900000081', '123456');
    expect(result).toEqual({ ok: true, simulated: true });
    expect(await simulatedSender('+51900000081', '123456')).toEqual({ ok: true, simulated: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('el envío real usa el número de WHATSAPP_OTP_PHONE_NUMBER_ID; cambiar la variable cambia el número', async () => {
    type Sent = { to: string; type: string; template: { name: string; language: { code: string }; components: unknown[] } };
    const calls: { url: string; body: Sent; auth: string }[] = [];
    const fakeFetch = (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const headers = init!.headers as Record<string, string>;
      calls.push({ url: String(url), body: JSON.parse(String(init!.body)) as Sent, auth: headers.Authorization });
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.x' }] }), { status: 200 });
    }) as typeof fetch;

    const env = { WHATSAPP_OTP_PHONE_NUMBER_ID: '111', WHATSAPP_OTP_ACCESS_TOKEN: 'tok' };
    expect(await metaSender(env, fakeFetch)('+51900000081', '654321')).toEqual({ ok: true, simulated: false });
    await metaSender({ ...env, WHATSAPP_OTP_PHONE_NUMBER_ID: '222' }, fakeFetch)('+51900000081', '654321');

    expect(calls[0].url).toMatch(/\/111\/messages$/);
    expect(calls[1].url).toMatch(/\/222\/messages$/);
    expect(calls[0].auth).toBe('Bearer tok');
    expect(calls[0].body.to).toBe('51900000081');
    expect(calls[0].body.type).toBe('template');
    expect(calls[0].body.template.name).toBe('codigo_verificacion');
    expect(calls[0].body.template.language.code).toBe('es');
    expect(JSON.stringify(calls[0].body.template.components)).toContain('654321');
  });

  it('sin número en la variable no se envía nada (nunca hay un número de reserva en el código)', async () => {
    const fakeFetch = vi.fn() as unknown as typeof fetch;
    const result = await metaSender({ WHATSAPP_OTP_ACCESS_TOKEN: 'tok', MV_WA_PHONE_NUMBER_ID: '999' }, fakeFetch)('+51900000081', '1');
    expect(result.ok).toBe(false);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('el token puede ser el del agente de ventas (mismo WABA); plantilla e idioma, por variable', () => {
    expect(otpSenderConfig({ MV_WA_ACCESS_TOKEN: 'agente' }).accessToken).toBe('agente');
    expect(otpSenderConfig({ MV_WA_ACCESS_TOKEN: 'agente', WHATSAPP_OTP_ACCESS_TOKEN: 'propio' }).accessToken).toBe('propio');
    expect(otpSenderConfig({ WHATSAPP_OTP_TEMPLATE: 'otra', WHATSAPP_OTP_TEMPLATE_LANG: 'en' })).toMatchObject({ template: 'otra', language: 'en' });
  });

  it('un error de Meta se devuelve como fallo, sin lanzar', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({ error: { message: 'plantilla no aprobada', code: 132001 } }), { status: 400 })) as typeof fetch;
    const result = await metaSender({ WHATSAPP_OTP_PHONE_NUMBER_ID: '111', WHATSAPP_OTP_ACCESS_TOKEN: 'tok' }, fakeFetch)('+51900000081', '1');
    expect(result).toMatchObject({ ok: false, simulated: false });
  });
});
