"use client";

// «اجتماع الفريق» — أجندة اجتماعات فريق الصالونات وتدوين ملاحظاتها:
// بنود بأوقات ومسؤولات وملاحظات لكل بند، الحضور، القرارات، ومهام تتحوّل لـ«جدول المهام».
// جنب الأجندة «تحضير من البيانات» (أرقام الأسبوع والصالونات بحاجة انتباه) و«من الاجتماع الماضي».

import React, { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDown, Bookmark, RotateCcw, ArrowUp, CalendarCheck, CalendarDays, Check, ClipboardList, Copy, FileText, Gavel,
  ListChecks, ListTodo, Plus, Sparkles, Trash2, Users, X,
} from "lucide-react";
import { needsAttention, type RoomData, type RoomOps } from "./SalonRoom";
import { weekProgress } from "./metrics";
import { sessionMetrics } from "./FreeSession";
import { boardStatus } from "@/lib/salon-room-board";
import {
  MEETING_KINDS, agendaFor, agendaMinutes, meetingKind, newId,
  type AgendaItem, type Meeting, type MeetingAction, type MeetingKind, type TemplateItem,
} from "@/lib/salon-room-meetings";
import { NoteEditor, noteToPlain } from "./NoteEditor";
import { Avatar, Badge, DateInput, EmptyState, Field, Modal, SectionTitle, accGrad, addDaysKey, btnGhost, btnPrimary, card, dateLabel, fmt, input, todayKey } from "./ui";

type Props = { data: RoomData; me: string; ops: RoomOps; onOpen: (clientId: string) => void; onTasks: () => void; copy: (t: string, msg?: string) => void };

export default function TeamMeeting({ data, me, ops, onOpen, onTasks, copy }: Props) {
  const today = todayKey();
  const [selId, setSelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const upcoming = useMemo(() => data.meetings.filter((m) => m.status === "planned" && m.meeting_date >= today)
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date) || (a.start_time ?? "").localeCompare(b.start_time ?? "")), [data.meetings, today]);
  const past = useMemo(() => data.meetings.filter((m) => !(m.status === "planned" && m.meeting_date >= today))
    .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date)), [data.meetings, today]);
  const sel = data.meetings.find((m) => m.id === selId) ?? upcoming[0] ?? past[0] ?? null;

  const label = (m: Meeting) => `${dateLabel(m.meeting_date)} — ${m.title}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-xl font-black text-[var(--ink)]"><CalendarCheck size={20} className="text-[var(--acc)]" /> اجتماع الفريق</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">أجندة واضحة بوقت لكل بند، ملاحظات تتدوّن وقت الاجتماع، وقرارات ومهام ما تضيع.</p>
        </div>
        <button onClick={() => setCreating(true)} className={`${btnPrimary} w-full sm:w-auto`} style={accGrad}><Plus size={15} /> اجتماع جديد</button>
      </div>

      {data.meetings.length === 0 ? (
        <EmptyState icon={CalendarCheck} text="ما فيه اجتماعات بعد — أنشئي «اجتماع الفريق الأسبوعي» وبتنضاف الأجندة جاهزة." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* قائمة الاجتماعات — قائمة منسدلة على الجوال */}
          <select value={sel?.id ?? ""} onChange={(e) => setSelId(e.target.value)} className={`${input} lg:hidden`} aria-label="اختيار الاجتماع">
            {upcoming.length > 0 && <optgroup label="القادمة">{upcoming.map((m) => <option key={m.id} value={m.id}>{label(m)}</option>)}</optgroup>}
            {past.length > 0 && <optgroup label="السابقة">{past.map((m) => <option key={m.id} value={m.id}>{label(m)}</option>)}</optgroup>}
          </select>
          <aside className={`${card} hidden h-fit space-y-4 p-3 lg:block`}>
            {[{ title: "القادمة", list: upcoming }, { title: "السابقة", list: past }].map((g) => g.list.length > 0 && (
              <div key={g.title}>
                <div className="mb-1.5 px-2 text-xs font-black text-[var(--faint)]">{g.title}</div>
                <ul className="space-y-1">
                  {g.list.map((m) => {
                    const k = meetingKind(m.kind);
                    const on = sel?.id === m.id;
                    return (
                      <li key={m.id}>
                        <button onClick={() => setSelId(m.id)} className="flex w-full items-center gap-2 rounded-2xl px-2.5 py-2 text-right transition-colors hover:bg-[var(--hover)]"
                          style={on ? { background: "color-mix(in srgb, var(--acc) 10%, transparent)" } : undefined}>
                          <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: k.color }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-[var(--ink)]">{m.title}</span>
                            <span className="block text-[11px] text-[var(--muted)]">{dateLabel(m.meeting_date, true)}{m.start_time ? ` · ${m.start_time}` : ""}</span>
                          </span>
                          {m.status === "held" && <Check size={14} className="shrink-0 text-emerald-600" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </aside>

          {sel && <MeetingEditor key={sel.id} m={sel} data={data} me={me} ops={ops} onOpen={onOpen} onTasks={onTasks} copy={copy} onDeleted={() => setSelId(null)} />}
        </div>
      )}

      {creating && (
        <NewMeetingModal data={data} me={me} onClose={() => setCreating(false)}
          onSave={async (f) => { const id = await ops.addMeeting(f); if (id) { setCreating(false); setSelId(id); } }} />
      )}
    </div>
  );
}

/* ──────────────────────────── اجتماع جديد ──────────────────────────── */

export type NewMeeting = Pick<Meeting, "title" | "kind" | "meeting_date" | "start_time" | "facilitator" | "attendees" | "agenda">;

function NewMeetingModal({ data, me, onClose, onSave }: { data: RoomData; me: string; onClose: () => void; onSave: (f: NewMeeting) => Promise<void> }) {
  const today = todayKey();
  // الافتراضي: الأحد الجاي (بداية أسبوع العمل) أو اليوم لو هو الأحد
  const [y, mo, d] = today.split("-").map(Number);
  const dow = new Date(y, mo - 1, d).getDay();
  const team = data.team.filter((m) => m.active).map((m) => m.name);
  const [f, setF] = useState<NewMeeting>({
    title: MEETING_KINDS[0].title, kind: "weekly", meeting_date: dow === 0 ? today : addDaysKey(today, 7 - dow), start_time: "10:00",
    facilitator: me || null, attendees: team, agenda: agendaFor("weekly", data.templates),
  });
  const [busy, setBusy] = useState(false);
  const pickKind = (kind: MeetingKind) => setF((p) => ({
    ...p, kind, agenda: agendaFor(kind, data.templates),
    title: MEETING_KINDS.some((k) => k.title === p.title) || !p.title.trim() ? meetingKind(kind).title : p.title,
  }));
  return (
    <Modal title="اجتماع جديد" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (!f.title.trim()) return; setBusy(true); await onSave(f); setBusy(false); }}>
        <Field label="نوع الاجتماع" group>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {MEETING_KINDS.map((k) => (
              <button type="button" key={k.id} onClick={() => pickKind(k.id)} className="rounded-xl border px-2 py-2 text-xs font-bold"
                style={f.kind === k.id ? { borderColor: k.color, color: k.color, background: `color-mix(in srgb, ${k.color} 12%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                {k.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="العنوان"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={input} /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="التاريخ" group><DateInput value={f.meeting_date} onChange={(v) => v && setF({ ...f, meeting_date: v })} quick label="تاريخ الاجتماع" required /></Field>
          <Field label="الوقت"><input type="time" value={f.start_time ?? ""} onChange={(e) => setF({ ...f, start_time: e.target.value || null })} className={input} /></Field>
          <Field label="تدير الاجتماع">
            <select value={f.facilitator ?? ""} onChange={(e) => setF({ ...f, facilitator: e.target.value || null })} className={input}>
              <option value="">—</option>
              {team.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        {f.agenda.length > 0 && (
          <div className="rounded-2xl bg-[var(--surface-2)] p-3 text-xs text-[var(--body)]">
            <b className="text-[var(--ink)]">{data.templates[f.kind] ? "أجندة الفريق المحفوظة" : "الأجندة الجاهزة"} ({fmt(agendaMinutes(f))} دقيقة):</b>
            <ol className="mt-1 list-inside list-decimal space-y-0.5">{f.agenda.map((a) => <li key={a.id}>{a.title}</li>)}</ol>
            <div className="mt-1 text-[var(--muted)]">تقدرين تعدّلينها وتضيفين بنود بعد الإنشاء.</div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>إلغاء</button>
          <button disabled={busy || !f.title.trim() || !f.meeting_date} className={btnPrimary} style={accGrad}><Plus size={15} /> إنشاء الاجتماع</button>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────── محرّر الاجتماع ──────────────────────────── */

function MeetingEditor({ m, data, me, ops, onOpen, onTasks, copy, onDeleted }: Props & { m: Meeting; onDeleted: () => void }) {
  const k = meetingKind(m.kind);
  const team = data.team.filter((t) => t.active).map((t) => t.name);
  const people = [...new Set([...team, ...m.attendees])];
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set(m.agenda.filter((a) => a.notes).map((a) => a.id)));
  const upd = (patch: Partial<Meeting>, debounce = false) => ops.patchMeeting(m.id, patch, debounce);
  const setAgenda = (fn: (a: AgendaItem[]) => AgendaItem[], debounce = false) => upd({ agenda: fn(m.agenda) }, debounce);
  const editItem = (id: string, patch: Partial<AgendaItem>, debounce = false) => setAgenda((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)), debounce);
  const move = (i: number, dir: -1 | 1) => setAgenda((a) => {
    const j = i + dir;
    if (j < 0 || j >= a.length) return a;
    const next = [...a];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const addItem = (title = "", owner: string | null = null) => {
    const item: AgendaItem = { id: newId(), title, owner, minutes: 5, done: false, notes: "" };
    setAgenda((a) => [...a, item]);
  };
  const setActions = (fn: (a: MeetingAction[]) => MeetingAction[], debounce = false) => upd({ actions: fn(m.actions) }, debounce);
  const editAction = (id: string, patch: Partial<MeetingAction>, debounce = false) => setActions((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)), debounce);

  const toBoard = async (a: MeetingAction) => {
    if (!a.body.trim()) return;
    const id = await ops.addBoard({
      category: "other", title: a.body.trim().slice(0, 200), body: `من «${m.title}» — ${dateLabel(m.meeting_date, true)}`,
      assignee: a.assignee, priority: "B", due_date: a.due_date, steps: [],
    });
    if (id) editAction(a.id, { task_id: id });
  };

  const total = agendaMinutes(m);
  const doneItems = m.agenda.filter((a) => a.done).length;

  const minutesText = () => {
    const lines = [`📋 محضر ${m.title}`, `📅 ${dateLabel(m.meeting_date, true)}${m.start_time ? ` — ${m.start_time}` : ""}`];
    if (m.facilitator) lines.push(`🎙️ أدارته: ${m.facilitator}`);
    if (m.attendees.length) lines.push(`👥 الحضور: ${m.attendees.join("، ")}`);
    if (m.agenda.length) {
      lines.push("", "🗂️ الأجندة:");
      m.agenda.forEach((a, i) => {
        lines.push(`${i + 1}. ${a.title}${a.done ? " ✓" : ""}`);
        if (a.notes.trim()) lines.push(...noteToPlain(a.notes).trim().split("\n").filter((l) => l.trim()).map((l) => `   • ${l.trim()}`));
      });
    }
    if (m.notes.trim()) lines.push("", "📝 ملاحظات عامة:", noteToPlain(m.notes).trim());
    const decisions = m.decisions.filter((d) => d.body.trim());
    if (decisions.length) lines.push("", "✅ القرارات:", ...decisions.map((d) => `- ${d.body.trim()}`));
    const actions = m.actions.filter((a) => a.body.trim());
    if (actions.length) lines.push("", "📌 المهام:", ...actions.map((a) => `- ${a.body.trim()}${a.assignee ? ` — ${a.assignee}` : ""}${a.due_date ? ` (${dateLabel(a.due_date)})` : ""}`));
    return lines.join("\n");
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* الرأس */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={k.color}>{k.label}</Badge>
          {m.status === "held" ? <Badge color="#059669"><Check size={10} /> تم عقده</Badge> : <Badge color="#2563EB">مجدول</Badge>}
          <span className="text-[11px] text-[var(--faint)]">{fmt(total)} دقيقة · {fmt(doneItems)} من {fmt(m.agenda.length)} بنود</span>
          <div className="ms-auto flex gap-1.5">
            <button onClick={() => copy(minutesText(), "تم نسخ المحضر")} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><Copy size={13} /> نسخ المحضر</button>
            <button onClick={() => { if (confirm(`حذف «${m.title}»؟`)) { ops.deleteMeeting(m.id); onDeleted(); } }} className={`${btnGhost} !px-2.5 !py-1.5 text-red-600`} aria-label="حذف الاجتماع"><Trash2 size={13} /></button>
          </div>
        </div>
        <input value={m.title} onChange={(e) => upd({ title: e.target.value }, true)} className="mt-3 w-full bg-transparent text-xl font-black text-[var(--ink)] outline-none" aria-label="عنوان الاجتماع" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="التاريخ" group><DateInput value={m.meeting_date} onChange={(v) => v && upd({ meeting_date: v })} label="تاريخ الاجتماع" /></Field>
          <Field label="الوقت"><input type="time" value={m.start_time ?? ""} onChange={(e) => upd({ start_time: e.target.value || null })} className={input} /></Field>
          <Field label="تدير الاجتماع">
            <select value={m.facilitator ?? ""} onChange={(e) => upd({ facilitator: e.target.value || null })} className={input}>
              <option value="">—</option>
              {people.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="الحالة" group>
            <div className="flex gap-1">
              {([["planned", "مجدول"], ["held", "تم عقده"]] as const).map(([v, l]) => (
                <button key={v} onClick={() => upd({ status: v })} className="flex-1 rounded-xl border px-2 py-2 text-xs font-bold"
                  style={m.status === v ? { borderColor: "var(--acc)", color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-[var(--muted)]"><Users size={13} /> الحضور ({fmt(m.attendees.length)} من {fmt(people.length)})</div>
          <div className="flex flex-wrap gap-1.5">
            {people.map((n) => {
              const on = m.attendees.includes(n);
              return (
                <button key={n} onClick={() => upd({ attendees: on ? m.attendees.filter((x) => x !== n) : [...m.attendees, n] })}
                  className="flex items-center gap-1.5 rounded-full border py-1 pe-3 ps-1 text-xs font-bold transition-opacity"
                  style={on ? { borderColor: "var(--acc)", color: "var(--ink)" } : { borderColor: "var(--line)", color: "var(--faint)", opacity: 0.7 }}>
                  <Avatar name={n} size={20} /> {n} {on && <Check size={12} className="text-emerald-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* الأجندة */}
          <div className={`${card} p-4 sm:p-5`}>
            <SectionTitle icon={ListChecks} title="الأجندة وملاحظات كل بند" action={<button onClick={() => addItem()} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><Plus size={13} /> بند</button>} />
            {m.agenda.length === 0 && <p className="text-xs text-[var(--faint)]">ما فيه بنود — أضيفي أول بند.</p>}
            <ol className="space-y-2">
              {m.agenda.map((a, i) => {
                const notesOpen = openNotes.has(a.id) || !!a.notes;
                return (
                  <li key={a.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5" style={a.done ? { background: "color-mix(in srgb, #059669 6%, var(--surface))" } : undefined}>
                    <div className="flex items-start gap-2">
                      <button onClick={() => editItem(a.id, { done: !a.done })} className="mt-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2" aria-label={a.done ? "إلغاء" : "تمت مناقشته"}
                        style={a.done ? { background: "#059669", borderColor: "#059669", color: "#fff" } : { borderColor: "var(--line-strong)" }}>
                        {a.done && <Check size={12} />}
                      </button>
                      <span className="mt-1.5 w-5 shrink-0 text-center text-xs font-black text-[var(--faint)]">{fmt(i + 1)}</span>
                      <div className="min-w-0 flex-1">
                        <textarea value={a.title} onChange={(e) => editItem(a.id, { title: e.target.value.replace(/\n/g, " ") }, true)} placeholder="عنوان البند"
                          rows={Math.max(1, Math.ceil(a.title.length / 40))} style={{ fieldSizing: "content" } as React.CSSProperties}
                          className={`w-full resize-none bg-transparent py-1 text-sm font-bold leading-snug outline-none placeholder:text-[var(--faint)] ${a.done ? "text-[var(--muted)]" : "text-[var(--ink)]"}`} aria-label={`البند ${i + 1}`} />
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <select value={a.owner ?? ""} onChange={(e) => editItem(a.id, { owner: e.target.value || null })} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold text-[var(--body)] outline-none" aria-label="مسؤولة البند">
                            <option value="">بدون مسؤولة</option>
                            {people.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <label className="flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--body)]">
                            <input type="number" min={0} max={600} value={a.minutes ?? ""} onChange={(e) => editItem(a.id, { minutes: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) }, true)}
                              className="w-9 bg-transparent text-center outline-none" aria-label="الدقائق" /> د
                          </label>
                          {!notesOpen && (
                            <button onClick={() => setOpenNotes((s) => new Set(s).add(a.id))} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold hover:bg-[var(--hover)]" style={{ color: "var(--acc)" }}>
                              <FileText size={11} /> ملاحظات
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col">
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-[var(--faint)] hover:text-[var(--ink)] disabled:opacity-30" aria-label="لأعلى"><ArrowUp size={13} /></button>
                        <button onClick={() => move(i, 1)} disabled={i === m.agenda.length - 1} className="p-0.5 text-[var(--faint)] hover:text-[var(--ink)] disabled:opacity-30" aria-label="لأسفل"><ArrowDown size={13} /></button>
                      </div>
                      <button onClick={() => setAgenda((x) => x.filter((y) => y.id !== a.id))} className="mt-1 shrink-0 p-0.5 text-[var(--faint)] hover:text-red-600" aria-label="حذف البند"><X size={14} /></button>
                    </div>
                    {notesOpen && (
                      <div className="mt-2">
                        <NoteEditor value={a.notes} onChange={(v) => editItem(a.id, { notes: v }, true)} minLines={2}
                          placeholder="وش انقال في هالبند؟ أرقام، عوائق، اتفاقات…" label={`ملاحظات البند ${i + 1}`} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <TemplateBar m={m} data={data} ops={ops} />
          </div>

          {/* ملاحظات عامة */}
          <div className={`${card} p-4 sm:p-5`}>
            <SectionTitle icon={FileText} title="ملاحظات الاجتماع" />
            <NoteEditor value={m.notes} onChange={(v) => upd({ notes: v }, true)} minLines={6} placeholder="أي شي انقال خارج البنود، أفكار، ملاحظات للمتابعة… وظلّلي المهم" label="ملاحظات الاجتماع" />
          </div>

          {/* القرارات */}
          <div className={`${card} p-4 sm:p-5`}>
            <SectionTitle icon={Gavel} title="القرارات" action={<button onClick={() => upd({ decisions: [...m.decisions, { id: newId(), body: "" }] })} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><Plus size={13} /> قرار</button>} />
            {m.decisions.length === 0 && <p className="text-xs text-[var(--faint)]">ما فيه قرارات مسجّلة.</p>}
            <ul className="space-y-1.5">
              {m.decisions.map((d, i) => (
                <li key={d.id} className="flex items-center gap-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black text-[var(--on-acc)]" style={accGrad}>{fmt(i + 1)}</span>
                  <input value={d.body} onChange={(e) => upd({ decisions: m.decisions.map((x) => (x.id === d.id ? { ...x, body: e.target.value } : x)) }, true)} placeholder="القرار" className={input} aria-label={`القرار ${i + 1}`} />
                  <button onClick={() => upd({ decisions: m.decisions.filter((x) => x.id !== d.id) })} className="shrink-0 text-[var(--faint)] hover:text-red-600" aria-label="حذف القرار"><X size={14} /></button>
                </li>
              ))}
            </ul>
          </div>

          {/* المهام الناتجة */}
          <div className={`${card} p-4 sm:p-5`}>
            <SectionTitle icon={ListTodo} title="المهام الناتجة" action={<button onClick={() => setActions((a) => [...a, { id: newId(), body: "", assignee: null, due_date: null, task_id: null }])} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><Plus size={13} /> مهمة</button>} />
            {m.actions.length === 0 && <p className="text-xs text-[var(--faint)]">كل مهمة تطلع من الاجتماع سجّليها هنا بمسؤولة وموعد، وحوّليها لـ«جدول المهام» عشان تنتابع.</p>}
            <ul className="space-y-2">
              {m.actions.map((a) => {
                const task = a.task_id ? data.board.find((t) => t.id === a.task_id) : null;
                return (
                  <li key={a.id} className="rounded-2xl border border-[var(--line)] p-2.5">
                    <div className="flex items-center gap-2">
                      <input value={a.body} onChange={(e) => editAction(a.id, { body: e.target.value }, true)} placeholder="المهمة" className={input} aria-label="المهمة" />
                      <button onClick={() => setActions((x) => x.filter((y) => y.id !== a.id))} className="shrink-0 text-[var(--faint)] hover:text-red-600" aria-label="حذف المهمة"><X size={14} /></button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <select value={a.assignee ?? ""} onChange={(e) => editAction(a.id, { assignee: e.target.value || null })} className={input} aria-label="المسؤولة">
                        <option value="">المسؤولة</option>
                        {people.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <DateInput value={a.due_date} onChange={(v) => editAction(a.id, { due_date: v })} label="الموعد" />
                      {a.task_id ? (
                        <button onClick={onTasks} className="flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold" style={{ color: task ? boardStatus(task.status).color : "var(--muted)", background: "var(--surface-2)" }}>
                          <ClipboardList size={13} /> {task ? `في الجدول: ${boardStatus(task.status).label}` : "حُذفت من الجدول"}
                        </button>
                      ) : (
                        <button onClick={() => toBoard(a)} disabled={!a.body.trim()} className={`${btnGhost} !py-2 text-xs`}><ClipboardList size={13} /> أضف لجدول المهام</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <Prep m={m} data={data} me={me} onOpen={onOpen} onTasks={onTasks} addItem={addItem} />
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── التحضير من البيانات ──────────────────────────── */

function Prep({ m, data, onOpen, onTasks, addItem }: {
  m: Meeting; data: RoomData; me: string; onOpen: (id: string) => void; onTasks: () => void; addItem: (title: string, owner: string | null) => void;
}) {
  const today = todayKey();
  const in7 = addDaysKey(today, 7);
  const [now] = useState(() => Date.now());
  const w = weekProgress(data.clients, data.logs, now);
  const sm = sessionMetrics(data.clients, data.targets, now);
  const attention = data.clients.filter((c) => needsAttention(c, data.tasks, today));
  const ids = new Set(data.clients.map((c) => c.id));
  const overdue = data.tasks.filter((t) => ids.has(t.client_id) && !t.done_at && t.due_date && t.due_date < today).length;
  const reviews = data.clients.filter((c) => c.next_review && c.next_review >= today && c.next_review <= in7).length;
  const boardLate = data.board.filter((t) => t.status !== "done" && t.due_date && t.due_date < today);
  const boardReview = data.board.filter((t) => t.status === "review");
  const onAgenda = (title: string) => m.agenda.some((a) => a.title === title);

  // آخر اجتماع قبل هذا — متابعة مهامه
  const prev = data.meetings.filter((x) => x.id !== m.id && x.meeting_date <= m.meeting_date && x.actions.length > 0)
    .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date))[0];
  const followTitle = prev ? `متابعة مهام «${prev.title}» (${dateLabel(prev.meeting_date)})` : "";

  const metric = (label: string, v: number, target: number) => (
    <div className="rounded-xl bg-[var(--surface-2)] px-2.5 py-2">
      <div className="text-[10px] font-bold text-[var(--muted)]">{label}</div>
      <div className="text-sm font-black" style={{ color: target && v >= target ? "#059669" : "var(--ink)" }}>{fmt(v)} <span className="text-[10px] font-bold text-[var(--faint)]">/ {fmt(target)}</span></div>
    </div>
  );

  return (
    <>
      <div className={`${card} p-4`}>
        <SectionTitle icon={Sparkles} title="تحضير من البيانات" />
        <div className="text-[11px] font-bold text-[var(--faint)]">أرقام الأسبوع مقابل الأهداف</div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {metric("تواصل", w.contacts, data.targets.contacts)}
          {metric("اجتماعات", w.meetings, data.targets.meetings)}
          {metric("عقود", w.contracts, data.targets.contracts)}
          {metric("جلسات مجانية", sm.thisWeek, data.targets.sessions_cap)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-xl border border-[var(--line)] p-2"><div className="text-base font-black" style={{ color: attention.length ? "#D9A21B" : "var(--ink)" }}>{fmt(attention.length)}</div><div className="text-[10px] font-bold text-[var(--muted)]">بحاجة انتباه</div></div>
          <div className="rounded-xl border border-[var(--line)] p-2"><div className="text-base font-black" style={{ color: overdue ? "#DC2626" : "var(--ink)" }}>{fmt(overdue)}</div><div className="text-[10px] font-bold text-[var(--muted)]">مهام متأخرة</div></div>
          <div className="rounded-xl border border-[var(--line)] p-2"><div className="text-base font-black text-[var(--ink)]">{fmt(reviews)}</div><div className="text-[10px] font-bold text-[var(--muted)]">مراجعات ٧ أيام</div></div>
        </div>

        {attention.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-bold text-[var(--faint)]"><AlertTriangle size={11} /> صالونات للنقاش</div>
            <ul className="space-y-1">
              {attention.slice(0, 8).map((c) => {
                const title = `متابعة: ${c.salon_name}`;
                return (
                  <li key={c.id} className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-2 py-1.5">
                    <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 truncate text-right text-xs font-bold text-[var(--ink)] hover:underline">{c.salon_name}</button>
                    {c.consultant && <span className="shrink-0 text-[10px] text-[var(--muted)]">{c.consultant}</span>}
                    <button onClick={() => addItem(title, c.consultant)} disabled={onAgenda(title)} className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black disabled:opacity-40" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" }}>
                      {onAgenda(title) ? "بالأجندة" : "+ للأجندة"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {(boardLate.length > 0 || boardReview.length > 0) && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-[var(--faint)]">
              <span><ClipboardList size={11} className="me-1 inline" /> من جدول المهام</span>
              <button onClick={onTasks} className="hover:underline" style={{ color: "var(--acc)" }}>فتح</button>
            </div>
            <ul className="space-y-1">
              {[...boardLate.map((t) => ({ t, tag: "متأخرة", color: "#DC2626" })), ...boardReview.map((t) => ({ t, tag: "مراجعة", color: "#D9A21B" }))].slice(0, 6).map(({ t, tag, color }) => (
                <li key={t.id} className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-2 py-1.5 text-xs">
                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink)]">{t.title}</span>
                  <Badge color={color}>{tag}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {prev && (
        <div className={`${card} p-4`}>
          <SectionTitle icon={CalendarDays} title="من الاجتماع الماضي" />
          <div className="mb-2 text-[11px] text-[var(--muted)]">{prev.title} — {dateLabel(prev.meeting_date, true)}</div>
          <ul className="space-y-1">
            {prev.actions.filter((a) => a.body.trim()).map((a) => {
              const task = a.task_id ? data.board.find((t) => t.id === a.task_id) : null;
              const st = task ? boardStatus(task.status) : null;
              return (
                <li key={a.id} className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-2 py-1.5 text-xs">
                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink)]">{a.body}</span>
                  {a.assignee && <Avatar name={a.assignee} size={18} />}
                  {st ? <Badge color={st.color}>{st.label}</Badge> : <Badge color="#7A6570">غير محوّلة</Badge>}
                </li>
              );
            })}
          </ul>
          <button onClick={() => addItem(followTitle, null)} disabled={onAgenda(followTitle)} className={`${btnGhost} mt-2 w-full !py-1.5 text-xs`}>
            {onAgenda(followTitle) ? "المتابعة موجودة بالأجندة" : "+ بند متابعة مهام الاجتماع الماضي"}
          </button>
        </div>
      )}
    </>
  );
}

/* ──────────────────────────── الأجندة الافتراضية ──────────────────────────── */

function TemplateBar({ m, data, ops }: { m: Meeting; data: RoomData; ops: RoomOps }) {
  const k = meetingKind(m.kind);
  const custom = data.templates[m.kind];
  const items: TemplateItem[] = m.agenda.filter((a) => a.title.trim()).map((a) => ({ title: a.title.trim(), minutes: a.minutes, owner: a.owner }));
  const current = agendaFor(m.kind, data.templates).map((a) => ({ title: a.title, minutes: a.minutes, owner: a.owner }));
  const same = JSON.stringify(items) === JSON.stringify(current);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!items.length || !confirm(`تصير هذي الأجندة (${fmt(items.length)} بنود) هي الافتراضية لكل اجتماع «${k.label}» جديد. الاجتماعات الحالية ما تتغيّر.`)) return;
    setBusy(true); await ops.saveTemplate(m.kind, items); setBusy(false);
  };
  const reset = async () => {
    if (!confirm(`نرجّع الأجندة الأصلية لاجتماعات «${k.label}» الجديدة؟`)) return;
    setBusy(true); await ops.saveTemplate(m.kind, null); setBusy(false);
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--surface-2)] px-3 py-2 text-[11px]">
      <Bookmark size={13} className="shrink-0 text-[var(--acc)]" />
      <span className="min-w-0 flex-1 font-bold text-[var(--muted)]">
        {same ? `هذي هي الأجندة الافتراضية لاجتماعات «${k.label}»${custom ? " (محفوظة من الفريق)" : ""}` : `عدّلتي الأجندة؟ احفظيها عشان تنضاف تلقائياً لكل اجتماع «${k.label}» جديد`}
      </span>
      {!same && <button onClick={save} disabled={busy || !items.length} className={`${btnPrimary} !px-3 !py-1.5 text-xs`} style={accGrad}><Bookmark size={12} /> احفظ كأجندة افتراضية</button>}
      {custom && <button onClick={reset} disabled={busy} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><RotateCcw size={12} /> رجوع للأصلية</button>}
    </div>
  );
}
