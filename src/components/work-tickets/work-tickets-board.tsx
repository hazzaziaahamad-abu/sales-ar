"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Send, Loader2, Clock, UserRound, ChevronDown, ChevronUp, Ticket, Search, AlertTriangle,
  CheckCircle2, Play, RotateCcw, XCircle, MessageSquare, CalendarDays,
} from "lucide-react";
import { fetchUserProfiles } from "@/lib/supabase/db";
import { todayLocal } from "@/lib/utils/format";
import {
  TICKET_KIND_LABELS, TICKET_KIND_COLORS, TICKET_PRIORITY_LABELS, TICKET_PRIORITY_COLORS,
  TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, TICKET_KINDS, TICKET_PRIORITIES, isClosedStatus,
  type WorkTicket, type WorkTicketEvent, type TicketKind, type TicketPriority,
} from "@/lib/work-tickets";

const LATE_DAYS = 7;
type StatusView = "active" | "done" | "cancelled" | "all";
type UserOption = { id: string; name: string };

const daysSince = (s: string) => Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000));
function fmtDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { month: "short", day: "numeric" }).format(new Date(s.length === 10 ? `${s}T12:00:00` : s));
  } catch {
    return "—";
  }
}
function fmtDateTime(s: string): string {
  try {
    return new Intl.DateTimeFormat("ar", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(s));
  } catch {
    return "";
  }
}

/** متأخرة: تجاوزت موعد الإنجاز، أو بلا موعد ومفتوحة أكثر من ٧ أيام. */
function isLate(t: WorkTicket, today: string): boolean {
  if (isClosedStatus(t.status)) return false;
  return t.due_date ? t.due_date < today : daysSince(t.created_at) > LATE_DAYS;
}

const inputCls = "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40";

export function WorkTicketsBoard({ embedded = false }: { embedded?: boolean }) {
  const today = todayLocal();
  const [tickets, setTickets] = useState<WorkTicket[]>([]);
  const [me, setMe] = useState<{ id: string; isManager: boolean } | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [kindFilter, setKindFilter] = useState<TicketKind | "all">("all");
  const [statusView, setStatusView] = useState<StatusView>("active");
  const [mineOnly, setMineOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/work-tickets");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTickets(data.tickets ?? []);
      setMe(data.me ?? null);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchUserProfiles().then((u) => setUsers(u.map(({ id, name }) => ({ id, name })))).catch(console.error);
  }, []);

  function flash(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const replaceTicket = (t: WorkTicket) => setTickets((prev) => prev.map((x) => (x.id === t.id ? t : x)));

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    return {
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      late: tickets.filter((t) => isLate(t, today)).length,
      doneWeek: tickets.filter((t) => t.status === "done" && t.closed_at && new Date(t.closed_at).getTime() >= weekAgo).length,
    };
  }, [tickets, today]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets
      .filter((t) => kindFilter === "all" || t.kind === kindFilter)
      .filter((t) =>
        statusView === "all" ? true :
        statusView === "active" ? !isClosedStatus(t.status) :
        t.status === statusView)
      .filter((t) => !mineOnly || (me && (t.assigned_to === me.id || t.created_by === me.id)))
      .filter((t) => !q || [t.title, t.description, t.client_name, t.assigned_to_name, String(t.ticket_number)]
        .some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (statusView === "active") {
          // المتأخرة ثم الأولوية ثم الأقدم
          const late = Number(isLate(b, today)) - Number(isLate(a, today));
          if (late) return late;
          const pr = TICKET_PRIORITIES.indexOf(b.priority) - TICKET_PRIORITIES.indexOf(a.priority);
          if (pr) return pr;
          return a.created_at.localeCompare(b.created_at);
        }
        return (b.closed_at || b.updated_at).localeCompare(a.closed_at || a.updated_at);
      });
  }, [tickets, kindFilter, statusView, mineOnly, me, query, today]);

  const kindCount = (k: TicketKind | "all") => tickets.filter((t) => !isClosedStatus(t.status) && (k === "all" || t.kind === k)).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20 shrink-0">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            {embedded
              ? <h2 className="text-base font-extrabold text-foreground">الطلبات والتطويرات</h2>
              : <h1 className="text-xl font-extrabold text-foreground">الطلبات والتطويرات</h1>}
            <p className="text-[12px] text-muted-foreground mt-0.5">
              طلبات العملاء اللي تحتاج حل والتطويرات على النظام — كل تذكرة تنفتح وتنقفل بعد الإنجاز.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-[12px] bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/20 px-4 py-2.5 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" /> تذكرة جديدة
        </button>
      </div>

      {toast && (
        <div className={`rounded-[12px] px-4 py-3 text-sm border ${toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
          {toast.msg}
        </div>
      )}

      {showForm && (
        <NewTicketForm
          users={users}
          canAssign={!!me?.isManager}
          onCancel={() => setShowForm(false)}
          onCreated={(t) => {
            setTickets((prev) => [t, ...prev]);
            setShowForm(false);
            flash(`تم فتح التذكرة #${t.ticket_number} ✅`);
          }}
          onError={(m) => flash(m, false)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="مفتوحة" value={stats.open} tone="text-sky-400" />
        <Stat label="قيد العمل" value={stats.inProgress} tone="text-amber-400" />
        <Stat label="متأخرة" value={stats.late} tone={stats.late ? "text-red-400" : "text-muted-foreground"} />
        <Stat label="أُنجزت آخر ٧ أيام" value={stats.doneWeek} tone="text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip active={kindFilter === "all"} onClick={() => setKindFilter("all")} label="الكل" count={kindCount("all")} />
          {TICKET_KINDS.map((k) => (
            <Chip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)} label={k === "customer_request" ? "طلبات العملاء" : "التطويرات"} count={kindCount(k)} />
          ))}
          <Chip active={mineOnly} onClick={() => setMineOnly((v) => !v)} label="تخصّني" />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5">
          {([["active", "النشطة"], ["done", "المنجزة"], ["cancelled", "الملغاة"], ["all", "الكل"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setStatusView(k)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${statusView === k ? "bg-amber-500/20 text-amber-300" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالعنوان أو العميل أو المسؤول أو رقم التذكرة" className={`${inputCls} pr-9`} />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : loadError ? (
        <p className="text-sm text-red-400 text-center py-8">تعذّر تحميل التذاكر</p>
      ) : visible.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {statusView === "active" ? "ما فيه تذاكر مفتوحة 👌" : "ما فيه تذاكر هنا."}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((t) => (
            <TicketCard
              key={t.id}
              t={t}
              today={today}
              users={users}
              isManager={!!me?.isManager}
              canAct={!!me && (me.isManager || t.assigned_to === me.id)}
              open={expanded === t.id}
              onToggle={() => setExpanded((e) => (e === t.id ? null : t.id))}
              onUpdated={replaceTicket}
              onError={(m) => flash(m, false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/[0.06]">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-extrabold font-mono mt-0.5 ${tone}`}>{value}</p>
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${active ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : "text-muted-foreground border-white/[0.06] hover:text-foreground hover:bg-white/[0.04]"}`}
    >
      {label}{count ? <span className="opacity-70"> ({count})</span> : null}
    </button>
  );
}

/* ─── فتح تذكرة ─── */
function NewTicketForm({ users, canAssign, onCancel, onCreated, onError }: {
  users: UserOption[];
  canAssign: boolean;
  onCancel: () => void;
  onCreated: (t: WorkTicket) => void;
  onError: (msg: string) => void;
}) {
  const [kind, setKind] = useState<TicketKind>("customer_request");
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const valid = title.trim() && (kind !== "customer_request" || clientName.trim());

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/work-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          client_name: kind === "customer_request" ? clientName.trim() : null,
          title: title.trim(),
          description: description.trim(),
          priority,
          due_date: dueDate || null,
          assigned_to: assignee || null,
          assigned_to_name: users.find((u) => u.id === assignee)?.name ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر فتح التذكرة");
      onCreated(data.ticket);
    } catch (e) {
      onError(e instanceof Error ? e.message : "تعذّر فتح التذكرة");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[14px] glass-surface border border-border p-4 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {TICKET_KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-[10px] px-2 py-2.5 text-[13px] font-bold border transition-colors ${kind === k ? `ring-1 ${TICKET_KIND_COLORS[k]} border-transparent` : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground"}`}
          >
            {TICKET_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {kind === "customer_request" && (
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم العميل</label>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="اسم العميل أو المطعم" className={inputCls} />
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">{kind === "customer_request" ? "وش يطلب العميل؟" : "وش التطوير المطلوب؟"}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={kind === "customer_request" ? "مثال: يبغى ربط المنيو مع نظام الكاشير" : "مثال: تنبيه للتجديدات قبل انتهائها بأسبوع"}
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">التفاصيل <span className="font-normal">(اختياري)</span></label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="وش المطلوب بالضبط، ليش، وأي موعد التزمنا فيه..." className={`${inputCls} resize-y`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">الأولوية</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className={inputCls}>
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p} className="bg-card">{TICKET_PRIORITY_LABELS[p]}</option>)}
          </select>
        </div>
        {canAssign && (
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">المسؤول <span className="font-normal">(اختياري)</span></label>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
              <option value="" className="bg-card">— بدون —</option>
              {users.map((u) => <option key={u.id} value={u.id} className="bg-card">{u.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">موعد الإنجاز <span className="font-normal">(اختياري)</span></label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">إلغاء</button>
        <button
          onClick={submit}
          disabled={!valid || submitting}
          className="flex items-center gap-2 rounded-[10px] bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 border border-amber-500/30 px-5 py-2.5 text-sm font-bold"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          فتح التذكرة
        </button>
      </div>
    </div>
  );
}

/* ─── بطاقة التذكرة ─── */
function TicketCard({ t, today, users, isManager, canAct, open, onToggle, onUpdated, onError }: {
  t: WorkTicket;
  today: string;
  users: UserOption[];
  isManager: boolean;
  canAct: boolean;
  open: boolean;
  onToggle: () => void;
  onUpdated: (t: WorkTicket) => void;
  onError: (msg: string) => void;
}) {
  const closed = isClosedStatus(t.status);
  const late = isLate(t, today);
  const [events, setEvents] = useState<WorkTicketEvent[] | null>(null);
  const [comment, setComment] = useState("");
  const [closing, setClosing] = useState<null | "done" | "cancelled">(null);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/work-tickets/${t.id}/events`)
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => { if (!cancelled) setEvents(d.events ?? []); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [open, t.id, t.updated_at]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/work-tickets/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر التحديث");
      onUpdated(data.ticket);
      setClosing(null);
      setResolution("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "تعذّر التحديث");
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    const text = comment.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/work-tickets/${t.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر إضافة التعليق");
      setEvents((prev) => [...(prev ?? []), data.event]);
      setComment("");
    } catch (e) {
      onError(e instanceof Error ? e.message : "تعذّر إضافة التعليق");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-[14px] glass-surface border ${late ? "border-red-500/30" : "border-border"}`}>
      <button onClick={onToggle} className="w-full text-right p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">#{t.ticket_number}</span>
              <span className={`cc-badge ring-1 ${TICKET_KIND_COLORS[t.kind]}`}>{TICKET_KIND_LABELS[t.kind]}</span>
              {t.priority !== "normal" && <span className={`cc-badge ${TICKET_PRIORITY_COLORS[t.priority]}`}>{TICKET_PRIORITY_LABELS[t.priority]}</span>}
              {late && <span className="cc-badge bg-red-500/15 text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> متأخرة</span>}
            </div>
            <h3 className="mt-1.5 text-sm font-bold text-foreground">{t.title}</h3>
            {t.client_name && <p className="text-[12px] text-amber-300 mt-0.5">العميل: {t.client_name}</p>}
            <div className="mt-1.5 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><UserRound className="w-3 h-3" /> {t.assigned_to_name || "بدون مسؤول"}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {closed ? `أُغلقت ${fmtDate(t.closed_at)}` : `مفتوحة ${daysSince(t.created_at)} يوم`}
              </span>
              {t.due_date && !closed && (
                <span className={`flex items-center gap-1 ${t.due_date < today ? "text-red-400" : ""}`}><CalendarDays className="w-3 h-3" /> الموعد {fmtDate(t.due_date)}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`cc-badge ring-1 ${TICKET_STATUS_COLORS[t.status]}`}>{TICKET_STATUS_LABELS[t.status]}</span>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/[0.06] p-3.5 space-y-3">
          {t.description && <p className="text-[13px] text-foreground/90 whitespace-pre-line">{t.description}</p>}
          <p className="text-[11px] text-muted-foreground">فتحها {t.created_by_name || "—"} · {fmtDateTime(t.created_at)}</p>

          {t.status === "done" && t.resolution && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[12px] text-emerald-300">
              <span className="font-bold">وش انعمل:</span> {t.resolution}
              {t.closed_by_name && <span className="text-emerald-400/70"> — {t.closed_by_name}</span>}
            </div>
          )}

          {/* إدارة: المسؤول، الأولوية، الموعد */}
          {isManager && !closed && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={t.assigned_to ?? ""}
                disabled={busy}
                onChange={(e) => patch({ assigned_to: e.target.value || null, assigned_to_name: users.find((u) => u.id === e.target.value)?.name ?? null })}
                className={`${inputCls} py-1.5 text-[12px]`}
              >
                <option value="" className="bg-card">— بدون مسؤول —</option>
                {users.map((u) => <option key={u.id} value={u.id} className="bg-card">{u.name}</option>)}
              </select>
              <select value={t.priority} disabled={busy} onChange={(e) => patch({ priority: e.target.value })} className={`${inputCls} py-1.5 text-[12px]`}>
                {TICKET_PRIORITIES.map((p) => <option key={p} value={p} className="bg-card">الأولوية: {TICKET_PRIORITY_LABELS[p]}</option>)}
              </select>
              <input type="date" value={t.due_date ?? ""} disabled={busy} onChange={(e) => patch({ due_date: e.target.value || null })} className={`${inputCls} py-1.5 text-[12px]`} />
            </div>
          )}

          {/* إجراءات الحالة */}
          {canAct && (
            closing ? (
              <div className="space-y-2 rounded-lg bg-white/[0.02] border border-white/[0.06] p-2.5">
                <textarea
                  autoFocus
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={2}
                  placeholder={closing === "done" ? "وش انعمل؟ (مطلوب لإغلاق التذكرة)" : "سبب الإلغاء (اختياري)"}
                  className={`${inputCls} text-[12px] resize-y`}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setClosing(null); setResolution(""); }} className="text-[12px] px-3 py-1.5 rounded-lg bg-white/[0.05] text-muted-foreground">رجوع</button>
                  <button
                    disabled={busy || (closing === "done" && !resolution.trim())}
                    onClick={() => patch({ status: closing, resolution })}
                    className={`text-[12px] px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 ${closing === "done" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"}`}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : closing === "done" ? "إغلاق كمنجزة" : "تأكيد الإلغاء"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {t.status === "open" && (
                  <ActionBtn icon={Play} label="ابدأ العمل" cls="bg-amber-500/15 text-amber-300 border-amber-500/20" disabled={busy} onClick={() => patch({ status: "in_progress" })} />
                )}
                {!closed && (
                  <ActionBtn icon={CheckCircle2} label="إغلاق — تم الإنجاز" cls="bg-emerald-500/15 text-emerald-300 border-emerald-500/20" disabled={busy} onClick={() => setClosing("done")} />
                )}
                {!closed && isManager && (
                  <ActionBtn icon={XCircle} label="إلغاء" cls="bg-white/[0.04] text-muted-foreground border-white/[0.08]" disabled={busy} onClick={() => setClosing("cancelled")} />
                )}
                {closed && (
                  <ActionBtn icon={RotateCcw} label="إعادة فتح" cls="bg-sky-500/15 text-sky-300 border-sky-500/20" disabled={busy} onClick={() => patch({ status: "open" })} />
                )}
              </div>
            )
          )}

          {/* السجل والتعليقات */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1"><MessageSquare className="w-3 h-3" /> السجل</p>
            {events === null ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : events.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">لا يوجد</p>
            ) : (
              <ul className="space-y-1">
                {events.map((e) => (
                  <li key={e.id} className={`text-[12px] rounded-lg px-2.5 py-1.5 ${e.event_type === "comment" ? "bg-white/[0.04] text-foreground" : "text-muted-foreground"}`}>
                    <span className="font-bold">{e.actor_name || "—"}</span>
                    <span className="opacity-60"> · {fmtDateTime(e.created_at)}</span>
                    <div className="whitespace-pre-line">{e.body}</div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 pt-1">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addComment()}
                placeholder="أضف تعليق أو تحديث..."
                className={`${inputCls} py-1.5 text-[12px]`}
              />
              <button onClick={addComment} disabled={busy || !comment.trim()} className="px-3 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/20 disabled:opacity-40">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ icon: Icon, label, cls, disabled, onClick }: {
  icon: typeof Play; label: string; cls: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border disabled:opacity-40 ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

