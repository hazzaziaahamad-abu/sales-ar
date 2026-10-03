// أنواع وثوابت «التسويق بالمحتوى» — مشتركة بين الواجهة ومسارات الـAPI.

export type ContentKind = "video" | "reel" | "post" | "carousel" | "story";
export type ContentItemStatus = "idea" | "writing" | "ready" | "published";
export type ContentPlanStatus = "draft" | "in_progress" | "done" | "archived";
export type ShareMode = "view" | "edit";

export interface ContentPlan {
  id: string;
  org_id: string;
  title: string;
  description: string;
  audience: string;
  related_product: string;
  platforms: string[];
  tone: string;
  status: ContentPlanStatus;
  share_token: string;
  share_enabled: boolean;
  share_mode: ShareMode;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  items_count?: number;
}

export interface ContentItem {
  id: string;
  plan_id: string;
  kind: ContentKind;
  title: string;
  idea: string;
  script: string;
  caption: string;
  platform: string;
  publish_date: string | null;
  status: ContentItemStatus;
  source: "manual" | "ai";
  sort_order: number;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

/** ما يرجعه الـAI عند توليد الأفكار — يُعرض كاقتراحات قبل الإضافة. */
export interface ContentSuggestion {
  kind: ContentKind;
  title: string;
  idea: string;
  script: string;
  caption: string;
}

export const CONTENT_KINDS: { value: ContentKind; label: string; scriptLabel: string }[] = [
  { value: "video", label: "فيديو", scriptLabel: "السكربت" },
  { value: "reel", label: "ريلز / تيك توك", scriptLabel: "السكربت" },
  { value: "post", label: "تصميم بوست", scriptLabel: "نص التصميم" },
  { value: "carousel", label: "كاروسيل", scriptLabel: "محتوى الشرائح" },
  { value: "story", label: "ستوري", scriptLabel: "محتوى الستوري" },
];

export const ITEM_STATUSES: { value: ContentItemStatus; label: string; color: string }[] = [
  { value: "idea", label: "فكرة", color: "bg-cyan-500/20 text-cyan-400" },
  { value: "writing", label: "قيد الكتابة", color: "bg-amber-500/20 text-amber-400" },
  { value: "ready", label: "جاهز للتنفيذ", color: "bg-violet-500/20 text-violet-400" },
  { value: "published", label: "منشور", color: "bg-emerald-500/20 text-emerald-400" },
];

export const PLAN_STATUSES: { value: ContentPlanStatus; label: string; color: string }[] = [
  { value: "draft", label: "مسودة", color: "bg-slate-500/20 text-slate-400" },
  { value: "in_progress", label: "قيد التنفيذ", color: "bg-amber-500/20 text-amber-400" },
  { value: "done", label: "مكتملة", color: "bg-emerald-500/20 text-emerald-400" },
  { value: "archived", label: "مؤرشفة", color: "bg-zinc-500/20 text-zinc-400" },
];

export const PLATFORMS: { value: string; label: string }[] = [
  { value: "instagram", label: "إنستقرام" },
  { value: "tiktok", label: "تيك توك" },
  { value: "snapchat", label: "سناب شات" },
  { value: "x", label: "إكس" },
  { value: "youtube", label: "يوتيوب" },
  { value: "linkedin", label: "لينكدإن" },
];

export const kindLabel = (k: string) => CONTENT_KINDS.find((c) => c.value === k)?.label ?? k;
export const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label ?? p;
