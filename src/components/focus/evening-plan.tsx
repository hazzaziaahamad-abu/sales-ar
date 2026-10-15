"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Moon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { saudiMinutesNow } from "@/lib/team-reminders";
import { DAY_LIMIT, SLICE_KINDS, type FocusSlice } from "@/lib/focus-slices";
import { SLICES_CHANGED_EVENT } from "@/lib/focus-session";

/**
 * «تخطيط الليلة» — تذكير مسائي «اختر شرائح بكرة»: يطلع بعد ٨ م (الرياض) لو عندك شرائح
 * باقية وما خططت لبكرة شي. «لاحقاً» يأجله ساعة، و«تم» يقفله لين الليلة الجاية.
 */

export const EVENING_START_MIN = 20 * 60;
const SNOOZE_MS = 60 * 60_000;
const num = (n: number) => n.toLocaleString("ar-SA");

function ls(key: string, val?: string) {
  try {
    if (val === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, val);
  } catch { /* ignore */ }
  return null;
}

export function EveningPlanPrompt() {
  const { user, isImpersonating } = useAuth();
  const [open, setOpen] = useState(false);
  const [slices, setSlices] = useState<FocusSlice[]>([]);
  const [tomorrow, setTomorrow] = useState("");
  const [today, setToday] = useState("");
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const key = useCallback((what: string, day: string) => `cc_evening_${what}_${user?.id}_${day}`, [user?.id]);

  const check = useCallback(async () => {
    if (!user || isImpersonating || open) return;
    if (saudiMinutesNow() < EVENING_START_MIN) return;
    const res = await fetch("/api/focus-slices?space=ideas", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const json = await res.json().catch(() => ({}));
    const list: FocusSlice[] = json.slices ?? [];
    const today: string = json.today;
    if (ls(key("done", today)) || Number(ls(key("snooze", today)) ?? 0) > Date.now()) return;
    const pending = list.filter((s) => !s.done_at);
    if (!pending.length || pending.some((s) => s.planned_for === json.tomorrow)) return;

    setSlices(list);
    setTomorrow(json.tomorrow);
    setToday(today);
    setOpen(true);
    fetch("/api/idea-stickers", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      setTitles(Object.fromEntries((j.stickers ?? []).map((s: { id: string; title: string; body: string }) => [s.id, s.title || s.body.slice(0, 50)])));
    }).catch(() => {});
    // إشعار المتصفح مرة وحدة بالليلة لو التبويب في الخلفية
    if (document.hidden && "Notification" in window && Notification.permission === "granted" && !ls(key("notified", today))) {
      ls(key("notified", today), "1");
      try { new Notification("🌙 اختر شرائح بكرة", { body: "دقيقة تخطيط الليلة توفر عليك ساعة تشتت بكرة", icon: "/icons/icon-192.png", dir: "rtl", lang: "ar" }); } catch { /* ignore */ }
    }
  }, [user, isImpersonating, open, key]);

  useEffect(() => {
    const first = setTimeout(check, 20_000);
    const t = setInterval(check, 5 * 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [check]);

  if (!open) return null;

  const planned = slices.filter((s) => s.planned_for === tomorrow);
  const free = {
    deep: DAY_LIMIT.deep - planned.filter((s) => s.kind === "deep").length,
    shallow: DAY_LIMIT.shallow - planned.filter((s) => s.kind === "shallow").length,
  };
  const candidates = slices.filter((s) => !s.done_at).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "deep" ? -1 : 1));

  const toggle = async (s: FocusSlice) => {
    const on = s.planned_for === tomorrow;
    if (!on && free[s.kind] <= 0) {
      setNotice(s.kind === "deep" ? "🔥 شريحة عميقة وحدة تكفي لبكرة" : `⚡ ${num(DAY_LIMIT.shallow)} سطحية كحد أقصى`);
      return;
    }
    setBusy(s.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/focus-slices/${s.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: on ? null : "tomorrow" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "تعذّر الحفظ");
      setSlices((p) => p.map((x) => (x.id === s.id ? json.slice : x)));
      window.dispatchEvent(new Event(SLICES_CHANGED_EVENT));
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const close = (mode: "done" | "snooze") => {
    if (mode === "done") ls(key("done", today), "1");
    else ls(key("snooze", today), String(Date.now() + SNOOZE_MS));
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3" dir="rtl">
      <div className="w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl border border-violet-400/25 bg-card shadow-2xl shadow-black/50 animate-in slide-in-from-bottom-4">
        <div className="flex items-start gap-3 p-5 pb-3">
          <span className="w-10 h-10 rounded-2xl bg-violet-500/15 text-violet-300 flex items-center justify-center shrink-0"><Moon className="w-5 h-5" /></span>
          <div className="flex-1">
            <p className="text-base font-extrabold text-foreground">🌙 اختر شرائح بكرة</p>
            <p className="text-xs text-muted-foreground mt-0.5">عميقة وحدة + {num(DAY_LIMIT.shallow)} سطحية — تصحى وخطتك جاهزة</p>
          </div>
          <button onClick={() => close("snooze")} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 flex gap-2 text-[11px] font-bold">
          <span className={cn("px-2.5 py-1 rounded-full border", free.deep <= 0 ? "bg-orange-500/20 text-orange-200 border-orange-400/40" : "border-border text-muted-foreground")}>
            🔥 {num(DAY_LIMIT.deep - free.deep)}/{num(DAY_LIMIT.deep)}
          </span>
          <span className={cn("px-2.5 py-1 rounded-full border", free.shallow <= 0 ? "bg-sky-500/20 text-sky-200 border-sky-400/40" : "border-border text-muted-foreground")}>
            ⚡ {num(DAY_LIMIT.shallow - free.shallow)}/{num(DAY_LIMIT.shallow)}
          </span>
        </div>
        {notice && <p className="mx-5 mt-2 text-xs font-semibold text-amber-300">{notice}</p>}

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {candidates.map((s) => {
            const on = s.planned_for === tomorrow;
            return (
              <button key={s.id} onClick={() => toggle(s)} disabled={!!busy}
                className={cn("w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-right border transition",
                  on ? "bg-violet-500/15 border-violet-400/40" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]")}>
                <span className="text-base shrink-0">{SLICE_KINDS[s.kind].icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-foreground truncate">{s.title}</span>
                  {s.idea_id && titles[s.idea_id] && <span className="block text-[10px] text-muted-foreground truncate">💡 {titles[s.idea_id]}</span>}
                </span>
                {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : on && <Moon className="w-4 h-4 text-violet-300 fill-violet-300/40 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 p-4 border-t border-border">
          <Link href="/ideas" onClick={() => close("snooze")} className="text-xs font-bold text-muted-foreground hover:text-foreground">فتح الأفكار</Link>
          <button onClick={() => close("snooze")} className="mr-auto px-3 py-2 rounded-full text-xs font-bold text-muted-foreground hover:text-foreground">لاحقاً</button>
          <button onClick={() => close("done")} disabled={planned.length === 0}
            className="px-5 py-2 rounded-full text-sm font-extrabold bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40">
            تم التخطيط ✓
          </button>
        </div>
      </div>
    </div>
  );
}
