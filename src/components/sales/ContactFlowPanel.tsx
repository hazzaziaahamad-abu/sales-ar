"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { getEditableContent, saveEditableContent } from "@/lib/supabase/db";
import {
  Phone,
  MessageCircle,
  Copy,
  Check,
  CalendarClock,
  Handshake,
  CheckCircle2,
  Rocket,
  Heart,
  Headset,
  Send,
  Target,
  Lightbulb,
  Sparkles,
  Star,
  Gift,
  Puzzle,
  Pencil,
  Save,
  RotateCcw,
  X,
  ThumbsUp,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

/* ---------- brand tokens (مطابقة للخرائط) ---------- */
const INK = "#40332b";
const PURPLE = "#6D28D9";
const PURPLE_DEEP = "#5B21B6";
const GOLD = "#F5B301";

/* ---------- الأنواع العامة ---------- */
export type CFStep = {
  n: string;
  title: string;
  goal: string;
  call: string;
  wa: string;
  tip: string;
  callBadge?: boolean;
};
export type CFLoyalty = {
  title: string;
  tagline: string;
  pkg: string;
  why: string;
  bullets: string[];
  call: string;
  wa: string;
  objection: { q: string; a: string };
};
export type CFTier = { name: string; chip: string; priceText: string };

type Stored = { steps?: CFStep[]; loyalty?: CFLoyalty; interestedSteps?: CFStep[] };

type Scenario = "first" | "interested";

// أيقونات خطوات «أول تواصل» بالترتيب الثابت (٨ خطوات) — لا تُخزَّن، تُطابَق بالفهرس.
const STEP_ICONS = [Handshake, Headset, MessageCircle, CalendarClock, Puzzle, Heart, CheckCircle2, Rocket];

// أيقونات خطوات «عميل مهتم» بالترتيب الثابت (٧ خطوات) — تُطابَق بالفهرس.
const STEP_ICONS_INTEREST = [ThumbsUp, Target, Puzzle, Gift, ShieldCheck, CheckCircle2, Rocket];

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

// دمج المحتوى المحفوظ فوق الافتراضي مع تثبيت الترقيم من الافتراضي.
function mergeSteps(def: CFStep[], stored: CFStep[]): CFStep[] {
  return def.map((d, i) => ({ ...d, ...(stored[i] || {}), n: d.n }));
}

/* ---------- حقل تحرير صغير ---------- */
function Field({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-right">
      <span className="mb-1 block text-[11px] font-black" style={{ color: PURPLE_DEEP }}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        dir="rtl"
        className="w-full rounded-lg px-2.5 py-1.5 text-right text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
        style={{ backgroundColor: "#fff", border: "1px solid #e2d3c3", color: INK, resize: "vertical" }}
      />
    </label>
  );
}

/* ---------- المكوّن الرئيسي ---------- */
export default function ContactFlowPanel({
  storageKey,
  tiers,
  defaultSteps,
  defaultLoyalty,
  defaultInterestedSteps,
}: {
  storageKey: string;
  tiers: CFTier[];
  defaultSteps: CFStep[];
  defaultLoyalty: CFLoyalty;
  /** مسار «العميل المهتم» (اختياري) — يظهر مبدّل السيناريو عند تمريره. */
  defaultInterestedSteps?: CFStep[];
}) {
  const { user, isImpersonating } = useAuth();
  const canEdit = !!user?.isSuperAdmin && !isImpersonating;
  const hasInterested = Array.isArray(defaultInterestedSteps) && defaultInterestedSteps.length > 0;

  const [scenario, setScenario] = useState<Scenario>("first");
  const [channel, setChannel] = useState<"call" | "wa">("call");
  const [copied, setCopied] = useState<number | null>(null);
  const [pkg, setPkg] = useState<CFTier | null>(null);
  const [phone, setPhone] = useState("");
  const isWa = channel === "wa";

  // المحتوى المعروض (افتراضي ثم يُستبدل بالمحفوظ عند التحميل)
  const [steps, setSteps] = useState<CFStep[]>(defaultSteps);
  const [iSteps, setISteps] = useState<CFStep[]>(defaultInterestedSteps || []);
  const [loyalty, setLoyalty] = useState<CFLoyalty>(defaultLoyalty);

  // وضع التحرير (نسخة مسودّة)
  const [editing, setEditing] = useState(false);
  const [dSteps, setDSteps] = useState<CFStep[]>(defaultSteps);
  const [dISteps, setDISteps] = useState<CFStep[]>(defaultInterestedSteps || []);
  const [dLoyalty, setDLoyalty] = useState<CFLoyalty>(defaultLoyalty);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // تحميل المحتوى المحفوظ من قاعدة البيانات
  useEffect(() => {
    let alive = true;
    getEditableContent<Stored>(storageKey)
      .then((data) => {
        if (!alive || !data) return;
        if (Array.isArray(data.steps) && data.steps.length) setSteps(mergeSteps(defaultSteps, data.steps));
        if (hasInterested && Array.isArray(data.interestedSteps) && data.interestedSteps.length)
          setISteps(mergeSteps(defaultInterestedSteps!, data.interestedSteps));
        if (data.loyalty)
          setLoyalty({
            ...defaultLoyalty,
            ...data.loyalty,
            bullets: Array.isArray(data.loyalty.bullets) ? data.loyalty.bullets : defaultLoyalty.bullets,
            objection: { ...defaultLoyalty.objection, ...(data.loyalty.objection || {}) },
          });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const fill = useCallback(
    (t: string) => {
      if (!pkg) return t;
      return t.split("{الباقة}").join(pkg.name).split("{السعر}").join(pkg.priceText);
    },
    [pkg]
  );

  const waNumber = useCallback(() => {
    const d = phone.replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("966")) return d;
    if (d.startsWith("0")) return "966" + d.slice(1);
    if (d.startsWith("5") && d.length === 9) return "966" + d;
    return d;
  }, [phone]);

  const openWa = useCallback(
    (text: string) => {
      window.open(`https://wa.me/${waNumber()}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    },
    [waNumber]
  );

  const copy = useCallback(async (idx: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(idx);
      setTimeout(() => setCopied((c) => (c === idx ? null : c)), 1600);
    } catch {
      /* المتصفح ما يدعم النسخ — تجاهل بهدوء */
    }
  }, []);

  const startEdit = () => {
    setDSteps(clone(steps));
    setDISteps(clone(iSteps));
    setDLoyalty(clone(loyalty));
    setSavedMsg(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const payload: Stored = { steps: dSteps, loyalty: dLoyalty };
      if (hasInterested) payload.interestedSteps = dISteps;
      await saveEditableContent(storageKey, payload);
      setSteps(dSteps);
      setISteps(dISteps);
      setLoyalty(dLoyalty);
      setEditing(false);
      setSavedMsg("تم الحفظ ✓");
      setTimeout(() => setSavedMsg(null), 2500);
    } catch {
      setSavedMsg("تعذّر الحفظ — تأكّد من صلاحيتك واتصالك.");
    } finally {
      setSaving(false);
    }
  };

  // تحرير الخطوة في السيناريو النشط (أول تواصل / عميل مهتم).
  const updStep = (i: number, patch: Partial<CFStep>) => {
    const setter = scenario === "interested" ? setDISteps : setDSteps;
    setter((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  // الخطوات والأيقونات حسب السيناريو النشط.
  const viewSteps = scenario === "interested" ? iSteps : steps;
  const draftSteps = scenario === "interested" ? dISteps : dSteps;
  const activeIcons = scenario === "interested" ? STEP_ICONS_INTEREST : STEP_ICONS;

  return (
    <div
      className="mx-auto mt-8 max-w-3xl rounded-3xl p-5"
      style={{ backgroundColor: "#fffdf7", border: "1.5px solid #ead9c9", boxShadow: "0 12px 26px -16px rgba(64,51,43,.5)" }}
    >
      {/* رأس اللوحة + مبدّل القناة + زر التحرير */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: PURPLE }}>
            <Phone size={17} strokeWidth={2.3} />
          </span>
          <h3 className="text-base font-black" style={{ color: PURPLE_DEEP }}>
            مسار الاتصال والواتساب — خطوة بخطوة
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && !editing && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-violet-300"
              style={{ backgroundColor: PURPLE_DEEP }}
            >
              <Pencil size={13} strokeWidth={2.4} /> تعديل المحتوى
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-60"
                style={{ backgroundColor: "#059669" }}
              >
                <Save size={13} strokeWidth={2.4} /> {saving ? "جارٍ الحفظ…" : "حفظ"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold outline-none transition hover:opacity-80"
                style={{ backgroundColor: "rgba(64,51,43,.08)", color: INK }}
              >
                <X size={13} strokeWidth={2.4} /> إلغاء
              </button>
              <button
                onClick={() => {
                  setDSteps(clone(defaultSteps));
                  if (hasInterested) setDISteps(clone(defaultInterestedSteps!));
                  setDLoyalty(clone(defaultLoyalty));
                }}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold outline-none transition hover:opacity-80"
                style={{ backgroundColor: "rgba(64,51,43,.08)", color: INK }}
                title="استعادة النص الافتراضي في المسودّة"
              >
                <RotateCcw size={13} strokeWidth={2.4} /> الافتراضي
              </button>
            </>
          )}

          {!editing && (
            <div className="flex rounded-full p-1" style={{ backgroundColor: "#efe6dd" }}>
              {[
                { k: "call", t: "مكالمة", icon: <Phone size={13} strokeWidth={2.4} /> },
                { k: "wa", t: "واتساب", icon: <MessageCircle size={13} strokeWidth={2.4} /> },
              ].map((o) => {
                const on = channel === o.k;
                return (
                  <button
                    key={o.k}
                    onClick={() => setChannel(o.k as "call" | "wa")}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold outline-none transition focus-visible:ring-4 focus-visible:ring-violet-300"
                    style={{ backgroundColor: on ? PURPLE : "transparent", color: on ? "#fff" : "#7a6b5e" }}
                    aria-pressed={on}
                  >
                    {o.icon}
                    {o.t}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* مبدّل السيناريو: أول تواصل / عميل مهتم — يظهر عند توفّر مسار العميل المهتم */}
      {hasInterested && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex rounded-full p-1" style={{ backgroundColor: "#efe6dd" }}>
            {[
              { k: "first", t: "أول تواصل", icon: <Phone size={13} strokeWidth={2.4} /> },
              { k: "interested", t: "عميل مهتم", icon: <UserCheck size={13} strokeWidth={2.4} /> },
            ].map((o) => {
              const on = scenario === o.k;
              return (
                <button
                  key={o.k}
                  onClick={() => setScenario(o.k as Scenario)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold outline-none transition focus-visible:ring-4 focus-visible:ring-violet-300"
                  style={{ backgroundColor: on ? PURPLE_DEEP : "transparent", color: on ? "#fff" : "#7a6b5e" }}
                  aria-pressed={on}
                >
                  {o.icon}
                  {o.t}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] font-bold" style={{ color: "#8a7c70" }}>
            {scenario === "interested"
              ? "مسار سريع: العميل أبدى اهتمامه (بمكالمة أو رسالة) — حوّل حماسه إلى قرار."
              : "المسار الكامل من التحية حتى تأكيد موعد التنفيذ."}
          </span>
        </div>
      )}

      {savedMsg && (
        <div
          className="mb-3 rounded-lg px-3 py-1.5 text-right text-xs font-bold"
          style={{ backgroundColor: savedMsg.includes("تعذّر") ? "#FEE2E2" : "#DCFCE7", color: savedMsg.includes("تعذّر") ? "#991B1B" : "#065F46" }}
        >
          {savedMsg}
        </div>
      )}

      {editing ? (
        /* ============ وضع التحرير (للأدمن) ============ */
        <div className="space-y-4">
          <p className="text-right text-xs font-semibold leading-relaxed" style={{ color: "#8a7c70" }}>
            عدّل النصوص أدناه ثم اضغط «حفظ» — التعديلات تُحفظ في قاعدة البيانات ويشوفها جميع الموظفين.
            استخدم الأقواس {"{الباقة}"} و{"{السعر}"} ليتم تعبئتها تلقائياً.
          </p>

          {/* تحرير بطاقة الولاء */}
          <div className="rounded-2xl p-3" style={{ backgroundColor: "#FEF6DD", border: `1.5px solid ${GOLD}` }}>
            <div className="mb-2 flex items-center justify-end gap-1.5 text-xs font-black" style={{ color: "#92400E" }}>
              الميزة التسويقية البارزة (بطاقات الولاء/الهدايا)
              <Gift size={14} strokeWidth={2.3} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="العنوان" value={dLoyalty.title} onChange={(v) => setDLoyalty({ ...dLoyalty, title: v })} rows={1} />
              <Field label="الباقة" value={dLoyalty.pkg} onChange={(v) => setDLoyalty({ ...dLoyalty, pkg: v })} rows={1} />
            </div>
            <div className="mt-2">
              <Field label="الوسم (السطر الذهبي)" value={dLoyalty.tagline} onChange={(v) => setDLoyalty({ ...dLoyalty, tagline: v })} rows={1} />
            </div>
            <div className="mt-2">
              <Field label="لماذا تركّز عليها" value={dLoyalty.why} onChange={(v) => setDLoyalty({ ...dLoyalty, why: v })} rows={2} />
            </div>
            <div className="mt-2">
              <Field
                label="النقاط البيعية (سطر لكل نقطة)"
                value={dLoyalty.bullets.join("\n")}
                onChange={(v) => setDLoyalty({ ...dLoyalty, bullets: v.split("\n") })}
                rows={3}
              />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Field label="سكربت المكالمة" value={dLoyalty.call} onChange={(v) => setDLoyalty({ ...dLoyalty, call: v })} rows={4} />
              <Field label="رسالة الواتساب" value={dLoyalty.wa} onChange={(v) => setDLoyalty({ ...dLoyalty, wa: v })} rows={4} />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Field label="الاعتراض" value={dLoyalty.objection.q} onChange={(v) => setDLoyalty({ ...dLoyalty, objection: { ...dLoyalty.objection, q: v } })} rows={2} />
              <Field label="الرد" value={dLoyalty.objection.a} onChange={(v) => setDLoyalty({ ...dLoyalty, objection: { ...dLoyalty.objection, a: v } })} rows={2} />
            </div>
          </div>

          {/* تحرير الخطوات — للسيناريو النشط (بدّل من مبدّل «أول تواصل / عميل مهتم» بالأعلى) */}
          {hasInterested && (
            <p className="text-right text-xs font-black" style={{ color: PURPLE_DEEP }}>
              تُحرّر الآن خطوات: {scenario === "interested" ? "«عميل مهتم»" : "«أول تواصل»"}
            </p>
          )}
          {draftSteps.map((s, i) => (
            <div key={i} className="rounded-2xl p-3" style={{ backgroundColor: "#faf4ee", border: "1px solid #efe2d5" }}>
              <div className="mb-2 flex items-center justify-end gap-2 text-sm font-black" style={{ color: INK }}>
                الخطوة {s.n}
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white" style={{ backgroundColor: PURPLE_DEEP }}>
                  {s.n}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="العنوان" value={s.title} onChange={(v) => updStep(i, { title: v })} rows={1} />
                <Field label="الهدف" value={s.goal} onChange={(v) => updStep(i, { goal: v })} rows={2} />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="سكربت المكالمة" value={s.call} onChange={(v) => updStep(i, { call: v })} rows={3} />
                <Field label="رسالة الواتساب" value={s.wa} onChange={(v) => updStep(i, { wa: v })} rows={3} />
              </div>
              <div className="mt-2">
                <Field label="النصيحة" value={s.tip} onChange={(v) => updStep(i, { tip: v })} rows={2} />
              </div>
              <label className="mt-2 flex items-center justify-end gap-1.5 text-[11px] font-bold" style={{ color: "#075985" }}>
                إظهار وسم «مهم في المكالمة»
                <input type="checkbox" checked={!!s.callBadge} onChange={(e) => updStep(i, { callBadge: e.target.checked })} />
              </label>
            </div>
          ))}
        </div>
      ) : (
        /* ============ وضع العرض (للموظف) ============ */
        <>
          <p className="mb-3 text-right text-xs font-semibold leading-relaxed" style={{ color: "#8a7c70" }}>
            {scenario === "interested"
              ? "العميل ردّ وأبدى اهتمامه — امشِ على هذا التسلسل السريع لتثبيت اهتمامه وإغلاق الصفقة، سواء كان عبر مكالمة أو رسالة."
              : "تسلسل جاهز يمشي عليه الموظف من التحية حتى تأكيد موعد التنفيذ."}{" "}
            بدّل بين «مكالمة» و«واتساب» ليتغيّر السكربت، وانسخ الرسالة بضغطة. استبدل ما بين الأقواس {"{ }"} بمعلومات العميل.
          </p>

          {/* أدوات: اختيار الباقة + رقم واتساب العميل */}
          <div className="mb-4 rounded-2xl p-3" style={{ backgroundColor: "#faf4ee", border: "1px solid #efe2d5" }}>
            <div className="mb-2 flex items-center justify-end gap-1.5 text-xs font-black" style={{ color: PURPLE_DEEP }}>
              اختر الباقة لتعبئتها تلقائياً في السكربت
              <Target size={13} strokeWidth={2.3} style={{ color: PURPLE }} />
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {tiers.map((t) => {
                const on = pkg?.name === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => setPkg(on ? null : t)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-violet-300"
                    style={{ backgroundColor: on ? PURPLE : "#fff", color: on ? "#fff" : INK, border: `1px solid ${on ? PURPLE : "#e2d3c3"}` }}
                    aria-pressed={on}
                  >
                    {on && <Check size={11} strokeWidth={2.8} />}
                    {t.chip}
                  </button>
                );
              })}
            </div>

            {isWa && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="w-40 rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
                  style={{ backgroundColor: "#fff", border: "1px solid #A7D7B9", color: INK }}
                  aria-label="رقم واتساب العميل"
                />
                <span className="flex items-center gap-1 text-xs font-black" style={{ color: "#065F46" }}>
                  رقم واتساب العميل (اختياري)
                  <MessageCircle size={13} strokeWidth={2.4} />
                </span>
              </div>
            )}
          </div>

          {/* ميزة تسويقية بارزة — بطاقات الولاء/الهدايا */}
          <div
            className="mb-4 rounded-2xl p-4"
            style={{ backgroundColor: "#FEF6DD", border: `1.5px solid ${GOLD}`, boxShadow: "0 10px 22px -14px rgba(245,179,1,.6)" }}
          >
            <div className="mb-2 flex items-start justify-end gap-2">
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-sm font-black" style={{ color: INK }}>
                    {loyalty.title}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: GOLD, color: "#4a3410" }}>
                    {loyalty.pkg}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-black" style={{ color: "#92400E" }}>
                  {loyalty.tagline}
                  <Star size={11} fill={GOLD} stroke={GOLD} />
                </div>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: "#B45309" }}>
                <Gift size={22} strokeWidth={2.2} />
              </span>
            </div>

            <p className="mb-2 text-right text-xs font-bold leading-relaxed" style={{ color: "#7c2d12" }}>
              <span className="font-black">لماذا تركّز عليها: </span>
              {loyalty.why}
            </p>

            <ul className="mb-2.5 space-y-1.5">
              {loyalty.bullets.map((b, i) => (
                <li key={i} className="flex items-start justify-end gap-2 text-right text-xs leading-relaxed" style={{ color: "#5a4a40" }}>
                  <span>{b}</span>
                  <Star size={10} fill={GOLD} stroke={GOLD} className="mt-1 shrink-0" />
                </li>
              ))}
            </ul>

            <div
              className="rounded-xl p-3 text-right"
              style={{ backgroundColor: isWa ? "#EAF7EE" : "#fffdf7", border: `1px solid ${isWa ? "#A7D7B9" : "#f0d9a8"}` }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copy(999, isWa ? loyalty.wa : loyalty.call)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold outline-none transition hover:opacity-80 focus-visible:ring-4 focus-visible:ring-violet-300"
                    style={{ backgroundColor: copied === 999 ? "#DCFCE7" : "rgba(64,51,43,.06)", color: copied === 999 ? "#065F46" : INK }}
                  >
                    {copied === 999 ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />}
                    {copied === 999 ? "تم النسخ" : "نسخ"}
                  </button>
                  {isWa && (
                    <button
                      onClick={() => openWa(loyalty.wa)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-emerald-200"
                      style={{ backgroundColor: "#059669" }}
                    >
                      <Send size={12} strokeWidth={2.4} />
                      افتح واتساب
                    </button>
                  )}
                </div>
                <span className="flex items-center gap-1 text-[11px] font-black" style={{ color: isWa ? "#065F46" : "#92400E" }}>
                  {isWa ? "أرسل في الواتساب" : "قل في المكالمة"}
                  {isWa ? <MessageCircle size={12} strokeWidth={2.4} /> : <Phone size={12} strokeWidth={2.4} />}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm font-semibold leading-relaxed" style={{ color: INK }}>
                {isWa ? loyalty.wa : loyalty.call}
              </p>
            </div>

            <div className="mt-2 rounded-xl px-3 py-2 text-right" style={{ backgroundColor: "#fff", border: "1px solid #f0d9a8" }}>
              <p className="mb-0.5 text-xs font-bold" style={{ color: "#9f1239" }}>
                «{loyalty.objection.q}»
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#4a3f36" }}>
                {loyalty.objection.a}
              </p>
            </div>
          </div>

          {/* الخطوات كسلسلة عمودية مرقّمة */}
          <div className="relative space-y-2.5">
            <span className="pointer-events-none absolute bottom-6 top-6 w-0.5" style={{ right: 18, backgroundColor: "#ecd9c7" }} aria-hidden="true" />

            {viewSteps.map((s, i) => {
              const Icon = activeIcons[i] || Sparkles;
              const script = fill(isWa ? s.wa : s.call);
              const isCopied = copied === i;
              return (
                <div key={i} className="relative rounded-2xl p-3 pr-4" style={{ backgroundColor: "#faf4ee", border: "1px solid #efe2d5" }}>
                  <div className="mb-2 flex items-center justify-end gap-2">
                    <span className="text-sm font-black" style={{ color: INK }}>
                      {s.title}
                    </span>
                    {s.callBadge && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: "#E0F2FE", color: "#075985", border: "1px solid #BAE6FD" }}>
                        مهم في المكالمة
                      </span>
                    )}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: PURPLE }}>
                      <Icon size={16} strokeWidth={2.3} />
                    </span>
                    <span className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: PURPLE_DEEP, boxShadow: "0 0 0 3px #fffdf7" }}>
                      {s.n}
                    </span>
                  </div>

                  <div className="mb-2 flex items-start justify-end gap-2 px-1">
                    <p className="flex-1 text-right text-xs font-bold leading-relaxed" style={{ color: PURPLE_DEEP }}>
                      <span className="font-black">الهدف: </span>
                      {s.goal}
                    </p>
                    <Target size={13} strokeWidth={2.3} className="mt-0.5 shrink-0" style={{ color: PURPLE }} />
                  </div>

                  <div className="rounded-xl p-3 text-right" style={{ backgroundColor: isWa ? "#EAF7EE" : "#fffdf7", border: `1px solid ${isWa ? "#A7D7B9" : "#ead9c9"}` }}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => copy(i, script)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold outline-none transition hover:opacity-80 focus-visible:ring-4 focus-visible:ring-violet-300"
                          style={{ backgroundColor: isCopied ? "#DCFCE7" : "rgba(64,51,43,.06)", color: isCopied ? "#065F46" : INK }}
                        >
                          {isCopied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />}
                          {isCopied ? "تم النسخ" : "نسخ"}
                        </button>
                        {isWa && (
                          <button
                            onClick={() => openWa(script)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-emerald-200"
                            style={{ backgroundColor: "#059669" }}
                          >
                            <Send size={12} strokeWidth={2.4} />
                            افتح واتساب
                          </button>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-black" style={{ color: isWa ? "#065F46" : PURPLE_DEEP }}>
                        {isWa ? "أرسل في الواتساب" : "قل في المكالمة"}
                        {isWa ? <MessageCircle size={12} strokeWidth={2.4} /> : <Phone size={12} strokeWidth={2.4} />}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-sm font-semibold leading-relaxed" style={{ color: INK }}>
                      {script}
                    </p>
                  </div>

                  <div className="mt-2 flex items-start justify-end gap-2 px-1">
                    <p className="flex-1 text-right text-xs leading-relaxed" style={{ color: "#6f6156" }}>
                      <span className="font-black" style={{ color: "#B8860B" }}>نصيحة: </span>
                      {s.tip}
                    </p>
                    <Lightbulb size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" style={{ color: "#B8860B" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* تذييل: خطوة ما بعد المكالمة */}
          <div className="mt-3 flex items-start justify-end gap-2 rounded-xl px-3 py-2 text-right" style={{ backgroundColor: "#F4ECFB", border: "1px solid #D8C7EE" }}>
            <p className="flex-1 text-xs font-bold leading-relaxed" style={{ color: PURPLE_DEEP }}>
              بعد كل مكالمة: أرسل رسالة واتساب تلخّص الاتفاق (الباقة + السعر + موعد التنفيذ) مع «شارك صفحة العرض» بالأعلى — يثبّت القرار ويسهّل المتابعة.
            </p>
            <Sparkles size={14} strokeWidth={2.3} className="mt-0.5 shrink-0" style={{ color: PURPLE }} />
          </div>
        </>
      )}
    </div>
  );
}
