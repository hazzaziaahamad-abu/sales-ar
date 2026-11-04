"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ClipboardList, Loader2, Phone, MessageCircle, Star, RefreshCw, Plus, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatMoneyFull } from "@/lib/utils/format";
import { fetchDailyState, loadQueue, logOutcome, nextActionDate, postDaily, type DailyState } from "@/lib/daily-tasks/client";
import {
  DEPT_LABEL, DEPT_PAGE, OUTCOMES, OUTCOME_LABEL, SPEED_LABEL, phoneFormats, riyadhDate, sortQueue,
  type Department, type ExtraTask, type Outcome, type PlanPriority, type QueueItem, type Speed,
} from "@/lib/daily-tasks/shared";
import { CopyPhone } from "./copy-phone";
import { DailyReportView } from "./daily-report";

const SPEED_CLS: Record<Speed, string> = {
  fast: "bg-emerald-500/15 text-emerald-400",
  normal: "bg-sky-500/15 text-sky-400",
  slow: "bg-amber-500/15 text-amber-400",
  stalled: "bg-red-500/15 text-red-400",
};
const n = (x: number) => Math.round(x).toLocaleString("en-US");
const toLocalInput = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 3 * 3600000);
  return d.toISOString().slice(0, 16);
};
const fromLocalInput = (v: string) => new Date(`${v}:00+03:00`).toISOString();
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" });

/** viewAsUserId = المدير يراجع شاشة موظف (للعرض فقط، داخل مركز مهام اليوم). */
export function DailyTasksBar({ department, viewAsUserId }: { department?: Department; viewAsUserId?: string }) {
  const { user, activeOrgId, isImpersonating } = useAuth();
  const [state, setState] = useState<DailyState | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<"queue" | "prospect" | "meetings">("queue");
  const [picking, setPicking] = useState(false);
  const [pickDraft, setPickDraft] = useState<PlanPriority[]>([]);
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const [outcomeSel, setOutcomeSel] = useState<Outcome | null>(null);
  const [nextAt, setNextAt] = useState("");
  const [note, setNote] = useState("");
  const [savedHint, setSavedHint] = useState<{ key: string; outcome: Outcome } | null>(null);
  const [extraText, setExtraText] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [reason, setReason] = useState("");
  const [blocker, setBlocker] = useState("");
  const viewing = !!viewAsUserId;
  /** المدير: «كل المسند له» بدل المستحق اليوم فقط */
  const [showAll, setShowAll] = useState(false);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  const collapseKey = user && !viewing ? `daily_tasks_collapsed_${user.id}` : null;
  useEffect(() => {
    if (!collapseKey) return;
    try { setCollapsed(localStorage.getItem(collapseKey) === "1"); } catch { /* تخزين المتصفح غير متاح */ }
  }, [collapseKey]);
  const toggleCollapse = (v: boolean) => {
    setCollapsed(v);
    try { if (collapseKey) localStorage.setItem(collapseKey, v ? "1" : "0"); } catch { /* تجاهل */ }
  };

  const readOnly = isImpersonating || viewing;
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const s = await fetchDailyState(viewAsUserId ?? (isImpersonating ? user.id : null));
      setState(s);
      setReviewDraft(s.review?.note ?? "");
      setError(null);
      if (s.departments.length && s.orgId === activeOrgId) setQueue(await loadQueue(s, { all: showAll }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
    }
  }, [user, isImpersonating, activeOrgId, viewAsUserId, showAll]);
  useEffect(() => { load(); }, [load]);

  const plan = state?.plan ?? null;
  const doneMap = useMemo(() => {
    const m = new Map<string, Outcome>();
    for (const a of state?.activities ?? []) {
      const id = a.deal_id || a.renewal_id;
      if (id && a.entity_type && a.outcome) m.set(`${a.entity_type}:${id}`, a.outcome);
    }
    return m;
  }, [state?.activities]);

  const priorityKeys = useMemo(() => (picking ? pickDraft : plan?.priorities ?? []).map((p) => p.key), [picking, pickDraft, plan?.priorities]);
  const ordered = useMemo(() => {
    if (!queue) return [];
    // القسم الحالي أولاً لمن يعمل في قسمين
    const q = sortQueue(queue, priorityKeys);
    if (!department) return q;
    return [...q.filter((i) => i.department === department), ...q.filter((i) => i.department !== department)];
  }, [queue, priorityKeys, department]);
  const pending = ordered.filter((i) => !doneMap.has(i.key));
  const done = ordered.filter((i) => doneMap.has(i.key));
  const cap = showAll ? 500 : state?.settings.queueCap ?? 40;
  const shown = pending.slice(0, cap);
  const waiting = Math.max(0, pending.length - cap);

  if (viewing && error && !state) return <p className="text-sm text-red-400">{error}</p>;
  if (!user || !state || state.orgId !== activeOrgId) return viewing ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> تحميل…</div> : null;
  if (!state.departments.length) return viewing ? <p className="text-sm text-muted-foreground">هذا الموظف ليس ضمن توزيع الأقسام.</p> : null;

  const me = state.me;
  const depts = state.departments;
  const activity = state.settings.activity;
  const prospectTarget = depts.includes("office") ? activity.office.prospect : 0;
  const meetingTarget = depts.reduce((s, d) => s + (activity[d]?.meetings ?? 0), 0);
  const held = (state.activities ?? []).filter((a) => a.outcome === "meeting_held").length;
  const booked = (state.meetingsToday ?? []).length;
  const totalQueue = pending.length + done.length;

  // ─── الأهداف ───
  const goals = depts.map((d) => {
    const deptT = state.targets.find((t) => t.department === d && t.user_id === null);
    const myT = state.targets.find((t) => t.department === d && t.user_id === me.id);
    const mtd = state.mtd[d] ?? { dept: 0, mine: 0 };
    const need = myT ? Math.max(0, (myT.target_value - mtd.mine) / state.workdays.remaining) : null;
    return { d, deptT, myT, mtd, need };
  });
  const dayPct = state.workdays.total ? state.workdays.elapsed / state.workdays.total : 0;

  const goalBlock = (
    <div className="space-y-2">
      {goals.map(({ d, deptT, myT, mtd, need }) => {
        if (!deptT) {
          return (
            <div key={d} className="rounded-xl border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground">
              هدف {DEPT_LABEL[d]} لهذا الشهر لم يُعتمد بعد · المحقق {formatMoneyFull(mtd.dept)}
            </div>
          );
        }
        const max = Math.max(deptT.stretch_value ?? deptT.target_value, mtd.dept, 1);
        const w = (x: number) => `${Math.min(100, (x / max) * 100).toFixed(1)}%`;
        const pct = deptT.target_value ? mtd.dept / deptT.target_value : 0;
        const ahead = pct >= dayPct;
        return (
          <div key={d} className="rounded-xl border border-border bg-card px-3 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-bold">هدف {DEPT_LABEL[d]} للشهر</span>
              <span className="text-[11px] text-muted-foreground">{n(pct * 100)}% مقابل {n(dayPct * 100)}% من الأيام</span>
            </div>
            <div className="relative h-2 rounded-full bg-muted">
              <div className="absolute inset-y-0 right-0 rounded-full bg-cyan" style={{ width: w(mtd.dept) }} />
              {deptT.min_value ? <span className="absolute -top-1 h-4 w-0.5 rounded bg-muted-foreground" style={{ right: w(deptT.min_value) }} title="الحد الأدنى" /> : null}
              <span className="absolute -top-1 h-4 w-0.5 rounded bg-foreground" style={{ right: w(deptT.target_value) }} title="الهدف" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span><b className="text-foreground">{formatMoneyFull(mtd.dept)}</b> من {formatMoneyFull(deptT.target_value)}</span>
              <span className={ahead ? "text-emerald-400" : "text-amber-400"}>{ahead ? "متقدم عن الوتيرة" : "متأخر عن الوتيرة"}</span>
            </div>
            {myT && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>مساهمتك <b className="text-foreground">{formatMoneyFull(mtd.mine)}</b> من هدفك {formatMoneyFull(myT.target_value)}</span>
                <span>مطلوب اليوم <b className="text-foreground">{formatMoneyFull(Math.ceil(need ?? 0))}</b></span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ─── الإجراءات ───
  const run = async (fn: () => Promise<void>) => {
    if (readOnly) return;
    setBusy(true);
    try { await fn(); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "تعذّر الحفظ"); } finally { setBusy(false); }
  };

  const start = () => run(async () => {
    const r = await postDaily({ action: "start", dueCount: pending.length, meetingsToday: booked });
    setState((s) => (s ? { ...s, plan: r.plan } : s));
    setPickDraft(r.plan.priorities ?? []);
    setPicking(true);
    toggleCollapse(false);
  });

  const savePriorities = () => run(async () => {
    const r = await postDaily({ action: "update", priorities: pickDraft });
    setState((s) => (s ? { ...s, plan: r.plan } : s));
    setPicking(false);
  });

  const togglePick = (item: QueueItem) => {
    setPickDraft((cur) => cur.some((p) => p.key === item.key)
      ? cur.filter((p) => p.key !== item.key)
      : cur.length >= 3 ? cur : [...cur, { key: item.key, title: item.name }]);
  };

  const saveExtras = (list: ExtraTask[]) => run(async () => {
    const r = await postDaily({ action: "update", extra_tasks: list });
    setState((s) => (s ? { ...s, plan: r.plan } : s));
  });

  const openOutcome = (item: QueueItem) => {
    setOutcomeFor(item.key);
    setOutcomeSel(null);
    setNote("");
    setNextAt("");
  };
  const chooseOutcome = (o: Outcome) => {
    setOutcomeSel(o);
    const def = nextActionDate(o);
    setNextAt(def ? toLocalInput(def) : "");
  };
  const saveOutcome = (item: QueueItem) => run(async () => {
    if (!outcomeSel) return;
    const iso = nextAt ? fromLocalInput(nextAt) : null;
    const r = await logOutcome(item, outcomeSel, iso, me.name, note);
    setState((s) => (s ? {
      ...s,
      activities: [...s.activities, r.activity],
      meetingsToday: outcomeSel === "meeting_booked" && iso && riyadhDate(new Date(iso)) === s.date ? [...s.meetingsToday, r.activity] : s.meetingsToday,
      plan: s.plan ? { ...s.plan, first_activity_at: s.plan.first_activity_at ?? r.activity.created_at, last_activity_at: r.activity.created_at } : s.plan,
    } : s));
    setSavedHint(outcomeSel === "paid" || outcomeSel === "lost" ? { key: item.key, outcome: outcomeSel } : null);
    setOutcomeFor(null);
  });

  const finish = () => run(async () => {
    if (pending.length && !reason.trim()) throw new Error("اكتب سبب ما لم يكتمل (يظهر للمدير)");
    const paidKeys = [...doneMap.entries()].filter(([, o]) => o === "paid").map(([k]) => k);
    const paid = (queue ?? []).filter((i) => paidKeys.includes(i.key)).reduce((s, i) => s + i.value, 0);
    const byDept: Record<string, { remaining: number }> = {};
    for (const d of depts) byDept[d] = { remaining: pending.filter((i) => i.department === d).length };
    const r = await postDaily({
      action: "finish",
      pending: pending.map((i) => ({ key: i.key, title: i.name })),
      queue_remaining: pending.length,
      queue_by_department: byDept,
      paid_amount: paid,
      unfinished_reason: reason,
      blocker_note: blocker,
    });
    setState((s) => (s ? { ...s, plan: r.plan } : s));
    setFinishing(false);
  });

  const profileHref = (item: QueueItem) => `${DEPT_PAGE[item.department]}?profile=${encodeURIComponent(item.phone || item.name)}`;

  // ─── الشريط المطوي ───
  if (collapsed && !viewing) {
    return (
      <button type="button" onClick={() => toggleCollapse(false)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-right hover:border-cyan/40">
        <span className="flex items-center gap-2 text-sm font-bold"><ClipboardList className="h-4 w-4 text-cyan" /> مهام اليوم</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {!plan && <span className="text-cyan font-semibold">لم تبدأ بعد</span>}
          {plan && <span>متبقٍ <b className="text-foreground">{n(pending.length)}</b> من {n(totalQueue)}</span>}
          {prospectTarget > 0 && <span>استهداف <b className="text-foreground">{n(state.prospectToday)}/{n(prospectTarget)}</b></span>}
          {goals[0]?.deptT && <span>الهدف <b className="text-foreground">{n((goals[0].mtd.dept / goals[0].deptT.target_value) * 100)}%</b></span>}
          {plan?.finished_at && <span className="text-emerald-400">أُنهيت ✓</span>}
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 font-extrabold"><ClipboardList className="h-4 w-4 text-cyan" /> مهام اليوم{viewing ? ` · ${me.name}` : ""}
        {readOnly && <span className="rounded bg-amber-500/15 px-1.5 text-[11px] text-amber-400">عرض فقط</span>}</span>
      <span className="flex items-center gap-1">
        {viewing && (
          <span className="flex rounded-lg bg-muted p-0.5 text-[11px] font-bold">
            <button type="button" onClick={() => { if (showAll) { setShowAll(false); setQueue(null); } }} className={`rounded-md px-2 py-0.5 ${!showAll ? "bg-card" : "text-muted-foreground"}`}>المستحق اليوم</button>
            <button type="button" onClick={() => { if (!showAll) { setShowAll(true); setQueue(null); } }} className={`rounded-md px-2 py-0.5 ${showAll ? "bg-card" : "text-muted-foreground"}`}>كل المسند له</button>
          </span>
        )}
        <button type="button" onClick={() => { setQueue(null); load(); }} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground" title="تحديث"><RefreshCw className="h-3.5 w-3.5" /></button>
        {!viewing && <button type="button" onClick={() => toggleCollapse(true)} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground">طيّ <ChevronUp className="h-3.5 w-3.5" /></button>}
      </span>
    </div>
  );
  const saveReview = async () => {
    setReviewMsg(null);
    try {
      const r = await postDaily<{ review: DailyState["review"] }>({ action: "review", user_id: viewAsUserId, note: reviewDraft });
      setState((s) => (s ? { ...s, review: r.review } : s));
      setReviewMsg(r.review ? "حُفظت الملاحظة ووصل إشعار للموظف" : "حُذفت الملاحظة");
    } catch (e) { setReviewMsg(e instanceof Error ? e.message : "تعذّر الحفظ"); }
  };
  const reviewEditor = viewing && (
    <div className="space-y-1.5 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
      <label htmlFor="daily-review" className="text-xs font-bold text-violet-300">ملاحظتك على يوم {me.name} (تظهر له أعلى مهام اليوم)</label>
      <textarea id="daily-review" value={reviewDraft} onChange={(e) => setReviewDraft(e.target.value)} rows={2}
        placeholder="مثال: ابدأ بعملاء انتظار الدفع قبل الاستهداف، ورقم ورق عنب يحتاج اتصال اليوم"
        className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={saveReview} className="rounded-lg bg-violet-500 px-3 py-1 text-xs font-bold text-white">حفظ الملاحظة</button>
        {reviewMsg && <span className="text-xs text-muted-foreground">{reviewMsg}</span>}
      </div>
    </div>
  );
  const reviewNote = viewing ? reviewEditor : state.review && (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm">
      <div className="text-[11px] font-bold text-violet-300">ملاحظة {state.review.by_name} على يومك</div>
      <div className="whitespace-pre-wrap">{state.review.note}</div>
    </div>
  );

  const itemRow = (item: QueueItem) => {
    const isDone = doneMap.has(item.key);
    const isPrio = priorityKeys.includes(item.key);
    const ph = phoneFormats(item.phone);
    return (
      <div key={item.key} className={`rounded-xl border border-border bg-muted/40 p-2.5 space-y-1.5 ${isDone ? "opacity-50" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <Link href={profileHref(item)} className="min-w-0 truncate text-sm font-bold hover:text-cyan">
            {isPrio && <Star className="ml-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />}{item.name}
          </Link>
          <span className="shrink-0 font-mono text-xs">{item.value ? formatMoneyFull(item.value) : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {depts.length > 1 && <span className="rounded bg-card px-1.5">{DEPT_LABEL[item.department]}</span>}
          <span>{item.stage}</span>
          {item.lateDays > 0
            ? <span className="rounded bg-red-500/15 px-1.5 font-bold text-red-400">{item.dueReason === "stale" ? `بدون تحديث ${n(item.lateDays)} ي` : `متأخر ${n(item.lateDays)} ي`}</span>
            : <span>مستحق اليوم</span>}
          <span className={`rounded px-1.5 font-bold ${SPEED_CLS[item.speed]}`}>{SPEED_LABEL[item.speed]}</span>
          {item.lastNote && <span className="min-w-0 max-w-full truncate">· {item.lastNote.replace(/\s+/g, " ").slice(0, 70)}</span>}
        </div>
        {item.phone && <CopyPhone phone={item.phone} />}
        {isDone ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-400">
            ✓ {OUTCOME_LABEL[doneMap.get(item.key)!]} · سُجّلت النتيجة
            {savedHint?.key === item.key && (
              <Link href={profileHref(item)} className="inline-flex items-center gap-1 text-cyan underline">
                افتح البطاقة لتحديث المرحلة <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        ) : picking ? (
          <button type="button" onClick={() => togglePick(item)} disabled={!isPrio && pickDraft.length >= 3}
            className="rounded-md border border-border px-2 py-0.5 text-xs disabled:opacity-40">{isPrio ? "إزالة من الأولويات" : "اجعلها أولوية"}</button>
        ) : !readOnly && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => openOutcome(item)} className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">تسجيل نتيجة</button>
            {ph && <a href={`tel:+${ph.intl}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs"><Phone className="h-3 w-3" /> اتصال</a>}
            {ph && <a href={`https://wa.me/${ph.intl}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs"><MessageCircle className="h-3 w-3" /> واتساب</a>}
          </div>
        )}
        {outcomeFor === item.key && !isDone && (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
            <div className="text-xs font-bold">النتيجة والموعد التالي</div>
            <div className="flex flex-wrap gap-1.5">
              {OUTCOMES.map((o) => (
                <button key={o.key} type="button" onClick={() => chooseOutcome(o.key)}
                  className={`rounded-md border px-2 py-0.5 text-xs ${outcomeSel === o.key ? "border-cyan bg-cyan-dim text-cyan" : "border-border bg-card"}`}>{o.label}</button>
              ))}
            </div>
            {outcomeSel && (
              <div className="flex flex-wrap items-center gap-2">
                {OUTCOMES.find((o) => o.key === outcomeSel)?.nextHours !== null && (
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    {outcomeSel === "meeting_booked" ? "وقت الاجتماع" : "الموعد التالي"}
                    <input type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 text-xs text-foreground" />
                  </label>
                )}
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)"
                  className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-0.5 text-xs" />
                <button type="button" onClick={() => saveOutcome(item)} disabled={busy}
                  className="rounded-md bg-cyan px-3 py-0.5 text-xs font-bold text-[#07090F] disabled:opacity-50">{busy ? "…" : "حفظ"}</button>
                <button type="button" onClick={() => setOutcomeFor(null)} className="text-xs text-muted-foreground">إلغاء</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };
  /** للمدير: القائمة كاملة حتى لو الموظف ما بدأ أو أنهى */
  const viewList = viewing && (
    <div className="space-y-2">
      <div className="text-xs font-bold">{showAll ? `كل المسند له (${n(ordered.length)})` : `المستحق اليوم (${n(pending.length)})`} · أُنجز اليوم {n(done.length)}</div>
      {!queue && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> تحميل…</div>}
      <div className="grid gap-2 md:grid-cols-2">{[...done, ...pending].slice(0, cap).map(itemRow)}</div>
    </div>
  );

  // ─── قبل البدء ───
  if (!plan) {
    return (
      <section className="rounded-2xl border border-border bg-card/40 p-3 sm:p-4 space-y-3">
        {header}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-4 text-center">
          <div className="text-base font-extrabold">{viewing ? `${me.name} لم يبدأ مهام اليوم بعد` : `أهلاً ${me.name}`}</div>
          <div className="flex flex-wrap justify-center gap-x-4 text-sm text-muted-foreground">
            <span><b className="text-foreground">{queue ? n(pending.length) : "…"}</b> مستحقة</span>
            <span><b className="text-foreground">{n(booked)}</b> اجتماع اليوم</span>
            {prospectTarget > 0 && <span><b className="text-foreground">{n(prospectTarget)}</b> استهداف</span>}
          </div>
          {!viewing && <button type="button" onClick={start} disabled={busy || readOnly || !queue}
            className="mt-1 w-full max-w-sm rounded-xl bg-cyan py-2.5 text-sm font-extrabold text-[#07090F] disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "ابدأ مهام اليوم"}
          </button>}
        </div>
        {reviewNote}
        {goalBlock}
        {viewList}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </section>
    );
  }

  // ─── بعد الإنهاء ───
  if (plan.finished_at && plan.report) {
    return (
      <section className="rounded-2xl border border-border bg-card/40 p-3 sm:p-4 space-y-3">
        {header}
        {reviewNote}
        <DailyReportView plan={plan} />
        {viewList}
      </section>
    );
  }

  const tabs: [typeof tab, string][] = [["queue", "الطابور"], ...(prospectTarget > 0 ? [["prospect", "الاستهداف"] as [typeof tab, string]] : []), ["meetings", "الاجتماعات"]];
  const extras = plan.extra_tasks ?? [];



  return (
    <section className="rounded-2xl border border-border bg-card/40 p-3 sm:p-4 space-y-3">
      {header}
      {reviewNote}
      {goalBlock}

      <div className="grid grid-cols-3 gap-2">
        <Kpi value={`${n(pending.length)}/${n(totalQueue)}`} label="الطابور متبقٍ" />
        {prospectTarget > 0
          ? <Kpi value={`${n(state.prospectToday)}/${n(prospectTarget)}`} label="استهداف اليوم" />
          : <Kpi value={n(pending.filter((i) => i.lateDays > 0).length)} label="متأخر" />}
        <Kpi value={`${n(held)}/${n(meetingTarget)}`} label={`اجتماعات (${n(booked)} اليوم)`} />
      </div>

      {picking && !readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2">
          <div className="text-sm"><b>اختر ٣ أولويات لليوم من صفقاتك ({n(pickDraft.length)}/٣)</b>
            <div className="text-xs text-muted-foreground">تظهر في المتابعة اليومية بدل كتابتها مرة ثانية.</div></div>
          <button type="button" onClick={savePriorities} disabled={busy} className="rounded-lg bg-cyan px-4 py-1.5 text-sm font-bold text-[#07090F] disabled:opacity-50">تأكيد الخطة</button>
        </div>
      )}

      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${tab === k ? "bg-card text-foreground" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>

      {tab === "queue" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-bold text-foreground">طابور المراجعة</span>
              <span>
                {!picking && !readOnly && <button type="button" onClick={() => { setPickDraft(plan.priorities ?? []); setPicking(true); }} className="ml-2 text-cyan">تعديل الأولويات</button>}
                الأولويات، ثم انتظار الدفع، ثم الأقدم تأخيراً
              </span>
            </div>
            {!queue && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> تحميل الطابور…</div>}
            {queue && pending.length === 0 && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">الطابور فارغ ✓ صفر متأخر</div>}
            <div className="grid gap-2 md:grid-cols-2">{shown.map(itemRow)}</div>
            {waiting > 0 && <div className="text-xs text-muted-foreground">+ {n(waiting)} في الانتظار (حد الطابور {n(cap)})</div>}
            {done.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">أُنجز اليوم ({n(done.length)})</summary>
                <div className="mt-2 grid gap-2 md:grid-cols-2">{done.map(itemRow)}</div>
              </details>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between text-xs"><span className="font-bold text-sm">مهامي الإضافية</span><span className="text-muted-foreground">تضيفها أنت</span></div>
            {extras.map((t) => (
              <label key={t.id} className={`flex items-center gap-2 text-sm ${t.done_at ? "text-muted-foreground line-through" : ""}`}>
                <input type="checkbox" checked={!!t.done_at} disabled={readOnly || busy}
                  onChange={() => saveExtras(extras.map((x) => (x.id === t.id ? { ...x, done_at: x.done_at ? null : new Date().toISOString() } : x)))} />
                {t.text}
              </label>
            ))}
            {!readOnly && (
              <form className="flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                const v = extraText.trim();
                if (!v) return;
                saveExtras([...extras, { id: crypto.randomUUID(), text: v, done_at: null }]);
                setExtraText("");
              }}>
                <input id="daily-extra" value={extraText} onChange={(e) => setExtraText(e.target.value)} placeholder="مثال: أجهّز عرض باقة الفروع"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-sm" />
                <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-cyan px-3 text-sm font-bold text-[#07090F]"><Plus className="h-4 w-4" /> إضافة</button>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === "prospect" && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3 text-sm">
          <div className="font-bold">استهداف اليوم</div>
          <p className="text-xs text-muted-foreground">يُحسب من الصفقات التي تضيفها اليوم بمصدر «استهداف» أو «من ارقام عشوائية» — كما تعمل الآن.</p>
          <div className="flex items-center gap-4 text-sm"><span>أُضيف اليوم <b>{n(state.prospectToday)}</b></span><span>الهدف <b>{n(prospectTarget)}</b></span></div>
          <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-cyan" style={{ width: `${Math.min(100, (state.prospectToday / Math.max(1, prospectTarget)) * 100)}%` }} /></div>
          <p className="text-xs text-muted-foreground">أضف الرقم من زر «إضافة صفقة» في القائمة أسفل الصفحة، ثم اضغط تحديث ↻.</p>
        </div>
      )}

      {tab === "meetings" && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="text-sm font-bold">اجتماعات اليوم</div>
          {(state.meetingsToday ?? []).length === 0
            ? <p className="text-xs text-muted-foreground">لا اجتماعات محجوزة اليوم. تُحجز من «تسجيل نتيجة ← حجز اجتماع» في الطابور.</p>
            : state.meetingsToday.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-sm">
                <span>{m.next_action_at ? fmtTime(m.next_action_at) : ""} · {m.client_name}</span>
                {doneMap.get(`${m.entity_type}:${m.deal_id || m.renewal_id}`) === "meeting_held" && <span className="text-xs text-emerald-400"><Check className="inline h-3 w-3" /> تم</span>}
              </div>
            ))}
          <p className="text-xs text-muted-foreground">المحسوب في الهدف: الاجتماعات المنفذة ({n(held)} من {n(meetingTarget)}).</p>
        </div>
      )}

      {!readOnly && !finishing && (
        <button type="button" onClick={() => setFinishing(true)} className="w-full rounded-xl border border-border py-2 text-sm font-bold hover:border-cyan/40">أنهِ مهام اليوم</button>
      )}
      {finishing && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <b>قبل الإنهاء</b>
          <p className="text-xs">{pending.length ? `${n(pending.length)} عنصر في الطابور بلا نتيجة اليوم` : "الطابور مكتمل ✓"}</p>
          {pending.length > 0 && (
            <>
              <ul className="list-inside list-disc text-xs text-muted-foreground">
                {pending.slice(0, 5).map((i) => <li key={i.key}>{i.name}</li>)}
                {pending.length > 5 && <li>و{n(pending.length - 5)} غيرها</li>}
              </ul>
              <input id="daily-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب ما لم يكتمل (يظهر للمدير)"
                className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm" />
            </>
          )}
          <input id="daily-blocker" value={blocker} onChange={(e) => setBlocker(e.target.value)} placeholder="عائق تحتاج فيه مساعدة (اختياري)"
            className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setFinishing(false)} className="rounded-lg border border-border px-3 py-1.5 text-xs">رجوع للإكمال</button>
            <button type="button" onClick={finish} disabled={busy} className="rounded-lg bg-cyan px-4 py-1.5 text-xs font-bold text-[#07090F] disabled:opacity-50">{busy ? "…" : "أنهِ مهام اليوم"}</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card px-1 py-2 text-center">
      <b className="font-mono text-base">{value}</b>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
