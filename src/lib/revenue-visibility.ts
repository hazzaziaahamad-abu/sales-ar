// الموظف (غير السوبر أدمن) يشوف المبالغ الإجمالية لآخر 3 شهور فقط (الشهر الحالي + الشهرين اللي قبله).
// عدد الصفقات يبقى كامل؛ هذا يخص المبالغ المجمّعة فقط.
export const REVENUE_VISIBLE_MONTHS = 3;

/** بداية نافذة المبالغ للمستخدم، أو null إذا يشوف كل شي. */
export function revenueCutoff(user: { isSuperAdmin?: boolean | null } | null | undefined): Date | null {
  if (!user || user.isSuperAdmin) return null;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (REVENUE_VISIBLE_MONTHS - 1), 1);
}

/** قيمة تُحسب في المجاميع: صفر إذا التاريخ قبل النافذة. */
export function visibleAmount(amount: number | null | undefined, date: Date | string | null | undefined, cutoff: Date | null): number {
  const v = Number(amount) || 0;
  if (!cutoff || !date) return v;
  const t = date instanceof Date ? date : new Date(date);
  return Number.isNaN(t.getTime()) || t >= cutoff ? v : 0;
}
