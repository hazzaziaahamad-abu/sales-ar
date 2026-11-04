"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Check, ChevronLeft, ChevronRight, ExternalLink, Loader2, MessageCircle, Pencil, Plus, Target, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTENT_TYPES, DAY_NAMES, FORMATS, MONTH_NAMES, PLATFORMS, STATUSES,
  addDays, addMonths, daysInMonth, dowOf, fmtNum, monthStartOf, verdictOf, weekStartOf,
  type ContentType, type DeskDay, type DeskGoals, type DeskItem, type DeskPayload, type Format, type ItemStatus, type Platform,
} from "@/lib/content-desk/types";

type View = "month" | "week" | "day";

const PLAT_CHIP: Record<Platform, string> = {
  ig: "bg-pink-500/15 text-pink-400",
  tt: "bg-violet-500/15 text-violet-400",
  both: "bg-cyan/15 text-cyan",
};
const PLAT_DOT: Record<Platform, string> = { ig: "bg-pink-400", tt: "bg-violet-400", both: "bg-cyan" };
const TONE: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-400",
  warn: "bg-amber-500/15 text-amber-400",
  bad: "bg-red-500/15 text-red-400",
  muted: "bg-white/[0.06] text-muted-foreground",
};
const inputCls =
  "w-full rounded-lg border border-border bg-white/[0.06] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan/50";
const CHECKLIST = [{ key: "replies", label: "الرد على التعليقات والرسائل" }];

const dayLabel = (s: string) => `${DAY_NAMES[dowOf(s)]} ${Number(s.slice(8))} ${MONTH_NAMES[Number(s.slice(5, 7)) - 1]}`;
const monthLabel = (s: string) => `${MONTH_NAMES[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;

function PlatTags({ p }: { p: Platform }) {
  const list: Platform[] = p === "both" ? ["ig", "tt"] : [p];
  return (
    <span className="inline-flex gap-1">
      {list.map((x) => <span key={x} className={cn("rounded-md px-1.5 py-px text-[11px] font-bold", PLAT_CHIP[x])}>{PLATFORMS[x]}</span>)}
    </span>
  );
}

function Bar({ value, target, className }: { value: number | null; target: number | null; className?: string }) {
  const p = value != null && target ? Math.min(1, value / target) : 0;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div className={cn("h-full rounded-full transition-[width]", p >= 1 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${p * 100}%` }} />
    </div>
  );
}

function CheckBtn({ on, onClick, disabled, label }: { on: boolean; onClick?: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={on}
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 transition-colors disabled:cursor-default",
        on ? "border-emerald-500 bg-emerald-500 text-white" : "border-border text-transparent hover:border-emerald-500/60",
      )}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </button>
  );
}

export default function ContentDesk() {
  const [data, setData] = useState<DeskPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("day");
  const [cursor, setCursor] = useState<string | null>(null);
  const [asUser, setAsUser] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<DeskItem> | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem("content-desk-view");
      if (v === "month" || v === "week" || v === "day") setView(v);
    } catch { /* ignore */ }
  }, []);
  const changeView = (v: View) => { setView(v); try { localStorage.setItem("content-desk-view", v); } catch { /* ignore */ } };

  // نطاق الجلب: شبكة شهر المؤشر كاملة (تغطي أسبوعه ويومه)
  const monthKey = cursor?.slice(0, 7) ?? null;
  const range = useMemo(() => {
    if (!monthKey) return null;
    const from = weekStartOf(`${monthKey}-01`);
    return { from, to: addDays(from, 41), period: monthKey };
  }, [monthKey]);

  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (range) { q.set("from", range.from); q.set("to", range.to); q.set("period", range.period); }
    if (asUser) q.set("as", asUser);
    try {
      const res = await fetch(`/api/content-desk?${q}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذّر التحميل");
      setData(json);
      setError(null);
      setCursor((c) => c ?? json.today);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [range, asUser]);

  useEffect(() => { load(); }, [load]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/content-desk", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, as: asUser }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "حدث خطأ");
    return json;
  }, [asUser]);

  if (error && !data) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>;
  if (!data || !cursor || !range) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const { today, items, canEdit } = data;
  const isOwn = data.owner.id === data.me.id;
  const daysMap = new Map<string, DeskDay>(data.days.map((d) => [d.day, d]));
  const waOn = (s: string) => !!daysMap.get(s)?.wa_status_at;
  const itemsOn = (s: string) => items.filter((i) => i.item_date === s);

  const replaceItem = (it: DeskItem) =>
    setData((d) => d && ({ ...d, items: [...d.items.filter((x) => x.id !== it.id), it].sort((a, b) => (a.item_date + (a.item_time ?? "")).localeCompare(b.item_date + (b.item_time ?? ""))) }));

  const toggleDone = async (it: DeskItem) => {
    if (!canEdit) return;
    const next = { ...it, status: (it.status === "done" ? "planned" : "done") as ItemStatus };
    replaceItem(next);
    try {
      const { item } = await post({ action: "save_item", item: next });
      replaceItem(item);
      if (item.status === "done" && item.actual_views == null && view !== "day") setEditing(item);
    } catch (e) { setError((e as Error).message); load(); }
  };

  const saveMetric = async (it: DeskItem, key: "actual_views" | "actual_engagement", raw: string) => {
    const val = raw === "" ? null : Math.max(0, Math.round(Number(raw)));
    if (val === it[key]) return;
    const next = { ...it, [key]: val, status: val != null ? "done" : it.status } as DeskItem;
    replaceItem(next);
    try { replaceItem((await post({ action: "save_item", item: next })).item); }
    catch (e) { setError((e as Error).message); load(); }
  };

  const setDay = (day: DeskDay) => setData((d) => d && ({ ...d, days: [...d.days.filter((x) => x.day !== day.day), day] }));
  const toggleWa = async () => {
    const on = !waOn(today);
    setDay({ day: today, wa_status_at: on ? new Date().toISOString() : null, checklist: daysMap.get(today)?.checklist ?? {} });
    try { setDay((await post({ action: "wa", on })).day); } catch (e) { setError((e as Error).message); load(); }
  };
  const toggleCheck = async (key: string) => {
    const cur = daysMap.get(today);
    const on = !cur?.checklist?.[key];
    setDay({ day: today, wa_status_at: cur?.wa_status_at ?? null, checklist: { ...(cur?.checklist ?? {}), [key]: on } });
    try { setDay((await post({ action: "check", key, on })).day); } catch (e) { setError((e as Error).message); load(); }
  };

  const move = (dir: 1 | -1) => {
    if (view === "month") setCursor(addMonths(cursor, dir));
    else setCursor(addDays(cursor, view === "week" ? 7 * dir : dir));
  };
  const openNew = (date?: string) =>
    setEditing({ item_date: date ?? cursor, item_time: "19:00", content_type: "awareness", platform: "ig", format: "reel", status: "planned", target_views: null, target_engagement: null });

  const title = view === "month" ? monthLabel(cursor)
    : view === "week" ? (() => { const ws = weekStartOf(cursor), we = addDays(ws, 6); return `${Number(ws.slice(8))} ${MONTH_NAMES[Number(ws.slice(5, 7)) - 1]} – ${Number(we.slice(8))} ${MONTH_NAMES[Number(we.slice(5, 7)) - 1]}`; })()
    : dayLabel(cursor);

  return (
    <div className="space-y-5" dir="rtl" lang="ar">
      {/* ─── الرأس ─── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/15 text-cyan"><CalendarDays className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-extrabold">مكتب المحتوى{!isOwn && <span className="text-cyan"> — {data.owner.name}</span>}</h1>
            <p className="text-xs text-muted-foreground">{dayLabel(today)} · خطة النشر لانستقرام وتيك توك وحالة الواتساب اليومية</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.me.isManager && (
            <select
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
              value={asUser ?? ""}
              onChange={(e) => { setAsUser(e.target.value || null); setData(null); }}
              aria-label="مكتب مين"
            >
              <option value="">مكتبي</option>
              {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button className="rounded-xl border border-border bg-card px-4 py-2 text-sm" onClick={() => setCursor(today)}>اليوم</button>
          {canEdit && (
            <button className="flex items-center gap-1.5 rounded-xl bg-cyan px-4 py-2 text-sm font-bold text-[#07090F]" onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> إضافة محتوى
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}<button onClick={() => setError(null)} aria-label="إغلاق"><X className="h-4 w-4" /></button>
        </div>
      )}

      <Goals period={range.period} items={items} goals={data.goals} today={today} canEdit={canEdit} onEdit={() => setGoalsOpen(true)} />

      <WaStrip today={today} waOn={waOn} isOwn={isOwn} onToggle={toggleWa} />

      {/* ─── الخطة ─── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1" role="group" aria-label="طريقة العرض">
            {([["month", "الشهر"], ["week", "الأسبوع"], ["day", "اليوم"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => changeView(k)} aria-pressed={view === k}
                className={cn("rounded-lg px-4 py-1.5 text-sm font-bold", view === k ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:text-foreground")}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-8 w-8 place-items-center rounded-lg border border-border" onClick={() => move(-1)} aria-label="السابق"><ChevronRight className="h-4 w-4" /></button>
            <h2 className="min-w-[150px] text-center text-sm font-bold">{title}</h2>
            <button className="grid h-8 w-8 place-items-center rounded-lg border border-border" onClick={() => move(1)} aria-label="التالي"><ChevronLeft className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-pink-400" />انستقرام</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-violet-400" />تيك توك</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-cyan" />المنصتين</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />تم تفعيل حالة الواتساب</span>
          <span>المشطوب = منجز</span>
        </div>

        {view === "month" && (
          <MonthView cursor={cursor} today={today} itemsOn={itemsOn} waOn={waOn}
            onPick={(s) => { setCursor(s); changeView("day"); }} />
        )}
        {view === "week" && (
          <WeekView cursor={cursor} today={today} itemsOn={itemsOn} waOn={waOn} canEdit={canEdit}
            onToggle={toggleDone} onEdit={setEditing} onAdd={openNew} />
        )}
        {view === "day" && (
          <DayView day={cursor} today={today} items={itemsOn(cursor)} dayRow={daysMap.get(cursor)} canEdit={canEdit} isOwn={isOwn}
            onToggle={toggleDone} onEdit={setEditing} onAdd={openNew} onMetric={saveMetric} onWa={toggleWa} onCheck={toggleCheck} />
        )}
      </section>

      {editing && (
        <ItemModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (it) => { const { item } = await post({ action: "save_item", item: it }); replaceItem(item); setEditing(null); }}
          onDelete={editing.id ? async () => {
            await post({ action: "delete_item", id: editing.id });
            setData((d) => d && ({ ...d, items: d.items.filter((x) => x.id !== editing.id) }));
            setEditing(null);
          } : undefined}
        />
      )}
      {goalsOpen && (
        <GoalsModal
          period={range.period} goals={data.goals}
          onClose={() => setGoalsOpen(false)}
          onSave={async (g) => { const { goals } = await post({ action: "goals", period: range.period, ...g }); setData((d) => d && ({ ...d, goals })); setGoalsOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── أهداف الشهر ───────────────────────────────────────────────────────────
function Goals({ period, items, goals, today, canEdit, onEdit }: {
  period: string; items: DeskItem[]; goals: DeskGoals | null; today: string; canEdit: boolean; onEdit: () => void;
}) {
  const mine = items.filter((i) => i.item_date.startsWith(period));
  const done = mine.filter((i) => i.status === "done");
  const views = done.reduce((a, i) => a + (i.actual_views ?? 0), 0);
  const cur = today.slice(0, 7);
  const pace = period < cur ? 1 : period > cur ? 0 : Number(today.slice(8)) / daysInMonth(period);

  const tiles = [
    { label: "مشاهدات الشهر", value: views, target: goals?.views_target ?? null, foot: `مجموع ${done.length} منشورات منشورة` },
    { label: "منشورات منجزة", value: done.length, target: goals?.posts_target ?? mine.length, foot: `المخطط هذا الشهر ${mine.length}` },
    { label: "متابعين انستقرام (جدد)", value: goals?.ig_followers_now ?? 0, target: goals?.ig_followers_target ?? null, foot: "يُحدّث من «الأهداف»" },
    { label: "متابعين تيك توك (جدد)", value: goals?.tt_followers_now ?? 0, target: goals?.tt_followers_target ?? null, foot: "يُحدّث من «الأهداف»" },
  ];

  return (
    <section aria-label="أهداف الشهر" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold"><Target className="h-4 w-4 text-cyan" /> أهداف {monthLabel(`${period}-01`)}</h3>
        {canEdit && <button className="text-xs font-bold text-cyan hover:underline" onClick={onEdit}>تعديل الأهداف والأرقام</button>}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const p = t.target ? Math.min(1, t.value / t.target) : 0;
          const onPace = p >= pace * 0.95;
          return (
            <div key={t.label} className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="truncate">{t.label}</span>
                {t.target ? (
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", onPace ? TONE.ok : TONE.warn)}>{onPace ? "على المسار" : "متأخر عن المسار"}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <b className="font-mono text-2xl font-bold" dir="ltr">{fmtNum(t.value)}</b>
                <span className="text-xs text-muted-foreground">{t.target ? <>من <span className="font-mono" dir="ltr">{fmtNum(t.target)}</span></> : "بدون هدف"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={cn("h-full rounded-full", onPace ? "bg-cyan" : "bg-amber-500")} style={{ width: `${p * 100}%` }} />
              </div>
              <div className="text-[11px] text-muted-foreground">{t.foot}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── حالة الواتساب ─────────────────────────────────────────────────────────
function WaStrip({ today, waOn, isOwn, onToggle }: { today: string; waOn: (s: string) => boolean; isOwn: boolean; onToggle: () => void }) {
  const period = today.slice(0, 7);
  const dim = daysInMonth(period);
  const todayN = Number(today.slice(8));
  const days = Array.from({ length: dim }, (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`);
  const count = days.filter(waOn).length;
  const missed = days.filter((s) => s < today && !waOn(s)).length;
  const on = waOn(today);
  return (
    <section aria-label="حالة الواتساب" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400"><MessageCircle className="h-5 w-5" /></div>
      <div className="min-w-0">
        <h3 className="text-sm font-bold">حالة الواتساب اليومية</h3>
        <p className="text-xs text-muted-foreground">
          مفعّلة <span className="font-mono">{count}</span> من <span className="font-mono">{todayN}</span> يوم هذا الشهر
          {missed > 0 && <span className="text-red-400"> · فاتت {missed} {missed === 1 ? "يوم" : "أيام"}</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {days.map((s) => (
            <span key={s} title={dayLabel(s)}
              className={cn("h-3.5 w-3.5 rounded border",
                waOn(s) ? "border-emerald-500 bg-emerald-500" : s < today ? "border-red-500/70 bg-red-500/15" : "border-border bg-white/[0.04]",
                s === today && "outline outline-2 outline-offset-1 outline-cyan")} />
          ))}
        </div>
      </div>
      {isOwn ? (
        <button onClick={onToggle}
          className={cn("col-span-2 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold sm:col-span-1",
            on ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-500 text-white")}>
          {on ? <><Check className="h-4 w-4" /> تم تفعيل حالة اليوم</> : "فعّلت حالة اليوم"}
        </button>
      ) : (
        <span className={cn("col-span-2 rounded-xl px-4 py-2 text-center text-sm font-bold sm:col-span-1", on ? TONE.ok : TONE.bad)}>
          {on ? "مفعّلة اليوم" : "ما تفعّلت اليوم"}
        </span>
      )}
    </section>
  );
}

// ─── الشهر ─────────────────────────────────────────────────────────────────
function MonthView({ cursor, today, itemsOn, waOn, onPick }: {
  cursor: string; today: string; itemsOn: (s: string) => DeskItem[]; waOn: (s: string) => boolean; onPick: (s: string) => void;
}) {
  const ms = monthStartOf(cursor), m = cursor.slice(0, 7), start = weekStartOf(ms);
  const cells: string[] = [];
  for (let i = 0; i < 42; i++) {
    const s = addDays(start, i);
    if (i >= 35 && !s.startsWith(m)) break;
    cells.push(s);
  }
  return (
    <div className="grid grid-cols-7">
      {["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"].map((d) => (
        <div key={d} className="border-b border-border py-2 text-center text-[11px] font-bold text-muted-foreground">{d}</div>
      ))}
      {cells.map((s, i) => {
        const its = itemsOn(s);
        return (
          <button key={s} onClick={() => onPick(s)}
            className={cn("flex min-h-16 flex-col gap-1 border-b border-border p-1 text-start hover:bg-cyan/[0.06] sm:min-h-28 sm:p-1.5",
              i % 7 !== 0 && "border-s", !s.startsWith(m) && "bg-white/[0.02] opacity-50")}>
            <span className="flex items-center justify-between text-xs">
              <b className={cn("font-mono font-medium", s === today && "rounded-md bg-cyan px-1.5 text-[#07090F]")}>{Number(s.slice(8))}</b>
              {waOn(s) && <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="حالة الواتساب" />}
            </span>
            <span className="hidden flex-col gap-1 sm:flex">
              {its.slice(0, 3).map((it) => {
                const late = verdictOf(it, today).tone === "bad";
                return (
                  <span key={it.id} className={cn("truncate rounded-md px-1.5 py-0.5 text-[11px]", PLAT_CHIP[it.platform], it.status === "done" && "line-through opacity-70")}>
                    {it.status === "done" ? "✓ " : late ? "! " : ""}{it.idea}
                  </span>
                );
              })}
              {its.length > 3 && <span className="text-[10px] text-muted-foreground">+{its.length - 3} أخرى</span>}
            </span>
            <span className="flex flex-wrap gap-0.5 sm:hidden">
              {its.map((it) => <i key={it.id} className={cn("h-1.5 w-1.5 rounded-full", PLAT_DOT[it.platform], it.status === "done" && "opacity-40")} />)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── الأسبوع ───────────────────────────────────────────────────────────────
function WeekView({ cursor, today, itemsOn, waOn, canEdit, onToggle, onEdit, onAdd }: {
  cursor: string; today: string; itemsOn: (s: string) => DeskItem[]; waOn: (s: string) => boolean; canEdit: boolean;
  onToggle: (it: DeskItem) => void; onEdit: (it: DeskItem) => void; onAdd: (s: string) => void;
}) {
  const ws = weekStartOf(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="bg-white/[0.03] text-xs text-muted-foreground">
            <th className="w-12 px-3 py-2.5" />
            <th className="px-3 py-2.5 text-start font-bold">فكرة المحتوى</th>
            <th className="px-3 py-2.5 text-start font-bold">نوع المحتوى</th>
            <th className="px-3 py-2.5 text-start font-bold">المنصة</th>
            <th className="px-3 py-2.5 text-start font-bold">الهدف</th>
            <th className="px-3 py-2.5 text-start font-bold">المشاهدات (فعلي / مستهدف)</th>
            <th className="px-3 py-2.5 text-start font-bold">الحالة</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {days.map((s) => {
            const its = itemsOn(s);
            return [
              <tr key={s} className="border-t border-border bg-white/[0.03]">
                <td colSpan={8} className={cn("px-3 py-1.5 text-xs font-bold", s === today && "text-cyan")}>
                  <div className="flex items-center gap-2">
                    {DAY_NAMES[dowOf(s)]} <span className="font-mono" dir="ltr">{Number(s.slice(8))}/{Number(s.slice(5, 7))}</span>
                    {waOn(s) && <span className="text-[11px] text-emerald-400">● واتساب</span>}
                    {canEdit && (
                      <button className="ms-auto rounded-md border border-dashed border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground hover:text-foreground" onClick={() => onAdd(s)}>+ إضافة</button>
                    )}
                  </div>
                </td>
              </tr>,
              ...(its.length ? its.map((it) => {
                const v = verdictOf(it, today), done = it.status === "done";
                return (
                  <tr key={it.id} className="border-t border-border hover:bg-cyan/[0.04]">
                    <td className="px-3 py-2.5"><CheckBtn on={done} onClick={() => onToggle(it)} disabled={!canEdit} label="تحويل إلى مكتمل" /></td>
                    <td className="px-3 py-2.5">
                      <div className={cn(done && "text-muted-foreground line-through")}>{it.idea}</div>
                      {it.item_time && <div className="font-mono text-[11px] text-muted-foreground">{it.item_time}</div>}
                    </td>
                    <td className="px-3 py-2.5">{CONTENT_TYPES[it.content_type].label}<div className="text-[11px] text-muted-foreground">{FORMATS[it.format]}</div></td>
                    <td className="px-3 py-2.5"><PlatTags p={it.platform} /></td>
                    <td className="px-3 py-2.5">{CONTENT_TYPES[it.content_type].goal}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs" dir="ltr">{fmtNum(it.actual_views)} / {fmtNum(it.target_views)}</span>
                      <Bar value={it.actual_views} target={it.target_views} className="mt-1 w-24" />
                    </td>
                    <td className="px-3 py-2.5"><span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[v.tone])}>{v.label}</span></td>
                    <td className="px-3 py-2.5">{canEdit && <button className="text-xs text-cyan hover:underline" onClick={() => onEdit(it)}>تعديل</button>}</td>
                  </tr>
                );
              }) : [<tr key={`${s}-e`} className="border-t border-border"><td colSpan={8} className="px-3 py-2.5 text-xs text-muted-foreground">لا يوجد محتوى مخطط</td></tr>]),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── اليوم ─────────────────────────────────────────────────────────────────
function DayView({ day, today, items, dayRow, canEdit, isOwn, onToggle, onEdit, onAdd, onMetric, onWa, onCheck }: {
  day: string; today: string; items: DeskItem[]; dayRow?: DeskDay; canEdit: boolean; isOwn: boolean;
  onToggle: (it: DeskItem) => void; onEdit: (it: DeskItem) => void; onAdd: (s: string) => void;
  onMetric: (it: DeskItem, key: "actual_views" | "actual_engagement", raw: string) => void;
  onWa: () => void; onCheck: (key: string) => void;
}) {
  const done = items.filter((i) => i.status === "done");
  const isToday = day === today;
  const canTick = isOwn && isToday;
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            ما فيه محتوى مخطط لهذا اليوم
            {canEdit && <div><button className="mt-3 rounded-xl bg-cyan px-4 py-2 text-sm font-bold text-[#07090F]" onClick={() => onAdd(day)}>+ إضافة محتوى</button></div>}
          </div>
        )}
        {items.map((it) => {
          const v = verdictOf(it, today), isDone = it.status === "done";
          return (
            <article key={it.id} className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-border p-4", isDone ? "bg-white/[0.02]" : "bg-card")}>
              <CheckBtn on={isDone} onClick={() => onToggle(it)} disabled={!canEdit} label="تحويل إلى مكتمل" />
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className={cn("font-bold", isDone && "text-muted-foreground line-through")}>{it.idea}</h4>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[v.tone])}>{v.label}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {it.item_time && <><span className="font-mono">{it.item_time}</span>·</>}
                  <span>{CONTENT_TYPES[it.content_type].label}</span>·<span>{FORMATS[it.format]}</span>·<PlatTags p={it.platform} />·
                  <span className="text-cyan">🎯 {CONTENT_TYPES[it.content_type].goal}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {([["actual_views", "المشاهدات", it.target_views], ["actual_engagement", "التفاعل", it.target_engagement]] as const).map(([key, label, target]) => (
                    <div key={key} className="space-y-1.5 rounded-lg bg-white/[0.04] p-2.5">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{label}</span><span>الهدف <span className="font-mono">{fmtNum(target)}</span></span>
                      </div>
                      <input
                        key={`${it.id}-${key}-${it[key] ?? ""}`}
                        type="number" min={0} inputMode="numeric" dir="ltr" disabled={!canEdit}
                        defaultValue={it[key] ?? ""} placeholder="الرقم الفعلي" aria-label={`${label} الفعلي`}
                        onBlur={(e) => onMetric(it, key, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="w-full rounded-md border border-border bg-card px-2 py-1 text-right font-mono text-sm focus:outline-none focus:ring-1 focus:ring-cyan/50"
                      />
                      <Bar value={it[key]} target={target} />
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-4 text-xs">
                  {canEdit && <button className="flex items-center gap-1 text-cyan hover:underline" onClick={() => onEdit(it)}><Pencil className="h-3 w-3" /> تعديل التفاصيل</button>}
                  {it.link && <a className="flex items-center gap-1 text-cyan hover:underline" href={it.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" /> فتح المنشور</a>}
                </div>
                {it.note && <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{it.note}</p>}
              </div>
            </article>
          );
        })}
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-border bg-white/[0.03] p-4">
          <h4 className="mb-2 text-sm font-bold">قائمة اليوم</h4>
          <div className="divide-y divide-border text-sm">
            <div className="flex items-center gap-2.5 py-2"><CheckBtn on={!!dayRow?.wa_status_at} onClick={onWa} disabled={!canTick} label="تفعيل حالة الواتساب" />تفعيل حالة الواتساب</div>
            <div className="flex items-center gap-2.5 py-2"><CheckBtn on={items.length > 0 && done.length === items.length} disabled label="نشر المحتوى" />نشر المحتوى المخطط (<span className="font-mono">{done.length}/{items.length}</span>)</div>
            <div className="flex items-center gap-2.5 py-2"><CheckBtn on={done.length > 0 && done.every((i) => i.actual_views != null)} disabled label="إدخال الأرقام" />إدخال أرقام المنشورات</div>
            {CHECKLIST.map((c) => (
              <div key={c.key} className="flex items-center gap-2.5 py-2"><CheckBtn on={!!dayRow?.checklist?.[c.key]} onClick={() => onCheck(c.key)} disabled={!canTick} label={c.label} />{c.label}</div>
            ))}
          </div>
          {!isToday && <p className="mt-2 text-[11px] text-muted-foreground">قائمة اليوم تتأشّر في يومها فقط.</p>}
        </div>
        <div className="rounded-xl border border-border bg-white/[0.03] p-4 text-xs text-muted-foreground">
          <b className="mb-1 block text-sm text-foreground">تذكير</b>
          أدخل الأرقام بعد ٢٤ ساعة من النشر عشان تكون المقارنة بالهدف عادلة.
        </div>
        {canEdit && <button className="w-full rounded-xl border border-border py-2 text-sm" onClick={() => onAdd(day)}>+ إضافة محتوى لهذا اليوم</button>}
      </aside>
    </div>
  );
}

// ─── نافذة المنشور ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5" dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} aria-label="إغلاق" className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function L({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={cn("flex flex-col gap-1 text-xs text-muted-foreground", full && "sm:col-span-2")}>{label}{children}</label>;
}

const numStr = (v: number | null | undefined) => (v == null ? "" : String(v));

function ItemModal({ initial, onClose, onSave, onDelete }: {
  initial: Partial<DeskItem>; onClose: () => void; onSave: (it: Partial<DeskItem>) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const [f, setF] = useState({
    idea: initial.idea ?? "", item_date: initial.item_date ?? "", item_time: initial.item_time ?? "",
    content_type: (initial.content_type ?? "awareness") as ContentType, platform: (initial.platform ?? "ig") as Platform,
    format: (initial.format ?? "reel") as Format, status: (initial.status ?? "planned") as ItemStatus,
    target_views: numStr(initial.target_views), target_engagement: numStr(initial.target_engagement),
    actual_views: numStr(initial.actual_views), actual_engagement: numStr(initial.actual_engagement),
    link: initial.link ?? "", note: initial.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const n = (s: string) => (s === "" ? null : Number(s));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.idea.trim()) { setErr("اكتب فكرة المحتوى"); return; }
    setBusy(true); setErr(null);
    try {
      await onSave({
        id: initial.id, ...f, item_time: f.item_time || null,
        target_views: n(f.target_views), target_engagement: n(f.target_engagement),
        actual_views: n(f.actual_views), actual_engagement: n(f.actual_engagement),
      });
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  const del = async () => {
    if (!onDelete) return;
    if (!sure) { setSure(true); return; }
    setBusy(true);
    try { await onDelete(); } catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  return (
    <Modal title={initial.id ? "تعديل المحتوى" : "إضافة محتوى"} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <L label="فكرة المحتوى" full><input id="cd-idea" autoFocus className={inputCls} value={f.idea} onChange={(e) => set("idea", e.target.value)} placeholder="مثال: ٣ أخطاء تخسرك عملاء بدون ما تحس" /></L>
        <L label="التاريخ"><input id="cd-date" type="date" required className={inputCls} value={f.item_date} onChange={(e) => set("item_date", e.target.value)} /></L>
        <L label="وقت النشر"><input id="cd-time" type="time" className={inputCls} value={f.item_time} onChange={(e) => set("item_time", e.target.value)} /></L>
        <L label="نوع المحتوى">
          <select id="cd-type" className={inputCls} value={f.content_type} onChange={(e) => set("content_type", e.target.value as ContentType)}>
            {Object.entries(CONTENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </L>
        <L label="المنصة">
          <select id="cd-plat" className={inputCls} value={f.platform} onChange={(e) => set("platform", e.target.value as Platform)}>
            {Object.entries(PLATFORMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </L>
        <L label="الشكل">
          <select id="cd-format" className={inputCls} value={f.format} onChange={(e) => set("format", e.target.value as Format)}>
            {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </L>
        <L label="الحالة">
          <select id="cd-status" className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value as ItemStatus)}>
            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </L>
        <div className="text-xs font-bold text-cyan sm:col-span-2">🎯 الهدف من هذا المحتوى: {CONTENT_TYPES[f.content_type].goal}</div>
        <L label="المشاهدات المستهدفة"><input id="cd-tv" type="number" min={0} inputMode="numeric" className={inputCls} value={f.target_views} onChange={(e) => set("target_views", e.target.value)} /></L>
        <L label="التفاعل المستهدف (لايك+تعليق+حفظ)"><input id="cd-te" type="number" min={0} inputMode="numeric" className={inputCls} value={f.target_engagement} onChange={(e) => set("target_engagement", e.target.value)} /></L>
        <L label="المشاهدات الفعلية"><input id="cd-av" type="number" min={0} inputMode="numeric" className={inputCls} value={f.actual_views} onChange={(e) => set("actual_views", e.target.value)} /></L>
        <L label="التفاعل الفعلي"><input id="cd-ae" type="number" min={0} inputMode="numeric" className={inputCls} value={f.actual_engagement} onChange={(e) => set("actual_engagement", e.target.value)} /></L>
        <L label="رابط المنشور" full><input id="cd-link" dir="ltr" className={inputCls} value={f.link} onChange={(e) => set("link", e.target.value)} placeholder="https://" /></L>
        <L label="ملاحظات" full><textarea id="cd-note" rows={3} className={inputCls} value={f.note} onChange={(e) => set("note", e.target.value)} /></L>
        {err && <div className="text-sm text-red-400 sm:col-span-2">{err}</div>}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 sm:col-span-2">
          {onDelete ? (
            <button type="button" onClick={del} disabled={busy} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" /> {sure ? "تأكيد الحذف؟" : "حذف"}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">إلغاء</button>
            <button type="submit" disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-cyan px-5 py-2 text-sm font-bold text-[#07090F] disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function GoalsModal({ period, goals, onClose, onSave }: {
  period: string; goals: DeskGoals | null; onClose: () => void; onSave: (g: Record<string, number | null>) => Promise<void>;
}) {
  const fields = [
    ["views_target", "هدف المشاهدات للشهر"],
    ["posts_target", "هدف عدد المنشورات (فارغ = عدد المخطط)"],
    ["ig_followers_target", "هدف متابعين انستقرام الجدد"],
    ["ig_followers_now", "متابعين انستقرام الجدد حتى الآن"],
    ["tt_followers_target", "هدف متابعين تيك توك الجدد"],
    ["tt_followers_now", "متابعين تيك توك الجدد حتى الآن"],
  ] as const;
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(([k]) => [k, numStr(goals?.[k])])));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await onSave(Object.fromEntries(fields.map(([k]) => [k, f[k] === "" ? null : Number(f[k])]))); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <Modal title={`أهداف ${monthLabel(`${period}-01`)}`} onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">
            {label}
            <input id={`cd-g-${k}`} type="number" min={0} inputMode="numeric" className={inputCls} value={f[k]} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} />
          </label>
        ))}
        <p className="text-[11px] text-muted-foreground sm:col-span-2">المشاهدات والمنشورات المنجزة تتجمّع تلقائياً من المنشورات. المتابعين تحدّثهم أسبوعياً من هنا.</p>
        {err && <div className="text-sm text-red-400 sm:col-span-2">{err}</div>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">إلغاء</button>
          <button type="submit" disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-cyan px-5 py-2 text-sm font-bold text-[#07090F] disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
          </button>
        </div>
      </form>
    </Modal>
  );
}
