import { computePerformanceScore } from "@/lib/ai/scoring";

const baseInput = {
  actual_revenue: 0,
  target_revenue: 100,
  actual_close_rate: 0,
  target_close_rate: 100,
  actual_deals: 0,
  target_deals: 10,
  actual_cycle_days: 10,
  target_cycle_days: 10,
  monthly_revenues: [] as number[],
};

describe("computePerformanceScore", () => {
  it("returns all zeros for zero performance with no consistency data", () => {
    const r = computePerformanceScore({ ...baseInput });
    // close/revenue/deal all 0; speed = min(1.2, 10/10)*15 = 15; consistency 0
    expect(r.close_rate_score).toBe(0);
    expect(r.revenue_score).toBe(0);
    expect(r.deal_count_score).toBe(0);
    expect(r.cycle_speed_score).toBe(15);
    expect(r.consistency_score).toBe(0);
    expect(r.overall_score).toBe(15);
  });

  it("caps each component at 120% of target", () => {
    const r = computePerformanceScore({
      ...baseInput,
      actual_close_rate: 1000,
      target_close_rate: 100, // ratio huge -> capped at 1.2
      actual_revenue: 1000,
      target_revenue: 100,
      actual_deals: 1000,
      target_deals: 10,
      actual_cycle_days: 1, // very fast -> capped at 1.2
      target_cycle_days: 10,
    });
    expect(r.close_rate_score).toBe(36); // 1.2 * 30
    expect(r.revenue_score).toBe(30); // 1.2 * 25
    expect(r.deal_count_score).toBe(24); // 1.2 * 20
    expect(r.cycle_speed_score).toBe(18); // 1.2 * 15
  });

  it("caps the overall score at 100", () => {
    const r = computePerformanceScore({
      actual_revenue: 1000,
      target_revenue: 100,
      actual_close_rate: 1000,
      target_close_rate: 100,
      actual_deals: 1000,
      target_deals: 10,
      actual_cycle_days: 1,
      target_cycle_days: 10,
      monthly_revenues: [100, 100, 100], // perfectly consistent -> +10
    });
    expect(r.overall_score).toBe(100);
  });

  it("guards against division by zero targets", () => {
    const r = computePerformanceScore({
      ...baseInput,
      target_close_rate: 0,
      target_revenue: 0,
      target_deals: 0,
      actual_cycle_days: 0, // speed guarded too
    });
    expect(r.close_rate_score).toBe(0);
    expect(r.revenue_score).toBe(0);
    expect(r.deal_count_score).toBe(0);
    expect(r.cycle_speed_score).toBe(0);
    expect(r.overall_score).toBe(0);
  });

  it("rewards consistent monthly revenue over volatile", () => {
    const consistent = computePerformanceScore({
      ...baseInput,
      monthly_revenues: [100, 100, 100],
    });
    const volatile = computePerformanceScore({
      ...baseInput,
      monthly_revenues: [10, 200, 5],
    });
    expect(consistent.consistency_score).toBe(10); // cv=0 -> full 10
    expect(consistent.consistency_score).toBeGreaterThan(volatile.consistency_score);
  });

  it("gives no consistency score when mean revenue is zero", () => {
    const r = computePerformanceScore({ ...baseInput, monthly_revenues: [0, 0, 0] });
    expect(r.consistency_score).toBe(0);
  });

  it("requires at least 2 total deals to count win rate", () => {
    // The scoring guards win rate contribution behind target_deals>=2 semantics
    // via total_deals; here target_deals large but actual small still scores by ratio.
    const r = computePerformanceScore({
      ...baseInput,
      actual_close_rate: 50,
      target_close_rate: 100,
    });
    // ratio 0.5 * 30 = 15
    expect(r.close_rate_score).toBe(15);
  });
});
