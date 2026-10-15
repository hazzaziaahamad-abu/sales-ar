// «الشرائح» — تقطيع الفكرة لمهام تنجز كل وحدة في جلسة واحدة. أنواع وثوابت مشتركة بين الواجهة والـAPI.
import { saudiDateStr } from "@/lib/utils/format";

export type SliceKind = "deep" | "shallow";
export type SliceSpace = "ideas" | "work";

export interface FocusSlice {
  id: string;
  space: SliceSpace;
  idea_id: string | null;
  title: string;
  kind: SliceKind;
  planned_for: string | null;
  done_at: string | null;
  focus_minutes: number;
  sort_order: number;
  created_at: string;
}

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

/** نسبة إنجاز الفكرة من شرائحها (٠–١٠٠) — null لو ما لها شرائح. */
export function ideaProgress(slices: Pick<FocusSlice, "done_at">[]): number | null {
  if (!slices.length) return null;
  return Math.round((slices.filter((s) => s.done_at).length / slices.length) * 100);
}

/** ينظّف عنوان الشريحة (سطر واحد قصير). */
export const cleanSliceTitle = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
