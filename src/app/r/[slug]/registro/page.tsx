'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Zap, Gift } from 'lucide-react';

export default function RestaurantRegistroPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const router = useRouter();
    const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', referralCode: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await fetch('/api/auth/register', {
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
                <div className="flex items-center gap-2 mb-2">
                    <Zap size={20} className="text-emerald-400" />
                    <h1 className="text-xl font-black text-white">Registro VIP</h1>
                </div>
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 mb-6">
                    <Gift size={14} className="text-emerald-400" />
                    <p className="text-xs text-emerald-300">Regístrate y recibe <span className="font-bold">50 puntos</span> de bienvenida</p>
                </div>

                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-sm mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Nombre completo</label>
                        <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Tu nombre" className="w-full px-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Teléfono</label>
                        <input type="tel" required value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                            placeholder="999 123 456" className="w-full px-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Email (opcional)</label>
                        <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="tu@email.com" className="w-full px-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Contraseña</label>
                        <input type="password" required minLength={4} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            placeholder="Mínimo 4 caracteres" className="w-full px-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Código referido (opcional)</label>
                        <input type="text" value={form.referralCode} onChange={e => setForm(p => ({ ...p, referralCode: e.target.value }))}
                            placeholder="ABC123" className="w-full px-4 py-3 bg-[#1a1a2e] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                    </div>
                    <button type="submit" disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-sm rounded-xl hover:brightness-110 disabled:opacity-50 transition-all">
                        {loading ? 'Registrando...' : 'Crear cuenta VIP'}
                    </button>
                </form>
                <p className="text-center text-xs text-slate-600 mt-6">
                    Ya tienes cuenta? <Link href={`/r/${slug}/login`} className="text-emerald-400 font-bold">Entrar</Link>
                </p>
            </div>
        </div>
    );
}
