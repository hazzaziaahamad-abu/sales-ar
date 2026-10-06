"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Plus, ChevronRight, ChevronLeft, Clock, MapPin, Users, Loader2, Send,
  CheckCircle2, XCircle, Pencil, Trash2, RotateCcw, FileText, ChevronDown, ChevronUp, Link2,
} from "lucide-react";
import { fetchUserProfiles } from "@/lib/supabase/db";
import { todayLocal } from "@/lib/utils/format";
import {
  MEETING_TYPE_LABELS, MEETING_TYPE_COLORS, MEETING_TYPES,
  type Meeting, type MeetingType,
} from "@/lib/meetings";

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const inputCls = "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40";

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
function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
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
const isLink = (s: string) => /^https?:\/\//i.test(s);

type FormState = {
  title: string; meeting_type: MeetingType; meeting_date: string; start_time: string;
  duration_minutes: number; location: string; attendees: string[]; agenda: string;
};
const emptyForm = (date: string): FormState => ({
  title: "", meeting_type: "internal", meeting_date: date, start_time: "10:00",
  duration_minutes: 30, location: "", attendees: [], agenda: "",
});

export function MeetingsBoard({ embedded = false }: { embedded?: boolean }) {
  const today = todayLocal();
  const [week, setWeek] = useState(weekStart(today));
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [me, setMe] = useState<{ id: string; isManager: boolean } | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState<{ id: string | null; data: FormState } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const weekEnd = addDays(week, 6);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings?from=${week}&to=${addDays(week, 6)}`);
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
  }, [week]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchUserProfiles().then((u) => setUsers(u.map((x) => x.name).filter(Boolean))).catch(console.error);
  }, []);

  function flash(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function changeWeek(delta: number) {
    setLoading(true);
    setWeek((w) => addDays(w, 7 * delta));
  }

  const canEdit = (m: Meeting) => !!me && (me.isManager || m.created_by === me.id);

  async function save() {
    if (!form) return;
    const isNew = !form.id;
    try {
      const res = await fetch(isNew ? "/api/meetings" : `/api/meetings/${form.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      const m: Meeting = data.meeting;
      const inWeek = m.meeting_date >= week && m.meeting_date <= weekEnd;
      setMeetings((prev) => {
        const rest = prev.filter((x) => x.id !== m.id);
        return inWeek ? [...rest, m] : rest;
      });
      setForm(null);
      flash(isNew ? (inWeek ? "تمت جدولة الاجتماع ✅" : `تمت جدولة الاجتماع ✅ — في أسبوع ${shortDate(weekStart(m.meeting_date))}`) : "تم حفظ التعديل ✅");
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
    for (let i = 0; i < 7; i++) map.set(addDays(week, i), []);
    for (const m of meetings) map.get(m.meeting_date)?.push(m);
    for (const list of map.values()) list.sort((a, b) => a.start_time.localeCompare(b.start_time));
    return map;
  }, [meetings, week]);

  const stats = useMemo(() => ({
    today: meetings.filter((m) => m.meeting_date === today && m.status !== "cancelled").length,
    week: meetings.filter((m) => m.status !== "cancelled").length,
    noMinutes: meetings.filter((m) => m.status === "done" && !m.minutes).length,
  }), [meetings, today]);

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
            <p className="text-[12px] text-muted-foreground mt-0.5">جدول اجتماعات الفريق — الموعد، الحضور، الأجندة، والمحضر بعد الاجتماع.</p>
          </div>
        </div>
        <button
          onClick={() => setForm({ id: null, data: emptyForm(today >= week && today <= weekEnd ? today : week) })}
          className="flex items-center gap-2 rounded-[12px] bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 px-4 py-2.5 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" /> اجتماع جديد
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

      {/* Week nav + stats */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button onClick={() => changeWeek(-1)} title="الأسبوع السابق" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-bold text-foreground px-2 min-w-[150px] text-center">
            {shortDate(week)} — {shortDate(weekEnd)}
          </span>
          <button onClick={() => changeWeek(1)} title="الأسبوع التالي" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {week !== weekStart(today) && (
            <button onClick={() => { setLoading(true); setWeek(weekStart(today)); }} className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
              هذا الأسبوع
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
          <span>اليوم: <b className="text-foreground">{stats.today}</b></span>
          <span>الأسبوع: <b className="text-foreground">{stats.week}</b></span>
          {stats.noMinutes > 0 && <span className="text-amber-400">بدون محضر: <b>{stats.noMinutes}</b></span>}
        </div>
      </div>

      {/* Week schedule */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : loadError ? (
        <p className="text-sm text-red-400 text-center py-8">تعذّر تحميل الاجتماعات</p>
      ) : (
        <div className="space-y-2">
          {Array.from(byDay.entries()).map(([date, list]) => {
            const isToday = date === today;
            const past = date < today;
            return (
              <div key={date} className={`rounded-[14px] border p-3 ${isToday ? "border-indigo-500/35 bg-indigo-500/[0.04]" : "border-white/[0.06] bg-white/[0.01]"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[13px] font-bold ${isToday ? "text-indigo-300" : past ? "text-muted-foreground" : "text-foreground"}`}>
                      {DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()]}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{shortDate(date)}</span>
                    {isToday && <span className="cc-badge bg-indigo-500/20 text-indigo-300">اليوم</span>}
                  </div>
                  <button
                    onClick={() => setForm({ id: null, data: emptyForm(date) })}
                    title="اجتماع في هذا اليوم"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {list.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground/60">لا يوجد اجتماعات</p>
                ) : (
                  <div className="space-y-1.5">
                    {list.map((m) => (
                      <MeetingCard
                        key={m.id}
                        m={m}
                        open={expanded === m.id}
                        editable={canEdit(m)}
                        onToggle={() => setExpanded((e) => (e === m.id ? null : m.id))}
                        onEdit={() => setForm({
                          id: m.id,
                          data: {
                            title: m.title, meeting_type: m.meeting_type, meeting_date: m.meeting_date, start_time: m.start_time,
                            duration_minutes: m.duration_minutes, location: m.location ?? "", attendees: m.attendees ?? [], agenda: m.agenda ?? "",
                          },
                        })}
                        onPatch={(body, msg) => patch(m, body, msg)}
                        onDelete={() => remove(m)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => onChange({ ...value, [k]: v });
  const toggleAttendee = (name: string) =>
    set("attendees", value.attendees.includes(name) ? value.attendees.filter((a) => a !== name) : [...value.attendees, name]);
  const addExtra = () => {
    const n = extra.trim();
    if (n && !value.attendees.includes(n)) set("attendees", [...value.attendees, n]);
    setExtra("");
  };
  const options = Array.from(new Set([...users, ...value.attendees]));

  return (
    <div className="rounded-[14px] glass-surface border border-border p-4 space-y-4">
      <h3 className="text-sm font-bold text-foreground">{isNew ? "اجتماع جديد" : "تعديل الاجتماع"}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">عنوان الاجتماع</label>
          <input value={value.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: مراجعة أداء المبيعات" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">النوع</label>
          <select value={value.meeting_type} onChange={(e) => set("meeting_type", e.target.value as MeetingType)} className={inputCls}>
            {MEETING_TYPES.map((t) => <option key={t} value={t} className="bg-card">{MEETING_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

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
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">المكان أو الرابط</label>
          <input value={value.location} onChange={(e) => set("location", e.target.value)} placeholder="المكتب / رابط Meet" className={inputCls} />
        </div>
      </div>

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

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">الأجندة <span className="font-normal">(اختياري)</span></label>
        <textarea value={value.agenda} onChange={(e) => set("agenda", e.target.value)} rows={3} placeholder={"١. ...\n٢. ..."} className={`${inputCls} resize-y`} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">إلغاء</button>
        <button
          disabled={saving || !value.title.trim() || !value.meeting_date || !value.start_time}
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
  const [busy, setBusy] = useState(false);
  const cancelled = m.status === "cancelled";
  const done = m.status === "done";
  const minutesDirty = minutes.trim() !== (m.minutes ?? "");

  async function run(body: Record<string, unknown>, msg?: string) {
    setBusy(true);
    await onPatch(body, msg);
    setBusy(false);
  }

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
            {done && <span className="cc-badge bg-emerald-500/15 text-emerald-400">تم</span>}
            {cancelled && <span className="cc-badge bg-slate-500/15 text-slate-400">ملغي</span>}
            {done && !m.minutes && <span className="cc-badge bg-amber-500/15 text-amber-400">بدون محضر</span>}
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
            {m.attendees?.length > 0 && (
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {m.attendees.slice(0, 4).join("، ")}{m.attendees.length > 4 ? ` +${m.attendees.length - 4}` : ""}</span>
            )}
            {m.location && (
              <span className="flex items-center gap-1">{isLink(m.location) ? <Link2 className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}{isLink(m.location) ? "رابط الاجتماع" : m.location}</span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-3 py-3 space-y-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> {fmtTime(m.start_time)} — {fmtTime(endTime(m.start_time, m.duration_minutes))}
            {m.created_by_name && <span> · جدولة {m.created_by_name}</span>}
          </p>
          {m.location && isLink(m.location) && (
            <a href={m.location} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-indigo-300 hover:underline">
              <Link2 className="w-3.5 h-3.5" /> فتح رابط الاجتماع
            </a>
          )}
          {m.attendees?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {m.attendees.map((a) => <span key={a} className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] text-foreground">{a}</span>)}
            </div>
          )}
          {m.agenda && (
            <div>
              <p className="text-[11px] font-bold text-muted-foreground mb-1">الأجندة</p>
              <p className="text-[13px] text-foreground/90 whitespace-pre-line">{m.agenda}</p>
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
                    placeholder="وش انقال، وش انقرر، ومين مسؤول عن وش..."
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

