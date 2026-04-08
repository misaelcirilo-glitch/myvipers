'use client';
import { useState, useEffect } from 'react';
import { CalendarDays, Clock, Users, MessageSquare, Check, AlertCircle } from 'lucide-react';

const TIME_SLOTS = [
    { label: 'Mañana (9:00 - 14:00)', slots: ['9:00', '9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'] },
    { label: 'Noche (18:00 - 21:00)', slots: ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30'] },
];

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

interface Reservation {
    id: string;
    date: string;
    time: string;
    party_size: number;
    status: string;
    table_number: number;
    table_location: string;
    notes: string;
}

export default function ReservarPage() {
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [partySize, setPartySize] = useState(2);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [reservations, setReservations] = useState<Reservation[]>([]);

    // Set min date to today
    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        fetch('/api/reservations').then(r => r.json()).then(data => {
            setReservations(data.reservations || []);
        });
    }, [success]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const res = await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, time, partySize, notes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess(true);
            setDate('');
            setTime('');
            setNotes('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const statusLabels: Record<string, { label: string; color: string }> = {
        pending: { label: 'Pendiente', color: 'text-yellow-400 bg-yellow-400/10' },
        confirmed: { label: 'Confirmada', color: 'text-green-400 bg-green-400/10' },
        seated: { label: 'En mesa', color: 'text-blue-400 bg-blue-400/10' },
        completed: { label: 'Completada', color: 'text-slate-400 bg-slate-400/10' },
        cancelled: { label: 'Cancelada', color: 'text-red-400 bg-red-400/10' },
        no_show: { label: 'No asistió', color: 'text-red-400 bg-red-400/10' },
    };

    const upcomingReservations = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed' && r.status !== 'no_show');

    return (
        <div className="px-4 pt-6 space-y-6 pb-4 max-w-2xl mx-auto">
            <h1 className="text-xl font-black">Reservar Mesa</h1>

            {/* Success */}
            {success && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <Check size={20} className="text-green-400" />
                    <div>
                        <p className="font-bold text-green-400">Mesa reservada</p>
                        <p className="text-green-400/70 text-xs">Te esperamos, no faltes</p>
                    </div>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                        <CalendarDays size={14} /> Fecha
                    </label>
                    <input
                        type="date" required min={today}
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white outline-none focus:border-amber-500 transition"
                        value={date} onChange={e => setDate(e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                        <Clock size={14} /> Hora
                    </label>
                    <div className="space-y-3">
                        {TIME_SLOTS.map(group => (
                            <div key={group.label}>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">{group.label}</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {group.slots.map(slot => (
                                        <button
                                            key={slot} type="button"
                                            onClick={() => setTime(slot)}
                                            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${time === slot
                                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                                : 'bg-[#1a1a2e] text-slate-400 border border-[#2a2a3e] hover:border-amber-500/30'
                                            }`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                        <Users size={14} /> Personas
                    </label>
                    <div className="grid grid-cols-8 gap-2">
                        {PARTY_SIZES.map(size => (
                            <button
                                key={size} type="button"
                                onClick={() => setPartySize(size)}
                                className={`aspect-square rounded-xl text-sm font-bold transition-all ${partySize === size
                                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                                    : 'bg-[#1a1a2e] text-slate-400 border border-[#2a2a3e]'
                                }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                        <MessageSquare size={14} /> Notas (opcional)
                    </label>
                    <textarea
                        placeholder="Cumpleaños, alergias, silla para bebé..."
                        className="w-full px-4 py-3 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white placeholder-slate-500 outline-none focus:border-amber-500 transition text-sm resize-none h-20"
                        value={notes} onChange={e => setNotes(e.target.value)}
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                <button
                    type="submit" disabled={loading || !date || !time}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-red-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                    {loading ? 'Reservando...' : 'Confirmar Reserva'}
                </button>
            </form>

            {/* My Reservations */}
            {upcomingReservations.length > 0 && (
                <div>
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Mis Reservas</h2>
                    <div className="space-y-3">
                        {upcomingReservations.map(r => {
                            const s = statusLabels[r.status] || statusLabels.pending;
                            return (
                                <div key={r.id} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <CalendarDays size={16} className="text-amber-400" />
                                            <span className="font-bold">{new Date(r.date + 'T00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                            <span className="text-amber-400 font-bold">{r.time?.substring(0, 5)}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${s.color}`}>
                                            {s.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                        <span>{r.party_size} personas</span>
                                        {r.table_number && <span>Mesa {r.table_number} ({r.table_location})</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
