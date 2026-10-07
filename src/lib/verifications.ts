// «طلبات التحقق» — المدير يرسل عدد العملاء اللي يحتاجون تحديث، الموظف يحدّثهم في النظام،
// والنظام يحسب التقدّم تلقائياً من السجل (كم عميل انضاف له تعليق بعد إرسال الطلب).

export type VerifyTemplate = "trial" | "awaiting_payment" | "stale" | "renewals_week" | "renewals_awaiting_payment" | "renewals_following_stale";
export type VerifyScope = "support" | "office" | "all" | "renewals";
export type VerifyStatus = "pending" | "answered" | "reviewed";
export type EntityType = "deal" | "renewal";

export const TEMPLATES: Record<VerifyTemplate, { label: string; hint: string; entity: EntityType }> = {
  trial: { label: "العملاء في التجربة حالياً", hint: "الصفقات في مرحلة «تجريبي»", entity: "deal" },
  awaiting_payment: { label: "صفقات بانتظار الدفع", hint: "الصفقات في مرحلة «انتظار الدفع»", entity: "deal" },
  stale: { label: "صفقات بدون تواصل", hint: "صفقات مفتوحة بدون تعليق في السجل من أكثر من X أيام", entity: "deal" },
  renewals_week: { label: "تجديدات هذا الأسبوع", hint: "تجديدات موعدها خلال ٧ أيام أو متأخرة ولم تكتمل", entity: "renewal" },
  renewals_awaiting_payment: { label: "تجديدات بانتظار الدفع", hint: "التجديدات في حالة «انتظار الدفع»", entity: "renewal" },
  renewals_following_stale: { label: "تجديدات جاري المتابعة بدون تحديث", hint: "تجديدات «جاري المتابعة» بدون تعليق في السجل من أكثر من X أيام", entity: "renewal" },
};
export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as VerifyTemplate[];

export const SCOPE_LABELS: Record<VerifyScope, string> = {
  support: "مبيعات الدعم",
  office: "مبيعات المكتب",
  all: "الكل",
  renewals: "التجديدات",
};

/** خيارات «القسم» حسب نوع التقرير: الصفقات أو التجديدات. */
export function scopeOptions(entity: EntityType): { value: VerifyScope; label: string }[] {
  return entity === "renewal"
    ? [{ value: "renewals", label: "التجديدات (الكل)" }, { value: "support", label: "تجديدات الدعم" }, { value: "office", label: "تجديدات المكتب" }]
    : [{ value: "support", label: "مبيعات الدعم" }, { value: "office", label: "مبيعات المكتب" }, { value: "all", label: "الكل" }];
}

/** اسم القسم في عنوان الطلب. */
export function scopeTitle(template: VerifyTemplate, scope: VerifyScope): string {
  const entity = TEMPLATES[template].entity;
  return scopeOptions(entity).find((o) => o.value === scope)?.label ?? SCOPE_LABELS[scope];
}

export const STATUS_LABELS: Record<VerifyStatus, string> = {
  pending: "بانتظار التحديث",
  answered: "الموظف خلّص — بانتظار مراجعتك",
  reviewed: "تمت المراجعة",
};

/** فلتر «عملاء مين؟»: كل العملاء، أو بدون مسؤول، أو مسؤول محدد. */
export const REP_ALL = "";
export const REP_NONE = "__none__";
export const repLabel = (rep?: string) => (!rep ? "" : rep === REP_NONE ? "بدون مسؤول" : `عملاء ${rep}`);

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

/** القوالب اللي تحتاج عدد أيام (بدون تواصل/تحديث). */
export const usesDays = (t: VerifyTemplate) => t === "stale" || t === "renewals_following_stale";

export interface VerificationRequest {
  id: string;
  request_number: number;
  template: VerifyTemplate;
  scope: VerifyScope;
  params: { stale_days?: number; rep?: string };
  assignee_id: string;
  assignee_name: string | null;
  note: string | null;
  due_at: string | null;
  status: VerifyStatus;
  items: VerifyItem[];
  responded_at: string | null;
  reviewed_at: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  /** العناصر اللي تحدّثت في النظام بعد إرسال الطلب (تُحسب عند القراءة). */
  updated_ids?: string[];
}

/** تقدّم الطلب: كم عميل تحدّث من الإجمالي. */
export function progressOf(req: VerificationRequest) {
  const total = req.items.length;
  const done = req.updated_ids?.length ?? 0;
  return { total, done, left: Math.max(total - done, 0), pct: total ? Math.round((done / total) * 100) : 100 };
}

/** الصفحة اللي يحدّث منها الموظف حسب نوع التقرير والقسم. */
export function updatePageOf(template: VerifyTemplate, scope: VerifyScope): { href: string; label: string } {
  if (TEMPLATES[template].entity === "renewal") return { href: "/renewals", label: "التجديدات" };
  return scope === "support" ? { href: "/support-sales", label: "مبيعات الدعم" } : { href: "/sales", label: "المبيعات" };
}
