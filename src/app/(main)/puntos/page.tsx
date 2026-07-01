'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/shared/lib/useSession';
import { useI18n } from '@/shared/lib/i18n';
import { useRestaurant } from '@/shared/lib/useRestaurant';
import { Star, Gift, TrendingUp, TrendingDown, Award, Sparkles, Tag } from 'lucide-react';

interface PointHistory { type: string; points: number; description: string; created_at: string; }
interface Reward { id: string; name: string; description: string; points_cost: number; category: string; }
interface Promotion {
    id: string; title: string; description: string | null; image_url: string | null;
    discount_type: 'percentage' | 'fixed' | 'free_item' | 'points_multiplier' | null;
    discount_value: number | null; min_points: number;
    valid_from: string | null; valid_until: string | null;
}

export default function PuntosPage() {
    const { user, refresh } = useSession();
    const { t } = useI18n();
    const { vipLevels } = useRestaurant();
    const [history, setHistory] = useState<PointHistory[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [tab, setTab] = useState<'rewards' | 'history'>('rewards');
    const [redeeming, setRedeeming] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/points').then(r => r.json()).then(data => {
            setHistory(data.history || []);
            setRewards(data.rewards || []);
        });
        fetch('/api/promotions').then(r => r.json()).then(data => {
            setPromotions(data.promotions || []);
        });
    }, []);

    const handleRedeem = async (rewardId: string) => {
        if (!confirm(t.puntos.confirmRedeem)) return;
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

    const currentLevel = vipLevels.find(l => l.key === user?.vipLevel) || vipLevels[0];
    const nextLevel = vipLevels.find(l => l.min_points > (user?.totalPoints || 0));
    const progress = nextLevel ? Math.min(100, ((user?.totalPoints || 0) / nextLevel.min_points) * 100) : 100;

    // Translate level key if available, fallback to key capitalized
    const levelLabel = (key: string) => {
        const labels = t.puntos.levels as Record<string, string>;
        return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
    };

    return (
        <div className="px-4 pt-6 space-y-5 pb-4 max-w-2xl mx-auto">
            <h1 className="text-xl font-black">{t.puntos.title}</h1>

            {/* Points Card */}
            <div className={`bg-gradient-to-br ${currentLevel?.color || 'from-amber-700 to-amber-900'} rounded-2xl p-6 text-center space-y-3 relative overflow-hidden`}>
                <div className="absolute top-2 right-3 text-4xl opacity-30">{currentLevel?.icon}</div>
                <Star size={28} className="text-white mx-auto" />
                <p className="text-4xl font-black text-white">{user?.availablePoints || 0}</p>
                <p className="text-white/70 text-xs uppercase tracking-widest font-bold">{t.puntos.availablePoints}</p>
                <div className="flex items-center justify-center gap-2">
                    <Award size={14} className="text-white/80" />
                    <span className="text-white font-black uppercase text-sm">{t.puntos.level} {levelLabel(currentLevel?.key || 'bronce')}</span>
                </div>

                {nextLevel && (
                    <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-white/60 font-bold mb-1">
                            <span>{user?.totalPoints || 0} {t.puntos.accumulated}</span>
                            <span>{nextLevel.min_points} {t.puntos.nextLevel} {levelLabel(nextLevel.key)}</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2">
                            <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Promociones activas */}
            {promotions.length > 0 && (
                <div className="space-y-2">
                    <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                        <Tag size={12} className="text-amber-400" /> Promociones activas
                    </h2>
                    <div className="space-y-2">
                        {promotions.map(p => (
                            <div key={p.id} className="bg-gradient-to-br from-amber-500/10 to-red-500/5 border border-amber-500/20 rounded-2xl p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                        <Tag size={18} className="text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-white text-sm">{p.title}</p>
                                        {p.description && <p className="text-xs text-slate-400 mt-0.5">{p.description}</p>}
                                        <div className="flex items-center gap-2 mt-2 flex-wrap text-[10px]">
                                            {p.discount_type === 'percentage' && p.discount_value != null && (
                                                <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">-{p.discount_value}%</span>
                                            )}
                                            {p.discount_type === 'fixed' && p.discount_value != null && (
                                                <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">-S/{p.discount_value}</span>
                                            )}
                                            {p.discount_type === 'free_item' && (
                                                <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">Item gratis</span>
                                            )}
                                            {p.discount_type === 'points_multiplier' && p.discount_value != null && (
                                                <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold">x{p.discount_value} puntos</span>
                                            )}
                                            {p.valid_until && (
                                                <span className="text-slate-500">Hasta {new Date(p.valid_until).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-[#1a1a2e] rounded-xl p-1 border border-[#2a2a3e]">
                <button
                    onClick={() => setTab('rewards')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tab === 'rewards' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}
                >
                    <Gift size={14} /> {t.puntos.rewardsTab}
                </button>
                <button
                    onClick={() => setTab('history')}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${tab === 'history' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}
                >
                    <Sparkles size={14} /> {t.puntos.historyTab}
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
                                        <span className="text-slate-500 text-[10px]">{t.puntos.points}</span>
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
                                    {redeeming === r.id ? '...' : t.puntos.redeem}
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
                        <p className="text-center text-slate-500 py-8">{t.puntos.noHistory}</p>
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
