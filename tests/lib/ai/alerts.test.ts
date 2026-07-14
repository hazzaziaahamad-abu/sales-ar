import { generateAlerts } from "@/lib/ai/alerts";
import type { Deal, Ticket, KPISnapshot } from "@/types";

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: "d1",
    org_id: "o1",
    client_name: "عميل",
    deal_value: 10000,
    stage: "تفاوض",
    probability: 50,
    cycle_days: 5,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    ...overrides,
  };
}

function ticket(overrides: Partial<Ticket>): Ticket {
  return {
    id: "t1",
    org_id: "o1",
    client_name: "عميل",
    issue: "مشكلة",
    priority: "عادي",
    status: "مفتوح",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    ...overrides,
  };
}

const categoriesOf = (alerts: ReturnType<typeof generateAlerts>) => alerts.map((a) => a.category);

describe("generateAlerts", () => {
  it("returns no alerts for empty inputs", () => {
    expect(generateAlerts({ deals: [], tickets: [] })).toEqual([]);
  });

  it("flags a negotiation deal stale > 30 days as critical", () => {
    const alerts = generateAlerts({
      deals: [deal({ stage: "تفاوض", cycle_days: 45 })],
      tickets: [],
    });
    const stale = alerts.find((a) => a.category === "stale_deal");
    expect(stale).toBeDefined();
    expect(stale!.type).toBe("critical");
    expect(stale!.deal_id).toBe("d1");
  });

  it("excludes completed and rejected deals from active analysis", () => {
    const alerts = generateAlerts({
      deals: [
        deal({ id: "done", stage: "مكتملة", cycle_days: 100 }),
        deal({ id: "rej", stage: "مرفوض مع سبب", cycle_days: 100 }),
      ],
      tickets: [],
    });
    expect(categoriesOf(alerts)).not.toContain("stale_deal");
  });

  it("emits a warning for a deal stale between 15 and 30 days", () => {
    const alerts = generateAlerts({
      deals: [deal({ stage: "تجهيز", cycle_days: 20 })],
      tickets: [],
    });
    const warn = alerts.find((a) => a.category === "stale_deal" && a.type === "warning");
    expect(warn).toBeDefined();
  });

  it("flags a big deal (> 80K) stale > 20 days as critical", () => {
    const alerts = generateAlerts({
      deals: [deal({ deal_value: 90000, stage: "تجهيز", cycle_days: 25 })],
      tickets: [],
    });
    const big = alerts.filter((a) => a.category === "stale_deal" && a.type === "critical");
    expect(big.length).toBeGreaterThan(0);
  });

  it("warns when there are open urgent tickets", () => {
    const alerts = generateAlerts({
      deals: [],
      tickets: [
        ticket({ priority: "عاجل", status: "مفتوح" }),
        ticket({ id: "t2", priority: "عاجل", status: "محلول" }), // resolved -> ignored
      ],
    });
    const urgent = alerts.find((a) => a.category === "urgent_tickets");
    expect(urgent).toBeDefined();
    expect(urgent!.message).toContain("1");
  });

  it("does not warn when urgent tickets are all resolved", () => {
    const alerts = generateAlerts({
      deals: [],
      tickets: [ticket({ priority: "عاجل", status: "محلول" })],
    });
    expect(categoriesOf(alerts)).not.toContain("urgent_tickets");
  });

  it("emits a critical revenue_gap when revenue < 60% of target", () => {
    const kpi = { total_revenue: 50, close_rate: 0.4 } as KPISnapshot;
    const alerts = generateAlerts({
      deals: [],
      tickets: [],
      kpi,
      targetRevenue: 100,
    });
    const gap = alerts.find((a) => a.category === "revenue_gap");
    expect(gap).toBeDefined();
    expect(gap!.type).toBe("critical");
  });

  it("emits a best_month opportunity when revenue >= target", () => {
    const kpi = { total_revenue: 150, close_rate: 0.5 } as KPISnapshot;
    const alerts = generateAlerts({
      deals: [],
      tickets: [],
      kpi,
      targetRevenue: 100,
    });
    expect(categoriesOf(alerts)).toContain("best_month");
  });

  it("emits a pipeline opportunity when weighted pipeline exceeds 150% of target", () => {
    const alerts = generateAlerts({
      deals: [deal({ deal_value: 100000, probability: 80, stage: "تجهيز", cycle_days: 2 })],
      tickets: [],
      targetRevenue: 40000, // pipeline 80k > 60k
    });
    expect(categoriesOf(alerts)).toContain("pipeline");
  });

  it("sorts critical alerts before warning before opportunity", () => {
    const kpi = { total_revenue: 150, close_rate: 0.5 } as KPISnapshot;
    const alerts = generateAlerts({
      deals: [
        deal({ id: "crit", stage: "تفاوض", cycle_days: 45 }), // critical
        deal({ id: "warn", stage: "تجهيز", cycle_days: 20 }), // warning
      ],
      tickets: [],
      kpi,
      targetRevenue: 100, // best_month opportunity
    });
    const types = alerts.map((a) => a.type);
    const priority = { critical: 0, warning: 1, opportunity: 2 } as const;
    const ranks = types.map((t) => priority[t]);
    const sorted = [...ranks].sort((a, b) => a - b);
    expect(ranks).toEqual(sorted);
  });
});
