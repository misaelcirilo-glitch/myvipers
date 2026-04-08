'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/shared/lib/useSession';
import { Star, Gift, TrendingUp, TrendingDown, Award, Sparkles } from 'lucide-react';

interface PointHistory { type: string; points: number; description: string; created_at: string; }
interface Reward { id: string; name: string; description: string; points_cost: number; category: string; }

const VIP_LEVELS = [
    { key: 'bronce', label: 'Bronce', min: 0, color: 'from-amber-700 to-amber-900', icon: '🥉' },
    { key: 'plata', label: 'Plata', min: 500, color: 'from-slate-400 to-slate-600', icon: '🥈' },
    { key: 'oro', label: 'Oro', min: 1500, color: 'from-yellow-400 to-amber-500', icon: '🥇' },
    { key: 'inca', label: 'Inca', min: 5000, color: 'from-red-500 to-amber-500', icon: '👑' },
];

export default function PuntosPage() {
    const { user, refresh } = useSession();
    const [history, setHistory] = useState<PointHistory[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [tab, setTab] = useState<'rewards' | 'history'>('rewards');
    const [redeeming, setRedeeming] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/points').then(r => r.json()).then(data => {
            setHistory(data.history || []);
            setRewards(data.rewards || []);
        });
    }, []);

    const handleRedeem = async (rewardId: string) => {
        if (!confirm('¿Canjear este premio?')) return;
        setRedeeming(rewardId);
        try {
            const res = await fetch('/api/points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rewardId }),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error); return; }
            alert(data.message);
            refresh();
            const updated = await fetch('/api/points').then(r => r.json());
            setHistory(updated.history || []);
        } finally {
            setRedeeming(null);
        }
    };

    const currentLevel = VIP_LEVELS.find(l => l.key === user?.vipLevel) || VIP_LEVELS[0];
    const nextLevel = VIP_LEVELS.find(l => l.min > (user?.totalPoints || 0));
    const progress = nextLevel ? Math.min(100, ((user?.totalPoints || 0) / nextLevel.min) * 100) : 100;

    return (
        <div className="px-4 pt-6 space-y-5 pb-4 max-w-2xl mx-auto">
            <h1 className="text-xl font-black">Mis Puntos VIP</h1>

            {/* Points Card */}
            <div className={`bg-gradient-to-br ${currentLevel.color} rounded-2xl p-6 text-center space-y-3 relative overflow-hidden`}>
                <div className="absolute top-2 right-3 text-4xl opacity-30">{currentLevel.icon}</div>
                <Star size={28} className="text-white mx-auto" />
                <p className="text-4xl font-black text-white">{user?.availablePoints || 0}</p>
                <p className="text-white/70 text-xs uppercase tracking-widest font-bold">Puntos disponibles</p>
                <div className="flex items-center justify-center gap-2">
                    <Award size={14} className="text-white/80" />
                    <span className="text-white font-black uppercase text-sm">Nivel {currentLevel.label}</span>
                </div>

                {nextLevel && (
                    <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-white/60 font-bold mb-1">
                            <span>{user?.totalPoints || 0} pts acumulados</span>
                            <span>{nextLevel.min} pts → {nextLevel.label}</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex bg-[#1a1a2e] rounded-xl p-1 border border-[#2a2a3e]">
                <button
                    onClick={() => setTab('rewards')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tab === 'rewards' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}
                >
                    <Gift size={14} /> Premios
                </button>
                <button
                    onClick={() => setTab('history')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tab === 'history' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}
                >
                    <Sparkles size={14} /> Historial
                </button>
            </div>

            {/* Rewards */}
            {tab === 'rewards' && (
                <div className="space-y-3">
                    {rewards.map(r => {
                        const canRedeem = (user?.availablePoints || 0) >= r.points_cost;
                        return (
                            <div key={r.id} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-sm">{r.name}</h3>
                                    <p className="text-slate-400 text-xs mt-0.5">{r.description}</p>
                                    <div className="flex items-center gap-1 mt-2">
                                        <Star size={12} className="text-amber-400" />
                                        <span className="text-amber-400 font-black text-sm">{r.points_cost}</span>
                                        <span className="text-slate-500 text-[10px]">puntos</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRedeem(r.id)}
                                    disabled={!canRedeem || redeeming === r.id}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${canRedeem
                                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95'
                                        : 'bg-[#1a1a2e] text-slate-500 cursor-not-allowed'
                                    }`}
                                >
                                    {redeeming === r.id ? '...' : 'Canjear'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* History */}
            {tab === 'history' && (
                <div className="space-y-2">
                    {history.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">Sin movimientos aún</p>
                    ) : history.map((h, i) => (
                        <div key={i} className="flex items-center justify-between py-3 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                {h.points > 0
                                    ? <TrendingUp size={16} className="text-green-400" />
                                    : <TrendingDown size={16} className="text-red-400" />
                                }
                                <div>
                                    <p className="text-sm font-bold">{h.description}</p>
                                    <p className="text-[10px] text-slate-500">
                                        {new Date(h.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <span className={`font-black text-sm ${h.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {h.points > 0 ? '+' : ''}{h.points}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
