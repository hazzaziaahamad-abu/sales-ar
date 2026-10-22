"use client";

// بطاقة الصالون في الغرفة: البيانات، المرحلة والحالة، مهام كل مرحلة، المؤشرات والأهداف، والسجل.

import React, { useState } from "react";
import {
  X, Archive, MessageCircle, CheckCircle2, Circle, Plus, Trash2, Target, Package, Lightbulb, ListChecks,
  BarChart3, History, Send, StickyNote,
} from "lucide-react";
import { formatKpi, goalProgress, intlPhone, kpiDelta, type KpiKey } from "@/lib/salon-growth";
import {
  HEALTH, LOG_KINDS, PLAYBOOK, ROOM_KPIS, STAGES, WORK_STAGES, stageLabel,
  type Health, type LogKind, type RoomClient, type Stage,
} from "@/lib/salon-room";
import type { RoomData, RoomOps } from "./SalonRoom";
import { Avatar, Badge, Field, GOLD, SectionTitle, accGrad, btnGhost, btnPrimary, card, dateLabel, fmt, input, timeAgo, todayKey } from "./ui";

const numOrNull = (v: string) => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export default function ClientPanel({ client: c, data, me, ops, onClose }: {
  client: RoomClient; data: RoomData; me: string; ops: RoomOps; onClose: () => void;
}) {
  const today = todayKey();
  const patch = (p: Partial<RoomClient>, debounce = false) => ops.patchClient(c.id, p, debounce);
  const [phase, setPhase] = useState<Stage>(WORK_STAGES.includes(c.stage) ? c.stage : "discovery");
  const [newTask, setNewTask] = useState("");
  const [logKind, setLogKind] = useState<Exclude<LogKind, "stage">>("checkin");
  const [logBody, setLogBody] = useState("");
  const [sending, setSending] = useState(false);

  const tasks = data.tasks.filter((t) => t.client_id === c.id);
  const phaseTasks = tasks.filter((t) => t.phase === phase).sort((a, b) => a.sort_order - b.sort_order);
  const pb = PLAYBOOK.find((p) => p.stage === phase);
  const logs = data.logs.filter((l) => l.client_id === c.id);
  const team = data.team.filter((m) => m.active || m.name === c.consultant);
  const goals = [0, 1, 2].map((i) => c.goals[i] ?? { kpi: "" as const, target: null });
  const setGoal = (i: number, g: Partial<RoomClient["goals"][number]>) => patch({ goals: goals.map((x, j) => (j === i ? { ...x, ...g } : x)) }, true);

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
          <div className={`${card} grid gap-3 p-4 sm:grid-cols-3`}>
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

          {/* ─── مهام المراحل ─── */}
          <div className={`${card} p-4`}>
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
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--surface-2)] p-3 text-xs"><span className="flex items-center gap-1 font-black text-[var(--ink)]"><Package size={12} /> المُخرَج</span><span className="mt-0.5 block text-[var(--muted)]">{pb.deliverable}</span></div>
                <div className="rounded-2xl p-3 text-xs" style={{ background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }}><span className="flex items-center gap-1 font-black text-[var(--ink)]"><Lightbulb size={12} style={{ color: GOLD }} /> نصيحة</span><span className="mt-0.5 block text-[var(--muted)]">{pb.tip}</span></div>
              </div>
            )}
          </div>

          {/* ─── المؤشرات والأهداف ─── */}
          <div className={`${card} p-4`}>
            <SectionTitle icon={BarChart3} title="المؤشرات — قبل / الحالي" />
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-right text-[11px] text-[var(--faint)]"><th className="py-1 font-bold">المؤشر</th><th className="w-32 font-bold">قبل</th><th className="w-32 font-bold">الحالي</th><th className="w-24 font-bold">التغيّر</th></tr>
                </thead>
                <tbody>
                  {ROOM_KPIS.map((k) => {
                    const b = c.baseline[k.key] ?? null;
                    const cur = c.current[k.key] ?? null;
                    const dl = kpiDelta(k, b, cur);
                    return (
                      <tr key={k.key} className="border-t border-[var(--line)]">
                        <td className="py-2"><div className="font-bold text-[var(--ink)]">{k.label}</div><div className="text-[10px] text-[var(--faint)]">{k.unit}</div></td>
                        <td className="pe-2"><input type="number" inputMode="decimal" value={b ?? ""} onChange={(e) => patch({ baseline: { ...c.baseline, [k.key]: numOrNull(e.target.value) } }, true)} className={`${input} !py-1.5`} aria-label={`${k.label} قبل`} /></td>
                        <td className="pe-2"><input type="number" inputMode="decimal" value={cur ?? ""} onChange={(e) => patch({ current: { ...c.current, [k.key]: numOrNull(e.target.value) } }, true)} className={`${input} !py-1.5`} aria-label={`${k.label} الحالي`} /></td>
                        <td className="font-black" style={{ color: dl?.color ?? "var(--faint)" }}>{dl?.text ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 space-y-2">
              <div className="text-xs font-bold text-[var(--muted)]">أهداف ٩٠ يوم</div>
              {goals.map((g, i) => {
                const k = ROOM_KPIS.find((x) => x.key === g.kpi);
                const p = k ? goalProgress(k, c.baseline[k.key] ?? null, c.current[k.key] ?? null, g.target) : null;
                return (
                  <div key={i} className="rounded-2xl border border-[var(--line)] p-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-[#2A1018]" style={{ background: GOLD }}>{fmt(i + 1)}</span>
                      <select value={g.kpi} onChange={(e) => setGoal(i, { kpi: e.target.value as KpiKey | "" })} className={`${input} !w-auto min-w-0 flex-1 !py-1.5`} aria-label={`الهدف ${i + 1}`}>
                        <option value="">اختر المؤشر…</option>
                        {ROOM_KPIS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                      <input type="number" value={g.target ?? ""} disabled={!g.kpi} onChange={(e) => setGoal(i, { target: numOrNull(e.target.value) })} placeholder="الهدف" className={`${input} !w-24 !py-1.5`} aria-label="القيمة المستهدفة" />
                    </div>
                    {k && (
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-[10px] font-bold text-[var(--faint)]">
                          <span>قبل {formatKpi(k, c.baseline[k.key])}</span><span>الحالي {formatKpi(k, c.current[k.key])}</span><span>الهدف {formatKpi(k, g.target)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div className="h-full rounded-full" style={{ width: `${(p ?? 0) * 100}%`, background: p === 1 ? "#16A34A" : `linear-gradient(90deg, var(--acc), ${GOLD})` }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
                {(["checkin", "meeting", "note"] as const).map((k) => (
                  <button key={k} onClick={() => setLogKind(k)} className="rounded-full border px-3 py-1 text-xs font-bold"
                    style={logKind === k ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                    {LOG_KINDS[k]}
                  </button>
                ))}
              </div>
              <textarea rows={2} value={logBody} onChange={(e) => setLogBody(e.target.value)} placeholder={logKind === "checkin" ? "وش صار هالأسبوع؟ الأرقام، العوائق، الخطوة الجاية…" : "اكتبي…"} className={`${input} resize-y`} />
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
