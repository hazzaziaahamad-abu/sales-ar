// «مبيعات الدعم» مدموجة مع «المبيعات» في نحجز (حجوزات) فقط.
// قائمة الطلبات تبقى كما هي: مبيعات المكتب ومبيعات الدعم قسمين منفصلين.
export const NAHJEZ_ORG_ID = "00000000-0000-0000-0000-000000000002";

const MERGED_SALES_ORGS = new Set<string>([NAHJEZ_ORG_ID]);

/** هل «مبيعات الدعم» مدموجة مع «المبيعات» في هذه المنظمة؟ */
export function isSupportSalesMerged(orgId?: string | null): boolean {
  return !!orgId && MERGED_SALES_ORGS.has(orgId);
}
