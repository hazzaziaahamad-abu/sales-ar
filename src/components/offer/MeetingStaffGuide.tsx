"use client";

// «دليل الموظف لاجتماع العميل» — نسخة داخلية من خطة اجتماع العميل:
// كل باقة بمزاياها بالتفصيل (وش هي · وش يكسب العميل · قلها كذا)، إشارات الترقية، والاعتراضات.

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check, ChevronDown, Presentation, Printer, Star, MessageSquareQuote, ArrowUpLeft, ShieldQuestion,
  Target, Users, Layers, Sparkles, Filter, RotateCcw, Flame, Plus, QrCode, CalendarCheck, Clock, Scissors,
  BookOpen, GraduationCap,
} from "lucide-react";
import BackToPlatform from "@/components/offer/BackToPlatform";
import MeetingStaffTraining from "@/components/offer/MeetingStaffTraining";
import {
  IMPACTS, STAFF_PRODUCTS, type Impact, type ProductKey, type StaffProduct, type StaffTier, type Feature,
} from "@/lib/sales/meeting-staff-content";

const GOLD = "#FFCC00";
const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (n: number) => Math.round(n).toLocaleString(LOCALE);
const featKey = (p: ProductKey, t: number, g: number, f: number) => `${p}:${t}:${g}:${f}`;
const STORE_KEY = "msg-shown";

const noop = () => () => {};

export default function MeetingStaffGuide() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <div className="min-h-screen bg-[#F4F5FA]" />;
  return <Inner />;
}

function Inner() {
  const params = useSearchParams();
  const [pk, setPk] = useState<ProductKey>(params.get("p") === "nahjez" ? "nahjez" : "menu");
  const P = STAFF_PRODUCTS[pk];
  const [mode, setMode] = useState<"guide" | "train">(params.get("mode") === "train" ? "train" : "guide");
  const switchMode = (m: "guide" | "train") => { setMode(m); window.scrollTo({ top: 0 }); };

  const [filter, setFilter] = useState<Impact | "star" | null>(null);
  const [activeTier, setActiveTier] = useState(0);
  const [shown, setShown] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") ?? {}; } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(shown)); } catch { /* ignore */ }
  }, [shown]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set("p", pk);
    if (mode === "train") q.set("mode", "train"); else q.delete("mode");
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  }, [pk, mode]);

  // تتبّع الباقة الظاهرة
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-tier]"));
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) setActiveTier(Number((e.target as HTMLElement).dataset.tier)); }),
      { rootMargin: "-35% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pk, mode]);

  const stats = useMemo(() => {
    let all = 0, stars = 0;
    P.tiers.forEach((t) => t.groups.forEach((g) => g.features.forEach((f) => { all++; if (f.star) stars++; })));
    return { all, stars };
  }, [P]);

  const tierProgress = (ti: number) => {
    let n = 0, done = 0;
    P.tiers[ti].groups.forEach((g, gi) => g.features.forEach((_, fi) => { n++; if (shown[featKey(pk, ti, gi, fi)]) done++; }));
    return { n, done };
  };

  const resetShown = () => setShown((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith(`${pk}:`))));
  const goTier = (i: number) => document.getElementById(`tier-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div
      dir="rtl"
      className="ms-root min-h-screen w-full overflow-x-clip bg-[var(--bg)] text-[var(--body)]"
      style={{
        "--bg": "#F4F5FA", "--surface": "#FFFFFF", "--surface-2": "#EEF0F7", "--hover": "#EEF0F7",
        "--line": "#E3E6EF", "--line-strong": "#CDD2E1", "--ink": "#171A3A", "--body": "#3D4262",
        "--muted": "#666C8E", "--faint": "#9499B4",
        "--acc": P.accent, "--deep": P.deep,
        fontFamily: "var(--font-tajawal), system-ui, sans-serif",
      } as React.CSSProperties}
    >
      <style>{`
        html { scroll-behavior: smooth; }
        .ms-root ::selection { background: var(--acc); color: #fff; }
        .ms-card { border-radius: 24px; border: 1px solid var(--line); background: var(--surface); box-shadow: 0 1px 2px rgba(23,26,58,.04), 0 12px 32px -18px rgba(23,26,58,.18); }
        .ms-dots { background-image: radial-gradient(rgba(255,255,255,.14) 1px, transparent 1px); background-size: 22px 22px; }
        @keyframes ms-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-10px) rotate(-1deg); } }
        .ms-float { animation: ms-float 7s ease-in-out infinite; }
        @keyframes ms-pulse { 0%,100% { box-shadow: 0 0 0 0 ${GOLD}aa; } 70% { box-shadow: 0 0 0 10px ${GOLD}00; } }
        .ms-pin { animation: ms-pulse 2.2s ease-out infinite; }
        .ms-feat { transition: opacity .25s, transform .25s, border-color .2s, box-shadow .2s; }
        .ms-feat:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--acc) 35%, var(--line)); }
        .ms-dim { opacity: .28; filter: grayscale(.6); }
        @media print {
          .ms-noprint { display: none !important; }
          .ms-root { background: #fff !important; }
          .ms-feat, .ms-card { break-inside: avoid; box-shadow: none !important; }
          .ms-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ─── الشريط العلوي ─── */}
      <header className="ms-noprint fixed inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6">
          <BackToPlatform compact />
          <div className="flex rounded-full p-1 text-xs font-black" style={{ background: `${GOLD}40` }}>
            {([["guide", "الدليل", BookOpen], ["train", "تدرّب", GraduationCap]] as const).map(([m, l, I]) => (
              <button key={m} onClick={() => switchMode(m)} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 transition-colors sm:px-3.5"
                style={mode === m ? { background: GOLD, color: "#1a1306" } : { color: "#6b5a12" }}>
                <I size={14} /> {l}
              </button>
            ))}
          </div>
          <div className="mx-auto flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[11px] font-bold sm:text-xs">
            {(Object.keys(STAFF_PRODUCTS) as ProductKey[]).map((k) => (
              <button key={k} onClick={() => { setPk(k); setFilter(null); window.scrollTo({ top: 0 }); }}
                className="whitespace-nowrap rounded-full px-2.5 py-1.5 transition-colors sm:px-5"
                style={pk === k ? { background: STAFF_PRODUCTS[k].accent, color: "#fff" } : { color: "var(--muted)" }}>
                {STAFF_PRODUCTS[k].brand}
              </button>
            ))}
          </div>
          <a href={`/offer/meeting?p=${pk}`} target="_blank" rel="noopener noreferrer"
            className="hidden h-9 items-center gap-1.5 rounded-full px-4 text-xs font-black text-white sm:flex"
            style={{ background: "linear-gradient(135deg, var(--acc), var(--deep))" }}>
            <Presentation size={15} /> نسخة العميل
          </a>
          <button onClick={() => window.print()} title="طباعة / PDF" aria-label="طباعة"
            className="hidden h-9 w-9 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--hover)] sm:grid">
            <Printer size={16} />
          </button>
        </div>
      </header>

      {mode === "train" ? <MeetingStaffTraining key={pk} product={P} onGuide={() => switchMode("guide")} /> : (<>
      {/* ─── الغلاف ─── */}
      <section className="relative overflow-hidden px-4 pb-16 pt-28 text-white sm:px-8 sm:pb-24 sm:pt-32"
        style={{ background: `linear-gradient(140deg, #0E1030 0%, ${P.deep} 55%, ${P.accent} 100%)` }}>
        <div className="ms-dots pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full blur-3xl" style={{ background: `${GOLD}26` }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: GOLD }} />
              نسخة الموظف · {P.brand} — {P.tagline}
            </div>
            <h1 className="mt-6 text-4xl font-black leading-[1.15] sm:text-6xl">
              اعرف كل باقة<br />
              <span style={{ color: GOLD }}>من الداخل</span> قبل الاجتماع
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              كل ميزة بثلاث طبقات: <b className="text-white">وش هي</b>، <b className="text-white">وش يكسب العميل منها</b>، و<b className="text-white">كيف تقولها</b> بجملة وحدة.
              ركّز على المزايا النجمية ⭐ — هي اللي تقفل الصفقة.
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                { v: P.tiers.length, l: "باقات" },
                { v: stats.all, l: "ميزة مشروحة" },
                { v: stats.stars, l: "ميزة نجمية" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-white/15 bg-white/[.07] p-4 backdrop-blur">
                  <div className="text-3xl font-black" style={{ color: s.l === "ميزة نجمية" ? GOLD : "#fff" }}>{fmt(s.v)}</div>
                  <div className="mt-0.5 text-xs text-white/65">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ms-noprint hidden lg:block">
            <Showcase product={P} />
          </div>
        </div>

        {/* خارطة الباقات */}
        <div className="relative mx-auto mt-14 max-w-6xl">
          <div className="mb-3 text-xs font-bold text-white/60">الباقات بالترتيب — كل وحدة تبني على اللي قبلها:</div>
          <div className="flex flex-wrap items-stretch gap-2">
            {P.tiers.map((t, i) => (
              <React.Fragment key={t.name}>
                <button onClick={() => goTier(i)}
                  className="group flex min-w-[140px] flex-1 flex-col rounded-2xl border border-white/15 bg-white/[.07] p-4 text-right backdrop-blur transition-colors hover:bg-white/[.14]">
                  <span className="flex items-center gap-2 text-sm font-black">
                    {t.name}
                    {t.badge && <span className="rounded-full px-2 py-0.5 text-[10px] text-[#1a1306]" style={{ background: GOLD }}>{t.badge}</span>}
                  </span>
                  <span className="mt-1 text-2xl font-black">{fmt(t.price)} <span className="text-xs font-bold text-white/60">{t.period}</span></span>
                  <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/60">{t.tagline}</span>
                </button>
                {i < P.tiers.length - 1 && <span className="hidden items-center text-white/40 md:flex">←</span>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ─── عرض مكبّر للجوال (للشاشات الصغيرة) ─── */}
      <section className="ms-noprint px-4 pt-10 lg:hidden">
        <Showcase product={P} />
      </section>

      {/* ─── شريط الباقات + الفلتر (لاصق) ─── */}
      <div className="ms-noprint sticky top-[61px] z-40 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-8">
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {P.tiers.map((t, i) => {
              const { n, done } = tierProgress(i);
              const on = i === activeTier;
              return (
                <button key={t.name} onClick={() => goTier(i)}
                  className="flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-black transition-all"
                  style={on ? { background: "var(--acc)", borderColor: "var(--acc)", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--body)" }}>
                  {t.name}
                  <span className="rounded-full px-1.5 py-px text-[10px]" style={on ? { background: "rgba(255,255,255,.2)" } : { background: "var(--surface-2)", color: "var(--muted)" }}>
                    {done === n && n > 0 ? "✓" : `${fmt(done)}/${fmt(n)}`}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <Filter size={13} className="shrink-0 text-[var(--faint)]" />
            <Chip on={filter === "star"} onClick={() => setFilter((f) => (f === "star" ? null : "star"))} color="#B7791F">⭐ النجمية فقط</Chip>
            {(Object.keys(IMPACTS) as Impact[]).map((k) => (
              <Chip key={k} on={filter === k} onClick={() => setFilter((f) => (f === k ? null : k))} color={IMPACTS[k].color}>
                {IMPACTS[k].emoji} {IMPACTS[k].label}
              </Chip>
            ))}
            <button onClick={resetShown} className="mr-auto flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-[var(--faint)] hover:text-[var(--ink)]" title="تصفير علامات «عرضتها»">
              <RotateCcw size={12} /> اجتماع جديد
            </button>
          </div>
        </div>
      </div>

      {/* ─── الباقات ─── */}
      <main className="px-4 pb-24 sm:px-8">
        {P.tiers.map((t, ti) => (
          <TierSection
            key={`${pk}-${t.name}`}
            product={P}
            tier={t}
            ti={ti}
            next={P.tiers[ti + 1]}
            filter={filter}
            shown={shown}
            toggle={(k) => setShown((s) => ({ ...s, [k]: !s[k] }))}
            onNext={() => goTier(ti + 1)}
          />
        ))}

        {/* الإغلاق */}
        <div className="mx-auto mt-20 max-w-6xl">
          <div className="relative overflow-hidden rounded-[32px] p-8 text-white sm:p-12"
            style={{ background: `linear-gradient(135deg, #0E1030, ${P.deep} 60%, ${P.accent})` }}>
            <div className="ms-dots pointer-events-none absolute inset-0 opacity-50" />
            <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <div className="text-sm font-bold" style={{ color: GOLD }}>القاعدة الذهبية في الاجتماع</div>
                <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">اسأل أول، رشّح باقة وحدة، وأغلق بسؤال واضح</h2>
                <ol className="mt-5 grid gap-2 text-sm text-white/80 sm:grid-cols-3">
                  {["اسأل سؤال الاحتياج لكل باقة بالترتيب", "اربط ٣ مزايا نجمية بألم العميل نفسه", "«نبدأ اليوم بباقة …؟» ثم افتح خطة الاجتماع"].map((s, i) => (
                    <li key={s} className="flex items-start gap-2 rounded-2xl bg-white/[.08] p-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black text-[#1a1306]" style={{ background: GOLD }}>{fmt(i + 1)}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
              <a href={`/offer/meeting?p=${pk}`} target="_blank" rel="noopener noreferrer"
                className="ms-noprint inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 font-black text-[#1a1306] shadow-2xl transition-transform hover:-translate-y-0.5"
                style={{ background: GOLD }}>
                <Presentation size={18} /> افتح نسخة العميل
              </a>
            </div>
          </div>
        </div>
      </main>
      </>)}
    </div>
  );
}

/* ──────────────────────────── قسم الباقة ──────────────────────────── */

function TierSection({ product: P, tier: t, ti, next, filter, shown, toggle, onNext }: {
  product: StaffProduct; tier: StaffTier; ti: number; next?: StaffTier;
  filter: Impact | "star" | null; shown: Record<string, boolean>; toggle: (k: string) => void; onNext: () => void;
}) {
  const match = (f: Feature) => !filter || (filter === "star" ? !!f.star : f.impact.includes(filter));
  const total = t.groups.reduce((s, g) => s + g.features.length, 0);
  const featured = t.badge;

  return (
    <section id={`tier-${ti}`} data-tier={ti} className="mx-auto max-w-6xl scroll-mt-40 pt-16 sm:pt-24">
      {/* رأس الباقة */}
      <div className="ms-card relative overflow-hidden" style={featured ? { borderColor: `${GOLD}`, boxShadow: `0 30px 70px -40px ${P.accent}` } : {}}>
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, var(--acc), ${GOLD})` }} />
        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--faint)]">
              <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-white" style={{ background: "var(--acc)" }}>{fmt(ti + 1)}</span>
              الباقة {fmt(ti + 1)} من {fmt(P.tiers.length)} · {fmt(total)} ميزة
              {t.badge && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black text-[#1a1306]" style={{ background: GOLD }}>{t.badge}</span>}
            </div>
            <h2 className="mt-3 text-4xl font-black text-[var(--ink)] sm:text-5xl">باقة {t.name}</h2>
            <p className="mt-2 text-lg font-bold" style={{ color: "var(--acc)" }}>{t.tagline}</p>

            <div className="mt-5 flex items-start gap-3 rounded-2xl p-4" style={{ background: "color-mix(in srgb, var(--acc) 8%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--acc) 22%, transparent)" }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: "var(--acc)" }}><Target size={17} /></span>
              <div>
                <div className="text-[11px] font-black" style={{ color: "var(--acc)" }}>سؤال الاحتياج — افتح فيه</div>
                <div className="mt-0.5 text-base font-black leading-snug text-[var(--ink)]">«{t.question}»</div>
              </div>
            </div>

            {t.inherits && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--line-strong)] px-3.5 py-1.5 text-xs font-bold text-[var(--muted)]">
                <Layers size={14} style={{ color: "var(--acc)" }} /> {t.inherits} <Plus size={12} /> الجديد تحت
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl p-6 text-white" style={{ background: "linear-gradient(140deg, var(--deep), var(--acc))" }}>
              <div className="text-xs font-bold text-white/70">السعر</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-5xl font-black">{fmt(t.price)}</span>
                <span className="text-sm font-bold text-white/70">{t.period}</span>
              </div>
              <div className="mt-1 text-xs text-white/70">≈ {fmt(t.price / 12)} ريال بالشهر</div>
              {t.pricing && (
                <ul className="mt-4 space-y-1.5 border-t border-white/15 pt-3 text-xs text-white/85">
                  {t.pricing.map((x) => <li key={x} className="flex items-center gap-1.5"><Check size={12} style={{ color: GOLD }} /> {x}</li>)}
                </ul>
              )}
            </div>
            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface-2)] p-5">
              <div className="flex items-center gap-2 text-xs font-black text-[var(--ink)]"><Users size={14} style={{ color: "var(--acc)" }} /> مناسبة لـ</div>
              <ul className="mt-2.5 space-y-1.5">
                {t.forWho.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-[13px] leading-relaxed text-[var(--body)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--acc)" }} /> {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* المجموعات */}
      {t.groups.map((g, gi) => (
        <div key={g.title} className="mt-12">
          <div className="mb-5 flex items-end gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-lg" style={{ background: "linear-gradient(135deg, var(--acc), var(--deep))", boxShadow: `0 14px 30px -14px ${P.accent}` }}>
              <g.icon size={22} />
            </span>
            <div className="min-w-0">
              <h3 className="text-2xl font-black text-[var(--ink)] sm:text-3xl">{g.title}</h3>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{g.lead}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {g.features.map((f, fi) => {
              const k = featKey(P.key, ti, gi, fi);
              return <FeatureCard key={k} f={f} dim={!match(f)} done={!!shown[k]} onToggle={() => toggle(k)} />;
            })}
          </div>
        </div>
      ))}

      {/* الترقية + الاعتراضات */}
      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        {t.upgrade && next ? (
          <div className="relative overflow-hidden rounded-3xl p-6" style={{ background: `linear-gradient(135deg, ${GOLD}30, ${GOLD}0d)`, boxShadow: `inset 0 0 0 1px ${GOLD}aa` }}>
            <div className="flex items-center gap-2 text-sm font-black text-[#8a5a00]"><ArrowUpLeft size={17} /> إشارات إن العميل يحتاج «{t.upgrade.to}»</div>
            <ul className="mt-3 space-y-2">
              {t.upgrade.signals.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm leading-relaxed text-[var(--ink)]">
                  <Flame size={14} className="mt-1 shrink-0 text-[#d97706]" /> {s}
                </li>
              ))}
            </ul>
            <button onClick={onNext} className="ms-noprint mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-black text-white">
              انتقل لباقة {next.name} ←
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-[var(--line-strong)] p-6 text-sm leading-relaxed text-[var(--muted)]">
            <div className="mb-1 flex items-center gap-2 font-black text-[var(--ink)]"><Sparkles size={16} style={{ color: "var(--acc)" }} /> نصيحة</div>
            {next ? `لو العميل يحتاج «${next.name}» انتقل لها مباشرة — كل باقة مستقلة بسؤالها.` : "هذي آخر باقة — لو العميل محتار ارجع للباقة الموصى بها واربطها بألمه."}
          </div>
        )}
        <Objections items={t.objections} />
      </div>
    </section>
  );
}

function FeatureCard({ f, dim, done, onToggle }: { f: Feature; dim: boolean; done: boolean; onToggle: () => void }) {
  return (
    <article className={`ms-feat ms-card relative flex flex-col p-5 sm:p-6 ${dim ? "ms-dim" : ""}`}
      style={f.star ? { borderColor: `${GOLD}cc`, background: `linear-gradient(180deg, ${GOLD}12, var(--surface) 45%)` } : {}}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={f.star ? { background: GOLD, color: "#1a1306" } : { background: "color-mix(in srgb, var(--acc) 12%, transparent)", color: "var(--acc)" }}>
          <f.icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="flex flex-wrap items-center gap-1.5 text-lg font-black leading-snug text-[var(--ink)]">
            {f.title}
            {f.star && <Star size={15} fill={GOLD} stroke="#b7791f" />}
          </h4>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {f.impact.map((i) => (
              <span key={i} className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: `${IMPACTS[i].color}18`, color: IMPACTS[i].color }}>
                {IMPACTS[i].emoji} {IMPACTS[i].label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <dl className="mt-4 space-y-2.5 text-[14px] leading-relaxed">
        <div className="flex gap-2">
          <dt className="w-[74px] shrink-0 text-xs font-black text-[var(--faint)] pt-0.5">وش هي</dt>
          <dd className="text-[var(--body)]">{f.what}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-[74px] shrink-0 text-xs font-black pt-0.5 text-emerald-600">وش يكسب</dt>
          <dd className="font-bold text-[var(--ink)]">{f.why}</dd>
        </div>
      </dl>

      <blockquote className="mb-4 mt-4 flex items-start gap-2 rounded-2xl p-3.5 text-[13.5px] font-bold leading-relaxed"
        style={{ background: "color-mix(in srgb, var(--acc) 8%, transparent)", color: "var(--deep)" }}>
        <MessageSquareQuote size={16} className="mt-0.5 shrink-0" style={{ color: "var(--acc)" }} />
        <span><span className="ml-1 text-[10px] font-black opacity-60">قلها كذا</span>{f.say}</span>
      </blockquote>

      <button onClick={onToggle}
        className="ms-noprint mt-auto inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors"
        style={done ? { background: "#16A34A", borderColor: "#16A34A", color: "#fff" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
        <Check size={13} /> {done ? "عرضتها للعميل" : "علّم إنك عرضتها"}
      </button>
    </article>
  );
}

function Objections({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="ms-card p-6">
      <div className="flex items-center gap-2 text-sm font-black text-[var(--ink)]"><ShieldQuestion size={17} style={{ color: "var(--acc)" }} /> اعتراضات متوقعة وردّك</div>
      <div className="mt-3 divide-y divide-[var(--line)]">
        {items.map((o, i) => (
          <div key={o.q}>
            <button onClick={() => setOpen((x) => (x === i ? null : i))} className="flex w-full items-center gap-2 py-3 text-right text-sm font-black text-[var(--ink)]">
              <span className="text-rose-500">«</span>{o.q}<span className="text-rose-500">»</span>
              <ChevronDown size={16} className={`mr-auto shrink-0 text-[var(--faint)] transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="pb-3 text-[13.5px] leading-relaxed text-[var(--body)]"><b className="text-emerald-600">ردّك: </b>{o.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ on, onClick, color, children }: { on: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black transition-colors"
      style={on ? { background: color, borderColor: color, color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--muted)" }}>
      {children}
    </button>
  );
}

/* ──────────────────────────── عرض توضيحي على الجوال ──────────────────────────── */

function Pin({ n }: { n: number }) {
  return (
    <span className="ms-pin relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-black text-[#1a1306] shadow-lg" style={{ background: GOLD }}>
      {fmt(n)}
    </span>
  );
}

function Showcase({ product }: { product: StaffProduct }) {
  const legend = product.key === "menu"
    ? ["الأكثر طلباً", "شرح يشهّي", "الإضافات على الطلب", "«يُطلب معه»", "الأعلى ربحية أولاً"]
    : ["صفحة باسم مركزك", "الخدمات والأسعار", "اختيار الموظفة", "حجز ٢٤/٧", "تذكير واتساب"];
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 sm:flex-row sm:items-start lg:max-w-none">
      <div className="ms-float relative w-[260px] shrink-0 rounded-[42px] bg-[#0b0f1a] p-2.5 shadow-2xl" style={{ boxShadow: `0 50px 90px -35px ${product.accent}` }}>
        <div className="mx-auto mb-1.5 h-4 w-20 rounded-full bg-black" />
        <div className="overflow-hidden rounded-[32px] bg-[#FBF8F3] text-[#1d1b16]">
          {product.key === "menu" ? <MenuMock /> : <SalonMock />}
        </div>
      </div>
      <ol className="w-full space-y-2 sm:pt-8">
        {legend.map((l, i) => (
          <li key={l} className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/[.08] px-3 py-2 text-sm font-bold text-white backdrop-blur lg:text-white max-lg:border-[var(--line)] max-lg:bg-[var(--surface)] max-lg:text-[var(--ink)]">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-[#1a1306]" style={{ background: GOLD }}>{fmt(i + 1)}</span>
            {l}
          </li>
        ))}
      </ol>
    </div>
  );
}

function MenuMock() {
  return (
    <div className="text-right">
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="text-[13px] font-black">مطعم الدخان</span>
        <QrCode size={15} className="text-[#4734A8]" />
      </div>
      <div className="flex gap-1.5 overflow-hidden px-4 pb-2 text-[10px] font-bold">
        {["الأكثر طلباً", "برجر", "مشروبات", "حلى"].map((c, i) => (
          <span key={c} className="shrink-0 rounded-full px-2.5 py-1" style={i === 0 ? { background: "#4734A8", color: "#fff" } : { background: "#EFEAE1" }}>{c}</span>
        ))}
      </div>
      {/* بطاقة الصنف */}
      <div className="relative mx-3 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="relative h-24" style={{ background: "radial-gradient(circle at 30% 40%, #F59E0B, #B45309 55%, #451A03)" }}>
          <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-black text-[#B45309]">🔥 الأكثر طلباً</span>
          <span className="absolute z-10 left-2 top-2"><Pin n={1} /></span>
          <span className="absolute bottom-2 left-2 text-3xl">🍔</span>
        </div>
        <div className="relative p-3">
          <span className="absolute z-10 left-2 bottom-2"><Pin n={2} /></span>
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-black">برجر الدخان المشوي</span>
            <span className="text-[13px] font-black text-[#4734A8]">٣٨</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-[#6b6458]">لحم أنجوس مشوي على الفحم، جبنة شيدر ذايبة، بصل مكرمل وصوص الدخان الخاص… بخبز بريوش طازج.</p>
          <div className="mt-1 text-[9px] text-[#9a917f]">٦٥٠ سعرة حرارية</div>
        </div>
      </div>
      {/* الإضافات */}
      <div className="relative mx-3 mt-2 rounded-2xl bg-white p-2.5 shadow-sm">
        <span className="absolute z-10 left-2 -top-2.5"><Pin n={3} /></span>
        <div className="text-[10px] font-black">أضف لطلبك</div>
        <div className="mt-1.5 flex flex-wrap gap-1 text-[9.5px] font-bold">
          {["+ جبن إضافي ٣", "+ هالبينو ٢", "+ دبل لحم ١٢"].map((a, i) => (
            <span key={a} className="rounded-full border px-2 py-0.5" style={i === 0 ? { borderColor: "#4734A8", color: "#4734A8", background: "#4734A810" } : { borderColor: "#E7E1D6" }}>{a}</span>
          ))}
        </div>
      </div>
      {/* يُطلب معه */}
      <div className="relative mx-3 mt-2 rounded-2xl bg-white p-2.5 shadow-sm">
        <span className="absolute z-10 left-2 -top-2.5"><Pin n={4} /></span>
        <div className="text-[10px] font-black">يُطلب معه عادةً</div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {[["🍟", "بطاطس", "١٢"], ["🥤", "مشروب", "٨"], ["🍰", "تشيز كيك", "١٨"]].map(([e, n, p]) => (
            <div key={n} className="rounded-xl bg-[#F6F2EA] p-1.5 text-center">
              <div className="text-base">{e}</div>
              <div className="text-[9px] font-bold">{n}</div>
              <div className="text-[9px] font-black text-[#4734A8]">{p}</div>
            </div>
          ))}
        </div>
      </div>
      {/* الأعلى ربحية */}
      <div className="relative mx-3 mb-3 mt-2 flex items-center gap-2 rounded-2xl p-2.5 text-white" style={{ background: "linear-gradient(135deg, #2B1F73, #4734A8)" }}>
        <span className="absolute z-10 left-2 -top-2.5"><Pin n={5} /></span>
        <span className="text-xl">🥤</span>
        <span className="flex-1 text-[10px] font-black leading-tight">كومبو الدخان<br /><span className="font-medium opacity-75">برجر + بطاطس + مشروب</span></span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-black text-[#1a1306]" style={{ background: GOLD }}>٤٩</span>
      </div>
    </div>
  );
}

function SalonMock() {
  return (
    <div className="text-right">
      <div className="relative px-4 pb-3 pt-4 text-white" style={{ background: "linear-gradient(135deg, #0B4F4A, #0F9488)" }}>
        <span className="absolute z-10 left-2 top-2"><Pin n={1} /></span>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm">💇‍♀️</span>
          <div>
            <div className="text-[13px] font-black">صالون لمسة</div>
            <div className="text-[9.5px] opacity-80">⭐ ٤٫٩ · ٣٢٠ تقييم</div>
          </div>
        </div>
      </div>
      <div className="relative mx-3 mt-3 space-y-1.5">
        <span className="absolute z-10 left-12 -top-3"><Pin n={2} /></span>
        {[["قص وتسشوار", "٤٥ د", "١٢٠"], ["صبغة كاملة", "١٢٠ د", "٣٥٠"], ["مناكير وبديكير", "٦٠ د", "١٤٠"]].map(([n, d, p], i) => (
          <div key={n} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm" style={i === 0 ? { boxShadow: "inset 0 0 0 1.5px #0F9488" } : {}}>
            <Scissors size={13} className="text-[#0F9488]" />
            <span className="flex-1 text-[10.5px] font-black">{n}<span className="mr-1 text-[9px] font-medium text-[#9a917f]">{d}</span></span>
            <span className="text-[10.5px] font-black text-[#0F9488]">{p}</span>
          </div>
        ))}
      </div>
      <div className="relative mx-3 mt-3 rounded-xl bg-white p-2.5 shadow-sm">
        <span className="absolute z-10 left-2 -top-2.5"><Pin n={3} /></span>
        <div className="text-[10px] font-black">اختاري الموظفة</div>
        <div className="mt-1.5 flex gap-1.5">
          {["سارة", "نوف", "ريم"].map((n, i) => (
            <span key={n} className="flex-1 rounded-full py-1 text-center text-[9.5px] font-bold" style={i === 1 ? { background: "#0F9488", color: "#fff" } : { background: "#EEF4F3" }}>{n}</span>
          ))}
        </div>
      </div>
      <div className="relative mx-3 mt-2 rounded-xl bg-white p-2.5 shadow-sm">
        <span className="absolute z-10 left-2 -top-2.5"><Pin n={4} /></span>
        <div className="flex items-center gap-1 text-[10px] font-black"><CalendarCheck size={12} className="text-[#0F9488]" /> الخميس — المواعيد المتاحة</div>
        <div className="mt-1.5 grid grid-cols-4 gap-1 text-[9.5px] font-bold">
          {["٤:٠٠", "٥:٣٠", "٧:٠٠", "١٠:٣٠"].map((s, i) => (
            <span key={s} className="rounded-lg py-1 text-center" style={i === 2 ? { background: "#0F9488", color: "#fff" } : { background: "#EEF4F3" }}>{s}</span>
          ))}
        </div>
      </div>
      <div className="relative mx-3 mb-3 mt-2 flex items-start gap-2 rounded-xl bg-[#DCF8C6] p-2.5">
        <span className="absolute z-10 left-2 -top-2.5"><Pin n={5} /></span>
        <Clock size={13} className="mt-0.5 shrink-0 text-[#128C7E]" />
        <span className="text-[9.5px] leading-relaxed text-[#1f3d2b]"><b>تذكير:</b> موعدك بكرة الخميس ٧:٠٠ مع نوف ✨ للتأكيد اضغطي ١</span>
      </div>
    </div>
  );
}
