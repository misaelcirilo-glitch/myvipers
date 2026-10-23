'use client';

import { useState, useEffect, use } from 'react';
import { Star, Loader2, Phone, MapPin, Zap, Tag, ShoppingBag, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { childrenOf, categoryPath as buildCategoryPath, descendantIds } from '@/shared/lib/category-tree';

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
interface Promotion {
    id: string; title: string; description: string | null;
    discount_type: 'percentage' | 'fixed' | 'free_item' | 'points_multiplier' | null;
    discount_value: number | null; valid_until: string | null;
}
interface RetailCategory { id: string; name: string; parent_id: string | null; }
interface RetailProduct {
    id: string; name: string; description: string | null; brand: string | null;
    category_id: string | null; base_price: number; discount_price: number | null;
    image_url: string | null; inStock: boolean; variants: { size: string | null; color: string | null }[];
}

// Vertical del tenant: no se asume de antemano. Se resuelve vía `/api/public-tenant`
// antes de pedir el catálogo, para no renderizar nunca la carta de restaurante a un
// tenant retail (ni viceversa). Si esa llamada falla, se conserva el comportamiento
// histórico (menú de restaurante) para no romper tenants existentes.
export default function TenantPublicPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [businessType, setBusinessType] = useState<string | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItem[]>([]);
    const [retailCategories, setRetailCategories] = useState<RetailCategory[]>([]);
    const [retailProducts, setRetailProducts] = useState<RetailProduct[]>([]);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch(`/api/public-tenant?slug=${slug}`)
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(data => {
                setRestaurant(data.restaurant);
                setBusinessType(data.businessType || 'restaurant');
                if (data.businessType === 'retail') {
                    return fetch(`/api/retail-catalog?slug=${slug}`)
                        .then(r => r.ok ? r.json() : { categories: [], products: [] })
                        .then(cat => {
                            setRetailCategories(cat.categories || []);
                            setRetailProducts(cat.products || []);
                            // Retail arranca en la raíz del árbol (sin filtro), no en la
                            // primera categoría — el cliente navega raíz → hijas → ...
                        });
                }
                return fetch(`/api/menu?slug=${slug}`)
                    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
                    .then(menuData => {
                        setCategories(menuData.menu?.map((c: any) => ({ id: c.id, name: c.name, icon: c.icon })) || []);
                        const allItems: MenuItem[] = [];
                        (menuData.menu || []).forEach((c: any) => {
                            (c.items || []).forEach((item: any) => allItems.push({ ...item, category_name: c.name }));
                        });
                        setItems(allItems);
                        if (menuData.menu?.length > 0) setActiveCategory(menuData.menu[0].id);
                    });
            })
            .catch(() => {
                // Fallback retrocompatible: comportamiento histórico (menú de restaurante).
                setBusinessType('restaurant');
                return fetch(`/api/menu?slug=${slug}`)
                    .then(r => { if (!r.ok) throw new Error(); return r.json(); })
                    .then(data => {
                        setRestaurant(data.restaurant || { name: slug, slug });
                        setCategories(data.menu?.map((c: any) => ({ id: c.id, name: c.name, icon: c.icon })) || []);
                        const allItems: MenuItem[] = [];
                        (data.menu || []).forEach((c: any) => {
                            (c.items || []).forEach((item: any) => allItems.push({ ...item, category_name: c.name }));
                        });
                        setItems(allItems);
                        if (data.menu?.length > 0) setActiveCategory(data.menu[0].id);
                    })
                    .catch(() => setError(true));
            })
            .finally(() => setLoading(false));

        fetch(`/api/promotions?slug=${slug}`)
            .then(r => r.ok ? r.json() : { promotions: [] })
            .then(data => setPromotions(data.promotions || []))
            .catch(() => {});
    }, [slug]);

    if (loading) return <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center"><Loader2 size={32} className="animate-spin text-emerald-500" /></div>;

    if (error || !restaurant) {
        return (
            <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-6 text-center">
                <div>
                    <p className="text-4xl mb-4">🔎</p>
                    <h1 className="text-xl font-bold text-white mb-2">Negocio no encontrado</h1>
                    <p className="text-sm text-slate-500">El enlace puede estar incorrecto.</p>
                    <Link href="/" className="mt-4 inline-block text-emerald-400 text-sm font-bold hover:underline">Volver a MyVipers</Link>
                </div>
            </div>
        );
    }

    const isRetail = businessType === 'retail';

    // Árbol de categorías retail: breadcrumb (raíz→actual) + hijas directas de
    // la categoría activa (null = raíz). Seleccionar una filtra productos de
    // ella y de TODAS sus descendientes, y revela sus hijas para seguir bajando.
    const retailBreadcrumb = isRetail ? buildCategoryPath(retailCategories, activeCategory) : [];
    const retailChildCats = isRetail ? childrenOf(retailCategories, activeCategory) : [];
    const allowedCategoryIds = isRetail && activeCategory ? descendantIds(retailCategories, activeCategory) : null;

    const filteredRetail = retailProducts.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
        const matchCat = !allowedCategoryIds || (!!p.category_id && allowedCategoryIds.has(p.category_id));
        return matchSearch && matchCat;
    });

    const filteredMenu = items.filter(i => {
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
                        placeholder={isRetail ? 'Buscar productos...' : 'Buscar en la carta...'}
                        className="w-full mt-3 px-4 py-2.5 bg-[#0f0f1a] border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500"
                    />

                    {/* Navegación de categorías */}
                    {isRetail ? (
                        retailCategories.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {/* Breadcrumb: raíz → ... → categoría activa */}
                                {retailBreadcrumb.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap text-xs">
                                        <button onClick={() => setActiveCategory(null)}
                                            className={`font-bold transition-colors ${!activeCategory ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}>
                                            Todo
                                        </button>
                                        {retailBreadcrumb.map((c, i) => (
                                            <span key={c.id} className="flex items-center gap-1">
                                                <ChevronRight size={11} className="text-slate-600" />
                                                <button onClick={() => setActiveCategory(c.id)}
                                                    className={`font-bold transition-colors ${i === retailBreadcrumb.length - 1 ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}>
                                                    {c.name}
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {/* Hijas de la categoría activa (raíz si no hay ninguna activa) */}
                                {retailChildCats.length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                                        {retailChildCats.map(c => (
                                            <button key={c.id} onClick={() => setActiveCategory(c.id)}
                                                className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap bg-[#1a1a2e] border border-white/10 text-slate-400 hover:border-emerald-500/50 hover:text-white transition-all">
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    ) : (
                        categories.length > 0 && (
                            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4">
                                {categories.map((c) => (
                                    <button key={c.id} onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                            activeCategory === c.id ? 'bg-emerald-500 text-white' : 'bg-[#1a1a2e] border border-white/10 text-slate-400'
                                        }`}>
                                        {c.icon} {c.name}
                                    </button>
                                ))}
                            </div>
                        )
                    )}
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
                {/* Promociones activas */}
                {promotions.length > 0 && (
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-bold text-white mb-3">
                            <Tag size={16} className="text-amber-400" /> Promociones
                        </h2>
                        <div className="space-y-2">
                            {promotions.map(p => (
                                <div key={p.id} className="bg-gradient-to-br from-amber-500/10 to-red-500/5 border border-amber-500/20 rounded-2xl p-3 flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                                        <Tag size={16} className="text-amber-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm">{p.title}</p>
                                        {p.description && <p className="text-[11px] text-slate-400 mt-0.5">{p.description}</p>}
                                        <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[10px]">
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
                                                <span className="text-slate-500">Hasta {new Date(String(p.valid_until).slice(0, 10) + 'T00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isRetail ? (
                    <>
                        <div className="space-y-2">
                            {filteredRetail.map(p => <ProductCard key={p.id} product={p} />)}
                        </div>
                        {filteredRetail.length === 0 && <p className="text-center py-8 text-sm text-slate-500">No se encontraron productos</p>}
                    </>
                ) : (
                    <>
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
                            {filteredMenu.map(item => <MenuCard key={item.id} item={item} />)}
                        </div>

                        {filteredMenu.length === 0 && <p className="text-center py-8 text-sm text-slate-500">No se encontraron platos</p>}
                    </>
                )}
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

function ProductCard({ product }: { product: RetailProduct }) {
    const sizes = Array.from(new Set(product.variants.map(v => v.size).filter(Boolean))) as string[];
    const colors = Array.from(new Set(product.variants.map(v => v.color).filter(Boolean))) as string[];
    const hasDiscount = product.discount_price != null && product.discount_price < product.base_price;

    return (
        <div className={`bg-[#1a1a2e] border rounded-2xl overflow-hidden ${!product.inStock ? 'opacity-60' : 'border-white/5'}`}>
            <div className="p-4 flex gap-3">
                {product.image_url ? (
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="w-20 h-20 rounded-xl shrink-0 bg-[#0f0f1a] border border-white/5 flex items-center justify-center text-slate-600">
                        <ShoppingBag size={24} />
                    </div>
                )}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-sm">{product.name}</h3>
                            {!product.inStock && <span className="text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full font-bold">Agotado</span>}
                        </div>
                        {product.brand && <p className="text-[10px] text-slate-500">{product.brand}</p>}
                        {(sizes.length > 0 || colors.length > 0) && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                                {sizes.map(s => <span key={s} className="text-[9px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded-full">{s}</span>)}
                                {colors.map(c => <span key={c} className="text-[9px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded-full">{c}</span>)}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        {hasDiscount && <p className="text-xs text-slate-500 line-through">S/{Number(product.base_price).toFixed(2)}</p>}
                        <p className="text-lg font-black text-emerald-400">S/{Number(hasDiscount ? product.discount_price : product.base_price).toFixed(2)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
