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

/** صف في تايم لاين الفيديو. */
export interface TimelineRow {
  time: string;   // مثال: 0-3ث
  shot: string;   // اللقطة / المشهد
  voice: string;  // الكلام / التعليق الصوتي
  text: string;   // نص على الشاشة
}

export interface ContentItem {
  id: string;
  plan_id: string;
  kind: ContentKind;
  title: string;
  idea: string;
  script: string;
  caption: string;
  timeline: TimelineRow[];
  focus_points: string[];
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
  timeline: TimelineRow[];
  focus_points: string[];
}

/** الأنواع اللي لها تايم لاين ونقاط تركيز (فيديو). */
export const isVideoKind = (k: string) => k === "video" || k === "reel";

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

/** نشاط كل منظمة وجمهورها الافتراضي — يُعطى للذكاء الاصطناعي ويظهر كاقتراح في نموذج الإنشاء. */
export const ORG_CONTENT_PROFILES: Record<string, { business: string; audience: string }> = {
  "00000000-0000-0000-0000-000000000001": {
    business: "«قائمة الطلبات» — شركة تقنية سعودية تقدم للمطاعم والكافيهات قوائم إلكترونية وكاشير وأنظمة ولاء",
    audience: "أصحاب المطاعم والكافيهات",
  },
  "00000000-0000-0000-0000-000000000002": {
    business: "«حجوزات» — منصة/نظام حجوزات إلكترونية سعودية للصالونات والشاليهات (استقبال الحجوزات، المواعيد، الدفع والتذكير)، ويشمل بطاقات الهدايا وبطاقات الولاء لعملاء الصالون/الشاليه",
    audience: "أصحاب الصالونات والشاليهات",
  },
};

export const orgContentProfile = (orgId: string) =>
  ORG_CONTENT_PROFILES[orgId] ?? ORG_CONTENT_PROFILES["00000000-0000-0000-0000-000000000001"];
