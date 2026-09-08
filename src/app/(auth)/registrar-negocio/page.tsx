'use client';

import { useState } from 'react';
import { enabledVerticals } from '@/shared/lib/verticals';

const VERTICALS = enabledVerticals();

export default function RegisterBusinessPage() {
    const [form, setForm] = useState({
        businessName: '',
        slug: '',
        businessType: VERTICALS[0]?.type ?? 'restaurant',
        adminName: '',
        adminPhone: '',
        adminEmail: '',
        password: '',
        country: '',
        notes: '',
        website: '', // honeypot (oculto)
    });
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

    // Sugerencia de slug a partir del nombre.
    const onName = (v: string) => {
        setForm((f) => {
            const auto = v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
            const slugAuto = !f.slug || f.slug === slugify(f.businessName) ? auto : f.slug;
            return { ...f, businessName: v, slug: slugAuto };
        });
    };

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/onboarding/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'No se pudo enviar la solicitud');
                return;
            }
            setSent(true);
        } catch {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    }

    if (sent) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
                <div className="max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 text-center">
                    <div className="text-4xl">✅</div>
                    <h1 className="mt-2 text-lg font-bold">Solicitud enviada</h1>
                    <p className="mt-1 text-sm text-white/60">
                        Revisaremos tu solicitud y te avisaremos cuando tu cuenta esté activa.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
            <form onSubmit={onSubmit} className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
                <div>
                    <h1 className="text-lg font-bold">Da de alta tu negocio en MyVipers</h1>
                    <p className="text-xs text-white/50">Rellena la solicitud; la revisamos y activamos tu cuenta.</p>
                </div>
                {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}

                <Field label="Nombre del negocio">
                    <input value={form.businessName} onChange={(e) => onName(e.target.value)} className={inputCls} placeholder="Moda Bella" />
                </Field>

                <Field label="Tipo de negocio">
                    <select value={form.businessType} onChange={(e) => set('businessType', e.target.value)} className={inputCls}>
                        {VERTICALS.map((v) => (
                            <option key={v.type} value={v.type}>{v.label}</option>
                        ))}
                    </select>
                </Field>

                <Field label="Identificador (para tu URL: /r/…)">
                    <input value={form.slug} onChange={(e) => set('slug', e.target.value)} className={inputCls} placeholder="moda-bella" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Tu nombre (admin)">
                        <input value={form.adminName} onChange={(e) => set('adminName', e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="Teléfono">
                        <input value={form.adminPhone} onChange={(e) => set('adminPhone', e.target.value)} inputMode="numeric" className={inputCls} />
                    </Field>
                </div>

                <Field label="Email (opcional)">
                    <input value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} type="email" className={inputCls} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Contraseña">
                        <input value={form.password} onChange={(e) => set('password', e.target.value)} type="password" className={inputCls} />
                    </Field>
                    <Field label="País (opcional)">
                        <input value={form.country} onChange={(e) => set('country', e.target.value)} className={inputCls} placeholder="PE / ES…" />
                    </Field>
                </div>

                <Field label="Mensaje (opcional)">
                    <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={inputCls} />
                </Field>

                {/* honeypot anti-bots (oculto) */}
                <input
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    className="hidden"
                    aria-hidden="true"
                />

                <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50">
                    {loading ? 'Enviando…' : 'Enviar solicitud'}
                </button>
            </form>
        </main>
    );
}

const inputCls = 'mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-xs text-white/60">{label}</span>
            {children}
        </label>
    );
}

function slugify(v: string): string {
    return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}
