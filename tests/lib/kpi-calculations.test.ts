import {
  getStageName,
  calculateDealCredits,
  aggregateEmployeeCredits,
} from "@/lib/kpi-calculations";

describe("getStageName", () => {
  it("returns the Arabic name for known stage numbers", () => {
    expect(getStageName(1)).toBe("أول تواصل");
    expect(getStageName(4)).toBe("الدفع");
    expect(getStageName(5)).toBe("تأكيد التسجيل");
  });

  it("returns an empty string for unknown stage numbers", () => {
    expect(getStageName(0)).toBe("");
    expect(getStageName(99)).toBe("");
  });
});

describe("calculateDealCredits", () => {
  it("computes credit points as weight% of deal value", () => {
    const result = calculateDealCredits(
      [
        { userId: "u1", userName: "Ali", stageNumber: 1, weight: 20 },
        { userId: "u2", userName: "Sara", stageNumber: 4, weight: 50 },
      ],
      1000
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      userId: "u1",
      stageName: "أول تواصل",
      creditPoints: 200,
    });
    expect(result[1].creditPoints).toBe(500);
  });

  it("drops stages without an assigned user", () => {
    const result = calculateDealCredits(
      [
        { userId: "", userName: "", stageNumber: 1, weight: 20 },
        { userId: "u2", userName: "Sara", stageNumber: 2, weight: 30 },
      ],
      1000
    );
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u2");
  });

  it("returns an empty array when there are no stages", () => {
    expect(calculateDealCredits([], 1000)).toEqual([]);
  });
});

describe("aggregateEmployeeCredits", () => {
  const makeLead = (
    deal_value: number,
    stages: {
      stage_number: number;
      stage_weight: number;
      assigned_to: string;
      assigned_name: string;
      completed_at: string | null;
    }[]
  ) => ({ deal_value, stages });

  it("aggregates completed stages per employee", () => {
    const result = aggregateEmployeeCredits([
      makeLead(1000, [
        { stage_number: 1, stage_weight: 20, assigned_to: "u1", assigned_name: "Ali", completed_at: "2024-01-01" },
        { stage_number: 4, stage_weight: 50, assigned_to: "u1", assigned_name: "Ali", completed_at: "2024-01-02" },
      ]),
    ]);
    expect(result).toHaveLength(1);
    const ali = result[0];
    expect(ali.userId).toBe("u1");
    expect(ali.stagesCompleted).toBe(2);
    expect(ali.leadsOpened).toBe(1); // stage 1
    expect(ali.dealsClosed).toBe(1); // stage 4
    expect(ali.totalDealValue).toBe(1000);
    expect(ali.totalCreditPoints).toBe(200 + 500);
    expect(ali.conversionRate).toBe(100); // 1 closed / 1 opened
  });

  it("ignores stages that are not completed or have no assignee", () => {
    const result = aggregateEmployeeCredits([
      makeLead(1000, [
        { stage_number: 1, stage_weight: 20, assigned_to: "u1", assigned_name: "Ali", completed_at: null },
        { stage_number: 2, stage_weight: 30, assigned_to: "", assigned_name: "", completed_at: "2024-01-01" },
      ]),
    ]);
    expect(result).toHaveLength(0);
  });

  it("computes conversion rate and rounds it", () => {
    // u1 opens 3 leads, closes 1 -> 33%
    const result = aggregateEmployeeCredits([
      makeLead(100, [{ stage_number: 1, stage_weight: 10, assigned_to: "u1", assigned_name: "Ali", completed_at: "d" }]),
      makeLead(100, [{ stage_number: 1, stage_weight: 10, assigned_to: "u1", assigned_name: "Ali", completed_at: "d" }]),
      makeLead(100, [
        { stage_number: 1, stage_weight: 10, assigned_to: "u1", assigned_name: "Ali", completed_at: "d" },
        { stage_number: 4, stage_weight: 50, assigned_to: "u1", assigned_name: "Ali", completed_at: "d" },
      ]),
    ]);
    expect(result[0].leadsOpened).toBe(3);
    expect(result[0].dealsClosed).toBe(1);
    expect(result[0].conversionRate).toBe(33);
  });

  it("returns 0 conversion rate when no leads were opened", () => {
    const result = aggregateEmployeeCredits([
      makeLead(500, [{ stage_number: 4, stage_weight: 50, assigned_to: "u1", assigned_name: "Ali", completed_at: "d" }]),
    ]);
    expect(result[0].leadsOpened).toBe(0);
    expect(result[0].conversionRate).toBe(0);
  });

  it("sorts employees by total credit points descending", () => {
    const result = aggregateEmployeeCredits([
      makeLead(1000, [{ stage_number: 2, stage_weight: 10, assigned_to: "u1", assigned_name: "Low", completed_at: "d" }]),
      makeLead(1000, [{ stage_number: 2, stage_weight: 90, assigned_to: "u2", assigned_name: "High", completed_at: "d" }]),
    ]);
    expect(result[0].userName).toBe("High");
    expect(result[1].userName).toBe("Low");
  });

  it("handles a lead with a missing/null deal_value as 0 credits", () => {
    const result = aggregateEmployeeCredits([
      makeLead(0, [{ stage_number: 1, stage_weight: 50, assigned_to: "u1", assigned_name: "Ali", completed_at: "d" }]),
    ]);
    expect(result[0].totalCreditPoints).toBe(0);
  });

  it("tolerates a lead with no stages array", () => {
    // @ts-expect-error intentionally omitting stages to test defensive `(lead.stages || [])`
    expect(aggregateEmployeeCredits([{ deal_value: 100 }])).toEqual([]);
  });
});
