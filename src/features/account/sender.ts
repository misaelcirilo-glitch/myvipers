import { META_API_VERSION } from '@/features/whatsapp-agent/meta';
import { otpSendEnabled, otpSenderConfig } from './config';

// Envío del código. Dos modos:
//   · SIMULADO (por defecto): no se llama a Meta ni sale ningún mensaje.
//   · REAL: solo con ACCOUNT_OTP_SEND_ENABLED encendido. Plantilla de autenticación de Meta,
//     desde el número de WHATSAPP_OTP_PHONE_NUMBER_ID (cambiar de número = cambiar la variable).

export type OtpSendResult = { ok: true; simulated: boolean } | { ok: false; simulated: boolean; error: string };
export type OtpSender = (e164: string, code: string) => Promise<OtpSendResult>;

type Env = Record<string, string | undefined>;

export const simulatedSender: OtpSender = async (_e164, code) => {
    // El código solo se escribe en la consola en desarrollo local; nunca en un despliegue.
    if (process.env.NODE_ENV !== 'production') console.info(`[cuenta] envío SIMULADO de código: ${code}`);
    return { ok: true, simulated: true };
};

export function metaSender(env: Env = process.env, fetchImpl: typeof fetch = fetch): OtpSender {
    return async (e164, code) => {
        const { phoneNumberId, accessToken, template, language } = otpSenderConfig(env);
        if (!phoneNumberId || !accessToken) {
            return { ok: false, simulated: false, error: 'Falta WHATSAPP_OTP_PHONE_NUMBER_ID o el token de WhatsApp' };
        }
        try {
            const res = await fetchImpl(`https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: e164.replace(/^\+/, ''),
                    type: 'template',
                    template: {
                        name: template,
                        language: { code: language },
                        // Plantilla de autenticación con botón «Copiar código»: el código va en el
                        // cuerpo y en el botón.
                        components: [
                            { type: 'body', parameters: [{ type: 'text', text: code }] },
                            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
                        ],
                    },
                }),
            });
            const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
            if (!res.ok || !data.messages?.[0]?.id) {
                return { ok: false, simulated: false, error: `Meta API ${res.status}: ${data.error?.message ?? 'sin messageId'} (code ${data.error?.code ?? '-'})` };
            }
            return { ok: true, simulated: false };
        } catch (e) {
            return { ok: false, simulated: false, error: e instanceof Error ? e.message : 'Error de red con Meta' };
        }
    };
}

/** El envío que toca según el interruptor. Apagado → simulado. */
export function defaultSender(env: Env = process.env): OtpSender {
    return otpSendEnabled(env) ? metaSender(env) : simulatedSender;
}
