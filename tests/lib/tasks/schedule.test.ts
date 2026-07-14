import { computeNextRun, describeSchedule } from "@/lib/tasks/schedule";
import type { ScheduledTask } from "@/types";

type Schedulable = Pick<
  ScheduledTask,
  "frequency" | "at_hour" | "at_minute" | "weekday" | "day_of_month" | "run_at" | "timezone"
>;

function task(overrides: Partial<Schedulable>): Schedulable {
  return {
    frequency: "daily",
    at_hour: 15,
    at_minute: 0,
    weekday: null,
    day_of_month: null,
    run_at: null,
    timezone: "Asia/Riyadh",
    ...overrides,
  };
}

/** Wall-clock parts of a Date as seen in Riyadh (UTC+3, no DST). */
function riyadhParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday);
  return {
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    weekday,
  };
}

describe("computeNextRun — once", () => {
  it("returns the run_at date when it is in the future", () => {
    const from = new Date("2024-06-10T09:00:00Z");
    const runAt = "2024-06-11T09:00:00Z";
    const next = computeNextRun(task({ frequency: "once", run_at: runAt }), from);
    expect(next?.toISOString()).toBe(new Date(runAt).toISOString());
  });

  it("returns null when run_at is in the past", () => {
    const from = new Date("2024-06-10T09:00:00Z");
    const next = computeNextRun(
      task({ frequency: "once", run_at: "2024-06-09T09:00:00Z" }),
      from
    );
    expect(next).toBeNull();
  });

  it("returns null when a one-off task has no run_at", () => {
    expect(computeNextRun(task({ frequency: "once", run_at: null }))).toBeNull();
  });
});

describe("computeNextRun — daily", () => {
  it("fires later the same Riyadh day when the time has not passed", () => {
    // from = 12:00 Riyadh; task at 15:00 Riyadh -> same day 15:00
    const from = new Date("2024-06-10T09:00:00Z");
    const next = computeNextRun(task({ frequency: "daily", at_hour: 15, at_minute: 0 }), from)!;
    const p = riyadhParts(next);
    expect(p.hour).toBe(15);
    expect(p.minute).toBe(0);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    // Should be the same calendar day in Riyadh
    expect(p.day).toBe(10);
  });

  it("rolls to the next day when the time has already passed", () => {
    // from = 12:00 Riyadh; task at 10:00 Riyadh -> tomorrow 10:00
    const from = new Date("2024-06-10T09:00:00Z");
    const next = computeNextRun(task({ frequency: "daily", at_hour: 10, at_minute: 0 }), from)!;
    const p = riyadhParts(next);
    expect(p.hour).toBe(10);
    expect(p.day).toBe(11);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe("computeNextRun — weekly", () => {
  it("returns the next occurrence of the target weekday", () => {
    // 2024-06-10 is a Monday (weekday=1). Target Wednesday (weekday=3).
    const from = new Date("2024-06-10T09:00:00Z");
    const next = computeNextRun(
      task({ frequency: "weekly", weekday: 3, at_hour: 9, at_minute: 30 }),
      from
    )!;
    const p = riyadhParts(next);
    expect(p.weekday).toBe(3);
    expect(p.hour).toBe(9);
    expect(p.minute).toBe(30);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});

describe("computeNextRun — monthly", () => {
  it("returns the next occurrence of the target day of month", () => {
    const from = new Date("2024-06-10T09:00:00Z");
    const next = computeNextRun(
      task({ frequency: "monthly", day_of_month: 20, at_hour: 8, at_minute: 0 }),
      from
    )!;
    const p = riyadhParts(next);
    expect(p.day).toBe(20);
    expect(p.hour).toBe(8);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it("skips to next month when the target day already passed", () => {
    const from = new Date("2024-06-25T09:00:00Z");
    const next = computeNextRun(
      task({ frequency: "monthly", day_of_month: 20, at_hour: 8, at_minute: 0 }),
      from
    )!;
    const p = riyadhParts(next);
    expect(p.day).toBe(20);
    // Must be in a later month than June 20
    expect(next.getTime()).toBeGreaterThan(new Date("2024-06-20T05:00:00Z").getTime());
  });
});

describe("describeSchedule", () => {
  it("describes a daily schedule with formatted Arabic time", () => {
    expect(describeSchedule(task({ frequency: "daily", at_hour: 15, at_minute: 30 }))).toBe(
      "يومياً الساعة 3:30 م"
    );
  });

  it("describes a morning time with the ص marker", () => {
    expect(describeSchedule(task({ frequency: "daily", at_hour: 9, at_minute: 5 }))).toBe(
      "يومياً الساعة 9:05 ص"
    );
  });

  it("renders midnight as 12 ص", () => {
    expect(describeSchedule(task({ frequency: "daily", at_hour: 0, at_minute: 0 }))).toBe(
      "يومياً الساعة 12:00 ص"
    );
  });

  it("renders noon as 12 م", () => {
    expect(describeSchedule(task({ frequency: "daily", at_hour: 12, at_minute: 0 }))).toBe(
      "يومياً الساعة 12:00 م"
    );
  });

  it("describes a weekly schedule with the Arabic weekday", () => {
    // weekday index 1 = الاثنين
    expect(
      describeSchedule(task({ frequency: "weekly", weekday: 1, at_hour: 10, at_minute: 0 }))
    ).toBe("كل الاثنين الساعة 10:00 ص");
  });

  it("describes a monthly schedule with the day number", () => {
    expect(
      describeSchedule(task({ frequency: "monthly", day_of_month: 5, at_hour: 14, at_minute: 0 }))
    ).toBe("يوم 5 من كل شهر الساعة 2:00 م");
  });

  it("describes a once schedule without run_at as مرة واحدة", () => {
    expect(describeSchedule(task({ frequency: "once", run_at: null }))).toBe("مرة واحدة");
  });
});
