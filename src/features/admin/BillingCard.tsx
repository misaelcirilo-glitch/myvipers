'use client';
import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

type BillingState = 'free' | 'trialing' | 'active' | 'past_due' | 'canceled';
type Billing = 'mensual' | 'anual';
type PriceInfo = { amount: number; currency: string } | null;

interface BillingInfo {
    state: BillingState;
    planLookupKey: string | null;
    currentPeriodEnd: string | null;
    paymentsEnabled: boolean;
    prices: Record<Billing, PriceInfo>;
    trialDays: number;
}

const STATE_LABEL: Record<BillingState, { text: string; cls: string }> = {
    free: { text: 'Plan gratuito', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
    trialing: { text: 'En prueba', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    active: { text: 'Suscripción activa', cls: 'bg-green-500/15 text-green-300 border-green-500/30' },
    past_due: { text: 'Pago pendiente', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
    canceled: { text: 'Suscripción cancelada', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

function formatMoney(p: PriceInfo): string {
    if (!p) return '—';
    try {
        return new Intl.NumberFormat('es', { style: 'currency', currency: p.currency, maximumFractionDigits: 2 }).format(p.amount);
    } catch {
        return `${p.amount} ${p.currency}`;
    }
}

function periodFromKey(key: string | null): string {
    if (!key) return '';
    return key.includes('_anual_') ? 'Anual' : key.includes('_mensual_') ? 'Mensual' : '';
}

export function BillingCard({ checkoutResult }: { checkoutResult?: 'ok' | 'cancel' | null }) {
    const [info, setInfo] = useState<BillingInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/billing');
            if (res.ok) setInfo(await res.json());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        // Tras volver de Stripe, el webhook tarda unos segundos: refrescamos.
        if (checkoutResult === 'ok') {
            const t1 = setTimeout(load, 3000);
            const t2 = setTimeout(load, 8000);
            return () => { clearTimeout(t1); clearTimeout(t2); };
        }
    }, [load, checkoutResult]);

    async function go(endpoint: string, body: object | undefined, key: string) {
        setBusy(key);
        setError(null);
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo abrir el pago');
            window.location.href = data.url;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error inesperado');
            setBusy(null);
        }
    }

    if (loading) {
        return (
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-6 flex justify-center">
                <Loader2 size={20} className="animate-spin text-slate-500" />
            </div>
        );
    }
    if (!info) return null;

    const label = STATE_LABEL[info.state];
    const isLive = info.state === 'active' || info.state === 'trialing' || info.state === 'past_due';
    const renew = info.currentPeriodEnd
        ? new Date(info.currentPeriodEnd).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })
        : null;

    return (
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <CreditCard size={18} className="text-amber-400" />
                    <span className="text-sm font-bold text-white">Suscripción MyVipers</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${label.cls}`}>
                    {label.text}
                </span>
            </div>

            {checkoutResult === 'ok' && !isLive && (
                <p className="text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                    ¡Listo! Tu suscripción se activará en unos segundos.
                </p>
            )}
            {checkoutResult === 'cancel' && !isLive && (
                <p className="text-xs text-slate-400 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl p-3">
                    Has cancelado el pago. Puedes suscribirte cuando quieras.
                </p>
            )}

            {isLive ? (
                <div className="space-y-3">
                    <div className="text-xs text-slate-400 space-y-1">
                        {periodFromKey(info.planLookupKey) && (
                            <p>Plan: <span className="text-white font-semibold">{periodFromKey(info.planLookupKey)}</span></p>
                        )}
                        {renew && (
                            <p>{info.state === 'past_due' ? 'Periodo hasta' : info.state === 'trialing' ? 'Prueba gratis hasta' : 'Se renueva el'}: <span className="text-white font-semibold">{renew}</span></p>
                        )}
                    </div>
                    {info.state === 'past_due' && (
                        <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            No pudimos cobrar la última cuota. Actualiza tu tarjeta para mantener la suscripción.
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={() => go('/api/stripe/portal', undefined, 'portal')}
                        disabled={!!busy}
                        className="w-full bg-[#0f0f1a] border border-[#2a2a3e] text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:border-amber-500/50 transition disabled:opacity-60"
                    >
                        {busy === 'portal' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
                        Gestionar suscripción
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">Cambia la tarjeta, descarga facturas o cancela.</p>
                </div>
            ) : !info.paymentsEnabled ? (
                <p className="text-xs text-slate-400">Los pagos online estarán disponibles muy pronto.</p>
            ) : (
                <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                        {info.state === 'canceled'
                            ? 'Tu suscripción terminó. Vuelve a activarla cuando quieras.'
                            : 'Activa tu suscripción para seguir haciendo crecer tu negocio con MyVipers.'}
                    </p>
                    {info.trialDays > 0 && (
                        <p className="text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                            Los primeros {info.trialDays} días son gratis. No se cobra nada hasta que termine la prueba y puedes cancelar antes.
                        </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        {(['mensual', 'anual'] as const).map((b) => (
                            <button
                                key={b}
                                type="button"
                                onClick={() => go('/api/stripe/checkout', { billing: b }, b)}
                                disabled={!!busy || !info.prices[b]}
                                className={`rounded-xl p-4 text-left border transition disabled:opacity-50 ${b === 'anual' ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400' : 'bg-[#0f0f1a] border-[#2a2a3e] hover:border-amber-500/50'}`}
                            >
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{b === 'anual' ? 'Anual' : 'Mensual'}</p>
                                <p className="text-lg font-black text-white mt-1 flex items-center gap-2">
                                    {busy === b ? <Loader2 size={16} className="animate-spin" /> : formatMoney(info.prices[b])}
                                </p>
                                <p className="text-[10px] text-slate-500">{b === 'anual' ? 'por año' : 'por mes'}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
}
