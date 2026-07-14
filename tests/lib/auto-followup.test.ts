import {
  checkDealsForFollowUp,
  buildFollowUpTask,
  FOLLOWUP_RULES,
} from "@/lib/auto-followup";
import { todayLocal } from "@/lib/utils/format";
import type { Deal, EmployeeTask } from "@/types";

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: "d1",
    org_id: "o1",
    client_name: "عميل تجريبي",
    deal_value: 1000,
    stage: "قيد التواصل",
    probability: 20,
    cycle_days: 1,
    assigned_rep_id: "rep1",
    assigned_rep_name: "Ali",
    last_contact: daysAgoISO(10),
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    ...overrides,
  };
}

describe("checkDealsForFollowUp", () => {
  it("returns no actions when there are no deals", () => {
    expect(checkDealsForFollowUp([], [])).toEqual([]);
  });

  it("skips deals in closed stages", () => {
    const actions = checkDealsForFollowUp(
      [
        deal({ id: "a", stage: "مكتملة", last_contact: daysAgoISO(30) }),
        deal({ id: "b", stage: "استهداف خاطئ", last_contact: daysAgoISO(30) }),
      ],
      []
    );
    expect(actions).toEqual([]);
  });

  it("triggers the payment reminder rule for انتظار الدفع past threshold", () => {
    const actions = checkDealsForFollowUp(
      [deal({ stage: "انتظار الدفع", last_contact: daysAgoISO(5) })],
      []
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].rule.id).toBe("payment_reminder");
    expect(actions[0].daysSinceContact).toBe(5);
  });

  it("does not trigger when days since contact is below the threshold", () => {
    const actions = checkDealsForFollowUp(
      [deal({ stage: "انتظار الدفع", last_contact: daysAgoISO(1) })], // threshold 3
      []
    );
    expect(actions).toEqual([]);
  });

  it("assigns only one action per deal (highest-priority matching rule)", () => {
    const actions = checkDealsForFollowUp(
      [deal({ stage: "تفاوض", last_contact: daysAgoISO(20) })],
      []
    );
    expect(actions).toHaveLength(1);
    // negotiation_urgent (stage-specific) should win over general rules
    expect(actions[0].rule.id).toBe("negotiation_urgent");
  });

  it("substitutes {client} and {days} in the task title", () => {
    const actions = checkDealsForFollowUp(
      [deal({ stage: "انتظار الدفع", client_name: "متجر الأمل", last_contact: daysAgoISO(7) })],
      []
    );
    expect(actions[0].taskTitle).toContain("متجر الأمل");
    expect(actions[0].taskTitle).toContain("7");
  });

  it("deduplicates against existing open followup/call tasks for the deal", () => {
    const existing: EmployeeTask[] = [
      {
        id: "t1",
        org_id: "o1",
        title: "متابعة",
        task_type: "followup",
        priority: "high",
        status: "pending",
        assigned_to: "rep1",
        assigned_to_name: "Ali",
        entity_type: "deal",
        entity_id: "d1",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    ];
    const actions = checkDealsForFollowUp(
      [deal({ id: "d1", stage: "انتظار الدفع", last_contact: daysAgoISO(7) })],
      existing
    );
    expect(actions).toEqual([]);
  });

  it("still suggests when the existing task is completed (not open)", () => {
    const existing: EmployeeTask[] = [
      {
        id: "t1",
        org_id: "o1",
        title: "متابعة",
        task_type: "followup",
        priority: "high",
        status: "completed",
        assigned_to: "rep1",
        assigned_to_name: "Ali",
        entity_type: "deal",
        entity_id: "d1",
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    ];
    const actions = checkDealsForFollowUp(
      [deal({ id: "d1", stage: "انتظار الدفع", last_contact: daysAgoISO(7) })],
      existing
    );
    expect(actions).toHaveLength(1);
  });

  it("treats a deal with no contact/date reference as very stale (999 days)", () => {
    const d = deal({ stage: "قيد التواصل" });
    delete (d as Partial<Deal>).last_contact;
    delete (d as Partial<Deal>).deal_date;
    delete (d as Partial<Deal>).created_at;
    const actions = checkDealsForFollowUp([d], []);
    expect(actions).toHaveLength(1);
    expect(actions[0].daysSinceContact).toBe(999);
  });

  it("sorts higher-priority actions before lower-priority ones", () => {
    const actions = checkDealsForFollowUp(
      [
        deal({ id: "medium", stage: "تجريبي", last_contact: daysAgoISO(5) }), // trial_check -> medium
        deal({ id: "high", stage: "انتظار الدفع", last_contact: daysAgoISO(7) }), // payment_reminder -> high
      ],
      []
    );
    expect(actions).toHaveLength(2);
    expect(actions[0].rule.priority).toBe("high");
    expect(actions[1].rule.priority).toBe("medium");
  });

  it("lets an earlier general rule pre-empt the urgent escalation rule (per-deal dedup)", () => {
    // A تجهيز deal at 20 days is caught by general_7day (medium, threshold 7),
    // which is listed before escalation_14day, so only one medium action is produced.
    const actions = checkDealsForFollowUp(
      [deal({ id: "d1", stage: "تجهيز", last_contact: daysAgoISO(20) })],
      []
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].rule.id).toBe("general_7day");
    expect(actions[0].rule.priority).toBe("medium");
  });
});

describe("buildFollowUpTask", () => {
  it("builds an insertable task object from an action", () => {
    const [action] = checkDealsForFollowUp(
      [deal({ stage: "انتظار الدفع", last_contact: daysAgoISO(7) })],
      []
    );
    const task = buildFollowUpTask(action, "mgr1", "المدير");
    expect(task.status).toBe("pending");
    expect(task.entity_type).toBe("deal");
    expect(task.entity_id).toBe("d1");
    expect(task.assigned_to).toBe("rep1");
    expect(task.assigned_by).toBe("mgr1");
    expect(task.assigned_by_name).toBe("المدير");
    expect(task.due_date).toBe(todayLocal());
    expect(task.title).toBe(action.taskTitle);
  });

  it("defaults assigned_by_name to النظام when not provided", () => {
    const [action] = checkDealsForFollowUp(
      [deal({ stage: "انتظار الدفع", last_contact: daysAgoISO(7) })],
      []
    );
    const task = buildFollowUpTask(action);
    expect(task.assigned_by_name).toBe("النظام");
  });
});

describe("FOLLOWUP_RULES", () => {
  it("has unique rule ids", () => {
    const ids = FOLLOWUP_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists stage-specific rules before general fallback rules", () => {
    const firstGeneralIndex = FOLLOWUP_RULES.findIndex((r) => r.stages.length === 0);
    const lastSpecificIndex = FOLLOWUP_RULES.map((r) => r.stages.length > 0).lastIndexOf(true);
    expect(firstGeneralIndex).toBeGreaterThan(lastSpecificIndex);
  });
});
