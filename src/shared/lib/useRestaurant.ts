'use client';
import { createContext, useContext, useState, useEffect } from 'react';

export interface VipLevel {
    key: string;
    min_points: number;
    icon: string;
    color: string;
    benefit?: string;
}

export interface TimeSlot {
    key: string;
    start: string;
    end: string;
    interval: number;
}

export interface RestaurantConfig {
    name: string;
    subtitle: string;
    city: string;
    department: string;
    country: string;
    country_name: string;
    phone: string;
    currency: string;
    currency_symbol: string;
    locale: string;
    timezone: string;
    points_per_unit: number;
    welcome_bonus: number;
    referral_bonus: number;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
}

export interface HoursConfig {
    schedule: Record<string, string>;
    time_slots: TimeSlot[];
    max_party_size: number;
    table_locations: string[];
}

export interface RestaurantContextValue {
    restaurant: RestaurantConfig;
    hours: HoursConfig;
    vipLevels: VipLevel[];
    /** Módulos habilitados del tenant (multivertical). Default: ['restaurant']. */
    enabledModules: string[];
    /** Vertical del tenant ('restaurant' | 'retail'). Default: 'restaurant'. */
    businessType: string;
    loading: boolean;
}

const DEFAULT_RESTAURANT: RestaurantConfig = {
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
};

const DEFAULT_HOURS: HoursConfig = {
    schedule: {},
    time_slots: [
        { key: 'morning', start: '09:00', end: '14:00', interval: 30 },
        { key: 'evening', start: '18:00', end: '21:00', interval: 30 },
    ],
    max_party_size: 16,
    table_locations: ['interior', 'terraza', 'privado'],
};

const DEFAULT_VIP: VipLevel[] = [
    { key: 'bronce', min_points: 0, icon: '🥉', color: 'from-amber-700 to-amber-900' },
    { key: 'plata', min_points: 500, icon: '🥈', color: 'from-slate-400 to-slate-600' },
    { key: 'oro', min_points: 1500, icon: '🥇', color: 'from-yellow-400 to-amber-500' },
    { key: 'inca', min_points: 5000, icon: '👑', color: 'from-red-500 to-amber-500' },
];

// Default retrocompatible: si aún no cargó la config, se asume el módulo
// 'restaurant' activo → El Machay (y cualquier restaurante) se ve idéntico y
// sin parpadeos de gating durante la carga.
const DEFAULT_MODULES = ['restaurant'];

export const RestaurantContext = createContext<RestaurantContextValue>({
    restaurant: DEFAULT_RESTAURANT,
    hours: DEFAULT_HOURS,
    vipLevels: DEFAULT_VIP,
    enabledModules: DEFAULT_MODULES,
    businessType: 'restaurant',
    loading: true,
});

export function useRestaurantProvider(): RestaurantContextValue {
    const [restaurant, setRestaurant] = useState<RestaurantConfig>(DEFAULT_RESTAURANT);
    const [hours, setHours] = useState<HoursConfig>(DEFAULT_HOURS);
    const [vipLevels, setVipLevels] = useState<VipLevel[]>(DEFAULT_VIP);
    const [enabledModules, setEnabledModules] = useState<string[]>(DEFAULT_MODULES);
    const [businessType, setBusinessType] = useState<string>('restaurant');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/config')
            .then(r => r.json())
            .then(data => {
                const cfg = data.config;
                if (cfg?.restaurant) setRestaurant({ ...DEFAULT_RESTAURANT, ...cfg.restaurant });
                if (cfg?.hours) setHours({ ...DEFAULT_HOURS, ...cfg.hours });
                if (cfg?.vip_levels?.levels) setVipLevels(cfg.vip_levels.levels);
                if (Array.isArray(data.enabledModules)) setEnabledModules(data.enabledModules);
                if (typeof data.businessType === 'string') setBusinessType(data.businessType);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return { restaurant, hours, vipLevels, enabledModules, businessType, loading };
}

export function useRestaurant() {
    return useContext(RestaurantContext);
}

/** Generate time slot options from config */
export function generateTimeSlots(slots: TimeSlot[]): { key: string; times: string[] }[] {
    return slots.map(slot => {
        const times: string[] = [];
        const [startH, startM] = slot.start.split(':').map(Number);
        const [endH, endM] = slot.end.split(':').map(Number);
        let current = startH * 60 + startM;
        const end = endH * 60 + endM;
        while (current < end) {
            const h = Math.floor(current / 60);
            const m = current % 60;
            times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
            current += slot.interval;
        }
        return { key: slot.key, times };
    });
}
