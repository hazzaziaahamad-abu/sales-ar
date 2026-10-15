"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pause, Play, Plus, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLICE_KINDS, type FocusSlice } from "@/lib/focus-slices";
import {
  DEFAULT_MINUTES, MINUTE_PRESETS, SLICES_CHANGED_EVENT,
  elapsedMs, endFocus, startFocus, updateFocus, useFocusActive, useFocusSession,
} from "@/lib/focus-session";

/**
 * «وضع التركيز» — شاشة كاملة للشريحة فقط + مؤقت + زر «أنجزت».
 * مركّبة في تخطيط اللوحة، فتبقى ظاهرة مع التحديث والتنقل حتى تنتهي الجلسة.
 */

const num = (n: number) => n.toLocaleString("ar-SA");
const clock = (ms: number) => {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** نغمة قصيرة عند انتهاء الوقت (بدون ملفات صوت). */
function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880, 990].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22);
      o.stop(ctx.currentTime + i * 0.22 + 0.55);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch { /* ignore */ }
}

export function FocusOverlay() {
  const s = useFocusSession();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<"done" | "end" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const chimed = useRef<string | null>(null);

  // نبضة كل ثانية أثناء الجلسة
  useEffect(() => {
    if (!s) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s]);

  // الشاشة تبقى صاحية أثناء التركيز (الجوال)
  useEffect(() => {
    if (!s) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    return () => { lock?.release().catch(() => {}); };
  }, [s]);

  const total = s ? s.minutes * 60_000 : 0;
  const elapsed = s ? elapsedMs(s, now) : 0;
  const remaining = total - elapsed;
  const over = !!s && remaining <= 0;

  // العدّاد في عنوان التبويب
  useEffect(() => {
    if (!s) return;
    const prev = document.title;
    return () => { document.title = prev; };
  }, [s]);
  useEffect(() => {
    if (s) document.title = over ? "⏰ انتهى الوقت — تركيز" : `⏳ ${clock(remaining)} — تركيز`;
  }, [s, remaining, over]);

  useEffect(() => {
    if (s && over && chimed.current !== `${s.sliceId}-${s.minutes}`) {
      chimed.current = `${s.sliceId}-${s.minutes}`;
      chime();
    }
  }, [s, over]);

  if (!s) {
    if (!celebrate) return null;
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/95 backdrop-blur-xl p-6 animate-in fade-in" onClick={() => setCelebrate(null)}>
        <div className="text-center space-y-3 animate-in zoom-in-95 duration-500">
          <p className="text-7xl">🎉</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground">أحسنت!</p>
          <p className="text-muted-foreground">{celebrate}</p>
        </div>
      </div>
    );
  }

  const k = SLICE_KINDS[s.kind];
  const minutesSpent = Math.round(elapsed / 60_000);
  const pct = Math.min(1, elapsed / total);
  const R = 120, C = 2 * Math.PI * R;

  const finish = async (done: boolean) => {
    if (!done && !confirm("إنهاء الجلسة بدون ما تعلّم الشريحة منجزة؟")) return;
    setBusy(done ? "done" : "end");
    setError(null);
    try {
      if (done || minutesSpent > 0) {
        const res = await fetch(`/api/focus-slices/${s.sliceId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(done ? { done: true } : {}), add_minutes: minutesSpent }),
        });
        if (!res.ok && res.status !== 404) throw new Error((await res.json().catch(() => ({}))).error || "تعذّر الحفظ");
      }
      endFocus();
      window.dispatchEvent(new Event(SLICES_CHANGED_EVENT));
      if (done) {
        setCelebrate(s.kind === "deep"
          ? `شريحة عميقة منجزة 🔥 — ${num(Math.max(1, minutesSpent))} دقيقة تركيز`
          : `شريحة منجزة ⚡ — كمّل على التالية`);
        setTimeout(() => setCelebrate(null), 3500);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const togglePause = () => {
    if (s.pausedAt) updateFocus({ pausedAt: null, pausedMs: s.pausedMs + (Date.now() - s.pausedAt) });
    else updateFocus({ pausedAt: Date.now() });
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-background text-foreground" dir="rtl"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: s.kind === "deep"
          ? "radial-gradient(700px 400px at 50% 30%, rgba(249,115,22,.14), transparent 70%)"
          : "radial-gradient(700px 400px at 50% 30%, rgba(56,189,248,.12), transparent 70%)" }} />

      <div className="relative flex items-center justify-between px-5 pt-4">
        <span className={cn("text-xs font-bold px-3 py-1 rounded-full border",
          s.kind === "deep" ? "bg-orange-500/15 text-orange-300 border-orange-400/30" : "bg-sky-500/10 text-sky-300 border-sky-400/25")}>
          {k.icon} وضع التركيز · {k.label}
        </span>
        <span className="text-[11px] text-muted-foreground">🔕 التذكيرات مؤجلة لين تخلص</span>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="max-w-2xl">
          {s.parent && <p className="text-xs sm:text-sm text-muted-foreground mb-2 truncate">💡 {s.parent}</p>}
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-snug break-words">{s.title}</h1>
        </div>

        <div className="relative w-[260px] h-[260px] sm:w-[300px] sm:h-[300px]">
          <svg viewBox="0 0 280 280" className="w-full h-full -rotate-90">
            <circle cx="140" cy="140" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" />
            <circle cx="140" cy="140" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
              stroke={over ? "#34d399" : s.kind === "deep" ? "#fb923c" : "#38bdf8"}
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {over ? (
              <>
                <p className="text-3xl font-extrabold text-emerald-300">انتهى الوقت</p>
                <p className="text-xs text-muted-foreground mt-1">+{clock(-remaining)}</p>
              </>
            ) : (
              <>
                <p className="text-5xl sm:text-6xl font-extrabold tabular-nums" dir="ltr" style={{ fontFamily: "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif" }}>{clock(remaining)}</p>
                <p className="text-xs text-muted-foreground mt-2">{s.pausedAt ? "⏸ موقوفة مؤقتاً" : `من ${num(s.minutes)} دقيقة`}</p>
              </>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <button onClick={() => finish(true)} disabled={!!busy}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-full text-lg font-extrabold bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-60 transition">
            {busy === "done" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />} أنجزت
          </button>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {!over && (
              <button onClick={togglePause} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-border bg-white/[0.03] hover:bg-white/[0.07]">
                {s.pausedAt ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {s.pausedAt ? "استئناف" : "إيقاف مؤقت"}
              </button>
            )}
            <button onClick={() => updateFocus({ minutes: s.minutes + 15 })} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border border-border bg-white/[0.03] hover:bg-white/[0.07]">
              <Plus className="w-4 h-4" /> ١٥ د
            </button>
            <button onClick={() => finish(false)} disabled={!!busy} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-muted-foreground hover:text-foreground">
              {busy === "end" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-3.5 h-3.5" />} إنهاء الجلسة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** نافذة بدء الجلسة: اختيار المدة (افتراضي ٩٠ د للعميقة و١٥ د للسطحية). */
export function FocusStartDialog({ slice, parent, onClose }: { slice: FocusSlice; parent: string; onClose: () => void }) {
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES[slice.kind]);
  const k = SLICE_KINDS[slice.kind];
  const start = () => {
    startFocus({ sliceId: slice.id, title: slice.title, parent, kind: slice.kind, space: slice.space, minutes: Math.min(240, Math.max(5, minutes)) });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl glass-surface border border-border p-5 space-y-4 hover:translate-y-0 text-right animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{k.icon} شريحة {k.label}{parent ? ` · ${parent}` : ""}</p>
            <p className="text-lg font-extrabold text-foreground leading-snug break-words">{slice.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">مدة الجلسة</p>
          <div className="flex flex-wrap gap-2">
            {MINUTE_PRESETS.map((m) => (
              <button key={m} onClick={() => setMinutes(m)}
                className={cn("px-3.5 py-1.5 rounded-full text-sm font-bold border transition",
                  minutes === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                {num(m)} د
              </button>
            ))}
            <label className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border text-sm text-muted-foreground">
              <input type="number" min={5} max={240} value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 0)}
                className="w-14 bg-transparent text-foreground font-bold text-center focus:outline-none" style={{ fontFamily: "system-ui, sans-serif" }} />
              د
            </label>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">أثناء الجلسة تختفي كل الشاشة إلا هالشريحة، والتذكيرات والإشعارات تتأجل لين تخلص.</p>
        <button onClick={start} disabled={minutes < 5}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full text-base font-extrabold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50">
          <Play className="w-4 h-4" /> ابدأ التركيز
        </button>
      </div>
    </div>
  );
}

/** يخفي التذكيرات والإشعارات المنبثقة أثناء جلسة التركيز — وترجع تلقائياً بعد انتهائها. */
export function FocusGate({ children }: { children: React.ReactNode }) {
  return useFocusActive() ? null : <>{children}</>;
}
