'use client';
import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Share, Plus, SmartphoneNfc } from 'lucide-react';
import {
    pushSupported,
    isCurrentlySubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    isIOS,
    isStandalone,
} from '@/shared/lib/push-client';

export function PushToggle() {
    const [supported, setSupported] = useState(false);
    const [subscribed, setSubscribed] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [loading, setLoading] = useState(false);
    const [ios, setIos] = useState(false);
    const [standalone, setStandalone] = useState(false);

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

    useEffect(() => {
        setIos(isIOS());
        setStandalone(isStandalone());
        const ok = pushSupported();
        setSupported(ok);
        if (!ok) return;
        setPermission(Notification.permission);
        isCurrentlySubscribed().then(setSubscribed);
    }, []);

    if (!supported) {
        // iPhone/iPad en Safari SIN instalar: el push no existe hasta instalar la
        // PWA. En vez del aviso pasivo, guiamos el "Añadir a inicio" paso a paso.
        if (ios && !standalone) {
            return (
                <div className="bg-[#1a1a2e] border border-amber-500/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <SmartphoneNfc size={18} className="text-amber-400" />
                        <p className="text-sm font-bold text-amber-300">Activa avisos en tu iPhone</p>
                    </div>
                    <p className="text-[11px] text-slate-400">Para recibir promociones necesitas instalar MyVipers en tu pantalla de inicio. Toma 10 segundos:</p>
                    <ol className="space-y-2">
                        <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-black flex items-center justify-center shrink-0">1</span>
                            <p className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">Toca el botón <Share size={13} className="inline text-amber-400" /> <b>Compartir</b> en la barra de Safari</p>
                        </li>
                        <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-black flex items-center justify-center shrink-0">2</span>
                            <p className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">Elige <Plus size={13} className="inline text-amber-400" /> <b>Añadir a inicio</b></p>
                        </li>
                        <li className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-black flex items-center justify-center shrink-0">3</span>
                            <p className="text-xs text-slate-300">Abre MyVipers desde el <b>nuevo icono</b> y vuelve aquí para activar los avisos</p>
                        </li>
                    </ol>
                </div>
            );
        }
        // iPhone/iPad YA instalado pero sin soporte de push = iOS < 16.4.
        if (ios && standalone) {
            return (
                <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-4">
                    <p className="text-xs text-slate-500">
                        Para recibir avisos, actualiza tu iPhone a <b>iOS 16.4 o superior</b> (Ajustes → General → Actualización de software) y vuelve a abrir la app.
                    </p>
                </div>
            );
        }
        // Otros navegadores sin soporte (escritorio antiguo, etc.).
        return (
            <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-2xl p-4">
                <p className="text-xs text-slate-500">
                    Tu navegador no soporta notificaciones push. Ábrela en Chrome o Safari, o instala MyVipers como app, para recibir promociones.
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
