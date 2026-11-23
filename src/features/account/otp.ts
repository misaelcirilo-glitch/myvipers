import { db } from '@/shared/lib/db';
import { OTP_LIMITS, otpDailyCap } from './config';
import { codeHash, ipHash, newCode, otpPepper, phoneHash } from './hash';
import { callingCodeTable } from './phone';
import { LOCKED_PASSWORD_HASH } from './locked-password';
import type { OtpSender } from './sender';

// Códigos por WhatsApp de la cuenta global (PRP-myvipers-006, F2).
//
// REGLA CLAVE: una fila de `users` solo recibe `account_id` dentro de `verifyOtpAndLink`,
// en la misma sentencia que da el código por bueno. No hay otro sitio que lo escriba.

/** Candado de base de datos: las peticiones de código se cuentan de una en una. */
const REQUEST_LOCK_KEY = 7006002;

export type BlockReason = 'locked' | 'phone_hour' | 'phone_day' | 'ip_hour' | 'global_day';
export type RequestOutcome =
    | { status: 'sent'; simulated: boolean }
    | { status: 'blocked'; reason: BlockReason }
    | { status: 'failed' };

export type CapAlert = { level: 'warning' | 'reached'; count: number; cap: number; day: string };

export type RequestDeps = {
    sender: OtpSender;
    /** Aviso por correo del tope diario. Opcional: sin él solo queda apuntado. */
    alert?: (a: CapAlert) => Promise<unknown>;
    /** Duración mínima de la respuesta. Por defecto, la de OTP_LIMITS. */
    minResponseMs?: number;
    env?: Record<string, string | undefined>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Pide un código para un número. Devuelve qué pasó (para el registro y las pruebas), pero
 * tarda lo mismo se envíe o se bloquee: quien llama no debe revelar el resultado.
 */
export async function requestOtp(
    input: { e164: string; ip: string | null },
    deps: RequestDeps,
): Promise<RequestOutcome> {
    const started = Date.now();
    const minMs = deps.minResponseMs ?? OTP_LIMITS.minResponseMs;
    try {
        return await issue(input, deps);
    } finally {
        const left = minMs - (Date.now() - started);
        if (left > 0) await sleep(left);
    }
}

async function issue(input: { e164: string; ip: string | null }, deps: RequestDeps): Promise<RequestOutcome> {
    const env = deps.env ?? process.env;
    const pepper = otpPepper(env);
    const cap = otpDailyCap(env);
    const warnAt = Math.ceil(cap * OTP_LIMITS.warnRatio);
    const L = OTP_LIMITS;

    const ph = phoneHash(pepper, input.e164);
    const ih = ipHash(pepper, input.ip || 'desconocida');
    const code = newCode();
    const ch = codeHash(pepper, input.e164, code);

    // Una sola transacción bajo candado: contar, decidir y apuntar no se pueden pisar entre
    // dos peticiones simultáneas.
    const results = await db.transaction([
        db`SELECT pg_advisory_xact_lock(${REQUEST_LOCK_KEY})`,
        db`DELETE FROM phone_otp WHERE created_at < now() - make_interval(days => ${L.retentionDays})`,
        db`
            WITH c AS (
                SELECT
                    (SELECT count(*) FROM phone_otp WHERE phone_hash = ${ph} AND status <> 'blocked'
                        AND created_at > now() - interval '1 hour')::int AS phone_hour,
                    (SELECT count(*) FROM phone_otp WHERE phone_hash = ${ph} AND status <> 'blocked'
                        AND created_at > now() - interval '24 hours')::int AS phone_day,
                    (SELECT count(*) FROM phone_otp WHERE ip_hash = ${ih}
                        AND created_at > now() - interval '1 hour')::int AS ip_hour,
                    (SELECT count(*) FROM phone_otp WHERE status <> 'blocked'
                        AND created_at >= date_trunc('day', now()))::int AS global_day,
                    EXISTS (SELECT 1 FROM phone_otp WHERE phone_hash = ${ph} AND attempts >= ${L.maxAttempts}
                        AND created_at > now() - make_interval(mins => ${L.lockMinutes})) AS locked
            ), d AS (
                SELECT CASE
                    WHEN locked THEN 'locked'
                    WHEN phone_hour >= ${L.perPhoneHour} THEN 'phone_hour'
                    WHEN phone_day >= ${L.perPhoneDay} THEN 'phone_day'
                    WHEN ip_hour >= ${L.perIpHour} THEN 'ip_hour'
                    WHEN global_day >= ${cap} THEN 'global_day'
                END AS reason FROM c
            ), old AS (
                -- Un código nuevo deja sin efecto los anteriores de ese número.
                UPDATE phone_otp SET status = 'expired'
                WHERE phone_hash = ${ph} AND purpose = 'verify' AND status IN ('requested', 'sent')
                  AND (SELECT reason FROM d) IS NULL
                RETURNING id
            ), ins AS (
                -- Las peticiones bloqueadas también se apuntan (sin código), salvo las que frena
                -- el límite por conexión: así una conexión abusiva no llena la tabla.
                INSERT INTO phone_otp (phone_hash, ip_hash, code_hash, purpose, status, expires_at)
                SELECT ${ph}, ${ih},
                       CASE WHEN d.reason IS NULL THEN ${ch} END,
                       'verify',
                       CASE WHEN d.reason IS NULL THEN 'requested' ELSE 'blocked' END,
                       CASE WHEN d.reason IS NULL THEN now() + make_interval(mins => ${L.ttlMinutes}) END
                FROM d WHERE d.reason IS DISTINCT FROM 'ip_hour'
                RETURNING id
            )
            SELECT d.reason, (SELECT id FROM ins) AS id, (SELECT count(*) FROM old)::int AS replaced FROM d`,
        capEvent('otp_cap_80', warnAt, cap),
        capEvent('otp_cap_100', cap, cap),
    ]);

    const row = results[2][0] as { reason: BlockReason | null; id: string | null };
    const alerts: CapAlert[] = [
        ...(results[3] as { detail: Omit<CapAlert, 'level'> }[]).map((r) => ({ level: 'warning' as const, ...r.detail })),
        ...(results[4] as { detail: Omit<CapAlert, 'level'> }[]).map((r) => ({ level: 'reached' as const, ...r.detail })),
    ];
    for (const a of alerts) {
        console.warn(`[cuenta] tope diario de códigos: ${a.count}/${a.cap} (${a.level})`);
        // El aviso no puede tumbar la petición.
        if (deps.alert) await deps.alert(a).catch((e) => console.error('[cuenta] no se pudo avisar del tope:', e));
    }

    if (row.reason) return { status: 'blocked', reason: row.reason };

    const sent = await deps.sender(input.e164, code);
    if (!sent.ok) {
        console.error('[cuenta] no se pudo enviar el código:', sent.error);
        await db`UPDATE phone_otp SET status = 'failed' WHERE id = ${row.id} AND status = 'requested'`;
        return { status: 'failed' };
    }
    await db`UPDATE phone_otp SET status = 'sent', sent_at = now() WHERE id = ${row.id} AND status = 'requested'`;
    return { status: 'sent', simulated: sent.simulated };
}

/** Apunta (una sola vez al día) que se llegó a `threshold` códigos; devuelve la fila si es nueva. */
function capEvent(event: 'otp_cap_80' | 'otp_cap_100', threshold: number, cap: number) {
    return db`
        INSERT INTO account_events (event, detail)
        SELECT ${event}, jsonb_build_object('day', current_date::text, 'count', n.c, 'cap', ${cap}::int)
        FROM (SELECT count(*)::int AS c FROM phone_otp
              WHERE status <> 'blocked' AND created_at >= date_trunc('day', now())) n
        WHERE n.c >= ${threshold}
          AND NOT EXISTS (SELECT 1 FROM account_events
                          WHERE event = ${event} AND detail->>'day' = current_date::text)
        RETURNING detail`;
}

export type VerifyOutcome =
    | { ok: true; accountId: string; linked: number; foreign: number }
    | { ok: false };

/**
 * Comprueba el código y, SOLO si es correcto, crea (o localiza) la cuenta del número y le
 * une las filas de cliente que son de ese número completo. Todo en una sentencia: o pasa
 * entero o no pasa nada.
 *
 *   · Fila de la sesión: se une tal cual (el cliente acaba de demostrar que el número es suyo).
 *   · Otras filas del mismo número completo (prefijo del país de su negocio + sus cifras):
 *     se unen, pero su contraseña deja de valer y se cierran sus sesiones.
 *   · Personal (admin, camarero) y números iguales de otro país: nunca.
 *   · No se borra ni se mueve nada: puntos, canjes, reservas e historial siguen en su fila.
 *
 * Código incorrecto, caducado, ya usado o con los intentos agotados: misma respuesta.
 */
export async function verifyOtpAndLink(
    input: { e164: string; code: string; sessionUserId: string },
    env: Record<string, string | undefined> = process.env,
): Promise<VerifyOutcome> {
    const pepper = otpPepper(env);
    const ph = phoneHash(pepper, input.e164);
    const ch = codeHash(pepper, input.e164, input.code);
    const e164Digits = input.e164.replace(/\D/g, '');
    const { countries, codes } = callingCodeTable();

    const rows = await db`
        WITH cand AS (
            SELECT id, code_hash FROM phone_otp
            WHERE phone_hash = ${ph} AND purpose = 'verify' AND status = 'sent' AND expires_at > now()
            ORDER BY created_at DESC LIMIT 1
            FOR UPDATE
        ), otp AS (
            UPDATE phone_otp p
            SET attempts = p.attempts + 1,
                status = CASE WHEN c.code_hash = ${ch} THEN 'verified'
                              WHEN p.attempts + 1 >= ${OTP_LIMITS.maxAttempts} THEN 'expired'
                              ELSE p.status END
            FROM cand c WHERE p.id = c.id
            RETURNING p.status
        ), ok AS (
            SELECT 1 FROM otp WHERE status = 'verified'
        ), acct AS (
            INSERT INTO customer_accounts (phone_e164, verified_at)
            SELECT ${input.e164}, now() WHERE EXISTS (SELECT 1 FROM ok)
            ON CONFLICT (phone_e164) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164
            RETURNING id
        ), cc AS (
            SELECT * FROM unnest(${countries}::text[], ${codes}::text[]) AS t(country, code)
        ), matches AS (
            SELECT DISTINCT ON (u.restaurant_id) u.id, (u.id = ${input.sessionUserId}) AS own
            FROM users u
            LEFT JOIN restaurants r ON r.id = u.restaurant_id
            LEFT JOIN cc ON cc.country = upper(r.country)
            WHERE EXISTS (SELECT 1 FROM ok)
              AND u.role = 'customer' AND u.account_id IS NULL AND u.restaurant_id IS NOT NULL
              AND (u.id = ${input.sessionUserId}
                   OR regexp_replace(u.phone, '[^0-9]', '', 'g') = ${e164Digits}
                   OR (cc.code IS NOT NULL AND cc.code || regexp_replace(u.phone, '[^0-9]', '', 'g') = ${e164Digits}))
              -- Una cuenta tiene como mucho una fila por negocio.
              AND NOT EXISTS (SELECT 1 FROM users x JOIN customer_accounts a ON a.id = x.account_id
                              WHERE a.phone_e164 = ${input.e164} AND x.restaurant_id = u.restaurant_id)
            ORDER BY u.restaurant_id, (u.id = ${input.sessionUserId}) DESC, u.created_at
        ), linked AS (
            UPDATE users u
            SET account_id = (SELECT id FROM acct),
                must_change_password = (u.must_change_password OR NOT m.own),
                sessions_valid_after = CASE WHEN m.own THEN u.sessions_valid_after ELSE now() END,
                password_hash = CASE WHEN m.own THEN u.password_hash ELSE ${LOCKED_PASSWORD_HASH} END
            FROM matches m WHERE u.id = m.id
            RETURNING u.id, u.restaurant_id, m.own
        ), ev AS (
            INSERT INTO account_events (account_id, event, detail)
            SELECT (SELECT id FROM acct), 'verified',
                   jsonb_build_object(
                       'rows_linked', (SELECT count(*) FROM linked),
                       'rows_foreign', (SELECT count(*) FROM linked WHERE NOT own),
                       'session_user', ${input.sessionUserId}::text,
                       'restaurants', (SELECT coalesce(jsonb_agg(restaurant_id), '[]'::jsonb) FROM linked))
            WHERE EXISTS (SELECT 1 FROM ok)
            RETURNING id
        )
        SELECT (SELECT status FROM otp) AS otp_status,
               (SELECT id FROM acct) AS account_id,
               (SELECT count(*) FROM linked)::int AS linked,
               (SELECT count(*) FROM linked WHERE NOT own)::int AS foreign_rows,
               (SELECT count(*) FROM ev)::int AS events`;

    const r = rows[0] as { otp_status: string | null; account_id: string | null; linked: number; foreign_rows: number };
    if (r.otp_status !== 'verified' || !r.account_id) return { ok: false };
    return { ok: true, accountId: r.account_id, linked: r.linked, foreign: r.foreign_rows };
}
