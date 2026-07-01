'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/shared/lib/useSession';
import { useI18n } from '@/shared/lib/i18n';
import { Megaphone, Star, Percent, Tag, Gift, Sparkles, Lock, CalendarClock } from 'lucide-react';

interface Promotion {
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    discount_type: 'percentage' | 'fixed' | 'free_item' | 'points_multiplier' | null;
    discount_value: number | null;
    min_points: number;
    valid_from: string | null;
    valid_until: string | null;
}

export default function PromocionesPage() {
    const { user } = useSession();
    const { t, formatPrice, formatDate } = useI18n();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/promotions')
            .then(r => r.json())
            .then(data => setPromotions(data.promotions || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const discountBadge = (p: Promotion) => {
        switch (p.discount_type) {
            case 'percentage':
                return { icon: Percent, label: `${p.discount_value}% ${t.promociones.off}` };
            case 'fixed':
                return { icon: Tag, label: `${formatPrice(Number(p.discount_value || 0))} ${t.promociones.off}` };
            case 'free_item':
                return { icon: Gift, label: t.promociones.freeItem };
            case 'points_multiplier':
                return { icon: Sparkles, label: `x${p.discount_value} ${t.promociones.pointsMultiplier}` };
            default:
                return null;
        }
    };

    return (
        <div className="px-4 pt-6 space-y-5 pb-4 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{t.promociones.subtitle}</p>
                    <h1 className="text-xl font-black">{t.promociones.title}</h1>
                </div>
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                    <Star size={14} className="text-amber-400" />
                    <span className="text-amber-400 font-black text-sm">{user?.availablePoints || 0}</span>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : promotions.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                    <Megaphone size={40} className="mx-auto mb-3 opacity-40" />
                    <p className="font-bold">{t.promociones.empty}</p>
                    <p className="text-xs mt-1">{t.promociones.emptyHint}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {promotions.map(p => {
                        const badge = discountBadge(p);
                        const unlocked = (user?.availablePoints || 0) >= (p.min_points || 0);
                        return (
                            <div
                                key={p.id}
                                className={`bg-[#1a1a2e] border rounded-2xl overflow-hidden transition-all ${unlocked ? 'border-amber-500/30' : 'border-[#2a2a3e]'}`}
                            >
                                {p.image_url && (
                                    <div className="w-full h-36 overflow-hidden">
                                        <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-black text-white leading-tight">{p.title}</h3>
                                        {badge && (
                                            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full font-bold uppercase whitespace-nowrap shrink-0">
                                                <badge.icon size={11} /> {badge.label}
                                            </span>
                                        )}
                                    </div>

                                    {p.description && (
                                        <p className="text-slate-400 text-xs leading-relaxed">{p.description}</p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                        {(p.valid_from || p.valid_until) && (
                                            <span className="flex items-center gap-1 text-[10px] text-slate-500 bg-white/5 px-2 py-1 rounded-full font-bold">
                                                <CalendarClock size={10} />
                                                {p.valid_until
                                                    ? `${t.promociones.until} ${formatDate(p.valid_until)}`
                                                    : `${t.promociones.from} ${formatDate(p.valid_from!)}`}
                                            </span>
                                        )}
                                        {p.min_points > 0 && (
                                            <span className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-bold ${unlocked ? 'text-green-400 bg-green-400/10' : 'text-slate-400 bg-white/5'}`}>
                                                {unlocked ? <Star size={10} /> : <Lock size={10} />}
                                                {unlocked
                                                    ? t.promociones.unlocked
                                                    : `${t.promociones.requires} ${p.min_points} ${t.promociones.points}`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
