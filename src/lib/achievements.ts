// «الإنجازات» — تلقائية من النظام + يدوية يسجّلها الفريق.

export type AchievementSource = "deal" | "renewal" | "ticket" | "challenge" | "meeting" | "task" | "manual";
export type AchievementCategory = "sales" | "customers" | "development" | "process" | "team" | "other";

export const SOURCE_LABELS: Record<AchievementSource, string> = {
  deal: "صفقات",
  renewal: "تجديدات",
  ticket: "طلبات وتطويرات",
  challenge: "تحديات انحلّت",
  meeting: "اجتماعات",
  task: "مهام",
  manual: "إنجازات مسجّلة",
};
export const SOURCE_ICONS: Record<AchievementSource, string> = {
  deal: "💰", renewal: "🔄", ticket: "🎫", challenge: "🛡️", meeting: "📅", task: "✅", manual: "⭐",
};
export const SOURCE_COLORS: Record<AchievementSource, string> = {
  deal: "text-emerald-400",
  renewal: "text-sky-400",
  ticket: "text-amber-400",
  challenge: "text-violet-400",
  meeting: "text-indigo-400",
  task: "text-cyan-400",
  manual: "text-yellow-300",
};

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  sales: "مبيعات",
  customers: "عملاء",
  development: "تطوير",
  process: "تحسين عمل",
  team: "الفريق",
  other: "أخرى",
};
export const ACHIEVEMENT_CATEGORIES = Object.keys(CATEGORY_LABELS) as AchievementCategory[];
export const ACHIEVEMENT_SOURCES = Object.keys(SOURCE_LABELS) as AchievementSource[];

export interface AchievementItem {
  id: string;
  source: AchievementSource;
  title: string;
  detail: string | null;
  who: string | null;
  day: string;            // YYYY-MM-DD بتوقيت السعودية
  value: number | null;   // ريال (للصفقات والتجديدات)
  category?: AchievementCategory;
  can_delete?: boolean;
}
