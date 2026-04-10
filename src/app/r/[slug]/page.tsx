'use client';

import { useState, useEffect, use } from 'react';
import { Star, UtensilsCrossed, CalendarDays, Loader2, Phone, MapPin, Zap } from 'lucide-react';
import Link from 'next/link';

interface Restaurant {
    name: string; slug: string; description: string | null;
    logo_url: string | null; phone: string | null; city: string | null;
}
interface Category { id: string; name: string; icon: string | null; }
interface MenuItem {
    id: string; name: string; description: string | null; price: number;
    image_url: string | null; is_featured: boolean; is_spicy: boolean;
    is_vegetarian: boolean; category_name: string | null;
}

export default function RestaurantPublicPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch(`/api/menu?slug=${slug}`)
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(data => {
                setRestaurant(data.restaurant || { name: slug, slug });
                setCategories(data.menu?.map((c: any) => ({ id: c.id, name: c.name, icon: c.icon })) || []);
                const allItems: MenuItem[] = [];
                (data.menu || []).forEach((c: any) => {
                    (c.items || []).forEach((item: any) => {
                        allItems.push({ ...item, category_name: c.name });
                    });
                });
                setItems(allItems);
                if (data.menu?.length > 0) setActiveCategory(data.menu[0].id);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [slug]);

    if (loading) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-emerald-500" /></div>;

    if (error || !restaurant) {
        return (
            <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-6 text-center">
                <div>
                    <p className="text-4xl mb-4">🍽️</p>
                    <h1 className="text-xl font-bold text-white mb-2">Restaurante no encontrado</h1>
                    <p className="text-sm text-slate-500">El enlace puede estar incorrecto.</p>
                    <Link href="/" className="mt-4 inline-block text-emerald-400 text-sm font-bold hover:underline">Volver a MyVipers</Link>
                </div>
            </div>
        );
    }

    const filtered = items.filter(i => {
        const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
        const matchCat = !activeCategory || categories.find(c => c.id === activeCategory)?.name === i.category_name;
        return matchSearch && matchCat;
    });

    const featured = items.filter(i => i.is_featured);

    return (
        <div className="min-h-screen bg-[#0f0f1a] pb-24">
            {/* Header */}
            <div className="bg-[#1a1a2e] border-b border-white/5 sticky top-0 z-30">
                <div className="max-w-lg mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center text-white font-black text-sm">
                                {restaurant.name[0]}
                            </div>
                            <div>
                                <h1 className="font-bold text-white text-sm">{restaurant.name}</h1>
                                {restaurant.city && (
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                        <MapPin size={8} /> {restaurant.city}
                                    </p>
                                )}
                            </div>
                        </div>
                        {restaurant.phone && (
                            <a href={`tel:${restaurant.phone}`} className="w-9 h-9 bg-[#1a1a2e] border border-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors">
                                <Phone size={16} />
                            </a>
                        )}
                    </div>

                    {/* Search */}
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar en la carta..."
                        className="w-full mt-3 px-4 py-2.5 bg-[#0f0f1a] border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500"
                    />

                    {/* Category pills */}
                    {categories.length > 0 && (
                        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4">
                            {categories.map(c => (
                                <button key={c.id} onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                        activeCategory === c.id ? 'bg-emerald-500 text-white' : 'bg-[#1a1a2e] border border-white/10 text-slate-400'
                                    }`}>
                                    {c.icon} {c.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Featured */}
                {featured.length > 0 && !search && !activeCategory && (
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
                            <Star size={16} className="text-amber-400" /> Destacados
                        </h2>
                        <div className="space-y-2">
                            {featured.map(item => <MenuCard key={item.id} item={item} />)}
                        </div>
                    </div>
                )}

                {/* Items */}
                <div className="space-y-2">
                    {filtered.map(item => <MenuCard key={item.id} item={item} />)}
                </div>

                {filtered.length === 0 && <p className="text-center py-8 text-sm text-slate-500">No se encontraron platos</p>}
            </div>

            {/* Bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] border-t border-white/5 z-40">
                <div className="max-w-lg mx-auto px-4 py-3 flex gap-2">
                    <Link href={`/r/${slug}/registro`}
                        className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-sm text-center rounded-xl hover:brightness-110 transition-all">
                        Registrarme VIP
                    </Link>
                    <Link href={`/r/${slug}/login`}
                        className="flex-1 py-3 bg-[#0f0f1a] border border-white/10 text-slate-300 font-bold text-sm text-center rounded-xl hover:bg-[#22223a] transition-colors">
                        Ya tengo cuenta
                    </Link>
                </div>
                <p className="text-center text-[8px] text-slate-600 pb-2 flex items-center justify-center gap-1">
                    <Zap size={8} className="text-emerald-500" /> Powered by MyVipers
                </p>
            </div>
        </div>
    );
}

function MenuCard({ item }: { item: MenuItem }) {
    return (
        <div className={`bg-[#1a1a2e] border rounded-2xl overflow-hidden ${item.is_featured ? 'border-amber-500/30' : 'border-white/5'}`}>
            <div className="p-4 flex gap-3">
                {item.image_url && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-sm">{item.name}</h3>
                            {item.is_featured && <Star size={12} className="text-amber-400 fill-amber-400" />}
                        </div>
                        {item.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>}
                        <div className="flex gap-1 mt-1">
                            {item.is_spicy && <span className="text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full font-bold">Picante</span>}
                            {item.is_vegetarian && <span className="text-[9px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full font-bold">Veggie</span>}
                        </div>
                    </div>
                    <p className="text-lg font-black text-emerald-400 mt-1">S/{Number(item.price).toFixed(2)}</p>
                </div>
            </div>
        </div>
    );
}
