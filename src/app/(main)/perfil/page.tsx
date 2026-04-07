'use client';
import { useSession } from '@/shared/lib/useSession';
import { User, Star, Share2, LogOut, Flame } from 'lucide-react';

const VIP_COLORS: Record<string, string> = {
    bronce: 'from-amber-700 to-amber-900',
    plata: 'from-slate-400 to-slate-600',
    oro: 'from-yellow-400 to-amber-600',
    inca: 'from-red-500 to-amber-500',
};

export default function PerfilPage() {
    const { user, logout } = useSession();

    const copyReferral = () => {
        if (user?.referralCode) {
            navigator.clipboard.writeText(user.referralCode);
            alert('Código copiado: ' + user.referralCode);
        }
    };

    return (
        <div className="px-4 pt-6 space-y-6 max-w-2xl mx-auto">
            {/* Profile Card */}
            <div className={`bg-gradient-to-br ${VIP_COLORS[user?.vipLevel || 'bronce']} rounded-2xl p-6 text-center space-y-3`}>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                    <User size={32} className="text-white" />
                </div>
                <h1 className="text-xl font-black text-white">{user?.name}</h1>
                <p className="text-white/70 text-sm">{user?.phone}</p>
                <div className="flex items-center justify-center gap-2">
                    <Flame size={16} className="text-white" />
                    <span className="text-white font-black uppercase text-sm">{user?.vipLevel}</span>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                    <Star size={20} className="text-amber-400 mx-auto mb-1" />
                    <p className="text-2xl font-black text-amber-400">{user?.availablePoints}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Disponibles</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                    <Star size={20} className="text-slate-400 mx-auto mb-1" />
                    <p className="text-2xl font-black">{user?.totalPoints}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Acumulados</p>
                </div>
            </div>

            {/* Referral */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Tu código de referido</p>
                <div className="flex items-center gap-3">
                    <code className="flex-1 bg-white/5 border border-white/10 px-4 py-3 rounded-xl text-amber-400 font-black text-lg tracking-widest text-center">
                        {user?.referralCode}
                    </code>
                    <button onClick={copyReferral} className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 hover:bg-amber-500/20 transition">
                        <Share2 size={20} />
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">Comparte y gana 100 puntos por cada amigo</p>
            </div>

            {/* Logout */}
            <button
                onClick={logout}
                className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/20 transition"
            >
                <LogOut size={16} /> Cerrar sesión
            </button>
        </div>
    );
}
