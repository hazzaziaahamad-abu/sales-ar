import { STAGES, SOURCES } from "./constants";

/* ─── Stage Mapping: Excel/external → App internal ─── */
export const STAGE_MAP: Record<string, string> = {
  // Common Excel values → app stages
  "إغلاق": "مكتملة",
  "عرض سعر": "تجهيز",
  "خسارة": "مرفوض مع سبب",
  "مغلقة": "مكتملة",
  "جديد": "عميل جديد",
  "new": "عميل جديد",
  "closed": "مكتملة",
  "إرسال العرض": "تم إرسال العرض",
  "ارسال العرض": "تم إرسال العرض",
  "تم ارسال العرض": "تم إرسال العرض",
  "استهداف خاطي": "استهداف خاطئ",
  "خطأ": "استهداف خاطئ",
  "كنسل": "كنسل التجربة",
  "الغاء": "كنسل التجربة",
  "تأجيل": "تاجيل",
  "مؤجل": "تاجيل",
  "اعادة الاتصال": "اعادة الاتصال في وقت اخر",
  "اعاده الاتصال": "اعادة الاتصال في وقت اخر",
  // Identity mappings for all app stages
  "تواصل": "قيد التواصل",
  "قيد التواصل": "قيد التواصل",
  "عميل جديد": "عميل جديد",
  "تفاوض": "تفاوض",
  "تجهيز": "تجهيز",
  "انتظار الدفع": "انتظار الدفع",
  "مكتملة": "مكتملة",
  "تاجيل": "تاجيل",
  "اعادة الاتصال في وقت اخر": "اعادة الاتصال في وقت اخر",
  "تجريبي": "تجريبي",
  "كنسل التجربة": "كنسل التجربة",
  "مرفوض مع سبب": "مرفوض مع سبب",
  "استهداف خاطئ": "استهداف خاطئ",
  "تم إرسال العرض": "تم إرسال العرض",
};

/* ─── Source Mapping: Excel/external → App internal ─── */
export const SOURCE_MAP: Record<string, string> = {
  // Common Excel values → app sources
  "شراكة": "تسويق بالعمولة",
  "توصية": "من طرف عميل",
  "معرض": "حملة اعلانية",
  "إعلانات": "حملة اعلانية",
  "تسويق": "تسويق بالعمولة",
  "تواصل": "من ارقام عشوائية",
  // Identity mappings for all app sources
  "حملة اعلانية": "حملة اعلانية",
  "تسويق بالعمولة": "تسويق بالعمولة",
  "جديد لعميل حالي": "جديد لعميل حالي",
  "فرع جديد لعميل حالي": "فرع جديد لعميل حالي",
  "من طرف عميل": "من طرف عميل",
  "من الدعم": "من الدعم",
  "من ارقام عشوائية": "من ارقام عشوائية",
  "عميل من قائمة الطلبات": "عميل من قائمة الطلبات",
  "اخرى": "اخرى",
};

/* ─── Renewal Status Mapping ─── */
export const RENEWAL_STATUS_MAP: Record<string, string> = {
  "قيد الانتظار": "جاري المتابعة",
  "مكتمل": "مكتمل",
  "ملغي": "ملغي بسبب",
  // Identity mappings
  "مجدول": "مجدول",
  "جاري المتابعة": "جاري المتابعة",
  "انتظار الدفع": "انتظار الدفع",
  "ملغي بسبب": "ملغي بسبب",
};

const VALID_STAGES_SET = new Set(STAGES);
const VALID_SOURCES_SET = new Set(SOURCES);

/**
 * Map a raw stage value to the app's canonical stage.
 * Priority: AI stage_mapping > hardcoded STAGE_MAP > fallback
 */
export function mapStage(
  raw: string,
  aiStageMap?: Record<string, string>,
  fallback = "قيد التواصل"
): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // AI mapping takes priority
  if (aiStageMap?.[trimmed]) {
    const aiMapped = aiStageMap[trimmed];
    if (VALID_STAGES_SET.has(aiMapped as typeof STAGES[number])) return aiMapped;
  }

  // Hardcoded mapping (exact)
  const mapped = STAGE_MAP[trimmed];
  if (mapped) return mapped;

  // Already a valid stage?
  if (VALID_STAGES_SET.has(trimmed as typeof STAGES[number])) return trimmed;

  // Partial match: if the raw value contains or is contained in a valid stage
  const lower = trimmed.toLowerCase();
  for (const stage of STAGES) {
    if (stage.includes(lower) || lower.includes(stage)) return stage;
  }

  // Partial match in STAGE_MAP keys
  for (const [key, value] of Object.entries(STAGE_MAP)) {
    if (key.includes(lower) || lower.includes(key)) return value;
  }

  return fallback;
}

/**
 * Map a raw source value to the app's canonical source.
 */
export function mapSource(raw: string, fallback = "اخرى"): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  const mapped = SOURCE_MAP[trimmed];
  if (mapped) return mapped;

  if (VALID_SOURCES_SET.has(trimmed as typeof SOURCES[number])) return trimmed;

  return fallback;
}

/**
 * Map a raw renewal status to the app's canonical renewal status.
 */
export function mapRenewalStatus(raw: string, fallback = "مجدول"): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  const mapped = RENEWAL_STATUS_MAP[trimmed];
  if (mapped) return mapped;

  return fallback;
}
