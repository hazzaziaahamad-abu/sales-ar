"use client";

// «جدول المهام للمستشارين» — لوحة استكرات (بنفس فكرة صفحة «أفكار») لمهام الفريق العامة:
// متابعة المنافسين، تقييم أفكار جديدة، محتوى، تدريب… لكل مهمة مسؤولة وموعد وخطوات وتحديثات تقدّم.

import React, { useMemo, useState } from "react";
import { CalendarClock, Check, CheckCircle2, ClipboardList, Clock, ListChecks, MessageSquarePlus, Plus, Search, Trash2, X } from "lucide-react";
import type { Priority } from "@/lib/salon-room";
import {
  BOARD_CATEGORIES, BOARD_STATUSES, boardCategory, boardProgress, boardStatus, stepsFor,
  type BoardCategory, type BoardStatus, type BoardStep, type BoardTask,
} from "@/lib/salon-room-board";
import type { RoomData, RoomOps } from "./SalonRoom";
import { NoteEditor, noteToHtml } from "./NoteEditor";
import { Avatar, Badge, EmptyState, Field, Modal, accGrad, btnGhost, btnPrimary, card, dateLabel, fmt, input, timeAgo, todayKey } from "./ui";

const CSS = `
.tb-hand { font-family: var(--font-hand), var(--font-tajawal), sans-serif; }
.tb-board { position:relative; border-radius:28px; padding:40px 22px 48px; min-height:320px;
  background-color: color-mix(in srgb, var(--surface-2) 70%, var(--bg));
  background-image: radial-gradient(color-mix(in srgb, var(--line-strong) 85%, transparent) 1.1px, transparent 1.2px);
  background-size: 22px 22px; box-shadow: inset 0 0 0 1px var(--line); }
.tb-grid { display:flex; flex-wrap:wrap; gap:34px 24px; justify-content:center; align-items:flex-start; }
.tb-slot { position:relative; }
.tb-sticker { position:relative; width:220px; min-height:200px; cursor:pointer; text-align:right; border:0; padding:0; background:none; display:block;
  transition: transform .25s cubic-bezier(.2,.8,.2,1.2), filter .25s ease;
  filter: drop-shadow(3px 6px 6px rgba(15,23,42,.14)) drop-shadow(1px 2px 1px rgba(15,23,42,.08)); }
.tb-sticker:hover, .tb-sticker:focus-visible { transform: translateY(-6px) scale(1.04) rotate(0deg) !important; z-index:10; outline:none;
  filter: drop-shadow(8px 18px 16px rgba(15,23,42,.2)) drop-shadow(1px 2px 1px rgba(15,23,42,.08)); }
.tb-paper { position:relative; min-height:200px; padding:26px 18px 14px; display:flex; flex-direction:column; border-radius:4px 20px 4px 4px; }
.tb-paper::after { content:""; position:absolute; left:0; bottom:0; width:26px; height:26px; border-top-right-radius:6px;
  background: linear-gradient(45deg, color-mix(in srgb, var(--surface-2) 70%, var(--bg)) 50%, rgba(0,0,0,.12) 50%); }
.tb-pin { position:absolute; top:-9px; left:50%; width:20px; height:20px; margin-left:-10px; border-radius:50%; z-index:3;
  background: radial-gradient(circle at 35% 30%, #fff 0 2px, var(--pin) 3px 100%);
  box-shadow: 0 4px 5px -1px rgba(15,23,42,.35), inset -2px -3px 4px rgba(0,0,0,.18); }
.tb-stamp { position:absolute; top:12px; left:10px; z-index:4; padding:1px 9px; border-radius:6px; transform:rotate(-12deg);
  font-family: var(--font-hand), sans-serif; font-weight:700; font-size:13px; border:2px solid currentColor; background:rgba(255,255,255,.7); }
.tb-tag { font-size:11px; font-weight:800; opacity:.72; }
.tb-title { font-family: var(--font-hand), sans-serif; font-size:18px; font-weight:700; line-height:1.4; margin:6px 0 4px; word-break:break-word; }
.tb-body span[style*="background"] { border-radius:4px; padding:0 2px; -webkit-box-decoration-break:clone; box-decoration-break:clone; color:#2A1018; }
.tb-body { font-size:12.5px; line-height:1.65; white-space:pre-wrap; word-break:break-word; opacity:.82;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.tb-foot { margin-top:auto; padding-top:10px; display:flex; flex-wrap:wrap; align-items:center; gap:5px; font-size:10.5px; font-weight:800; }
.tb-chip { display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border-radius:999px; background:rgba(255,255,255,.6); white-space:nowrap; }
.tb-chip.tb-late { background:#fee2e2; color:#b91c1c; }
.tb-meter { height:5px; border-radius:99px; background:rgba(0,0,0,.12); overflow:hidden; margin-top:8px; }
.tb-meter > i { display:block; height:100%; border-radius:inherit; background:currentColor; transition: width .3s ease; }
.tb-pad { display:inline-flex; align-items:center; gap:6px; height:42px; padding:0 14px; border-radius:10px; font-size:12.5px; font-weight:800; cursor:pointer;
  transition: transform .2s ease; box-shadow: 0 3px 0 -1px rgba(0,0,0,.08), 0 6px 0 -2px rgba(0,0,0,.06); }
.tb-pad:hover { transform: translateY(-3px) rotate(-2deg); }
@media (max-width: 640px) {
  .tb-board { padding:30px 8px 36px; border-radius:22px; }
  .tb-grid { gap:26px 8px; }
  .tb-sticker { width:142px; min-height:160px; }
  .tb-paper { min-height:160px; padding:22px 11px 10px; }
  .tb-title { font-size:14.5px; }
  .tb-body { font-size:11px; -webkit-line-clamp:2; }
  .tb-tag { font-size:9.5px; }
  .tb-foot { font-size:9.5px; gap:3px; }
  .tb-chip { padding:1px 5px; }
  .tb-stamp { font-size:11px; top:8px; left:6px; }
}
`;

const seed = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};
const tiltOf = (id: string) => ((seed(id) % 5) - 2) * 1.2;
const dropOf = (id: string) => (seed(id) >> 5) % 18;

type StatusFilter = "open" | BoardStatus | "all";
type Sort = "due" | "new" | "priority";
const PRIORITY_RANK: Record<Priority, number> = { A: 0, B: 1, C: 2 };
const TASK_PRIORITIES: { id: Priority; label: string; color: string }[] = [
  { id: "A", label: "عالية", color: "#DC2626" },
  { id: "B", label: "متوسطة", color: "#D9A21B" },
  { id: "C", label: "عادية", color: "#7A6570" },
];

export default function TaskBoard({ data, me, ops }: { data: RoomData; me: string; ops: RoomOps }) {
  const today = todayKey();
  const month = today.slice(0, 7);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [who, setWho] = useState("all");
  const [cat, setCat] = useState<BoardCategory | "all">("all");
  const [sort, setSort] = useState<Sort>("due");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<BoardCategory | null>(null);

  const board = data.board;
  const isLate = (t: BoardTask) => t.status !== "done" && !!t.due_date && t.due_date < today;
  const stats = useMemo(() => ({
    open: board.filter((t) => t.status !== "done").length,
    doing: board.filter((t) => t.status === "doing").length,
    review: board.filter((t) => t.status === "review").length,
    late: board.filter((t) => t.status !== "done" && !!t.due_date && t.due_date < today).length,
    doneMonth: board.filter((t) => t.completed_at && todayKey(Date.parse(t.completed_at)).slice(0, 7) === month).length,
    mine: board.filter((t) => t.status !== "done" && t.assignee === me).length,
  }), [board, today, month, me]);

  const list = useMemo(() => {
    const term = q.trim();
    const rows = board.filter((t) =>
      (status === "all" || (status === "open" ? t.status !== "done" : t.status === status)) &&
      (who === "all" || (who === "me" ? t.assignee === me : who === "none" ? !t.assignee : t.assignee === who)) &&
      (cat === "all" || t.category === cat) &&
      (!term || [t.title, t.body, t.assignee].some((x) => x?.includes(term))));
    const due = (t: BoardTask) => t.due_date ?? "9999";
    return [...rows].sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
      if (sort === "new") return b.created_at.localeCompare(a.created_at);
      if (sort === "priority") return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || due(a).localeCompare(due(b));
      return due(a).localeCompare(due(b)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });
  }, [board, status, who, cat, sort, q, me]);

  const open = board.find((t) => t.id === openId) ?? null;
  const members = data.team.filter((m) => m.active);
  const chip = (on: boolean) => (on ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" });

  return (
    <div className="space-y-5">
      <style>{CSS}</style>

      {/* الهيرو */}
      <div className={`${card} relative overflow-hidden p-5 sm:p-6`}>
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(500px 200px at 90% -20%, rgba(250,204,21,.18), transparent 70%), radial-gradient(400px 220px at 5% 120%, rgba(244,114,182,.14), transparent 70%)" }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-xl font-black text-[var(--ink)] sm:text-2xl"><ClipboardList size={22} className="text-[var(--acc)]" /> جدول المهام للمستشارين</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">مهام الفريق العامة غير المرتبطة بصالون — نسجّلها، نوزّعها، ونتابع تقدّمها خطوة بخطوة.</p>
          </div>
          <button onClick={() => setCreating("other")} className={`${btnPrimary} w-full sm:w-auto`} style={accGrad}><Plus size={15} /> مهمة جديدة</button>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "مفتوحة", value: stats.open },
            { label: "قيد التنفيذ", value: stats.doing },
            { label: "بانتظار المراجعة", value: stats.review, tone: stats.review ? "#D9A21B" : undefined },
            { label: "متأخرة", value: stats.late, tone: stats.late ? "#DC2626" : undefined },
            { label: "منجزة هذا الشهر", value: stats.doneMonth, tone: stats.doneMonth ? "#059669" : undefined },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[11px] font-bold text-[var(--muted)]">{s.label}</div>
              <div className="text-xl font-black" style={{ color: s.tone ?? "var(--ink)" }}>{fmt(s.value)}</div>
            </div>
          ))}
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs font-bold text-[var(--faint)]">إضافة سريعة:</span>
          {BOARD_CATEGORIES.filter((c) => c.id !== "other").map((c) => (
            <button key={c.id} onClick={() => setCreating(c.id)} className="tb-pad" style={{ background: c.paper, color: c.ink }}>
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* الفلاتر */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {([{ id: "open", label: "المفتوحة" }, ...BOARD_STATUSES.map((s) => ({ id: s.id, label: s.label })), { id: "all", label: "الكل" }] as { id: StatusFilter; label: string }[]).map((x) => (
            <button key={x.id} onClick={() => setStatus(x.id)} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors" style={chip(status === x.id)}>{x.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {[{ id: "all", label: "كل الفريق" }, { id: "me", label: `مهامي (${fmt(stats.mine)})` }, ...members.filter((m) => m.name !== me).map((m) => ({ id: m.name, label: m.name })), { id: "none", label: "بدون مسؤولة" }].map((x) => (
              <button key={x.id} onClick={() => setWho(x.id)} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors" style={chip(who === x.id)}>{x.label}</button>
            ))}
          </div>
          <div className="ms-auto flex w-full flex-wrap gap-2 sm:w-auto">
            <select value={cat} onChange={(e) => setCat(e.target.value as BoardCategory | "all")} className={`${input} !w-auto flex-1 sm:flex-none`} aria-label="التصنيف">
              <option value="all">كل التصنيفات</option>
              {BOARD_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${input} !w-auto flex-1 sm:flex-none`} aria-label="الترتيب">
              <option value="due">الأقرب موعداً</option>
              <option value="priority">الأولوية</option>
              <option value="new">الأحدث</option>
            </select>
            <div className="relative w-full sm:w-52">
              <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في المهام" className={`${input} ps-8`} />
            </div>
          </div>
        </div>
      </div>

      {/* اللوحة */}
      {board.length === 0 ? (
        <EmptyState icon={ClipboardList} text="ما فيه مهام بعد — ابدئي بمهمة «متابعة المنافسين» أو «تقييم فكرة جديدة» من الإضافة السريعة." />
      ) : list.length === 0 ? (
        <EmptyState icon={Search} text="ما فيه مهام تطابق الفلتر." />
      ) : (
        <div className="tb-board">
          <div className="tb-grid">
            {list.map((t) => <Sticker key={t.id} t={t} late={isLate(t)} onOpen={() => setOpenId(t.id)} />)}
          </div>
        </div>
      )}

      {creating && (
        <NewTaskModal category={creating} me={me} members={members.map((m) => m.name)} onClose={() => setCreating(null)}
          onSave={async (f) => { const id = await ops.addBoard(f); if (id) { setCreating(null); setOpenId(id); } }} />
      )}
      {open && <TaskModal t={open} me={me} members={members.map((m) => m.name)} ops={ops} today={today} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ──────────────────────────── الاستكر ──────────────────────────── */

function Sticker({ t, late, onOpen }: { t: BoardTask; late: boolean; onOpen: () => void }) {
  const c = boardCategory(t.category);
  const st = boardStatus(t.status);
  const pct = boardProgress(t);
  const stepsDone = t.steps.filter((s) => s.done_at).length;
  return (
    <div className="tb-slot" style={{ marginTop: dropOf(t.id) }}>
      <button onClick={onOpen} className="tb-sticker" style={{ transform: `rotate(${tiltOf(t.id)}deg)`, ["--pin" as string]: c.pin, opacity: t.status === "done" ? 0.78 : 1 }} aria-label={t.title}>
        <span className="tb-pin" />
        <div className="tb-paper" style={{ background: `linear-gradient(170deg, color-mix(in srgb, ${c.paper} 55%, #fff), ${c.paper} 70%)`, color: c.ink }}>
          {(t.status === "done" || t.status === "review") && <span className="tb-stamp" style={{ color: t.status === "done" ? "#047857" : "#a16207" }}>{t.status === "done" ? "منجزة ✓" : "مراجعة"}</span>}
          <div className="tb-tag">{c.emoji} {c.label}{t.priority === "A" ? " · 🔥" : ""}</div>
          <div className="tb-title">{t.title}</div>
          {t.body && <div className="tb-body" dangerouslySetInnerHTML={{ __html: noteToHtml(t.body) }} />}
          <div className="tb-meter" title={`التقدّم ${Math.round(pct * 100)}٪`}><i style={{ width: `${Math.round(pct * 100)}%` }} /></div>
          <div className="tb-foot">
            {t.assignee ? <span className="tb-chip"><Avatar name={t.assignee} size={15} /> {t.assignee.split(" ")[0]}</span> : <span className="tb-chip">بدون مسؤولة</span>}
            {t.due_date && <span className={`tb-chip ${late ? "tb-late" : ""}`}><CalendarClock size={10} /> {dateLabel(t.due_date)}</span>}
            {t.steps.length > 0 ? <span className="tb-chip"><ListChecks size={10} /> {fmt(stepsDone)}/{fmt(t.steps.length)}</span> : t.status !== "done" && <span className="tb-chip" style={{ color: st.color }}>{st.label}</span>}
          </div>
        </div>
      </button>
    </div>
  );
}

/* ──────────────────────────── إضافة مهمة ──────────────────────────── */

export type NewBoardTask = { category: BoardCategory; title: string; body: string; assignee: string | null; priority: Priority; due_date: string | null; steps: BoardStep[] };

function NewTaskModal({ category, me, members, onClose, onSave }: {
  category: BoardCategory; me: string; members: string[]; onClose: () => void; onSave: (f: NewBoardTask) => Promise<void>;
}) {
  const [f, setF] = useState<NewBoardTask>({ category, title: "", body: "", assignee: me || null, priority: "B", due_date: null, steps: stepsFor(category) });
  const [busy, setBusy] = useState(false);
  const c = boardCategory(f.category);
  return (
    <Modal title="مهمة جديدة" onClose={onClose} wide>
      <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (!f.title.trim()) return; setBusy(true); await onSave(f); setBusy(false); }}>
        <Field label="التصنيف" group>
          <div className="flex flex-wrap gap-1.5">
            {BOARD_CATEGORIES.map((x) => (
              <button type="button" key={x.id} onClick={() => setF((p) => ({ ...p, category: x.id, steps: stepsFor(x.id) }))}
                className="rounded-full px-3 py-1.5 text-xs font-extrabold transition-transform hover:-translate-y-0.5"
                style={{ background: x.paper, color: x.ink, outline: f.category === x.id ? `2px solid ${x.ink}` : "none", outlineOffset: 2 }}>
                {x.emoji} {x.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="عنوان المهمة">
          <input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={input}
            placeholder={f.category === "competitors" ? "مثال: رصد عروض صالونات حي النرجس لهذا الشهر" : f.category === "ideas" ? "مثال: باقة عضوية شهرية للعناية بالشعر" : "اكتبي المهمة باختصار"} />
        </Field>
        <Field label="التفاصيل (اختياري)">
          <textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} rows={3} className={input} placeholder="المطلوب بالضبط، المصادر، أي ملاحظات" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="المسؤولة">
            <select value={f.assignee ?? ""} onChange={(e) => setF({ ...f, assignee: e.target.value || null })} className={input}>
              <option value="">بدون مسؤولة</option>
              {members.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="الموعد">
            <input type="date" value={f.due_date ?? ""} onChange={(e) => setF({ ...f, due_date: e.target.value || null })} className={input} />
          </Field>
          <Field label="الأولوية" group>
            <PriorityPicker value={f.priority} onChange={(priority) => setF({ ...f, priority })} />
          </Field>
        </div>
        {f.steps.length > 0 && (
          <div className="rounded-2xl p-3 text-xs" style={{ background: `color-mix(in srgb, ${c.paper} 45%, transparent)`, color: "var(--body)" }}>
            <b className="text-[var(--ink)]">خطوات «{c.label}» الافتراضية:</b> {f.steps.map((s) => s.label).join(" ← ")}
            <div className="mt-1 text-[var(--muted)]">تقدرين تعدّلينها بعد الإضافة.</div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>إلغاء</button>
          <button disabled={busy || !f.title.trim()} className={btnPrimary} style={accGrad}><Plus size={15} /> إضافة للجدول</button>
        </div>
      </form>
    </Modal>
  );
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="flex gap-1">
      {TASK_PRIORITIES.map((p) => (
        <button type="button" key={p.id} onClick={() => onChange(p.id)} className="flex-1 rounded-xl border px-2 py-2 text-xs font-bold"
          style={value === p.id ? { borderColor: p.color, color: p.color, background: `color-mix(in srgb, ${p.color} 12%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────── تفاصيل المهمة ──────────────────────────── */

function TaskModal({ t, me, members, ops, today, onClose }: { t: BoardTask; me: string; members: string[]; ops: RoomOps; today: string; onClose: () => void }) {
  const c = boardCategory(t.category);
  const pct = boardProgress(t);
  const [newStep, setNewStep] = useState("");
  const [note, setNote] = useState("");
  const late = t.status !== "done" && !!t.due_date && t.due_date < today;
  const patch = (p: Partial<BoardTask>, debounce = false) => ops.patchBoard(t.id, p, debounce);

  const toggleStep = (s: BoardStep) => {
    const now = new Date().toISOString();
    const steps = t.steps.map((x) => (x.key === s.key ? { ...x, done_at: x.done_at ? null : now, done_by: x.done_at ? null : me || null } : x));
    // أول خطوة منجزة تحوّل «جديدة» إلى «قيد التنفيذ»
    patch(t.status === "todo" && steps.some((x) => x.done_at) ? { steps, status: "doing" } : { steps });
  };
  const addStep = () => {
    const label = newStep.trim();
    if (!label) return;
    patch({ steps: [...t.steps, { key: `s${Date.now().toString(36)}`, label, done_at: null, done_by: null }] });
    setNewStep("");
  };
  const allDone = t.steps.length > 0 && t.steps.every((s) => s.done_at);

  return (
    <Modal title={`${c.emoji} ${c.label}`} onClose={onClose} wide>
      <div className="space-y-4">
        {/* العنوان والتفاصيل على ورقة بلون التصنيف */}
        <div className="rounded-2xl p-4" style={{ background: `linear-gradient(170deg, color-mix(in srgb, ${c.paper} 55%, #fff), ${c.paper} 80%)`, color: c.ink }}>
          <textarea value={t.title} onChange={(e) => patch({ title: e.target.value.replace(/\n/g, " ") }, true)} rows={2} className="tb-hand w-full resize-none bg-transparent text-lg font-bold leading-snug outline-none placeholder:opacity-40" aria-label="العنوان" />
          <div className="mt-2"><NoteEditor value={t.body} onChange={(v) => patch({ body: v }, true)} variant="bare" minLines={3} placeholder="التفاصيل… وظلّلي المهم" label="التفاصيل" /></div>
          <div className="mt-2 flex items-center gap-2 text-xs font-extrabold">
            <div className="tb-meter flex-1 !mt-0"><i style={{ width: `${Math.round(pct * 100)}%` }} /></div>
            <span>{fmt(Math.round(pct * 100))}٪</span>
          </div>
        </div>

        <Field label="الحالة" group>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {BOARD_STATUSES.map((s) => (
              <button key={s.id} onClick={() => patch({ status: s.id })} className="rounded-xl border px-2 py-2 text-xs font-bold"
                style={t.status === s.id ? { borderColor: s.color, color: s.color, background: `color-mix(in srgb, ${s.color} 12%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                {s.id === "done" && <Check size={12} className="me-1 inline" />}{s.label}
              </button>
            ))}
          </div>
        </Field>
        {t.status === "done" && t.completed_at && (
          <div className="text-xs font-bold text-emerald-600"><CheckCircle2 size={13} className="me-1 inline" /> أُنجزت {timeAgo(t.completed_at)}{t.completed_by ? ` — ${t.completed_by}` : ""}</div>
        )}
        {allDone && t.status !== "done" && t.status !== "review" && (
          <button onClick={() => patch({ status: "review" })} className="w-full rounded-2xl border border-dashed border-amber-400 p-2.5 text-xs font-bold text-amber-700 hover:bg-amber-50/50">
            كل الخطوات تمّت — حوّليها لـ«بانتظار المراجعة»
          </button>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="المسؤولة">
            <select value={t.assignee ?? ""} onChange={(e) => patch({ assignee: e.target.value || null })} className={input}>
              <option value="">بدون مسؤولة</option>
              {[...new Set([...members, ...(t.assignee ? [t.assignee] : [])])].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label={late ? "الموعد (متأخرة)" : "الموعد"}>
            <input type="date" value={t.due_date ?? ""} onChange={(e) => patch({ due_date: e.target.value || null })} className={input} style={late ? { borderColor: "#DC2626" } : undefined} />
          </Field>
          <Field label="الأولوية" group>
            <PriorityPicker value={t.priority} onChange={(priority) => patch({ priority })} />
          </Field>
        </div>

        {/* الخطوات */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-[var(--ink)]"><ListChecks size={15} className="text-[var(--acc)]" /> خطوات التنفيذ
            {t.steps.length > 0 && <Badge color="#059669">{fmt(t.steps.filter((s) => s.done_at).length)} من {fmt(t.steps.length)}</Badge>}
          </div>
          <div className="space-y-1.5">
            {t.steps.map((s) => (
              <div key={s.key} className="group flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                <button onClick={() => toggleStep(s)} className="grid h-5 w-5 shrink-0 place-items-center rounded-md border-2" aria-label={s.done_at ? "إلغاء الإنجاز" : "إنجاز"}
                  style={s.done_at ? { background: "#059669", borderColor: "#059669", color: "#fff" } : { borderColor: "var(--line-strong)" }}>
                  {s.done_at && <Check size={12} />}
                </button>
                <span className={`min-w-0 flex-1 text-sm ${s.done_at ? "text-[var(--faint)] line-through" : "text-[var(--ink)]"}`}>{s.label}</span>
                {s.done_at && <span className="hidden shrink-0 text-[10px] text-[var(--faint)] sm:inline">{s.done_by ?? ""} · {timeAgo(s.done_at)}</span>}
                <button onClick={() => patch({ steps: t.steps.filter((x) => x.key !== s.key) })} className="shrink-0 text-[var(--faint)] opacity-60 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100" aria-label="حذف الخطوة"><X size={14} /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } }} placeholder="أضيفي خطوة…" className={input} />
              <button onClick={addStep} disabled={!newStep.trim()} className={`${btnGhost} shrink-0`}><Plus size={14} /></button>
            </div>
          </div>
        </div>

        {/* تحديثات التقدّم */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-[var(--ink)]"><MessageSquarePlus size={15} className="text-[var(--acc)]" /> تحديثات التقدّم</div>
          <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!note.trim()) return; if (await ops.addBoardUpdate(t.id, note.trim())) setNote(""); }}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="وش صار؟ نتيجة، عائق، رابط…" className={input} />
            <button disabled={!note.trim()} className={`${btnPrimary} shrink-0 !px-4`} style={accGrad}>إضافة</button>
          </form>
          <div className="mt-2 space-y-1.5">
            {t.updates.map((u) => (
              <div key={u.id} className="flex gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2">
                <Avatar name={u.author} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="whitespace-pre-wrap break-words text-sm text-[var(--ink)]">{u.body}</div>
                  <div className="text-[10px] text-[var(--faint)]">{u.author ?? "—"} · {timeAgo(u.at)}</div>
                </div>
              </div>
            ))}
            {t.updates.length === 0 && <div className="text-xs text-[var(--faint)]">ما فيه تحديثات بعد.</div>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--faint)]">
          <span><Clock size={11} className="me-1 inline" /> أضافتها {t.created_by ?? "—"} {timeAgo(t.created_at)}</span>
          <button onClick={() => { if (confirm(`حذف «${t.title}»؟`)) { ops.deleteBoard(t.id); onClose(); } }} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-bold text-red-600 hover:bg-red-50/60">
            <Trash2 size={13} /> حذف المهمة
          </button>
        </div>
      </div>
    </Modal>
  );
}
