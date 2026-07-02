import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Solo en el dominio de El Machay: la raíz SIRVE (rewrite, no redirect) la
    // vista del restaurante manteniendo la URL "/" con status 200. Clave para la
    // PWA instalada: su `start_url` es "/", y un redirect en start_url rompe el
    // lanzamiento en muchos dispositivos (pantalla en blanco). Con rewrite, "/"
    // responde 200 y la app abre bien. En myvipers.es (otro host) no aplica y la
    // raíz sigue mostrando la landing de la plataforma.
    // beforeFiles: el rewrite corre ANTES de las rutas del filesystem, así que
    // gana sobre la página landing de "/". (afterFiles solo aplicaría si "/" no
    // existiera como página, y sí existe.)
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: "el-machay.vercel.app" }],
          destination: "/r/el-machay",
        },
      ],
    };
  },
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
