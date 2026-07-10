'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Printer, Download, Receipt, Loader2 } from 'lucide-react';

interface RestaurantInfo {
    name?: string;
    city?: string;
    country?: string;
    phone?: string;
}

interface LineItem {
    descripcion: string;
    cantidad: string;
    precio: string;
}

interface BoletaItem {
    descripcion: string;
    cantidad: number;
    precio: number;
}

interface Boleta {
    id: string;
    serie: string;
    correlativo: number;
    numero: string;
    fecha: string;
    cliente_nombre: string | null;
    cliente_doc: string | null;
    items: BoletaItem[];
    subtotal: string | number;
    total: string | number;
    created_at: string;
}

const money = (n: unknown) => `S/${Number(n || 0).toFixed(2)}`;
const fmtDate = (d: string) => new Date(String(d).slice(0, 10) + 'T00:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Líneas de la boleta como texto plano (reutilizado por print y PDF). */
function buildLines(boleta: Boleta, info: RestaurantInfo | null): string[] {
    const lines: string[] = [];
    lines.push((info?.name || 'MyVipers').toUpperCase());
    const loc = [info?.city, info?.country].filter(Boolean).join(', ');
    if (loc) lines.push(loc);
    if (info?.phone) lines.push(`Tel: ${info.phone}`);
    lines.push('--------------------------------');
    lines.push('BOLETA DE VENTA');
    lines.push(boleta.numero);
    lines.push(`Fecha: ${fmtDate(boleta.fecha)}`);
    if (boleta.cliente_nombre) lines.push(`Cliente: ${boleta.cliente_nombre}`);
    if (boleta.cliente_doc) lines.push(`Doc: ${boleta.cliente_doc}`);
    lines.push('--------------------------------');
    for (const it of boleta.items || []) {
        lines.push(it.descripcion);
        const imp = Number(it.cantidad) * Number(it.precio);
        lines.push(`  ${Number(it.cantidad)} x ${money(it.precio)}      ${money(imp)}`);
    }
    lines.push('--------------------------------');
    lines.push(`TOTAL: ${money(boleta.total)}`);
    lines.push('');
    lines.push('¡Gracias por su compra!');
    return lines;
}

function printBoleta(boleta: Boleta, info: RestaurantInfo | null) {
    const rows = (boleta.items || []).map(it => {
        const imp = Number(it.cantidad) * Number(it.precio);
        return `<tr><td class="d">${escapeHtml(it.descripcion)}<br><span class="q">${Number(it.cantidad)} x ${money(it.precio)}</span></td><td class="a">${money(imp)}</td></tr>`;
    }).join('');
    const loc = [info?.city, info?.country].filter(Boolean).join(', ');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(boleta.numero)}</title>
<style>
@page { size: 80mm auto; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 80mm; padding: 4mm; font-family: 'Courier New', monospace; font-size: 11px; color: #000; }
.c { text-align: center; }
.b { font-weight: bold; }
.name { font-size: 15px; font-weight: bold; }
hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
table { width: 100%; border-collapse: collapse; }
td { vertical-align: top; padding: 2px 0; }
.a { text-align: right; white-space: nowrap; padding-left: 6px; }
.q { font-size: 10px; color: #333; }
.total { font-size: 14px; font-weight: bold; }
.foot { margin-top: 8px; }
@media print { body { width: auto; } }
</style></head><body>
<div class="c name">${escapeHtml(info?.name || 'MyVipers')}</div>
${loc ? `<div class="c">${escapeHtml(loc)}</div>` : ''}
${info?.phone ? `<div class="c">Tel: ${escapeHtml(info.phone)}</div>` : ''}
<hr>
<div class="c b">BOLETA DE VENTA</div>
<div class="c">${escapeHtml(boleta.numero)}</div>
<div class="c">Fecha: ${fmtDate(boleta.fecha)}</div>
${boleta.cliente_nombre ? `<div>Cliente: ${escapeHtml(boleta.cliente_nombre)}</div>` : ''}
${boleta.cliente_doc ? `<div>Doc: ${escapeHtml(boleta.cliente_doc)}</div>` : ''}
<hr>
<table>${rows}</table>
<hr>
<div class="c total">TOTAL: ${money(boleta.total)}</div>
<div class="c foot">¡Gracias por su compra!</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) { alert('Habilita las ventanas emergentes para imprimir.'); return; }
    w.document.write(html);
    w.document.close();
}

async function downloadPdf(boleta: Boleta, info: RestaurantInfo | null) {
    const { jsPDF } = await import('jspdf');
    // Formato ticket 80mm de ancho, alto dinámico.
    const lines = buildLines(boleta, info);
    const width = 80;
    const height = 40 + lines.length * 5;
    const doc = new jsPDF({ unit: 'mm', format: [width, height] });
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    let y = 8;
    for (const line of lines) {
        const centered = line === line.toUpperCase() && /[A-Z]/.test(line) && !line.startsWith(' ');
        if (centered) {
            doc.text(line, width / 2, y, { align: 'center' });
        } else {
            doc.text(line, 4, y);
        }
        y += 5;
    }
    doc.save(`${boleta.numero}.pdf`);
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function BoletasTab({ restaurantInfo }: { restaurantInfo: RestaurantInfo | null }) {
    const [boletas, setBoletas] = useState<Boleta[]>([]);
    const [items, setItems] = useState<LineItem[]>([{ descripcion: '', cantidad: '1', precio: '' }]);
    const [clienteNombre, setClienteNombre] = useState('');
    const [clienteDoc, setClienteDoc] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        const res = await fetch('/api/admin/boletas').then(r => r.json());
        setBoletas(res.boletas || []);
    };

    useEffect(() => { load(); }, []);

    const subtotal = items.reduce((acc, it) => {
        const c = parseFloat(it.cantidad) || 0;
        const p = parseFloat(it.precio) || 0;
        return acc + c * p;
    }, 0);

    const updateItem = (i: number, field: keyof LineItem, value: string) => {
        setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
    };
    const addItem = () => setItems(prev => [...prev, { descripcion: '', cantidad: '1', precio: '' }]);
    const removeItem = (i: number) => setItems(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

    const emit = async () => {
        setError(null);
        const cleanItems = items
            .filter(it => it.descripcion.trim() && parseFloat(it.precio) >= 0 && parseFloat(it.cantidad) > 0)
            .map(it => ({ descripcion: it.descripcion.trim(), cantidad: parseFloat(it.cantidad), precio: parseFloat(it.precio) }));
        if (cleanItems.length === 0) { setError('Agrega al menos un ítem válido.'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/boletas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cleanItems, cliente_nombre: clienteNombre || null, cliente_doc: clienteDoc || null }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || 'Error al emitir boleta'); return; }
            setItems([{ descripcion: '', cantidad: '1', precio: '' }]);
            setClienteNombre('');
            setClienteDoc('');
            await load();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Form */}
            <form onSubmit={e => { e.preventDefault(); emit(); }} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-4 space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Nueva boleta</h3>

                {items.map((it, i) => (
                    <div key={i} className="flex gap-2 items-start">
                        <input
                            type="text" placeholder="Descripción" required={i === 0}
                            className="flex-1 min-w-0 px-3 py-2.5 bg-[#0f0f1a] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-amber-500 text-sm"
                            value={it.descripcion} onChange={e => updateItem(i, 'descripcion', e.target.value)}
                        />
                        <input
                            type="number" min="1" step="1" placeholder="Cant"
                            className="w-14 px-2 py-2.5 bg-[#0f0f1a] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-amber-500 text-sm text-center"
                            value={it.cantidad} onChange={e => updateItem(i, 'cantidad', e.target.value)}
                        />
                        <input
                            type="number" min="0" step="0.01" placeholder="Precio"
                            className="w-20 px-2 py-2.5 bg-[#0f0f1a] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-amber-500 text-sm"
                            value={it.precio} onChange={e => updateItem(i, 'precio', e.target.value)}
                        />
                        <button type="button" onClick={() => removeItem(i)} className="p-2.5 text-slate-500 hover:text-red-400 transition shrink-0">
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}

                <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full">
                    <Plus size={14} /> Agregar línea
                </button>

                <div className="grid grid-cols-2 gap-3">
                    <input
                        type="text" placeholder="Cliente (opcional)"
                        className="px-3 py-2.5 bg-[#0f0f1a] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-amber-500 text-sm"
                        value={clienteNombre} onChange={e => setClienteNombre(e.target.value)}
                    />
                    <input
                        type="text" placeholder="DNI/RUC (opcional)"
                        className="px-3 py-2.5 bg-[#0f0f1a] border border-white/10 rounded-xl text-white placeholder-slate-600 outline-none focus:border-amber-500 text-sm"
                        value={clienteDoc} onChange={e => setClienteDoc(e.target.value)}
                    />
                </div>

                <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total</span>
                    <span className="text-lg font-black text-amber-400">{money(subtotal)}</span>
                </div>

                {error && <p className="text-red-400 text-xs text-center">{error}</p>}

                <button
                    type="submit" disabled={saving}
                    className="w-full py-3 bg-amber-500 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="inline animate-spin" /> : 'Emitir boleta'}
                </button>
            </form>

            {/* List */}
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Boletas emitidas</h3>
            {boletas.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">Sin boletas emitidas</p>
            ) : boletas.map(b => (
                <div key={b.id} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-bold text-sm text-white flex items-center gap-1.5">
                            <Receipt size={14} className="text-amber-400 shrink-0" /> {b.numero}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                            {fmtDate(b.fecha)} · {(b.items || []).length} ítem{(b.items || []).length === 1 ? '' : 's'}
                            {b.cliente_nombre ? ` · ${b.cliente_nombre}` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-amber-400 text-sm">{money(b.total)}</span>
                        <button onClick={() => printBoleta(b, restaurantInfo)} title="Imprimir" className="p-1.5 text-slate-400 hover:text-amber-400 transition">
                            <Printer size={16} />
                        </button>
                        <button onClick={() => downloadPdf(b, restaurantInfo)} title="Descargar PDF" className="p-1.5 text-slate-400 hover:text-green-400 transition">
                            <Download size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
