// Cuenta global de cliente (PRP-myvipers-006, F2): interruptores y límites de los códigos.
// Todo sale de variables de entorno; nada de esto está activo por defecto.

type Env = Record<string, string | undefined>;

const on = (v: string | undefined) => v === '1' || v === 'true';

/** Interruptor general del recorrido de cuenta global. Apagado por defecto: las rutas responden 404. */
export const accountGlobalEnabled = (env: Env = process.env) => on(env.ACCOUNT_GLOBAL_ENABLED);

/**
 * Interruptor del envío REAL por WhatsApp. Apagado por defecto: el envío es simulado y no
 * se llama a Meta. Solo con este interruptor encendido sale un mensaje de verdad.
 */
export const otpSendEnabled = (env: Env = process.env) => on(env.ACCOUNT_OTP_SEND_ENABLED);

export const OTP_PEPPER_MIN_LENGTH = 32;

export const OTP_LIMITS = {
    /** El código caduca a los 5 minutos. */
    ttlMinutes: 5,
    /** Intentos por código. Al agotarlos el código muere y el número queda bloqueado un rato. */
    maxAttempts: 5,
    /** Bloqueo temporal del número tras agotar los intentos de un código. */
    lockMinutes: 15,
    /** Códigos por número: por hora y por día (24 h). */
    perPhoneHour: 3,
    perPhoneDay: 8,
    /** Peticiones por conexión (IP) y hora, se envíen o no. */
    perIpHour: 20,
    /** Tope global diario por defecto; se cambia con OTP_DAILY_CAP. */
    dailyCap: 300,
    /** Aviso por correo al llegar a esta parte del tope, y otro al alcanzarlo. */
    warnRatio: 0.8,
    /** Los registros de códigos se borran pasados estos días. */
    retentionDays: 30,
    /** La respuesta al pedir un código tarda como mínimo esto, se envíe o se bloquee. */
    minResponseMs: 1500,
} as const;

/** Tope global diario: OTP_DAILY_CAP si es un entero positivo; si no, 300. */
export function otpDailyCap(env: Env = process.env): number {
    const n = Number(env.OTP_DAILY_CAP);
    return Number.isInteger(n) && n > 0 ? n : OTP_LIMITS.dailyCap;
}

/** Datos del envío real. El número sale SIEMPRE de la variable, nunca del código. */
export function otpSenderConfig(env: Env = process.env) {
    return {
        phoneNumberId: env.WHATSAPP_OTP_PHONE_NUMBER_ID,
        // Mismo WABA que el agente de ventas: si no hay token propio se usa el suyo.
        accessToken: env.WHATSAPP_OTP_ACCESS_TOKEN || env.MV_WA_ACCESS_TOKEN,
        template: env.WHATSAPP_OTP_TEMPLATE || 'codigo_verificacion',
        language: env.WHATSAPP_OTP_TEMPLATE_LANG || 'es',
    };
}
