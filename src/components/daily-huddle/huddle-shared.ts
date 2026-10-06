// ثوابت ومساعدات مشتركة بين تبويبات «المتابعة اليومية» (فريق قائمة الطلبات).

// تجربة أولية: فريق «قائمة الطلبات» فقط.
export const TEAM = ["علي", "مريم", "تغريد", "منال", "عواطف"];
export const KEY_PREFIX = "huddle_menu";

// جودة الاستهداف — يقيّمها المدير من 1 إلى 5 بعد الاستماع لمكالمات الموظف.
export const QUALITY = [
  { key: "clarity", label: "وضوح العرض" },
  { key: "response", label: "الرد المثالي" },
  { key: "technique", label: "تطبيق أساليب المبيعات" },
  { key: "knowledge", label: "الإلمام" },
] as const;
export type QualityKey = (typeof QUALITY)[number]["key"];
export type QualityScores = Partial<Record<QualityKey, number>>;

/** متوسط التقييمات المُدخلة (من 5)، أو null إن لم يُقيَّم شيء. */
export function qualityAvg(q?: QualityScores): number | null {
  const vals = QUALITY.map((c) => q?.[c.key]).filter((v): v is number => !!v);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export const qualityColor = (v: number) => (v >= 4 ? "text-emerald-400" : v >= 3 ? "text-amber-400" : "text-red-400");

/** أول يوم (الأحد) من أسبوع التاريخ المعطى. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
