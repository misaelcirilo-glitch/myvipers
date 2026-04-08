'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [form, setForm] = useState({ phone: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            router.push(data.user.role === 'admin' || data.user.role === 'waiter' ? '/admin' : '/carta');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col px-6 py-8 bg-[#0f0f1a]">
            <Link href="/" className="flex items-center gap-2 text-slate-400 text-sm mb-8">
                <ArrowLeft size={16} /> Volver
            </Link>

            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Flame size={32} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black">Bienvenido de vuelta</h1>
                    <p className="text-slate-400 text-sm mt-1">Ingresa con tu celular</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="tel" placeholder="Tu número de celular" required
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                        value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                    <input
                        type="password" placeholder="Contraseña" required
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition"
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    />

                    {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                    <button
                        type="submit" disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-amber-500 to-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Entrando...' : 'Iniciar sesión'}
                    </button>
                </form>

                <p className="text-center text-slate-500 text-sm mt-6">
                    ¿No tienes cuenta? <Link href="/registro" className="text-amber-400 font-bold">Regístrate gratis</Link>
                </p>
            </div>
        </div>
    );
}
