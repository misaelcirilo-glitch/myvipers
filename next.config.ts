import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // El service worker y el manifest NUNCA deben cachearse por el CDN de Vercel
    // ni por el navegador: así una nueva versión del SW se detecta y activa de
    // inmediato (purgando el caché viejo) en lugar de quedar servida una versión
    // rota en la PWA instalada.
    const noStore = [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Pragma", value: "no-cache" },
      { key: "Expires", value: "0" },
    ];
    return [
      {
        source: "/sw.js",
        headers: [
          ...noStore,
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      { source: "/manifest.json", headers: noStore },
      { source: "/api/manifest", headers: noStore },
    ];
  },
};

export default nextConfig;
