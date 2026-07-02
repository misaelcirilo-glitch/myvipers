'use client';
import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';

function RestablecerInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token') || '';
    const [form, setForm] = useState({ password: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (form.password.length < 4) return setError('La contraseña debe tener al menos 4 caracteres');
        if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password: form.password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo restablecer');
            setDone(true);
            setTimeout(() => router.push('/login'), 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
        } finally {
            setLoading(false);
        }
    }

    if (!token) {
        return (
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full text-center">
                <h1 className="text-2xl font-black">Enlace inválido</h1>
                <p className="text-slate-400 text-sm mt-2">Falta el código del enlace. Solicita uno nuevo desde &quot;¿Olvidaste tu contraseña?&quot;.</p>
                <Link href="/recuperar" className="mt-6 text-amber-400 font-bold text-sm">Solicitar nuevo enlace</Link>
            </div>
        );
    }

    if (done) {
        return (
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full text-center">
                <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-emerald-400" />
                </div>
                <h1 className="text-2xl font-black">¡Contraseña actualizada!</h1>
                <p className="text-slate-400 text-sm mt-2">Ya puedes iniciar sesión con tu nueva contraseña.</p>
                <Link href="/login" className="mt-6 text-amber-400 font-bold text-sm">Iniciar sesión</Link>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={32} className="text-white" />
                </div>
                <h1 className="text-2xl font-black">Nueva contraseña</h1>
                <p className="text-slate-400 text-sm mt-1">Crea una contraseña para tu cuenta VIP.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="password" placeholder="Nueva contraseña" required
                    className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <input
                    type="password" placeholder="Repite la contraseña" required
                    className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                    value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
                />
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                <button
                    type="submit" disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                    {loading ? 'Guardando...' : 'Guardar contraseña'}
                </button>
            </form>
        </div>
    );
}

export default function RestablecerPage() {
    return (
        <div className="min-h-screen flex flex-col px-6 py-8 bg-[#0f0f1a]">
            <Link href="/login" className="flex items-center gap-2 text-slate-400 text-sm mb-8">
                <ArrowLeft size={16} /> Volver
            </Link>
            <Suspense fallback={<div className="flex-1" />}>
                <RestablecerInner />
            </Suspense>
        </div>
    );
}
