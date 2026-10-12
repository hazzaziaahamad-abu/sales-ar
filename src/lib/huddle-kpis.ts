// مؤشرات «الفريق اليوم» التلقائية — تُقرأ من اللوحة بدون ما يكتب الموظف أي رقم:
// - المتابعات: عدد العملاء المختلفين اللي كتب عنهم الموظف في «سجل المتابعة» (صفقة/تجديد/تذكرة) خلال اليوم.
// - الإغلاقات: صفقات «مكتملة» باسم الموظف خلال الشهر (هدف شهري + المطلوب اليوم).
// - المساعدة في الإغلاق: صفقة مقفلة باسم غيره وله ملاحظة في سجل متابعتها (مثل تحويل الدعم لمنال).
// - تذاكر مفتوحة / صفقات متقدمة بدون متابعة / تجديدات متأخرة: لقطة «الآن» والهدف صفر.
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/supabase/db";
import { saudiDateStr } from "@/lib/utils/format";
import { HOT_STAGES } from "@/lib/team-reminders";

export type KpiKey =
  | "followups"
  | "openTickets"
  | "closes"
  | "closesValue"
  | "assists"
  | "renewalsPaid"
  | "renewalsValue"
  | "overdueRenewals"
  | "staleDeals";

export interface KpiDef {
  label: string;
  /** day = هدف يومي · month = هدف شهري (نعرض المطلوب اليوم) · now = لقطة حالية والأقل أفضل */
  period: "day" | "month" | "now";
  money?: boolean;
  hint: string;
}

export const KPI_DEFS: Record<KpiKey, KpiDef> = {
  followups: { label: "متابعات اليوم", period: "day", hint: "عملاء مختلفين كتبت عنهم في سجل المتابعة اليوم" },
  openTickets: { label: "تذاكر مفتوحة", period: "now", hint: "تذاكر الدعم المسندة لك ولم تُحل بعد" },
  closes: { label: "إغلاقات الشهر", period: "month", hint: "صفقات مكتملة باسمك هذا الشهر" },
  closesValue: { label: "مبيعات الشهر", period: "month", money: true, hint: "قيمة صفقاتك المكتملة هذا الشهر" },
  assists: { label: "ساعدت في إغلاق", period: "month", hint: "صفقات أقفلها زميل ولك ملاحظة في سجل متابعتها" },
  renewalsPaid: { label: "تجديدات محصّلة", period: "month", hint: "تجديدات مكتملة الدفع هذا الشهر" },
  renewalsValue: { label: "قيمة التجديدات", period: "month", money: true, hint: "قيمة التجديدات المحصّلة هذا الشهر" },
  overdueRenewals: { label: "تجديدات متأخرة بلا متابعة", period: "now", hint: "فات موعدها خلال آخر 30 يوم ولا متابعة لها من 3 أيام" },
  staleDeals: { label: "صفقات متقدمة بلا متابعة", period: "now", hint: "تفاوض/عرض/دفع/تجريبي/تجهيز بدون أي تحديث من 3 أيام" },
};

export interface MemberRole {
  title: string;
  /** الأسماء اللي تنحسب لهذا الكرت (اسم أول، عربي أو إنجليزي) — كرت عواطف يجمع فريق مبيعات المكتب. */
  names: string[];
  kpis: KpiKey[];
}

export const MEMBER_ROLES: Record<string, MemberRole> = {
  علي: { title: "واتس الدعم · دعم + مبيعات", names: ["علي"], kpis: ["followups", "openTickets", "closes", "closesValue", "staleDeals"] },
  مريم: { title: "واتس الدعم · دعم + مبيعات", names: ["مريم"], kpis: ["followups", "openTickets", "closes", "closesValue", "staleDeals"] },
  تغريد: { title: "التجديدات", names: ["تغريد"], kpis: ["followups", "renewalsPaid", "renewalsValue", "overdueRenewals"] },
  منال: { title: "مبيعات بالاتصال · مساعدة إغلاق", names: ["منال", "manal"], kpis: ["followups", "assists", "closes", "staleDeals"] },
  عواطف: { title: "مبيعات المكتب (عواطف + هنا)", names: ["عواطف", "هنا"], kpis: ["followups", "closes", "closesValue", "staleDeals"] },
};

export type KpiTargets = Record<string, Partial<Record<KpiKey, number>>>;

/** أرقام مبدئية مبنية على متوسط آخر 30 يوم — يعدّلها المدير من «أهداف الفريق». */
export const DEFAULT_KPI_TARGETS: KpiTargets = {
  علي: { followups: 25, openTickets: 0, closes: 20, closesValue: 10000, staleDeals: 0 },
  مريم: { followups: 12, openTickets: 0, closes: 8, closesValue: 3000, staleDeals: 0 },
  تغريد: { followups: 15, renewalsPaid: 35, renewalsValue: 10000, overdueRenewals: 0 },
  منال: { followups: 12, assists: 10, closes: 3, staleDeals: 0 },
  عواطف: { followups: 20, closes: 25, closesValue: 10000, staleDeals: 0 },
};

export function targetOf(targets: KpiTargets, member: string, key: KpiKey): number {
  return targets[member]?.[key] ?? DEFAULT_KPI_TARGETS[member]?.[key] ?? 0;
}

const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";

/** أي كرت في المتابعة اليومية يخص هذا الاسم؟ */
export function memberOf(name?: string | null): string | null {
  const f = firstName(name);
  if (!f) return null;
  for (const [member, role] of Object.entries(MEMBER_ROLES)) {
    if (role.names.some((n) => n.toLowerCase() === f)) return member;
  }
  return null;
}

export interface ClosedDealInfo {
  id: string;
  client_name: string;
  deal_value: number;
  day: string;
  owner: string | null;
  /** كروت أخرى ساعدت (كتبت في سجل متابعة الصفقة) */
  helpers: string[];
}

export interface MemberKpis {
  /** المتابعات لكل يوم في نطاق الجلب (YYYY-MM-DD → عدد العملاء) */
  followupsByDay: Record<string, number>;
  values: Record<KpiKey, number>;
  /** إغلاقات اليوم المحدد */
  closesToday: number;
  /** صفقاته المقفلة هذا الشهر اللي ساعده فيها زميل: اسم الزميل → عدد */
  helpedBy: Record<string, number>;
  resolvedToday: number;
}

export interface HuddleKpis {
  date: string;
  monthStart: string;
  daysInMonth: number;
  dayOfMonth: number;
  members: Record<string, MemberKpis>;
  closedDeals: ClosedDealInfo[];
}

const DAY_MS = 86400000;
const startIso = (day: string) => new Date(`${day}T00:00:00+03:00`).toISOString();
const endIso = (day: string) => new Date(new Date(`${day}T00:00:00+03:00`).getTime() + DAY_MS).toISOString();
const saudiDay = (iso: string) => saudiDateStr(new Date(iso));
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** يجلب كل الصفوف على دفعات (حد Supabase الافتراضي 1000 صف). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

async function notesFor(ids: string[], since?: string): Promise<{ entity_id: string; author_name: string | null; created_at: string }[]> {
  const supabase = createClient();
  const orgId = getOrgId();
  const out: { entity_id: string; author_name: string | null; created_at: string }[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    let q = supabase.from("follow_up_notes").select("entity_id, author_name, created_at").eq("org_id", orgId).in("entity_id", ids.slice(i, i + 150));
    if (since) q = q.gte("created_at", since);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as typeof out));
  }
  return out;
}

/**
 * كل مؤشرات المتابعة اليومية ليوم محدد.
 * @param fromDay أول يوم نحتاج متابعاته (بداية الأسبوع أو أمس) — لعرض أمس ولوحة الأسبوع.
 */
export async function fetchHuddleKpis(date: string, fromDay: string): Promise<HuddleKpis> {
  const supabase = createClient();
  const orgId = getOrgId();
  const monthStart = `${date.slice(0, 8)}01`;
  const [y, m] = date.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dayOfMonth = Number(date.slice(8, 10));
  const closedFrom = [monthStart, addDays(date, -1)].sort()[0];
  const staleSince = new Date(Date.now() - 3 * DAY_MS).toISOString();

  const [notes, closed, tickets, renewalsPaid, overdue, hot] = await Promise.all([
    fetchAll<{ author_name: string | null; entity_id: string; created_at: string }>(() =>
      supabase.from("follow_up_notes").select("author_name, entity_id, created_at").eq("org_id", orgId)
        .gte("created_at", startIso(fromDay)).lt("created_at", endIso(date)).order("created_at")
    ),
    fetchAll<{ id: string; client_name: string; deal_value: number; close_date: string; assigned_rep_name: string | null }>(() =>
      supabase.from("deals").select("id, client_name, deal_value, close_date, assigned_rep_name").eq("org_id", orgId)
        .eq("stage", "مكتملة").gte("close_date", startIso(closedFrom)).lt("close_date", endIso(date)).order("close_date")
    ),
    fetchAll<{ assigned_agent_name: string | null; status: string; resolved_date: string | null }>(() =>
      supabase.from("tickets").select("assigned_agent_name, status, resolved_date").eq("org_id", orgId)
        .or(`status.neq.محلول,resolved_date.eq.${date}`).order("id")
    ),
    fetchAll<{ assigned_rep: string | null; plan_price: number }>(() =>
      supabase.from("renewals").select("assigned_rep, plan_price").eq("org_id", orgId).eq("status", "مكتمل")
        .gte("payment_date", startIso(monthStart)).lt("payment_date", endIso(date)).order("id")
    ),
    fetchAll<{ id: string; assigned_rep: string | null; updated_at: string }>(() =>
      supabase.from("renewals").select("id, assigned_rep, updated_at").eq("org_id", orgId)
        .gte("renewal_date", addDays(saudiDateStr(), -30)).lt("renewal_date", saudiDateStr())
        .not("status", "in", '("مكتمل","ملغي بسبب","إيقاف مؤقت")').order("id")
    ),
    fetchAll<{ id: string; assigned_rep_name: string | null; updated_at: string }>(() =>
      supabase.from("deals").select("id, assigned_rep_name, updated_at").eq("org_id", orgId)
        .in("stage", HOT_STAGES).gte("deal_date", addDays(saudiDateStr(), -60)).order("id")
    ),
  ]);

  // ملاحظات على الصفقات المقفلة (أي وقت) لمعرفة من ساعد، وملاحظات آخر 3 أيام للصفقات/التجديدات المهملة.
  const staleCandidates = [...hot, ...overdue].filter((r) => r.updated_at < staleSince).map((r) => r.id);
  const [closedNotes, recentNotes] = await Promise.all([
    notesFor(closed.map((d) => d.id)),
    notesFor(staleCandidates, staleSince),
  ]);
  const recentlyNoted = new Set(recentNotes.map((n) => n.entity_id));
  const isStale = (r: { id: string; updated_at: string }) => r.updated_at < staleSince && !recentlyNoted.has(r.id);

  const members: Record<string, MemberKpis> = {};
  for (const name of Object.keys(MEMBER_ROLES)) {
    members[name] = {
      followupsByDay: {},
      values: Object.fromEntries(Object.keys(KPI_DEFS).map((k) => [k, 0])) as Record<KpiKey, number>,
      closesToday: 0,
      helpedBy: {},
      resolvedToday: 0,
    };
  }

  // المتابعات: عملاء مختلفين لكل موظف لكل يوم
  const seen = new Set<string>();
  for (const n of notes) {
    const member = memberOf(n.author_name);
    if (!member) continue;
    const day = saudiDay(n.created_at);
    const k = `${member}|${day}|${n.entity_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    members[member].followupsByDay[day] = (members[member].followupsByDay[day] ?? 0) + 1;
  }
  for (const name of Object.keys(members)) members[name].values.followups = members[name].followupsByDay[date] ?? 0;

  // الإغلاقات + المساعدة
  const helpersByDeal = new Map<string, Set<string>>();
  for (const n of closedNotes) {
    const member = memberOf(n.author_name);
    if (!member) continue;
    if (!helpersByDeal.has(n.entity_id)) helpersByDeal.set(n.entity_id, new Set());
    helpersByDeal.get(n.entity_id)!.add(member);
  }
  const closedDeals: ClosedDealInfo[] = closed.map((d) => {
    const owner = memberOf(d.assigned_rep_name);
    return {
      id: d.id,
      client_name: d.client_name,
      deal_value: Number(d.deal_value) || 0,
      day: saudiDay(d.close_date),
      owner,
      helpers: [...(helpersByDeal.get(d.id) ?? [])].filter((h) => h !== owner),
    };
  });
  for (const d of closedDeals) {
    const inMonth = d.day >= monthStart && d.day <= date;
    if (d.owner && inMonth) {
      members[d.owner].values.closes += 1;
      members[d.owner].values.closesValue += d.deal_value;
      for (const h of d.helpers) members[d.owner].helpedBy[h] = (members[d.owner].helpedBy[h] ?? 0) + 1;
    }
    if (d.owner && d.day === date) members[d.owner].closesToday += 1;
    if (inMonth) for (const h of d.helpers) members[h].values.assists += 1;
  }

  for (const t of tickets) {
    const member = memberOf(t.assigned_agent_name);
    if (!member) continue;
    if (t.status !== "محلول") members[member].values.openTickets += 1;
    else if (t.resolved_date === date) members[member].resolvedToday += 1;
  }

  for (const r of renewalsPaid) {
    const member = memberOf(r.assigned_rep);
    if (!member) continue;
    members[member].values.renewalsPaid += 1;
    members[member].values.renewalsValue += Number(r.plan_price) || 0;
  }
  for (const r of overdue) {
    const member = memberOf(r.assigned_rep);
    if (member && isStale(r)) members[member].values.overdueRenewals += 1;
  }
  for (const d of hot) {
    const member = memberOf(d.assigned_rep_name);
    if (member && isStale(d)) members[member].values.staleDeals += 1;
  }

  return { date, monthStart, daysInMonth, dayOfMonth, members, closedDeals };
}

/** حالة المؤشر مقابل هدفه: نسبة التقدم، وهل هو على المسار، والمطلوب اليوم للمؤشرات الشهرية. */
export function kpiStatus(def: KpiDef, value: number, target: number, k: Pick<HuddleKpis, "daysInMonth" | "dayOfMonth">) {
  if (def.period === "now") {
    return { pct: value <= target ? 100 : Math.max(0, 100 - (value - target) * 10), ok: value <= target, needToday: null as number | null };
  }
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 100;
  if (def.period === "day") return { pct, ok: value >= target, needToday: null as number | null };
  // شهري: على المسار إذا المحقق ≥ نصيب الأيام اللي مضت
  const expected = (target * k.dayOfMonth) / k.daysInMonth;
  const remainingDays = k.daysInMonth - k.dayOfMonth + 1;
  const needToday = value >= target ? 0 : Math.ceil((target - value) / remainingDays);
  return { pct, ok: value >= expected, needToday };
}
