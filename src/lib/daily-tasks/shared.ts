// «مهام اليوم» — منطق مشترك (عميل + خادم). لا يستورد أي عميل Supabase.

export type Department = "office" | "support" | "renewals";
export const DEPARTMENTS: Department[] = ["office", "support", "renewals"];
export const DEPT_LABEL: Record<Department, string> = { office: "مبيعات المكتب", support: "مبيعات الدعم", renewals: "التجديدات" };
export const DEPT_PAGE: Record<Department, string> = { office: "/sales", support: "/support-sales", renewals: "/renewals" };

export interface DeptMember { user_id: string; name: string; sales_type?: "office" | "support" }
export type DeptMembers = Partial<Record<Department, DeptMember[]>>;

export interface ActivityTargets { prospect: number; meetings: number }
export interface DailySettings {
  workDays: number[];
  queueCap: number;
  speed: { fast: number; normal: number; slow: number };
  activity: Record<Department, ActivityTargets>;
  members: DeptMembers;
}

export const DEFAULT_SETTINGS: DailySettings = {
  workDays: [0, 1, 2, 3, 4, 5, 6],
  queueCap: 40,
  speed: { fast: 3, normal: 10, slow: 20 },
  activity: {
    office: { prospect: 30, meetings: 2 },
    support: { prospect: 0, meetings: 1 },
    renewals: { prospect: 0, meetings: 0 },
  },
  members: {},
};

/** مفاتيح sales_guide_settings */
export const SETTING_KEYS = {
  workDays: "daily_work_days",
  queueCap: "daily_queue_cap",
  speed: "deal_speed_thresholds",
  activity: "daily_activity_targets",
  members: "dept_members",
} as const;

export function parseSettings(rows: { setting_key: string; setting_value: unknown }[]): DailySettings {
  const get = (k: string) => rows.find((r) => r.setting_key === k)?.setting_value;
  const s: DailySettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  const wd = get(SETTING_KEYS.workDays);
  if (Array.isArray(wd)) s.workDays = wd.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const cap = Number(get(SETTING_KEYS.queueCap));
  if (Number.isFinite(cap) && cap > 0) s.queueCap = cap;
  const sp = get(SETTING_KEYS.speed) as Partial<DailySettings["speed"]> | undefined;
  if (sp && typeof sp === "object") s.speed = { ...s.speed, ...sp };
  const act = get(SETTING_KEYS.activity) as Partial<Record<Department, ActivityTargets>> | undefined;
  if (act && typeof act === "object") for (const d of DEPARTMENTS) if (act[d]) s.activity[d] = { ...s.activity[d], ...act[d] };
  const mem = get(SETTING_KEYS.members);
  if (mem && typeof mem === "object") s.members = mem as DeptMembers;
  return s;
}

/** أقسام المستخدم حسب التوزيع. */
export function departmentsOf(userId: string, members: DeptMembers): Department[] {
  return DEPARTMENTS.filter((d) => (members[d] ?? []).some((m) => m.user_id === userId));
}

// ─── التاريخ بتوقيت الرياض ───────────────────────────────────────────────
const RIYADH_MS = 3 * 3600000;
export function riyadhDate(d = new Date()): string {
  return new Date(d.getTime() + RIYADH_MS).toISOString().slice(0, 10);
}
export function riyadhPeriod(d = new Date()): string {
  return riyadhDate(d).slice(0, 7);
}
const dow = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

/** أيام العمل في الشهر: الكل، المنقضي (قبل اليوم)، والمتبقي (من اليوم). */
export function monthWorkdays(workDays: number[], today = riyadhDate()) {
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let total = 0, elapsed = 0, remaining = 0;
  for (let day = 1; day <= last; day++) {
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!workDays.includes(dow(ymd))) continue;
    total++;
    if (ymd < today) elapsed++; else remaining++;
  }
  return { total, elapsed, remaining: Math.max(1, remaining) };
}

// ─── الطابور ─────────────────────────────────────────────────────────────
/** مراحل الصفقة المغلقة — لا تدخل الطابور. */
export const CLOSED_DEAL_STAGES = ["مكتملة", "مرفوض مع سبب", "استهداف خاطئ", "كنسل التجربة", "غير مهتم", "غير متجاوب"];
/** المراحل المفتوحة التي يقرأها الطابور، بترتيب الأولوية. */
export const QUEUE_DEAL_STAGES = ["انتظار الدفع", "تجريبي", "تفاوض", "تم إرسال العرض", "تجهيز", "قيد التواصل", "عميل جديد", "تاجيل", "اعادة الاتصال في وقت اخر"];
export const OPEN_RENEWAL_STATUSES = ["انتظار الدفع", "جاري المتابعة", "مجدول تجديد", "مجدول", "مؤجل مؤقتاً"];
const RENEWAL_RANK: Record<string, number> = { "انتظار الدفع": 0, "جاري المتابعة": 2, "مجدول تجديد": 3, "مجدول": 4, "مؤجل مؤقتاً": 5 };

/** أيام بدون تحديث قبل ما تصير الصفقة مستحقة (نفس قاعدة «متابعة عاجلة»). */
export const STALE_DAYS = 3;
/** التجديد يدخل الطابور لو موعده خلال هذه الأيام أو فات. */
export const RENEWAL_WINDOW_DAYS = 7;

export type Speed = "fast" | "normal" | "slow" | "stalled";
export const SPEED_LABEL: Record<Speed, string> = { fast: "سريعة", normal: "طبيعية", slow: "بطيئة", stalled: "متعثرة" };
export function speedOf(ageDays: number, t: DailySettings["speed"]): Speed {
  if (ageDays <= t.fast) return "fast";
  if (ageDays <= t.normal) return "normal";
  if (ageDays <= t.slow) return "slow";
  return "stalled";
}

export interface QueueItem {
  key: string;                         // deal:<id> | renewal:<id>
  entityType: "deal" | "renewal";
  id: string;
  department: Department;
  name: string;
  phone?: string;
  stage: string;
  value: number;
  /** أيام التأخير (0 = مستحق اليوم) */
  lateDays: number;
  dueReason: "callback" | "stale" | "renewal_date" | "status";
  lastNote?: string;
  ageDays: number;
  speed: Speed;
  rank: number;
}

export function stageRank(stage: string, ageDaysInStage = 0): number {
  if (stage === "تجريبي" && ageDaysInStage >= 12) return 1; // تجريبي قارب على الانتهاء
  const i = QUEUE_DEAL_STAGES.indexOf(stage);
  return i < 0 ? 99 : i + 1;
}
export const renewalRank = (status: string) => RENEWAL_RANK[status] ?? 6;

export function sortQueue(items: QueueItem[], priorityKeys: string[]): QueueItem[] {
  return [...items].sort((a, b) => {
    const pa = priorityKeys.includes(a.key) ? 0 : 1, pb = priorityKeys.includes(b.key) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.lateDays - a.lateDays;
  });
}

// ─── تسجيل النتيجة ───────────────────────────────────────────────────────
export type Outcome = "replied" | "no_answer" | "meeting_booked" | "meeting_held" | "offer_sent" | "paid" | "lost";
export interface OutcomeDef {
  key: Outcome;
  label: string;
  /** القيم المسموحة الحالية في sales_activities */
  activityType: "call" | "followup" | "meeting" | "quote" | "whatsapp";
  result: "positive" | "pending" | "no_answer" | "negative";
  /** الموعد التالي الافتراضي بالساعات (null = لا موعد) */
  nextHours: number | null;
}
export const OUTCOMES: OutcomeDef[] = [
  { key: "replied", label: "رد · متابعة غداً", activityType: "followup", result: "positive", nextHours: 24 },
  { key: "no_answer", label: "لا رد · بعد ساعتين", activityType: "call", result: "no_answer", nextHours: 2 },
  { key: "offer_sent", label: "أُرسل عرض · بعد ٢٤ س", activityType: "quote", result: "pending", nextHours: 24 },
  { key: "meeting_booked", label: "حجز اجتماع", activityType: "meeting", result: "pending", nextHours: 24 },
  { key: "meeting_held", label: "تم الاجتماع", activityType: "meeting", result: "positive", nextHours: 24 },
  { key: "paid", label: "دفع ✓", activityType: "followup", result: "positive", nextHours: null },
  { key: "lost", label: "خسارة", activityType: "followup", result: "negative", nextHours: null },
];
export const OUTCOME_LABEL: Record<Outcome, string> = Object.fromEntries(OUTCOMES.map((o) => [o.key, o.label.split(" · ")[0]])) as Record<Outcome, string>;

// ─── الأهداف ─────────────────────────────────────────────────────────────
export type TargetMethod = "history" | "pipeline" | "manual";
export interface TargetTriple { min: number; target: number; stretch: number }
export interface DeptBaseline {
  /** المبيعات المدفوعة لآخر الأشهر المكتملة [YYYY-MM, قيمة] */
  history: [string, number][];
  /** صفقات القائمة الآن لكل مرحلة ساخنة [المرحلة, العدد, نسبة تحويل افتراضية] */
  pipeline: [string, number, number][];
  /** متوسط قيمة الصفقة/الباقة المكتملة */
  avgValue: number;
  /** المحقق هذا الشهر للقسم ولكل موظف (بالاسم) */
  mtd: number;
  mtdByRep: Record<string, number>;
  /** متوسط الأرقام الجديدة يومياً آخر ٣٠ يوماً (للاستهداف) */
  newPerDay: number;
}

export const DEFAULT_PIPELINE_RATES: Record<string, number> = { "انتظار الدفع": 80, "تفاوض": 40, "تم إرسال العرض": 25, "تجريبي": 30 };

const r100 = (x: number) => Math.round(x / 100) * 100;

export function suggestFromHistory(b: DeptBaseline, growthPct: number): TargetTriple & { avg: number } {
  const vals = b.history.map((h) => h[1]);
  const avg = vals.length ? vals.reduce((a, c) => a + c, 0) / vals.length : 0;
  const best = vals.length ? Math.max(...vals) : 0;
  const t = avg * (1 + growthPct / 100);
  return { avg, min: r100(avg), target: r100(t), stretch: r100(Math.max(best, t * 1.25)) };
}

export function suggestFromPipeline(b: DeptBaseline, rates: number[]): TargetTriple & { closes: number } {
  const closes = b.pipeline.reduce((s, row, i) => s + row[1] * (rates[i] ?? row[2]) / 100, 0);
  const t = closes * b.avgValue;
  return { closes, min: r100(t * 0.8), target: r100(t), stretch: r100(t * 1.2) };
}

export interface DeptTargetRow {
  id?: string;
  department: Department;
  user_id: string | null;
  period: string;
  metric: "revenue" | "closes";
  min_value: number | null;
  target_value: number;
  stretch_value: number | null;
  share_pct: number | null;
  method: TargetMethod;
  basis?: unknown;
  approved_by_name?: string | null;
  approved_at?: string | null;
}

// ─── خطة اليوم ───────────────────────────────────────────────────────────
export interface PlanPriority { key: string; title: string }
export interface ExtraTask { id: string; text: string; done_at: string | null }
export interface DailyPlan {
  id: string;
  user_id: string;
  user_name: string;
  plan_date: string;
  departments: Department[];
  started_at: string;
  first_activity_at: string | null;
  last_activity_at: string | null;
  finished_at: string | null;
  priorities: PlanPriority[];
  extra_tasks: ExtraTask[];
  unfinished_reason: string | null;
  blocker_note: string | null;
  close_exceptions: { key: string; title: string }[];
  report: DailyReport | null;
}

export interface PlanActivity {
  id: string;
  created_at: string;
  entity_type: "deal" | "renewal" | null;
  deal_id: string | null;
  renewal_id: string | null;
  client_name: string | null;
  department: Department | null;
  outcome: Outcome | null;
  next_action_at: string | null;
}

export interface DailyReport {
  started_at: string;
  first_activity_at: string | null;
  last_activity_at: string | null;
  finished_at: string;
  gap_minutes: number | null;
  queue_total: number;
  queue_done: number;
  pending: { key: string; title: string }[];
  priorities_done: number;
  priorities_total: number;
  extras_done: number;
  extras_total: number;
  prospect_added: number;
  meetings_booked: number;
  meetings_held: number;
  paid_count: number;
  paid_amount: number;
  outcomes: Partial<Record<Outcome, number>>;
  by_department: Partial<Record<Department, { done: number; total: number }>>;
  unfinished_reason: string | null;
  blocker_note: string | null;
}

export function countOutcomes(acts: PlanActivity[]): Partial<Record<Outcome, number>> {
  const o: Partial<Record<Outcome, number>> = {};
  for (const a of acts) if (a.outcome) o[a.outcome] = (o[a.outcome] ?? 0) + 1;
  return o;
}

/** دقائق بين وقتين */
export const minutesBetween = (a: string | null, b: string | null) =>
  a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000) : null;

/** الرقم الدولي بدون مسافات (966…) والمحلي (05…). */
export function phoneFormats(raw?: string | null): { intl: string; local: string } | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05") && d.length === 10) d = "966" + d.slice(1);
  else if (d.startsWith("5") && d.length === 9) d = "966" + d;
  const local = d.startsWith("966") ? "0" + d.slice(3) : d;
  return { intl: d, local };
}
