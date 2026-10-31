// «أفكار» — لوحة استكرات مشتركة للفريق. أنواع وثوابت مشتركة بين الواجهة والـAPI.

export type StickerKind = "star" | "note" | "circle" | "dev";

export interface IdeaSticker {
  id: string;
  kind: StickerKind;
  tag: string;
  title: string;
  body: string;
  sort_order: number;
  likes: string[];
  timeline?: TimelineStep[] | null;
  /** ملاحظات الاجتماع لورقة التطوير — نص بعلامات التظليل ({{y:…}} و **…**). */
  notes?: string | null;
  due_at?: string | null;
  /** للتذكير فقط: وقت الإنجاز ومن أنجزه — المكتمل ينتقل للوحة «المنجزات». */
  completed_at?: string | null;
  completed_by?: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const STICKER_KINDS: { value: StickerKind; label: string; tag: string; swatch: string; ink: string }[] = [
  { value: "star", label: "فكرة خاطفة", tag: "⚡ فكرة خاطفة", swatch: "#fef08a", ink: "#713f12" },
  { value: "note", label: "تذكير", tag: "📌 تذكير", swatch: "#fbcfe8", ink: "#831843" },
  { value: "circle", label: "اقتراح", tag: "💡 اقتراح", swatch: "#a7f3d0", ink: "#064e3b" },
  { value: "dev", label: "ورقة تطوير", tag: "🛠️ ورقة تطوير", swatch: "#bfdbfe", ink: "#1e3a8a" },
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

/** مراحل ورقة التطوير الافتراضية — من تحديد المشكلة إلى التحسين بعد الإطلاق. */
export const DEV_STEPS: { key: string; label: string }[] = [
  { key: "posted", label: "تحديد المشكلة والهدف" },
  { key: "research", label: "جمع المتطلبات والملاحظات" },
  { key: "design", label: "التصميم والتخطيط" },
  { key: "build", label: "التطوير والتنفيذ" },
  { key: "test", label: "الاختبار والمراجعة" },
  { key: "launch", label: "الإطلاق" },
  { key: "improve", label: "قياس الأثر والتحسين" },
];

/** خطوات الفكرة — لو ما عندها تايم لاين محفوظ نبني الافتراضي (الطرح منجز بتاريخ الإنشاء). */
export function timelineOf(s: Pick<IdeaSticker, "timeline" | "created_at" | "created_by_name"> & { kind?: StickerKind }): TimelineStep[] {
  if (Array.isArray(s.timeline) && s.timeline.length) return s.timeline;
  return (s.kind === "dev" ? DEV_STEPS : DEFAULT_STEPS).map((d, i) => ({
    key: d.key,
    label: d.label,
    done_at: i === 0 ? s.created_at : null,
    done_by: i === 0 ? s.created_by_name : null,
  }));
}

/** التذكير ما له خطوات تنفيذ — له موعد إنجاز وحالة مكتمل / غير مكتمل فقط. */
export const isReminder = (s: Pick<IdeaSticker, "kind">) => s.kind === "note";

export const isDevSheet = (s: Pick<IdeaSticker, "kind">) => s.kind === "dev";

/**
 * نسبة اكتمال التطوير الإجمالية (٠–١٠٠): كل مرحلة وكل شريحة وحدة عمل،
 * فالشرائح الصغيرة تحرّك الدائرة بين المراحل بدل ما تنتظر اكتمال مرحلة كاملة.
 */
export function devProgress(steps: Pick<TimelineStep, "done_at">[], slices: { done_at: string | null }[] = []) {
  const total = steps.length + slices.length;
  if (!total) return 0;
  const done = steps.filter((s) => s.done_at).length + slices.filter((s) => s.done_at).length;
  return Math.round((done / total) * 100);
}

export const isStickerKind = (v: unknown): v is StickerKind => v === "star" || v === "note" || v === "circle" || v === "dev";
export const stickerKind = (k: string) => STICKER_KINDS.find((x) => x.value === k) ?? STICKER_KINDS[0];
