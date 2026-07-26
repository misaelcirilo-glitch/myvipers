'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Zap, ArrowLeft } from 'lucide-react';

export default function CrearRestaurantePage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        restaurantName: '', ownerName: '', phone: '', email: '', password: '',
        city: '', country: 'PE',
    });

    const slug = form.restaurantName
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/restaurants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            // Navegación dura: el SessionProvider (layout raíz) solo lee la cookie
            // al montar; con router.push /admin rebotaría al login.
            window.location.href = '/admin';
        } catch (err: any) {
            setError(err.message || 'Error al crear');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex flex-col px-6 py-8 bg-[#0f0f1a]">
            <Link href="/" className="flex items-center gap-2 text-slate-400 text-sm mb-8 hover:text-white transition-colors">
                <ArrowLeft size={16} /> Volver
            </Link>

            <div className="max-w-md mx-auto w-full">
                <div className="flex items-center gap-2 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center">
                        <Zap size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white">Crear restaurante</h1>
                        <p className="text-xs text-slate-500">MyVipers — Gratis para empezar</p>
                    </div>
                </div>

                {/* Progress */}
                <div className="flex gap-2 mb-8">
                    {[1, 2].map(s => (
                        <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-emerald-500' : 'bg-white/10'}`} />
                    ))}
                </div>

                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-sm mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {step === 1 && (
                        <>
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Nombre del restaurante</label>
                                <input required value={form.restaurantName} onChange={e => setForm(p => ({ ...p, restaurantName: e.target.value }))}
                                    placeholder="Ej: La Parrilla de Juan"
                                    className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                                {slug && <p className="text-xs text-slate-500 mt-1">URL: myvipers.com/<span className="text-emerald-400 font-bold">{slug}</span></p>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Ciudad</label>
                                    <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Lima, CDMX..."
                                        className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Pais</label>
                                    <select value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white outline-none focus:border-emerald-500 text-sm">
                                        <option value="PE">Peru</option>
                                        <option value="MX">Mexico</option>
                                        <option value="CO">Colombia</option>
                                        <option value="ES">Espana</option>
                                        <option value="AR">Argentina</option>
                                        <option value="CL">Chile</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" onClick={() => { if (form.restaurantName) setStep(2) }}
                                className="w-full py-3 bg-emerald-500 text-white font-bold text-sm rounded-xl hover:bg-emerald-600 transition-colors">
                                Siguiente
                            </button>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Tu nombre</label>
                                <input required value={form.ownerName} onChange={e => setForm(p => ({ ...p, ownerName: e.target.value }))} placeholder="Juan Garcia"
                                    className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Telefono</label>
                                <input required value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="999 123 456"
                                    className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Email (opcional)</label>
                                <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="tu@email.com" type="email"
                                    className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1 block">Contrasena</label>
                                <input required type="password" minLength={4} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Minimo 4 caracteres"
                                    className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-600 outline-none focus:border-emerald-500 text-sm" />
                            </div>

                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                <p className="text-xs text-emerald-400 font-bold mb-1">Tu restaurante incluye gratis:</p>
                                <ul className="text-xs text-emerald-300/70 space-y-0.5">
                                    <li>Carta digital con QR</li>
                                    <li>Sistema de puntos VIP</li>
                                    <li>Reservas online</li>
                                    <li>5 mesas + 3 recompensas default</li>
                                </ul>
                            </div>

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setStep(1)}
                                    className="flex-1 py-3 bg-[#1a1a2e] border border-[#2a2a3e] text-slate-400 font-bold text-sm rounded-xl hover:bg-[#22223a] transition-colors">
                                    Atras
                                </button>
                                <button type="submit" disabled={loading}
                                    className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-sm rounded-xl hover:brightness-110 disabled:opacity-50 transition-all">
                                    {loading ? 'Creando...' : 'Crear restaurante'}
                                </button>
                            </div>
                        </>
                    )}
                </form>

                <p className="text-center text-xs text-slate-600 mt-6">
                    Ya tienes cuenta? <Link href="/login" className="text-emerald-400 font-bold hover:text-emerald-300">Entrar</Link>
                </p>
            </div>
        </div>
    );
}
