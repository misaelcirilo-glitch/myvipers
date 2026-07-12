import { db } from '@/shared/lib/db';
import { NextResponse } from 'next/server';
import { getSession } from '@/shared/lib/auth';
import { getTenantConfig } from '@/shared/lib/tenant';

export async function GET() {
    // Módulos habilitados del tenant (multivertical, Fase 2). Retrocompatible:
    // sin sesión o sin fila devuelve ['restaurant'] → El Machay no cambia nada.
    let enabledModules: string[] = ['restaurant'];
    try {
        const session = await getSession();
        if (session?.restaurantId) {
            enabledModules = (await getTenantConfig(session.restaurantId)).enabledModules;
        }
    } catch {
        enabledModules = ['restaurant'];
    }

    try {
        const rows = await db`SELECT key, value FROM config`;
        const config: Record<string, any> = {};
        for (const row of rows) {
            config[row.key] = row.value;
        }
        return NextResponse.json({ config, enabledModules });
    } catch {
        // Fallback defaults if DB not available
        return NextResponse.json({
            enabledModules,
            config: {
                restaurant: {
                    name: 'Mi Restaurante',
                    subtitle: 'Restaurante',
                    city: '',
                    department: '',
                    country: 'PE',
                    country_name: 'Perú',
                    phone: '',
                    currency: 'PEN',
                    currency_symbol: 'S/',
                    locale: 'es',
                    timezone: 'America/Lima',
                    points_per_unit: 1,
                    welcome_bonus: 50,
                    referral_bonus: 100,
                    logo_url: null,
                    primary_color: '#f59e0b',
                    secondary_color: '#dc2626',
                },
                hours: {
                    schedule: {},
                    time_slots: [
                        { key: 'morning', start: '09:00', end: '14:00', interval: 30 },
                        { key: 'evening', start: '18:00', end: '21:00', interval: 30 },
                    ],
                    max_party_size: 16,
                    table_locations: ['interior', 'terraza', 'privado'],
                },
                vip_levels: {
                    levels: [
                        { key: 'bronce', min_points: 0, icon: '🥉', color: 'from-amber-700 to-amber-900' },
                        { key: 'plata', min_points: 500, icon: '🥈', color: 'from-slate-400 to-slate-600' },
                        { key: 'oro', min_points: 1500, icon: '🥇', color: 'from-yellow-400 to-amber-500' },
                        { key: 'inca', min_points: 5000, icon: '👑', color: 'from-red-500 to-amber-500' },
                    ],
                },
            },
        });
    }
}
