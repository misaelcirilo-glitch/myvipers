'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/shared/lib/useSession';
import { UtensilsCrossed, CalendarDays, Star, User } from 'lucide-react';
import Link from 'next/link';

const NAV_ITEMS = [
    { href: '/carta', icon: UtensilsCrossed, label: 'Carta' },
    { href: '/reservar', icon: CalendarDays, label: 'Reservar' },
    { href: '/puntos', icon: Star, label: 'Puntos' },
    { href: '/perfil', icon: User, label: 'Perfil' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useSession();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user) router.replace('/login');
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a]">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen flex flex-col bg-[#0f0f1a] pb-20">
            <div className="flex-1">{children}</div>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] border-t border-[#2a2a3e] px-2 py-2 z-50">
                <div className="flex items-center justify-around max-w-md mx-auto">
                    {NAV_ITEMS.map(item => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${isActive ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
