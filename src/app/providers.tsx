'use client';
import { useEffect } from 'react';
import { SessionContext, useSessionProvider } from '@/shared/lib/useSession';
import { I18nContext, useI18nProvider } from '@/shared/lib/i18n';
import { RestaurantContext, useRestaurantProvider } from '@/shared/lib/useRestaurant';

// Blindaje PWA: si tras un deploy la app instalada intenta cargar un chunk JS con
// hash antiguo que ya no existe en el servidor (ChunkLoadError), recarga UNA vez
// para traer el HTML+assets frescos. Evita la pantalla "This page couldn't load"
// en la PWA instalada. Cap de 2 recargas por sesión para no entrar en bucle.
function useChunkReloadGuard() {
    useEffect(() => {
        const isChunkError = (msg?: string | null) =>
            !!msg && (
                /ChunkLoadError/i.test(msg) ||
                /Loading chunk [\w-]+ failed/i.test(msg) ||
                /Loading CSS chunk/i.test(msg) ||
                /Failed to fetch dynamically imported module/i.test(msg) ||
                /error loading dynamically imported module/i.test(msg) ||
                /importing a module script failed/i.test(msg)
            );
        const recover = () => {
            const KEY = 'mv_chunk_reloads';
            const n = Number(sessionStorage.getItem(KEY) || '0');
            if (n >= 2) return; // máx. 2 recargas por sesión → sin bucles
            sessionStorage.setItem(KEY, String(n + 1));
            window.location.reload();
        };
        const onError = (e: ErrorEvent) => {
            if (isChunkError(e.message) || isChunkError(e.error?.message)) recover();
        };
        const onRejection = (e: PromiseRejectionEvent) => {
            const r = e.reason as { name?: string; message?: string } | string | undefined;
            const name = typeof r === 'object' ? r?.name : undefined;
            const msg = typeof r === 'string' ? r : r?.message;
            if (name === 'ChunkLoadError' || isChunkError(msg)) recover();
        };
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
        };
    }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
    useChunkReloadGuard();
    const session = useSessionProvider();
    const restaurant = useRestaurantProvider();
    const i18n = useI18nProvider(restaurant.restaurant.currency);
    return (
        <RestaurantContext.Provider value={restaurant}>
            <I18nContext.Provider value={i18n}>
                <SessionContext.Provider value={session}>
                    {children}
                </SessionContext.Provider>
            </I18nContext.Provider>
        </RestaurantContext.Provider>
    );
}
