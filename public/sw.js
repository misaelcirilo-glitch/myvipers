// MyVipers Service Worker — Web Push
// IMPORTANTE: incrementar SW_VERSION en cada release cambia el byte-diff del
// script y fuerza al navegador a instalar este SW y purgar cualquier caché roto.
const SW_VERSION = 'v2-2026-07-01';
const CACHE_NAME = `myvipers-${SW_VERSION}`;

self.addEventListener('install', () => {
    // Activar de inmediato, sin esperar a que se cierren las pestañas viejas.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            // Purga TODA la Cache Storage (incluye caches de versiones anteriores
            // que pudieran estar sirviendo un app-shell roto en la PWA instalada).
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
            await self.clients.claim();
        })()
    );
});

// Nota: NO se registra un handler `fetch`. La app se sirve siempre desde la red
// (Vercel), evitando que el SW devuelva una versión cacheada rota. Este SW solo
// existe para Web Push. CACHE_NAME queda declarado para el purgado y trazabilidad.

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { title: 'MyVipers', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'MyVipers';
    const options = {
        body: data.body || '',
        icon: data.icon || '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: data.url || '/puntos' },
        tag: data.tag || 'myvipers-promo',
        renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const c of clients) {
                if ('focus' in c) {
                    c.navigate(target);
                    return c.focus();
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(target);
        })
    );
});
