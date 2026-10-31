"use client";

// «الخطة المبسطة» — للصالونات والخدمات المنزلية: نموذج العمل ← تشخيص خفيف بخمس محاور ←
// تسعير من التكلفة الحقيقية وقائمة خدمات ← خطة ٩٠ يوم تنبني من الفجوات ← ٦ مؤشرات.

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Store, Car, Home, Stethoscope, Calculator, ListChecks, BarChart3, Check, Plus, Trash2, Copy, Sparkles,
  Scissors, Receipt, Users, Megaphone, ShieldCheck, Lightbulb, RefreshCw, Wand2,
} from "lucide-react";
import {
  AXES, MODELS, NUMS, PHASES, SERVICE_IDEAS, SERVICE_KINDS, SIMPLE_KPIS, CONTENT_BY_MODEL,
  axisScore, costBase, evaluate, modelOf, monthEstimate, planActions, pricing, questionsFor, serviceKind,
  type AxisId, type BizModel, type Costs, type ServiceKind, type Simple, type SimpleService,
} from "@/lib/salon-simple";
import { CONTENT_WEEK } from "@/lib/salon-campaigns";

const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (v: number, d = 0) => v.toLocaleString(LOCALE, { maximumFractionDigits: d, minimumFractionDigits: 0 });
const sar = (v: number | null) => (v === null ? "—" : `${fmt(v)} ر.س`);
const GOOD = "#16A34A", BAD = "#DC2626", WARN = "#D9A21B", GOLD = "#D4AF37";

const card = "rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]";
const btnGhost = "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--body)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]";
const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-[var(--on-acc)] transition-all hover:-translate-y-0.5";
const accGrad = { background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" };
const input = "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)]";

const rid = () => Math.random().toString(36).slice(2, 10);
const numOrNull = (v: string) => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null);
const MODEL_ICON: Record<BizModel, LucideIcon> = { salon: Store, home_visit: Car, home_studio: Home };
const AXIS_ICON: Record<AxisId, LucideIcon> = { services: Scissors, pricing: Receipt, clients: Users, social: Megaphone, ops: ShieldCheck };
const scoreColor = (v: number | null) => (v === null ? "var(--faint)" : v >= 0.75 ? GOOD : v >= 0.5 ? WARN : BAD);

type Tab = "diagnosis" | "pricing" | "plan" | "kpis";
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "diagnosis", label: "التشخيص", icon: Stethoscope },
  { id: "pricing", label: "التسعير والخدمات", icon: Calculator },
  { id: "plan", label: "خطة ٩٠ يوم", icon: ListChecks },
  { id: "kpis", label: "المؤشرات", icon: BarChart3 },
];

export default function SimplePlan({ s, set, salonName, setSalonName, copy }: {
  s: Simple; set: (s: Simple) => void; salonName: string; setSalonName: (v: string) => void; copy: (t: string, msg?: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("diagnosis");
  const patch = (p: Partial<Simple>) => set({ ...s, ...p });
  if (!s.model) return <ModelPicker onPick={(model) => patch({ model })} />;

  const model = modelOf(s.model)!;
  const results = evaluate(s);
  const scores = AXES.map((a) => ({ ...a, ...axisScore(results, a.id) }));
  const known = results.filter((r) => r.pass !== null);
  const overall = known.length ? known.filter((r) => r.pass).length / known.length : null;
  const actions = planActions(s, results);
  const gaps = scores.filter((x) => x.score !== null).sort((a, b) => (a.score ?? 1) - (b.score ?? 1)).slice(0, 3).filter((x) => (x.score ?? 1) < 1);
  const MIcon = MODEL_ICON[s.model];

  const summary = () => {
    const lines = [`📋 الخطة المبسطة${salonName ? ` — ${salonName}` : ""}`, `النموذج: ${model.label}`, ""];
    lines.push("🩺 التشخيص:");
    scores.forEach((x) => lines.push(`• ${x.title}: ${x.score === null ? "ما اكتمل" : `${fmt(x.score * 100)}٪`}`));
    const bad = s.services.filter((x) => x.name.trim()).map((x) => ({ x, p: pricing(x, s.costs, s.model) })).filter(({ p }) => p.status === "loss" || p.status === "low");
    if (bad.length) {
      lines.push("", "💰 أسعار تحتاج تعديل:");
      bad.forEach(({ x, p }) => lines.push(`• ${x.name}: الحالي ${sar(x.price)} ← المقترح ${sar(p.suggested)}${p.status === "loss" ? " (خسارة)" : ""}`));
    }
    PHASES.forEach((ph) => {
      const list = actions.filter((a) => a.phase === ph.id);
      if (!list.length) return;
      lines.push("", `🗓️ ${ph.title} (${ph.days}):`);
      list.forEach((a) => lines.push(`${a.done ? "✅" : "▫️"} ${a.title}`));
    });
    return lines.join("\n");
  };

  return (
    <div className="space-y-5">
      {/* ─── الرأس ─── */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><MIcon size={20} /></span>
          <div className="min-w-0 flex-1 basis-48">
            <input value={salonName} onChange={(e) => setSalonName(e.target.value.slice(0, 60))} placeholder="اسم النشاط" aria-label="اسم النشاط"
              className="w-full rounded-lg border border-dashed border-[var(--line-strong)] bg-transparent px-2 py-0.5 text-lg font-black text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)] sm:w-72" />
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <button onClick={() => { if (confirm("تغيير نموذج العمل؟ الأسئلة والتوصيات تتغيّر حسبه — إجاباتك تبقى.")) patch({ model: null }); }}
                className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" }}>{model.label} ⇄</button>
              <span className="text-xs text-[var(--muted)]">أكبر خطر: {model.risk}</span>
            </div>
          </div>
          <button onClick={() => copy(summary(), "تم نسخ ملخص الخطة")} className={`${btnGhost} w-full !px-3 !py-1.5 text-xs sm:w-auto`}><Copy size={13} /> نسخ الملخص</button>
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
        {gaps.length > 0 && (
          <p className="mt-3 text-xs text-[var(--body)]"><b className="text-[var(--ink)]">أكبر الفجوات:</b> {gaps.map((g) => g.title).join("، ")} — الخطة مبنية عليها.</p>
        )}
      </div>

      <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold sm:text-sm"
            style={tab === t.id ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
            <t.icon size={14} /> {t.label}
            {t.id === "plan" && actions.length > 0 && <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{fmt(actions.filter((a) => !a.done).length)}</span>}
          </button>
        ))}
      </nav>

      {tab === "diagnosis" && <Diagnosis s={s} patch={patch} results={results} />}
      {tab === "pricing" && <Pricing s={s} patch={patch} />}
      {tab === "plan" && <Plan s={s} patch={patch} actions={actions} />}
      {tab === "kpis" && <Kpis s={s} patch={patch} />}
    </div>
  );
}

/* ──────────────────────────── اختيار النموذج ──────────────────────────── */

function ModelPicker({ onPick }: { onPick: (m: BizModel) => void }) {
  return (
    <div className={`${card} mx-auto max-w-3xl p-5 sm:p-7`}>
      <h2 className="text-xl font-black text-[var(--ink)]">وش نموذج النشاط؟</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">الأسئلة والتسعير والتوصيات تتغيّر حسبه — المنزلي يختلف جذرياً عن المحل.</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MODELS.map((m) => {
          const Icon = MODEL_ICON[m.id];
          return (
            <button key={m.id} onClick={() => onPick(m.id)} className="flex flex-col justify-start rounded-3xl border border-[var(--line)] p-4 text-right transition-all hover:-translate-y-0.5 hover:border-[var(--acc)]">
              <span className="grid h-11 w-11 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><Icon size={20} /></span>
              <div className="mt-3 text-base font-black text-[var(--ink)]">{m.label}</div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">{m.desc}</div>
              <div className="mt-2 text-[11px] leading-relaxed text-[var(--faint)]">أكبر خطر: {m.risk}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────── التشخيص ──────────────────────────── */

function Diagnosis({ s, patch, results }: { s: Simple; patch: (p: Partial<Simple>) => void; results: ReturnType<typeof evaluate> }) {
  const qs = questionsFor(s.model);
  const auto = results.filter((r) => r.id.startsWith("d_") && !["d_return", "d_posts", "d_dm", "d_rating"].includes(r.id));
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {AXES.map((a) => {
        const Icon = AXIS_ICON[a.id];
        const sc = axisScore(results, a.id);
        return (
          <div key={a.id} className={`${card} p-4 sm:p-5`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}><Icon size={15} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-black text-[var(--ink)]">{a.title}</div>
                <div className="text-[11px] text-[var(--muted)]">{a.lead}</div>
              </div>
              <span className="text-sm font-black" style={{ color: scoreColor(sc.score) }}>{sc.score === null ? "—" : `${fmt(sc.score * 100)}٪`}</span>
            </div>
            <ul className="space-y-1.5">
              {qs.filter((q) => q.axis === a.id).map((q) => {
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
              {NUMS.filter((x) => x.axis === a.id).map((x) => (
                <li key={x.id} className="flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] px-3 py-2">
                  <span className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--body)]">{x.label} <span className="text-[var(--faint)]">(الهدف: {x.good})</span></span>
                  <input type="number" inputMode="decimal" min={0} value={s.nums[x.id] ?? ""} onChange={(e) => patch({ nums: { ...s.nums, [x.id]: numOrNull(e.target.value) } })}
                    className={`${input} !w-20 !py-1 text-center`} aria-label={x.label} placeholder="—" />
                  <span className="w-10 shrink-0 text-[10px] text-[var(--faint)]">{x.unit}</span>
                </li>
              ))}
              {auto.filter((r) => r.axis === a.id).map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--line)] px-3 py-2">
                  <span className="min-w-0 flex-1 text-xs text-[var(--body)]">{r.label}</span>
                  <span className="shrink-0 text-[10px] font-black" style={{ color: r.pass === null ? "var(--faint)" : r.pass ? GOOD : BAD }}>
                    {r.pass === null ? "من «التسعير والخدمات»" : r.pass ? "✓ متحقق" : "✗ ناقص"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
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

/* ──────────────────────────── خطة ٩٠ يوم ──────────────────────────── */

function Plan({ s, patch, actions }: { s: Simple; patch: (p: Partial<Simple>) => void; actions: ReturnType<typeof planActions> }) {
  const done = actions.filter((a) => a.done).length;
  const phaseDate = (offset: number) => {
    if (!s.start) return null;
    const [y, m, d] = s.start.split("-").map(Number);
    return new Date(y, m - 1, d + offset).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
  };
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-3 p-4 sm:p-5`}>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black text-[var(--ink)]">خطة الـ٩٠ يوم</h3>
          <p className="text-xs text-[var(--muted)]">تنبني تلقائياً من التشخيص: كل فجوة = إجراء. كل ما تحسّن التشخيص تختفي الإجراءات اللي ما عادت لازمة.</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">البداية
          <input type="date" value={s.start} onChange={(e) => patch({ start: e.target.value })} className={`${input} !w-auto !py-1.5`} />
        </label>
        <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: GOOD, background: `color-mix(in srgb, ${GOOD} 10%, transparent)` }}>{fmt(done)} من {fmt(actions.length)} منجز</span>
      </div>

      {actions.length === 0 && <p className={`${card} p-6 text-center text-sm text-[var(--muted)]`}>ما فيه فجوات — كمّلي التشخيص والتسعير عشان تنبني الخطة.</p>}

      {PHASES.map((ph, i) => {
        const list = actions.filter((a) => a.phase === ph.id);
        if (!list.length) return null;
        const from = phaseDate(i * 30), to = phaseDate(i * 30 + 29);
        return (
          <div key={ph.id} className={`${card} p-4 sm:p-5`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl text-sm font-black text-[var(--on-acc)]" style={accGrad}>{fmt(ph.id)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-black text-[var(--ink)]">{ph.title} <span className="text-xs font-bold text-[var(--faint)]">({from && to ? `${from} – ${to}` : ph.days})</span></div>
                <div className="text-[11px] text-[var(--muted)]">{ph.goal}</div>
              </div>
            </div>
            <ul className="space-y-1.5">
              {list.map((a) => (
                <li key={a.id}>
                  <button onClick={() => patch({ done: { ...s.done, [a.id]: !a.done } })} className="flex w-full items-start gap-2.5 rounded-2xl bg-[var(--surface-2)] px-3 py-2.5 text-right hover:bg-[var(--hover)]">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2" style={a.done ? { background: GOOD, borderColor: GOOD, color: "#fff" } : { borderColor: "var(--line-strong)" }}>{a.done && <Check size={12} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-bold ${a.done ? "text-[var(--faint)] line-through" : "text-[var(--ink)]"}`}>
                        {a.title} {a.unknown && <span className="rounded-full px-1.5 text-[10px] font-black" style={{ color: WARN, background: `color-mix(in srgb, ${WARN} 12%, transparent)` }}>تأكدي</span>}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">{a.how}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {ph.id === 3 && s.model && <ContentCard model={s.model} />}
          </div>
        );
      })}
      {!actions.some((a) => a.phase === 3) && s.model && <div className={`${card} p-4 sm:p-5`}><ContentCard model={s.model} /></div>}
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

/* ──────────────────────────── المؤشرات ──────────────────────────── */

function Kpis({ s, patch }: { s: Simple; patch: (p: Partial<Simple>) => void }) {
  const cell = (which: "baseline" | "current", k: string) => (
    <input type="number" inputMode="decimal" min={0} value={s[which][k as keyof Simple["baseline"]] ?? ""} placeholder="—"
      onChange={(e) => patch({ [which]: { ...s[which], [k]: numOrNull(e.target.value) } })} className={`${input} !py-1.5`} aria-label={`${k} ${which}`} />
  );
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <h3 className="text-base font-black text-[var(--ink)]">٦ أرقام نتابعها كل شهر</h3>
      <p className="mt-0.5 text-xs text-[var(--muted)]">«قبل» تسجّلينها يوم التشخيص، و«الحالي» نهاية كل شهر — منها نعرف هل الخطة شغّالة.</p>
      <ul className="mt-3 space-y-2">
        {SIMPLE_KPIS.map((k) => {
          const b = s.baseline[k.key] ?? null, c = s.current[k.key] ?? null;
          const diff = b !== null && c !== null && b !== 0 ? ((c - b) / Math.abs(b)) * 100 : null;
          const good = diff === null ? null : k.lowerIsBetter ? diff <= 0 : diff >= 0;
          return (
            <li key={k.key} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl bg-[var(--surface-2)] p-3 sm:grid-cols-[1.4fr_1fr_1fr_5rem]">
              <div className="col-span-2 text-sm font-bold text-[var(--ink)] sm:col-span-1">{k.label} <span className="text-[11px] font-normal text-[var(--faint)]">({k.unit})</span></div>
              <label className="block"><span className="mb-0.5 block text-[10px] font-bold text-[var(--muted)]">قبل</span>{cell("baseline", k.key)}</label>
              <label className="block"><span className="mb-0.5 block text-[10px] font-bold text-[var(--muted)]">الحالي</span>{cell("current", k.key)}</label>
              <div className="col-span-2 text-center text-sm font-black sm:col-span-1" style={{ color: good === null ? "var(--faint)" : good ? GOOD : BAD }}>
                {diff === null ? "—" : `${diff >= 0 ? "+" : "−"}${fmt(Math.abs(diff))}٪`}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-[var(--faint)]">متوسط الفاتورة = الدخل ÷ عدد الزيارات. تكلفة العميلة الجديدة = صرف الإعلان ÷ عدد العميلات الجدد منه.</p>
    </div>
  );
}
