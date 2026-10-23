"use client";

// «جلسة تشخيص نمو الصالون» المجانية: الحجز بشروط تأهيل، تسجيل الجلسة وملخّصها، العرض خلال ٤٨ ساعة،
// وقياس التحويل مقابل نقطة التعادل (تكلفة الجلسة ÷ متوسط قيمة العقد).

import React, { useState } from "react";
import { Gift, CheckCircle2, Circle, Copy, Send, XCircle, CalendarDays, Clock, TriangleAlert, Sparkles, Undo2 } from "lucide-react";
import {
  QUALIFICATION, SESSION_NAME, SESSION_STATES, proposalDue, sessionState, weekStart,
  type FreeSession, type RoomClient, type Targets,
} from "@/lib/salon-room";
import { Badge, GOLD, SectionTitle, accGrad, btnGhost, btnPrimary, card, dateLabel, fmt, input, todayKey } from "./ui";

export const EMPTY_SESSION: FreeSession = {
  is_free: false, session_date: null, qual: {}, booked_at: null, booked_by: null, held_at: null,
  findings: ["", "", ""], quick_win: "", proposal_sent_at: null, declined: false,
};
export const sessionOf = (c: RoomClient): FreeSession => ({ ...EMPTY_SESSION, ...c.free_session, findings: [0, 1, 2].map((i) => c.free_session?.findings?.[i] ?? "") });
export const qualified = (f: Partial<FreeSession>) => QUALIFICATION.every((q) => f.qual?.[q.id]);

/* ──────────────────────────── الرسائل ──────────────────────────── */

export function inviteMessage(t: Targets, owner?: string | null) {
  return (
    `السلام عليكم${owner?.trim() ? ` ${owner.trim()}` : ""} 🌸\n` +
    `نقدّم لعدد محدود من الصالونات هذا الشهر جلسة «${SESSION_NAME}» — قيمتها ${fmt(t.session_value)} ريال، ومجاناً لصالونك.\n\n` +
    `في ٦٠ دقيقة داخل صالونك نطلع لك:\n• بطاقة خط أساس لأرقامك (الدخل، الفاتورة، عودة العميلات)\n• ٣ ملاحظات بالأرقام: وين يضيع دخلك\n• فرصة سريعة تقدرين تطبّقينها من بكرة\n\n` +
    `كل اللي نحتاجه: حضورك أنتِ، وأرقام المبيعات وقائمة العميلات قبلها بيوم.\nيناسبك نحجز موعد هالأسبوع؟`
  );
}

export function summaryMessage(c: RoomClient, f: FreeSession) {
  const findings = f.findings.map((x) => x.trim()).filter(Boolean);
  const due = proposalDue(f);
  return (
    `شكراً${c.owner_name?.trim() ? ` ${c.owner_name.trim()}` : ""} على وقتك اليوم 🤍\nملخص جلسة «${SESSION_NAME}» — ${c.salon_name}:\n` +
    (findings.length ? `\n📍 وين يضيع الدخل:\n${findings.map((x, i) => `${fmt(i + 1)}. ${x}`).join("\n")}\n` : "") +
    (f.quick_win.trim() ? `\n⚡ فرصة سريعة من بكرة: ${f.quick_win.trim()}\n` : "") +
    `\n📩 الخطوة الجاية: يوصلك العرض والخطة الكاملة${due ? ` قبل ${new Date(due).toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" })}` : " خلال ٤٨ ساعة"}.`
  );
}

/* ──────────────────────────── الحسابات ──────────────────────────── */

export function sessionMetrics(clients: RoomClient[], t: Targets, now: number) {
  const free = clients.filter((c) => c.free_session?.is_free);
  const held = free.filter((c) => c.free_session.held_at);
  const contracted = held.filter((c) => c.contracted_at);
  const decided = held.filter((c) => c.contracted_at || c.free_session.declined);
  const conversion = decided.length ? contracted.length / decided.length : null;
  const values = clients.filter((c) => c.contracted_at && c.contract_value).map((c) => c.contract_value!);
  const avgContract = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
  const breakEven = avgContract ? t.session_cost / avgContract : null;
  const from = weekStart(now);
  const thisWeek = free.filter((c) => c.free_session.booked_at && Date.parse(c.free_session.booked_at) >= from);
  const byConsultant = new Map<string, number>();
  thisWeek.forEach((c) => byConsultant.set(c.consultant ?? "—", (byConsultant.get(c.consultant ?? "—") ?? 0) + 1));
  const overdue = held.filter((c) => sessionState(c) === "held" && Date.parse(proposalDue(c.free_session)!) < now);
  return {
    booked: free.filter((c) => sessionState(c) === "booked").length,
    held: held.length, contracted: contracted.length, decided: decided.length,
    conversion, avgContract, breakEven, thisWeek: thisWeek.length, byConsultant, overdue,
    spend: held.length * t.session_cost,
    revenue: contracted.reduce((s, c) => s + (c.contract_value ?? 0), 0),
  };
}

/* ──────────────────────────── حقول الحجز (من نافذة التواصل) ──────────────────────────── */

export function BookingFields({ value, onChange, used, cap, consultant }: {
  value: FreeSession; onChange: (f: FreeSession) => void; used: number; cap: number; consultant: string | null;
}) {
  const missing = QUALIFICATION.filter((q) => !value.qual[q.id]);
  return (
    <div className="space-y-3 rounded-2xl border p-3" style={{ borderColor: `${GOLD}88`, background: `color-mix(in srgb, ${GOLD} 6%, transparent)` }}>
      <label className="flex items-center gap-2 text-sm font-black text-[var(--ink)]">
        <input type="checkbox" checked={value.is_free} onChange={(e) => onChange({ ...value, is_free: e.target.checked })} className="h-4 w-4 accent-[var(--acc)]" />
        <Gift size={15} style={{ color: GOLD }} /> الاجتماع = جلسة «{SESSION_NAME}» المجانية
      </label>
      {value.is_free && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--muted)]">موعد الجلسة</span>
            <input type="date" value={value.session_date ?? ""} onChange={(e) => onChange({ ...value, session_date: e.target.value || null })} className={input} />
          </label>
          <div role="group" aria-label="شروط التأهيل" className="space-y-1.5">
            <span className="block text-xs font-bold text-[var(--muted)]">شروط التأهيل</span>
            {QUALIFICATION.map((q) => (
              <label key={q.id} className="flex items-start gap-2 text-sm text-[var(--body)]">
                <input type="checkbox" checked={!!value.qual[q.id]} onChange={(e) => onChange({ ...value, qual: { ...value.qual, [q.id]: e.target.checked } })} className="mt-1 h-4 w-4 accent-[var(--acc)]" />
                <span><b className="text-[var(--ink)]">{q.label}</b> <span className="text-[11px] text-[var(--faint)]">— {q.hint}</span></span>
              </label>
            ))}
          </div>
          {missing.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs font-bold text-[#B45309]"><TriangleAlert size={13} className="mt-0.5 shrink-0" /> ناقص {fmt(missing.length)} من شروط التأهيل — الصالونات اللي ما تكمّلها غالباً ما تتعاقد. تقدرين تحجزين، بس تأكدي منها قبل الموعد.</p>
          )}
          {cap > 0 && used >= cap && (
            <p className="flex items-start gap-1.5 text-xs font-bold text-[#DC2626]"><TriangleAlert size={13} className="mt-0.5 shrink-0" /> {consultant ?? "المستشارة"} وصلت السقف ({fmt(used)} من {fmt(cap)} جلسات هالأسبوع) — هالجلسة بتكون فوق السقف.</p>
          )}
        </>
      )}
    </div>
  );
}

/* ──────────────────────────── بطاقة الجلسة داخل بطاقة الصالون ──────────────────────────── */

export function SessionCard({ client: c, targets, patch, copy }: {
  client: RoomClient; targets: Targets; patch: (p: Partial<RoomClient>, debounce?: boolean) => void; copy: (t: string, m?: string) => void;
}) {
  const f = sessionOf(c);
  const st = sessionState(c);
  const set = (p: Partial<FreeSession>, debounce = false) => patch({ free_session: { ...f, ...p } }, debounce);
  const today = todayKey();
  const [now] = useState(() => Date.now());
  const due = proposalDue(f);
  const late = st === "held" && due && Date.parse(due) < now;

  if (!f.is_free) {
    if (!["lead", "discovery", "diagnosis"].includes(c.stage)) return null;
    return (
      <div className={`${card} flex flex-wrap items-center gap-3 p-4`}>
        <Gift size={18} style={{ color: GOLD }} />
        <span className="min-w-[12rem] flex-1 text-sm font-bold text-[var(--body)]">اعرضي على الصالون جلسة «{SESSION_NAME}» المجانية (قيمتها {fmt(targets.session_value)} ر.س).</span>
        <button onClick={() => copy(inviteMessage(targets, c.owner_name), "تم نسخ رسالة الدعوة")} className={btnGhost}><Copy size={14} /> رسالة الدعوة</button>
        <button onClick={() => set({ is_free: true, session_date: f.session_date ?? today, booked_at: new Date().toISOString() })} className={btnPrimary} style={accGrad}><CalendarDays size={14} /> حجز الجلسة</button>
      </div>
    );
  }

  return (
    <div className={`${card} p-4`} style={{ borderColor: `${GOLD}88` }}>
      <SectionTitle icon={Gift} title={`جلسة «${SESSION_NAME}» المجانية`}
        action={st !== "none" ? <Badge color={SESSION_STATES[st].color}>{SESSION_STATES[st].label}</Badge> : null} />

      {st === "booked" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--muted)]">موعد الجلسة</span>
              <input type="date" value={f.session_date ?? ""} onChange={(e) => set({ session_date: e.target.value || null })} className={`${input} !w-auto`}
                style={f.session_date && f.session_date < today ? { borderColor: "#DC2626" } : {}} />
            </label>
            <button onClick={() => copy(inviteMessage(targets, c.owner_name), "تم نسخ رسالة الدعوة")} className={btnGhost}><Copy size={14} /> رسالة الدعوة</button>
          </div>
          <div role="group" aria-label="شروط التأهيل" className="space-y-1.5">
            {QUALIFICATION.map((q) => {
              const on = !!f.qual[q.id];
              return (
                <button key={q.id} onClick={() => set({ qual: { ...f.qual, [q.id]: !on } })} className="flex w-full items-center gap-2 rounded-xl border p-2 text-right text-sm"
                  style={{ borderColor: on ? "#16A34A66" : "var(--line)" }}>
                  {on ? <CheckCircle2 size={16} className="shrink-0 text-[#16A34A]" /> : <Circle size={16} className="shrink-0 text-[var(--faint)]" />}
                  <span className="min-w-0 flex-1"><b className="text-[var(--ink)]">{q.label}</b> <span className="text-[11px] text-[var(--faint)]">— {q.hint}</span></span>
                </button>
              );
            })}
          </div>
          {!qualified(f) && <p className="text-xs font-bold text-[#B45309]">كمّلي شروط التأهيل قبل الموعد — خصوصاً البيانات، بدونها الجلسة تصير دردشة.</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => patch({
              free_session: { ...f, held_at: new Date().toISOString() },
              ...(["lead", "discovery", "diagnosis"].includes(c.stage) ? { stage: "proposal" as const } : {}),
            })} className={btnPrimary} style={accGrad}><CheckCircle2 size={14} /> تمّت الجلسة</button>
            <button onClick={() => { if (confirm("إلغاء حجز الجلسة المجانية؟")) set({ is_free: false, booked_at: null }); }} className={btnGhost}><Undo2 size={14} /> إلغاء الحجز</button>
          </div>
          <p className="text-[11px] text-[var(--faint)]">«تمّت الجلسة» ينقل الصالون لمرحلة «العرض والتعاقد» ويبدأ عدّاد الـ ٤٨ ساعة للعرض. عبّي التشخيص الأولي تحت أثناء الجلسة.</p>
        </div>
      )}

      {st !== "booked" && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            تمّت {f.held_at ? dateLabel(f.held_at.slice(0, 10), true) : ""}
            {st === "held" && due && <> — <b style={{ color: late ? "#DC2626" : "var(--ink)" }}><Clock size={11} className="inline" /> العرض {late ? "متأخر عن" : "مطلوب قبل"} {new Date(due).toLocaleString("ar-SA-u-ca-gregory", { weekday: "long", hour: "numeric", minute: "2-digit" })}</b></>}
            {f.proposal_sent_at && <> — أُرسل العرض {dateLabel(f.proposal_sent_at.slice(0, 10))}</>}
          </p>
          <div className="space-y-2">
            <span className="flex items-center gap-1 text-xs font-bold text-[var(--muted)]"><Sparkles size={12} /> ٣ ملاحظات بالأرقام: وين يضيع الدخل</span>
            {f.findings.map((x, i) => (
              <input key={i} value={x} onChange={(e) => set({ findings: f.findings.map((y, j) => (j === i ? e.target.value.slice(0, 200) : y)) }, true)}
                placeholder={["مثال: ٤٢ عميلة نائمة = ~١٤ ألف ريال سنوياً", "مثال: ما فيه بيع إضافي — الفاتورة ٢٥٠ والسوق ٣٤٠", "مثال: الغياب ١٥٪ بدون تذكير"][i]} className={input} aria-label={`الملاحظة ${i + 1}`} />
            ))}
            <input value={f.quick_win} onChange={(e) => set({ quick_win: e.target.value.slice(0, 200) }, true)} placeholder="الفرصة السريعة من بكرة — مثال: رسالة استرجاع للنائمات" className={input} aria-label="الفرصة السريعة" />
            <p className="text-[11px] text-[var(--faint)]">الخطة الكاملة والتنفيذ ما ينعطون في الجلسة — هذي في العقد.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copy(summaryMessage(c, f), "تم نسخ ملخص الجلسة")} className={btnGhost}><Copy size={14} /> نسخ ملخص الجلسة</button>
            {st === "held" && <button onClick={() => set({ proposal_sent_at: new Date().toISOString() })} className={btnPrimary} style={accGrad}><Send size={14} /> تم إرسال العرض</button>}
            {(st === "held" || st === "proposal") && <button onClick={() => set({ declined: true })} className={btnGhost}><XCircle size={14} /> ما تعاقد</button>}
            {st === "declined" && <button onClick={() => set({ declined: false })} className={btnGhost}><Undo2 size={14} /> تراجع</button>}
          </div>
          {st === "proposal" && <p className="text-[11px] text-[var(--faint)]">لما يتوقّع العقد انقلي الصالون لمرحلة «التأسيس» — تنحسب الجلسة «تعاقد» تلقائياً.</p>}
        </div>
      )}
    </div>
  );
}
