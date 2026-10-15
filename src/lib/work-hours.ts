// «العمل الوظيفي» 💼 — ساعات الدوام بتوقيت الرياض: الأحد–الخميس ٧:٠٠–١٥:٣٠.
import { saudiDateStr } from "@/lib/utils/format";

export const WORK_START_MIN = 7 * 60;
export const WORK_END_MIN = 15 * 60 + 30;
/** أيام الدوام (getUTCDay على تاريخ الرياض): الأحد=0 … الخميس=4. */
export const WORK_DAYS = [0, 1, 2, 3, 4];
export const WORK_PATH = "/work";

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const dow = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
const shift = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const isWorkday = (ymd: string) => WORK_DAYS.includes(dow(ymd));
export const dayName = (ymd: string) => DAY_NAMES[dow(ymd)];

/** يوم الدوام التالي بعد التاريخ (الخميس ← الأحد). */
export function nextWorkday(ymd: string): string {
  let d = shift(ymd, 1);
  while (!isWorkday(d)) d = shift(d, 1);
  return d;
}

/** دقائق اليوم بتوقيت الرياض. */
export function riyadhMinutes(now = new Date()): number {
  const s = new Date(now.getTime() + 3 * 3600000);
  return s.getUTCHours() * 60 + s.getUTCMinutes();
}

export type WorkPhase = "before" | "on" | "after" | "off";

export interface WorkClock {
  today: string;
  phase: WorkPhase;
  /** دقائق باقية على نهاية الدوام (لو شغّال). */
  minutesLeft: number;
  /** نسبة اليوم المنقضية من الدوام (٠–١). */
  progress: number;
  nextDay: string;
}

export function workClock(now = new Date()): WorkClock {
  const today = saudiDateStr(now);
  const m = riyadhMinutes(now);
  const phase: WorkPhase = !isWorkday(today) ? "off" : m < WORK_START_MIN ? "before" : m < WORK_END_MIN ? "on" : "after";
  return {
    today,
    phase,
    minutesLeft: phase === "on" ? WORK_END_MIN - m : 0,
    progress: Math.min(1, Math.max(0, (m - WORK_START_MIN) / (WORK_END_MIN - WORK_START_MIN))),
    nextDay: nextWorkday(today),
  };
}

/** «٣ س ١٥ د» */
export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  const n = (x: number) => x.toLocaleString("ar-SA");
  return [h ? `${n(h)} س` : "", m || !h ? `${n(m)} د` : ""].filter(Boolean).join(" ");
}

/** «٨:٣٠ ص» من HH:MM */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${h12.toLocaleString("ar-SA")}:${String(m).padStart(2, "0").replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d])} ${h < 12 ? "ص" : "م"}`;
}
