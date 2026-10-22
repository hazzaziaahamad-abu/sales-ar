"use client";

// بطاقة الصالون في الغرفة: البيانات، المرحلة والحالة، مهام كل مرحلة، المؤشرات والأهداف، والسجل.

import React, { useState } from "react";
import {
  X, Archive, MessageCircle, CheckCircle2, Circle, Plus, Trash2, Target, Package, Lightbulb, ListChecks,
  History, Send, StickyNote, Crosshair, ArrowLeftCircle, CalendarRange, Wand2, Stethoscope, ChevronDown, Lock,
} from "lucide-react";
import { DEFAULT_DIAGNOSIS, KPIS, intlPhone, type Diagnosis } from "@/lib/salon-growth";
import { DiagnosisView, type DiagnosisSource } from "@/components/offer/SalonDiagnosis";
import { goalsProgress } from "./metrics";
import {
  HEALTH, LEAD_STATUSES, LOG_KINDS, PLAYBOOK, PRIORITIES, SEGMENTS, SOURCES, STAGES, WORK_STAGES, addDays, phaseWindows, stageLabel,
  type Health, type LogKind, type Priority, type RoomClient, type RoomTask, type Stage,
} from "@/lib/salon-room";
import type { RoomData, RoomOps } from "./SalonRoom";
import { Avatar, Badge, Field, GOLD, SectionTitle, accGrad, btnGhost, btnPrimary, card, dateLabel, fmt, input, timeAgo, todayKey } from "./ui";

const numOrNull = (v: string) => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export default function ClientPanel({ client: c, data, me, ops, onClose, copy }: {
  client: RoomClient; data: RoomData; me: string; ops: RoomOps; onClose: () => void; copy: (text: string, msg?: string) => void;
}) {
  const today = todayKey();
  const patch = (p: Partial<RoomClient>, debounce = false) => ops.patchClient(c.id, p, debounce);
  const [phase, setPhase] = useState<Stage>(WORK_STAGES.includes(c.stage) ? c.stage : "discovery");
  const [newTask, setNewTask] = useState("");
  const lead = c.stage === "lead";
  const [logKind, setLogKind] = useState<Exclude<LogKind, "stage">>(lead ? "contact" : "checkin");
  const [planStart, setPlanStart] = useState(c.start_date ?? today);
  const [overwrite, setOverwrite] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [logBody, setLogBody] = useState("");
  const [sending, setSending] = useState(false);

  const tasks = data.tasks.filter((t) => t.client_id === c.id);
  const phaseTasks = tasks.filter((t) => t.phase === phase).sort((a, b) => a.sort_order - b.sort_order);
  const pb = PLAYBOOK.find((p) => p.stage === phase);
  const logs = data.logs.filter((l) => l.client_id === c.id);
  const team = data.team.filter((m) => m.active || m.name === c.consultant);

  // التشخيص: الملاحظات والاعتماد في c.diagnosis، والأرقام في baseline/current/goals (نفس مصدر الداشبورد)
  const [diagOpen, setDiagOpen] = useState(c.stage === "discovery" || c.stage === "diagnosis" || c.stage === "proposal");
  const diag: Diagnosis = { ...DEFAULT_DIAGNOSIS, ...c.diagnosis };
  const goals3 = [0, 1, 2].map((i) => c.goals[i] ?? { kpi: "" as const, target: null });
  const baselineCount = KPIS.filter((k) => c.baseline[k.key] !== null && c.baseline[k.key] !== undefined).length;
  const goalsP = goalsProgress(c);
  const diagSrc: DiagnosisSource = {
    d: diag,
    set: (p) => patch({ diagnosis: { ...diag, ...p } }, true),
    baseline: (k) => {
      const value = c.baseline[k] ?? null;
      const estimated = !!diag.baseline[k]?.estimated;
      return value === null && !estimated ? undefined : { value, estimated };
    },
    setBaseline: (k, p) => {
      const next: Partial<RoomClient> = {};
      if ("value" in p) next.baseline = { ...c.baseline, [k]: p.value ?? null };
      if ("estimated" in p) next.diagnosis = { ...diag, baseline: { ...diag.baseline, [k]: { value: c.baseline[k] ?? null, estimated: !!p.estimated } } };
      patch(next, true);
    },
    goals: goals3,
    setGoals: (goals) => patch({ goals }, true),
    current: (k) => c.current[k.key] ?? null,
    isAuto: () => false,
    setCurrent: (k, v) => patch({ current: { ...c.current, [k]: v } }, true),
    owner: c.owner_name ?? "",
    setOwner: (v) => patch({ owner_name: v }, true),
    nextReview: c.next_review ?? "",
    setNextReview: (v) => patch({ next_review: v || null }),
    observe: (observed, score) => patch({ diagnosis: { ...diag, observed }, ...(score === null ? {} : { baseline: { ...c.baseline, reception_score: score } }) }, true),
  };

  const addLog = async () => {
    if (!logBody.trim()) return;
    setSending(true);
    if (await ops.addLog(c.id, logKind, logBody.trim())) setLogBody("");
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-start bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <aside className="sr-slide h-full w-full max-w-3xl overflow-y-auto bg-[var(--bg)] shadow-2xl" onClick={(e) => e.stopPropagation()} aria-label={c.salon_name}>
        {/* ─── الرأس ─── */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--line)] bg-[var(--glass)] px-4 py-3 backdrop-blur-xl sm:px-6">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: HEALTH[c.health].color }} />
          <input value={c.salon_name} onChange={(e) => patch({ salon_name: e.target.value.slice(0, 120) }, true)}
            className="min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-lg font-black text-[var(--ink)] outline-none hover:border-[var(--line)] focus:border-[var(--acc)]" aria-label="اسم الصالون" />
          <button onClick={() => { if (confirm(`أرشفة «${c.salon_name}»؟ تختفي من الغرفة.`)) patch({ archived: true }); }} className={`${btnGhost} !px-3`} title="أرشفة"><Archive size={14} /></button>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)]" aria-label="إغلاق"><X size={18} /></button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {/* ─── المرحلة والحالة ─── */}
          <div className={`${card} p-4`}>
            <div className="mb-2 text-xs font-bold text-[var(--muted)]">المرحلة في الآلية</div>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s) => (
                <button key={s.id} onClick={() => { patch({ stage: s.id }); if (WORK_STAGES.includes(s.id)) setPhase(s.id); }}
                  className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
                  style={c.stage === s.id ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                  {s.short}
                </button>
              ))}
            </div>
            <div className="mb-2 mt-4 text-xs font-bold text-[var(--muted)]">حالة الصالون</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(HEALTH) as Health[]).map((h) => (
                <button key={h} onClick={() => patch({ health: h })} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold"
                  style={c.health === h ? { borderColor: HEALTH[h].color, color: HEALTH[h].color, background: `color-mix(in srgb, ${HEALTH[h].color} 10%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: HEALTH[h].color }} /> {HEALTH[h].label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── البيانات ─── */}
          <div className={`${card} grid grid-cols-1 gap-3 p-4 sm:grid-cols-3`}>
            <Field label="المالكة"><input value={c.owner_name ?? ""} onChange={(e) => patch({ owner_name: e.target.value }, true)} className={input} /></Field>
            <Field label="الجوال">
              <div className="flex gap-1.5">
                <input dir="ltr" value={c.phone ?? ""} onChange={(e) => patch({ phone: e.target.value }, true)} placeholder="05xxxxxxxx" className={`${input} text-left`} />
                {c.phone && intlPhone(c.phone).length >= 11 && (
                  <a href={`https://wa.me/${intlPhone(c.phone)}`} target="_blank" rel="noopener noreferrer" className="grid w-10 shrink-0 place-items-center rounded-xl bg-[#25D366] text-white" aria-label="واتساب"><MessageCircle size={16} /></a>
                )}
              </div>
            </Field>
            <Field label="المدينة"><input value={c.city ?? ""} onChange={(e) => patch({ city: e.target.value }, true)} className={input} /></Field>
            <Field label="المستشارة المسؤولة">
              <select value={c.consultant ?? ""} onChange={(e) => patch({ consultant: e.target.value || null })} className={input}>
                <option value="">—</option>
                {team.map((m) => <option key={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="تاريخ البداية"><input type="date" value={c.start_date ?? ""} onChange={(e) => patch({ start_date: e.target.value || null })} className={input} /></Field>
            <Field label="المراجعة القادمة">
              <input type="date" value={c.next_review ?? ""} onChange={(e) => patch({ next_review: e.target.value || null })} className={input}
                style={c.next_review && c.next_review < today ? { borderColor: "#DC2626" } : {}} />
            </Field>
            <Field label="قيمة العقد (ر.س)"><input type="number" value={c.contract_value ?? ""} onChange={(e) => patch({ contract_value: numOrNull(e.target.value) }, true)} className={input} /></Field>
          </div>

          {/* ─── الاستهداف (قبل التحويل لعميل) ─── */}
          {lead && (
            <div className={`${card} p-4`}>
              <SectionTitle icon={Crosshair} title="خطة الاستهداف"
                action={<button onClick={() => { if (confirm(`تحويل «${c.salon_name}» لعميل؟`)) patch({ stage: "discovery", lead_status: "meeting" }); }} className={`${btnPrimary} !px-3 !py-1.5 !text-xs`} style={accGrad}><ArrowLeftCircle size={13} /> تحويل لعميل</button>} />
              <div className="mb-3 flex flex-wrap gap-1.5">
                {LEAD_STATUSES.map((st) => (
                  <button key={st.id} onClick={() => patch({ lead_status: st.id })} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold"
                    style={c.lead_status === st.id ? { borderColor: st.color, color: st.color, background: `color-mix(in srgb, ${st.color} 10%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: st.color }} /> {st.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field label="الأولوية" group>
                  <div className="flex gap-1">
                    {(["A", "B", "C"] as Priority[]).map((p) => (
                      <button key={p} onClick={() => patch({ priority: p })} title={PRIORITIES[p].hint} className="flex-1 rounded-xl border py-2 text-sm font-black"
                        style={c.priority === p ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" }}>{PRIORITIES[p].label}</button>
                    ))}
                  </div>
                </Field>
                <Field label="المصدر">
                  <select value={c.source ?? ""} onChange={(e) => patch({ source: e.target.value || null })} className={input}><option value="">—</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select>
                </Field>
                <Field label="حجم الصالون">
                  <select value={c.segment ?? ""} onChange={(e) => patch({ segment: e.target.value || null })} className={input}><option value="">—</option>{SEGMENTS.map((x) => <option key={x}>{x}</option>)}</select>
                </Field>
                <Field label="المتابعة الجاية">
                  <input type="date" value={c.next_followup ?? ""} onChange={(e) => patch({ next_followup: e.target.value || null })} className={input}
                    style={c.next_followup && c.next_followup <= today ? { borderColor: "#DC2626" } : {}} />
                </Field>
              </div>
              <p className="mt-3 text-[11px] text-[var(--faint)]">
                {fmt(logs.filter((l) => l.kind === "contact").length)} محاولة تواصل{c.last_contact_at ? ` · آخرها ${timeAgo(c.last_contact_at)}` : ""} — سجّلي كل محاولة من «سجل المتابعة» تحت.
              </p>
            </div>
          )}

          {/* ─── خطة التنفيذ (الجدول الزمني) ─── */}
          {!lead && (
            <div className={`${card} p-4`}>
              <SectionTitle icon={CalendarRange} title="خطة التنفيذ" />
              <div className="flex flex-wrap items-end gap-2">
                <Field label="تاريخ بداية الرحلة"><input type="date" value={planStart} onChange={(e) => setPlanStart(e.target.value)} className={`${input} !w-auto`} /></Field>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[var(--muted)]">
                  <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--acc)]" /> أعيدي توزيع التواريخ الموجودة
                </label>
                <button disabled={!planStart || planning} onClick={async () => { setPlanning(true); await ops.generatePlan(c.id, planStart, overwrite); setPlanning(false); }} className={`${btnPrimary} mb-0.5`} style={accGrad}>
                  <Wand2 size={14} /> {c.start_date ? "تحديث الخطة" : "توليد خطة التنفيذ"}
                </button>
              </div>
              {c.start_date ? <Timeline start={c.start_date} stage={c.stage} tasks={tasks} today={today} /> : (
                <p className="mt-3 rounded-2xl bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">
                  اختاري تاريخ البداية وولّدي الخطة — تنزل تواريخ لكل مهام المراحل (١٢٨ يوم: استكشاف ← تشخيص ← تعاقد ← تأسيس ← ٩٠ يوم تنفيذ ← مراجعة)، ومراجعة أولى بعد ٣٠ يوم.
                </p>
              )}
            </div>
          )}

          {/* ─── مهام المراحل ─── */}
          {!lead && <div className={`${card} p-4`}>
            <SectionTitle icon={ListChecks} title="مهام الآلية" />
            <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {WORK_STAGES.map((s) => {
                const all = tasks.filter((t) => t.phase === s);
                const done = all.filter((t) => t.done_at).length;
                const on = phase === s;
                return (
                  <button key={s} onClick={() => setPhase(s)} className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold"
                    style={on ? { borderColor: "var(--acc)", color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                    {s === c.stage && <span className="h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} />}
                    {stageLabel(s)} <span className="opacity-70">{fmt(done)}/{fmt(all.length)}</span>
                  </button>
                );
              })}
            </div>
            {pb && <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-[var(--body)]"><Target size={13} style={{ color: "var(--acc)" }} /> {pb.goal} · <span className="text-[var(--faint)]">{pb.duration}</span></p>}
            <ul className="space-y-1.5">
              {phaseTasks.map((t) => {
                const late = !t.done_at && t.due_date && t.due_date < today;
                return (
                  <li key={t.id} className="rounded-2xl border border-[var(--line)] p-2.5" style={late ? { borderColor: "#DC262666" } : {}}>
                    <div className="flex items-start gap-2">
                      <button onClick={() => ops.patchTask(t, { done: !t.done_at })} className="mt-0.5 shrink-0" aria-label={t.done_at ? "إلغاء الإنجاز" : "إنجاز"}>
                        {t.done_at ? <CheckCircle2 size={18} className="text-[#16A34A]" /> : <Circle size={18} className="text-[var(--faint)] hover:text-[#16A34A]" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-bold ${t.done_at ? "text-[var(--faint)] line-through" : "text-[var(--ink)]"}`}>{t.title}</div>
                        {t.done_at && <div className="text-[11px] text-[var(--faint)]">أنجزتها {t.done_by ?? "—"} · {timeAgo(t.done_at)}</div>}
                      </div>
                      {t.custom && <button onClick={() => ops.deleteTask(t)} className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--faint)] hover:bg-red-500/10 hover:text-red-500" aria-label="حذف المهمة"><Trash2 size={12} /></button>}
                    </div>
                    {!t.done_at && (
                      <div className="mt-2 flex flex-wrap gap-2 ps-7">
                        <input type="date" value={t.due_date ?? ""} onChange={(e) => ops.patchTask(t, { due_date: e.target.value || null })} className={`${input} !w-auto !py-1 !text-xs`} aria-label="تاريخ الاستحقاق" style={late ? { borderColor: "#DC2626" } : {}} />
                        <select value={t.assignee ?? ""} onChange={(e) => ops.patchTask(t, { assignee: e.target.value || null })} className={`${input} !w-auto !py-1 !text-xs`} aria-label="المسؤولة">
                          <option value="">بدون إسناد</option>
                          {team.map((m) => <option key={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex gap-2">
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newTask.trim()) { ops.addTask(c.id, phase, newTask.trim()); setNewTask(""); } }}
                placeholder={`مهمة إضافية في «${stageLabel(phase)}»`} className={input} />
              <button onClick={() => { if (newTask.trim()) { ops.addTask(c.id, phase, newTask.trim()); setNewTask(""); } }} disabled={!newTask.trim()} className={`${btnPrimary} shrink-0 !px-3`} style={accGrad} aria-label="إضافة مهمة"><Plus size={15} /></button>
            </div>
            {pb && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--surface-2)] p-3 text-xs"><span className="flex items-center gap-1 font-black text-[var(--ink)]"><Package size={12} /> المُخرَج</span><span className="mt-0.5 block text-[var(--muted)]">{pb.deliverable}</span></div>
                <div className="rounded-2xl p-3 text-xs" style={{ background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }}><span className="flex items-center gap-1 font-black text-[var(--ink)]"><Lightbulb size={12} style={{ color: GOLD }} /> نصيحة</span><span className="mt-0.5 block text-[var(--muted)]">{pb.tip}</span></div>
              </div>
            )}
          </div>}

          {/* ─── التشخيص الأولي (خط الأساس، الحالي، الأهداف) ─── */}
          {!lead && (
            <div className={`${card} p-4`}>
              <button onClick={() => setDiagOpen((o) => !o)} className="flex w-full items-center gap-2 text-right" aria-expanded={diagOpen}>
                <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}><Stethoscope size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-black text-[var(--ink)]">التشخيص الأولي والمؤشرات</span>
                  <span className="block text-[11px] text-[var(--faint)]">
                    خط الأساس {fmt(baselineCount)} من {fmt(KPIS.length)}، {diag.baseline_locked_at ? `معتمد ${dateLabel(diag.baseline_locked_at.slice(0, 10))}` : "غير معتمد"}
                    {goalsP !== null ? `، الأهداف ${fmt(goalsP * 100)}٪` : ""}
                  </span>
                </span>
                {diag.baseline_locked_at && <Badge color="#16A34A"><Lock size={10} /> معتمد</Badge>}
                <ChevronDown size={16} className={`shrink-0 text-[var(--muted)] transition-transform ${diagOpen ? "rotate-180" : ""}`} />
              </button>
              {diagOpen && (
                <div className="mt-4">
                  <DiagnosisView src={diagSrc} copy={copy} salonName={c.salon_name} compact
                    currentHint="سجّلي أرقام الصالون اليوم واعتمديها مع المالكة. «الحالي» تحدّثينه عند كل مراجعة شهرية — ومنه يتحسب تقدّم الأهداف في الداشبورد." />
                </div>
              )}
            </div>
          )}

          {/* ─── ملاحظات ─── */}
          <div className={`${card} p-4`}>
            <SectionTitle icon={StickyNote} title="ملاحظات ثابتة عن الصالون" />
            <textarea rows={3} value={c.notes} onChange={(e) => patch({ notes: e.target.value.slice(0, 5000) }, true)} placeholder="مثال: المالكة تفضّل التواصل مساءً · فيه خلاف بين الموظفات على الحجوزات…" className={`${input} resize-y leading-relaxed`} />
          </div>

          {/* ─── السجل ─── */}
          <div className={`${card} p-4`}>
            <SectionTitle icon={History} title="سجل المتابعة" />
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(lead ? (["contact", "note"] as const) : (["checkin", "meeting", "note", "contact"] as const)).map((k) => (
                  <button key={k} onClick={() => setLogKind(k)} className="rounded-full border px-3 py-1 text-xs font-bold"
                    style={logKind === k ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                    {LOG_KINDS[k]}
                  </button>
                ))}
              </div>
              <textarea rows={2} value={logBody} onChange={(e) => setLogBody(e.target.value)} placeholder={logKind === "checkin" ? "وش صار هالأسبوع؟ الأرقام، العوائق، الخطوة الجاية…" : logKind === "contact" ? "اتصال / واتساب / زيارة — وش كانت النتيجة؟" : "اكتبي…"} className={`${input} resize-y`} />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-[var(--faint)]">باسم: {me}</span>
                <button onClick={addLog} disabled={!logBody.trim() || sending} className={btnPrimary} style={accGrad}><Send size={14} /> تسجيل</button>
              </div>
            </div>
            <ol className="mt-3 space-y-2">
              {logs.map((l) => (
                <li key={l.id} className="flex gap-2.5">
                  <Avatar name={l.author} size={26} />
                  <div className="min-w-0 flex-1 rounded-2xl bg-[var(--surface-2)] p-2.5">
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <b className="text-[var(--ink)]">{l.author ?? "—"}</b>
                      <Badge color={l.kind === "stage" ? GOLD : "#7A6570"}>{LOG_KINDS[l.kind]}</Badge>
                      <span className="text-[var(--faint)]">{timeAgo(l.created_at)}</span>
                    </div>
                    <div className="whitespace-pre-line break-words text-sm text-[var(--body)]">{l.body}</div>
                  </div>
                </li>
              ))}
              {logs.length === 0 && <li className="text-xs text-[var(--faint)]">ما فيه سجل بعد.</li>}
            </ol>
          </div>
          <p className="pb-4 text-center text-[11px] text-[var(--faint)]">أُضيف {dateLabel(c.created_at.slice(0, 10))} · آخر تحديث {timeAgo(c.updated_at)}</p>
        </div>
      </aside>
    </div>
  );
}

/** الجدول الزمني للمراحل: شريط لكل مرحلة على نافذتها، تعبئته = نسبة المهام المنجزة، وخط «اليوم». */
function Timeline({ start, stage, tasks, today }: { start: string; stage: Stage; tasks: RoomTask[]; today: string }) {
  const windows = phaseWindows(start);
  const end = addDays(start, PLAYBOOK[PLAYBOOK.length - 1].to);
  const span = (Date.parse(end) - Date.parse(start)) || 1;
  const pos = (k: string) => Math.min(100, Math.max(0, ((Date.parse(k) - Date.parse(start)) / span) * 100));
  const todayPos = pos(today);
  return (
    <div className="mt-4">
      <div className="relative space-y-2">
        {windows.map((w) => {
          const list = tasks.filter((t) => t.phase === w.stage);
          const done = list.filter((t) => t.done_at).length;
          const p = list.length ? done / list.length : 0;
          const current = w.stage === stage;
          const late = !current && p < 1 && w.to < today;
          return (
            <div key={w.stage} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-[11px]" title={`${stageLabel(w.stage)}: ${dateLabel(w.from)} – ${dateLabel(w.to)} (${fmt(done)}/${fmt(list.length)})`}>
              <span className={`truncate font-bold ${current ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>{stageLabel(w.stage)}</span>
              <div className="relative h-5 rounded-md bg-[var(--surface-2)]">
                <div className="absolute inset-y-0 overflow-hidden rounded-md" style={{ insetInlineStart: `${pos(w.from)}%`, width: `${Math.max(2, pos(w.to) - pos(w.from))}%`, background: "color-mix(in srgb, var(--acc) 18%, transparent)", outline: current ? "2px solid var(--acc)" : late ? "1px solid #DC2626" : "none" }}>
                  <div className="h-full" style={{ width: `${p * 100}%`, background: p === 1 ? "#16A34A" : "var(--acc)" }} />
                </div>
              </div>
            </div>
          );
        })}
        {todayPos > 0 && todayPos < 100 && (
          <div className="pointer-events-none absolute inset-y-0 ms-[7rem]" style={{ insetInlineStart: 0, width: "calc(100% - 7rem)" }}>
            <div className="absolute inset-y-[-4px] w-0.5 rounded" style={{ insetInlineStart: `${todayPos}%`, background: GOLD }} title="اليوم" />
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between ps-[7rem] text-[10px] text-[var(--faint)]">
        <span>{dateLabel(start)}</span><span style={{ color: GOLD }}>▍ اليوم</span><span>{dateLabel(end)}</span>
      </div>
    </div>
  );
}
