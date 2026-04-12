'use client';
import { Zap, Star, UtensilsCrossed, Users, TrendingUp, Gift, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/shared/lib/useSession';

export default function MyVipersLandingPage() {
    const { user, loading } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) router.replace('/carta');
    }, [user, loading, router]);

    return (
        <div className="min-h-screen bg-[#0f0f1a]">
            <nav className="border-b border-white/5 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-lg flex items-center justify-center">
                            <Zap size={18} className="text-white" />
                        </div>
                        <span className="text-lg font-black text-white">MyVipers</span>
                    </div>
                    <div className="flex gap-3">
                        <Link href="/login" className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">Entrar</Link>
                        <Link href="/crear-restaurante" className="px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-600 transition-colors">Crear restaurante</Link>
                    </div>
                </div>
            </nav>

            <section className="max-w-5xl mx-auto px-6 py-20 text-center">
                <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full mb-6 uppercase tracking-widest">
                    Fideliza. Vende mas. Crece.
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white max-w-3xl mx-auto leading-tight">
                    Tu restaurante merece clientes que <span className="text-emerald-400">vuelvan</span>
                </h1>
                <p className="text-lg text-slate-400 mt-6 max-w-xl mx-auto">
                    Carta digital, programa de puntos VIP, reservas y promociones. Todo en una plataforma. Gratis para empezar.
                </p>
                <div className="flex items-center justify-center gap-4 mt-10">
                    <Link href="/crear-restaurante" className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-lg font-bold rounded-2xl hover:brightness-110 transition-all shadow-2xl shadow-emerald-500/30 flex items-center gap-2">
                        Empezar gratis <ArrowRight size={20} />
                    </Link>
                </div>
                <p className="text-xs text-slate-600 mt-4">Sin tarjeta de credito — Activo en 5 minutos</p>
            </section>

            <section className="max-w-5xl mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { icon: Star, title: 'Puntos VIP', desc: 'Tus clientes acumulan puntos por cada visita. Canjean recompensas y vuelven.', color: 'text-amber-400' },
                        { icon: UtensilsCrossed, title: 'Carta digital + QR', desc: 'Tu carta en el movil del cliente. Con fotos, precios y alergenos.', color: 'text-blue-400' },
                        { icon: Gift, title: 'Promociones', desc: 'Lanza ofertas, 2x1, happy hours. Activa y desactiva en un click.', color: 'text-purple-400' },
                        { icon: Users, title: 'CRM de clientes', desc: 'Conoce a tus clientes: visitas, puntos, favoritos, historial.', color: 'text-green-400' },
                        { icon: TrendingUp, title: 'Reservas online', desc: 'Tus clientes reservan desde su movil. Tu lo ves en el panel.', color: 'text-cyan-400' },
                        { icon: Zap, title: 'Multi-sucursal', desc: 'Gestiona varios locales desde una sola cuenta. Escala sin limite.', color: 'text-rose-400' },
                    ].map(f => (
                        <div key={f.title} className="bg-[#1a1a2e] border border-white/5 rounded-2xl p-6">
                            <f.icon size={28} className={f.color} />
                            <h3 className="text-white font-bold mt-3 mb-1">{f.title}</h3>
                            <p className="text-sm text-slate-400">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="max-w-3xl mx-auto px-6 py-16 text-center">
                <h2 className="text-3xl font-black text-white mb-4">Listo en 5 minutos</h2>
                <p className="text-slate-400 mb-8">Crea tu restaurante, sube tu carta, genera el QR y empieza a fidelizar clientes hoy.</p>
                <Link href="/crear-restaurante" className="inline-block px-10 py-4 bg-emerald-500 text-white text-lg font-bold rounded-2xl hover:bg-emerald-600 transition-colors shadow-2xl shadow-emerald-500/30">
                    Crear mi restaurante gratis
                </Link>
            </section>

            <footer className="border-t border-white/5 py-8 px-6">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap size={16} className="text-emerald-400" />
                        <span className="text-sm font-bold text-white">MyVipers</span>
                    </div>
                    <p className="text-xs text-slate-600">2026 MyVipers. Plataforma de fidelizacion para restaurantes.</p>
                </div>
            </footer>
        </div>
    );
}
