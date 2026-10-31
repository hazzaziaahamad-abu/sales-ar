"use client";

// «الخطة المبسطة» — للصالونات والخدمات المنزلية: جلسة مع العميلة خطوة بخطوة (النشاط، الأرقام،
// الخدمات والتسعير، العميلات والسوشال، التشغيل) ← توصيات بالأولوية ← خطة شهرية تنبني من الفجوات
// وتتراجع كل شهر بالأرقام.

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Store, Car, Home, Stethoscope, Calculator, BarChart3, Check, Plus, Trash2, Copy, Sparkles,
  Scissors, Receipt, Users, Megaphone, ShieldCheck, Lightbulb, RefreshCw, Wand2, Target, Zap, ChevronLeft, ChevronRight,
  CalendarCheck, PlayCircle, X, Lock,
} from "lucide-react";
import {
  AXES, MODELS, NUMS, PHASES, SERVICE_IDEAS, SERVICE_KINDS, SIMPLE_KPIS, CONTENT_BY_MODEL,
  actionById, axisScore, buildMonth, costBase, evaluate, modelOf, monthEstimate, monthKeyOf, monthLabel, nextMonthKey,
  openActions, pricing, questionsFor, recommendations, serviceKind,
  type AxisId, type BizModel, type Costs, type MonthPlan, type ServiceKind, type Simple, type SimpleService,
} from "@/lib/salon-simple";
import { CONTENT_WEEK } from "@/lib/salon-campaigns";

const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (v: number, d = 0) => v.toLocaleString(LOCALE, { maximumFractionDigits: d, minimumFractionDigits: 0 });
const sar = (v: number | null) => (v === null ? "—" : `${fmt(v)} ر.س`);
const GOOD = "#16A34A", BAD = "#DC2626", WARN = "#D9A21B", GOLD = "#D4AF37";

const card = "rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]";
const btnGhost = "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--body)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40";
const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-[var(--on-acc)] transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-40";
const accGrad = { background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" };
const input = "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)]";

const rid = () => Math.random().toString(36).slice(2, 10);
const numOrNull = (v: string) => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null);
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const MODEL_ICON: Record<BizModel, LucideIcon> = { salon: Store, home_visit: Car, home_studio: Home };
const AXIS_ICON: Record<AxisId, LucideIcon> = { services: Scissors, pricing: Receipt, clients: Users, social: Megaphone, ops: ShieldCheck };
const scoreColor = (v: number | null) => (v === null ? "var(--faint)" : v >= 0.75 ? GOOD : v >= 0.5 ? WARN : BAD);

type Patch = (p: Partial<Simple>) => void;
type Results = ReturnType<typeof evaluate>;
type Tab = "recs" | "diagnosis" | "pricing" | "month" | "follow";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "recs", label: "التوصيات", icon: Target },
  { id: "month", label: "خطة الشهر", icon: CalendarCheck },
  { id: "diagnosis", label: "التشخيص", icon: Stethoscope },
  { id: "pricing", label: "التسعير والخدمات", icon: Calculator },
  { id: "follow", label: "المتابعة الشهرية", icon: BarChart3 },
];

export default function SimplePlan({ s, set, salonName, setSalonName, copy }: {
  s: Simple; set: (s: Simple) => void; salonName: string; setSalonName: (v: string) => void; copy: (t: string, msg?: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("recs");
  const [inSession, setInSession] = useState(false);
  const patch: Patch = (p) => set({ ...s, ...p });
  const results = evaluate(s);

  /** يبدأ أول شهر من التوصيات لو ما فيه شهور. */
  const finishSession = () => {
    const session = { ...s.session, date: s.session.date || todayIso(), done_at: new Date().toISOString() };
    const months = s.months.length ? s.months : [buildMonth({ ...s, session }, results, monthKeyOf(new Date()), rid())];
    set({ ...s, session, months });
    setInSession(false);
    setTab("recs");
    window.scrollTo({ top: 0 });
  };

  if (inSession) return <SessionWizard s={s} patch={patch} results={results} salonName={salonName} setSalonName={setSalonName} onExit={() => setInSession(false)} onFinish={finishSession} />;
  if (!s.session.done_at && !s.model) return <Intro onStart={() => { if (!s.session.date) patch({ session: { ...s.session, date: todayIso() } }); setInSession(true); }} />;

  const model = modelOf(s.model);
  const scores = AXES.map((a) => ({ ...a, ...axisScore(results, a.id) }));
  const known = results.filter((r) => r.pass !== null);
  const overall = known.length ? known.filter((r) => r.pass).length / known.length : null;
  const current = s.months[s.months.length - 1] ?? null;
  const MIcon = s.model ? MODEL_ICON[s.model] : Store;

  return (
    <div className="space-y-5">
      {/* ─── الرأس ─── */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><MIcon size={20} /></span>
          <div className="min-w-0 flex-1 basis-48">
            <input value={salonName} onChange={(e) => setSalonName(e.target.value.slice(0, 60))} placeholder="اسم النشاط" aria-label="اسم النشاط"
              className="w-full rounded-lg border border-dashed border-[var(--line-strong)] bg-transparent px-2 py-0.5 text-lg font-black text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)] sm:w-72" />
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              {model && <span className="rounded-full px-2.5 py-0.5 font-black" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" }}>{model.label}</span>}
              {s.session.done_at ? <span>جلسة التشخيص: {s.session.date ? new Date(s.session.date).toLocaleDateString(LOCALE, { day: "numeric", month: "long" }) : "—"}</span> : <span className="font-bold" style={{ color: WARN }}>الجلسة ما اكتملت</span>}
              {current && <span>· {monthLabel(current.month)}</span>}
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button onClick={() => setInSession(true)} className={`${btnGhost} flex-1 !px-3 !py-1.5 text-xs sm:flex-none`}><PlayCircle size={13} /> {s.session.done_at ? "مراجعة الجلسة" : "كمّلي الجلسة"}</button>
            <button onClick={() => copy(clientReport(s, results, salonName), "تم نسخ التقرير")} className={`${btnGhost} flex-1 !px-3 !py-1.5 text-xs sm:flex-none`}><Copy size={13} /> تقرير للعميلة</button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-2xl p-3 text-center" style={{ background: "color-mix(in srgb, var(--acc) 8%, transparent)" }}>
            <div className="text-[11px] font-bold text-[var(--muted)]">الجاهزية العامة</div>
            <div className="text-2xl font-black" style={{ color: scoreColor(overall) }}>{overall === null ? "—" : `${fmt(overall * 100)}٪`}</div>
          </div>
          {scores.map((x) => {
            const Icon = AXIS_ICON[x.id];
            return (
              <button key={x.id} onClick={() => setTab(x.id === "pricing" || x.id === "services" ? "pricing" : "diagnosis")} className="rounded-2xl bg-[var(--surface-2)] p-3 text-right">
                <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]"><Icon size={12} /> {x.title}</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full" style={{ width: `${(x.score ?? 0) * 100}%`, background: scoreColor(x.score) }} /></div>
                <div className="mt-1 text-xs font-black" style={{ color: scoreColor(x.score) }}>{x.score === null ? "ما اكتمل" : `${fmt(x.score * 100)}٪`}</div>
              </button>
            );
          })}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold sm:text-sm"
            style={tab === t.id ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
            <t.icon size={14} /> {t.label}
            {t.id === "month" && current && <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{fmt(current.actions.filter((a) => !current.done[a]).length)}</span>}
          </button>
        ))}
      </nav>

      {tab === "recs" && <Recommendations s={s} results={results} onMonth={() => setTab("month")} />}
      {tab === "diagnosis" && <Diagnosis s={s} patch={patch} results={results} />}
      {tab === "pricing" && <Pricing s={s} patch={patch} />}
      {tab === "month" && <MonthView s={s} set={set} results={results} />}
      {tab === "follow" && <FollowUp s={s} patch={patch} />}
    </div>
  );
}

/* ──────────────────────────── تقرير للعميلة ──────────────────────────── */

function clientReport(s: Simple, results: Results, name: string) {
  const model = modelOf(s.model);
  const { top, quickWin } = recommendations(s, results);
  const lines = [`📋 تقرير جلسة التشخيص${name ? ` — ${name}` : ""}`];
  if (s.session.date) lines.push(`📅 ${new Date(s.session.date).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`);
  if (model) lines.push(`النشاط: ${model.label}`);
  lines.push("", "🩺 الوضع الحالي:");
  AXES.forEach((a) => { const x = axisScore(results, a.id); lines.push(`• ${a.title}: ${x.score === null ? "—" : `${fmt(x.score * 100)}٪`}`); });
  const nums = SIMPLE_KPIS.filter((k) => s.baseline[k.key] != null).map((k) => `${k.label}: ${fmt(s.baseline[k.key]!)}${k.unit === "٪" ? "٪" : ` ${k.unit}`}`);
  if (nums.length) lines.push("", "📊 أرقام اليوم:", ...nums.map((x) => `• ${x}`));
  if (top.length) {
    lines.push("", "🎯 أهم التوصيات:");
    top.forEach((r, i) => { lines.push(`${i + 1}. ${r.title} — ${r.why}`); if (r.impact) lines.push(`   الأثر المتوقع: ${r.impact}`); });
  }
  if (quickWin) lines.push("", `⚡ ابدئي هالأسبوع: ${quickWin.title} — ${quickWin.how}`);
  const m = s.months[s.months.length - 1];
  if (m) {
    lines.push("", `🗓️ خطة ${monthLabel(m.month)}:`);
    m.actions.forEach((id) => { const a = actionById(id); if (a) lines.push(`${m.done[id] ? "✅" : "▫️"} ${a.title}`); });
  }
  return lines.join("\n");
}

/* ──────────────────────────── البداية ──────────────────────────── */

function Intro({ onStart }: { onStart: () => void }) {
  const steps = ["النشاط والجلسة", "أرقام اليوم", "الخدمات والأسعار والتكاليف", "العميلات والسوشال", "التشغيل والثقة", "التوصيات وخطة الشهر الأول"];
  return (
    <div className={`${card} mx-auto max-w-2xl p-6 sm:p-8`}>
      <span className="grid h-12 w-12 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><Users size={22} /></span>
      <h2 className="mt-4 text-2xl font-black text-[var(--ink)]">ابدئي بجلسة مع العميلة</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">٣٠–٤٥ دقيقة: تاخذين منها المعلومات والأرقام خطوة بخطوة، وفي آخرها تطلع التوصيات بالأولوية وخطة الشهر الأول.</p>
      <ol className="mt-5 space-y-2">
        {steps.map((t, i) => (
          <li key={t} className="flex items-center gap-3 text-sm text-[var(--body)]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" }}>{fmt(i + 1)}</span>{t}
          </li>
        ))}
      </ol>
      <button onClick={onStart} className={`${btnPrimary} mt-6 w-full`} style={accGrad}><PlayCircle size={16} /> ابدأ الجلسة</button>
    </div>
  );
}

/* ──────────────────────────── الجلسة خطوة بخطوة ──────────────────────────── */

const STEPS = ["النشاط", "أرقام اليوم", "الخدمات والأسعار", "العميلات والسوشال", "التشغيل والثقة", "التوصيات"];

function SessionWizard({ s, patch, results, salonName, setSalonName, onExit, onFinish }: {
  s: Simple; patch: Patch; results: Results; salonName: string; setSalonName: (v: string) => void; onExit: () => void; onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const go = (i: number) => { setStep(i); window.scrollTo({ top: 0 }); };
  const last = step === STEPS.length - 1;
  return (
    <div className="space-y-4">
      <div className={`${card} p-4`}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[var(--muted)]">جلسة التشخيص — خطوة {fmt(step + 1)} من {fmt(STEPS.length)}</div>
            <div className="text-lg font-black text-[var(--ink)]">{STEPS[step]}</div>
          </div>
          <button onClick={onExit} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><X size={13} /> خروج</button>
        </div>
        <div className="mt-3 flex gap-1">
          {STEPS.map((t, i) => (
            <button key={t} onClick={() => go(i)} title={t} aria-label={t} className="h-1.5 flex-1 rounded-full transition-colors"
              style={{ background: i <= step ? "var(--acc)" : "var(--line)" }} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className={`${card} p-4 sm:p-5`}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block"><span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">اسم النشاط</span>
                <input value={salonName} onChange={(e) => setSalonName(e.target.value.slice(0, 60))} className={input} placeholder="مثال: صالون الريم" /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">تاريخ الجلسة</span>
                <input type="date" value={s.session.date} onChange={(e) => patch({ session: { ...s.session, date: e.target.value } })} className={input} /></label>
              <label className="block"><span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">الحضور</span>
                <input value={s.session.attendees} onChange={(e) => patch({ session: { ...s.session, attendees: e.target.value } })} className={input} placeholder="المالكة، المديرة…" /></label>
            </div>
          </div>
          <ModelCards value={s.model} onPick={(model) => patch({ model })} />
          <div className={`${card} p-4 sm:p-5`}>
            <label className="block"><span className="mb-1 block text-xs font-bold text-[var(--muted)]">ملاحظات الجلسة (وش أكثر شي مزعجها؟ وش تبي توصل له؟)</span>
              <textarea rows={3} value={s.session.notes} onChange={(e) => patch({ session: { ...s.session, notes: e.target.value } })} className={`${input} resize-y`} /></label>
          </div>
        </div>
      )}
      {step === 1 && <BaselineStep s={s} patch={patch} />}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AxisBlock s={s} patch={patch} results={results} axis="services" />
            <AxisBlock s={s} patch={patch} results={results} axis="pricing" />
          </div>
          <Pricing s={s} patch={patch} />
        </div>
      )}
      {step === 3 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AxisBlock s={s} patch={patch} results={results} axis="clients" />
          <AxisBlock s={s} patch={patch} results={results} axis="social" />
        </div>
      )}
      {step === 4 && <AxisBlock s={s} patch={patch} results={results} axis="ops" />}
      {step === 5 && <Recommendations s={s} results={results} />}

      <div className="flex items-center gap-2">
        <button onClick={() => go(step - 1)} disabled={step === 0} className={btnGhost}><ChevronRight size={15} /> السابق</button>
        <div className="flex-1" />
        {last ? (
          <button onClick={onFinish} disabled={!s.model} className={btnPrimary} style={accGrad}><Check size={15} /> {s.months.length ? "إنهاء الجلسة" : "اعتمدي خطة الشهر الأول"}</button>
        ) : (
          <button onClick={() => go(step + 1)} disabled={step === 0 && !s.model} className={btnPrimary} style={accGrad}>التالي <ChevronLeft size={15} /></button>
        )}
      </div>
      {step === 0 && !s.model && <p className="text-center text-xs text-[var(--faint)]">اختاري نموذج النشاط عشان تكمّلين.</p>}
    </div>
  );
}

function ModelCards({ value, onPick }: { value: BizModel | null; onPick: (m: BizModel) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {MODELS.map((m) => {
        const Icon = MODEL_ICON[m.id];
        const on = value === m.id;
        return (
          <button key={m.id} onClick={() => onPick(m.id)} className={`${card} flex flex-col justify-start p-4 text-right transition-all hover:-translate-y-0.5`}
            style={on ? { borderColor: "var(--acc)", boxShadow: "0 0 0 2px var(--acc)" } : undefined} aria-pressed={on}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><Icon size={20} /></span>
            <div className="mt-3 flex items-center gap-1.5 text-base font-black text-[var(--ink)]">{m.label} {on && <Check size={15} style={{ color: GOOD }} />}</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">{m.desc}</div>
            <div className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">أكبر خطر: {m.risk}</div>
          </button>
        );
      })}
    </div>
  );
}

function BaselineStep({ s, patch }: { s: Simple; patch: Patch }) {
  const b = s.baseline;
  const avg = b.revenue && b.clients ? b.revenue / b.clients : null;
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <p className="text-sm text-[var(--muted)]">الأرقام اللي نقيس عليها التطور كل شهر. لو ما تعرفها بالضبط — رقم تقريبي أحسن من لا شي.</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SIMPLE_KPIS.map((k) => (
          <li key={k.key} className="rounded-2xl bg-[var(--surface-2)] p-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--ink)]">{k.label}</span>
              <div className="flex items-center gap-1">
                <input type="number" inputMode="decimal" min={0} value={b[k.key] ?? ""} placeholder="—" aria-label={`${k.label} قبل`}
                  onChange={(e) => patch({ baseline: { ...b, [k.key]: numOrNull(e.target.value) } })} className={`${input} !py-1.5`} />
                <span className="w-12 shrink-0 text-[10px] text-[var(--faint)]">{k.unit}</span>
              </div>
            </label>
            {k.key === "avg_ticket" && avg !== null && b.avg_ticket == null && (
              <button onClick={() => patch({ baseline: { ...b, avg_ticket: Math.round(avg) } })} className="mt-1 text-[11px] font-bold" style={{ color: "var(--acc)" }}>
                احسبيه من الدخل ÷ العميلات ({fmt(avg)} ر.س)
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────── التوصيات ──────────────────────────── */

function Recommendations({ s, results, onMonth }: { s: Simple; results: Results; onMonth?: () => void }) {
  const { top, quickWin } = recommendations(s, results);
  const open = openActions(s, results);
  return (
    <div className="space-y-4">
      {top.length === 0 ? (
        <p className={`${card} p-6 text-center text-sm text-[var(--muted)]`}>كمّلي الجلسة (الأسعار، العميلات، التشغيل) عشان تطلع التوصيات.</p>
      ) : (
        <div className={`${card} p-4 sm:p-5`}>
          <h3 className="flex items-center gap-2 text-base font-black text-[var(--ink)]"><Target size={17} className="text-[var(--acc)]" /> أهم {fmt(top.length)} توصيات — بالأولوية</h3>
          <ol className="mt-3 space-y-2.5">
            {top.map((r, i) => (
              <li key={r.id} className="flex gap-3 rounded-2xl bg-[var(--surface-2)] p-3.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black text-[var(--on-acc)]" style={accGrad}>{fmt(i + 1)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-[var(--ink)]">{r.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-[var(--body)]">{r.why}</div>
                  {r.impact && <div className="mt-1.5 inline-block rounded-full px-2.5 py-1 text-[11px] font-black" style={{ color: GOOD, background: `color-mix(in srgb, ${GOOD} 10%, transparent)` }}>الأثر المتوقع: {r.impact}</div>}
                  {r.actions.length > 0 && <div className="mt-1.5 text-[11px] text-[var(--muted)]">الإجراءات: {r.actions.map((a) => actionById(a)?.title).filter(Boolean).join("، ")}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {quickWin && (
        <div className={`${card} flex gap-3 p-4 sm:p-5`} style={{ borderColor: `${GOLD}88` }}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ color: GOLD, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}><Zap size={18} /></span>
          <div className="min-w-0">
            <div className="text-xs font-bold" style={{ color: GOLD }}>فوز سريع — ابدئي هالأسبوع</div>
            <div className="text-sm font-black text-[var(--ink)]">{quickWin.title}</div>
            <div className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{quickWin.how}</div>
          </div>
        </div>
      )}
      {open.length > 0 && (
        <div className={`${card} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 text-base font-black text-[var(--ink)]">كل الفجوات المفتوحة ({fmt(open.length)})</h3>
            {onMonth && <button onClick={onMonth} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><CalendarCheck size={13} /> خطة الشهر</button>}
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted)]">مرتبة بالأولوية — كل شهر ياخذ أعلاها ({fmt(5)} إجراءات تقريباً)، والباقي ينتظر الشهور الجاية.</p>
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {open.map((a, i) => (
              <li key={a.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs">
                <span className="w-5 shrink-0 text-center font-black text-[var(--faint)]">{fmt(i + 1)}</span>
                <span className="min-w-0 flex-1 font-bold text-[var(--body)]">{a.title}</span>
                <span className="shrink-0 text-[10px] text-[var(--faint)]">{PHASES.find((p) => p.id === a.phase)?.title}</span>
                {a.unknown && <span className="shrink-0 rounded-full px-1.5 text-[10px] font-black" style={{ color: WARN, background: `color-mix(in srgb, ${WARN} 12%, transparent)` }}>تأكدي</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── التشخيص ──────────────────────────── */

const DERIVED_IN_DIAG = ["d_return", "d_posts", "d_dm", "d_rating"];

function AxisBlock({ s, patch, results, axis }: { s: Simple; patch: Patch; results: Results; axis: AxisId }) {
  const a = AXES.find((x) => x.id === axis)!;
  const Icon = AXIS_ICON[axis];
  const sc = axisScore(results, axis);
  const auto = results.filter((r) => r.axis === axis && r.id.startsWith("d_") && !DERIVED_IN_DIAG.includes(r.id));
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}><Icon size={15} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-black text-[var(--ink)]">{a.title}</div>
          <div className="text-[11px] text-[var(--muted)]">{a.lead}</div>
        </div>
        <span className="text-sm font-black" style={{ color: scoreColor(sc.score) }}>{sc.score === null ? "—" : `${fmt(sc.score * 100)}٪`}</span>
      </div>
      <ul className="space-y-1.5">
        {questionsFor(s.model).filter((q) => q.axis === axis).map((q) => {
          const v = q.id in s.checks ? s.checks[q.id] : null;
          return (
            <li key={q.id} className="flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] px-3 py-2">
              <span className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--body)]">{q.text}</span>
              <div className="flex shrink-0 gap-1" role="group" aria-label={q.text}>
                {([[true, "نعم", GOOD], [false, "لا", BAD]] as const).map(([val, l, c]) => (
                  <button key={l} onClick={() => patch({ checks: { ...s.checks, [q.id]: val } })} className="rounded-full border px-2.5 py-1 text-[11px] font-black"
                    style={v === val ? { borderColor: c, color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` } : { borderColor: "var(--line)", color: "var(--faint)" }}>{l}</button>
                ))}
              </div>
            </li>
          );
        })}
        {NUMS.filter((x) => x.axis === axis).map((x) => (
          <li key={x.id} className="flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] px-3 py-2">
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--body)]">{x.label} <span className="text-[var(--faint)]">(الهدف: {x.good})</span></span>
            <input type="number" inputMode="decimal" min={0} value={s.nums[x.id] ?? ""} onChange={(e) => patch({ nums: { ...s.nums, [x.id]: numOrNull(e.target.value) } })}
              className={`${input} !w-20 !py-1 text-center`} aria-label={x.label} placeholder="—" />
            <span className="w-10 shrink-0 text-[10px] text-[var(--faint)]">{x.unit}</span>
          </li>
        ))}
        {auto.map((r) => (
          <li key={r.id} className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--line)] px-3 py-2">
            <span className="min-w-0 flex-1 text-xs text-[var(--body)]">{r.label}</span>
            <span className="shrink-0 text-[10px] font-black" style={{ color: r.pass === null ? "var(--faint)" : r.pass ? GOOD : BAD }}>
              {r.pass === null ? "من «الخدمات والأسعار»" : r.pass ? "✓ متحقق" : "✗ ناقص"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Diagnosis({ s, patch, results }: { s: Simple; patch: Patch; results: Results }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {AXES.map((a) => <AxisBlock key={a.id} s={s} patch={patch} results={results} axis={a.id} />)}
    </div>
  );
}

/* ──────────────────────────── التسعير والخدمات ──────────────────────────── */

function Pricing({ s, patch }: { s: Simple; patch: (p: Partial<Simple>) => void }) {
  const c = s.costs;
  const setC = (p: Partial<Costs>) => patch({ costs: { ...c, ...p } });
  const base = costBase(c);
  const est = monthEstimate(s.services, c, s.model);
  const home = s.model !== "salon";
  const setSvc = (id: string, p: Partial<SimpleService>) => patch({ services: s.services.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const addSvc = (name = "", kind: ServiceKind = "core") =>
    patch({ services: [...s.services, { id: rid(), name, kind, minutes: kind === "addon" ? 15 : 60, materials: null, price: null, per_month: null }] });
  const costField = (k: keyof Omit<Costs, "vat">, label: string, unit: string, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" inputMode="decimal" min={0} value={c[k] ?? ""} onChange={(e) => setC({ [k]: numOrNull(e.target.value) })} className={`${input} !py-1.5`} placeholder="—" />
        <span className="shrink-0 text-[10px] text-[var(--faint)]">{unit}</span>
      </div>
      {hint && <span className="mt-0.5 block text-[10px] leading-snug text-[var(--faint)]">{hint}</span>}
    </label>
  );
  const STATUS = { ok: { l: "سعر سليم", c: GOOD }, low: { l: "يغطي التكلفة بهامش أقل", c: WARN }, loss: { l: "خسارة", c: BAD } } as const;

  return (
    <div className="space-y-4">
      {/* التكاليف */}
      <div className={`${card} p-4 sm:p-5`}>
        <h3 className="text-base font-black text-[var(--ink)]">١. التكاليف الشهرية</h3>
        <p className="mt-0.5 text-xs text-[var(--muted)]">منها تطلع «تكلفة الساعة» — الأساس اللي ما ينزل تحته أي سعر.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {costField("rent", s.model === "salon" ? "الإيجار" : "تجهيز المكان / الإيجار", "ر.س")}
          {costField("salaries", "الرواتب — ومنها راتبك أنتِ", "ر.س", "لو ما حسبتي راتبك، الربح وهمي")}
          {costField("other", "مصاريف ثانية", "ر.س", "كهرباء، اشتراكات، تسويق، صيانة")}
          {costField("hours_month", "ساعات العمل بالشهر (كل الخبيرات)", "ساعة", "مثال: خبيرتين × ٨ ساعات × ٢٦ يوم = ٤١٦")}
          {costField("utilization", "نسبة الساعات المحجوزة فعلاً", "٪", "الساعات الفاضية لها تكلفة")}
          {s.model === "home_visit" && costField("travel_cost", "مواصلات الزيارة الوحدة", "ر.س")}
          {s.model === "home_visit" && costField("travel_minutes", "وقت الطريق للزيارة", "دقيقة", "ذهاب وعودة")}
          {costField("commission_pct", home ? "عمولة تطبيق أو خبيرة" : "عمولة الخبيرة", "٪")}
          {costField("margin_pct", "هامش الربح المستهدف", "٪", "٣٠–٤٠٪ بداية معقولة")}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={() => setC({ vat: !c.vat })} className="flex items-center gap-2 text-xs font-bold text-[var(--body)]" role="switch" aria-checked={c.vat}>
            <span className="relative h-5 w-9 rounded-full transition-colors" style={{ background: c.vat ? GOOD : "var(--line-strong)" }}>
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ right: c.vat ? 2 : 18 }} />
            </span>
            مسجّلة في ضريبة القيمة المضافة (١٥٪)
          </button>
          <span className="ms-auto rounded-2xl px-3 py-2 text-sm font-black" style={{ background: "color-mix(in srgb, var(--acc) 8%, transparent)", color: "var(--acc)" }}>
            تكلفة الساعة: {base.perHour === null ? "— (عبّي المصاريف والساعات)" : sar(base.perHour)}
          </span>
        </div>
      </div>

      {/* الخدمات */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-base font-black text-[var(--ink)]">٢. الخدمات وأسعارها</h3>
          <button onClick={() => addSvc()} className={`${btnPrimary} !px-4 !py-2 text-xs`} style={accGrad}><Plus size={14} /> خدمة</button>
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          التكلفة = المواد + الوقت × تكلفة الساعة{s.model === "home_visit" ? " + المواصلات ووقت الطريق" : ""}. السعر الأدنى = التكلفة ÷ (١ − الهامش − العمولة).
        </p>
        {s.services.length === 0 && <p className="mt-3 rounded-2xl border border-dashed border-[var(--line-strong)] p-5 text-center text-sm text-[var(--muted)]">ابدئي بأكثر ٥ خدمات طلباً — أو أضيفي من الأفكار تحت.</p>}
        <ul className="mt-3 space-y-2">
          {s.services.map((x) => {
            const p = pricing(x, c, s.model);
            const k = serviceKind(x.kind);
            const st = p.status ? STATUS[p.status] : null;
            return (
              <li key={x.id} className="rounded-2xl border border-[var(--line)] p-3" style={st && p.status !== "ok" ? { borderColor: `${st.c}66` } : undefined}>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={x.name} onChange={(e) => setSvc(x.id, { name: e.target.value })} placeholder="اسم الخدمة" className={`${input} min-w-[10rem] flex-1 !py-1.5 font-bold`} aria-label="اسم الخدمة" />
                  <select value={x.kind} onChange={(e) => setSvc(x.id, { kind: e.target.value as ServiceKind })} className={`${input} !w-auto !py-1.5 text-xs font-bold`} style={{ color: k.color }} aria-label="نوع الخدمة">
                    {SERVICE_KINDS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <button onClick={() => patch({ services: s.services.filter((y) => y.id !== x.id) })} className="text-[var(--faint)] hover:text-red-600" aria-label="حذف الخدمة"><Trash2 size={15} /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([["minutes", "المدة", "دقيقة"], ["materials", "تكلفة المواد", "ر.س"], ["price", "السعر الحالي", "ر.س"], ["per_month", "كم مرة بالشهر", "مرة"]] as const).map(([f, l, u]) => (
                    <label key={f} className="block">
                      <span className="mb-0.5 block text-[10px] font-bold text-[var(--muted)]">{l}</span>
                      <div className="flex items-center gap-1">
                        <input type="number" inputMode="decimal" min={0} value={x[f] ?? ""} onChange={(e) => setSvc(x.id, { [f]: numOrNull(e.target.value) })} className={`${input} !py-1`} placeholder="—" />
                        <span className="shrink-0 text-[10px] text-[var(--faint)]">{u}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] font-bold text-[var(--body)]">
                  <span>التكلفة: {sar(p.cost)}</span>
                  <span>الأدنى: {sar(p.min)}</span>
                  <span style={{ color: "var(--acc)" }}>المقترح: {sar(p.suggested)}{p.withVat ? ` (مع الضريبة ${sar(p.withVat)})` : ""}</span>
                  {p.profit !== null && <span>ربحك الحالي: <span style={{ color: p.profit >= 0 ? GOOD : BAD }}>{sar(p.profit)}</span></span>}
                  {st && <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: st.c, background: `color-mix(in srgb, ${st.c} 12%, transparent)` }}>{st.l}</span>}
                  {p.suggested !== null && x.price !== p.suggested && p.status !== "ok" && (
                    <button onClick={() => setSvc(x.id, { price: p.suggested })} className="ms-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" }}>
                      <Wand2 size={11} /> اعتمدي المقترح
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* تقدير الشهر */}
      <div className={`${card} p-4 sm:p-5`}>
        <h3 className="text-base font-black text-[var(--ink)]">٣. صورة الشهر من قائمتك</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Box label="الدخل التقديري" value={sar(est.revenue || null)} />
          <Box label="صافي الربح" value={sar(est.profit)} tone={est.profit === null ? undefined : est.profit >= 0 ? GOOD : BAD} />
          <Box label="هامش الربح" value={est.margin === null ? "—" : `${fmt(est.margin * 100)}٪`} tone={est.margin === null ? undefined : est.margin >= 0.2 ? GOOD : est.margin >= 0 ? WARN : BAD} />
          <Box label="نقطة التعادل" value={est.breakEven === null ? "—" : `${fmt(est.breakEven)} خدمة/شهر`} sub={est.visits ? `حالياً ${fmt(est.visits)}` : undefined} />
        </div>
        <p className="mt-2 text-[11px] text-[var(--faint)]">الربح = الدخل − (المواد{s.model === "home_visit" ? " والمواصلات" : ""} والعمولة) − المصاريف الثابتة. تقدير يتحسن كل ما كانت الأرقام أدق.</p>
      </div>

      {/* الأفكار */}
      {s.model && (
        <div className={`${card} p-4 sm:p-5`}>
          <div className="mb-2 flex items-center gap-2"><Lightbulb size={16} className="text-[var(--acc)]" /><h3 className="text-base font-black text-[var(--ink)]">٤. صممي القائمة: دخول + إضافات + باقة</h3></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(["entry", "addon", "package"] as const).map((kind) => {
              const k = serviceKind(kind);
              return (
                <div key={kind} className="rounded-2xl border border-[var(--line)] p-3">
                  <div className="text-sm font-black" style={{ color: k.color }}>{k.label}</div>
                  <div className="text-[11px] text-[var(--muted)]">{k.hint}</div>
                  <ul className="mt-2 space-y-1">
                    {SERVICE_IDEAS[s.model!][kind].map((idea) => {
                      const added = s.services.some((x) => x.name === idea);
                      return (
                        <li key={idea}>
                          <button onClick={() => !added && addSvc(idea, kind)} disabled={added} className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-right text-xs text-[var(--body)] hover:bg-[var(--hover)] disabled:opacity-50">
                            {added ? <Check size={12} className="shrink-0 text-emerald-600" /> : <Plus size={12} className="shrink-0 text-[var(--acc)]" />} {idea}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ label, value, tone, sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-2)] px-3 py-2.5">
      <div className="text-[11px] font-bold text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 text-base font-black" style={{ color: tone ?? "var(--ink)" }}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--faint)]">{sub}</div>}
    </div>
  );
}

function ContentCard({ model }: { model: BizModel }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--line)] p-3 sm:grid-cols-2">
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-[var(--ink)]"><Sparkles size={13} style={{ color: GOLD }} /> خطة النشر الأسبوعية</div>
        <ul className="space-y-1">{CONTENT_WEEK.map((w) => <li key={w.day} className="text-xs leading-relaxed text-[var(--body)]"><b className="text-[var(--acc)]">{w.day}:</b> {w.type} — {w.idea}</li>)}</ul>
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-[var(--ink)]"><RefreshCw size={13} className="text-[var(--acc)]" /> محتوى يبني الثقة لنموذجك</div>
        <ul className="list-inside list-disc space-y-1 text-xs text-[var(--body)]">{CONTENT_BY_MODEL[model].map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    </div>
  );
}

/* ──────────────────────────── خطة الشهر ──────────────────────────── */

function MonthView({ s, set, results }: { s: Simple; set: (s: Simple) => void; results: Results }) {
  const months = s.months;
  const cur = months[months.length - 1] ?? null;
  const [adding, setAdding] = useState("");
  const [openPast, setOpenPast] = useState<string | null>(null);

  if (!cur) {
    return (
      <div className={`${card} p-6 text-center`}>
        <CalendarCheck size={28} className="mx-auto text-[var(--faint)]" />
        <p className="mt-2 text-sm text-[var(--muted)]">ما فيه خطة شهرية بعد — تنبني من أعلى الفجوات أولوية.</p>
        <button onClick={() => set({ ...s, months: [buildMonth(s, results, monthKeyOf(new Date()), rid())] })} className={`${btnPrimary} mt-4`} style={accGrad}>
          <Plus size={15} /> ابدئي خطة {monthLabel(monthKeyOf(new Date()))}
        </button>
      </div>
    );
  }

  const setCur = (p: Partial<MonthPlan>) => set({ ...s, months: months.map((m, i) => (i === months.length - 1 ? { ...m, ...p } : m)) });
  const doneN = cur.actions.filter((a) => cur.done[a]).length;
  const available = openActions(s, results).filter((a) => !cur.actions.includes(a.id));
  const prev = months.length > 1 ? months[months.length - 2] : null;
  const closeMonth = () => {
    const left = cur.actions.length - doneN;
    if (!confirm(`إقفال ${monthLabel(cur.month)}؟${left ? ` ${fmt(left)} إجراء ما انجز بيترحّل للشهر الجاي.` : ""}`)) return;
    const closed = { ...cur, closed_at: new Date().toISOString() };
    const withClosed = { ...s, months: [...months.slice(0, -1), closed] };
    set({ ...withClosed, months: [...withClosed.months, buildMonth(withClosed, results, nextMonthKey(cur.month), rid())] });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-4">
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><CalendarCheck size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-black text-[var(--ink)]">خطة {monthLabel(cur.month)}</div>
            <div className="text-xs text-[var(--muted)]">الشهر رقم {fmt(months.length)} · {fmt(doneN)} من {fmt(cur.actions.length)} منجز</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full transition-all" style={{ width: `${cur.actions.length ? (doneN / cur.actions.length) * 100 : 0}%`, background: GOOD }} /></div>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">هدف الشهر (رقم واحد واضح)</span>
          <input value={cur.focus} onChange={(e) => setCur({ focus: e.target.value })} className={input} placeholder="مثال: نوقف الخسارة في الأسعار ونرفع العودة من ٣٥٪ إلى ٤٥٪" />
        </label>
      </div>

      <div className={`${card} p-4 sm:p-5`}>
        <h3 className="text-base font-black text-[var(--ink)]">إجراءات الشهر</h3>
        <ul className="mt-3 space-y-1.5">
          {cur.actions.map((id) => {
            const a = actionById(id);
            if (!a) return null;
            const done = !!cur.done[id];
            return (
              <li key={id} className="flex items-start gap-2 rounded-2xl bg-[var(--surface-2)] px-3 py-2.5">
                <button onClick={() => setCur({ done: { ...cur.done, [id]: !done } })} className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2" aria-label={done ? "إلغاء الإنجاز" : "إنجاز"}
                  style={done ? { background: GOOD, borderColor: GOOD, color: "#fff" } : { borderColor: "var(--line-strong)" }}>{done && <Check size={12} />}</button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-bold ${done ? "text-[var(--faint)] line-through" : "text-[var(--ink)]"}`}>
                    {a.title} {cur.carried.includes(id) && <span className="rounded-full px-1.5 text-[10px] font-black" style={{ color: WARN, background: `color-mix(in srgb, ${WARN} 12%, transparent)` }}>مرحّلة</span>}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{a.how}</div>
                </div>
                <button onClick={() => { const d = { ...cur.done }; delete d[id]; setCur({ actions: cur.actions.filter((x) => x !== id), done: d }); }}
                  className="shrink-0 text-[var(--faint)] hover:text-red-600" aria-label="إزالة من الشهر"><X size={14} /></button>
              </li>
            );
          })}
        </ul>
        {available.length > 0 && (
          <div className="mt-3 flex gap-2">
            <select value={adding} onChange={(e) => setAdding(e.target.value)} className={input} aria-label="إضافة إجراء">
              <option value="">أضيفي إجراء من الفجوات المفتوحة…</option>
              {available.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <button onClick={() => { if (adding) { setCur({ actions: [...cur.actions, adding] }); setAdding(""); } }} disabled={!adding} className={`${btnGhost} shrink-0`}><Plus size={14} /></button>
          </div>
        )}
        {s.model && cur.actions.some((id) => actionById(id)?.axis === "social") && <ContentCard model={s.model} />}
      </div>

      {/* مراجعة نهاية الشهر */}
      <div className={`${card} p-4 sm:p-5`}>
        <h3 className="text-base font-black text-[var(--ink)]">مراجعة نهاية الشهر</h3>
        <p className="mt-0.5 text-xs text-[var(--muted)]">آخر الشهر: سجّلي الأرقام، وأقفلي الشهر — الشهر الجاي ينبني تلقائياً من اللي باقي.</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SIMPLE_KPIS.map((k) => {
            const v = cur.numbers[k.key] ?? null;
            const ref = prev?.numbers[k.key] ?? s.baseline[k.key] ?? null;
            const diff = v !== null && ref !== null && ref !== 0 ? ((v - ref) / Math.abs(ref)) * 100 : null;
            const good = diff === null ? null : k.lowerIsBetter ? diff <= 0 : diff >= 0;
            return (
              <li key={k.key} className="rounded-2xl bg-[var(--surface-2)] p-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-xs font-bold text-[var(--ink)]">{k.label}</span>
                  {diff !== null && <span className="text-xs font-black" style={{ color: good ? GOOD : BAD }}>{diff >= 0 ? "+" : "−"}{fmt(Math.abs(diff))}٪</span>}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <input type="number" inputMode="decimal" min={0} value={v ?? ""} placeholder="—" aria-label={`${k.label} ${monthLabel(cur.month)}`}
                    onChange={(e) => setCur({ numbers: { ...cur.numbers, [k.key]: numOrNull(e.target.value) } })} className={`${input} !py-1.5`} />
                  <span className="w-12 shrink-0 text-[10px] text-[var(--faint)]">{k.unit}</span>
                </div>
                {ref !== null && <div className="mt-0.5 text-[10px] text-[var(--faint)]">{prev ? "الشهر الماضي" : "قبل"}: {fmt(ref)}</div>}
              </li>
            );
          })}
        </ul>
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">ملاحظات الشهر (وش نجح، وش ما مشى، وليش)</span>
          <textarea rows={2} value={cur.notes} onChange={(e) => setCur({ notes: e.target.value })} className={`${input} resize-y`} />
        </label>
        <button onClick={closeMonth} className={`${btnPrimary} mt-3 w-full sm:w-auto`} style={accGrad}><Lock size={14} /> أقفلي {monthLabel(cur.month)} وابدئي {monthLabel(nextMonthKey(cur.month))}</button>
      </div>

      {months.length > 1 && (
        <div className={`${card} p-4 sm:p-5`}>
          <h3 className="text-base font-black text-[var(--ink)]">الشهور السابقة</h3>
          <ul className="mt-2 space-y-1.5">
            {months.slice(0, -1).reverse().map((m) => {
              const d = m.actions.filter((a) => m.done[a]).length;
              const isOpen = openPast === m.id;
              return (
                <li key={m.id} className="rounded-2xl border border-[var(--line)]">
                  <button onClick={() => setOpenPast(isOpen ? null : m.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-right">
                    <span className="min-w-0 flex-1 text-sm font-bold text-[var(--ink)]">{monthLabel(m.month)}</span>
                    <span className="text-xs font-black" style={{ color: d === m.actions.length ? GOOD : WARN }}>{fmt(d)}/{fmt(m.actions.length)}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--line)] px-3 py-2 text-xs text-[var(--body)]">
                      {m.focus && <p className="mb-1"><b>الهدف:</b> {m.focus}</p>}
                      <ul className="space-y-0.5">{m.actions.map((id) => <li key={id}>{m.done[id] ? "✅" : "▫️"} {actionById(id)?.title}</li>)}</ul>
                      {m.notes && <p className="mt-1 text-[var(--muted)]">{m.notes}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── المتابعة الشهرية ──────────────────────────── */

function FollowUp({ s, patch }: { s: Simple; patch: Patch }) {
  const months = s.months;
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <h3 className="text-base font-black text-[var(--ink)]">المتابعة الشهرية — ٦ أرقام</h3>
      <p className="mt-0.5 text-xs text-[var(--muted)]">«قبل» من الجلسة، وكل شهر من «مراجعة نهاية الشهر». التغيّر = آخر شهر مقارنة بـ«قبل».</p>
      <div className="-mx-1 mt-3 overflow-x-auto px-1">
        <table className="w-full text-sm" style={{ minWidth: 380 + months.length * 90 }}>
          <thead>
            <tr className="text-right text-[11px] text-[var(--faint)]">
              <th className="px-2 py-1.5 font-bold">المؤشر</th>
              <th className="w-28 px-2 py-1.5 font-bold">قبل</th>
              {months.map((m) => <th key={m.id} className="px-2 py-1.5 font-bold">{monthLabel(m.month).split(" ")[0]}</th>)}
              <th className="px-2 py-1.5 font-bold">التغيّر</th>
            </tr>
          </thead>
          <tbody>
            {SIMPLE_KPIS.map((k) => {
              const b = s.baseline[k.key] ?? null;
              const lastV = [...months].reverse().map((m) => m.numbers[k.key]).find((v) => v !== null && v !== undefined) ?? null;
              const diff = b !== null && lastV !== null && b !== 0 ? ((lastV - b) / Math.abs(b)) * 100 : null;
              const good = diff === null ? null : k.lowerIsBetter ? diff <= 0 : diff >= 0;
              return (
                <tr key={k.key} className="border-t border-[var(--line)]">
                  <td className="px-2 py-2 font-bold text-[var(--ink)]">{k.label} <span className="text-[10px] font-normal text-[var(--faint)]">({k.unit})</span></td>
                  <td className="px-2 py-2">
                    <input type="number" inputMode="decimal" min={0} value={b ?? ""} placeholder="—" aria-label={`${k.label} قبل`}
                      onChange={(e) => patch({ baseline: { ...s.baseline, [k.key]: numOrNull(e.target.value) } })} className={`${input} !py-1`} />
                  </td>
                  {months.map((m) => <td key={m.id} className="px-2 py-2 text-[var(--body)]">{m.numbers[k.key] == null ? "—" : fmt(m.numbers[k.key]!)}</td>)}
                  <td className="px-2 py-2 font-black" style={{ color: good === null ? "var(--faint)" : good ? GOOD : BAD }}>{diff === null ? "—" : `${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))}٪`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
