// «طلبات التحقق» — المدير يطلب تحقق، الموظف يرد، والنظام يطابق.
import { STAGES, RENEWAL_STATUSES } from "@/lib/utils/constants";

export type VerifyTemplate = "trial" | "awaiting_payment" | "stale" | "renewals_week" | "renewals_awaiting_payment" | "renewals_following_stale";
export type VerifyScope = "support" | "office" | "all";
export type VerifyStatus = "pending" | "answered" | "reviewed";
export type EntityType = "deal" | "renewal";

/** رد «تعذّر التواصل» — لا يُعدّ مطابقة ولا اختلاف. */
export const NO_CONTACT = "__no_contact__";

export const TEMPLATES: Record<VerifyTemplate, { label: string; hint: string; entity: EntityType }> = {
  trial: { label: "العملاء في التجربة حالياً", hint: "الصفقات في مرحلة «تجريبي»", entity: "deal" },
  awaiting_payment: { label: "صفقات بانتظار الدفع", hint: "الصفقات في مرحلة «انتظار الدفع»", entity: "deal" },
  stale: { label: "صفقات بدون تواصل", hint: "صفقات مفتوحة بدون تواصل من أكثر من X أيام", entity: "deal" },
  renewals_week: { label: "تجديدات هذا الأسبوع", hint: "تجديدات موعدها خلال ٧ أيام أو متأخرة ولم تكتمل", entity: "renewal" },
  renewals_awaiting_payment: { label: "تجديدات بانتظار الدفع", hint: "التجديدات في حالة «انتظار الدفع»", entity: "renewal" },
  renewals_following_stale: { label: "تجديدات جاري المتابعة بدون تحديث", hint: "تجديدات «جاري المتابعة» بدون تحديث من أكثر من X أيام", entity: "renewal" },
};
export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as VerifyTemplate[];

export const SCOPE_LABELS: Record<VerifyScope, string> = {
  support: "مبيعات الدعم",
  office: "مبيعات المكتب",
  all: "الكل",
};

export const STATUS_LABELS: Record<VerifyStatus, string> = {
  pending: "بانتظار رد الموظف",
  answered: "تم الرد — جاهز للمطابقة",
  reviewed: "تمت المراجعة",
};

/** خيارات الحالة اللي يختار منها الموظف حسب نوع العنصر. */
export const statusOptions = (entity: EntityType): readonly string[] => (entity === "deal" ? STAGES : RENEWAL_STATUSES);

export interface VerifyItem {
  entity_type: EntityType;
  entity_id: string;
  name: string;
  phone: string | null;
  rep: string | null;
  value: number;
  system_status: string;      // الحالة وقت إرسال الطلب
  last_activity: string | null;
  extra: string | null;       // معلومة إضافية (الباقة، تاريخ التجديد...)
}

export interface VerifyResponse { status: string; note?: string; last_contact?: string }
export interface VerifyExtra { name: string; status: string; note?: string }
export interface VerifyApplied { from: string; to: string; by: string | null; at: string }

/** القوالب اللي تحتاج عدد أيام (بدون تواصل/تحديث). */
export const usesDays = (t: VerifyTemplate) => t === "stale" || t === "renewals_following_stale";

export interface VerificationRequest {
  id: string;
  request_number: number;
  template: VerifyTemplate;
  scope: VerifyScope;
  params: { stale_days?: number };
  assignee_id: string;
  assignee_name: string | null;
  note: string | null;
  due_at: string | null;
  status: VerifyStatus;
  items: VerifyItem[];
  responses: Record<string, VerifyResponse>;
  extras: VerifyExtra[];
  applied: Record<string, VerifyApplied>;
  responded_at: string | null;
  reviewed_at: string | null;
  created_by_name: string | null;
  created_at: string;
  /** الحالة الحالية في النظام لكل عنصر (تُحسب عند القراءة للمدراء). */
  current?: Record<string, string | null>;
}

export type MatchResult = "match" | "mismatch" | "no_answer" | "no_contact";

export function matchItem(item: VerifyItem, response: VerifyResponse | undefined, current: string | null | undefined): MatchResult {
  if (!response?.status) return "no_answer";
  if (response.status === NO_CONTACT) return "no_contact";
  return response.status === (current ?? item.system_status) ? "match" : "mismatch";
}

export function summarize(req: VerificationRequest) {
  const counts: Record<MatchResult, number> = { match: 0, mismatch: 0, no_answer: 0, no_contact: 0 };
  for (const it of req.items) counts[matchItem(it, req.responses[it.entity_id], req.current?.[it.entity_id])]++;
  const total = req.items.length;
  return { ...counts, total, extras: req.extras.length, pct: total ? Math.round((counts.match / total) * 100) : 100 };
}
