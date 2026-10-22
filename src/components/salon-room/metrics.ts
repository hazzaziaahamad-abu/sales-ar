// حسابات مشتركة للداشبورد وخطة الاستهداف في غرفة التخطيط والتنفيذ.

import { goalProgress } from "@/lib/salon-growth";
import { ROOM_KPIS, weekStart, type RoomClient, type RoomLog, type RoomTask, type Stage, type Targets } from "@/lib/salon-room";

export const ACTIVE_STAGES: Stage[] = ["discovery", "diagnosis", "proposal", "onboarding", "execution", "review"];
export const CONTRACT_STAGES: Stage[] = ["onboarding", "execution", "review"];

export const isLead = (c: RoomClient) => c.stage === "lead";
export const isActive = (c: RoomClient) => ACTIVE_STAGES.includes(c.stage);

/** تقدّم الأسبوع مقابل الأهداف (الأسبوع يبدأ الأحد). */
export function weekProgress(clients: RoomClient[], logs: RoomLog[], now: number) {
  const from = weekStart(now);
  const inWeek = (iso: string | null) => !!iso && Date.parse(iso) >= from;
  const contacts = logs.filter((l) => l.kind === "contact" && inWeek(l.created_at));
  const byMember = new Map<string, number>();
  contacts.forEach((l) => byMember.set(l.author ?? "—", (byMember.get(l.author ?? "—") ?? 0) + 1));
  return {
    from,
    contacts: contacts.length,
    meetings: clients.filter((c) => inWeek(c.converted_at)).length,
    contracts: clients.filter((c) => inWeek(c.contracted_at)).length,
    byMember,
  };
}

export const ratio = (v: number, target: number) => (target > 0 ? Math.min(1, v / target) : 0);

/** نسبة إنجاز خطة التنفيذ (كل مهام الصالون). */
export function planProgress(c: RoomClient, tasks: RoomTask[]) {
  const mine = tasks.filter((t) => t.client_id === c.id);
  const done = mine.filter((t) => t.done_at).length;
  return { done, total: mine.length, pct: mine.length ? done / mine.length : 0 };
}

/** متوسط تقدّم أهداف الـ ٩٠ يوم المحدّدة للصالون (null لو ما فيه أهداف قابلة للقياس). */
export function goalsProgress(c: RoomClient): number | null {
  const ps = c.goals
    .map((g) => {
      const k = ROOM_KPIS.find((x) => x.key === g.kpi);
      return k ? goalProgress(k, c.baseline[k.key] ?? null, c.current[k.key] ?? null, g.target) : null;
    })
    .filter((p): p is number => p !== null);
  return ps.length ? ps.reduce((s, p) => s + p, 0) / ps.length : null;
}

/** آخر نشاط على الصالون (سجل أو تحديث). */
export function lastActivity(c: RoomClient, logs: RoomLog[]) {
  const l = logs.find((x) => x.client_id === c.id);
  return l && Date.parse(l.created_at) > Date.parse(c.updated_at) ? l.created_at : c.updated_at;
}

export type { Targets };
