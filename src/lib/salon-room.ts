// «غرفة التخطيط والتنفيذ»: المراحل ودليل آلية العميل والأنواع — مشتركة بين الواجهة ومسارات الـ API.

import { KPIS, type KpiDef, type KpiKey } from "@/lib/salon-growth";

export type Stage = "lead" | "discovery" | "diagnosis" | "proposal" | "onboarding" | "execution" | "review" | "done" | "paused";
export type Health = "on_track" | "at_risk" | "off_track";
export type LogKind = "note" | "checkin" | "meeting" | "stage";

export type RoomClient = {
  id: string; salon_name: string; owner_name: string | null; phone: string | null; city: string | null;
  consultant: string | null; stage: Stage; health: Health; start_date: string | null; next_review: string | null;
  contract_value: number | null; baseline: Partial<Record<KpiKey, number | null>>; current: Partial<Record<KpiKey, number | null>>;
  goals: { kpi: KpiKey | ""; target: number | null }[]; notes: string; archived: boolean; created_at: string; updated_at: string;
};
export type RoomTask = {
  id: string; client_id: string; phase: Stage; title: string; due_date: string | null; assignee: string | null;
  done_at: string | null; done_by: string | null; custom: boolean; sort_order: number;
};
export type RoomLog = { id: string; client_id: string; kind: LogKind; body: string; author: string | null; created_at: string };
export type TeamMember = { id: string; name: string; role: string; phone: string | null; active: boolean };

export const CLIENT_COLS = "id, salon_name, owner_name, phone, city, consultant, stage, health, start_date, next_review, contract_value, baseline, current, goals, notes, archived, created_at, updated_at";
export const TASK_COLS = "id, client_id, phase, title, due_date, assignee, done_at, done_by, custom, sort_order";
export const LOG_COLS = "id, client_id, kind, body, author, created_at";
export const TEAM_COLS = "id, name, role, phone, active";

export const STAGES: { id: Stage; label: string; short: string }[] = [
  { id: "lead", label: "مرشّح", short: "مرشّح" },
  { id: "discovery", label: "الاستكشاف", short: "استكشاف" },
  { id: "diagnosis", label: "التشخيص الأولي", short: "تشخيص" },
  { id: "proposal", label: "العرض والتعاقد", short: "تعاقد" },
  { id: "onboarding", label: "التأسيس", short: "تأسيس" },
  { id: "execution", label: "التنفيذ (٩٠ يوم)", short: "تنفيذ" },
  { id: "review", label: "المراجعة والتجديد", short: "مراجعة" },
  { id: "done", label: "مكتمل", short: "مكتمل" },
  { id: "paused", label: "متوقف", short: "متوقف" },
];
export const STAGE_IDS = STAGES.map((s) => s.id);
export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)?.label ?? s;
/** المراحل اللي لها مهام في دليل الآلية (بالترتيب). */
export const WORK_STAGES: Stage[] = ["discovery", "diagnosis", "proposal", "onboarding", "execution", "review"];

export const HEALTH: Record<Health, { label: string; color: string }> = {
  on_track: { label: "على المسار", color: "#16A34A" },
  at_risk: { label: "في خطر", color: "#D9A21B" },
  off_track: { label: "متعثّر", color: "#DC2626" },
};

export const LOG_KINDS: Record<LogKind, string> = { note: "ملاحظة", checkin: "متابعة أسبوعية", meeting: "اجتماع", stage: "تغيير مرحلة" };

/** دليل آلية العميل — يُنسخ كمهام لكل عميل جديد. */
export const PLAYBOOK: { stage: Stage; duration: string; goal: string; tasks: string[]; deliverable: string; tip: string }[] = [
  {
    stage: "discovery", duration: "٢–٥ أيام", goal: "تأهيل الصالون وتجهيز اجتماع التشخيص",
    tasks: [
      "أول تواصل مع المالكة وتحديد موعد الاجتماع في الصالون",
      "إرسال رسالة طلب البيانات (٧ بنود)",
      "مراجعة قوقل ماب وإنستقرام: التقييم، المراجعات، التفاعل",
      "استلام المبيعات الشهرية وقائمة العميلات",
    ],
    deliverable: "موعد مؤكد + البيانات الأساسية", tip: "لو ما عندهم بيانات أبداً — اتفقوا على أسبوعين تسجيل يدوي قبل الاجتماع.",
  },
  {
    stage: "diagnosis", duration: "اجتماع ٦٠–٩٠ دقيقة", goal: "تشخيص وين يضيع الدخل + خط أساس نقيس عليه",
    tasks: [
      "زيارة الصالون وتقييم الاستقبال (٥ بنود) — راقب ولا تسأل",
      "مناقشة المحاور السبعة مع المالكة وتدوين الإجابات",
      "تعبئة بطاقة خط الأساس وتعليم الأرقام التقديرية",
      "فحص علامات التريّث (توقعات، فريق، بيانات)",
    ],
    deliverable: "بطاقة خط أساس معتمدة من المالكة", tip: "الرقم التقديري يتصحّح أول شهر — المقارنة على رقم غلط تهدم المصداقية.",
  },
  {
    stage: "proposal", duration: "٣–٧ أيام", goal: "الاتفاق على الأهداف وتوقيع العقد",
    tasks: [
      "تحديد ٣ أهداف لـ ٩٠ يوم من بطاقة الأساس",
      "اختيار الفوز السريع لأول أسبوعين",
      "إرسال العرض والسعر للمالكة",
      "توقيع العقد وتحديد تاريخ البداية",
    ],
    deliverable: "عقد موقّع + أهداف متفق عليها", tip: "اربط كل هدف بمؤشر من البطاقة وبرقم — «نرفع الفاتورة» مو هدف، «من ٣٠٠ إلى ٣٥٠» هدف.",
  },
  {
    stage: "onboarding", duration: "أسبوع ١–٢", goal: "تشغيل الأساسيات وتحقيق أول نتيجة سريعة",
    tasks: [
      "تفعيل الحجز والتذكير بالواتساب",
      "تدريب الاستقبال على بروتوكول الـ ٣ دقائق",
      "تدريب الخبيرات على استشارة الـ ٥ دقائق وقائمة الإضافات",
      "اعتماد عمولة البيع الإضافي مع المالكة",
      "إطلاق حملة استرجاع العميلات النائمات (الفوز السريع)",
      "تجهيز باقات العضوية (رصيد ذهبي / شهري / عروس)",
    ],
    deliverable: "النظام شغّال + أول نتيجة قابلة للقياس", tip: "بدون عمولة على الإضافات ما فيه بيع إضافي — ثبّتها قبل التدريب.",
  },
  {
    stage: "execution", duration: "٩٠ يوم", goal: "تنفيذ المفاتيح الأربعة ومتابعة الأرقام",
    tasks: [
      "متابعة أسبوعية: الحجوزات، الإضافات، الرسائل، النائمات",
      "مراجعة الشهر الأول مع المالكة",
      "مراجعة الشهر الثاني + تصحيح المسار",
      "تفعيل العضويات ومتابعة المشتركات",
      "جمع مراجعات قوقل من العميلات الراضيات",
    ],
    deliverable: "تقرير شهري مختصر لكل شهر", tip: "سجّل كل متابعة في السجل — هي اللي تبني تقرير «قبل/بعد» آخر الرحلة.",
  },
  {
    stage: "review", duration: "أسبوع ١٣", goal: "إثبات النتائج وتحويلها لتجديد",
    tasks: [
      "قياس المؤشرات وتعبئة «الحالي» في بطاقة العميل",
      "إعداد تقرير «قبل/بعد» للمالكة",
      "اجتماع المراجعة: النتائج والدروس",
      "عرض التجديد أو المرحلة التالية",
    ],
    deliverable: "تقرير قبل/بعد + قرار التجديد", tip: "ابدأ التقرير بأكبر رقم تحسّن — وبعدها المؤشر اللي ما تحرّك وخطته.",
  },
];

/** المؤشرات الأساسية اللي يتابعها المستشار لكل صالون. */
export const ROOM_KPI_KEYS: KpiKey[] = [
  "revenue", "aov", "active_clients", "sleeping_count", "return90", "upsell_rate", "noshow_rate", "members", "google_rating", "reception_score",
];
export const ROOM_KPIS: KpiDef[] = ROOM_KPI_KEYS.map((k) => KPIS.find((x) => x.key === k)!);

export const ROOM_COOKIE = "salon_room";
export const ROOM_MIN_CODE = 6;
