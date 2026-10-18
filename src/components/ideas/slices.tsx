"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Flame, Loader2, Moon, Play, Plus, Scissors, Sun, SunDim, Trash2, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DAY_LIMIT, SLICE_KINDS, SLICE_MAX, SLICE_MIN, ideaProgress, parentOf,
  type FocusSlice, type FocusStats, type SliceKind, type SliceSpace,
} from "@/lib/focus-slices";
import { SLICES_CHANGED_EVENT } from "@/lib/focus-session";
import { FocusStartDialog } from "@/components/focus/focus-overlay";

/**
 * «الشرائح» — تقطيع الفكرة لمهام تنجز كل وحدة في جلسة واحدة، واختيار «شرائح اليوم»:
 * عميقة واحدة + ٣ سطحية كحد أقصى، والباقي مخفي في قائمة منفصلة.
 */

const num = (n: number) => n.toLocaleString("ar-SA");
/** «لبكرة» أو «ليوم الأحد». */
export const forDay = (label: string) => (label === "بكرة" ? "لبكرة" : `ليوم ${label}`);
type Patch = { title?: string; kind?: SliceKind; plan?: "today" | "tomorrow" | null; done?: boolean; session_at?: string | null };

// ─── البيانات ────────────────────────────────────────────────────────────────

export function useSlices(space: SliceSpace) {
  const [slices, setSlices] = useState<FocusSlice[]>([]);
  const [today, setToday] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(slices);
  useEffect(() => { ref.current = slices; }, [slices]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/focus-slices?space=${space}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setSlices(json.slices ?? []);
        setToday(json.today ?? "");
        setTomorrow(json.tomorrow ?? "");
      }
    } finally {
      setLoaded(true);
    }
  }, [space]);

  useEffect(() => { load(); }, [load]);
  // وضع التركيز يعدّل الشرائح من خارج الصفحة (أنجزت / دقائق التركيز)
  useEffect(() => {
    window.addEventListener(SLICES_CHANGED_EVENT, load);
    return () => window.removeEventListener(SLICES_CHANGED_EVENT, load);
  }, [load]);

  const create = useCallback(async (parentId: string, rows: { title: string; kind: SliceKind }[]) => {
    const res = await fetch("/api/focus-slices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ space, parent_id: parentId, slices: rows }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "تعذّر حفظ الشرائح");
    setSlices((p) => [...p, ...(json.slices ?? [])]);
  }, [space]);

  /** مهمة سريعة بدون أم تنضاف مباشرة لشرائح اليوم. */
  const quickAdd = useCallback(async (title: string, kind: SliceKind) => {
    const res = await fetch("/api/focus-slices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ space, plan: "today", slices: [{ title, kind }] }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "تعذّرت الإضافة");
    const row = json.slices?.[0] as FocusSlice | undefined;
    if (row) setSlices((p) => [...p, row]);
    return row ?? null;
  }, [space]);

  /** تحديث متفائل — يرجع للحالة السابقة ويرمي الخطأ لو رفض السيرفر (مثل تجاوز حد اليوم). */
  const patch = useCallback(async (id: string, body: Patch) => {
    const before = ref.current.find((s) => s.id === id);
    setSlices((p) => p.map((s) => {
      if (s.id !== id) return s;
      const next = { ...s };
      if (body.title !== undefined) next.title = body.title;
      if (body.kind) next.kind = body.kind;
      if ("plan" in body) next.planned_for = body.plan === "today" ? today : body.plan === "tomorrow" ? tomorrow : null;
      if (body.done !== undefined) next.done_at = body.done ? new Date().toISOString() : null;
      if (body.session_at !== undefined) next.session_at = body.session_at;
      return next;
    }));
    const res = await fetch(`/api/focus-slices/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (before) setSlices((p) => p.map((s) => (s.id === id ? before : s)));
      throw new Error(json.error || "تعذّر التحديث");
    }
    setSlices((p) => p.map((s) => (s.id === id ? json.slice : s)));
  }, [today, tomorrow]);

  const remove = useCallback(async (id: string) => {
    const res = await fetch(`/api/focus-slices/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "تعذّر الحذف");
    setSlices((p) => p.filter((s) => s.id !== id));
  }, []);

  /** الشرائح حسب الأم (الفكرة أو بند العمل). */
  const byParent = useMemo(() => {
    const m = new Map<string, FocusSlice[]>();
    for (const s of slices) {
      const p = parentOf(s);
      if (p) m.set(p, [...(m.get(p) ?? []), s]);
    }
    return m;
  }, [slices]);

  return { space, slices, byParent, today, tomorrow, loaded, create, quickAdd, patch, remove, reload: load };
}

export type SlicesApi = ReturnType<typeof useSlices>;

/** الأماكن المتاحة في يوم لكل نوع. */
function freeToday(slices: FocusSlice[], today: string) {
  const planned = slices.filter((s) => s.planned_for === today);
  return {
    deep: DAY_LIMIT.deep - planned.filter((s) => s.kind === "deep").length,
    shallow: DAY_LIMIT.shallow - planned.filter((s) => s.kind === "shallow").length,
  };
}

/** رسالة مؤقتة صغيرة بدل alert. */
function useNotice() {
  const [notice, setNotice] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string) => {
    setNotice(msg);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setNotice(null), 4000);
  }, []);
  return { notice, show };
}

function Notice({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-400/25 rounded-xl px-3 py-2 animate-in fade-in">{text}</p>;
}

function KindBadge({ kind, onClick, small }: { kind: SliceKind; onClick?: () => void; small?: boolean }) {
  const k = SLICE_KINDS[kind];
  const cls = cn(
    "inline-flex items-center gap-1 rounded-full border font-bold whitespace-nowrap",
    small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
    kind === "deep" ? "bg-orange-500/15 text-orange-300 border-orange-400/30" : "bg-sky-500/10 text-sky-300 border-sky-400/25",
    onClick && "hover:brightness-125 transition"
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls} title={`${k.hint} — اضغط للتبديل`}>{k.icon} {k.label}</button>
  ) : (
    <span className={cls} title={k.hint}>{k.icon} {k.label}</span>
  );
}

// ─── صندوق الالتقاط السريع ────────────────────────────────────────────────────

export function QuickCapture({ onAdd, detailed, onToggleDetailed, placeholder }: {
  onAdd: (title: string) => Promise<boolean>; detailed?: boolean; onToggleDetailed?: () => void; placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try { if (await onAdd(t)) setText(""); } finally { setBusy(false); }
  };
  return (
    <section className="glass-surface rounded-[22px] border border-border p-3 sm:p-4 hover:translate-y-0">
      <div className="flex items-center gap-2">
        <span className="hidden sm:flex w-9 h-9 rounded-full bg-amber-400/15 text-amber-300 items-center justify-center shrink-0"><Zap className="w-4 h-4" /></span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={placeholder ?? "فكرة طارت في بالك؟ اكتبها بسطر واحد واضغط Enter"}
          maxLength={200}
          enterKeyHint="send"
          className="flex-1 min-w-0 rounded-full bg-white/[0.04] border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
        />
        <button onClick={submit} disabled={!text.trim() || busy}
          className="ib-cta shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-extrabold disabled:opacity-40 disabled:saturate-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span className="hidden sm:inline">التقط</span>
        </button>
      </div>
      {onToggleDetailed && <div className="flex justify-end mt-2">
        <button onClick={onToggleDetailed} className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
          {detailed ? "إخفاء الورقة المفصّلة" : "ورقة مفصّلة (نوع ووسم وتفاصيل) ✍️"}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", detailed && "rotate-180")} />
        </button>
      </div>}
    </section>
  );
}

// ─── شرائح اليوم + باقي الشرائح ───────────────────────────────────────────────

export function TodaySlices({ api, parentTitle, onOpenParent, readOnly, icon = "💡", emptyHint, nextLabel = "بكرة" }: {
  api: SlicesApi; parentTitle: (id: string | null) => string; onOpenParent: (id: string) => void;
  /** عرض فقط (مثل العمل الوظيفي خارج الدوام). */
  readOnly?: boolean; icon?: string; emptyHint?: string; nextLabel?: string;
}) {
  const { slices, today, tomorrow, patch, loaded } = api;
  // المهام السريعة ما لها أم
  const titleOf = (id: string | null) => (id ? parentTitle(id) : "");
  const [showRest, setShowRest] = useState(false);
  const [focusing, setFocusing] = useState<FocusSlice | null>(null);
  const { notice, show } = useNotice();

  const todayList = useMemo(
    () => slices.filter((s) => s.planned_for === today).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "deep" ? -1 : 1)),
    [slices, today]
  );
  const rest = useMemo(() => slices.filter((s) => !s.done_at && s.planned_for !== today), [slices, today]);
  const free = freeToday(slices, today);
  const freeTomorrow = freeToday(slices, tomorrow);
  const tomorrowCount = slices.filter((s) => s.planned_for === tomorrow).length;
  const deep = todayList.filter((s) => s.kind === "deep");
  const shallow = todayList.filter((s) => s.kind === "shallow");
  const doneToday = todayList.filter((s) => s.done_at).length;

  const groups = useMemo(() => {
    const m = new Map<string, FocusSlice[]>();
    for (const s of rest) { const k = parentOf(s) ?? ""; m.set(k, [...(m.get(k) ?? []), s]); }
    return [...m.entries()];
  }, [rest]);

  const run = async (id: string, body: Patch) => { try { await patch(id, body); } catch (e) { show((e as Error).message); } };
  /** كتابة مهمة في خانة فاضية — ومع «ابدأ» تنفتح جلسة التركيز ويبدأ العدّاد. */
  const quick = async (title: string, kind: SliceKind, start: boolean) => {
    try {
      const row = await api.quickAdd(title, kind);
      if (row && start) setFocusing(row);
      return true;
    } catch (e) { show((e as Error).message); return false; }
  };

  if (!loaded) return null;
  // بدون شرائح: الخانات الفاضية تنكتب مباشرة، إلا في وضع العرض
  if (slices.length === 0 && readOnly) {
    return (
      <section className="rounded-[22px] border border-dashed border-border p-4 text-center">
        <p className="text-sm font-bold text-foreground">🎯 شرائح اليوم</p>
        <p className="text-xs text-muted-foreground mt-1">{emptyHint ?? "افتح أي فكرة واضغط «قطّع ✂️» — تتحول لشرائح صغيرة تختار منها شغل يومك"}</p>
      </section>
    );
  }

  return (
    <section className="glass-surface rounded-[22px] border border-border p-4 sm:p-5 space-y-4 hover:translate-y-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-foreground">🎯 شرائح اليوم</h2>
          <p className="text-[11px] text-muted-foreground">عميقة وحدة + {num(DAY_LIMIT.shallow)} سطحية كحد أقصى — ركّز على القليل وأنجزه</p>
        </div>
        <FocusCounter signal={slices.filter((s) => s.done_at).length} />
        {todayList.length > 0 && (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-400/25">
            أنجزت {num(doneToday)} من {num(todayList.length)}
          </span>
        )}
      </div>

      <Notice text={notice} />

      <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
        {/* الشريحة العميقة */}
        <div className="rounded-2xl border border-orange-400/25 bg-gradient-to-bl from-orange-500/[0.09] to-transparent p-3">
          <p className="text-[11px] font-bold text-orange-300 mb-2">🔥 الشريحة العميقة (٦٠–٩٠ د)</p>
          {deep.length ? deep.map((s) => (
            <TodayRow key={s.id} slice={s} parent={titleOf(parentOf(s))} icon={icon} readOnly={readOnly} big
              onOpenIdea={() => { const p = parentOf(s); if (p) onOpenParent(p); }}
              onDone={() => run(s.id, { done: !s.done_at })}
              onFocus={() => setFocusing(s)}
              onUnplan={() => run(s.id, { plan: null })} />
          )) : readOnly ? (
            <p className="text-xs text-muted-foreground py-3 text-center">ما فيه شريحة عميقة اليوم</p>
          ) : (
            <div className="space-y-1.5">
              <QuickSlot kind="deep" onAdd={quick} placeholder="اكتب الشريحة العميقة هنا…" />
              <p className="text-[10px] text-muted-foreground text-center">أو اختر وحدة من «باقي الشرائح» 👇</p>
            </div>
          )}
        </div>
        {/* السطحية */}
        <div className="rounded-2xl border border-sky-400/20 bg-gradient-to-bl from-sky-500/[0.07] to-transparent p-3">
          <p className="text-[11px] font-bold text-sky-300 mb-2">⚡ سطحية (أقل من ١٥ د) · {num(shallow.length)}/{num(DAY_LIMIT.shallow)}</p>
          <div className="space-y-1.5">
            {shallow.map((s) => (
              <TodayRow key={s.id} slice={s} parent={titleOf(parentOf(s))} icon={icon} readOnly={readOnly}
                onOpenIdea={() => { const p = parentOf(s); if (p) onOpenParent(p); }}
                onDone={() => run(s.id, { done: !s.done_at })}
                onFocus={() => setFocusing(s)}
                onUnplan={() => run(s.id, { plan: null })} />
            ))}
            {Array.from({ length: Math.max(0, free.shallow) }).map((_, i) => (
              readOnly || i > 0
                ? <div key={i} className="h-9 rounded-xl border border-dashed border-white/[0.08]" />
                : <QuickSlot key={i} kind="shallow" onAdd={quick} placeholder="اكتب مهمة سطحية هنا…" />
            ))}
          </div>
        </div>
      </div>

      {/* باقي الشرائح — مخفية افتراضياً */}
      <div>
        <button onClick={() => setShowRest((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-border text-xs font-bold text-muted-foreground hover:text-foreground">
          <span>📦 باقي الشرائح ({num(rest.length)}){tomorrowCount > 0 && <span className="text-violet-300 font-semibold"> · 🌙 {nextLabel} {num(tomorrowCount)}</span>}</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showRest && "rotate-180")} />
        </button>
        {showRest && (
          <div className="mt-3 space-y-3">
            {groups.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">ما فيه شرائح باقية — قطّع {icon === "💡" ? "فكرة جديدة" : "بند جديد"} ✂️</p>}
            {groups.map(([pid, list]) => (
              <div key={pid} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-2.5">
                {pid ? (
                  <button onClick={() => onOpenParent(pid)} className="text-[11px] font-bold text-amber-300/90 hover:underline mb-1.5 truncate max-w-full block text-right">
                    {icon} {parentTitle(pid)}
                  </button>
                ) : <p className="text-[11px] font-bold text-amber-300/90 mb-1.5">⚡ مهام سريعة</p>}
                <div className="space-y-1">
                  {list.map((s) => {
                    const full = free[s.kind] <= 0;
                    const isTomorrow = s.planned_for === tomorrow;
                    const fullTomorrow = freeTomorrow[s.kind] <= 0;
                    return (
                      <div key={s.id} className="flex items-center gap-2 py-1">
                        <KindBadge kind={s.kind} small />
                        <span className="flex-1 min-w-0 text-sm text-foreground truncate">{s.title}</span>
                        {s.planned_for && s.planned_for < today && <span className="text-[10px] text-muted-foreground shrink-0">من يوم سابق</span>}
                        {readOnly ? (isTomorrow && <Moon className="w-3.5 h-3.5 text-violet-300 shrink-0" />) : (<>
                        <button
                          onClick={() => isTomorrow
                            ? run(s.id, { plan: null })
                            : fullTomorrow
                              ? show(s.kind === "deep" ? `🌙 اخترت شريحة عميقة ${forDay(nextLabel)} — وحدة تكفي` : `🌙 اكتملت السطحية ${forDay(nextLabel)} (${num(DAY_LIMIT.shallow)})`)
                              : run(s.id, { plan: "tomorrow" })}
                          className={cn("shrink-0 p-1 rounded-full", isTomorrow ? "text-violet-300" : "text-muted-foreground/60 hover:text-violet-300")}
                          title={isTomorrow ? `مخططة ${forDay(nextLabel)} — اضغط للإلغاء` : `خططها ${forDay(nextLabel)}`}
                        >
                          <Moon className={cn("w-3.5 h-3.5", isTomorrow && "fill-violet-300/40")} />
                        </button>
                        <button
                          onClick={() => full
                            ? show(s.kind === "deep" ? "🔥 عندك شريحة عميقة اليوم — وحدة تكفي. أنجزها أو رجّعها أولاً" : `⚡ اكتملت الشرائح السطحية اليوم (${num(DAY_LIMIT.shallow)}) — رجّع وحدة أولاً`)
                            : run(s.id, { plan: "today" })}
                          className={cn("shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition",
                            full ? "border-border text-muted-foreground/50" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20")}
                          title={full ? "الحد اليومي مكتمل" : "أضفها لشرائح اليوم"}
                        >
                          <Sun className="w-3 h-3" /> لليوم
                        </button>
                        </>)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {focusing && <FocusStartDialog slice={focusing} parent={titleOf(parentOf(focusing))} onClose={() => setFocusing(null)} />}
    </section>
  );
}

/** العدّاد: العميقة المنجزة هالأسبوع + السلسلة (أيام متتالية فيها عميقة منجزة). */
export function FocusCounter({ signal }: { signal: number }) {
  const [stats, setStats] = useState<FocusStats | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/focus-slices/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setStats(j); })
      .catch(() => {});
    return () => { alive = false; };
  }, [signal]);
  if (!stats) return null;
  const DAYS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-orange-500/10 border border-orange-400/25" title="الشرائح العميقة المنجزة هالأسبوع (من الأحد)">
        <span className="text-lg font-extrabold text-orange-300 leading-none">{num(stats.weekDeep)}</span>
        <div className="leading-tight">
          <p className="text-[10px] font-bold text-orange-200">🔥 عميقة هالأسبوع</p>
          <div className="flex gap-0.5 mt-0.5">
            {stats.weekDays.map((d, i) => (
              <span key={d.date} title={d.date}
                className={cn("w-3.5 h-3.5 rounded-[4px] text-[8px] font-bold flex items-center justify-center",
                  d.deep ? "bg-orange-400 text-black" : d.date === stats.today ? "border border-orange-300/60 text-orange-200" : "bg-white/[0.06] text-muted-foreground/70")}>
                {DAYS[i]}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-400/25"
        title={`أطول سلسلة: ${stats.bestStreak} يوم`}>
        <Flame className={cn("w-5 h-5", stats.streak ? "text-amber-300 fill-amber-400/40" : "text-muted-foreground")} />
        <div className="leading-tight">
          <p className="text-sm font-extrabold text-amber-200">{num(stats.streak)} <span className="text-[10px] font-bold">يوم</span></p>
          <p className="text-[10px] text-muted-foreground">سلسلة متتالية</p>
        </div>
      </div>
    </div>
  );
}

/** خانة فاضية تنكتب فيها مهمة: Enter يضيفها، و«ابدأ» يضيفها ويشغّل العدّاد. */
function QuickSlot({ kind, placeholder, onAdd }: {
  kind: SliceKind; placeholder: string; onAdd: (title: string, kind: SliceKind, start: boolean) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (start: boolean) => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try { if (await onAdd(t, kind, start)) setText(""); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-white/[0.12] focus-within:border-solid focus-within:border-sky-400/40 px-1.5 py-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(false); } }}
        placeholder={placeholder}
        maxLength={140}
        enterKeyHint="done"
        className="flex-1 min-w-0 bg-transparent px-1.5 py-1 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
      />
      {text.trim() && (
        <>
          <button onClick={() => submit(false)} disabled={busy} title="أضفها لليوم"
            className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-40">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => submit(true)} disabled={busy} title="أضفها وابدأ العدّاد"
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25 disabled:opacity-40">
            <Play className="w-3 h-3" /> ابدأ
          </button>
        </>
      )}
    </div>
  );
}

function TodayRow({ slice, parent, icon, big, readOnly, onDone, onFocus, onUnplan, onOpenIdea }: {
  slice: FocusSlice; parent: string; icon: string; big?: boolean; readOnly?: boolean;
  onDone: () => void; onFocus: () => void; onUnplan: () => void; onOpenIdea: () => void;
}) {
  const done = !!slice.done_at;
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl px-2 py-1.5 bg-white/[0.02]", done && "opacity-60")}>
      <button onClick={onDone} title={done ? "تراجع" : "أنجزت"} disabled={readOnly}
        className={cn("shrink-0 rounded-full border-2 flex items-center justify-center transition disabled:cursor-default", big ? "w-7 h-7" : "w-6 h-6",
          done ? "bg-emerald-500 border-emerald-500 text-white" : "border-white/25 hover:border-emerald-400")}>
        {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("font-bold text-foreground leading-snug", big ? "text-sm sm:text-base" : "text-sm", done && "line-through")}>{slice.title}</p>
        {parent && <button onClick={onOpenIdea} className="text-[10px] text-muted-foreground hover:text-foreground truncate max-w-full block text-right">{icon} {parent}</button>}
      </div>
      {!done && !readOnly && (
        <>
          <button onClick={onFocus} title="ابدأ جلسة تركيز"
            className={cn("shrink-0 flex items-center gap-1 rounded-full font-bold border transition",
              big ? "px-3 py-1.5 text-xs bg-orange-500/20 text-orange-200 border-orange-400/40 hover:bg-orange-500/30"
                : "px-2 py-1 text-[11px] bg-white/[0.04] text-foreground/80 border-border hover:bg-white/[0.08]")}>
            <Play className="w-3 h-3" /> ركّز
          </button>
          <button onClick={onUnplan} title="رجّعها لباقي الشرائح" className="shrink-0 p-1 text-muted-foreground hover:text-foreground">
            <SunDim className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── شارة الإنجاز على الاستكر ──────────────────────────────────────────────────

export function SliceChip({ slices }: { slices: FocusSlice[] | undefined }) {
  const pct = ideaProgress(slices ?? []);
  if (pct === null) return null;
  const done = slices!.filter((s) => s.done_at).length;
  return (
    <span className={cn("ib-prog", pct === 100 && "ib-done")} title={`شرائحي: ${done}/${slices!.length} — ${pct}٪`}>
      <Scissors className="w-3 h-3" />
      {num(pct)}٪
    </span>
  );
}

// ─── لوحة الشرائح داخل نافذة الفكرة ────────────────────────────────────────────

type DraftRow = { title: string; kind: SliceKind };

export function IdeaSlicesPanel({ ideaId, api, suggestUrl, readOnly, className }: {
  ideaId: string; api: SlicesApi;
  /** رابط اقتراح التقطيع (افتراضياً لاستكرات الأفكار). */
  suggestUrl?: string; readOnly?: boolean; className?: string;
}) {
  const list = api.byParent.get(ideaId) ?? [];
  const [draft, setDraft] = useState<DraftRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { notice, show } = useNotice();
  const pct = ideaProgress(list);
  const free = freeToday(api.slices, api.today);

  const suggest = async () => {
    setBusy("ai");
    try {
      const res = await fetch(suggestUrl ?? `/api/idea-stickers/${ideaId}/slice`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "تعذّر التقطيع");
      setDraft(json.slices);
    } catch (e) {
      show((e as Error).message);
      setDraft(Array.from({ length: SLICE_MIN }, (_, i) => ({ title: "", kind: i === 0 ? "deep" : "shallow" })));
    } finally { setBusy(null); }
  };
  const saveDraft = async () => {
    const rows = (draft ?? []).map((r) => ({ ...r, title: r.title.trim() })).filter((r) => r.title);
    if (!rows.length) return show("اكتب شريحة واحدة على الأقل");
    setBusy("save");
    try { await api.create(ideaId, rows); setDraft(null); } catch (e) { show((e as Error).message); } finally { setBusy(null); }
  };
  const run = async (tag: string, fn: () => Promise<void>) => {
    setBusy(tag);
    try { await fn(); } catch (e) { show((e as Error).message); } finally { setBusy(null); }
  };
  const setRow = (i: number, r: Partial<DraftRow>) => setDraft((d) => d!.map((x, j) => (j === i ? { ...x, ...r } : x)));

  return (
    <div className={cn("rounded-2xl glass-surface border border-border p-4 space-y-3 hover:translate-y-0 text-right", className ?? "w-[min(92vw,420px)]")}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-foreground">✂️ شرائحي</p>
          <p className="text-[11px] text-muted-foreground">كل شريحة تبدأ بفعل وتنجز في جلسة وحدة</p>
        </div>
        {pct !== null && <span className="ib-hand text-xl font-bold text-foreground">{num(pct)}٪</span>}
      </div>
      {pct !== null && (
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-l from-amber-300 to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}

      <Notice text={notice} />

      {list.length > 0 && (
        <div className="space-y-1">
          {list.map((s) => {
            const isToday = s.planned_for === api.today;
            return (
              <div key={s.id} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5 bg-white/[0.02] border border-white/[0.05]", s.done_at && "opacity-60")}>
                <button onClick={() => run(s.id, () => api.patch(s.id, { done: !s.done_at }))} disabled={!!busy || readOnly}
                  className={cn("shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    s.done_at ? "bg-emerald-500 border-emerald-500 text-white" : "border-white/25 hover:border-emerald-400")}
                  title={s.done_at ? "تراجع" : "أنجزت"}>
                  {busy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : s.done_at && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>
                <span className={cn("flex-1 min-w-0 text-sm text-foreground break-words", s.done_at && "line-through")}>{s.title}</span>
                <KindBadge kind={s.kind} small onClick={s.done_at || readOnly ? undefined : () => run(`k-${s.id}`, () => api.patch(s.id, { kind: s.kind === "deep" ? "shallow" : "deep" }))} />
                {!s.done_at && !readOnly && (
                  <button
                    onClick={() => isToday
                      ? run(`p-${s.id}`, () => api.patch(s.id, { plan: null }))
                      : free[s.kind] <= 0
                        ? show(s.kind === "deep" ? "🔥 عندك شريحة عميقة اليوم — وحدة تكفي" : `⚡ اكتملت الشرائح السطحية اليوم (${num(DAY_LIMIT.shallow)})`)
                        : run(`p-${s.id}`, () => api.patch(s.id, { plan: "today" }))}
                    title={isToday ? "في شرائح اليوم — اضغط للإرجاع" : "أضفها لشرائح اليوم"}
                    className={cn("shrink-0 p-1 rounded-full", isToday ? "text-amber-300" : "text-muted-foreground hover:text-foreground")}>
                    <Sun className={cn("w-4 h-4", isToday && "fill-amber-300/40")} />
                  </button>
                )}
                {!readOnly && <button onClick={() => { if (confirm(`حذف شريحة «${s.title}»؟`)) run(`d-${s.id}`, () => api.remove(s.id)); }}
                  className="shrink-0 p-1 text-muted-foreground/60 hover:text-red-400" title="حذف">
                  <X className="w-3.5 h-3.5" />
                </button>}
              </div>
            );
          })}
        </div>
      )}

      {readOnly ? (
        list.length === 0 && <p className="text-xs text-muted-foreground text-center">ما فيه شرائح</p>
      ) : draft ? (
        <div className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.05] p-2.5">
          <p className="text-[11px] font-bold text-amber-300">راجع الشرائح وعدّلها قبل الحفظ</p>
          {draft.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <KindBadge kind={r.kind} small onClick={() => setRow(i, { kind: r.kind === "deep" ? "shallow" : "deep" })} />
              <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} maxLength={140}
                placeholder="ابدأ بفعل: اكتب، جهّز، راجع…"
                className="flex-1 min-w-0 rounded-lg bg-white/[0.04] border border-border px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              <button onClick={() => setDraft((d) => d!.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-400" title="حذف">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            {draft.length < SLICE_MAX && (
              <button onClick={() => setDraft((d) => [...d!, { title: "", kind: "shallow" }])}
                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground">
                <Plus className="w-3.5 h-3.5" /> شريحة
              </button>
            )}
            <button onClick={() => setDraft(null)} className="mr-auto text-[11px] font-bold text-muted-foreground hover:text-foreground">إلغاء</button>
            <button onClick={saveDraft} disabled={busy === "save"}
              className="ib-cta flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold disabled:opacity-50">
              {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} حفظ الشرائح
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={suggest} disabled={busy === "ai"}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-extrabold bg-amber-400/15 text-amber-200 border border-amber-400/30 hover:bg-amber-400/25 disabled:opacity-60">
            {busy === "ai" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
            {busy === "ai" ? "جاري التقطيع..." : list.length ? "قطّع أكثر" : "قطّع ✂️"}
          </button>
          <button onClick={() => setDraft(Array.from({ length: SLICE_MIN }, (_, i) => ({ title: "", kind: i === 0 ? "deep" : "shallow" })))}
            className="px-3 py-2.5 rounded-full text-xs font-bold border border-border text-muted-foreground hover:text-foreground">
            بنفسي
          </button>
        </div>
      )}
    </div>
  );
}
