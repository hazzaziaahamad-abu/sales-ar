import {
  signCardToken,
  verifyCardToken,
  buildCardUrl,
  appBaseUrl,
  type CardPayload,
} from "@/lib/tasks/card";

const payload: CardPayload = {
  t: "performance",
  title: "أداء الأسبوع",
  name: "علي",
  stats: [
    { label: "الإيراد", value: "12K", tone: "good" },
    { label: "الصفقات", value: "4", tone: "neutral" },
  ],
  org: "CommandCenter",
};

describe("signCardToken / verifyCardToken", () => {
  it("round-trips a payload through sign then verify", () => {
    const token = signCardToken(payload);
    expect(token).toContain(".");
    const decoded = verifyCardToken(token);
    expect(decoded).toEqual(payload);
  });

  it("produces a URL-safe token (no +, /, or = characters)", () => {
    const token = signCardToken(payload);
    expect(token).not.toMatch(/[+/=]/);
  });

  it("rejects a token with no separator", () => {
    expect(verifyCardToken("notoken")).toBeNull();
  });

  it("rejects a token whose signature was tampered with", () => {
    const token = signCardToken(payload);
    const [data] = token.split(".");
    const forged = `${data}.AAAABBBBCCCC`;
    expect(verifyCardToken(forged)).toBeNull();
  });

  it("rejects a token whose payload was tampered with (signature mismatch)", () => {
    const token = signCardToken(payload);
    const sig = token.slice(token.lastIndexOf(".") + 1);
    const forgedData = Buffer.from(JSON.stringify({ ...payload, title: "مزيّف" }), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(verifyCardToken(`${forgedData}.${sig}`)).toBeNull();
  });

  it("two different payloads produce different tokens", () => {
    const a = signCardToken(payload);
    const b = signCardToken({ ...payload, title: "مختلف" });
    expect(a).not.toBe(b);
  });
});

describe("buildCardUrl / appBaseUrl", () => {
  it("builds a URL pointing at the task-card render route with an encoded token", () => {
    const url = buildCardUrl(payload);
    expect(url).toContain("/api/render/task-card?token=");
    // The token in the URL should verify back to the original payload
    const token = decodeURIComponent(url.split("token=")[1]);
    expect(verifyCardToken(token)).toEqual(payload);
  });

  it("strips trailing slashes from the base URL", () => {
    const base = appBaseUrl();
    expect(base.endsWith("/")).toBe(false);
  });
});
