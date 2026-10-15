'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PlatformLoginPage() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/platform/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'No se pudo iniciar sesión');
                return;
            }
            router.push('/plataforma/solicitudes');
        } catch {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
            <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl">
                <div>
                    <h1 className="text-lg font-bold">MyVipers · Plataforma</h1>
                    <p className="text-xs text-white/50">Acceso de administración de plataforma</p>
                </div>
                {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
                <label className="block">
                    <span className="text-xs text-white/60">Teléfono</span>
                    <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        inputMode="numeric"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                        placeholder="678080701"
                    />
                </label>
                <label className="block">
                    <span className="text-xs text-white/60">Contraseña</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    />
                </label>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                >
                    {loading ? 'Entrando…' : 'Entrar'}
                </button>
            </form>
        </main>
    );
}
