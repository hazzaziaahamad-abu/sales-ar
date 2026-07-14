import {
  formatMoney,
  formatMoneyFull,
  formatPercent,
  formatDate,
  saudiNow,
  saudiHour,
  saudiDateStr,
  dateToTimestamp,
  dateToLocal,
  todayLocal,
  tableDateBounds,
  formatPhone,
} from "@/lib/utils/format";

describe("formatMoney", () => {
  it("formats millions with one decimal + ر.س", () => {
    expect(formatMoney(1_500_000)).toBe("1.5M ر.س");
    expect(formatMoney(2_000_000)).toBe("2.0M ر.س");
  });

  it("formats thousands with no decimals", () => {
    expect(formatMoney(5_000)).toBe("5K ر.س");
    expect(formatMoney(12_400)).toBe("12K ر.س");
  });

  it("uses the boundary of 1,000,000 as millions", () => {
    expect(formatMoney(1_000_000)).toBe("1.0M ر.س");
  });

  it("uses the boundary of 1,000 as thousands", () => {
    expect(formatMoney(1_000)).toBe("1K ر.س");
  });

  it("formats values below 1000 with locale separators", () => {
    expect(formatMoney(999)).toBe("999 ر.س");
    expect(formatMoney(0)).toBe("0 ر.س");
  });
});

describe("formatMoneyFull", () => {
  it("formats with en-US grouping and currency suffix", () => {
    expect(formatMoneyFull(1234567)).toBe("1,234,567 ر.س");
    expect(formatMoneyFull(0)).toBe("0 ر.س");
  });
});

describe("formatPercent", () => {
  it("rounds to whole number percent", () => {
    expect(formatPercent(42.7)).toBe("43%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(100)).toBe("100%");
  });
});

describe("formatDate", () => {
  it("renders DD/MM/YYYY in Saudi time (UTC+3)", () => {
    // 2024-01-15T22:00:00Z -> Saudi 2024-01-16 01:00
    expect(formatDate("2024-01-15T22:00:00Z")).toBe("16/01/2024");
  });

  it("pads day and month", () => {
    expect(formatDate("2024-03-05T00:00:00Z")).toBe("05/03/2024");
  });

  it("accepts a Date object", () => {
    expect(formatDate(new Date("2024-12-31T00:00:00Z"))).toBe("31/12/2024");
  });
});

describe("saudi time helpers", () => {
  const FIXED = new Date("2024-06-10T21:30:00Z"); // Saudi: 2024-06-11 00:30

  it("saudiNow shifts by +3 hours", () => {
    const shifted = saudiNow(FIXED);
    expect(shifted.getTime()).toBe(FIXED.getTime() + 3 * 60 * 60 * 1000);
  });

  it("saudiHour wraps around midnight", () => {
    expect(saudiHour(FIXED)).toBe(0); // 21:30 UTC + 3 = 00:30 Saudi
    expect(saudiHour(new Date("2024-06-10T10:00:00Z"))).toBe(13);
  });

  it("saudiDateStr returns YYYY-MM-DD in Saudi time", () => {
    expect(saudiDateStr(FIXED)).toBe("2024-06-11");
  });

  it("saudiDateStr / saudiHour use current time when no arg", () => {
    expect(saudiDateStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const h = saudiHour();
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
  });
});

describe("dateToLocal", () => {
  it("returns Saudi-time YYYY-MM-DD", () => {
    // 2024-06-30T22:00:00Z -> Saudi 2024-07-01
    expect(dateToLocal(new Date("2024-06-30T22:00:00Z"))).toBe("2024-07-01");
  });
});

describe("dateToTimestamp", () => {
  it("produces a valid ISO string anchored to the given date", () => {
    const iso = dateToTimestamp("2024-05-20");
    expect(() => new Date(iso).toISOString()).not.toThrow();
    // The UTC date should be 2024-05-19 or 2024-05-20 depending on run time-of-day,
    // but the parsed instant must be a real timestamp.
    expect(new Date(iso).getTime()).not.toBeNaN();
  });
});

describe("todayLocal", () => {
  it("matches saudiDateStr for the current instant", () => {
    expect(todayLocal()).toBe(saudiDateStr());
  });
});

describe("tableDateBounds", () => {
  it("returns [today, today] for اليوم", () => {
    const today = todayLocal();
    expect(tableDateBounds("اليوم")).toEqual([today, today]);
  });

  it("returns a single previous day for أمس", () => {
    const bounds = tableDateBounds("أمس");
    expect(bounds).not.toBeNull();
    expect(bounds![0]).toBe(bounds![1]);
    expect(bounds![0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a 7-day window ending today for الأسبوع", () => {
    const today = todayLocal();
    const bounds = tableDateBounds("الأسبوع");
    expect(bounds).not.toBeNull();
    expect(bounds![1]).toBe(today);
    // start should be strictly before end
    expect(bounds![0] < bounds![1]).toBe(true);
  });

  it("returns first-of-month to today for الشهر", () => {
    const today = todayLocal();
    const bounds = tableDateBounds("الشهر");
    expect(bounds).not.toBeNull();
    expect(bounds![0].endsWith("-01")).toBe(true);
    expect(bounds![1]).toBe(today);
    expect(bounds![0].slice(0, 7)).toBe(today.slice(0, 7));
  });

  it("returns full previous month for الشهر الماضي", () => {
    const bounds = tableDateBounds("الشهر الماضي");
    expect(bounds).not.toBeNull();
    expect(bounds![0].endsWith("-01")).toBe(true);
    // same month for both bounds
    expect(bounds![0].slice(0, 7)).toBe(bounds![1].slice(0, 7));
  });

  it("returns custom bounds only when both from and to are provided", () => {
    expect(tableDateBounds("مخصص", "2024-01-01", "2024-01-31")).toEqual([
      "2024-01-01",
      "2024-01-31",
    ]);
    expect(tableDateBounds("مخصص", "2024-01-01")).toBeNull();
    expect(tableDateBounds("مخصص")).toBeNull();
  });

  it("returns null for an unknown filter", () => {
    expect(tableDateBounds("غير معروف")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups a Saudi 05XXXXXXXX number as 4-3-3", () => {
    expect(formatPhone("0512345678")).toBe("0512 345 678");
  });

  it("strips non-digits before matching", () => {
    expect(formatPhone("051-234-5678")).toBe("0512 345 678");
  });

  it("returns the original string for non-matching formats", () => {
    expect(formatPhone("+966512345678")).toBe("+966512345678");
    expect(formatPhone("123")).toBe("123");
  });

  it("returns empty string for empty input", () => {
    expect(formatPhone("")).toBe("");
  });
});
