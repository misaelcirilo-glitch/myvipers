'use client';
import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import {
    pushSupported,
    isCurrentlySubscribed,
    subscribeToPush,
    unsubscribeFromPush,
} from '@/shared/lib/push-client';

export function PushToggle() {
    const [supported, setSupported] = useState(false);
    const [subscribed, setSubscribed] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [loading, setLoading] = useState(false);

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

    useEffect(() => {
        const ok = pushSupported();
        setSupported(ok);
        if (!ok) return;
        setPermission(Notification.permission);
        isCurrentlySubscribed().then(setSubscribed);
    }, []);

    if (!supported) {
        return (
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-4">
                <p className="text-xs text-slate-500">
                    Tu navegador no soporta notificaciones push. En iPhone, instala MyVipers como app desde Safari (Compartir → Añadir a inicio) y vuelve a abrirla.
                </p>
            </div>
        );
    }

    if (!vapidKey) {
        return (
            <div className="bg-[#1a1a2e] border border-amber-500/20 rounded-2xl p-4">
                <p className="text-xs text-amber-400 font-bold">Notificaciones no configuradas</p>
                <p className="text-[10px] text-slate-500 mt-1">Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY en el entorno.</p>
            </div>
        );
    }

    const handleToggle = async () => {
        setLoading(true);
        try {
            if (subscribed) {
                await unsubscribeFromPush();
                setSubscribed(false);
            } else {
                const ok = await subscribeToPush(vapidKey);
                setSubscribed(ok);
                setPermission(Notification.permission);
                if (!ok && Notification.permission === 'denied') {
                    alert('Activa las notificaciones desde los ajustes del navegador para recibir promociones.');
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const blocked = permission === 'denied';

    return (
        <button
            onClick={handleToggle}
            disabled={loading || blocked}
            className={`w-full p-4 rounded-2xl border flex items-center gap-3 transition ${
                subscribed
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
                    : blocked
                        ? 'bg-[#1a1a2e] border-[#2a2a3e] text-slate-500 cursor-not-allowed'
                        : 'bg-[#1a1a2e] border-[#2a2a3e] text-slate-300 hover:border-amber-500/30'
            }`}
        >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${subscribed ? 'bg-amber-500/20' : 'bg-[#0f0f1a]'}`}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : subscribed ? <Bell size={18} /> : <BellOff size={18} />}
            </div>
            <div className="flex-1 text-left">
                <p className="text-sm font-bold">
                    {blocked ? 'Notificaciones bloqueadas' : subscribed ? 'Notificaciones activas' : 'Activar notificaciones'}
                </p>
                <p className="text-[11px] opacity-70 mt-0.5">
                    {blocked
                        ? 'Permítelas desde los ajustes del navegador'
                        : subscribed
                            ? 'Recibirás promociones y novedades'
                            : 'Entérate de promociones nuevas'}
                </p>
            </div>
        </button>
    );
}
