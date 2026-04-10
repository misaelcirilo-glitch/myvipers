'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap } from 'lucide-react';

export default function RestaurantLoginPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const router = useRouter();
    const [form, setForm] = useState({ phone: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, restaurantSlug: slug }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            router.push('/carta');
        } catch (err: any) {
            setError(err.message);
        } finally { setLoading(false); }
    }

    return (
        <div className="min-h-screen bg-[#0f0f1a] flex flex-col px-6 py-8">
            <Link href={`/r/${slug}`} className="flex items-center gap-2 text-slate-400 text-sm mb-8 hover:text-white">
                <ArrowLeft size={16} /> Volver a la carta
            </Link>
            <div className="max-w-sm mx-auto w-full">
                <div className="flex items-center gap-2 mb-6">
                    <Zap size={20} className="text-emerald-400" />
                    <h1 className="text-xl font-black text-white">Iniciar sesión</h1>
                </div>
                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-sm mb-4">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Teléfono</label>
                        <input type="tel" required value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                            placeholder="Tu número" className="w-full px-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Contraseña</label>
                        <input type="password" required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            placeholder="Tu contraseña" className="w-full px-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full py-3 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
                <p className="text-center text-xs text-slate-600 mt-6">
                    No tienes cuenta? <Link href={`/r/${slug}/registro`} className="text-emerald-400 font-bold">Regístrate VIP</Link>
                </p>
            </div>
        </div>
    );
}
