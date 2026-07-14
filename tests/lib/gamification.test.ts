import { buildLeaderboard, getStarEmployee, ALL_BADGES } from "@/lib/gamification";
import { todayLocal } from "@/lib/utils/format";
import type { Deal } from "@/types";

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: Math.random().toString(36).slice(2),
    org_id: "o1",
    client_name: "عميل",
    deal_value: 1000,
    stage: "مكتملة",
    probability: 100,
    cycle_days: 5,
    assigned_rep_name: "Ali",
    created_at: "2024-01-01",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildLeaderboard", () => {
  it("returns an empty array when there are no deals", () => {
    expect(buildLeaderboard([])).toEqual([]);
  });

  it("skips deals with no assigned rep", () => {
    const lb = buildLeaderboard([deal({ assigned_rep_name: "  " })]);
    expect(lb).toEqual([]);
  });

  it("aggregates closed deals and revenue per rep", () => {
    const lb = buildLeaderboard([
      deal({ assigned_rep_name: "Ali", deal_value: 2000, stage: "مكتملة" }),
      deal({ assigned_rep_name: "Ali", deal_value: 3000, stage: "مكتملة" }),
      deal({ assigned_rep_name: "Ali", deal_value: 1000, stage: "تفاوض" }), // not closed
    ]);
    expect(lb).toHaveLength(1);
    const ali = lb[0];
    expect(ali.name).toBe("Ali");
    expect(ali.closedDeals).toBe(2);
    expect(ali.revenue).toBe(5000);
    expect(ali.winRate).toBe(67); // 2/3 rounded
  });

  it("assigns ranks in score order", () => {
    const lb = buildLeaderboard([
      deal({ assigned_rep_name: "Weak", deal_value: 500, stage: "مكتملة" }),
      deal({ assigned_rep_name: "Strong", deal_value: 50000, stage: "مكتملة" }),
      deal({ assigned_rep_name: "Strong", deal_value: 50000, stage: "مكتملة" }),
    ]);
    expect(lb[0].name).toBe("Strong");
    expect(lb[0].rank).toBe(1);
    expect(lb[1].rank).toBe(2);
  });

  it("awards the deal_starter badge after the first closed deal", () => {
    const lb = buildLeaderboard([deal({ assigned_rep_name: "Ali", stage: "مكتملة" })]);
    const badgeIds = lb[0].badges.map((b) => b.id);
    expect(badgeIds).toContain("deal_starter");
  });

  it("awards revenue badges based on thresholds", () => {
    const deals = Array.from({ length: 1 }, () =>
      deal({ assigned_rep_name: "Rich", deal_value: 60000, stage: "مكتملة" })
    );
    const lb = buildLeaderboard(deals);
    const badgeIds = lb[0].badges.map((b) => b.id);
    expect(badgeIds).toContain("rev_5k");
    expect(badgeIds).toContain("rev_10k");
    expect(badgeIds).toContain("rev_50k");
  });

  it("counts full-price deals against package original price", () => {
    const lb = buildLeaderboard(
      Array.from({ length: 5 }, () =>
        deal({ assigned_rep_name: "Ali", deal_value: 1000, stage: "مكتملة", plan: "VIP" })
      ),
      [{ name: "VIP", original_price: 1000 }]
    );
    const badgeIds = lb[0].badges.map((b) => b.id);
    expect(badgeIds).toContain("full_price_hero"); // 5 full-price deals
  });

  it("awards the machine badge for 3 deals closed today", () => {
    const today = todayLocal();
    const lb = buildLeaderboard([
      deal({ assigned_rep_name: "Ali", stage: "مكتملة", updated_at: `${today}T10:00:00Z` }),
      deal({ assigned_rep_name: "Ali", stage: "مكتملة", updated_at: `${today}T11:00:00Z` }),
      deal({ assigned_rep_name: "Ali", stage: "مكتملة", updated_at: `${today}T12:00:00Z` }),
    ]);
    const badgeIds = lb[0].badges.map((b) => b.id);
    expect(badgeIds).toContain("machine");
  });

  it("caps the score at 100", () => {
    const deals = Array.from({ length: 30 }, () =>
      deal({ assigned_rep_name: "Ali", deal_value: 100000, stage: "مكتملة", cycle_days: 1 })
    );
    const lb = buildLeaderboard(deals);
    expect(lb[0].score).toBeLessThanOrEqual(100);
    expect(lb[0].score).toBeGreaterThan(0);
  });
});

describe("getStarEmployee", () => {
  it("returns null when there are no deals", () => {
    expect(getStarEmployee([])).toBeNull();
  });

  it("returns null when the top rep has no closed deals", () => {
    const star = getStarEmployee([deal({ assigned_rep_name: "Ali", stage: "تفاوض" })]);
    expect(star).toBeNull();
  });

  it("returns the top performer with rank 1", () => {
    const star = getStarEmployee([
      deal({ assigned_rep_name: "Ali", deal_value: 50000, stage: "مكتملة" }),
    ]);
    expect(star).not.toBeNull();
    expect(star!.rank).toBe(1);
    expect(star!.name).toBe("Ali");
    expect(star!.closedDeals).toBe(1);
  });
});

describe("ALL_BADGES", () => {
  it("has unique ids", () => {
    const ids = ALL_BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each badge has a check function", () => {
    for (const badge of ALL_BADGES) {
      expect(typeof badge.check).toBe("function");
    }
  });
});
