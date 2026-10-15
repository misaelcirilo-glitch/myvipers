'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Application {
    id: string;
    business_name: string;
    slug: string;
    business_type: string;
    admin_name: string;
    admin_phone: string;
    admin_email: string | null;
    country: string | null;
    notes: string | null;
    status: string;
    review_notes: string | null;
    created_at: string;
}

type StatusFilter = 'pending' | 'approved' | 'rejected';

export default function PlatformApplicationsPage() {
    const router = useRouter();
    const [status, setStatus] = useState<StatusFilter>('pending');
    const [apps, setApps] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/platform/applications?status=${status}`);
            if (res.status === 403) {
                router.push('/plataforma/login');
                return;
            }
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al cargar');
                return;
            }
            setApps(data.data ?? []);
        } catch {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    }, [status, router]);

    useEffect(() => {
        load();
    }, [load]);

    async function approve(a: Application) {
        if (!confirm(`¿Aprobar "${a.business_name}"? Se creará el negocio y su administrador.`)) return;
        setBusyId(a.id);
        try {
            const res = await fetch(`/api/platform/applications/${a.id}/approve`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'No se pudo aprobar');
                return;
            }
            alert(`Aprobado ✅\nEnlace de acceso del negocio:\n${window.location.origin}${data.loginUrl}`);
            load();
        } finally {
            setBusyId(null);
        }
    }

    async function reject(a: Application) {
        const notes = prompt(`Motivo del rechazo de "${a.business_name}" (opcional):`);
        if (notes === null) return;
        setBusyId(a.id);
        try {
            const res = await fetch(`/api/platform/applications/${a.id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'No se pudo rechazar');
                return;
            }
            load();
        } finally {
            setBusyId(null);
        }
    }

    return (
        <main className="min-h-screen bg-slate-950 text-white p-6">
            <div className="mx-auto max-w-4xl">
                <h1 className="text-xl font-bold">Solicitudes de alta</h1>
                <p className="text-xs text-white/50 mb-4">Panel de plataforma · aprobar o rechazar negocios</p>

                <div className="mb-4 flex gap-2">
                    {(['pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatus(s)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                status === s ? 'bg-emerald-600' : 'bg-white/5 hover:bg-white/10'
                            }`}
                        >
                            {s === 'pending' ? 'Pendientes' : s === 'approved' ? 'Aprobadas' : 'Rechazadas'}
                        </button>
                    ))}
                </div>

                {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
                {loading ? (
                    <p className="py-10 text-center text-sm text-white/40">Cargando…</p>
                ) : apps.length === 0 ? (
                    <p className="py-10 text-center text-sm text-white/40">Sin solicitudes {status === 'pending' ? 'pendientes' : ''}.</p>
                ) : (
                    <div className="space-y-3">
                        {apps.map((a) => (
                            <div key={a.id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{a.business_name}</span>
                                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
                                                {a.business_type}
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/50">
                                            /r/{a.slug} · admin {a.admin_name} ({a.admin_phone})
                                            {a.admin_email ? ` · ${a.admin_email}` : ''}
                                            {a.country ? ` · ${a.country}` : ''}
                                        </p>
                                        {a.notes && <p className="mt-1 text-xs text-white/40">“{a.notes}”</p>}
                                        {a.review_notes && (
                                            <p className="mt-1 text-xs text-rose-300/80">Motivo: {a.review_notes}</p>
                                        )}
                                    </div>
                                    {a.status === 'pending' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => approve(a)}
                                                disabled={busyId === a.id}
                                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
                                            >
                                                Aprobar
                                            </button>
                                            <button
                                                onClick={() => reject(a)}
                                                disabled={busyId === a.id}
                                                className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold hover:bg-rose-500/20 disabled:opacity-50"
                                            >
                                                Rechazar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
