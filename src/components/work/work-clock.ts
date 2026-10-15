"use client";

import { useEffect, useState } from "react";
import { workClock, type WorkClock } from "@/lib/work-hours";
import type { FocusSlice } from "@/lib/focus-slices";

/** ساعة الدوام الحية — تتحدث كل ٣٠ ثانية. */
export function useWorkClock(): WorkClock {
  const [clock, setClock] = useState(() => workClock());
  useEffect(() => {
    const t = setInterval(() => setClock(workClock()), 30_000);
    return () => clearInterval(t);
  }, []);
  return clock;
}

/** أهم شريحة اليوم: العميقة المخططة لليوم، وإلا أول شريحة غير منجزة لليوم. */
export function topSliceOf(slices: FocusSlice[], today: string): FocusSlice | null {
  const todays = slices.filter((s) => s.planned_for === today && !s.done_at);
  return todays.find((s) => s.kind === "deep") ?? todays[0] ?? null;
}

/** «بكرة» أو اسم يوم الدوام التالي (الخميس ← «الأحد»). */
export function nextDayLabel(clock: WorkClock): string {
  const d = new Date(`${clock.today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  if (d.toISOString().slice(0, 10) === clock.nextDay) return "بكرة";
  return ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][new Date(`${clock.nextDay}T00:00:00Z`).getUTCDay()];
}

export const MENU_HOME = "/daily-huddle";
