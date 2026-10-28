"use client";

// «التسويق الرقمي والحملات»: جاهزية الحملات بالترتيب (قوقل ← الحسابات ← الإعلان)، سجل الحملات
// بمؤشراتها وحكم لكل حملة، ودليل المحتوى. نفس الشاشة في «الخطة التسويقية للصالونات» وفي بطاقة كل
// صالون في «إدارة مستشاري الصالونات» — كل شاشة تمرّر بياناتها (m) ودالة الحفظ (set).

import React, { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Megaphone, MapPin, Instagram, Rocket, Plus, ChevronDown, Trash2, Copy, Check, CalendarDays, TriangleAlert, Lightbulb } from "lucide-react";
import {
  CAMPAIGN_STATUSES, CONTENT_SEASONS, CONTENT_WEEK, PLATFORMS, READINESS, READINESS_COUNT, SAUDI_NOTES,
  campaignMetrics, campaignStatus, campaignVerdict, marketingTotals, newCampaign, platformOf,
  type Campaign, type Marketing,
} from "@/lib/salon-campaigns";

const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (n: number, digits = 0) => n.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
const money = (n: number | null) => (n === null ? "—" : `${fmt(n)} ر.س`);
const pct = (n: number | null) => (n === null ? "—" : `${fmt(n * 100)}٪`);
const times = (n: number | null) => (n === null ? "—" : `${fmt(n, 1)}×`);
const GOOD = "#16A34A";

const card = "rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--body)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-[var(--on-acc)] transition-all hover:-translate-y-0.5";
const accGrad = { background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" };
const input =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)]";

const rid = () => Math.random().toString(36).slice(2, 10);
const numOrNull = (v: string) => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : null);

export default function CampaignsView({ m, set, salonName, copy, compact = false }: {
  m: Marketing; set: (m: Marketing) => void; salonName: string; copy: (text: string, msg?: string) => void; compact?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const t = marketingTotals(m.campaigns);
  const doneCount = READINESS.reduce((s, p) => s + p.items.filter((i) => m.readiness[i.id]).length, 0);
  const adsPhase = READINESS[2];
  const adsReady = adsPhase.items.every((i) => m.readiness[i.id]);

  const patchCampaign = (id: string, patch: Partial<Campaign>) => set({ ...m, campaigns: m.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const addCampaign = () => {
    const c = newCampaign(rid());
    set({ ...m, campaigns: [c, ...m.campaigns] });
    setOpenId(c.id);
  };

  const report = () => {
    const lines = [`📣 تقرير الحملات${salonName ? ` — ${salonName}` : ""}`, ""];
    lines.push(`الصرف: ${money(t.spend)} · الحجوزات: ${fmt(t.bookings)} · تكلفة الحجز: ${money(t.cpb)} · العائد: ${times(t.roas)} · العودة: ${pct(t.returnRate)}`);
    m.campaigns.filter((c) => c.status !== "draft").forEach((c) => {
      const x = campaignMetrics(c);
      const v = campaignVerdict(c);
      lines.push("", `• ${c.name || "حملة"} (${platformOf(c.platform).label} — ${campaignStatus(c.status).label})`);
      lines.push(`  صرف ${money(c.spend)}، ${fmt(c.bookings ?? 0)} حجز، تكلفة الحجز ${money(x.cpb)}، العائد ${times(x.roas)}`);
      if (v) lines.push(`  ← ${v.label}: ${v.why}`);
    });
    return lines.join("\n");
  };

  return (
    <div className="space-y-5">
      {/* ─── الملخص ─── */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}><Megaphone size={17} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-[var(--ink)]">التسويق الرقمي والحملات</h3>
            <p className="text-xs text-[var(--muted)]">الإعلان يجيب العميلة — والربح لما ترجع. نقيس تكلفة الحجز، مو الإعجابات.</p>
          </div>
          {m.campaigns.some((c) => c.status !== "draft") && <button onClick={() => copy(report(), "تم نسخ تقرير الحملات")} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><Copy size={13} /> نسخ التقرير</button>}
        </div>
        <div className={`mt-4 grid grid-cols-2 gap-2 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-3 lg:grid-cols-6"}`}>
          <Stat label="حملات شغّالة" value={fmt(t.live)} />
          <Stat label="الصرف" value={money(t.spend)} />
          <Stat label="الحجوزات" value={fmt(t.bookings)} />
          <Stat label="تكلفة الحجز" value={money(t.cpb)} />
          <Stat label="العائد على الإعلان" value={times(t.roas)} tone={t.roas === null ? undefined : t.roas >= 1 ? GOOD : "#DC2626"} />
          <Stat label="رجعن لزيارة ثانية" value={pct(t.returnRate)} />
        </div>
      </div>

      {/* ─── الجاهزية ─── */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-base font-black text-[var(--ink)]">جاهزية الحملات — بالترتيب</h3>
          <span className="text-xs font-bold text-[var(--muted)]">{fmt(doneCount)} من {fmt(READINESS_COUNT)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / READINESS_COUNT) * 100}%`, ...accGrad }} /></div>
        <div className={`mt-4 grid grid-cols-1 gap-3 ${compact ? "" : "lg:grid-cols-3"}`}>
          {READINESS.map((p, i) => {
            const Icon: LucideIcon = [MapPin, Instagram, Rocket][i];
            const n = p.items.filter((x) => m.readiness[x.id]).length;
            return (
              <div key={p.id} className="rounded-2xl border border-[var(--line)] p-3">
                <div className="flex items-center gap-2">
                  <Icon size={15} className="shrink-0 text-[var(--acc)]" />
                  <span className="flex-1 text-sm font-black text-[var(--ink)]">{p.title}</span>
                  <span className="text-[11px] font-bold" style={{ color: n === p.items.length ? GOOD : "var(--faint)" }}>{fmt(n)}/{fmt(p.items.length)}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{p.lead}</p>
                <ul className="mt-2 space-y-1.5">
                  {p.items.map((x) => {
                    const on = !!m.readiness[x.id];
                    return (
                      <li key={x.id}>
                        <button onClick={() => set({ ...m, readiness: { ...m.readiness, [x.id]: !on } })} className="flex w-full items-start gap-2 rounded-xl px-1.5 py-1 text-right hover:bg-[var(--hover)]">
                          <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border-2" style={on ? { background: GOOD, borderColor: GOOD, color: "#fff" } : { borderColor: "var(--line-strong)" }}>{on && <Check size={10} />}</span>
                          <span className={`text-xs leading-relaxed ${on ? "text-[var(--faint)] line-through" : "text-[var(--body)]"}`}>{x.text}</span>
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

      {/* ─── سجل الحملات ─── */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-base font-black text-[var(--ink)]">سجل الحملات</h3>
          <button onClick={addCampaign} className={`${btnPrimary} !px-4 !py-2 text-xs`} style={accGrad}><Plus size={14} /> حملة جديدة</button>
        </div>
        {!adsReady && (
          <div className="mb-3 flex items-start gap-2 rounded-2xl p-3 text-xs leading-relaxed" style={{ background: "color-mix(in srgb, #D9A21B 10%, transparent)", color: "var(--body)" }}>
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <span>«جاهزية الإعلان» ما اكتملت — ننصح بتجربة صغيرة بس (شهر، ٣ إعلانات) لين تكتمل، عشان ما يروح الصرف على عميلات ما يرجعن.</span>
          </div>
        )}
        {m.campaigns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--line-strong)] p-6 text-center text-sm text-[var(--muted)]">ما فيه حملات بعد. ابدئي بتجربة صغيرة: دائرة ٣–٥ كم، هدف «رسالة واتساب أو حجز»، و٣ إعلانات من شغل حقيقي.</p>
        ) : (
          <ul className="space-y-2">
            {m.campaigns.map((c) => <CampaignRow key={c.id} c={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)}
              onPatch={(p) => patchCampaign(c.id, p)} onDelete={() => { if (confirm(`حذف «${c.name || "الحملة"}»؟`)) set({ ...m, campaigns: m.campaigns.filter((x) => x.id !== c.id) }); }} />)}
          </ul>
        )}
      </div>

      {/* ─── دليل المحتوى ─── */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Lightbulb size={16} className="text-[var(--acc)]" />
          <h3 className="flex-1 text-base font-black text-[var(--ink)]">دليل المحتوى</h3>
          <button onClick={() => copy([`🗓️ خطة المحتوى الأسبوعية${salonName ? ` — ${salonName}` : ""}`, ...CONTENT_WEEK.map((w) => `• ${w.day}: ${w.type} — ${w.idea}`)].join("\n"), "تم نسخ خطة الأسبوع")}
            className={`${btnGhost} !px-3 !py-1.5 text-xs`}><Copy size={13} /> نسخ خطة الأسبوع</button>
        </div>
        <div className={`grid grid-cols-1 gap-3 ${compact ? "" : "lg:grid-cols-[1.3fr_1fr]"}`}>
          <ul className="space-y-1.5">
            {CONTENT_WEEK.map((w) => (
              <li key={w.day} className="flex gap-3 rounded-2xl bg-[var(--surface-2)] p-3">
                <span className="w-14 shrink-0 text-xs font-black text-[var(--acc)]">{w.day}</span>
                <span className="min-w-0 text-xs leading-relaxed text-[var(--body)]"><b className="text-[var(--ink)]">{w.type}:</b> {w.idea}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-black text-[var(--ink)]"><CalendarDays size={13} /> مواسم السنة</div>
              <ul className="space-y-1">{CONTENT_SEASONS.map((x) => <li key={x.when} className="text-xs leading-relaxed text-[var(--body)]"><b>{x.when}:</b> {x.idea}</li>)}</ul>
            </div>
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <div className="mb-1 text-xs font-black text-[var(--ink)]">تنبيهات في السعودية</div>
              <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-[var(--muted)]">{SAUDI_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-2)] px-3 py-2.5">
      <div className="text-[11px] font-bold text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 text-base font-black" style={{ color: tone ?? "var(--ink)" }}>{value}</div>
    </div>
  );
}

function CampaignRow({ c, open, onToggle, onPatch, onDelete }: {
  c: Campaign; open: boolean; onToggle: () => void; onPatch: (p: Partial<Campaign>) => void; onDelete: () => void;
}) {
  const p = platformOf(c.platform);
  const st = campaignStatus(c.status);
  const x = campaignMetrics(c);
  const v = campaignVerdict(c);
  const num = (k: keyof Pick<Campaign, "budget" | "spend" | "leads" | "bookings" | "showed" | "revenue" | "returned">, label: string, unit?: string) => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" inputMode="decimal" min={0} value={c[k] ?? ""} onChange={(e) => onPatch({ [k]: numOrNull(e.target.value) })} className={`${input} !py-1.5`} placeholder="—" />
        {unit && <span className="shrink-0 text-[10px] text-[var(--faint)]">{unit}</span>}
      </div>
    </label>
  );
  return (
    <li className="rounded-2xl border border-[var(--line)]">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 p-3 text-right">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: p.color, color: p.ink }}>{p.label}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--ink)]">{c.name || "حملة بدون اسم"}</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 12%, transparent)` }}>{st.label}</span>
        {v && <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color: v.color, background: `color-mix(in srgb, ${v.color} 12%, transparent)` }}>{v.label}</span>}
        <span className="hidden text-[11px] font-bold text-[var(--muted)] sm:inline">حجز بـ {money(x.cpb)} · عائد {times(x.roas)}</span>
        <ChevronDown size={15} className={`shrink-0 text-[var(--faint)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--line)] p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">اسم الحملة</span>
              <input value={c.name} onChange={(e) => onPatch({ name: e.target.value })} className={input} placeholder="مثال: تجربة أول زيارة — صبغة" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">العرض</span>
              <input value={c.offer} onChange={(e) => onPatch({ offer: e.target.value })} className={input} placeholder="تجربة أول زيارة / إضافة مجانية" />
            </label>
          </div>
          <div role="group" aria-label="المنصة">
            <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">المنصة</span>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((x) => (
                <button key={x.id} onClick={() => onPatch({ platform: x.id })} className="rounded-full px-3 py-1 text-xs font-bold"
                  style={c.platform === x.id ? { background: x.color, color: x.ink } : { border: "1px solid var(--line)", color: "var(--muted)" }}>{x.label}</button>
              ))}
            </div>
          </div>
          <div role="group" aria-label="الحالة">
            <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">الحالة</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {CAMPAIGN_STATUSES.map((s) => (
                <button key={s.id} onClick={() => onPatch({ status: s.id })} className="rounded-xl border px-2 py-1.5 text-xs font-bold"
                  style={c.status === s.id ? { borderColor: s.color, color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">الجمهور</span>
              <input value={c.audience} onChange={(e) => onPatch({ audience: e.target.value })} className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">البداية</span>
              <input type="date" value={c.start} onChange={(e) => onPatch({ start: e.target.value })} className={input} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">النهاية</span>
              <input type="date" value={c.end} onChange={(e) => onPatch({ end: e.target.value })} className={input} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {num("budget", "الميزانية", "ر.س")}
            {num("spend", "الصرف الفعلي", "ر.س")}
            {num("leads", "رسائل / مهتمات")}
            {num("bookings", "حجوزات")}
            {num("showed", "حضرن")}
            {num("revenue", "دخل أول زيارة", "ر.س")}
            {num("returned", "رجعن لزيارة ثانية")}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="تكلفة الرسالة" value={money(x.cpl)} />
            <Stat label="تكلفة الحجز" value={money(x.cpb)} />
            <Stat label="نسبة الحضور" value={pct(x.showRate)} />
            <Stat label="العائد" value={times(x.roas)} tone={x.roas === null ? undefined : x.roas >= 1 ? GOOD : "#DC2626"} />
            <Stat label="العودة" value={pct(x.returnRate)} />
          </div>
          {v && <p className="rounded-2xl p-3 text-xs font-bold" style={{ color: v.color, background: `color-mix(in srgb, ${v.color} 9%, transparent)` }}>{v.label} — {v.why}</p>}
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-[var(--muted)]">ملاحظات (وش جرّبنا، وش نجح)</span>
            <textarea value={c.notes} onChange={(e) => onPatch({ notes: e.target.value })} rows={2} className={`${input} resize-y`} />
          </label>
          <div className="flex justify-end">
            <button onClick={onDelete} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50/60"><Trash2 size={13} /> حذف الحملة</button>
          </div>
        </div>
      )}
    </li>
  );
}
