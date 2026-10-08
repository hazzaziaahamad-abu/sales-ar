/**
 * «هام جداً للمتابعة اليومية» — منطق مشترك بين الصفحة وبانر الأقسام والنافذة المنبثقة.
 *
 * - آخر تحديث = الأحدث بين: آخر تعليق في سجل المتابعة (follow_up_notes) وآخر تعديل على الصفقة.
 * - مدة الحالة = متى دخلت الصفقة حالتها الحالية، محسوبة من سجل العمليات (activity_logs:
 *   «تغيير المرحلة إلى X»). لو ما فيه سجل نرجع لتاريخ إنشاء الصفقة.
 */
import { createClient } from "@/lib/supabase/client";
import { getOrgId, URGENT_FOLLOWUP_STAGES } from "@/lib/supabase/db";
import type { Deal } from "@/types";

export { URGENT_FOLLOWUP_STAGES };

/** من كم يوم بدون تحديث تعتبر الصفقة متأخرة */
export const STALE_DAYS = 3;
export const CRITICAL_DAYS = 7;

const DAY_MS = 86400000;
const CHUNK = 150;
const STAGE_LOG_PREFIX = "تغيير المرحلة إلى ";

export interface UrgentDeal {
  deal: Deal;
  /** آخر نشاط (تعليق سجل أو تعديل) */
  lastActivity: string;
  lastNote?: { note: string; author_name: string; created_at: string };
  /** أيام بدون تحديث */
  staleDays: number;
  /** متى دخلت الحالة الحالية */
  stageSince: string;
  /** أيام في الحالة الحالية */
  stageDays: number;
}

function daysSince(iso: string | undefined | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
}

function chunks<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
  return out;
}

export function isUrgentAdmin(user: { isSuperAdmin?: boolean; roleName?: string } | null | undefined): boolean {
  return !!user && (!!user.isSuperAdmin || user.roleName === "مدير" || user.roleName === "admin");
}

/**
 * يجلب صفقات الحالات المهمة مع آخر تحديث ومدة الحالة.
 * repName = صفقات موظف واحد فقط. salesType = قسم واحد (المكتب / الدعم).
 */
export async function fetchUrgentDeals(opts?: { repName?: string; salesType?: "office" | "support" }): Promise<UrgentDeal[]> {
  const supabase = createClient();
  const orgId = getOrgId();

  let query = supabase
    .from("deals")
    .select("*")
    .eq("org_id", orgId)
    .in("stage", [...URGENT_FOLLOWUP_STAGES]);
  if (opts?.repName) query = query.eq("assigned_rep_name", opts.repName.trim());
  if (opts?.salesType) query = query.eq("sales_type", opts.salesType);
  const { data, error } = await query.limit(2000);
  if (error) throw error;
  const deals = (data ?? []) as Deal[];
  if (deals.length === 0) return [];

  const ids = deals.map((d) => d.id);
  const lastNote = new Map<string, { note: string; author_name: string; created_at: string }>();
  const stageLogs = new Map<string, { details: string; created_at: string }[]>();

  await Promise.all(
    chunks(ids).map(async (part) => {
      const [notesRes, logsRes] = await Promise.all([
        supabase
          .from("follow_up_notes")
          .select("entity_id, note, author_name, created_at")
          .eq("org_id", orgId)
          .eq("entity_type", "deal")
          .in("entity_id", part)
          .order("created_at", { ascending: false }),
        supabase
          .from("activity_logs")
          .select("entity_id, details, created_at")
          .eq("org_id", orgId)
          .eq("section", "sales")
          .like("details", `${STAGE_LOG_PREFIX}%`)
          .in("entity_id", part)
          .order("created_at", { ascending: true }),
      ]);
      for (const n of (notesRes.data ?? []) as { entity_id: string; note: string; author_name: string; created_at: string }[]) {
        if (!lastNote.has(n.entity_id)) lastNote.set(n.entity_id, n);
      }
      for (const l of (logsRes.data ?? []) as { entity_id: string; details: string; created_at: string }[]) {
        const list = stageLogs.get(l.entity_id) ?? [];
        list.push(l);
        stageLogs.set(l.entity_id, list);
      }
    }),
  );

  return deals.map((deal) => {
    const note = lastNote.get(deal.id);
    const candidates = [note?.created_at, deal.updated_at, deal.created_at].filter(Boolean) as string[];
    const lastActivity = candidates.reduce((a, b) => (new Date(b) > new Date(a) ? b : a));

    // التعديل يسجّل «تغيير المرحلة إلى X» حتى لو المرحلة ما تغيّرت — ناخذ أول سجل في آخر سلسلة متتالية بنفس الحالة
    // لو كل السجلات بنفس الحالة = الصفقة على هالحالة من إنشائها
    let stageSince = deal.created_at;
    const logs = stageLogs.get(deal.id) ?? [];
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].details.slice(STAGE_LOG_PREFIX.length).trim() !== deal.stage) {
        // آخر سجل بحالة ثانية = تغيّرت بدون سجل، ناخذ آخر تعديل
        stageSince = i + 1 < logs.length ? logs[i + 1].created_at : deal.updated_at || deal.created_at;
        break;
      }
    }

    return {
      deal,
      lastActivity,
      lastNote: note,
      staleDays: daysSince(lastActivity),
      stageSince,
      stageDays: daysSince(stageSince),
    };
  });
}

/** تجميع حسب الموظف — لملخص المدير */
export function summarizeByRep(items: UrgentDeal[]) {
  const m = new Map<string, { rep: string; total: number; stale: number; critical: number; byStage: Record<string, number> }>();
  for (const it of items) {
    const rep = it.deal.assigned_rep_name?.trim() || "بدون موظف";
    const row = m.get(rep) ?? { rep, total: 0, stale: 0, critical: 0, byStage: {} };
    row.total++;
    if (it.staleDays >= STALE_DAYS) row.stale++;
    if (it.staleDays >= CRITICAL_DAYS) row.critical++;
    row.byStage[it.deal.stage] = (row.byStage[it.deal.stage] ?? 0) + 1;
    m.set(rep, row);
  }
  return [...m.values()].sort((a, b) => b.stale - a.stale || b.total - a.total);
}
