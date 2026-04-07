'use client';
import { useState, useEffect } from 'react';
import { useSession } from '@/shared/lib/useSession';
import { Flame, Star, Search, Leaf, WheatOff, CircleAlert } from 'lucide-react';

interface MenuItem {
    id: string;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    is_spicy: boolean;
    is_vegetarian: boolean;
    is_gluten_free: boolean;
    is_featured: boolean;
}

interface MenuCategory {
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    items: MenuItem[];
}

export default function CartaPage() {
    const { user } = useSession();
    const [menu, setMenu] = useState<MenuCategory[]>([]);
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/menu').then(r => r.json()).then(data => {
            setMenu(data.menu || []);
            if (data.menu?.length > 0) setActiveCategory(data.menu[0].id);
        }).finally(() => setLoading(false));
    }, []);

    const filteredMenu = menu.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            item.description?.toLowerCase().includes(search.toLowerCase())
        ),
    })).filter(cat => cat.items.length > 0);

    const displayMenu = search ? filteredMenu : (activeCategory ? menu.filter(c => c.id === activeCategory) : menu);

    return (
        <div className="space-y-5 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-6">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Hola, {user?.name?.split(' ')[0]}</p>
                    <h1 className="text-xl font-black">Nuestra Carta</h1>
                </div>
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
                    <Star size={14} className="text-amber-400" />
                    <span className="text-amber-400 font-black text-sm">{user?.availablePoints}</span>
                </div>
            </div>

            {/* Search */}
            <div className="relative px-4">
                <Search size={16} className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    placeholder="Buscar plato..."
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Category Pills */}
            {!search && (
                <div className="flex gap-2 overflow-x-auto pb-1 px-4 scrollbar-none">
                    {menu.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${activeCategory === cat.id
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                : 'bg-white/5 text-slate-400 border border-white/10'
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Menu Items */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-6 px-4 pb-4">
                    {displayMenu.map(cat => (
                        <div key={cat.id}>
                            {search && <h2 className="text-sm font-black text-amber-400 uppercase tracking-widest mb-3">{cat.name}</h2>}
                            <div className="space-y-3">
                                {cat.items.map(item => (
                                    <div
                                        key={item.id}
                                        className={`bg-white/5 border rounded-2xl overflow-hidden transition-all ${item.is_featured ? 'border-amber-500/30 shadow-lg shadow-amber-500/5' : 'border-white/10'}`}
                                    >
                                        <div className="p-4 flex gap-3">
                                            {/* Foto pequena */}
                                            {item.image_url && (
                                                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                                                    <img
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            {/* Info */}
                                            <div className="flex-1 flex flex-col justify-between min-w-0">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-black text-white">{item.name}</h3>
                                                        {item.is_featured && <Flame size={14} className="text-amber-400" />}
                                                    </div>
                                                    {item.description && (
                                                        <p className="text-slate-400 text-xs mt-1 leading-relaxed line-clamp-2">{item.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        {item.is_spicy && (
                                                            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full font-bold">
                                                                <CircleAlert size={10} /> Picante
                                                            </span>
                                                        )}
                                                        {item.is_vegetarian && (
                                                            <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full font-bold">
                                                                <Leaf size={10} /> Veggie
                                                            </span>
                                                        )}
                                                        {item.is_gluten_free && (
                                                            <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full font-bold">
                                                                <WheatOff size={10} /> Sin gluten
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-lg font-black text-amber-400 mt-1">S/{Number(item.price).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {displayMenu.length === 0 && !loading && (
                        <div className="text-center py-12 text-slate-500">
                            <p className="font-bold">No se encontraron platos</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
