'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock, Users, MessageSquare, Check, AlertCircle } from 'lucide-react';
import { useI18n } from '@/shared/lib/i18n';
import { useRestaurant, generateTimeSlots } from '@/shared/lib/useRestaurant';
import { hasModule } from '@/shared/lib/modules';

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
    const { t, formatDate } = useI18n();
    const { hours, enabledModules, loading: configLoading } = useRestaurant();
    const router = useRouter();
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [partySize, setPartySize] = useState(2);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [reservations, setReservations] = useState<Reservation[]>([]);

    const today = new Date().toISOString().split('T')[0];
    const timeSlotGroups = generateTimeSlots(hours.time_slots);
    const partySizes = Array.from({ length: hours.max_party_size }, (_, i) => i + 1);

    // Gating multivertical: las reservas solo existen si el módulo 'restaurant'
    // está activo. El Machay lo tiene → sin redirección, idéntico.
    useEffect(() => {
        if (!configLoading && !hasModule(enabledModules, 'restaurant')) {
            router.replace('/puntos');
        }
    }, [configLoading, enabledModules, router]);

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

    const statusConfig = (status: string) => {
        const key = status as keyof typeof t.reservar.status;
        const colors: Record<string, string> = {
            pending: 'text-yellow-400 bg-yellow-400/10',
            confirmed: 'text-green-400 bg-green-400/10',
            seated: 'text-blue-400 bg-blue-400/10',
            completed: 'text-slate-400 bg-slate-400/10',
            cancelled: 'text-red-400 bg-red-400/10',
            no_show: 'text-red-400 bg-red-400/10',
        };
        return { label: t.reservar.status[key] || status, color: colors[status] || colors.pending };
    };

    const upcomingReservations = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed' && r.status !== 'no_show');

    // Translate time slot keys
    const slotLabels: Record<string, string> = {
        morning: t.reservar.morning,
        evening: t.reservar.evening,
    };

    return (
        <div className="px-4 pt-6 space-y-6 pb-4 max-w-2xl mx-auto">
            <h1 className="text-xl font-black">{t.reservar.title}</h1>

            {success && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
                    <Check size={20} className="text-green-400" />
                    <div>
                        <p className="font-bold text-green-400">{t.reservar.tableReserved}</p>
                        <p className="text-green-400/70 text-xs">{t.reservar.tableReservedSub}</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                        <CalendarDays size={14} /> {t.reservar.dateLabel}
                    </label>
                    <input
                        type="date" required min={today}
                        className="w-full px-4 py-3.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl text-white outline-none focus:border-amber-500 transition"
                        value={date} onChange={e => setDate(e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                        <Clock size={14} /> {t.reservar.timeLabel}
                    </label>
                    <div className="space-y-3">
                        {timeSlotGroups.map(group => (
                            <div key={group.key}>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">
                                    {slotLabels[group.key] || `${group.times[0]} - ${group.times[group.times.length - 1]}`}
                                </p>
                                <div className="grid grid-cols-4 gap-2">
                                    {group.times.map(slot => (
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
                        <Users size={14} /> {t.reservar.peopleLabel}
                    </label>
                    <div className="grid grid-cols-8 gap-2">
                        {partySizes.map(size => (
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
                        <MessageSquare size={14} /> {t.reservar.notesLabel}
                    </label>
                    <textarea
                        placeholder={t.reservar.notesPlaceholder}
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
                    {loading ? t.reservar.reserving : t.reservar.confirm}
                </button>
            </form>

            {upcomingReservations.length > 0 && (
                <div>
                    <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">{t.reservar.myReservations}</h2>
                    <div className="space-y-3">
                        {upcomingReservations.map(r => {
                            const s = statusConfig(r.status);
                            return (
                                <div key={r.id} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <CalendarDays size={16} className="text-amber-400" />
                                            <span className="font-bold">{formatDate(r.date)}</span>
                                            <span className="text-amber-400 font-bold">{r.time?.substring(0, 5)}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${s.color}`}>
                                            {s.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                        <span>{r.party_size} {t.reservar.people}</span>
                                        {r.table_number && <span>{t.reservar.table} {r.table_number} ({r.table_location})</span>}
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
