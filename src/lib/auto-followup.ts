import type { Deal, EmployeeTask } from "@/types";

/* ─── Follow-up Rules ─── */

export interface FollowUpRule {
  id: string;
  label: string;
  /** Which stages this rule applies to (empty = all active stages) */
  stages: string[];
  /** Days without contact to trigger */
  daysThreshold: number;
  /** Task priority */
  priority: EmployeeTask["priority"];
  /** Task type */
  taskType: EmployeeTask["task_type"];
  /** Message template — {client} and {days} are replaced */
  message: string;
  /** Escalate to manager? */
  escalate?: boolean;
}

const CLOSED_STAGES = new Set(["مكتملة", "مرفوض مع سبب", "كنسل التجربة", "استهداف خاطئ"]);

export const FOLLOWUP_RULES: FollowUpRule[] = [
  // ─── Stage-specific rules (checked first) ───
  {
    id: "payment_reminder",
    label: "تذكير دفع",
    stages: ["انتظار الدفع"],
    daysThreshold: 3,
    priority: "high",
    taskType: "followup",
    message: "💰 متابعة الدفع — {client} في انتظار الدفع منذ {days} أيام",
  },
  {
    id: "proposal_followup",
    label: "متابعة عرض",
    stages: ["تم إرسال العرض"],
    daysThreshold: 3,
    priority: "medium",
    taskType: "followup",
    message: "📄 متابعة العرض — {client} لم يرد على العرض منذ {days} أيام",
  },
  {
    id: "negotiation_urgent",
    label: "متابعة تفاوض",
    stages: ["تفاوض"],
    daysThreshold: 5,
    priority: "high",
    taskType: "call",
    message: "🔥 متابعة عاجلة — {client} في التفاوض منذ {days} أيام بدون تواصل",
  },
  {
    id: "trial_check",
    label: "متابعة تجريبي",
    stages: ["تجريبي"],
    daysThreshold: 4,
    priority: "medium",
    taskType: "call",
    message: "🧪 متابعة التجربة — {client} في الفترة التجريبية، تواصل للتأكد من رضاه",
  },
  {
    id: "new_lead_contact",
    label: "تواصل أولي",
    stages: ["عميل جديد", "قيد التواصل"],
    daysThreshold: 2,
    priority: "high",
    taskType: "call",
    message: "📞 تواصل مع عميل جديد — {client} لم يُتواصل معه منذ {days} أيام",
  },
  // ─── General rules (fallback for all active stages) ───
  {
    id: "general_7day",
    label: "متابعة عامة",
    stages: [],
    daysThreshold: 7,
    priority: "medium",
    taskType: "followup",
    message: "⏰ متابعة — {client} بدون تواصل منذ {days} أيام",
  },
  {
    id: "escalation_14day",
    label: "تصعيد للمدير",
    stages: [],
    daysThreshold: 14,
    priority: "urgent",
    taskType: "followup",
    message: "🚨 تصعيد — {client} بدون أي تواصل منذ {days} يوم! يحتاج تدخل",
    escalate: true,
  },
];

/* ─── Engine ─── */

export interface FollowUpAction {
  deal: Deal;
  rule: FollowUpRule;
  daysSinceContact: number;
  /** Ready-to-use task title */
  taskTitle: string;
}

/**
 * Calculate days since last contact for a deal.
 * Uses: last_contact > deal_date > created_at
 */
function getDaysSinceContact(deal: Deal): number {
  const ref = deal.last_contact || deal.deal_date || deal.created_at;
  if (!ref) return 999;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
}

/**
 * Check which deals need follow-up and return actions.
 * Deduplicates against existing tasks (won't suggest if an open task exists for the deal).
 */
export function checkDealsForFollowUp(
  deals: Deal[],
  existingTasks: EmployeeTask[]
): FollowUpAction[] {
  // Build set of deal IDs that already have open followup/call tasks
  const dealsWithOpenTasks = new Set<string>();
  for (const t of existingTasks) {
    if (
      t.entity_type === "deal" &&
      t.entity_id &&
      (t.status === "pending" || t.status === "in_progress") &&
      (t.task_type === "followup" || t.task_type === "call")
    ) {
      dealsWithOpenTasks.add(t.entity_id);
    }
  }

  const actions: FollowUpAction[] = [];
  const matchedDeals = new Set<string>(); // one action per deal (highest priority rule)

  for (const rule of FOLLOWUP_RULES) {
    for (const deal of deals) {
      if (matchedDeals.has(deal.id)) continue;
      if (CLOSED_STAGES.has(deal.stage)) continue;
      if (dealsWithOpenTasks.has(deal.id)) continue;

      // Check stage match
      if (rule.stages.length > 0 && !rule.stages.includes(deal.stage)) continue;

      const days = getDaysSinceContact(deal);
      if (days < rule.daysThreshold) continue;

      const taskTitle = rule.message
        .replace("{client}", deal.client_name)
        .replace("{days}", String(days));

      actions.push({ deal, rule, daysSinceContact: days, taskTitle });
      matchedDeals.add(deal.id);
    }
  }

  // Sort: urgent first, then by days descending
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  actions.sort((a, b) => {
    const pa = priorityOrder[a.rule.priority] ?? 3;
    const pb = priorityOrder[b.rule.priority] ?? 3;
    if (pa !== pb) return pa - pb;
    return b.daysSinceContact - a.daysSinceContact;
  });

  return actions;
}

/**
 * Build a task object from a follow-up action (ready to insert).
 */
export function buildFollowUpTask(
  action: FollowUpAction,
  createdBy?: string,
  createdByName?: string
): Omit<EmployeeTask, "id" | "org_id" | "created_at" | "updated_at"> {
  return {
    title: action.taskTitle,
    description: `متابعة تلقائية — ${action.rule.label}`,
    task_type: action.rule.taskType,
    priority: action.rule.priority,
    status: "pending",
    assigned_to: action.deal.assigned_rep_id || "",
    assigned_to_name: action.deal.assigned_rep_name || "",
    assigned_by: createdBy,
    assigned_by_name: createdByName || "النظام",
    due_date: new Date().toISOString().slice(0, 10),
    entity_type: "deal",
    entity_id: action.deal.id,
    client_name: action.deal.client_name,
    client_phone: action.deal.client_phone,
  };
}
