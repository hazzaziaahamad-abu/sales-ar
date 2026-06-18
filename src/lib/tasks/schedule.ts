/**
 * Pure-JS schedule math for scheduled_tasks (no external deps).
 *
 * Tasks store structured fields (frequency + at_hour/at_minute + weekday /
 * day_of_month / run_at) plus an IANA timezone. We compute the next UTC instant
 * the task should fire, interpreting at_hour/at_minute in the task's timezone.
 */

import type { ScheduledTask } from "@/types";

type SchedulableTask = Pick<
  ScheduledTask,
  | "frequency"
  | "at_hour"
  | "at_minute"
  | "weekday"
  | "day_of_month"
  | "run_at"
  | "timezone"
>;

const AR_WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** Wall-clock parts of `date` as observed in `timeZone`. */
function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday);
  return {
    year: Number(map.year),
    month: Number(map.month), // 1-12
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: weekdayIndex, // 0=Sun
  };
}

/** The UTC offset (minutes) that `timeZone` has at instant `date`. */
function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return (asUTC - date.getTime()) / 60000;
}

/**
 * Build the UTC Date for a given wall-clock time in `timeZone`.
 * Resolves the offset iteratively so DST transitions are handled.
 */
function zonedTimeToUtc(
  y: number,
  m: number, // 1-12
  d: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  let utc = Date.UTC(y, m - 1, d, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const offset = zoneOffsetMinutes(new Date(utc), timeZone);
    const next = Date.UTC(y, m - 1, d, hour, minute, 0) - offset * 60000;
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

/**
 * Next fire instant strictly after `from`. Returns null for a one-off whose
 * time has already passed (caller marks the task completed).
 */
export function computeNextRun(task: SchedulableTask, from: Date = new Date()): Date | null {
  const tz = task.timezone || "Asia/Riyadh";
  const { at_hour, at_minute } = task;

  if (task.frequency === "once") {
    if (!task.run_at) return null;
    const at = new Date(task.run_at);
    return at.getTime() > from.getTime() ? at : null;
  }

  // Walk candidate days in the task's timezone until one is strictly future.
  const startParts = partsInZone(from, tz);
  // Start from "today" in the zone, scan up to ~400 days ahead (covers monthly).
  for (let i = 0; i < 400; i++) {
    const base = Date.UTC(startParts.year, startParts.month - 1, startParts.day + i);
    const probe = partsInZone(new Date(base), tz);
    const y = probe.year;
    const m = probe.month;
    const d = probe.day;
    const weekday = probe.weekday;

    if (task.frequency === "weekly" && task.weekday != null && weekday !== task.weekday) continue;
    if (task.frequency === "monthly" && task.day_of_month != null && d !== task.day_of_month) continue;

    const candidate = zonedTimeToUtc(y, m, d, at_hour, at_minute, tz);
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return null;
}

function fmtTime(h: number, m: number): string {
  const period = h < 12 ? "ص" : "م";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  const mm = String(m).padStart(2, "0");
  return `${hour12}:${mm} ${period}`;
}

/** Human-readable Arabic description of a task's schedule. */
export function describeSchedule(task: SchedulableTask): string {
  const time = fmtTime(task.at_hour, task.at_minute);
  switch (task.frequency) {
    case "once":
      if (!task.run_at) return "مرة واحدة";
      return `مرة واحدة — ${new Date(task.run_at).toLocaleString("ar-SA-u-ca-gregory", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`;
    case "daily":
      return `يومياً الساعة ${time}`;
    case "weekly": {
      const day = task.weekday != null ? AR_WEEKDAYS[task.weekday] : "";
      return `كل ${day} الساعة ${time}`;
    }
    case "monthly":
      return `يوم ${task.day_of_month ?? 1} من كل شهر الساعة ${time}`;
    default:
      return time;
  }
}
