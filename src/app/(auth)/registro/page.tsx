'use client';
import { useState } from 'react';
import { Flame, ArrowLeft, Gift } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/shared/lib/i18n';

export default function RegisterPage() {
    const { t } = useI18n();
    const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', referralCode: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            // Navegación dura: el SessionProvider (layout raíz) solo lee la cookie
            // al montar; con router.push /carta rebotaría al login.
            window.location.href = '/carta';
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col px-6 py-8 bg-[#0f0f1a]">
            <Link href="/" className="flex items-center gap-2 text-slate-400 text-sm mb-8">
                <ArrowLeft size={16} /> {t.auth.back}
            </Link>

            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Flame size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black">{t.auth.joinVip}</h1>
                    <p className="text-slate-400 text-sm mt-1">{t.auth.registerSubtitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text" placeholder={t.auth.namePlaceholder} required
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                    <input
                        type="tel" placeholder={t.auth.phoneExample} required
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                        value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                    <input
                        type="email" placeholder={t.auth.emailPlaceholder}
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                        value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                    <input
                        type="password" placeholder={t.auth.createPassword} required
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    />
                    <div className="relative">
                        <Gift size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
                        <input
                            type="text" placeholder={t.auth.referralPlaceholder}
                            className="w-full pl-10 pr-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                            value={form.referralCode} onChange={e => setForm({ ...form, referralCode: e.target.value.toUpperCase() })}
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                    <button
                        type="submit" disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-amber-500 to-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? t.auth.registering : t.auth.createAccount}
                    </button>
                </form>

                <p className="text-center text-slate-500 text-sm mt-6">
                    {t.auth.haveAccount} <Link href="/login" className="text-amber-400 font-bold">{t.auth.loginLink}</Link>
                </p>
            </div>
        </div>
    );
}
