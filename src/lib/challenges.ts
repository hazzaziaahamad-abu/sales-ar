// ثوابت ومساعدات مشتركة لمركز معالجة التحديات (تُستخدم في الواجهات).

export type ChallengeCategory = "communication" | "coworker_error" | "admin_delay" | "other";
export type ChallengeSeverity = "low" | "medium" | "high";
export type ChallengeStatus =
  | "new" | "under_review" | "solutions_proposed" | "in_progress" | "measuring" | "resolved" | "closed";

export const CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  communication: "مشكلة تواصل",
  coworker_error: "خطأ من زميل",
  admin_delay: "تأخر الدعم الإداري",
  other: "أخرى",
};

export const SEVERITY_LABELS: Record<ChallengeSeverity, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
};

export const SEVERITY_COLORS: Record<ChallengeSeverity, string> = {
  low: "bg-sky-500/15 text-sky-400 ring-sky-500/20",
  medium: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  high: "bg-red-500/15 text-red-400 ring-red-500/20",
};

export const STATUS_LABELS: Record<ChallengeStatus, string> = {
  new: "جديد",
  under_review: "قيد المراجعة",
  solutions_proposed: "حلول مقترحة",
  in_progress: "قيد التطبيق",
  measuring: "قياس النتائج",
  resolved: "تم الحل",
  closed: "مغلق",
};

export const STATUS_COLORS: Record<ChallengeStatus, string> = {
  new: "bg-slate-500/15 text-slate-300 ring-slate-500/20",
  under_review: "bg-violet-500/15 text-violet-400 ring-violet-500/20",
  solutions_proposed: "bg-cyan-500/15 text-cyan-400 ring-cyan-500/20",
  in_progress: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  measuring: "bg-indigo-500/15 text-indigo-400 ring-indigo-500/20",
  resolved: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  closed: "bg-slate-500/15 text-slate-400 ring-slate-500/20",
};

// ترتيب المراحل للتقدّم في التايم لاين.
export const STATUS_FLOW: ChallengeStatus[] = [
  "new", "under_review", "solutions_proposed", "in_progress", "measuring", "resolved",
];

export type Measurement = {
  id: string;
  metric_name: string;
  unit: string | null;
  baseline_value: number | null;
  target_value: number | null;
  current_value: number | null;
  direction: "increase" | "decrease";
  measured_at: string | null;
  note: string | null;
};

export type SuccessVerdict = "success" | "partial" | "fail" | "pending";

/** يحسب نسبة التحسّن (0..1+) وحكم النجاح بناءً على قبل/الهدف/الحالي واتجاه التحسّن. */
export function evaluateMeasurement(m: Measurement): { pct: number | null; verdict: SuccessVerdict } {
  const { baseline_value: b, target_value: t, current_value: c, direction } = m;
  if (c === null || b === null || t === null) return { pct: null, verdict: "pending" };

  const denom = direction === "increase" ? t - b : b - t;
  const numer = direction === "increase" ? c - b : b - c;
  if (denom === 0) {
    // لا فرق بين القيمة الأساسية والهدف — نعتبره محقَّقًا إن وصل للهدف.
    const reached = direction === "increase" ? c >= t : c <= t;
    return { pct: reached ? 1 : 0, verdict: reached ? "success" : "fail" };
  }
  const pct = numer / denom;
  const reached = direction === "increase" ? c >= t : c <= t;
  let verdict: SuccessVerdict;
  if (reached || pct >= 1) verdict = "success";
  else if (pct >= 0.5) verdict = "partial";
  else verdict = "fail";
  return { pct, verdict };
}

export const VERDICT_LABELS: Record<SuccessVerdict, string> = {
  success: "نجح",
  partial: "جزئي",
  fail: "لم ينجح",
  pending: "بانتظار القياس",
};

export const VERDICT_COLORS: Record<SuccessVerdict, string> = {
  success: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  partial: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  fail: "bg-red-500/15 text-red-400 ring-red-500/20",
  pending: "bg-slate-500/15 text-slate-300 ring-slate-500/20",
};
