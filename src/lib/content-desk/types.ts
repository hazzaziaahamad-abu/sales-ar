// «مكتب المحتوى» — أنواع وثوابت مشتركة بين الواجهة ومسارات الـ API.

export type ContentType = "awareness" | "interactive" | "promo" | "bts";
export type Platform = "ig" | "tt" | "both";
export type Format = "reel" | "post" | "carousel" | "story" | "video";
export type ItemStatus = "planned" | "ready" | "done";

/** النوع يحدد الهدف تلقائياً (نفس جدول خطة المحتوى الأسبوعية). */
export const CONTENT_TYPES: Record<ContentType, { label: string; goal: string }> = {
  awareness: { label: "منشور توعوي", goal: "زيادة الوعي" },
  interactive: { label: "منشور تفاعلي", goal: "زيادة التفاعل" },
  promo: { label: "منشور ترويجي", goal: "جذب العملاء" },
  bts: { label: "كواليس المشروع", goal: "بناء الثقة" },
};
export const PLATFORMS: Record<Platform, string> = { ig: "انستقرام", tt: "تيك توك", both: "المنصتين" };
export const FORMATS: Record<Format, string> = { reel: "ريلز", post: "بوست", carousel: "كاروسيل", story: "ستوري", video: "فيديو قصير" };
export const STATUSES: Record<ItemStatus, string> = { planned: "مخطط", ready: "جاهز للنشر", done: "تم النشر" };

export interface DeskItem {
  id: string;
  item_date: string;
  item_time: string | null;
  idea: string;
  content_type: ContentType;
  platform: Platform;
  format: Format;
  status: ItemStatus;
  target_views: number | null;
  target_engagement: number | null;
  actual_views: number | null;
  actual_engagement: number | null;
  link: string | null;
  note: string | null;
  done_at: string | null;
}

export interface DeskDay { day: string; wa_status_at: string | null; checklist: Record<string, boolean> }

export interface DeskGoals {
  period: string;
  views_target: number | null;
  posts_target: number | null;
  ig_followers_target: number | null;
  tt_followers_target: number | null;
  ig_followers_now: number | null;
  tt_followers_now: number | null;
}

export interface DeskPerson { id: string; name: string }

export interface DeskPayload {
  me: { id: string; name: string; isManager: boolean };
  owner: DeskPerson;
  canEdit: boolean;
  today: string;
  items: DeskItem[];
  days: DeskDay[];
  goals: DeskGoals | null;
  /** للمدير: أخصائيو المحتوى في المنشأة */
  people: DeskPerson[];
}

export const ITEM_COLS =
  "id, item_date, item_time, idea, content_type, platform, format, status, target_views, target_engagement, actual_views, actual_engagement, link, note, done_at";

export const isContentType = (v: unknown): v is ContentType => typeof v === "string" && v in CONTENT_TYPES;
export const isPlatform = (v: unknown): v is Platform => typeof v === "string" && v in PLATFORMS;
export const isFormat = (v: unknown): v is Format => typeof v === "string" && v in FORMATS;
export const isStatus = (v: unknown): v is ItemStatus => typeof v === "string" && v in STATUSES;

export type Verdict = { tone: "ok" | "warn" | "bad" | "muted"; label: string };

/** حكم المنشور: حقق الهدف / أقل من الهدف / متأخر / مخطط. */
export function verdictOf(it: DeskItem, today: string): Verdict {
  if (it.status === "done") {
    if (it.actual_views == null) return { tone: "warn", label: "أدخل الأرقام" };
    if (!it.target_views) return { tone: "ok", label: "تم النشر" };
    const p = it.actual_views / it.target_views;
    return p >= 1 ? { tone: "ok", label: "حقق الهدف" } : { tone: "warn", label: `أقل من الهدف ${Math.round(p * 100)}%` };
  }
  if (it.item_date < today) return { tone: "bad", label: "متأخر" };
  return { tone: "muted", label: STATUSES[it.status] };
}

// ─── تواريخ (نصوص YYYY-MM-DD، بلا مناطق زمنية) ───
export const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export const toYmd = (d: Date) => d.toISOString().slice(0, 10);
export const fromYmd = (s: string) => new Date(`${s}T00:00:00Z`);
export const addDays = (s: string, n: number) => { const d = fromYmd(s); d.setUTCDate(d.getUTCDate() + n); return toYmd(d); };
export const dowOf = (s: string) => fromYmd(s).getUTCDay();
/** الأسبوع يبدأ السبت */
export const weekStartOf = (s: string) => addDays(s, -((dowOf(s) + 1) % 7));
export const monthStartOf = (s: string) => `${s.slice(0, 7)}-01`;
export const daysInMonth = (period: string) => { const [y, m] = period.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const addMonths = (s: string, n: number) => { const d = fromYmd(monthStartOf(s)); d.setUTCMonth(d.getUTCMonth() + n); return toYmd(d); };

export const fmtNum = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(Math.round(n / 100_000) / 10).toString().replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(Math.round(n / 100) / 10).toString().replace(/\.0$/, "")}K`;
  return String(n);
};
