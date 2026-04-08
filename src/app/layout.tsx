import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'El Machay - Parrillas & Ceviche Peruano',
    description: 'Restaurante peruano en Pomabamba, Ancash. Reserva tu mesa, acumula puntos VIP y disfruta lo mejor de la gastronomía peruana.',
    manifest: '/manifest.json',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'El Machay' },
};

export const viewport: Viewport = {
    themeColor: '#1a1a2e',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es">
            <body className={`${inter.className} bg-[#0f0f1a] text-white antialiased min-h-screen`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
