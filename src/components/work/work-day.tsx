"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { parentOf, type FocusSlice } from "@/lib/focus-slices";
import { SLICES_CHANGED_EVENT } from "@/lib/focus-session";
import { WORK_PATH, fmtDuration } from "@/lib/work-hours";
import { FocusStartDialog } from "@/components/focus/focus-overlay";
import { ShutdownPanel, StartCard } from "@/components/work/work-cards";
import { nextDayLabel, topSliceOf, useWorkClock } from "@/components/work/work-clock";

/**
 * مراقب يوم العمل الوظيفي (للسوبر أدمن فقط، ويتأجل أثناء جلسة التركيز):
 *  - بداية الدوام: بطاقة «أهم شريحة اليوم + موعد جلستك العميقة» مرة باليوم.
 *  - ١٥:٣٠: شاشة Shutdown — اللي ما انجز ← ترحيل بضغطة ← «انتهى الدوام، انتقل لـMENU».
 */

const ls = (key: string, val?: string) => {
  try {
    if (val === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, val);
  } catch { /* ignore */ }
  return null;
};

interface WorkData { slices: FocusSlice[]; today: string; titles: Record<string, string> }

async function loadWork(): Promise<WorkData | null> {
  const [s, i] = await Promise.all([
    fetch("/api/focus-slices?space=work", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch("/api/work-items", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  if (!s) return null;
  return {
    slices: s.slices ?? [],
    today: s.today,
    titles: Object.fromEntries(((i?.items ?? []) as { id: string; title: string }[]).map((x) => [x.id, x.title])),
  };
}

export function useIsWorkOwner() {
  const { user, isImpersonating } = useAuth();
  return !!user?.isSuperAdmin && !isImpersonating;
}

export function WorkDayWatcher() {
  const owner = useIsWorkOwner();
  const { user } = useAuth();
  const clock = useWorkClock();
  const router = useRouter();
  const [mode, setMode] = useState<"start" | "shutdown" | null>(null);
  const [data, setData] = useState<WorkData | null>(null);
  const [focusing, setFocusing] = useState<FocusSlice | null>(null);
  const key = useCallback((what: string) => `cc_work_${what}_${user?.id}_${clock.today}`, [user?.id, clock.today]);

  const refresh = useCallback(async () => setData(await loadWork()), []);

  useEffect(() => {
    if (!owner || mode) return;
    const want = clock.phase === "on" && !ls(key("start")) ? "start"
      : clock.phase === "after" && !ls(key("shutdown")) ? "shutdown" : null;
    if (!want) return;
    let alive = true;
    loadWork().then((d) => {
      if (!alive || !d) return;
      // Shutdown يطلع بس لو فيه شرائح مخططة لليوم
      if (want === "shutdown" && !d.slices.some((s) => s.planned_for === d.today)) { ls(key("shutdown"), "1"); return; }
      setData(d);
      setMode(want);
    });
    return () => { alive = false; };
  }, [owner, mode, clock.phase, key]);

  useEffect(() => {
    if (!mode) return;
    window.addEventListener(SLICES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SLICES_CHANGED_EVENT, refresh);
  }, [mode, refresh]);

  if (!owner || !data) return null;
  if (!mode) {
    // بدء جلسة من بطاقة بداية الدوام بعد إغلاقها
    if (!focusing) return null;
    const p = data.titles[parentOf(focusing) ?? ""] ?? "";
    return <FocusStartDialog slice={focusing} parent={p} onClose={() => setFocusing(null)} />;
  }

  const close = () => { ls(key(mode), "1"); setMode(null); };
  const top = topSliceOf(data.slices, data.today);
  const parent = top ? data.titles[parentOf(top) ?? ""] ?? "" : "";

  const setTime = async (v: string | null) => {
    if (!top) return;
    const res = await fetch(`/api/focus-slices/${top.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_at: v }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "تعذّر الحفظ");
    window.dispatchEvent(new Event(SLICES_CHANGED_EVENT));
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-3" dir="rtl">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl shadow-black/50 p-4 sm:p-5 space-y-4 animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-foreground">
            {mode === "start" ? `☀️ صباح الخير — بداية الدوام (باقي ${fmtDuration(clock.minutesLeft)})` : "💼 العمل الوظيفي"}
          </p>
          <button onClick={close} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {mode === "start" ? (
          <>
            <StartCard slice={top} parent={parent} onSetTime={setTime}
              onFocus={() => { if (top) { close(); setFocusing(top); } }} />
            <div className="flex items-center gap-2">
              <button onClick={() => { close(); router.push(WORK_PATH); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-extrabold bg-emerald-500 text-white hover:bg-emerald-400">
                <Briefcase className="w-4 h-4" /> افتح العمل الوظيفي
              </button>
              <button onClick={close} className="px-4 py-2.5 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground">لاحقاً</button>
            </div>
          </>
        ) : (
          <ShutdownPanel compact slices={data.slices} today={data.today} nextLabel={nextDayLabel(clock)}
            onGoMenu={close} onCarried={refresh} />
        )}
      </div>
    </div>
  );
}

/** شريط الأولوية خلال الدوام في باقي الصفحات: «💼 وقت الدوام — أهم شريحة». يتخفّى ساعة. */
export function WorkHoursBanner() {
  const owner = useIsWorkOwner();
  const clock = useWorkClock();
  const pathname = usePathname();
  const [top, setTop] = useState<string | null>(null);
  const [hidden, setHidden] = useState(() => Number(ls("cc_work_banner_hidden") ?? 0) > Date.now());
  const show = owner && clock.phase === "on" && pathname !== WORK_PATH && !hidden;

  // يرجع الشريط بعد ساعة من الإخفاء
  useEffect(() => {
    if (!hidden) return;
    const left = Number(ls("cc_work_banner_hidden") ?? 0) - Date.now();
    const t = setTimeout(() => setHidden(false), Math.max(0, left));
    return () => clearTimeout(t);
  }, [hidden]);

  useEffect(() => {
    if (!show) return;
    let alive = true;
    const load = () => fetch("/api/focus-slices?space=work", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setTop(topSliceOf(j.slices ?? [], j.today)?.title ?? null); })
      .catch(() => {});
    load();
    window.addEventListener(SLICES_CHANGED_EVENT, load);
    return () => { alive = false; window.removeEventListener(SLICES_CHANGED_EVENT, load); };
  }, [show]);

  if (!show) return null;
  const hide = () => {
    ls("cc_work_banner_hidden", String(Date.now() + 60 * 60_000));
    setHidden(true);
  };
  return (
    <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-[14px] border border-emerald-400/30 bg-gradient-to-l from-emerald-500/[0.12] to-emerald-500/[0.03]">
      <span className="relative flex w-2.5 h-2.5 shrink-0">
        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
        <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400" />
      </span>
      <Link href={WORK_PATH} className="flex-1 min-w-0 text-sm">
        <span className="font-extrabold text-emerald-200">💼 وقت الدوام</span>
        <span className="text-muted-foreground"> · باقي {fmtDuration(clock.minutesLeft)}</span>
        <span className="block sm:inline text-foreground/90 truncate">{top ? <> · 🎯 {top}</> : " · اختر أهم شريحة اليوم"}</span>
      </Link>
      <Link href={WORK_PATH} className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30">افتح</Link>
      <button onClick={hide} title="إخفاء ساعة" className="shrink-0 p-1 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}
