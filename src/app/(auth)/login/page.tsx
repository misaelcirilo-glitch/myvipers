'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/shared/lib/i18n';

export default function LoginPage() {
    const router = useRouter();
    const { t } = useI18n();
    const [form, setForm] = useState({ phone: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            router.push(data.user.role === 'admin' || data.user.role === 'waiter' ? '/admin' : '/carta');
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
                    <h1 className="text-2xl font-black">{t.auth.welcomeBack}</h1>
                    <p className="text-slate-400 text-sm mt-1">{t.auth.loginSubtitle}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="tel" placeholder={t.auth.phonePlaceholder} required
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                        value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                    <input
                        type="password" placeholder={t.auth.passwordPlaceholder} required
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    />

                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                    <div className="text-right -mt-1">
                        <Link href="/recuperar" className="text-slate-400 text-xs hover:text-amber-400 transition">{t.auth.forgotPassword}</Link>
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-amber-500 to-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? t.auth.loggingIn : t.auth.login}
                    </button>
                </form>

                <p className="text-center text-slate-500 text-sm mt-6">
                    {t.auth.noAccount} <Link href="/registro" className="text-amber-400 font-bold">{t.auth.registerFree}</Link>
                </p>
            </div>
        </div>
    );
}
