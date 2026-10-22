// «غرفة التخطيط والتنفيذ»: المراحل ودليل آلية العميل والأنواع — مشتركة بين الواجهة ومسارات الـ API.

import { KPIS, type KpiDef, type KpiKey } from "@/lib/salon-growth";

export type Stage = "lead" | "discovery" | "diagnosis" | "proposal" | "onboarding" | "execution" | "review" | "done" | "paused";
export type Health = "on_track" | "at_risk" | "off_track";
export type LogKind = "note" | "checkin" | "meeting" | "stage" | "contact";
export type LeadStatus = "new" | "contacted" | "interested" | "meeting" | "not_interested";
export type Priority = "A" | "B" | "C";

export type RoomClient = {
  id: string; salon_name: string; owner_name: string | null; phone: string | null; city: string | null;
  consultant: string | null; stage: Stage; health: Health; start_date: string | null; next_review: string | null;
  contract_value: number | null; baseline: Partial<Record<KpiKey, number | null>>; current: Partial<Record<KpiKey, number | null>>;
  goals: { kpi: KpiKey | ""; target: number | null }[]; notes: string; archived: boolean; created_at: string; updated_at: string;
  // الاستهداف (قبل ما يصير عميل)
  source: string | null; priority: Priority; segment: string | null; lead_status: LeadStatus;
  last_contact_at: string | null; next_followup: string | null; converted_at: string | null; contracted_at: string | null;
};
export type RoomTask = {
  id: string; client_id: string; phase: Stage; title: string; due_date: string | null; assignee: string | null;
  done_at: string | null; done_by: string | null; custom: boolean; sort_order: number;
};
export type RoomLog = { id: string; client_id: string; kind: LogKind; body: string; author: string | null; created_at: string };
export type TeamMember = { id: string; name: string; role: string; phone: string | null; active: boolean };

export const CLIENT_COLS = "id, salon_name, owner_name, phone, city, consultant, stage, health, start_date, next_review, contract_value, baseline, current, goals, notes, archived, created_at, updated_at, source, priority, segment, lead_status, last_contact_at, next_followup, converted_at, contracted_at";
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

export const LOG_KINDS: Record<LogKind, string> = { note: "ملاحظة", checkin: "متابعة أسبوعية", meeting: "اجتماع", stage: "تغيير مرحلة", contact: "محاولة تواصل" };

/* ──────────────────────────── خطة الاستهداف ──────────────────────────── */

export const LEAD_STATUSES: { id: LeadStatus; label: string; color: string }[] = [
  { id: "new", label: "جديد", color: "#7A6570" },
  { id: "contacted", label: "تم التواصل", color: "#3B82F6" },
  { id: "interested", label: "مهتم", color: "#D9A21B" },
  { id: "meeting", label: "اجتماع محجوز", color: "#16A34A" },
  { id: "not_interested", label: "غير مهتم", color: "#DC2626" },
];
export const LEAD_STATUS_IDS = LEAD_STATUSES.map((x) => x.id);
export const leadStatusMeta = (s: LeadStatus) => LEAD_STATUSES.find((x) => x.id === s) ?? LEAD_STATUSES[0];

export const PRIORITIES: Record<Priority, { label: string; hint: string }> = {
  A: { label: "أ", hint: "أولوية عالية — صالون مزدحم وفرصة واضحة" },
  B: { label: "ب", hint: "أولوية متوسطة" },
  C: { label: "ج", hint: "أولوية منخفضة — للمتابعة لاحقاً" },
};
export const SOURCES = ["إنستقرام", "قوقل ماب", "إحالة", "زيارة ميدانية", "عميل نحجز", "معرض / فعالية", "أخرى"];
export const SEGMENTS = ["صغير (١–٣ كراسي)", "متوسط (٤–٨ كراسي)", "كبير (+٨ كراسي)", "سبا / مركز تجميل"];

export type Targets = { contacts: number; meetings: number; contracts: number };
export const DEFAULT_TARGETS: Targets = { contacts: 30, meetings: 5, contracts: 2 };

/** بداية أسبوع العمل (الأحد) بتوقيت الجهاز. */
export function weekStart(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

/** دليل آلية العميل — يُنسخ كمهام لكل عميل جديد. */
export const PLAYBOOK: { stage: Stage; from: number; to: number; duration: string; goal: string; tasks: string[]; deliverable: string; tip: string }[] = [
  {
    stage: "discovery", from: 0, to: 5, duration: "٢–٥ أيام", goal: "تأهيل الصالون وتجهيز اجتماع التشخيص",
    tasks: [
      "أول تواصل مع المالكة وتحديد موعد الاجتماع في الصالون",
      "إرسال رسالة طلب البيانات (٧ بنود)",
      "مراجعة قوقل ماب وإنستقرام: التقييم، المراجعات، التفاعل",
      "استلام المبيعات الشهرية وقائمة العميلات",
    ],
    deliverable: "موعد مؤكد + البيانات الأساسية", tip: "لو ما عندهم بيانات أبداً — اتفقوا على أسبوعين تسجيل يدوي قبل الاجتماع.",
  },
  {
    stage: "diagnosis", from: 5, to: 10, duration: "اجتماع ٦٠–٩٠ دقيقة", goal: "تشخيص وين يضيع الدخل + خط أساس نقيس عليه",
    tasks: [
      "زيارة الصالون وتقييم الاستقبال (٥ بنود) — راقب ولا تسأل",
      "مناقشة المحاور السبعة مع المالكة وتدوين الإجابات",
      "تعبئة بطاقة خط الأساس وتعليم الأرقام التقديرية",
      "فحص علامات التريّث (توقعات، فريق، بيانات)",
    ],
    deliverable: "بطاقة خط أساس معتمدة من المالكة", tip: "الرقم التقديري يتصحّح أول شهر — المقارنة على رقم غلط تهدم المصداقية.",
  },
  {
    stage: "proposal", from: 10, to: 17, duration: "٣–٧ أيام", goal: "الاتفاق على الأهداف وتوقيع العقد",
    tasks: [
      "تحديد ٣ أهداف لـ ٩٠ يوم من بطاقة الأساس",
      "اختيار الفوز السريع لأول أسبوعين",
      "إرسال العرض والسعر للمالكة",
      "توقيع العقد وتحديد تاريخ البداية",
    ],
    deliverable: "عقد موقّع + أهداف متفق عليها", tip: "اربط كل هدف بمؤشر من البطاقة وبرقم — «نرفع الفاتورة» مو هدف، «من ٣٠٠ إلى ٣٥٠» هدف.",
  },
  {
    stage: "onboarding", from: 17, to: 31, duration: "أسبوع ١–٢", goal: "تشغيل الأساسيات وتحقيق أول نتيجة سريعة",
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
    stage: "execution", from: 31, to: 121, duration: "٩٠ يوم", goal: "تنفيذ المفاتيح الأربعة ومتابعة الأرقام",
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
    stage: "review", from: 121, to: 128, duration: "أسبوع ١٣", goal: "إثبات النتائج وتحويلها لتجديد",
    tasks: [
      "قياس المؤشرات وتعبئة «الحالي» في بطاقة العميل",
      "إعداد تقرير «قبل/بعد» للمالكة",
      "اجتماع المراجعة: النتائج والدروس",
      "عرض التجديد أو المرحلة التالية",
    ],
    deliverable: "تقرير قبل/بعد + قرار التجديد", tip: "ابدأ التقرير بأكبر رقم تحسّن — وبعدها المؤشر اللي ما تحرّك وخطته.",
  },
];

/* ──────────────────────────── خطة التنفيذ ──────────────────────────── */

const DAY = 86_400_000;
const parseKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
export function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const addDays = (key: string, n: number) => dayKey(parseKey(key) + n * DAY + 12 * 3_600_000);

/** نافذة كل مرحلة بالتواريخ انطلاقاً من تاريخ البداية. */
export function phaseWindows(start: string) {
  return PLAYBOOK.map((p) => ({ stage: p.stage, from: addDays(start, p.from), to: addDays(start, p.to) }));
}

/** تواريخ استحقاق المهام: مهام كل مرحلة تتوزّع بالتساوي على نافذتها. */
export function planDueDates(start: string, tasks: Pick<RoomTask, "id" | "phase" | "sort_order">[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of PLAYBOOK) {
    const list = tasks.filter((t) => t.phase === p.stage).sort((a, b) => a.sort_order - b.sort_order);
    const span = p.to - p.from;
    list.forEach((t, i) => out.set(t.id, addDays(start, p.from + Math.max(1, Math.round(((i + 1) * span) / list.length)))));
  }
  return out;
}

/** المؤشرات الأساسية اللي يتابعها المستشار لكل صالون. */
export const ROOM_KPI_KEYS: KpiKey[] = [
  "revenue", "aov", "active_clients", "sleeping_count", "return90", "upsell_rate", "noshow_rate", "members", "google_rating", "reception_score",
];
export const ROOM_KPIS: KpiDef[] = ROOM_KPI_KEYS.map((k) => KPIS.find((x) => x.key === k)!);

export const ROOM_COOKIE = "salon_room";
export const ROOM_MIN_CODE = 6;
