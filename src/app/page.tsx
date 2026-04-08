'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/shared/lib/useSession';
import { Flame, Star, UtensilsCrossed } from 'lucide-react';

export default function LandingPage() {
    const { user, loading } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (!loading && user) router.replace('/carta');
    }, [user, loading, router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0f0f1a]">
            <div className="text-center space-y-6 max-w-sm">
                <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/20">
                    <Flame size={48} className="text-white" />
                </div>

                <div>
                    <h1 className="text-4xl font-black tracking-tight">
                        EL <span className="text-amber-400">MACHAY</span>
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 font-medium tracking-widest uppercase">Parrillas & Ceviche Peruano</p>
                    <p className="text-xs text-slate-500 mt-0.5">Pomabamba, Ancash</p>
                </div>

                <div className="flex items-center justify-center gap-6 text-slate-400">
                    <div className="flex flex-col items-center gap-1">
                        <UtensilsCrossed size={20} className="text-amber-400" />
                        <span className="text-[10px] uppercase tracking-widest font-bold">Carta</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Star size={20} className="text-amber-400" />
                        <span className="text-[10px] uppercase tracking-widest font-bold">Puntos VIP</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Flame size={20} className="text-amber-400" />
                        <span className="text-[10px] uppercase tracking-widest font-bold">Reservar</span>
                    </div>
                </div>

                <div className="space-y-3 pt-4">
                    <button
                        onClick={() => router.push('/registro')}
                        className="w-full py-4 bg-gradient-to-r from-amber-500 to-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all"
                    >
                        Registrarme VIP
                    </button>
                    <button
                        onClick={() => router.push('/login')}
                        className="w-full py-4 bg-[#1a1a2e] border border-[#2a2a3e] text-slate-300 font-bold text-sm uppercase tracking-widest rounded-2xl hover:bg-[#22223a] active:scale-95 transition-all"
                    >
                        Ya tengo cuenta
                    </button>
                </div>

                <p className="text-[10px] text-slate-600 pt-2">
                    Regístrate y recibe <span className="text-amber-400 font-bold">50 puntos</span> de bienvenida
                </p>
            </div>
        </div>
    );
}
