import 'server-only';
import { Resend } from 'resend';

// Remitente configurable. Para envíos reales, el dominio debe estar verificado
// en Resend. `onboarding@resend.dev` solo entrega al correo de la cuenta (test).
const FROM = process.env.RESEND_FROM || 'MyVipers <no-reply@myvipers.es>';

interface ResetEmailOpts {
    to: string;
    name: string;
    resetUrl: string;
    restaurantName: string;
}

export async function sendPasswordResetEmail(
    opts: ResetEmailOpts
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, skipped: true, error: 'RESEND_API_KEY no configurada' };

    const { to, name, resetUrl, restaurantName } = opts;
    const firstName = (name || '').split(' ')[0] || 'Hola';

    const html = `
    <div style="background:#0f0f1a;padding:32px 0;font-family:Segoe UI,system-ui,sans-serif">
      <div style="max-width:480px;margin:0 auto;background:#1a1a2e;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.06)">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#f59e0b,#dc2626)">
          <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800">${restaurantName}</h1>
        </div>
        <div style="padding:32px">
          <p style="color:#e2e8f0;font-size:16px;margin:0 0 12px">Hola ${firstName},</p>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta VIP.
            Toca el botón para crear una nueva. El enlace vence en 1 hora.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(90deg,#f59e0b,#dc2626);color:#fff;text-decoration:none;font-weight:800;font-size:14px;padding:14px 28px;border-radius:12px">
            Restablecer contraseña
          </a>
          <p style="color:#64748b;font-size:12px;line-height:1.6;margin:24px 0 0">
            Si no fuiste tú, ignora este correo: tu contraseña seguirá igual.
          </p>
          <p style="color:#475569;font-size:11px;margin:16px 0 0;word-break:break-all">${resetUrl}</p>
        </div>
      </div>
    </div>`;

    try {
        const resend = new Resend(apiKey);
        const { error } = await resend.emails.send({
            from: FROM,
            to,
            subject: `Restablece tu contraseña · ${restaurantName}`,
            html,
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
    } catch (e: unknown) {
        return { ok: false, error: e instanceof Error ? e.message : 'Error al enviar el correo' };
    }
}
