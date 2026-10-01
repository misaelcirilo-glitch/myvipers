'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Loader2, Package, AlertTriangle, Layers, ArrowUpDown, FolderTree, ChevronDown, Upload } from 'lucide-react';

// Retail — gestión de catálogo, categorías, variantes y stock.
// PRP-myvipers-001 (Fase 3) + PRP-myvipers-002 (categorías, Fase 1).
// Solo se monta cuando el tenant tiene el módulo 'retail' (gating en admin/page).

const money = (n: unknown) => `S/${Number(n || 0).toFixed(2)}`;

interface Variant {
    id: string;
    product_id: string;
    size: string | null;
    color: string | null;
    sku: string | null;
    price: string | number | null;
    stock: number;
    low_stock_threshold: number;
}

interface Product {
    id: string;
    name: string;
    description: string | null;
    category: string | null;            // texto libre legacy (PRP-001)
    category_id: string | null;
    category_name: string | null;       // nombre de la categoría jerárquica (join)
    brand: string | null;
    base_price: string | number;
    discount_price: string | number | null;
    season: string | null;
    axis1_label: string | null;         // etiqueta eje 1 (Talla/Numeración…); vacío ⇒ eje oculto
    axis2_label: string | null;         // etiqueta eje 2 (Color…); vacío ⇒ eje oculto
    image_url: string | null;
    variants: Variant[];
}

interface Category {
    id: string;
    name: string;
    parent_id: string | null;
    sort_order: number;
}

type ProductForm = { id?: string; name: string; description: string; category_id: string; brand: string; base_price: string; discount_price: string; season: string; axis1_label: string; axis2_label: string; image_url: string };
type VariantForm = { id?: string; product_id: string; size: string; color: string; sku: string; price: string; stock: string; low_stock_threshold: string };
type StockForm = { variant_id: string; type: 'entrada' | 'salida' | 'ajuste'; quantity: string; reason: string };
type CategoryForm = { id?: string; name: string; parent_id: string; sort_order: string };

const EMPTY_PRODUCT: ProductForm = { name: '', description: '', category_id: '', brand: '', base_price: '', discount_price: '', season: '', axis1_label: 'Talla', axis2_label: 'Color', image_url: '' };

const inputCls = 'w-full px-4 py-3 bg-[#0f0f1a] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-amber-500 text-sm';

// Recomprime en el cliente antes de subir: reduce a máx 1200px y ~0.8 de calidad.
// Mantiene el peso bajo (coste Blob marginal) sin dependencias de servidor.
async function resizeImage(file: File, maxDim = 1200, quality = 0.8): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), type, quality));
}

// Aplana el árbol de categorías en orden padre→hijos con profundidad (para selects y tree).
function orderedCategories(cats: Category[]): { cat: Category; depth: number }[] {
    const byParent: Record<string, Category[]> = {};
    for (const c of cats) (byParent[c.parent_id || 'root'] ||= []).push(c);
    const out: { cat: Category; depth: number }[] = [];
    const walk = (parent: string, depth: number) => {
        for (const c of byParent[parent] || []) { out.push({ cat: c, depth }); walk(c.id, depth + 1); }
    };
    walk('root', 0);
    return out;
}

export function RetailTab() {
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [productForm, setProductForm] = useState<ProductForm | null>(null);
    const [variantForm, setVariantForm] = useState<VariantForm | null>(null);
    const [stockForm, setStockForm] = useState<StockForm | null>(null);
    const [categoryForm, setCategoryForm] = useState<CategoryForm | null>(null);
    const [showCats, setShowCats] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadPhoto = async (file: File) => {
        setUploading(true); setError(null);
        try {
            const resized = await resizeImage(file);
            const ext = resized.type === 'image/png' ? 'png' : 'jpg';
            const fd = new FormData();
            fd.append('file', new File([resized], `foto.${ext}`, { type: resized.type }));
            const res = await fetch('/api/admin/retail/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al subir la foto'); return; }
            setProductForm(pf => (pf ? { ...pf, image_url: data.url } : pf));
        } catch {
            setError('No se pudo procesar la imagen');
        } finally { setUploading(false); }
    };

    const load = async () => {
        const [prod, cats] = await Promise.all([
            fetch('/api/admin/retail/products').then(r => r.json()),
            fetch('/api/admin/retail/categories').then(r => r.json()),
        ]);
        setProducts(prod.products || []);
        setCategories(cats.categories || []);
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const orderedCats = orderedCategories(categories);

    // Ejes del producto de la variante en edición (Fase 3). Etiqueta vacía ⇒ eje oculto.
    const variantProduct = variantForm ? products.find(p => p.id === variantForm.product_id) : null;
    const axis1 = (variantProduct?.axis1_label ?? 'Talla').trim();
    const axis2 = (variantProduct?.axis2_label ?? 'Color').trim();

    const lowStock = products.flatMap(p =>
        p.variants.filter(v => v.stock <= v.low_stock_threshold).map(v => ({ product: p, variant: v }))
    );

    // --- Productos ---
    const saveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!productForm) return;
        setSaving(true); setError(null);
        try {
            const method = productForm.id ? 'PUT' : 'POST';
            const res = await fetch('/api/admin/retail/products', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: productForm.id,
                    name: productForm.name.trim(),
                    description: productForm.description || null,
                    category_id: productForm.category_id || null,
                    brand: productForm.brand || null,
                    base_price: parseFloat(productForm.base_price) || 0,
                    discount_price: productForm.discount_price ? parseFloat(productForm.discount_price) : null,
                    season: productForm.season || null,
                    axis1_label: productForm.axis1_label.trim(),
                    axis2_label: productForm.axis2_label.trim(),
                    image_url: productForm.image_url || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
            setProductForm(null);
            await load();
        } finally { setSaving(false); }
    };

    const deleteProduct = async (id: string) => {
        if (!confirm('¿Eliminar este producto y sus variantes?')) return;
        await fetch('/api/admin/retail/products', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
        });
        await load();
    };

    // --- Categorías ---
    const saveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!categoryForm) return;
        setSaving(true); setError(null);
        try {
            const method = categoryForm.id ? 'PUT' : 'POST';
            const res = await fetch('/api/admin/retail/categories', {
                method, headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: categoryForm.id,
                    name: categoryForm.name.trim(),
                    parent_id: categoryForm.parent_id || null,
                    sort_order: parseInt(categoryForm.sort_order) || 0,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
            setCategoryForm(null);
            await load();
        } finally { setSaving(false); }
    };

    const deleteCategory = async (id: string) => {
        if (!confirm('¿Eliminar esta categoría? Los productos que la usen quedarán sin categoría.')) return;
        const res = await fetch('/api/admin/retail/categories', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || 'Error al eliminar'); return; }
        await load();
    };

    // --- Variantes ---
    const saveVariant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!variantForm) return;
        setSaving(true); setError(null);
        try {
            const method = variantForm.id ? 'PUT' : 'POST';
            const body: Record<string, unknown> = {
                id: variantForm.id,
                product_id: variantForm.product_id,
                size: variantForm.size || null,
                color: variantForm.color || null,
                sku: variantForm.sku || null,
                price: variantForm.price ? parseFloat(variantForm.price) : null,
                low_stock_threshold: parseInt(variantForm.low_stock_threshold) || 0,
            };
            if (!variantForm.id) body.stock = parseInt(variantForm.stock) || 0;
            const res = await fetch('/api/admin/retail/variants', {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al guardar'); return; }
            setVariantForm(null);
            await load();
        } finally { setSaving(false); }
    };

    const deleteVariant = async (id: string) => {
        if (!confirm('¿Eliminar esta variante?')) return;
        await fetch('/api/admin/retail/variants', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
        });
        await load();
    };

    // --- Stock ---
    const saveMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stockForm) return;
        setSaving(true); setError(null);
        try {
            const res = await fetch('/api/admin/retail/stock', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    variant_id: stockForm.variant_id,
                    type: stockForm.type,
                    quantity: parseInt(stockForm.quantity) || 0,
                    reason: stockForm.reason || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al registrar'); return; }
            setStockForm(null);
            await load();
        } finally { setSaving(false); }
    };

    if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-400" /></div>;

    return (
        <div className="space-y-4">
            {/* Gestor de categorías (colapsable) */}
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl">
                <button
                    onClick={() => setShowCats(s => !s)}
                    className="w-full flex items-center justify-between px-4 py-3"
                >
                    <span className="flex items-center gap-2 text-xs font-black text-slate-300 uppercase tracking-widest">
                        <FolderTree size={14} className="text-amber-400" /> Categorías ({categories.length})
                    </span>
                    <ChevronDown size={16} className={`text-slate-500 transition-transform ${showCats ? 'rotate-180' : ''}`} />
                </button>
                {showCats && (
                    <div className="px-4 pb-4 space-y-1.5">
                        {orderedCats.length === 0 ? (
                            <p className="text-slate-500 text-xs py-2">Sin categorías. Crea la primera para organizar el catálogo.</p>
                        ) : orderedCats.map(({ cat, depth }) => (
                            <div key={cat.id} className="flex items-center gap-2 bg-[#0f0f1a] border border-white/5 rounded-xl px-3 py-2" style={{ marginLeft: depth * 16 }}>
                                <span className="flex-1 text-xs text-white truncate">
                                    {depth > 0 && <span className="text-slate-600">└ </span>}{cat.name}
                                </span>
                                <button onClick={() => { setError(null); setCategoryForm({ id: cat.id, name: cat.name, parent_id: cat.parent_id || '', sort_order: String(cat.sort_order) }); }} className="p-1 text-slate-400 hover:text-amber-400 transition"><Edit2 size={13} /></button>
                                <button onClick={() => deleteCategory(cat.id)} className="p-1 text-slate-400 hover:text-red-400 transition"><Trash2 size={13} /></button>
                            </div>
                        ))}
                        <button
                            onClick={() => { setError(null); setCategoryForm({ name: '', parent_id: '', sort_order: '0' }); }}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-400/80 hover:text-amber-400 transition pt-1"
                        >
                            <Plus size={12} /> Nueva categoría
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Productos</h3>
                <button
                    onClick={() => { setError(null); setProductForm({ ...EMPTY_PRODUCT }); }}
                    className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full"
                >
                    <Plus size={14} /> Nuevo producto
                </button>
            </div>

            {/* Alertas de stock bajo */}
            {lowStock.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 space-y-1.5">
                    <p className="text-xs font-black text-red-300 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Stock bajo ({lowStock.length})
                    </p>
                    {lowStock.map(({ product, variant }) => (
                        <p key={variant.id} className="text-[11px] text-red-200/80">
                            {product.name}{variantLabel(variant) ? ` · ${variantLabel(variant)}` : ''} — {variant.stock} uds
                        </p>
                    ))}
                </div>
            )}

            {products.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">Sin productos. Crea el primero.</p>
            ) : products.map(p => (
                <div key={p.id} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        {p.image_url
                            ? <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                            : <div className="w-12 h-12 rounded-lg bg-[#0f0f1a] flex items-center justify-center shrink-0"><Package size={16} className="text-slate-600" /></div>}
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-white truncate">
                                {p.name}
                                {p.brand ? <span className="text-slate-500 font-normal"> · {p.brand}</span> : ''}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate">
                                {(p.category_name || p.category) ? `${p.category_name || p.category} · ` : ''}
                                {p.discount_price != null
                                    ? <><span className="line-through">{money(p.base_price)}</span> <span className="text-amber-400 font-bold">{money(p.discount_price)}</span></>
                                    : money(p.base_price)}
                                {p.season ? ` · ${p.season}` : ''} · {p.variants.length} variante{p.variants.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => { setError(null); setProductForm({ id: p.id, name: p.name, description: p.description || '', category_id: p.category_id || '', brand: p.brand || '', base_price: String(p.base_price), discount_price: p.discount_price != null ? String(p.discount_price) : '', season: p.season || '', axis1_label: p.axis1_label || '', axis2_label: p.axis2_label || '', image_url: p.image_url || '' }); }} className="p-1.5 text-slate-400 hover:text-amber-400 transition"><Edit2 size={15} /></button>
                            <button onClick={() => deleteProduct(p.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition"><Trash2 size={15} /></button>
                        </div>
                    </div>

                    {/* Variantes */}
                    <div className="space-y-1.5 pl-1">
                        {p.variants.map(v => {
                            const low = v.stock <= v.low_stock_threshold;
                            return (
                                <div key={v.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${low ? 'bg-red-500/5 border-red-500/30' : 'bg-[#0f0f1a] border-white/5'}`}>
                                    <Layers size={13} className="text-slate-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-white truncate">
                                            {variantLabel(v) || 'Estándar'}
                                            {v.sku ? <span className="text-slate-600"> · {v.sku}</span> : ''}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                            {v.price != null ? money(v.price) : 'precio base'} ·{' '}
                                            <span className={low ? 'text-red-400 font-bold' : ''}>{v.stock} uds</span>
                                        </p>
                                    </div>
                                    <button onClick={() => { setError(null); setStockForm({ variant_id: v.id, type: 'entrada', quantity: '', reason: '' }); }} title="Movimiento de stock" className="p-1.5 text-slate-400 hover:text-green-400 transition"><ArrowUpDown size={14} /></button>
                                    <button onClick={() => { setError(null); setVariantForm({ id: v.id, product_id: p.id, size: v.size || '', color: v.color || '', sku: v.sku || '', price: v.price != null ? String(v.price) : '', stock: String(v.stock), low_stock_threshold: String(v.low_stock_threshold) }); }} className="p-1.5 text-slate-400 hover:text-amber-400 transition"><Edit2 size={14} /></button>
                                    <button onClick={() => deleteVariant(v.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition"><Trash2 size={14} /></button>
                                </div>
                            );
                        })}
                        <button
                            onClick={() => { setError(null); setVariantForm({ product_id: p.id, size: '', color: '', sku: '', price: '', stock: '0', low_stock_threshold: '3' }); }}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-400/80 hover:text-amber-400 transition pt-1"
                        >
                            <Plus size={12} /> Agregar variante
                        </button>
                    </div>
                </div>
            ))}

            {/* Modal producto */}
            {productForm && (
                <Modal title={productForm.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setProductForm(null)}>
                    <form onSubmit={saveProduct} className="space-y-3">
                        <input className={inputCls} placeholder="Nombre *" required value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
                        <textarea className={`${inputCls} h-16 resize-none`} placeholder="Descripción (opcional)" value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} />
                        <div className="grid grid-cols-2 gap-3">
                            <select className={inputCls} value={productForm.category_id} onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}>
                                <option value="">Sin categoría</option>
                                {orderedCats.map(({ cat, depth }) => (
                                    <option key={cat.id} value={cat.id}>{' '.repeat(depth * 2)}{depth > 0 ? '└ ' : ''}{cat.name}</option>
                                ))}
                            </select>
                            <input className={inputCls} placeholder="Marca (opcional)" value={productForm.brand} onChange={e => setProductForm({ ...productForm, brand: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input className={inputCls} type="number" step="0.01" min="0" placeholder="Precio base" value={productForm.base_price} onChange={e => setProductForm({ ...productForm, base_price: e.target.value })} />
                            <input className={inputCls} type="number" step="0.01" min="0" placeholder="Precio oferta (opcional)" value={productForm.discount_price} onChange={e => setProductForm({ ...productForm, discount_price: e.target.value })} />
                        </div>
                        <input className={inputCls} placeholder="Temporada (ej. Verano 2026, opcional)" value={productForm.season} onChange={e => setProductForm({ ...productForm, season: e.target.value })} />
                        <div className="grid grid-cols-2 gap-3">
                            <input className={inputCls} placeholder="Eje 1 (Talla / Numeración)" value={productForm.axis1_label} onChange={e => setProductForm({ ...productForm, axis1_label: e.target.value })} />
                            <input className={inputCls} placeholder="Eje 2 (Color)" value={productForm.axis2_label} onChange={e => setProductForm({ ...productForm, axis2_label: e.target.value })} />
                        </div>
                        <p className="text-[10px] text-slate-500 -mt-1">Ropa: Talla/Color · Calzado: Numeración/Color · Accesorio: deja un eje vacío para ocultarlo.</p>

                        {/* Foto principal (Vercel Blob) */}
                        <div className="flex items-center gap-3">
                            {productForm.image_url
                                ? <img src={productForm.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                                : <div className="w-16 h-16 rounded-lg bg-[#1a1a2e] border border-white/10 flex items-center justify-center shrink-0"><Package size={18} className="text-slate-600" /></div>}
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <label className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition ${uploading ? 'bg-[#1a1a2e] text-slate-500' : 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'}`}>
                                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
                                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }} />
                                    {uploading ? <><Loader2 size={14} className="animate-spin" /> Subiendo…</> : <><Upload size={14} /> {productForm.image_url ? 'Cambiar foto' : 'Subir foto'}</>}
                                </label>
                                {productForm.image_url && (
                                    <button type="button" onClick={() => setProductForm({ ...productForm, image_url: '' })} className="text-[11px] text-slate-500 hover:text-red-400 transition">Quitar foto</button>
                                )}
                            </div>
                        </div>
                        <input className={inputCls} placeholder="o pega una URL de imagen" value={productForm.image_url} onChange={e => setProductForm({ ...productForm, image_url: e.target.value })} />
                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                        <SubmitBtn saving={saving} label={productForm.id ? 'Guardar cambios' : 'Crear producto'} />
                    </form>
                </Modal>
            )}

            {/* Modal categoría */}
            {categoryForm && (
                <Modal title={categoryForm.id ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setCategoryForm(null)}>
                    <form onSubmit={saveCategory} className="space-y-3">
                        <input className={inputCls} placeholder="Nombre *" required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                        <select className={inputCls} value={categoryForm.parent_id} onChange={e => setCategoryForm({ ...categoryForm, parent_id: e.target.value })}>
                            <option value="">Sin padre (categoría raíz)</option>
                            {orderedCats.filter(({ cat }) => cat.id !== categoryForm.id).map(({ cat, depth }) => (
                                <option key={cat.id} value={cat.id}>{' '.repeat(depth * 2)}{depth > 0 ? '└ ' : ''}{cat.name}</option>
                            ))}
                        </select>
                        <input className={inputCls} type="number" step="1" placeholder="Orden (0 primero)" value={categoryForm.sort_order} onChange={e => setCategoryForm({ ...categoryForm, sort_order: e.target.value })} />
                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                        <SubmitBtn saving={saving} label={categoryForm.id ? 'Guardar cambios' : 'Crear categoría'} />
                    </form>
                </Modal>
            )}

            {/* Modal variante */}
            {variantForm && (
                <Modal title={variantForm.id ? 'Editar variante' : 'Nueva variante'} onClose={() => setVariantForm(null)}>
                    <form onSubmit={saveVariant} className="space-y-3">
                        {(axis1 || axis2) ? (
                            <div className={`grid gap-3 ${axis1 && axis2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {axis1 && <input className={inputCls} placeholder={axis1} value={variantForm.size} onChange={e => setVariantForm({ ...variantForm, size: e.target.value })} />}
                                {axis2 && <input className={inputCls} placeholder={axis2} value={variantForm.color} onChange={e => setVariantForm({ ...variantForm, color: e.target.value })} />}
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-500">Este producto no usa ejes: variante única (Estándar).</p>
                        )}
                        <input className={inputCls} placeholder="SKU (opcional, único)" value={variantForm.sku} onChange={e => setVariantForm({ ...variantForm, sku: e.target.value })} />
                        <div className="grid grid-cols-2 gap-3">
                            <input className={inputCls} type="number" step="0.01" min="0" placeholder="Precio (o base)" value={variantForm.price} onChange={e => setVariantForm({ ...variantForm, price: e.target.value })} />
                            <input className={inputCls} type="number" step="1" min="0" placeholder="Alerta stock bajo" value={variantForm.low_stock_threshold} onChange={e => setVariantForm({ ...variantForm, low_stock_threshold: e.target.value })} />
                        </div>
                        {!variantForm.id && (
                            <input className={inputCls} type="number" step="1" min="0" placeholder="Stock inicial" value={variantForm.stock} onChange={e => setVariantForm({ ...variantForm, stock: e.target.value })} />
                        )}
                        {variantForm.id && <p className="text-[10px] text-slate-500">El stock se ajusta con movimientos (botón ↕ en la variante).</p>}
                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                        <SubmitBtn saving={saving} label={variantForm.id ? 'Guardar cambios' : 'Crear variante'} />
                    </form>
                </Modal>
            )}

            {/* Modal movimiento de stock */}
            {stockForm && (
                <Modal title="Movimiento de stock" onClose={() => setStockForm(null)}>
                    <form onSubmit={saveMovement} className="space-y-3">
                        <div className="flex gap-2">
                            {(['entrada', 'salida', 'ajuste'] as const).map(t => (
                                <button key={t} type="button" onClick={() => setStockForm({ ...stockForm, type: t })}
                                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all capitalize ${stockForm.type === t ? 'bg-amber-500 text-white' : 'bg-[#0f0f1a] text-slate-400 border border-[#2a2a3e]'}`}>
                                    {t}
                                </button>
                            ))}
                        </div>
                        <input className={inputCls} type="number" step="1" required
                            placeholder={stockForm.type === 'ajuste' ? 'Delta (+/-)' : 'Cantidad'}
                            value={stockForm.quantity} onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })} />
                        <input className={inputCls} placeholder="Motivo (opcional)" value={stockForm.reason} onChange={e => setStockForm({ ...stockForm, reason: e.target.value })} />
                        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                        <SubmitBtn saving={saving} label="Registrar movimiento" />
                    </form>
                </Modal>
            )}
        </div>
    );
}

function variantLabel(v: Variant): string {
    return [v.size, v.color].filter(Boolean).join(' / ');
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center">
            <div className="bg-[#0f0f1a] border border-[#2a2a3e] rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-white">{title}</h3>
                    <button type="button" onClick={onClose} className="text-slate-400"><X size={20} /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

function SubmitBtn({ saving, label }: { saving: boolean; label: string }) {
    return (
        <button type="submit" disabled={saving}
            className="w-full py-3 bg-amber-500 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
            {saving ? <Loader2 size={16} className="inline animate-spin" /> : label}
        </button>
    );
}
