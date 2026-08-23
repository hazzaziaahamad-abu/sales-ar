import React from "react";
import type { LucideIcon } from "lucide-react";
import { MessageCircle, Check, ArrowLeft, ShieldCheck, Star } from "lucide-react";
import BannerCarousel, { type OfferBanner } from "@/components/offer/BannerCarousel";

/* رقم واتساب المبيعات (صيغة دولية بدون + أو أصفار) */
export const WHATSAPP_NUMBER = "966591166861";

export type OfferPain = { icon: LucideIcon; text: string };
export type OfferBenefit = { icon: LucideIcon; title: string; text: string };
export type OfferResult = { stat: string; label: string };
export type OfferTier = {
  name: string;
  price: string;
  period: string;
  note: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
};

export type OfferConfig = {
  brand: string;
  logo: "menu" | "calendar";
  banners?: OfferBanner[];
  accent: string;
  accentDeep: string;
  gold: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  trustLine: string;
  whatsappMsg: string;
  painsTitle: string;
  pains: OfferPain[];
  benefitsTitle: string;
  benefits: OfferBenefit[];
  resultsTitle: string;
  results: OfferResult[];
  tiersTitle: string;
  tiersHint: string;
  tiers: OfferTier[];
  closingTitle: string;
  closingText: string;
};

function Logo({ kind, accent, accentDeep }: { kind: "menu" | "calendar"; accent: string; accentDeep: string }) {
  if (kind === "calendar") {
    return (
      <svg width={36} height={36} viewBox="0 0 40 40" aria-hidden="true">
        <rect x="5" y="9" width="30" height="27" rx="6" fill={accent} />
        <rect x="5" y="9" width="30" height="9" rx="6" fill={accentDeep} />
        <rect x="12" y="5" width="3.4" height="8" rx="1.7" fill={accentDeep} />
        <rect x="24.6" y="5" width="3.4" height="8" rx="1.7" fill={accentDeep} />
        <path d="M14 26.8 L18.4 31 L27 22.2" fill="none" stroke="#F6D44B" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width={36} height={36} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="3" y="3" width="15" height="15" rx="3" fill={accent} />
      <rect x="22" y="3" width="15" height="15" rx="3" fill={accent} />
      <rect x="3" y="22" width="15" height="15" rx="3" fill={accent} />
      <rect x="22" y="22" width="15" height="15" rx="3" fill={accent} />
      <circle cx="29.5" cy="29.5" r="3.6" fill="#F6D44B" />
    </svg>
  );
}

function waLink(msg: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function WhatsAppButton({ msg, large = false }: { msg: string; large?: boolean }) {
  return (
    <a
      href={waLink(msg)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full font-extrabold text-white shadow-lg transition-transform hover:-translate-y-0.5 ${
        large ? "px-7 py-3.5 text-base" : "px-4 py-2 text-sm"
      }`}
      style={{ backgroundColor: "#25D366", boxShadow: "0 12px 26px -10px rgba(37,211,102,.6)" }}
    >
      <MessageCircle size={large ? 20 : 16} fill="#fff" stroke="#25D366" />
      تواصل معنا واتساب
    </a>
  );
}

export default function OfferLanding({ config }: { config: OfferConfig }) {
  const { accent, accentDeep, gold } = config;
  return (
    <div
      dir="rtl"
      className="min-h-screen w-full"
      style={{ fontFamily: "'Tajawal', system-ui, sans-serif", backgroundColor: "#fbfaf5", color: "#2b2620" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');`}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b" style={{ backgroundColor: "rgba(251,250,245,.85)", borderColor: "#eee3d6", backdropFilter: "blur(8px)" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo kind={config.logo} accent={accent} accentDeep={accentDeep} />
            <span className="text-lg font-black" style={{ color: accentDeep }}>{config.brand}</span>
          </div>
          <WhatsAppButton msg={config.whatsappMsg} />
        </div>
      </header>

      {/* Ad banners (carousel) */}
      {config.banners && config.banners.length > 0 && (
        <BannerCarousel banners={config.banners} accent={accent} />
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: `radial-gradient(1200px 400px at 80% -10%, ${accent}22, transparent), radial-gradient(900px 380px at 0% 0%, ${gold}22, transparent)` }}
          aria-hidden="true"
        />
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-14 text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: `${accent}18`, color: accentDeep, border: `1px solid ${accent}33` }}
          >
            <Star size={13} fill={gold} stroke={gold} /> {config.heroBadge}
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl" style={{ color: "#2b2620" }}>
            {config.heroTitle}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: "#6f6156" }}>
            {config.heroSubtitle}
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3">
            <WhatsAppButton msg={config.whatsappMsg} large />
            <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#8a7c70" }}>
              <ShieldCheck size={14} style={{ color: accent }} /> {config.trustLine}
            </span>
          </div>
        </div>
      </section>

      {/* Pains */}
      <section className="mx-auto max-w-5xl px-4 py-10">
        <h2 className="mb-6 text-center text-2xl font-black" style={{ color: "#2b2620" }}>{config.painsTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {config.pains.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="flex items-start gap-3 rounded-2xl p-4" style={{ backgroundColor: "#fff", border: "1px solid #f0d9d1", boxShadow: "0 8px 20px -16px rgba(159,18,57,.4)" }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "#FBE8E1", color: "#B4341F" }}>
                  <Icon size={18} />
                </span>
                <p className="pt-1 text-sm font-semibold leading-relaxed" style={{ color: "#5a4a40" }}>{p.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Benefits / Solution */}
      <section style={{ backgroundColor: "#fff", borderTop: "1px solid #eee3d6", borderBottom: "1px solid #eee3d6" }}>
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-2 text-center text-2xl font-black" style={{ color: accentDeep }}>{config.benefitsTitle}</h2>
          <p className="mb-8 text-center text-sm" style={{ color: "#8a7c70" }}>حلول عملية تشتغل من أول يوم</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {config.benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} className="rounded-2xl p-5" style={{ backgroundColor: "#fbfaf5", border: "1px solid #ece1d3" }}>
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: accent }}>
                    <Icon size={22} strokeWidth={2.2} />
                  </span>
                  <h3 className="mb-1 text-base font-black" style={{ color: "#2b2620" }}>{b.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#6f6156" }}>{b.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="mb-8 text-center text-2xl font-black" style={{ color: "#2b2620" }}>{config.resultsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {config.results.map((r, i) => (
            <div key={i} className="rounded-2xl p-5 text-center" style={{ background: `linear-gradient(160deg, ${accent}12, #fff)`, border: `1px solid ${accent}22` }}>
              <p className="text-2xl font-black" style={{ color: accentDeep }}>{r.stat}</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed" style={{ color: "#6f6156" }}>{r.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Packages */}
      <section style={{ backgroundColor: "#fff", borderTop: "1px solid #eee3d6" }}>
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-2 text-center text-2xl font-black" style={{ color: accentDeep }}>{config.tiersTitle}</h2>
          <p className="mb-8 text-center text-sm" style={{ color: "#8a7c70" }}>{config.tiersHint}</p>
          <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
            {config.tiers.map((t, i) => (
              <div
                key={i}
                className="relative flex flex-col rounded-3xl p-6"
                style={{
                  backgroundColor: t.highlight ? "#fffdf7" : "#fbfaf5",
                  border: t.highlight ? `2px solid ${gold}` : "1px solid #ece1d3",
                  boxShadow: t.highlight ? `0 18px 40px -20px ${accent}66` : "none",
                }}
              >
                {t.badge && (
                  <span className="absolute -top-3 right-6 rounded-full px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: gold, color: "#4a3410" }}>
                    {t.badge}
                  </span>
                )}
                <h3 className="text-lg font-black" style={{ color: "#2b2620" }}>{t.name}</h3>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-black" style={{ color: accentDeep }}>{t.price}</span>
                  <span className="pb-1 text-xs font-semibold" style={{ color: "#8a7c70" }}>{t.period}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "#8a7c70" }}>{t.note}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {t.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm" style={{ color: "#4a3f36" }}>
                      <Check size={16} strokeWidth={2.6} className="mt-0.5 shrink-0" style={{ color: accent }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={waLink(`${config.whatsappMsg} — مهتم بـ${t.name}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: t.highlight ? accent : "#25D366" }}
                >
                  <MessageCircle size={16} fill="#fff" stroke={t.highlight ? accent : "#25D366"} />
                  اشترك الآن
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <div className="rounded-3xl p-8 text-center text-white" style={{ background: `linear-gradient(140deg, ${accentDeep}, ${accent})` }}>
          <h2 className="text-2xl font-black">{config.closingTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed" style={{ color: "#ffffffcc" }}>{config.closingText}</p>
          <div className="mt-6 flex justify-center">
            <WhatsAppButton msg={config.whatsappMsg} large />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-6 text-center text-xs" style={{ borderColor: "#eee3d6", color: "#a89c90" }}>
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2">
          <Logo kind={config.logo} accent={accent} accentDeep={accentDeep} />
          <span className="font-bold" style={{ color: accentDeep }}>{config.brand}</span>
          <ArrowLeft size={12} />
          <span>حلول رقمية للأعمال · صنع في السعودية 🇸🇦</span>
        </div>
      </footer>
    </div>
  );
}
