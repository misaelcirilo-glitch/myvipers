'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react';

function RecuperarInner() {
    const searchParams = useSearchParams();
    const restaurantSlug = searchParams.get('r') || undefined;
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState<{ email?: string; kind: 'sent' | 'no_email' | 'not_found' } | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, restaurantSlug }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo procesar');
            if (data.status === 'sent') setDone({ kind: 'sent', email: data.email });
            else if (data.status === 'no_email') setDone({ kind: 'no_email' });
            else setDone({ kind: 'not_found' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error');
        } finally {
            setLoading(false);
        }
    }

    const loginHref = restaurantSlug ? `/r/${restaurantSlug}/login` : '/login';

    if (done) {
        return (
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full text-center">
                {done.kind === 'sent' ? (
                    <>
                        <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <MailCheck size={32} className="text-emerald-400" />
                        </div>
                        <h1 className="text-2xl font-black">Revisa tu correo</h1>
                        <p className="text-slate-400 text-sm mt-2">
                            Enviamos un enlace para restablecer tu contraseña a <span className="text-white font-bold">{done.email}</span>. Vence en 1 hora. Revisa también el spam.
                        </p>
                    </>
                ) : done.kind === 'no_email' ? (
                    <>
                        <h1 className="text-2xl font-black">Sin correo registrado</h1>
                        <p className="text-slate-400 text-sm mt-2">
                            Tu cuenta no tiene un correo asociado, así que no podemos enviarte el enlace. Acércate al restaurante y te ayudamos a restablecerla.
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="text-2xl font-black">Número no encontrado</h1>
                        <p className="text-slate-400 text-sm mt-2">
                            No encontramos una cuenta con ese celular. Verifica el número o regístrate.
                        </p>
                    </>
                )}
                <Link href={loginHref} className="mt-6 text-amber-400 font-bold text-sm">Volver a iniciar sesión</Link>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <KeyRound size={32} className="text-white" />
                </div>
                <h1 className="text-2xl font-black">¿Olvidaste tu contraseña?</h1>
                <p className="text-slate-400 text-sm mt-1">Ingresa tu celular y te enviamos un enlace a tu correo.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="tel" placeholder="Tu número de celular" required
                    className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                    value={phone} onChange={e => setPhone(e.target.value)}
                />
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                <button
                    type="submit" disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                    {loading ? 'Enviando...' : 'Enviar enlace'}
                </button>
            </form>

            <p className="text-center text-slate-500 text-sm mt-6">
                <Link href={loginHref} className="text-amber-400 font-bold">Volver a iniciar sesión</Link>
            </p>
        </div>
    );
}

export default function RecuperarPage() {
    return (
        <div className="min-h-screen flex flex-col px-6 py-8 bg-[#0f0f1a]">
            <Link href="/" className="flex items-center gap-2 text-slate-400 text-sm mb-8">
                <ArrowLeft size={16} /> Volver
            </Link>
            <Suspense fallback={<div className="flex-1" />}>
                <RecuperarInner />
            </Suspense>
        </div>
    );
}
