import {
  mapStage,
  mapSource,
  mapRenewalStatus,
  STAGE_MAP,
  SOURCE_MAP,
  RENEWAL_STATUS_MAP,
} from "@/lib/utils/value-maps";

describe("mapStage", () => {
  it("returns the fallback for empty/whitespace input", () => {
    expect(mapStage("")).toBe("قيد التواصل");
    expect(mapStage("   ")).toBe("قيد التواصل");
    expect(mapStage("", undefined, "مكتملة")).toBe("مكتملة");
  });

  it("prioritises AI mapping when it points to a valid stage", () => {
    expect(mapStage("Won", { Won: "مكتملة" })).toBe("مكتملة");
  });

  it("ignores AI mapping that points to an invalid stage", () => {
    // falls through to hardcoded map / partial matching -> fallback
    expect(mapStage("randomxyz", { randomxyz: "NOT_A_STAGE" })).toBe("قيد التواصل");
  });

  it("uses the hardcoded STAGE_MAP for exact external values", () => {
    expect(mapStage("إغلاق")).toBe("مكتملة");
    expect(mapStage("عرض سعر")).toBe("تجهيز");
    expect(mapStage("closed")).toBe("مكتملة");
    expect(mapStage("new")).toBe("عميل جديد");
  });

  it("passes through already-valid canonical stages", () => {
    expect(mapStage("تفاوض")).toBe("تفاوض");
    expect(mapStage("مكتملة")).toBe("مكتملة");
  });

  it("trims surrounding whitespace before mapping", () => {
    expect(mapStage("  مكتملة  ")).toBe("مكتملة");
  });

  it("falls back to the default for a totally unknown value", () => {
    expect(mapStage("zzz-unknown-zzz")).toBe("قيد التواصل");
  });

  it("every STAGE_MAP value is itself a canonical stage (identity-stable)", () => {
    for (const value of Object.values(STAGE_MAP)) {
      expect(mapStage(value)).toBe(value);
    }
  });
});

describe("mapSource", () => {
  it("returns fallback for empty input", () => {
    expect(mapSource("")).toBe("اخرى");
    expect(mapSource("  ")).toBe("اخرى");
  });

  it("maps known external sources", () => {
    expect(mapSource("شراكة")).toBe("تسويق بالعمولة");
    expect(mapSource("توصية")).toBe("من طرف عميل");
    expect(mapSource("إعلانات")).toBe("حملة اعلانية");
  });

  it("passes through canonical sources", () => {
    expect(mapSource("حملة اعلانية")).toBe("حملة اعلانية");
    expect(mapSource("من الدعم")).toBe("من الدعم");
  });

  it("uses a custom fallback for unknown values", () => {
    expect(mapSource("unknown", "من ارقام عشوائية")).toBe("من ارقام عشوائية");
  });

  it("every SOURCE_MAP value maps to itself", () => {
    for (const value of Object.values(SOURCE_MAP)) {
      expect(mapSource(value)).toBe(value);
    }
  });
});

describe("mapRenewalStatus", () => {
  it("returns fallback for empty input", () => {
    expect(mapRenewalStatus("")).toBe("مجدول");
    expect(mapRenewalStatus("   ")).toBe("مجدول");
  });

  it("maps known external statuses", () => {
    expect(mapRenewalStatus("قيد الانتظار")).toBe("جاري المتابعة");
    expect(mapRenewalStatus("ملغي")).toBe("ملغي بسبب");
    expect(mapRenewalStatus("مكتمل")).toBe("مكتمل");
  });

  it("uses fallback for an unknown status", () => {
    expect(mapRenewalStatus("xyz")).toBe("مجدول");
    expect(mapRenewalStatus("xyz", "مكتمل")).toBe("مكتمل");
  });

  it("every RENEWAL_STATUS_MAP value maps to itself", () => {
    for (const value of Object.values(RENEWAL_STATUS_MAP)) {
      expect(mapRenewalStatus(value)).toBe(value);
    }
  });
});
