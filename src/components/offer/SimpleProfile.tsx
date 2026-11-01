"use client";

// «ملف المنشأة وصاحبتها» في الخطة المبسطة: الهدف والرؤية، الوضع النظامي، التخصص والموقع والمساحة،
// الفريق ومين يدير ووقته، الخبرة، المالية (الالتزامات وميزانية التطوير)، آراء العميلات، قنوات التسويق،
// والمخاطر. كل جزء يُستخدم في خطوته من الجلسة، وكلها مع بعض في تبويب «ملف المنشأة».

import React from "react";
import { AlertTriangle, Building2, MessageSquareQuote, Target, Users, Wallet } from "lucide-react";
import {
  CHANNELS, DEFAULT_PROFILE, GOALS, LOCATIONS, RISKS, SPECIALTIES, VISIONS, modelOf,
  type Profile, type Simple,
} from "@/lib/salon-simple";
import type { LucideIcon } from "lucide-react";

const card = "rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]";
const input = "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)]";
const GOOD = "#16A34A", BAD = "#DC2626";
const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
const numOrNull = (v: string) => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null);

type Patch = (p: Partial<Simple>) => void;
const usePf = (s: Simple, patch: Patch) => {
  const pf: Profile = { ...DEFAULT_PROFILE, ...s.profile };
  return { pf, set: (p: Partial<Profile>) => patch({ profile: { ...pf, ...p } }) };
};

function Section({ icon: Icon, title, lead, children }: { icon: LucideIcon; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}><Icon size={15} /></span>
        <div className="min-w-0">
          <div className="text-base font-black text-[var(--ink)]">{title}</div>
          {lead && <div className="text-[11px] text-[var(--muted)]">{lead}</div>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">{label}</span>
      {children}
    </div>
  );
}

function Chips<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(on ? null : o.id)} aria-pressed={on} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
            style={on ? { borderColor: "var(--acc)", color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Multi({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} aria-pressed={on} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
            style={on ? { borderColor: "var(--acc)", color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
            {on ? "✓ " : ""}{o}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] px-3 py-2">
      <span className="min-w-0 flex-1 text-xs text-[var(--body)]">{label}</span>
      <div className="flex shrink-0 gap-1" role="group" aria-label={label}>
        {([[true, "نعم", GOOD], [false, "لا", BAD]] as const).map(([v, l, c]) => (
          <button key={l} type="button" onClick={() => onChange(v)} className="rounded-full border px-2.5 py-1 text-[11px] font-black"
            style={value === v ? { borderColor: c, color: c, background: `color-mix(in srgb, ${c} 12%, transparent)` } : { borderColor: "var(--line)", color: "var(--faint)" }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function Num({ label, value, onChange, unit, hint }: { label: string; value: number | null; onChange: (v: number | null) => void; unit?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" inputMode="decimal" min={0} value={value ?? ""} onChange={(e) => onChange(numOrNull(e.target.value))} className={`${input} !py-1.5`} placeholder="—" />
        {unit && <span className="shrink-0 text-[10px] text-[var(--faint)]">{unit}</span>}
      </div>
      {hint && <span className="mt-0.5 block text-[10px] text-[var(--faint)]">{hint}</span>}
    </label>
  );
}

function Text({ label, value, onChange, placeholder, rows }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">{label}</span>
      {rows ? <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${input} resize-y`} />
        : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={input} />}
    </label>
  );
}

/* ─── الأجزاء ─── */

/** المجال والموقع والمساحة وعمر النشاط. */
export function ProfileBasics({ s, patch }: { s: Simple; patch: Patch }) {
  const { pf, set } = usePf(s, patch);
  return (
    <Section icon={Building2} title="المنشأة" lead="التخصص والموقع والمساحة — تحدد وين نركّز (قوقل والمارّة، أو السوشال)">
      <Group label="التخصص والأقسام"><Multi options={SPECIALTIES} value={pf.specialties} onChange={(specialties) => set({ specialties })} /></Group>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Text label="المدينة" value={pf.city} onChange={(city) => set({ city })} />
        <Text label="الحي" value={pf.district} onChange={(district) => set({ district })} />
        <Num label={s.model === "salon" ? "عدد الكراسي أو الغرف" : "أماكن الخدمة في نفس الوقت"} value={pf.seats} onChange={(seats) => set({ seats })} />
      </div>
      <Group label="نوع الموقع"><Chips options={LOCATIONS} value={pf.location} onChange={(location) => set({ location })} /></Group>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Num label="عمر النشاط" value={pf.age_years} onChange={(age_years) => set({ age_years })} unit="سنة" />
        <Group label="المرحلة"><Chips options={[{ id: "new", label: "جديد" }, { id: "stable", label: "مستقر" }, { id: "declining", label: "متراجع" }] as const} value={pf.stage} onChange={(stage) => set({ stage })} /></Group>
        <Group label="اتجاه الدخل آخر ٦ شهور"><Chips options={[{ id: "up", label: "يزيد" }, { id: "flat", label: "ثابت" }, { id: "down", label: "ينزل" }] as const} value={pf.trend} onChange={(trend) => set({ trend })} /></Group>
      </div>
    </Section>
  );
}

/** الهدف والرؤية والفريق ومين يدير، والخبرة والوضع النظامي. */
export function ProfileGoalTeam({ s, patch }: { s: Simple; patch: Patch }) {
  const { pf, set } = usePf(s, patch);
  return (
    <div className="space-y-4">
      <Section icon={Target} title="الهدف والرؤية" lead="الهدف يرتّب التوصيات — ليش جات لنا، ووين تبي توصل؟">
        <Group label="هدفها الأول من التطوير"><Chips options={GOALS} value={pf.goal} onChange={(goal) => set({ goal })} /></Group>
        <Text label="الرقم المستهدف والمدة" value={pf.goal_target} onChange={(goal_target) => set({ goal_target })} placeholder="مثال: دخل ٣٠ ألف شهرياً خلال ٦ شهور" />
        <Group label="رؤيتها بعد سنة"><Chips options={VISIONS} value={pf.vision} onChange={(vision) => set({ vision })} /></Group>
        <Text label="تفاصيل الرؤية" value={pf.vision_note} onChange={(vision_note) => set({ vision_note })} />
      </Section>
      <Section icon={Users} title="الفريق والإدارة" lead="مين يدير ووقته يحدد حجم خطة الشهر (٣ أو ٥ أو ٧ إجراءات)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Num label="الخبيرات" value={pf.staff_experts} onChange={(staff_experts) => set({ staff_experts })} />
          <Num label="استقبال وإدارة" value={pf.staff_admin} onChange={(staff_admin) => set({ staff_admin })} />
          <Num label="سنوات خبرة الإدارة" value={pf.experience_years} onChange={(experience_years) => set({ experience_years })} unit="سنة" />
          <Num label="ساعات المالكة للتطوير بالأسبوع" value={pf.owner_hours_week} onChange={(owner_hours_week) => set({ owner_hours_week })} unit="ساعة" />
        </div>
        <Group label="مين يدير اليوم"><Chips options={[{ id: "owner", label: "المالكة نفسها" }, { id: "manager", label: "مديرة" }, { id: "none", label: "ما فيه أحد" }] as const} value={pf.manager} onChange={(manager) => set({ manager })} /></Group>
        <Group label="طريقة الدفع للخبيرات"><Chips options={[{ id: "salary", label: "راتب" }, { id: "commission", label: "عمولة" }, { id: "mixed", label: "راتب + عمولة" }] as const} value={pf.pay} onChange={(pay) => set({ pay })} /></Group>
        <YesNo label="المالكة أو المديرة أخذت تدريب إداري" value={pf.trained} onChange={(trained) => set({ trained })} />
      </Section>
      <Section icon={Building2} title="الوضع النظامي" lead="تأكدي من المتطلبات الحالية في منصة «بلدي»">
        <Group label="التسجيل"><Chips options={[{ id: "cr", label: "سجل تجاري" }, { id: "freelance", label: "وثيقة عمل حر" }, { id: "none", label: "بدون" }] as const} value={pf.legal_reg} onChange={(legal_reg) => set({ legal_reg })} /></Group>
        <YesNo label="رخصة بلدية سارية" value={pf.legal_municipal} onChange={(legal_municipal) => set({ legal_municipal })} />
        <YesNo label="شهادات صحية للعاملات" value={pf.legal_health} onChange={(legal_health) => set({ legal_health })} />
      </Section>
    </div>
  );
}

/** الالتزامات وميزانية التطوير. */
export function ProfileFinance({ s, patch }: { s: Simple; patch: Patch }) {
  const { pf, set } = usePf(s, patch);
  return (
    <Section icon={Wallet} title="الوضع المالي" lead="الميزانية تحدد نوع التوصيات — بدون ميزانية ما نقترح إعلانات ممولة">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Num label="ديون أو أقساط شهرية" value={pf.debt_monthly} onChange={(debt_monthly) => set({ debt_monthly })} unit="ر.س" />
        <Num label="ميزانية التطوير والتسويق المتاحة شهرياً" value={pf.budget_month} onChange={(budget_month) => set({ budget_month })} unit="ر.س" hint="اكتبي ٠ لو ما فيه ميزانية" />
      </div>
    </Section>
  );
}

/** آراء العميلات وقنوات التسويق. */
export function ProfileVoice({ s, patch }: { s: Simple; patch: Patch }) {
  const { pf, set } = usePf(s, patch);
  return (
    <Section icon={MessageSquareQuote} title="آراء العميلات والتسويق الحالي" lead="الشكوى المتكررة تصير إجراء في الشهر الأول">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Text label="أكثر شي يمدحونه" value={pf.praise} onChange={(praise) => set({ praise })} placeholder="مثال: نتيجة الصبغة والأسلوب" />
        <Text label="أكثر شكوى تتكرر" value={pf.complaint} onChange={(complaint) => set({ complaint })} placeholder="مثال: الانتظار رغم الموعد" />
      </div>
      <Group label="قنوات التسويق المستخدمة"><Multi options={CHANNELS} value={pf.channels} onChange={(channels) => set({ channels })} /></Group>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Num label="الصرف على التسويق شهرياً" value={pf.marketing_spend} onChange={(marketing_spend) => set({ marketing_spend })} unit="ر.س" />
        <Text label="وش جاب نتيجة ووش ما جاب" value={pf.worked} onChange={(worked) => set({ worked })} />
      </div>
    </Section>
  );
}

/** المخاطر الحالية. */
export function ProfileRisks({ s, patch }: { s: Simple; patch: Patch }) {
  const { pf, set } = usePf(s, patch);
  return (
    <Section icon={AlertTriangle} title="المخاطر الحالية" lead="علّمي اللي ينطبق — كل خطر يصير إجراء، والعالي منها يدخل أهم التوصيات">
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {RISKS.map((r) => {
          const on = !!pf.risks[r.id];
          return (
            <li key={r.id}>
              <button type="button" onClick={() => set({ risks: { ...pf.risks, [r.id]: !on } })} aria-pressed={on}
                className="flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-right text-xs font-bold transition-colors"
                style={on ? { borderColor: BAD, color: BAD, background: `color-mix(in srgb, ${BAD} 7%, transparent)` } : { borderColor: "var(--line)", color: "var(--body)" }}>
                <AlertTriangle size={13} className="shrink-0" style={{ color: on ? BAD : "var(--faint)" }} />
                <span className="flex-1">{r.label}</span>
                {r.high && <span className="shrink-0 text-[10px] font-black" style={{ color: on ? BAD : "var(--faint)" }}>عالي</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/** ملخص الملف (للتبويب والتقرير). */
export function profileLines(s: Simple): string[] {
  const pf: Profile = { ...DEFAULT_PROFILE, ...s.profile };
  const out: string[] = [];
  const goal = GOALS.find((g) => g.id === pf.goal)?.label;
  const vision = VISIONS.find((v) => v.id === pf.vision)?.label;
  if (goal) out.push(`الهدف: ${goal}${pf.goal_target ? ` — ${pf.goal_target}` : ""}`);
  if (vision) out.push(`الرؤية بعد سنة: ${vision}${pf.vision_note ? ` (${pf.vision_note})` : ""}`);
  const where = [pf.district, pf.city].filter(Boolean).join("، ");
  const loc = LOCATIONS.find((l) => l.id === pf.location)?.label;
  if (where || loc) out.push(`الموقع: ${[where, loc].filter(Boolean).join(" — ")}`);
  if (pf.specialties.length) out.push(`التخصص: ${pf.specialties.join("، ")}`);
  const team = [pf.staff_experts !== null ? `${fmt(pf.staff_experts)} خبيرة` : "", pf.staff_admin !== null ? `${fmt(pf.staff_admin)} إدارة واستقبال` : ""].filter(Boolean).join(" + ");
  if (team) out.push(`الفريق: ${team}`);
  if (pf.age_years !== null) out.push(`عمر النشاط: ${fmt(pf.age_years)} سنة${pf.trend ? `، الدخل ${{ up: "يزيد", flat: "ثابت", down: "ينزل" }[pf.trend]}` : ""}`);
  const risks = RISKS.filter((r) => pf.risks[r.id]).map((r) => r.label);
  if (risks.length) out.push(`المخاطر: ${risks.join("، ")}`);
  if (pf.complaint) out.push(`أكثر شكوى: ${pf.complaint}`);
  if (pf.praise) out.push(`أكثر مديح: ${pf.praise}`);
  return out;
}

/** تبويب «ملف المنشأة»: كل الأجزاء مع ملخص. */
export function ProfileTab({ s, patch }: { s: Simple; patch: Patch }) {
  const lines = profileLines(s);
  const model = modelOf(s.model);
  return (
    <div className="space-y-4">
      <div className={`${card} p-4 sm:p-5`}>
        <div className="text-base font-black text-[var(--ink)]">ملخص المنشأة{model ? ` — ${model.label}` : ""}</div>
        {lines.length ? <ul className="mt-2 space-y-1 text-sm text-[var(--body)]">{lines.map((l) => <li key={l}>• {l}</li>)}</ul>
          : <p className="mt-2 text-sm text-[var(--muted)]">عبّي الأجزاء تحت — أو من «مراجعة الجلسة».</p>}
      </div>
      <ProfileGoalTeam s={s} patch={patch} />
      <ProfileBasics s={s} patch={patch} />
      <ProfileFinance s={s} patch={patch} />
      <ProfileVoice s={s} patch={patch} />
      <ProfileRisks s={s} patch={patch} />
    </div>
  );
}
