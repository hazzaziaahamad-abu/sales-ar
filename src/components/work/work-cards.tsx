"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock, Loader2, Play, Sunrise } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLICE_KINDS, type FocusSlice } from "@/lib/focus-slices";
import { SLICES_CHANGED_EVENT } from "@/lib/focus-session";
import { fmtDuration, fmtTime, riyadhMinutes } from "@/lib/work-hours";
import { MENU_HOME } from "@/components/work/work-clock";
import { forDay } from "@/components/ideas/slices";

const num = (n: number) => n.toLocaleString("ar-SA");

/** حالة موعد الجلسة العميقة: بعد كم / الحين / فات. */
function sessionStatus(hhmm: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const diff = h * 60 + m - riyadhMinutes();
  if (diff > 0) return { tone: "soon" as const, text: `بعد ${fmtDuration(diff)}` };
  if (diff > -30) return { tone: "now" as const, text: "الحين ⏰" };
  return { tone: "late" as const, text: "فات الموعد" };
}

/**
 * بطاقة بداية الدوام: «أهم شريحة اليوم + موعد جلستك العميقة».
 */
export function StartCard({ slice, parent, readOnly, onSetTime, onFocus, emptyAction }: {
  slice: FocusSlice | null; parent: string; readOnly?: boolean;
  onSetTime: (hhmm: string | null) => Promise<void>; onFocus: () => void; emptyAction?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const time = slice?.session_at?.slice(0, 5) ?? null;
  const status = sessionStatus(time);
  const setTime = async (v: string | null) => {
    setBusy(true);
    try { await onSetTime(v); } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-[22px] border border-amber-400/25 bg-gradient-to-bl from-amber-500/[0.10] via-orange-500/[0.05] to-transparent p-4 sm:p-5 space-y-3">
      <p className="flex items-center gap-2 text-xs font-bold text-amber-200"><Sunrise className="w-4 h-4" /> أهم شريحة اليوم</p>
      {slice ? (
        <>
          <div>
            <p className="text-lg sm:text-xl font-extrabold text-foreground leading-snug break-words">{slice.title}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{SLICE_KINDS[slice.kind].icon} {SLICE_KINDS[slice.kind].label}{parent ? ` · 💼 ${parent}` : ""}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-border">
              <Clock className="w-4 h-4 text-amber-300" />
              <span className="text-xs text-muted-foreground">موعد جلستك العميقة</span>
              <input type="time" value={time ?? ""} disabled={readOnly || busy} min="07:00" max="15:30"
                onChange={(e) => setTime(e.target.value || null)}
                className="bg-transparent text-sm font-bold text-foreground focus:outline-none [color-scheme:dark]" />
            </label>
            {time && status && (
              <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full",
                status.tone === "now" ? "bg-emerald-500/20 text-emerald-200" : status.tone === "late" ? "bg-red-500/15 text-red-300" : "bg-white/[0.06] text-foreground/80")}>
                {fmtTime(time)} · {status.text}
              </span>
            )}
            {!readOnly && (
              <button onClick={onFocus}
                className="mr-auto flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-extrabold bg-orange-500/25 text-orange-100 border border-orange-400/40 hover:bg-orange-500/35">
                <Play className="w-4 h-4" /> ابدأ الجلسة
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">
          ما اخترت شريحة لليوم بعد — اختر شريحة عميقة وحدة من «باقي الشرائح» وحدد موعد جلستها.
          {emptyAction}
        </div>
      )}
    </section>
  );
}

/**
 * Shutdown الدوام: يعرض اللي ما انجز ← ترحيل لليوم التالي بضغطة ← «انتهى الدوام، انتقل لـMENU».
 */
export function ShutdownPanel({ slices, today, nextLabel, onCarried, onGoMenu, compact }: {
  slices: FocusSlice[]; today: string; nextLabel: string;
  onCarried?: () => void; onGoMenu?: () => void; compact?: boolean;
}) {
  const todays = slices.filter((s) => s.planned_for === today);
  const undone = todays.filter((s) => !s.done_at);
  const done = todays.length - undone.length;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ moved: number; overflow: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carry = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/focus-slices/carry", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space: "work" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "تعذّر الترحيل");
      setResult(json);
      window.dispatchEvent(new Event(SLICES_CHANGED_EVENT));
      onCarried?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finished = undone.length === 0 || !!result;

  return (
    <div className={cn("space-y-4", !compact && "rounded-[22px] border border-violet-400/25 bg-gradient-to-bl from-violet-500/[0.10] to-transparent p-4 sm:p-5")}>
      <div className="flex items-center gap-2">
        <span className="text-2xl">🔚</span>
        <div>
          <p className="text-base font-extrabold text-foreground">إغلاق الدوام</p>
          <p className="text-[11px] text-muted-foreground">أنجزت {num(done)} من {num(todays.length)} شرائح اليوم</p>
        </div>
      </div>

      {!finished && (
        <>
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground">ما انجز اليوم ({num(undone.length)})</p>
            {undone.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/[0.03] border border-white/[0.06]">
                <span>{SLICE_KINDS[s.kind].icon}</span>
                <span className="flex-1 min-w-0 text-sm font-bold text-foreground truncate">{s.title}</span>
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button onClick={carry} disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-sm font-extrabold bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />} رحّلها {forDay(nextLabel)}
          </button>
        </>
      )}

      {finished && (
        <div className="text-center space-y-3 py-2">
          {result && (
            <p className="text-xs text-violet-200">
              <Check className="w-3.5 h-3.5 inline" /> رُحّلت {num(result.moved)} {forDay(nextLabel)}
              {result.overflow > 0 && ` · ${num(result.overflow)} رجعت «باقي الشرائح» (حد اليوم مكتمل)`}
            </p>
          )}
          <p className="text-2xl font-extrabold text-foreground">انتهى الدوام 👋</p>
          <p className="text-sm text-muted-foreground">سكّر ملف الشغل — وقتك الحين لـMENU</p>
          <Link href={MENU_HOME} onClick={onGoMenu}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-extrabold bg-primary text-primary-foreground hover:brightness-110">
            انتقل لـMENU <ArrowLeft className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
