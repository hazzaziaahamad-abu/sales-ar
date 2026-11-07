"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Plus, ChevronRight, ChevronLeft, Clock, MapPin, Users, Loader2, Send,
  CheckCircle2, XCircle, Pencil, Trash2, RotateCcw, FileText, ChevronDown, ChevronUp, Link2,
  Video, CalendarPlus, Phone, Target, Circle, UserRound,
} from "lucide-react";
import { fetchUserProfiles } from "@/lib/supabase/db";
import { todayLocal } from "@/lib/utils/format";
import {
  MEETING_TYPE_LABELS, MEETING_TYPE_COLORS, MEETING_TYPES,
  CLIENT_SCRIPT, CLIENT_MEETING_GOALS, CLIENT_PURPOSES, CLIENT_PURPOSE_LABELS, emptyClientBrief, clientScriptText, googleCalendarUrl,
  type Meeting, type MeetingType, type ClientBrief, type ClientScriptKey, type ClientPurpose,
} from "@/lib/meetings";

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_SHORT = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const inputCls = "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40";
const PILL_COLORS: Record<MeetingType, string> = {
  daily: "bg-violet-500/20 text-violet-200",
  weekly: "bg-indigo-500/20 text-indigo-200",
  internal: "bg-sky-500/20 text-sky-200",
  client: "bg-amber-500/20 text-amber-200",
  partner: "bg-teal-500/20 text-teal-200",
  other: "bg-white/[0.08] text-muted-foreground",
};

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
/** بداية الأسبوع (الأحد). */
function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return addDays(date, -d.getUTCDay());
}
/** أول يوم في شهر التاريخ. */
function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}
function addMonths(month: string, delta: number): string {
  const d = new Date(`${month}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta, 1);
  return d.toISOString().slice(0, 10);
}
function monthEnd(month: string): string {
  return addDays(addMonths(month, 1), -1);
}
function monthLabel(month: string): string {
  return new Date(`${month}T12:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "long", year: "numeric" });
}
function longDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
function endTime(t: string, minutes: number): string {
  const [h, m] = t.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
const PURPOSE_COLORS: Record<ClientPurpose, string> = {
  new: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  upgrade: "bg-sky-500/15 text-sky-300 border-sky-500/25",
};
const isLink = (s: string) => /^https?:\/\//i.test(s);
const isMeetLink = (s: string) => /^https?:\/\/meet\.google\.com\//i.test(s);

type FormState = {
  title: string; meeting_type: MeetingType; meeting_date: string; start_time: string;
  duration_minutes: number; location: string; attendees: string[]; agenda: string;
  client_brief: ClientBrief;
};
const emptyForm = (date: string): FormState => ({
  title: "", meeting_type: "client", meeting_date: date, start_time: "10:00",
  duration_minutes: 30, location: "", attendees: [], agenda: "", client_brief: emptyClientBrief(),
});

/** جسم الطلب: تفاصيل العميل فقط لاجتماعات العملاء، والعنوان الافتراضي باسم العميل. */
function toPayload(f: FormState) {
  const isClient = f.meeting_type === "client";
  const name = f.client_brief.client_name.trim();
  return {
    ...f,
    title: f.title.trim() || (isClient && name ? `اجتماع مع ${name}` : ""),
    client_brief: isClient ? f.client_brief : null,
  };
}

export function MeetingsBoard({ embedded = false }: { embedded?: boolean }) {
  const today = todayLocal();
  const [month, setMonth] = useState(monthStart(today));
  const [selected, setSelected] = useState(today);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [me, setMe] = useState<{ id: string; isManager: boolean } | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState<{ id: string | null; data: FormState } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // الشبكة تبدأ من أحد الأسبوع الأول وتنتهي بسبت الأسبوع الأخير.
  const gridStart = weekStart(month);
  const gridEnd = addDays(weekStart(monthEnd(month)), 6);
  const mEnd = monthEnd(month);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings?from=${gridStart}&to=${gridEnd}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMeetings(data.meetings ?? []);
      setMe(data.me ?? null);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [gridStart, gridEnd]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchUserProfiles().then((u) => setUsers(u.map((x) => x.name).filter(Boolean))).catch(console.error);
  }, []);

  function flash(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function goMonth(next: string) {
    setLoading(true);
    setMonth(next);
    setSelected(next === monthStart(today) ? today : next);
  }

  const canEdit = (m: Meeting) => !!me && (me.isManager || m.created_by === me.id);
  const inGrid = (d: string) => d >= gridStart && d <= gridEnd;

  function openNew(date: string) {
    setForm({ id: null, data: emptyForm(date) });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form) return;
    const isNew = !form.id;
    try {
      const res = await fetch(isNew ? "/api/meetings" : `/api/meetings/${form.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form.data)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      const m: Meeting = data.meeting;
      setMeetings((prev) => {
        const rest = prev.filter((x) => x.id !== m.id);
        return inGrid(m.meeting_date) ? [...rest, m] : rest;
      });
      setForm(null);
      if (inGrid(m.meeting_date)) { setSelected(m.meeting_date); setExpanded(m.id); }
      flash(isNew
        ? (inGrid(m.meeting_date) ? "تمت جدولة الاجتماع ✅" : `تمت جدولة الاجتماع ✅ — في شهر ${monthLabel(monthStart(m.meeting_date))}`)
        : "تم حفظ التعديل ✅");
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر الحفظ", false);
    }
  }

  async function patch(m: Meeting, body: Record<string, unknown>, okMsg?: string) {
    try {
      const res = await fetch(`/api/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر التحديث");
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? data.meeting : x)));
      if (okMsg) flash(okMsg);
      return true;
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر التحديث", false);
      return false;
    }
  }

  async function remove(m: Meeting) {
    if (!confirm(`حذف اجتماع «${m.title}»؟`)) return;
    try {
      const res = await fetch(`/api/meetings/${m.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMeetings((prev) => prev.filter((x) => x.id !== m.id));
    } catch {
      flash("تعذّر الحذف", false);
    }
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) map.set(d, []);
    for (const m of meetings) map.get(m.meeting_date)?.push(m);
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [meetings, gridStart, gridEnd]);

  const monthMeetings = useMemo(
    () => meetings.filter((m) => m.meeting_date >= month && m.meeting_date <= mEnd && m.status !== "cancelled"),
    [meetings, month, mEnd],
  );

  const stats = useMemo(() => ({
    total: monthMeetings.length,
    client: monthMeetings.filter((m) => m.meeting_type === "client").length,
    clientDone: monthMeetings.filter((m) => m.meeting_type === "client" && m.status === "done").length,
    clientNew: monthMeetings.filter((m) => m.meeting_type === "client" && (m.client_brief?.purpose ?? "new") === "new").length,
    clientUpgrade: monthMeetings.filter((m) => m.meeting_type === "client" && m.client_brief?.purpose === "upgrade").length,
    noMinutes: monthMeetings.filter((m) => m.status === "done" && !m.minutes).length,
  }), [monthMeetings]);

  /** اجتماعات العملاء لكل موظف هذا الشهر — مطلوب من كل موظف اجتماع واحد على الأقل. */
  const perEmployee = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>();
    for (const u of users) counts.set(u, { total: 0, done: 0 });
    for (const m of monthMeetings) {
      if (m.meeting_type !== "client" || !m.created_by_name) continue;
      const c = counts.get(m.created_by_name) ?? { total: 0, done: 0 };
      c.total += 1;
      if (m.status === "done") c.done += 1;
      counts.set(m.created_by_name, c);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "ar"));
  }, [monthMeetings, users]);

  const days = Array.from(byDay.keys());
  const selectedList = byDay.get(selected) ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/20 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            {embedded
              ? <h2 className="text-base font-extrabold text-foreground">الاجتماعات</h2>
              : <h1 className="text-xl font-extrabold text-foreground">الاجتماعات</h1>}
            <p className="text-[12px] text-muted-foreground mt-0.5">تقويم الشهر — اجتماعات Google Meet مع العملاء واجتماعات الفريق، مع محاور الاجتماع والمحضر.</p>
          </div>
        </div>
        <button
          onClick={() => openNew(selected >= today ? selected : today)}
          className="flex items-center gap-2 rounded-[12px] bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 px-4 py-2.5 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" /> موعد جديد
        </button>
      </div>

      {toast && (
        <div className={`rounded-[12px] px-4 py-3 text-sm border ${toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
          {toast.msg}
        </div>
      )}

      {form && (
        <MeetingForm
          value={form.data}
          isNew={!form.id}
          users={users}
          onChange={(data) => setForm((f) => (f ? { ...f, data } : f))}
          onCancel={() => setForm(null)}
          onSave={save}
        />
      )}

      {/* Month nav + stats */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button onClick={() => goMonth(addMonths(month, -1))} title="الشهر السابق" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-[14px] font-extrabold text-foreground px-2 min-w-[130px] text-center">{monthLabel(month)}</span>
          <button onClick={() => goMonth(addMonths(month, 1))} title="الشهر التالي" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {month !== monthStart(today) && (
            <button onClick={() => goMonth(monthStart(today))} className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              هذا الشهر
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground flex-wrap">
          <span>الشهر: <b className="text-foreground">{stats.total}</b></span>
          <span>مع عملاء: <b className="text-amber-300">{stats.client}</b> <span className="text-[11px]">(تم {stats.clientDone})</span></span>
          <span>جدد: <b className="text-emerald-300">{stats.clientNew}</b></span>
          <span>ترقية: <b className="text-sky-300">{stats.clientUpgrade}</b></span>
          {stats.noMinutes > 0 && <span className="text-amber-400">بدون محضر: <b>{stats.noMinutes}</b></span>}
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : loadError ? (
        <p className="text-sm text-red-400 text-center py-8">تعذّر تحميل الاجتماعات</p>
      ) : (
        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.01] overflow-hidden">
          <div className="grid grid-cols-7 border-b border-white/[0.06]">
            {DAY_NAMES.map((d, i) => (
              <div key={d} className="py-2 text-center text-[10px] sm:text-[11px] font-bold text-muted-foreground">
                <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{DAY_SHORT[i]}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((date) => {
              const list = byDay.get(date) ?? [];
              const outside = date < month || date > mEnd;
              const isToday = date === today;
              const isSel = date === selected;
              const visible = list.filter((m) => m.status !== "cancelled");
              return (
                <div
                  key={date}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(date)}
                  onDoubleClick={() => openNew(date)}
                  onKeyDown={(e) => { if (e.key === "Enter") setSelected(date); }}
                  className={`group relative min-h-[64px] sm:min-h-[96px] border-b border-l border-white/[0.04] p-1 sm:p-1.5 text-right cursor-pointer transition-colors
                    ${outside ? "bg-black/10 opacity-50" : "hover:bg-white/[0.03]"}
                    ${isSel ? "ring-2 ring-inset ring-indigo-500/50 bg-indigo-500/[0.06]" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] font-bold w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? "bg-indigo-500 text-white" : date < today ? "text-muted-foreground" : "text-foreground"}`}>
                      {Number(date.slice(8, 10))}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); openNew(date); }}
                      title="موعد في هذا اليوم"
                      className="hidden sm:flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] hover:text-foreground"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {/* الجوال: نقاط */}
                  <div className="sm:hidden flex flex-wrap gap-0.5 mt-1">
                    {visible.slice(0, 4).map((m) => (
                      <span key={m.id} className={`w-1.5 h-1.5 rounded-full ${m.meeting_type === "client" ? "bg-amber-400" : "bg-indigo-400"} ${m.status === "done" ? "opacity-50" : ""}`} />
                    ))}
                  </div>
                  {/* الشاشات الأكبر: عناوين */}
                  <div className="hidden sm:block space-y-0.5 mt-1">
                    {visible.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        onClick={(e) => { e.stopPropagation(); setSelected(date); setExpanded(m.id); }}
                        className={`truncate rounded px-1 py-0.5 text-[10px] leading-tight ${PILL_COLORS[m.meeting_type]} ${m.status === "done" ? "opacity-60 line-through" : ""}`}
                        title={`${fmtTime(m.start_time)} — ${m.title}`}
                      >
                        <span className="font-mono">{m.start_time}</span> {m.title}
                      </div>
                    ))}
                    {visible.length > 3 && <p className="text-[10px] text-muted-foreground px-1">+{visible.length - 3} أخرى</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected day */}
      {!loading && !loadError && (
        <div className={`rounded-[14px] border p-3 ${selected === today ? "border-indigo-500/35 bg-indigo-500/[0.04]" : "border-white/[0.06] bg-white/[0.01]"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-foreground">{longDate(selected)}</span>
              {selected === today && <span className="cc-badge bg-indigo-500/20 text-indigo-300">اليوم</span>}
            </div>
            <button
              onClick={() => openNew(selected)}
              className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-3.5 h-3.5" /> موعد في هذا اليوم
            </button>
          </div>
          {selectedList.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/60">لا يوجد اجتماعات</p>
          ) : (
            <div className="space-y-1.5">
              {selectedList.map((m) => (
                <MeetingCard
                  key={m.id}
                  m={m}
                  open={expanded === m.id}
                  editable={canEdit(m)}
                  onToggle={() => setExpanded((e) => (e === m.id ? null : m.id))}
                  onEdit={() => {
                    setForm({
                      id: m.id,
                      data: {
                        title: m.title, meeting_type: m.meeting_type, meeting_date: m.meeting_date, start_time: m.start_time,
                        duration_minutes: m.duration_minutes, location: m.location ?? "", attendees: m.attendees ?? [], agenda: m.agenda ?? "",
                        client_brief: { ...emptyClientBrief(), ...(m.client_brief ?? {}) },
                      },
                    });
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onPatch={(body, msg) => patch(m, body, msg)}
                  onDelete={() => remove(m)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Client meetings per employee */}
      {!loading && !loadError && perEmployee.length > 0 && (
        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.01] p-3">
          <p className="text-[12px] font-bold text-foreground mb-2 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-400" /> اجتماعات العملاء لكل موظف — {monthLabel(month)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {perEmployee.map(([name, c]) => (
              <span
                key={name}
                className={`text-[11px] px-2.5 py-1 rounded-lg border ${c.total === 0
                  ? "bg-amber-500/[0.06] border-amber-500/20 text-amber-300/80"
                  : "bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-300"}`}
              >
                {name}: <b>{c.total}</b>{c.total > 0 && <span className="opacity-70"> (تم {c.done})</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── محاور اجتماع العميل ─── */
function ClientScript({ brief, editable, onNote, onToggleDone }: {
  brief: ClientBrief;
  editable: boolean;
  onNote?: (k: ClientScriptKey, v: string) => void;
  onToggleDone?: (k: ClientScriptKey) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CLIENT_MEETING_GOALS.map((g) => (
          <span key={g} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/15">
            <Target className="w-3 h-3" /> {g}
          </span>
        ))}
      </div>
      {CLIENT_SCRIPT.map((s, i) => {
        const done = brief.done.includes(s.key);
        return (
          <div key={s.key} className={`rounded-lg border p-2.5 ${done ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}>
            <div className="flex items-start gap-2">
              {onToggleDone ? (
                <button type="button" onClick={() => onToggleDone(s.key)} disabled={!editable} title={done ? "تم" : "علّمه كتم"} className="mt-0.5 shrink-0 disabled:cursor-default">
                  {done ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                </button>
              ) : (
                <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-bold ${done ? "text-emerald-300" : "text-foreground"}`}>{s.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{s.hint}</p>
                {s.questions.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {s.questions.map((q) => <li key={q} className="text-[12px] text-foreground/90">• {q}</li>)}
                  </ul>
                )}
                {editable && onNote ? (
                  <textarea
                    value={brief.notes[s.key] ?? ""}
                    onChange={(e) => onNote(s.key, e.target.value)}
                    rows={2}
                    placeholder={s.key === "discovery" ? "اكتب إجابات العميل..." : s.key === "competitors" ? "المنافس، مميزاته وعيوبه من وجهة نظر العميل..." : "ملاحظات..."}
                    className={`${inputCls} mt-1.5 py-1.5 text-[12px] resize-y`}
                  />
                ) : brief.notes[s.key] ? (
                  <p className="mt-1.5 text-[12px] text-foreground/90 whitespace-pre-line rounded-md bg-white/[0.03] px-2 py-1.5">{brief.notes[s.key]}</p>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── نموذج الاجتماع ─── */
function MeetingForm({ value, isNew, users, onChange, onCancel, onSave }: {
  value: FormState;
  isNew: boolean;
  users: string[];
  onChange: (v: FormState) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [extra, setExtra] = useState("");
  const [showScript, setShowScript] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => onChange({ ...value, [k]: v });
  const setBrief = (b: Partial<ClientBrief>) => set("client_brief", { ...value.client_brief, ...b });
  const toggleAttendee = (name: string) =>
    set("attendees", value.attendees.includes(name) ? value.attendees.filter((a) => a !== name) : [...value.attendees, name]);
  const addExtra = () => {
    const n = extra.trim();
    if (n && !value.attendees.includes(n)) set("attendees", [...value.attendees, n]);
    setExtra("");
  };
  const options = Array.from(new Set([...users, ...value.attendees]));
  const isClient = value.meeting_type === "client";
  const canSave = !!value.meeting_date && !!value.start_time
    && (isClient ? !!(value.title.trim() || value.client_brief.client_name.trim()) : !!value.title.trim());

  return (
    <div className="rounded-[14px] glass-surface border border-border p-4 space-y-4">
      <h3 className="text-sm font-bold text-foreground">{isNew ? "موعد جديد" : "تعديل الموعد"}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">
            عنوان الاجتماع {isClient && <span className="font-normal">(اختياري — افتراضياً «اجتماع مع اسم العميل»)</span>}
          </label>
          <input value={value.title} onChange={(e) => set("title", e.target.value)} placeholder={isClient ? "اجتماع تعريفي بالمنصة" : "مثال: مراجعة أداء المبيعات"} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">النوع</label>
          <select value={value.meeting_type} onChange={(e) => set("meeting_type", e.target.value as MeetingType)} className={inputCls}>
            {MEETING_TYPES.map((t) => <option key={t} value={t} className="bg-card">{MEETING_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {isClient && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">هدف الاجتماع</label>
            <div className="flex gap-1.5">
              {CLIENT_PURPOSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setBrief({ purpose: p })}
                  className={`flex-1 text-[12px] font-bold px-2 py-2.5 rounded-[10px] border transition-colors ${value.client_brief.purpose === p ? PURPOSE_COLORS[p] : "bg-white/[0.03] text-muted-foreground border-white/[0.06] hover:text-foreground"}`}
                >
                  {CLIENT_PURPOSE_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم العميل</label>
            <input value={value.client_brief.client_name} onChange={(e) => setBrief({ client_name: e.target.value })} placeholder="اسم العميل أو المنشأة" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">جوال العميل <span className="font-normal">(اختياري)</span></label>
            <input value={value.client_brief.client_phone} onChange={(e) => setBrief({ client_phone: e.target.value })} placeholder="05xxxxxxxx" dir="ltr" className={`${inputCls} text-right`} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">التاريخ</label>
          <input type="date" value={value.meeting_date} onChange={(e) => set("meeting_date", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">الوقت</label>
          <input type="time" value={value.start_time} onChange={(e) => set("start_time", e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">المدة (دقيقة)</label>
          <select value={value.duration_minutes} onChange={(e) => set("duration_minutes", Number(e.target.value))} className={inputCls}>
            {[10, 15, 20, 30, 45, 60, 90, 120].map((d) => <option key={d} value={d} className="bg-card">{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isClient ? "رابط Google Meet" : "المكان أو الرابط"}</label>
          <input value={value.location} onChange={(e) => set("location", e.target.value)} placeholder={isClient ? "https://meet.google.com/..." : "المكتب / رابط Meet"} dir={isClient ? "ltr" : undefined} className={inputCls} />
        </div>
      </div>

      {isClient && (
        <div className="flex flex-wrap items-center gap-2 -mt-1">
          <a
            href="https://meet.google.com/new"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border bg-emerald-500/10 text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20"
          >
            <Video className="w-3.5 h-3.5" /> إنشاء رابط Google Meet
          </a>
          <span className="text-[11px] text-muted-foreground">ينفتح Meet في تبويب جديد — انسخ الرابط والصقه في الخانة.</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">الحضور</label>
        <div className="flex flex-wrap gap-1.5">
          {options.map((name) => {
            const on = value.attendees.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleAttendee(name)}
                className={`text-[12px] px-2.5 py-1 rounded-lg border transition-colors ${on ? "bg-indigo-500/20 text-indigo-200 border-indigo-500/30" : "bg-white/[0.03] text-muted-foreground border-white/[0.06] hover:text-foreground"}`}
              >
                {name}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExtra(); } }}
            placeholder="إضافة حاضر من خارج القائمة (عميل، شريك...)"
            className={`${inputCls} py-1.5 text-[12px]`}
          />
          <button type="button" onClick={addExtra} className="px-3 rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {isClient && (
        <div className="rounded-[12px] border border-amber-500/15 bg-amber-500/[0.03] p-3">
          <button type="button" onClick={() => setShowScript((v) => !v)} className="w-full flex items-center justify-between text-right">
            <span className="text-[13px] font-bold text-amber-200">تفاصيل الاجتماع ومحاوره</span>
            {showScript ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <p className="text-[11px] text-muted-foreground mt-0.5">الترحيب ← سؤال العميل ← ملخص المنصة والرد على كلامه ← المنافسين. تقدر تكتب ملاحظات تحضيرية الحين، وتكمّلها أثناء الاجتماع.</p>
          {showScript && (
            <div className="mt-3">
              <ClientScript
                brief={value.client_brief}
                editable
                onNote={(k, v) => setBrief({ notes: { ...value.client_brief.notes, [k]: v } })}
              />
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isClient ? "ملاحظات إضافية" : "الأجندة"} <span className="font-normal">(اختياري)</span></label>
        <textarea value={value.agenda} onChange={(e) => set("agenda", e.target.value)} rows={isClient ? 2 : 3} placeholder={isClient ? "معلومات عن العميل، نشاطه، حجمه..." : "١. ...\n٢. ..."} className={`${inputCls} resize-y`} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">إلغاء</button>
        <button
          disabled={saving || !canSave}
          onClick={async () => { setSaving(true); await onSave(); setSaving(false); }}
          className="flex items-center gap-2 rounded-[10px] bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 text-indigo-200 border border-indigo-500/30 px-5 py-2.5 text-sm font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {isNew ? "جدولة" : "حفظ"}
        </button>
      </div>
    </div>
  );
}

/* ─── بطاقة الاجتماع ─── */
function MeetingCard({ m, open, editable, onToggle, onEdit, onPatch, onDelete }: {
  m: Meeting;
  open: boolean;
  editable: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onPatch: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [minutes, setMinutes] = useState(m.minutes ?? "");
  const [brief, setBrief] = useState<ClientBrief>({ ...emptyClientBrief(), ...(m.client_brief ?? {}) });
  const [busy, setBusy] = useState(false);
  const cancelled = m.status === "cancelled";
  const done = m.status === "done";
  const isClient = m.meeting_type === "client";
  const minutesDirty = minutes.trim() !== (m.minutes ?? "");
  const saved: ClientBrief = { ...emptyClientBrief(), ...(m.client_brief ?? {}) };
  const notesDirty = JSON.stringify(brief.notes) !== JSON.stringify(saved.notes);
  const progress = saved.done.length;

  async function run(body: Record<string, unknown>, msg?: string) {
    setBusy(true);
    await onPatch(body, msg);
    setBusy(false);
  }

  function toggleDone(k: ClientScriptKey) {
    const next = saved.done.includes(k) ? saved.done.filter((x) => x !== k) : [...saved.done, k];
    // نحفظ العلامة فوراً مع الملاحظات الحالية.
    run({ client_brief: { ...brief, done: next } });
  }

  const calUrl = googleCalendarUrl({
    title: m.title,
    meeting_date: m.meeting_date,
    start_time: m.start_time,
    duration_minutes: m.duration_minutes,
    location: m.location,
    details: [
      m.location && isLink(m.location) ? `رابط الاجتماع: ${m.location}` : "",
      saved.client_name ? `العميل: ${saved.client_name}${saved.client_phone ? ` — ${saved.client_phone}` : ""}` : "",
      isClient ? clientScriptText(saved) : m.agenda ?? "",
    ].filter(Boolean).join("\n\n"),
  });

  return (
    <div className={`rounded-xl border ${cancelled ? "border-white/[0.04] opacity-60" : "border-white/[0.08] bg-white/[0.02]"}`}>
      <button onClick={onToggle} className="w-full text-right px-3 py-2.5 flex items-start gap-3">
        <div className="text-center shrink-0 w-16">
          <p className={`text-[13px] font-bold font-mono ${cancelled ? "line-through text-muted-foreground" : "text-foreground"}`}>{fmtTime(m.start_time)}</p>
          <p className="text-[10px] text-muted-foreground">{m.duration_minutes} د</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[13px] font-bold ${cancelled ? "line-through text-muted-foreground" : "text-foreground"}`}>{m.title}</span>
            <span className={`cc-badge ${MEETING_TYPE_COLORS[m.meeting_type]}`}>{MEETING_TYPE_LABELS[m.meeting_type]}</span>
            {isClient && <span className={`cc-badge border ${PURPOSE_COLORS[saved.purpose]}`}>{CLIENT_PURPOSE_LABELS[saved.purpose]}</span>}
            {isClient && !cancelled && <span className="cc-badge bg-white/[0.06] text-muted-foreground">المحاور {progress}/{CLIENT_SCRIPT.length}</span>}
            {done && <span className="cc-badge bg-emerald-500/15 text-emerald-400">تم</span>}
            {cancelled && <span className="cc-badge bg-slate-500/15 text-slate-400">ملغي</span>}
            {done && !m.minutes && <span className="cc-badge bg-amber-500/15 text-amber-400">بدون محضر</span>}
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
            {saved.client_name && <span className="flex items-center gap-1"><UserRound className="w-3 h-3" /> {saved.client_name}</span>}
            {m.created_by_name && isClient && <span>الموظف: {m.created_by_name}</span>}
            {m.attendees?.length > 0 && (
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {m.attendees.slice(0, 4).join("، ")}{m.attendees.length > 4 ? ` +${m.attendees.length - 4}` : ""}</span>
            )}
            {m.location && (
              <span className="flex items-center gap-1">
                {isMeetLink(m.location) ? <Video className="w-3 h-3" /> : isLink(m.location) ? <Link2 className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
                {isMeetLink(m.location) ? "Google Meet" : isLink(m.location) ? "رابط الاجتماع" : m.location}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-3 py-3 space-y-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap">
            <Clock className="w-3 h-3" /> {fmtTime(m.start_time)} — {fmtTime(endTime(m.start_time, m.duration_minutes))}
            {m.created_by_name && <span> · جدولة {m.created_by_name}</span>}
          </p>

          <div className="flex flex-wrap gap-2">
            {m.location && isLink(m.location) && (
              <a href={m.location} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border bg-emerald-500/15 text-emerald-300 border-emerald-500/20">
                {isMeetLink(m.location) ? <Video className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                {isMeetLink(m.location) ? "دخول Google Meet" : "فتح رابط الاجتماع"}
              </a>
            )}
            <a href={calUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border bg-white/[0.04] text-muted-foreground border-white/[0.08] hover:text-foreground">
              <CalendarPlus className="w-3.5 h-3.5" /> إضافة لـ Google Calendar
            </a>
            {saved.client_phone && (
              <a href={`tel:${saved.client_phone}`} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border bg-white/[0.04] text-muted-foreground border-white/[0.08] hover:text-foreground" dir="ltr">
                <Phone className="w-3.5 h-3.5" /> {saved.client_phone}
              </a>
            )}
          </div>

          {m.attendees?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {m.attendees.map((a) => <span key={a} className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] text-foreground">{a}</span>)}
            </div>
          )}
          {m.agenda && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground mb-1">{isClient ? "ملاحظات" : "الأجندة"}</p>
              <p className="text-[13px] text-foreground/90 whitespace-pre-line">{m.agenda}</p>
            </div>
          )}

          {/* محاور اجتماع العميل */}
          {isClient && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground mb-1.5">تفاصيل الاجتماع ومحاوره</p>
              <ClientScript
                brief={{ ...brief, done: saved.done }}
                editable={editable && !cancelled}
                onNote={(k, v) => setBrief((b) => ({ ...b, notes: { ...b.notes, [k]: v } }))}
                onToggleDone={editable && !cancelled ? toggleDone : undefined}
              />
              {notesDirty && editable && (
                <div className="flex justify-end mt-1.5">
                  <button disabled={busy} onClick={() => run({ client_brief: brief }, "تم حفظ الملاحظات ✅")} className="text-[12px] px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 font-bold disabled:opacity-40">حفظ الملاحظات</button>
                </div>
              )}
            </div>
          )}

          {/* المحضر */}
          {(done || m.minutes) && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> المحضر</p>
              {editable ? (
                <>
                  <textarea
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    rows={4}
                    placeholder={isClient ? "النتيجة: مهتم؟ الخطوة الجاية؟ موعد المتابعة..." : "وش انقال، وش انقرر، ومين مسؤول عن وش..."}
                    className={`${inputCls} text-[12px] resize-y`}
                  />
                  {minutesDirty && (
                    <div className="flex justify-end mt-1.5">
                      <button disabled={busy} onClick={() => run({ minutes }, "تم حفظ المحضر ✅")} className="text-[12px] px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-200 font-bold disabled:opacity-40">حفظ المحضر</button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-foreground/90 whitespace-pre-line">{m.minutes || "—"}</p>
              )}
            </div>
          )}

          {editable && (
            <div className="flex flex-wrap gap-2 pt-1">
              {m.status === "scheduled" && (
                <>
                  <Btn icon={CheckCircle2} label="تم الاجتماع" cls="bg-emerald-500/15 text-emerald-300 border-emerald-500/20" disabled={busy} onClick={() => run({ status: "done" })} />
                  <Btn icon={Pencil} label="تعديل" cls="bg-white/[0.04] text-muted-foreground border-white/[0.08]" disabled={busy} onClick={onEdit} />
                  <Btn icon={XCircle} label="إلغاء" cls="bg-white/[0.04] text-muted-foreground border-white/[0.08]" disabled={busy} onClick={() => run({ status: "cancelled" })} />
                </>
              )}
              {m.status !== "scheduled" && (
                <Btn icon={RotateCcw} label="رجّعه مجدول" cls="bg-white/[0.04] text-muted-foreground border-white/[0.08]" disabled={busy} onClick={() => run({ status: "scheduled" })} />
              )}
              <Btn icon={Trash2} label="حذف" cls="bg-red-500/10 text-red-400 border-red-500/20" disabled={busy} onClick={onDelete} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Btn({ icon: Icon, label, cls, disabled, onClick }: {
  icon: typeof Plus; label: string; cls: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg border disabled:opacity-40 ${cls}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
