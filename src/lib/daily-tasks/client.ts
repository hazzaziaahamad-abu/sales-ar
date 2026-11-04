"use client";
// «مهام اليوم» — جلب البيانات من العميل. يعيد استخدام محرّك «متابعة عاجلة» وسجل المتابعة الحالي.
import { createClient } from "@/lib/supabase/client";
import { createFollowUpNote, fetchRenewals, getOrgId, updateDeal } from "@/lib/supabase/db";
import { fetchUrgentDeals } from "@/lib/urgent-followup";
import {
  OPEN_RENEWAL_STATUSES, OUTCOMES, QUEUE_DEAL_STAGES, RENEWAL_WINDOW_DAYS, STALE_DAYS,
  renewalRank, riyadhDate, speedOf, stageRank,
  type DailyPlan, type Department, type DeptMember, type Outcome, type PlanActivity, type QueueItem, type DailySettings,
} from "./shared";

export interface DailyState {
  me: { id: string; name: string; isManager: boolean; viewingAs: boolean };
  orgId: string;
  date: string;
  period: string;
  workdays: { total: number; elapsed: number; remaining: number };
  settings: Pick<DailySettings, "queueCap" | "speed" | "activity" | "members">;
  departments: Department[];
  plan: DailyPlan | null;
  activities: PlanActivity[];
  targets: { department: Department; user_id: string | null; min_value: number | null; target_value: number; stretch_value: number | null; share_pct: number | null; method: string; approved_at: string | null }[];
  mtd: Partial<Record<Department, { dept: number; mine: number }>>;
  prospectToday: number;
  meetingsToday: PlanActivity[];
  review: { note: string; by_name: string; at: string } | null;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "تعذّر الاتصال");
  return data as T;
}

export const fetchDailyState = (as?: string | null) =>
  api<DailyState>(`/api/daily-tasks${as ? `?as=${encodeURIComponent(as)}` : ""}`, { cache: "no-store" });

export const postDaily = <T = { plan: DailyPlan }>(body: Record<string, unknown>) =>
  api<T>("/api/daily-tasks", { method: "POST", body: JSON.stringify(body) });

const DAY = 86400000;
const daysSince = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY)) : 0);

/** نهاية اليوم بتوقيت الرياض */
function endOfTodayRiyadh(): number {
  return new Date(`${riyadhDate()}T23:59:59+03:00`).getTime();
}

async function latestNotes(entityType: "deal" | "renewal", ids: string[]) {
  const out = new Map<string, { note: string; created_at: string }>();
  const supabase = createClient();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from("follow_up_notes").select("entity_id, note, created_at")
      .eq("org_id", getOrgId()).eq("entity_type", entityType).in("entity_id", ids.slice(i, i + 150))
      .order("created_at", { ascending: false });
    for (const n of (data ?? []) as { entity_id: string; note: string; created_at: string }[]) if (!out.has(n.entity_id)) out.set(n.entity_id, n);
  }
  return out;
}

/** يبني طابور المراجعة للموظف من الصفقات والتجديدات المسندة له.
 *  all = كل المفتوح المسند له (للمدير)، وليس المستحق اليوم فقط. */
export async function loadQueue(state: DailyState, opts?: { all?: boolean }): Promise<QueueItem[]> {
  const all = !!opts?.all;
  const name = state.me.name.trim();
  const speed = state.settings.speed;
  const items: QueueItem[] = [];
  const eod = endOfTodayRiyadh();

  for (const dept of state.departments.filter((d): d is "office" | "support" => d !== "renewals")) {
    const urgent = await fetchUrgentDeals({ repName: name, salesType: dept, stages: QUEUE_DEAL_STAGES });
    for (const u of urgent) {
      const d = u.deal;
      const cb = d.callback_date ? new Date(d.callback_date).getTime() : null;
      const cbDue = cb !== null && cb <= eod;
      const cbFuture = cb !== null && cb > eod;
      const stale = u.staleDays >= STALE_DAYS;
      // موعد محدد في المستقبل = ليست مستحقة اليوم حتى لو قديمة
      if (!all && !(cbDue || (stale && !cbFuture))) continue;
      const lateDays = cbDue ? Math.max(0, Math.floor((Date.now() - cb!) / DAY)) : u.staleDays;
      const ageDays = daysSince(d.created_at);
      items.push({
        key: `deal:${d.id}`, entityType: "deal", id: d.id, department: dept,
        name: d.client_name, phone: d.client_phone, stage: d.stage, value: Number(d.deal_value) || 0,
        lateDays, dueReason: cbDue ? "callback" : "stale",
        lastNote: u.lastNote?.note, ageDays, speed: speedOf(ageDays, speed),
        rank: stageRank(d.stage, u.stageDays),
      });
    }
  }

  if (state.departments.includes("renewals")) {
    const member = (state.settings.members.renewals ?? []).find((m: DeptMember) => m.user_id === state.me.id);
    const renewals = await fetchRenewals();
    const today = riyadhDate();
    const windowEnd = new Date(Date.now() + RENEWAL_WINDOW_DAYS * DAY).toISOString().slice(0, 10);
    const mine = renewals.filter((r) =>
      (r.assigned_rep || "").trim() === name &&
      OPEN_RENEWAL_STATUSES.includes(r.status) &&
      (!member?.sales_type || (r.sales_type ?? "support") === member.sales_type) &&
      (all || (r.renewal_date && r.renewal_date <= windowEnd) || r.status === "انتظار الدفع" || r.status === "جاري المتابعة"),
    );
    const notes = await latestNotes("renewal", mine.map((r) => r.id));
    for (const r of mine) {
      const n = notes.get(r.id);
      const lastTouch = [n?.created_at, r.updated_at].filter(Boolean).sort().pop();
      const overdue = r.renewal_date && r.renewal_date < today ? daysSince(`${r.renewal_date}T00:00:00+03:00`) : 0;
      // متابعة سجّلها الموظف اليوم ولها موعد قادم = ليست مستحقة
      if (!all && r.status !== "انتظار الدفع" && daysSince(lastTouch) === 0 && r.renewal_date > today) continue;
      const ageDays = daysSince(r.created_at);
      items.push({
        key: `renewal:${r.id}`, entityType: "renewal", id: r.id, department: "renewals",
        name: r.customer_name, phone: r.customer_phone, stage: r.status, value: Number(r.plan_price) || 0,
        lateDays: overdue, dueReason: r.renewal_date <= windowEnd ? "renewal_date" : "status",
        lastNote: n?.note, ageDays, speed: speedOf(ageDays, speed), rank: renewalRank(r.status),
      });
    }
  }
  return items;
}

export function nextActionDate(outcome: Outcome): string | null {
  const def = OUTCOMES.find((o) => o.key === outcome);
  if (!def || def.nextHours === null) return null;
  return new Date(Date.now() + def.nextHours * 3600000).toISOString();
}

const fmtNext = (iso: string) =>
  new Date(iso).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh", weekday: "short", hour: "numeric", minute: "2-digit" });

/** تسجيل نتيجة: ملاحظة في سجل المتابعة الحالي + موعد إعادة الاتصال للصفقة + صف في سجل الأنشطة. */
export async function logOutcome(item: QueueItem, outcome: Outcome, nextAt: string | null, authorName: string, note?: string) {
  const def = OUTCOMES.find((o) => o.key === outcome)!;
  const label = def.label.split(" · ")[0];
  const text = `📋 مهام اليوم: ${label}${nextAt ? ` — الموعد التالي ${fmtNext(nextAt)}` : ""}${note?.trim() ? `\n${note.trim()}` : ""}`;
  await createFollowUpNote(item.entityType, item.id, text, authorName);
  if (item.entityType === "deal" && nextAt) await updateDeal(item.id, { callback_date: nextAt });
  return postDaily<{ activity: PlanActivity }>({
    action: "activity", outcome, entity_type: item.entityType, entity_id: item.id,
    department: item.department, client_name: item.name, phone: item.phone, next_action_at: nextAt, note,
  });
}
