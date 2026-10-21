"use client";

// تبويب «التشخيص الأولي» في الخطة التسويقية للصالونات:
// أول اجتماع قبل التعاقد — المطلوب قبله، محاور النقاش، بطاقة خط الأساس («قبل»)،
// علامات التريّث، وأهداف ٩٠ يوم مع مقارنة تلقائية بأرقام اللوحة الحالية.

import React, { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Stethoscope, ClipboardList, ClipboardCheck, Target, TriangleAlert, Lock, LockOpen, ChevronDown, FileText,
  CalendarDays, Flag, Check, Users, Receipt, Sparkles, CalendarClock, Crown, Star,
  Scissors, MessageCircle, Zap, Flower2, Coffee, UserCheck,
} from "lucide-react";
import {
  DEFAULT_DIAGNOSIS, KPIS, computeCurrentKpis, localDateKey,
  type ApptRow, type ClientRow, type Diagnosis, type KpiDef, type KpiKey, type MembershipRow, type Settings,
} from "@/lib/salon-growth";

const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (n: number, digits = 0) => n.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const GOLD = "#D4AF37";
const GOOD = "#16A34A";
const BAD = "#DC2626";

const card = "rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-[var(--on-acc)] transition-all hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--body)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-50";
const accGrad = { background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" };
const input =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)] disabled:opacity-60";

/* ──────────────────────────── المحتوى ──────────────────────────── */

const PREREQS: { id: string; icon: LucideIcon; title: string; why: string }[] = [
  { id: "sales", icon: Receipt, title: "المبيعات الشهرية لآخر ٣–٦ أشهر + عدد الفواتير", why: "الدخل ومتوسط الفاتورة والاتجاه" },
  { id: "clients", icon: Users, title: "قائمة العميلات (الاسم، الجوال، آخر زيارة، الإنفاق)", why: "الفعّالات والنائمات ومعدل العودة" },
  { id: "services", icon: Scissors, title: "قائمة الخدمات والأسعار ومدة كل خدمة", why: "فرص البيع الإضافي والباقات" },
  { id: "staff", icon: UserCheck, title: "الموظفات: التخصص والدوام وطريقة الراتب/العمولة", why: "الحافز على البيع وإنتاجية كل وحدة" },
  { id: "booking", icon: CalendarClock, title: "طريقة الحجز الحالية (اتصال/واتساب/إنستقرام/نظام)", why: "حجم الضياع والغياب" },
  { id: "offers", icon: Crown, title: "العروض والباقات والعضويات الحالية", why: "وش جُرّب ووش نجح" },
  { id: "accounts", icon: Star, title: "حسابات قوقل ماب وإنستقرام", why: "التقييم وعدد المراجعات والتفاعل" },
];

type Axis = { id: string; icon: LucideIcon; title: string; key?: string; questions: { id: string; q: string }[]; observe?: boolean };

const AXES: Axis[] = [
  { id: "owner", icon: Flag, title: "المالكة وأهدافها", questions: [
    { id: "owner_target", q: "وش الرقم الشهري اللي تبي توصله؟" },
    { id: "owner_pain", q: "وش أكبر مشكلة مزعجتها اليوم؟" },
    { id: "owner_tried", q: "وش جرّبت قبل وما نجح؟ (يكشف التوقعات والالتزام)" },
  ] },
  { id: "retention", icon: Users, title: "العميلات والعودة", key: "مفتاح العميلات النائمات", questions: [
    { id: "ret_regulars", q: "كم عميلة تعرفينها بالاسم وترجع بانتظام؟" },
    { id: "ret_followup", q: "هل تتواصلون مع العميلة بعد الزيارة أو تذكّرونها بموعدها الجاي؟" },
    { id: "ret_absent", q: "لما تغيب عميلة شهرين — هل أحد ينتبه ويتواصل؟" },
  ] },
  { id: "upsell", icon: Sparkles, title: "الفاتورة والبيع الإضافي", key: "مفتاح استشارة الـ ٥ دقائق", questions: [
    { id: "up_consult", q: "هل الخبيرة تفحص وتقترح قبل الخدمة، ولا تنفّذ المطلوب بس؟" },
    { id: "up_commission", q: "هل فيه عمولة على الإضافات؟" },
    { id: "up_rebook", q: "هل يُعرض على العميلة موعدها الجاي قبل ما تطلع؟" },
  ] },
  { id: "experience", icon: Flower2, title: "تجربة الاستقبال", key: "مفتاح بروتوكول الـ ٣ دقائق", observe: true, questions: [
    { id: "exp_notes", q: "ملاحظاتك وقت الدخول (راقب ولا تسأل): الوقت لين الترحيب، الضيافة، الريحة، الترتيب" },
  ] },
  { id: "ops", icon: CalendarClock, title: "التشغيل والحجوزات", questions: [
    { id: "ops_noshow", q: "كم نسبة الغياب والإلغاء تقريباً؟" },
    { id: "ops_peaks", q: "متى أوقات الذروة؟ ومتى أوقات الفراغ؟ (الفراغ = فرصة عروض)" },
    { id: "ops_util", q: "كم ساعة فعلياً محجوزة من ساعات دوام الموظفات؟" },
  ] },
  { id: "memberships", icon: Crown, title: "العضويات والدفع المقدّم", key: "مفتاح العضويات المغلقة", questions: [
    { id: "mem_current", q: "هل فيه رصيد مسبق أو باقة شهرية أو باقة عروس؟ كم مشتركة؟" },
  ] },
  { id: "reputation", icon: Star, title: "السمعة والتسويق", questions: [
    { id: "rep_google", q: "كم تقييم قوقل وعدد المراجعات؟" },
    { id: "rep_spend", q: "كم الصرف على الإعلان، ومن وين تجي العميلات الجدد؟" },
  ] },
];
const QUESTION_COUNT = AXES.reduce((s, a) => s + a.questions.length, 0);

const OBSERVE = [
  { id: "scent", title: "العطر المميّز للصالون", icon: Flower2 },
  { id: "drink", title: "مشروب الترحيب", icon: Coffee },
  { id: "name", title: "الترحيب بالاسم خلال ٣ دقائق", icon: UserCheck },
  { id: "consult", title: "استشارة قبل الخدمة", icon: Sparkles },
  { id: "photo", title: "صورة «قبل وبعد»", icon: Star },
];

const FLAGS = [
  { id: "rush", text: "المالكة تبي نتيجة خلال أسبوعين، أو ما تبي تشارك أي أرقام" },
  { id: "staff", text: "الموظفات ضد التغيير، وما فيه أحد يقدر يفرض النظام" },
  { id: "nodata", text: "ما عندهم أرقام العميلات أبداً، ومو مستعدين يسجّلونها" },
];

/* ──────────────────────────── أدوات ──────────────────────────── */

function formatKpi(k: KpiDef, v: number | null | undefined) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (k.unit === "ر.س") return `${fmt(v)} ر.س`;
  if (k.unit === "٪") return `${fmt(v)}٪`;
  if (k.unit === "من ٥") return `${fmt(v, 1)} من ٥`;
  return `${fmt(v)} ${k.unit}`;
}

/** الفرق بين «قبل» و«الحالي» — للنسب بالنقاط، ولغيرها كنسبة تغيّر. */
function delta(k: KpiDef, base: number | null | undefined, cur: number | null | undefined) {
  if (base === null || base === undefined || cur === null || cur === undefined) return null;
  const diff = cur - base;
  const better = k.lowerIsBetter ? diff < 0 : diff > 0;
  const color = diff === 0 ? "var(--muted)" : better ? GOOD : BAD;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  if (k.unit === "٪") return { text: `${sign}${fmt(Math.abs(diff))} نقطة`, color };
  if (k.unit === "من ٥") return { text: `${sign}${fmt(Math.abs(diff), 1)}`, color };
  if (base === 0) return { text: `${sign}${fmt(Math.abs(diff))}`, color };
  return { text: `${sign}${fmt(Math.abs((diff / base) * 100))}٪`, color };
}

/** تقدّم الهدف: كم قطعنا من المسافة بين «قبل» والهدف. */
function goalProgress(k: KpiDef, base: number | null | undefined, cur: number | null | undefined, target: number | null) {
  if (base === null || base === undefined || cur === null || cur === undefined || target === null || target === base) return null;
  return Math.min(1, Math.max(0, (cur - base) / (target - base)));
}

const numOrNull = (v: string) => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/* ──────────────────────────── التبويب ──────────────────────────── */

export default function DiagnosisTab({ data, now, setSetting, copy, salonName }: {
  data: { clients: ClientRow[]; appts: ApptRow[]; memberships: MembershipRow[]; settings: Settings };
  now: number;
  setSetting: <K extends "diagnosis">(key: K, value: Settings[K]) => void;
  copy: (text: string, msg?: string) => void;
  salonName: string;
}) {
  const d: Diagnosis = { ...DEFAULT_DIAGNOSIS, ...data.settings.diagnosis };
  const set = (patch: Partial<Diagnosis>) => setSetting("diagnosis", { ...d, ...patch });
  const locked = !!d.baseline_locked_at;

  const todayKey = localDateKey(now);
  const receptionToday = data.settings.reception.date === todayKey
    ? Object.values(data.settings.reception.checks).filter(Boolean).length : 0;
  const hour = Math.floor(now / 3_600_000);
  const auto = useMemo(
    () => computeCurrentKpis(data.clients, data.appts, data.memberships, receptionToday, hour * 3_600_000),
    [data.clients, data.appts, data.memberships, receptionToday, hour],
  );
  const current = (k: KpiDef) => (k.auto ? auto[k.key] ?? null : d.manual_current[k.key] ?? null);

  const receivedCount = PREREQS.filter((p) => d.received[p.id]).length;
  const answered = AXES.flatMap((a) => a.questions).filter((q) => (d.notes[q.id] ?? "").trim()).length;
  const baselineCount = KPIS.filter((k) => d.baseline[k.key]?.value !== null && d.baseline[k.key]?.value !== undefined).length;
  const flagCount = FLAGS.filter((f) => d.flags[f.id]).length;
  const observedCount = OBSERVE.filter((o) => d.observed[o.id]).length;

  const [open, setOpen] = useState<string | null>("owner");

  const setBaseline = (key: KpiKey, patch: Partial<{ value: number | null; estimated: boolean }>) =>
    set({ baseline: { ...d.baseline, [key]: { value: null, estimated: false, ...d.baseline[key], ...patch } } });

  const toggleObserved = (id: string) => {
    const observed = { ...d.observed, [id]: !d.observed[id] };
    const score = OBSERVE.filter((o) => observed[o.id]).length;
    // درجة الاستقبال في خط الأساس = ما لاحظته وقت الزيارة (لين ما يُعتمد الأساس)
    set({ observed, ...(locked ? {} : { baseline: { ...d.baseline, reception_score: { value: score, estimated: false } } }) });
  };

  const requestMsg =
    `السلام عليكم${d.owner_name.trim() ? ` ${d.owner_name.trim()}` : ""} 🌸\n` +
    `عشان نجهّز لاجتماعنا${d.meeting_date ? ` يوم ${new Date(d.meeting_date).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" })}` : ""} ونطلع بخطة دقيقة لصالونك، نحتاج منك (صور أو ملفات على راحتك):\n` +
    PREREQS.map((p, i) => `${fmt(i + 1)}. ${p.title}`).join("\n") +
    `\n\nلو بعضها مو متوفر عادي — نرتّبها سوا في الاجتماع 🤍`;

  const goalsDefined = d.goals.filter((g) => g.kpi && g.target !== null);
  const summaryMsg =
    `ملخص التشخيص الأولي — ${salonName}\n` +
    (d.meeting_date ? `التاريخ: ${new Date(d.meeting_date).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })}\n` : "") +
    `\n📊 خط الأساس (قبل):\n` +
    KPIS.filter((k) => d.baseline[k.key]?.value !== null && d.baseline[k.key]?.value !== undefined)
      .map((k) => `• ${k.label}: ${formatKpi(k, d.baseline[k.key]!.value)}${d.baseline[k.key]!.estimated ? " (تقديري)" : ""}`).join("\n") +
    (goalsDefined.length
      ? `\n\n🎯 أهداف ٩٠ يوم:\n` + goalsDefined.map((g) => {
          const k = KPIS.find((x) => x.key === g.kpi)!;
          return `• ${k.label}: من ${formatKpi(k, d.baseline[k.key]?.value)} إلى ${formatKpi(k, g.target)}`;
        }).join("\n")
      : "") +
    (d.quick_win.trim() ? `\n\n⚡ الفوز السريع (أول أسبوعين): ${d.quick_win.trim()}` : "") +
    (d.next_review ? `\n📅 موعد المراجعة: ${new Date(d.next_review).toLocaleDateString(LOCALE, { day: "numeric", month: "long" })}` : "");

  return (
    <div className="space-y-5">
      {/* ─── رأس التشخيص ─── */}
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><Stethoscope size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-[var(--ink)]">التشخيص الأولي — أول اجتماع قبل التعاقد</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              ثلاث نتائج: <b className="text-[var(--body)]">تشخيص</b> وين يضيع الدخل، <b className="text-[var(--body)]">خط أساس</b> نقيس عليه التطور، و<b className="text-[var(--body)]">اتفاق</b> على ٣ أهداف لـ ٩٠ يوم.
              يُفضّل يكون الاجتماع في الصالون نفسه (٦٠–٩٠ دقيقة).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copy(summaryMsg, "تم نسخ الملخص")} className={btnGhost} disabled={!baselineCount}><FileText size={14} /> نسخ ملخص للعميلة</button>
            {locked ? (
              <button onClick={() => { if (confirm("إلغاء اعتماد خط الأساس والسماح بتعديله؟")) set({ baseline_locked_at: null }); }} className={btnGhost}><LockOpen size={14} /> إلغاء الاعتماد</button>
            ) : (
              <button onClick={() => set({ baseline_locked_at: new Date().toISOString() })} className={btnPrimary} style={accGrad} disabled={!baselineCount}><Lock size={14} /> اعتماد خط الأساس</button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--muted)]">اسم المالكة</span>
            <input value={d.owner_name} onChange={(e) => set({ owner_name: e.target.value.slice(0, 80) })} placeholder="مثال: أ. نورة" className={input} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--muted)]">تاريخ الاجتماع</span>
            <input type="date" value={d.meeting_date} onChange={(e) => set({ meeting_date: e.target.value })} className={input} />
          </label>
          <div className="col-span-full grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
            <Progress label="المطلوب" value={receivedCount} total={PREREQS.length} />
            <Progress label="الأسئلة" value={answered} total={QUESTION_COUNT} />
            <Progress label="خط الأساس" value={baselineCount} total={KPIS.length} />
            <div className="rounded-2xl border border-[var(--line)] p-3 text-center">
              <div className="text-[11px] text-[var(--faint)]">الحالة</div>
              <div className="mt-1 text-xs font-black" style={{ color: locked ? GOOD : flagCount ? BAD : GOLD }}>
                {locked ? `معتمد ${new Date(d.baseline_locked_at!).toLocaleDateString(LOCALE, { day: "numeric", month: "short" })}` : flagCount ? "تريّث" : "قيد التعبئة"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        {/* ─── ١. المطلوب قبل الاجتماع ─── */}
        <Section n={1} icon={ClipboardList} title="المطلوب قبل الاجتماع" lead="أرسلها للمالكة قبل الاجتماع بيومين–ثلاثة، وعلّم اللي وصلك."
          action={<button onClick={() => copy(requestMsg, "تم نسخ رسالة الطلب")} className={btnGhost}><MessageCircle size={14} /> نسخ رسالة الطلب</button>}>
          <ul className="space-y-2">
            {PREREQS.map((p) => {
              const on = !!d.received[p.id];
              return (
                <li key={p.id}>
                  <button onClick={() => set({ received: { ...d.received, [p.id]: !on } })}
                    className="flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition-all hover:-translate-y-0.5"
                    style={{ borderColor: on ? GOOD : "var(--line)", background: on ? `color-mix(in srgb, ${GOOD} 6%, transparent)` : "transparent" }}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)]" style={{ color: on ? GOOD : "var(--muted)" }}><p.icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[var(--ink)]">{p.title}</span>
                      <span className="block text-[11px] text-[var(--faint)]">ليش: {p.why}</span>
                    </span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black" style={on ? { color: GOOD, background: `color-mix(in srgb, ${GOOD} 12%, transparent)` } : { color: "var(--faint)", background: "var(--surface-2)" }}>
                      {on ? "وصل ✓" : "بانتظاره"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {receivedCount === 0 && (
            <p className="mt-3 rounded-2xl bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--muted)]">
              إذا ما عندهم بيانات أبداً — هذا تشخيص بحد ذاته. ابدأوا بأسبوعين تسجيل يدوي قبل أي قياس.
            </p>
          )}
        </Section>

        {/* ─── ٢. محاور النقاش ─── */}
        <Section n={2} icon={ClipboardCheck} title="محاور النقاش داخل الاجتماع" lead="اكتب الإجابة باختصار تحت كل سؤال — تنحفظ تلقائياً.">
          <div className="space-y-2">
            {AXES.map((a) => {
              const isOpen = open === a.id;
              const done = a.questions.filter((q) => (d.notes[q.id] ?? "").trim()).length;
              return (
                <div key={a.id} className="overflow-hidden rounded-2xl border border-[var(--line)]">
                  <button onClick={() => setOpen(isOpen ? null : a.id)} className="flex w-full items-center gap-3 p-3 text-right transition-colors hover:bg-[var(--hover)]" aria-expanded={isOpen}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}><a.icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black text-[var(--ink)]">{a.title}</span>
                      {a.key && <span className="block text-[11px] font-bold" style={{ color: GOLD }}>{a.key}</span>}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--faint)]">{fmt(done)}/{fmt(a.questions.length)}</span>
                    <ChevronDown size={16} className={`shrink-0 text-[var(--muted)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="space-y-3 border-t border-[var(--line)] p-3">
                      {a.observe && (
                        <div>
                          <div className="mb-2 text-xs font-bold text-[var(--muted)]">قيّم بنفسك (تنحسب «درجة الاستقبال» في خط الأساس): {fmt(observedCount)} من ٥</div>
                          <div className="flex flex-wrap gap-1.5">
                            {OBSERVE.map((o) => {
                              const on = !!d.observed[o.id];
                              return (
                                <button key={o.id} onClick={() => toggleObserved(o.id)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
                                  style={on ? { borderColor: "var(--acc)", color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                                  {on ? <Check size={12} /> : <o.icon size={12} />} {o.title}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {a.questions.map((q) => (
                        <label key={q.id} className="block">
                          <span className="mb-1 block text-xs font-bold text-[var(--body)]">{q.q}</span>
                          <textarea rows={2} value={d.notes[q.id] ?? ""} onChange={(e) => set({ notes: { ...d.notes, [q.id]: e.target.value.slice(0, 1000) } })} className={`${input} resize-y leading-relaxed`} />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      </div>

      {/* ─── ٣. بطاقة خط الأساس ─── */}
      <Section n={3} icon={Receipt} title="بطاقة خط الأساس — «قبل» مقابل «الحالي»"
        lead="سجّل أرقام اليوم واعتمدها مع المالكة. «الحالي» يُحسب تلقائياً من بيانات اللوحة (آخر ٣٠ يوم)، والباقي تدخله يدوياً عند كل مراجعة."
        action={locked ? <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: GOOD, background: `color-mix(in srgb, ${GOOD} 12%, transparent)` }}><Lock size={12} /> الأساس معتمد</span> : null}>
        <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5 text-sm">
            <thead>
              <tr className="text-right text-[11px] font-bold text-[var(--faint)]">
                <th className="px-3 py-1 font-bold">المؤشر</th>
                <th className="w-44 px-3 py-1 font-bold">قبل (خط الأساس)</th>
                <th className="w-20 px-2 py-1 text-center font-bold">تقديري؟</th>
                <th className="w-40 px-3 py-1 font-bold">الحالي</th>
                <th className="w-28 px-3 py-1 font-bold">التغيّر</th>
              </tr>
            </thead>
            <tbody>
              {KPIS.map((k) => {
                const b = d.baseline[k.key];
                const cur = current(k);
                const dl = delta(k, b?.value, cur);
                return (
                  <tr key={k.key} className="bg-[var(--surface-2)]/60">
                    <td className="rounded-r-2xl px-3 py-2.5">
                      <div className="font-bold text-[var(--ink)]">{k.label}</div>
                      <div className="text-[11px] text-[var(--faint)]">{k.how}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <input type="number" inputMode="decimal" disabled={locked} value={b?.value ?? ""} onChange={(e) => setBaseline(k.key, { value: numOrNull(e.target.value) })}
                          className={`${input} !py-1.5`} placeholder="—" aria-label={`${k.label} — قبل`} />
                        <span className="shrink-0 text-[11px] text-[var(--faint)]">{k.unit}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <button disabled={locked || b?.value === null || b?.value === undefined} onClick={() => setBaseline(k.key, { estimated: !b?.estimated })}
                        className="rounded-full px-2 py-1 text-[11px] font-black transition-colors disabled:opacity-40"
                        style={b?.estimated ? { color: GOLD, background: `color-mix(in srgb, ${GOLD} 15%, transparent)` } : { color: "var(--faint)" }}>
                        {b?.estimated ? "تقديري" : "مؤكد"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      {k.auto ? (
                        <span className="font-black text-[var(--ink)]" title="محسوب من بيانات اللوحة">{formatKpi(k, cur)}</span>
                      ) : (
                        <input type="number" inputMode="decimal" value={d.manual_current[k.key] ?? ""} onChange={(e) => set({ manual_current: { ...d.manual_current, [k.key]: numOrNull(e.target.value) } })}
                          className={`${input} !py-1.5`} placeholder="أدخل يدوياً" aria-label={`${k.label} — الحالي`} />
                      )}
                    </td>
                    <td className="rounded-l-2xl px-3 py-2.5 font-black" style={{ color: dl?.color ?? "var(--faint)" }}>{dl?.text ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
          <b style={{ color: GOLD }}>مهم:</b> أي رقم ما تقدر تتأكد منه علّمه «تقديري» — يتصحّح أول شهر، لكن المقارنة على رقم غلط تهدم المصداقية.
        </p>
      </Section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        {/* ─── ٤. علامات التريّث ─── */}
        <Section n={4} icon={TriangleAlert} title="علامات التريّث قبل التعاقد" lead="علّم اللي ينطبق — أي علامة تعني نتفاهم عليها قبل التوقيع.">
          <ul className="space-y-2">
            {FLAGS.map((f) => {
              const on = !!d.flags[f.id];
              return (
                <li key={f.id}>
                  <button onClick={() => set({ flags: { ...d.flags, [f.id]: !on } })} className="flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition-colors"
                    style={{ borderColor: on ? BAD : "var(--line)", background: on ? `color-mix(in srgb, ${BAD} 6%, transparent)` : "transparent" }}>
                    <TriangleAlert size={16} className="shrink-0" style={{ color: on ? BAD : "var(--faint)" }} />
                    <span className="flex-1 text-sm font-bold text-[var(--body)]">{f.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 rounded-2xl p-3 text-xs font-bold" style={flagCount ? { color: BAD, background: `color-mix(in srgb, ${BAD} 8%, transparent)` } : { color: GOOD, background: `color-mix(in srgb, ${GOOD} 8%, transparent)` }}>
            {flagCount ? `${fmt(flagCount)} علامة — تريّث وتفاهم على التوقعات والبيانات قبل التعاقد.` : "ما فيه علامات تريّث — جاهزين للتعاقد."}
          </div>
        </Section>

        {/* ─── ٥. الأهداف والمخرجات ─── */}
        <Section n={5} icon={Target} title="أهداف ٩٠ يوم والمخرجات" lead="٣ أهداف من بطاقة الأساس — التقدّم يتحسب تلقائياً من «قبل» إلى الهدف.">
          <div className="space-y-3">
            {d.goals.map((g, i) => {
              const k = KPIS.find((x) => x.key === g.kpi);
              const base = k ? d.baseline[k.key]?.value : null;
              const cur = k ? current(k) : null;
              const p = k ? goalProgress(k, base, cur, g.target) : null;
              const setGoal = (patch: Partial<Diagnosis["goals"][number]>) => set({ goals: d.goals.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} className="rounded-2xl border border-[var(--line)] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black text-[#2A1018]" style={{ background: GOLD }}>{fmt(i + 1)}</span>
                    <select value={g.kpi} onChange={(e) => setGoal({ kpi: e.target.value as KpiKey | "" })} className={`${input} !w-auto min-w-0 flex-1`} aria-label={`الهدف ${i + 1}`}>
                      <option value="">اختر المؤشر…</option>
                      {KPIS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                    </select>
                    <input type="number" inputMode="decimal" value={g.target ?? ""} onChange={(e) => setGoal({ target: numOrNull(e.target.value) })} placeholder="الهدف" className={`${input} !w-28`} aria-label="القيمة المستهدفة" disabled={!g.kpi} />
                    {k && <span className="text-[11px] text-[var(--faint)]">{k.unit}</span>}
                  </div>
                  {k && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] font-bold text-[var(--muted)]">
                        <span>قبل: {formatKpi(k, base)}</span>
                        <span>الحالي: <b className="text-[var(--ink)]">{formatKpi(k, cur)}</b></span>
                        <span>الهدف: {formatKpi(k, g.target)}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(p ?? 0) * 100}%`, background: p === 1 ? GOOD : `linear-gradient(90deg, var(--acc), ${GOLD})` }} />
                      </div>
                      <div className="mt-1 text-[11px] font-bold" style={{ color: p === 1 ? GOOD : "var(--faint)" }}>
                        {p === null ? (base === null || base === undefined ? "سجّل قيمة «قبل» لهذا المؤشر" : "حدّد قيمة الهدف") : p === 1 ? "تحقّق الهدف 🎉" : `أُنجز ${fmt(p * 100)}٪ من المسافة`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-bold text-[var(--muted)]"><Zap size={12} style={{ color: GOLD }} /> الفوز السريع (أول أسبوعين)</span>
              <input value={d.quick_win} onChange={(e) => set({ quick_win: e.target.value.slice(0, 300) })} placeholder="مثال: حملة استرجاع النائمات + تفعيل التذكير بالمواعيد" className={input} />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1 text-xs font-bold text-[var(--muted)]"><CalendarDays size={12} /> موعد المراجعة القادمة</span>
              <input type="date" value={d.next_review} onChange={(e) => set({ next_review: e.target.value })} className={input} />
            </label>
          </div>
          <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--muted)]">
            <b className="text-[var(--body)]">إيقاع القياس:</b> متابعة أسبوعية قصيرة · مراجعة شهرية · مقارنة «قبل/بعد» عند ٩٠ يوم.
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ──────────────────────────── مكوّنات ──────────────────────────── */

function Section({ n, icon: Icon, title, lead, action, children }: {
  n: number; icon: LucideIcon; title: string; lead?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}>
          <Icon size={20} />
          <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-[#2A1018]" style={{ background: GOLD }}>{fmt(n)}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black leading-snug text-[var(--ink)] sm:text-xl">{title}</h2>
          {lead && <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  const p = total ? value / total : 0;
  return (
    <div className="rounded-2xl border border-[var(--line)] p-3 text-center">
      <div className="text-[11px] text-[var(--faint)]">{label}</div>
      <div className="mt-0.5 text-sm font-black text-[var(--ink)]">{fmt(value)}/{fmt(total)}</div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${p * 100}%`, background: p === 1 ? GOOD : "var(--acc)" }} />
      </div>
    </div>
  );
}
