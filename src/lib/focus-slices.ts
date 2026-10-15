// «الشرائح» — تقطيع الفكرة لمهام تنجز كل وحدة في جلسة واحدة. أنواع وثوابت مشتركة بين الواجهة والـAPI.
import { saudiDateStr } from "@/lib/utils/format";
import { nextWorkday } from "@/lib/work-hours";

export type SliceKind = "deep" | "shallow";
export type SliceSpace = "ideas" | "work";

export interface FocusSlice {
  id: string;
  space: SliceSpace;
  idea_id: string | null;
  work_item_id: string | null;
  title: string;
  kind: SliceKind;
  planned_for: string | null;
  done_at: string | null;
  focus_minutes: number;
  /** موعد الجلسة العميقة (HH:MM:SS) — للعمل الوظيفي. */
  session_at: string | null;
  sort_order: number;
  created_at: string;
}

/** الأم: الفكرة (الأفكار) أو بند العمل (العمل الوظيفي). */
export const parentOf = (s: Pick<FocusSlice, "idea_id" | "work_item_id">) => s.idea_id ?? s.work_item_id ?? null;

export const SLICE_COLS = "id, space, idea_id, work_item_id, title, kind, planned_for, done_at, focus_minutes, session_at, sort_order, created_at";

export const SLICE_KINDS: Record<SliceKind, { icon: string; label: string; hint: string }> = {
  deep: { icon: "🔥", label: "عميقة", hint: "٦٠–٩٠ دقيقة تركيز" },
  shallow: { icon: "⚡", label: "سطحية", hint: "أقل من ١٥ دقيقة" },
};

/** حد «شرائح اليوم»: شريحة عميقة واحدة + ٣ سطحية كحد أقصى. */
export const DAY_LIMIT: Record<SliceKind, number> = { deep: 1, shallow: 3 };

/** عدد الشرائح عند التقطيع وأقصى عدد للفكرة الواحدة. */
export const SLICE_MIN = 3;
export const SLICE_MAX = 5;
export const SLICES_PER_IDEA_MAX = 12;

export const isSliceKind = (v: unknown): v is SliceKind => v === "deep" || v === "shallow";
export const isSliceSpace = (v: unknown): v is SliceSpace => v === "ideas" || v === "work";

/** اليوم وبكرة بتوقيت الرياض (YYYY-MM-DD). */
export const todayRiyadh = () => saudiDateStr();
export const tomorrowRiyadh = () => saudiDateStr(new Date(Date.now() + 86_400_000));
/** «بكرة» حسب المساحة: العمل الوظيفي = يوم الدوام التالي (الخميس ← الأحد). */
export const nextDayFor = (space: SliceSpace) => (space === "work" ? nextWorkday(todayRiyadh()) : tomorrowRiyadh());

/** أهم شريحة اليوم: العميقة المخططة لليوم، وإلا أول شريحة غير منجزة لليوم. */
export function topSliceOf(slices: FocusSlice[], today: string): FocusSlice | null {
  const todays = slices.filter((s) => s.planned_for === today && !s.done_at);
  return todays.find((s) => s.kind === "deep") ?? todays[0] ?? null;
}

/** نسبة إنجاز الفكرة من شرائحها (٠–١٠٠) — null لو ما لها شرائح. */
export function ideaProgress(slices: Pick<FocusSlice, "done_at">[]): number | null {
  if (!slices.length) return null;
  return Math.round((slices.filter((s) => s.done_at).length / slices.length) * 100);
}

/** ينظّف عنوان الشريحة (سطر واحد قصير). */
export const cleanSliceTitle = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 140);

// ─── العدّاد: العميقة المنجزة أسبوعياً + السلسلة (Streak) ─────────────────────

/** إزاحة تاريخ YYYY-MM-DD بعدد أيام. */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** بداية الأسبوع (الأحد) لتاريخ YYYY-MM-DD. */
export function weekStart(ymd: string): string {
  return addDays(ymd, -new Date(`${ymd}T00:00:00Z`).getUTCDay());
}

/**
 * السلسلة: أيام متتالية فيها شريحة عميقة منجزة واحدة على الأقل — نفس منطق سلسلة «الانضباط»:
 * اليوم يكمّل السلسلة، ولو ما أنجزت اليوم بعد تبقى السلسلة حيّة من أمس.
 */
export function deepStreak(doneDays: Set<string>, today: string): number {
  let day = doneDays.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (doneDays.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

export interface FocusStats {
  today: string;
  weekDeep: number;
  /** عدد العميقة المنجزة لكل يوم من الأحد للسبت. */
  weekDays: { date: string; deep: number }[];
  weekMinutes: number;
  streak: number;
  bestStreak: number;
}
