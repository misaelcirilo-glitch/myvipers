'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/shared/lib/useSession';
import { useI18n } from '@/shared/lib/i18n';
import { LocaleSwitcher } from '@/shared/components/LocaleSwitcher';
import {
    Zap, Star, UtensilsCrossed, Users, TrendingUp, Gift, ArrowRight,
    Calendar, Wallet, Globe, DollarSign, Check, ChevronDown, Quote, Flame,
    Shield, Sparkles, Award
} from 'lucide-react';

export default function MyVipersLandingPage() {
    const { user, loading } = useSession();
    const router = useRouter();
    const { t } = useI18n();
    const [openFaq, setOpenFaq] = useState<number | null>(null);
    const [demoLoading, setDemoLoading] = useState(false);

    useEffect(() => {
        if (!loading && user) router.replace('/admin');
    }, [user, loading, router]);

    const handleDemo = async () => {
        setDemoLoading(true);
        try {
            const res = await fetch('/api/demo-login', { method: 'POST' });
            if (res.ok) {
                router.push('/admin');
            } else {
                setDemoLoading(false);
            }
        } catch {
            setDemoLoading(false);
        }
    };

    const faqs = [
        { q: t.landing.faq1Q, a: t.landing.faq1A },
        { q: t.landing.faq2Q, a: t.landing.faq2A },
        { q: t.landing.faq3Q, a: t.landing.faq3A },
        { q: t.landing.faq4Q, a: t.landing.faq4A },
        { q: t.landing.faq5Q, a: t.landing.faq5A },
    ];

    const features = [
        { icon: Star, color: 'amber', title: t.landing.features.vipPoints, desc: t.landing.features.vipPointsDesc },
        { icon: UtensilsCrossed, color: 'blue', title: t.landing.features.digitalMenu, desc: t.landing.features.digitalMenuDesc },
        { icon: Gift, color: 'purple', title: t.landing.features.promos, desc: t.landing.features.promosDesc },
        { icon: Users, color: 'green', title: t.landing.features.crm, desc: t.landing.features.crmDesc },
        { icon: Calendar, color: 'cyan', title: t.landing.features.reservations, desc: t.landing.features.reservationsDesc },
        { icon: TrendingUp, color: 'rose', title: t.landing.features.multiLocation, desc: t.landing.features.multiLocationDesc },
        { icon: Wallet, color: 'emerald', title: t.landing.features.finance, desc: t.landing.features.financeDesc },
        { icon: Globe, color: 'indigo', title: t.landing.features.multiLang, desc: t.landing.features.multiLangDesc },
        { icon: DollarSign, color: 'orange', title: t.landing.features.multiCurrency, desc: t.landing.features.multiCurrencyDesc },
    ];

    const stats = [
        { value: '+40%', label: t.landing.statsRetention, desc: t.landing.statsRetentionDesc, color: 'text-amber-400' },
        { value: '+15%', label: t.landing.statsTicket, desc: t.landing.statsTicketDesc, color: 'text-emerald-400' },
        { value: '5 min', label: t.landing.statsSetup, desc: t.landing.statsSetupDesc, color: 'text-blue-400' },
        { value: '0%', label: t.landing.statsCommission, desc: t.landing.statsCommissionDesc, color: 'text-rose-400' },
    ];

    const testimonials = [
        { name: t.landing.testimonial1Name, role: t.landing.testimonial1Role, text: t.landing.testimonial1Text, color: 'from-amber-500 to-red-600' },
        { name: t.landing.testimonial2Name, role: t.landing.testimonial2Role, text: t.landing.testimonial2Text, color: 'from-blue-500 to-cyan-600' },
        { name: t.landing.testimonial3Name, role: t.landing.testimonial3Role, text: t.landing.testimonial3Text, color: 'from-emerald-500 to-teal-600' },
    ];

    const colorClasses: Record<string, { bg: string; text: string; ring: string }> = {
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', ring: 'ring-amber-500/20' },
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', ring: 'ring-blue-500/20' },
        purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', ring: 'ring-purple-500/20' },
        green: { bg: 'bg-green-500/10', text: 'text-green-400', ring: 'ring-green-500/20' },
        cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', ring: 'ring-cyan-500/20' },
        rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', ring: 'ring-rose-500/20' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
        indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', ring: 'ring-indigo-500/20' },
        orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', ring: 'ring-orange-500/20' },
    };

    return (
        <div className="min-h-screen bg-[#0f0f1a] text-white overflow-hidden">
            {/* Background gradient blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
            </div>

            {/* Nav */}
            <nav className="relative z-10 border-b border-white/5 px-6 py-4 backdrop-blur-md bg-[#0f0f1a]/80 sticky top-0">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-red-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <Zap size={18} className="text-white" />
                        </div>
                        <span className="text-lg font-black text-white">MyVipers</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <LocaleSwitcher />
                        <button
                            onClick={handleDemo}
                            disabled={demoLoading}
                            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 hover:border-amber-500/30 text-sm font-bold text-slate-300 rounded-lg transition-all"
                        >
                            <Sparkles size={14} className="text-amber-400" />
                            {demoLoading ? t.landing.demoLoading : t.landing.seeDemo}
                        </button>
                        <Link href="/login" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">
                            {t.auth.login}
                        </Link>
                        <Link href="/crear-restaurante" className="px-4 py-2 bg-gradient-to-r from-amber-500 to-red-600 text-white text-sm font-bold rounded-lg hover:brightness-110 transition-all shadow-lg shadow-amber-500/20">
                            {t.landing.createRestaurant}
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-20">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left: text */}
                    <div>
                        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest">
                            <Sparkles size={12} />
                            {t.landing.heroBadge}
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black leading-tight">
                            {t.landing.heroTitle}{' '}
                            <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 bg-clip-text text-transparent">
                                {t.landing.heroHighlight}
                            </span>
                        </h1>
                        <p className="text-lg text-slate-400 mt-6 max-w-xl leading-relaxed">
                            {t.landing.heroDesc}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-10">
                            <Link href="/crear-restaurante" className="px-8 py-4 bg-gradient-to-r from-amber-500 to-red-600 text-white text-base font-black rounded-2xl hover:brightness-110 transition-all shadow-xl shadow-amber-500/30 flex items-center gap-2">
                                {t.landing.startFree} <ArrowRight size={18} />
                            </Link>
                            <button
                                onClick={handleDemo}
                                disabled={demoLoading}
                                className="px-8 py-4 bg-white/5 border border-white/10 hover:border-amber-500/40 text-white text-base font-bold rounded-2xl transition-all flex items-center gap-2"
                            >
                                <Sparkles size={16} className="text-amber-400" />
                                {demoLoading ? t.landing.demoLoading : t.landing.seeDemo}
                            </button>
                        </div>
                        <div className="flex items-center gap-6 mt-6 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <Check size={14} className="text-emerald-400" /> {t.landing.noCreditCard}
                            </div>
                        </div>
                    </div>

                    {/* Right: VIP card mockup */}
                    <div className="relative">
                        {/* Floating decorations */}
                        <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-500/20 rounded-2xl rotate-12 blur-xl" />
                        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-red-500/20 rounded-2xl -rotate-12 blur-xl" />

                        {/* Phone frame */}
                        <div className="relative mx-auto max-w-sm">
                            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-[3rem] border border-white/10 p-3 shadow-2xl shadow-amber-500/10">
                                <div className="bg-[#0f0f1a] rounded-[2.5rem] overflow-hidden">
                                    {/* Mock header */}
                                    <div className="bg-gradient-to-br from-amber-500 to-red-600 p-6 text-center">
                                        <Award size={28} className="text-white mx-auto mb-2" />
                                        <p className="text-white/80 text-[10px] uppercase tracking-widest font-bold">Tarjeta VIP</p>
                                        <p className="text-white text-3xl font-black mt-1 tabular-nums">2,840</p>
                                        <p className="text-white/80 text-xs uppercase tracking-widest font-bold mt-0.5">puntos</p>
                                        <div className="mt-3 flex items-center justify-center gap-2">
                                            <Crown />
                                            <span className="text-white font-black uppercase text-sm">Nivel Oro</span>
                                        </div>
                                        <div className="mt-3 bg-white/20 rounded-full h-1.5">
                                            <div className="bg-white rounded-full h-1.5 w-3/4" />
                                        </div>
                                        <p className="text-[10px] text-white/70 mt-2">5,000 pts → Inca</p>
                                    </div>

                                    {/* Mock rewards */}
                                    <div className="p-4 space-y-2">
                                        <div className="bg-[#1a1a2e] border border-amber-500/20 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center">
                                                <Gift size={16} className="text-amber-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white text-xs font-bold">Postre gratis</p>
                                                <p className="text-amber-400 text-[10px] font-bold">200 pts</p>
                                            </div>
                                            <button className="text-[10px] font-bold bg-amber-500 text-white px-2.5 py-1 rounded-md">Canjear</button>
                                        </div>
                                        <div className="bg-[#1a1a2e] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-9 h-9 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                                                <Star size={16} className="text-emerald-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white text-xs font-bold">10% descuento</p>
                                                <p className="text-slate-500 text-[10px]">300 pts</p>
                                            </div>
                                        </div>
                                        <div className="bg-[#1a1a2e] border border-white/5 rounded-xl p-3 flex items-center gap-3">
                                            <div className="w-9 h-9 bg-rose-500/10 rounded-lg flex items-center justify-center">
                                                <Flame size={16} className="text-rose-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-white text-xs font-bold">Parrilla para 2</p>
                                                <p className="text-slate-500 text-[10px]">1,000 pts</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Floating points badge */}
                            <div className="absolute -top-4 -left-8 bg-emerald-500 text-white px-3 py-2 rounded-xl shadow-xl shadow-emerald-500/30 rotate-[-8deg] animate-bounce-slow">
                                <p className="text-xs font-black flex items-center gap-1">
                                    <Star size={12} fill="currentColor" /> +50 pts
                                </p>
                            </div>
                            <div className="absolute -bottom-4 -right-6 bg-amber-500 text-white px-3 py-2 rounded-xl shadow-xl shadow-amber-500/30 rotate-6">
                                <p className="text-[10px] font-black uppercase tracking-widest">Cliente fiel</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 py-16 border-y border-white/5">
                <h2 className="text-center text-xs font-black text-slate-500 uppercase tracking-widest mb-10">{t.landing.statsTitle}</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map(s => (
                        <div key={s.label} className="text-center">
                            <p className={`text-5xl md:text-6xl font-black ${s.color}`}>{s.value}</p>
                            <p className="text-sm font-bold text-white mt-3 uppercase tracking-wide">{s.label}</p>
                            <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
                <div className="text-center mb-14">
                    <h2 className="text-3xl md:text-4xl font-black text-white">{t.landing.howTitle}</h2>
                    <p className="text-slate-400 mt-3 max-w-xl mx-auto">{t.landing.howSubtitle}</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    {[
                        { n: '01', title: t.landing.step1Title, desc: t.landing.step1Desc, icon: UtensilsCrossed, color: 'amber' },
                        { n: '02', title: t.landing.step2Title, desc: t.landing.step2Desc, icon: Zap, color: 'orange' },
                        { n: '03', title: t.landing.step3Title, desc: t.landing.step3Desc, icon: Star, color: 'red' },
                    ].map((step, i) => (
                        <div key={i} className="relative bg-[#1a1a2e] border border-white/5 rounded-3xl p-6 hover:border-amber-500/30 transition-colors">
                            <div className="text-7xl font-black text-white/5 absolute top-3 right-5">{step.n}</div>
                            <div className={`w-12 h-12 bg-${step.color}-500/10 ring-1 ring-${step.color}-500/20 rounded-xl flex items-center justify-center mb-4 relative`}>
                                <step.icon size={22} className={`text-${step.color}-400`} />
                            </div>
                            <h3 className="text-white font-black text-lg relative">{step.title}</h3>
                            <p className="text-sm text-slate-400 mt-2 relative">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features grid */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
                <div className="text-center mb-14">
                    <h2 className="text-3xl md:text-4xl font-black text-white">{t.landing.featuresTitle}</h2>
                    <p className="text-slate-400 mt-3 max-w-xl mx-auto">{t.landing.featuresSubtitle}</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map(f => {
                        const c = colorClasses[f.color];
                        return (
                            <div key={f.title} className="bg-[#1a1a2e] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors group">
                                <div className={`w-11 h-11 ${c.bg} ring-1 ${c.ring} rounded-xl flex items-center justify-center mb-4`}>
                                    <f.icon size={20} className={c.text} />
                                </div>
                                <h3 className="text-white font-bold">{f.title}</h3>
                                <p className="text-sm text-slate-400 mt-1.5">{f.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Testimonials */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 py-20">
                <div className="text-center mb-14">
                    <h2 className="text-3xl md:text-4xl font-black text-white">{t.landing.testimonialsTitle}</h2>
                    <p className="text-slate-400 mt-3">{t.landing.testimonialsSubtitle}</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    {testimonials.map((t2, i) => (
                        <div key={i} className="bg-[#1a1a2e] border border-white/5 rounded-2xl p-6 relative">
                            <Quote size={28} className="text-amber-500/30 absolute top-4 right-4" />
                            <div className="flex items-center gap-1 text-amber-400 mb-4">
                                {[1, 2, 3, 4, 5].map(n => <Star key={n} size={14} fill="currentColor" />)}
                            </div>
                            <p className="text-slate-300 leading-relaxed text-sm">{t2.text}</p>
                            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-white/5">
                                <div className={`w-10 h-10 bg-gradient-to-br ${t2.color} rounded-full flex items-center justify-center text-white font-black text-sm`}>
                                    {t2.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                    <p className="text-white text-sm font-bold">{t2.name}</p>
                                    <p className="text-xs text-slate-500">{t2.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* FAQ */}
            <section className="relative z-10 max-w-3xl mx-auto px-6 py-20">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-black text-white">{t.landing.faqTitle}</h2>
                </div>
                <div className="space-y-3">
                    {faqs.map((faq, i) => (
                        <button
                            key={i}
                            onClick={() => setOpenFaq(openFaq === i ? null : i)}
                            className="w-full text-left bg-[#1a1a2e] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-white font-bold">{faq.q}</span>
                                <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                            </div>
                            {openFaq === i && (
                                <p className="text-sm text-slate-400 mt-3 leading-relaxed">{faq.a}</p>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            {/* Final CTA */}
            <section className="relative z-10 max-w-4xl mx-auto px-6 py-20">
                <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-10 left-10"><Star size={60} className="text-white" /></div>
                        <div className="absolute bottom-10 right-10"><Award size={80} className="text-white" /></div>
                        <div className="absolute top-1/2 left-1/4"><Sparkles size={40} className="text-white" /></div>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-white relative">{t.landing.finalCtaTitle}</h2>
                    <p className="text-white/90 mt-4 text-lg relative">{t.landing.finalCtaDesc}</p>
                    <div className="flex flex-wrap items-center justify-center gap-3 mt-8 relative">
                        <Link href="/crear-restaurante" className="bg-white text-orange-600 px-8 py-4 rounded-2xl text-base font-black hover:brightness-110 transition-all shadow-2xl flex items-center gap-2">
                            {t.landing.finalCtaButton} <ArrowRight size={18} />
                        </Link>
                        <button
                            onClick={handleDemo}
                            disabled={demoLoading}
                            className="bg-white/10 border border-white/30 text-white px-8 py-4 rounded-2xl text-base font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                        >
                            <Sparkles size={16} />
                            {demoLoading ? t.landing.demoLoading : t.landing.seeDemo}
                        </button>
                    </div>
                    <p className="text-xs text-white/80 mt-5 relative flex items-center justify-center gap-2">
                        <Shield size={12} /> {t.landing.finalCtaNote}
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/5 py-10 px-6">
                <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <Zap size={16} className="text-amber-400" />
                        <span className="text-sm font-bold text-white">MyVipers</span>
                    </div>
                    <p className="text-xs text-slate-500">2026 MyVipers. {t.landing.footerText}</p>
                </div>
            </footer>
        </div>
    );
}

function Crown() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-white">
            <path d="M5 16L3 7L8 10L12 4L16 10L21 7L19 16H5Z" />
        </svg>
    );
}
