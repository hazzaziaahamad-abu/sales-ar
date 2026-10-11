// «أفكار» — لوحة استكرات مشتركة للفريق. أنواع وثوابت مشتركة بين الواجهة والـAPI.

export type StickerKind = "star" | "note" | "circle";

export interface IdeaSticker {
  id: string;
  kind: StickerKind;
  tag: string;
  title: string;
  body: string;
  sort_order: number;
  likes: string[];
  timeline?: TimelineStep[] | null;
  due_at?: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const STICKER_KINDS: { value: StickerKind; label: string; tag: string; swatch: string; ink: string }[] = [
  { value: "star", label: "فكرة خاطفة", tag: "⚡ فكرة خاطفة", swatch: "#fef08a", ink: "#713f12" },
  { value: "note", label: "تذكير", tag: "📌 تذكير", swatch: "#fbcfe8", ink: "#831843" },
  { value: "circle", label: "اقتراح", tag: "💡 اقتراح", swatch: "#a7f3d0", ink: "#064e3b" },
];

// ─── تايم لاين التنفيذ ───────────────────────────────────────────────────────

export interface TimelineStep {
  key: string;
  label: string;
  done_at: string | null;
  done_by: string | null;
}

/** الخطوات الافتراضية لأي فكرة — من الطرح إلى قياس النتيجة. */
export const DEFAULT_STEPS: { key: string; label: string }[] = [
  { key: "posted", label: "طرح الفكرة" },
  { key: "review", label: "المراجعة والاعتماد" },
  { key: "plan", label: "التخطيط والتجهيز" },
  { key: "start", label: "بدء التنفيذ" },
  { key: "launch", label: "الإطلاق" },
  { key: "measure", label: "قياس النتيجة" },
];

/** خطوات الفكرة — لو ما عندها تايم لاين محفوظ نبني الافتراضي (الطرح منجز بتاريخ الإنشاء). */
export function timelineOf(s: Pick<IdeaSticker, "timeline" | "created_at" | "created_by_name">): TimelineStep[] {
  if (Array.isArray(s.timeline) && s.timeline.length) return s.timeline;
  return DEFAULT_STEPS.map((d, i) => ({
    key: d.key,
    label: d.label,
    done_at: i === 0 ? s.created_at : null,
    done_by: i === 0 ? s.created_by_name : null,
  }));
}

export const isStickerKind =(v: unknown): v is StickerKind => v === "star" || v === "note" || v === "circle";
export const stickerKind = (k: string) => STICKER_KINDS.find((x) => x.value === k) ?? STICKER_KINDS[0];
