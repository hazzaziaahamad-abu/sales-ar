import {
  getKpiStatus,
  STAGES,
  SOURCES,
  STAGE_COLORS,
  KPI_TARGETS,
  ACTIVITY_POINTS,
  SCORE_LEVELS,
} from "@/lib/utils/constants";

describe("getKpiStatus", () => {
  it("returns 'excellent' when actual meets or exceeds target", () => {
    expect(getKpiStatus(100, 100)).toBe("excellent");
    expect(getKpiStatus(120, 100)).toBe("excellent");
  });

  it("returns 'improving' when ratio is between 0.7 and 1", () => {
    expect(getKpiStatus(70, 100)).toBe("improving");
    expect(getKpiStatus(99, 100)).toBe("improving");
  });

  it("returns 'behind' when ratio is below 0.7", () => {
    expect(getKpiStatus(69, 100)).toBe("behind");
    expect(getKpiStatus(0, 100)).toBe("behind");
  });

  it("handles inverted metrics (lower actual is better)", () => {
    // e.g. avg_cycle_days: target 14, actual 10 -> ratio 1.4 -> excellent
    expect(getKpiStatus(10, 14, true)).toBe("excellent");
    // actual 20, target 14 -> ratio 0.7 -> improving
    expect(getKpiStatus(20, 14, true)).toBe("improving");
    // actual 30, target 14 -> ratio ~0.47 -> behind
    expect(getKpiStatus(30, 14, true)).toBe("behind");
  });
});

describe("constant integrity", () => {
  it("STAGES has no duplicate values", () => {
    expect(new Set(STAGES).size).toBe(STAGES.length);
  });

  it("SOURCES has no duplicate values", () => {
    expect(new Set(SOURCES).size).toBe(SOURCES.length);
  });

  it("every STAGE_COLORS key is a valid stage", () => {
    for (const key of Object.keys(STAGE_COLORS)) {
      expect(STAGES).toContain(key);
    }
  });

  it("KPI_TARGETS values are all positive numbers", () => {
    for (const value of Object.values(KPI_TARGETS)) {
      expect(typeof value).toBe("number");
      expect(value).toBeGreaterThan(0);
    }
  });

  it("ACTIVITY_POINTS rewards a closed deal the most", () => {
    const max = Math.max(...Object.values(ACTIVITY_POINTS));
    expect(ACTIVITY_POINTS.deal_closed).toBe(max);
  });

  it("SCORE_LEVELS are ordered by descending minPoints", () => {
    const points = SCORE_LEVELS.map((l) => l.minPoints);
    const sorted = [...points].sort((a, b) => b - a);
    expect(points).toEqual(sorted);
  });
});
