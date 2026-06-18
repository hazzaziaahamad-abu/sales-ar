import { ImageResponse } from "next/og";
import { verifyCardToken, type CardPayload } from "@/lib/tasks/card";

export const runtime = "nodejs";

// Cache the Arabic font across invocations within a warm runtime.
let _fontPromise: Promise<ArrayBuffer | null> | null = null;

async function loadArabicFont(): Promise<ArrayBuffer | null> {
  if (_fontPromise) return _fontPromise;
  _fontPromise = (async () => {
    try {
      // Old-style UA makes Google Fonts serve a TTF (satori can't read woff2).
      const css = await fetch(
        "https://fonts.googleapis.com/css2?family=Cairo:wght@700",
        { headers: { "User-Agent": "Mozilla/5.0 (compatible)" } }
      ).then((r) => r.text());
      const url = css.match(/src:\s*url\((.+?)\)\s*format\(['"]?(truetype|opentype)['"]?\)/)?.[1];
      if (!url) return null;
      return await fetch(url).then((r) => r.arrayBuffer());
    } catch {
      return null;
    }
  })();
  return _fontPromise;
}

const TONE_COLOR: Record<string, string> = {
  good: "#10B981",
  bad: "#EF4444",
  neutral: "#00D4FF",
};

const ACCENT: Record<CardPayload["t"], string> = {
  performance: "#EF4444",
  announcement: "#00D4FF",
  reminder: "#F59E0B",
};

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  const payload = verifyCardToken(token);
  if (!payload) {
    return new Response("Invalid or missing token", { status: 401 });
  }

  const font = await loadArabicFont();
  const accent = ACCENT[payload.t] ?? "#00D4FF";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          direction: "rtl",
          background: "linear-gradient(135deg, #0b1220 0%, #111a2e 100%)",
          color: "#e8eefc",
          padding: 56,
          fontFamily: "Cairo, sans-serif",
        }}
      >
        {/* accent bar */}
        <div style={{ display: "flex", width: 90, height: 8, background: accent, borderRadius: 8 }} />

        <div style={{ display: "flex", flexDirection: "column", marginTop: 28 }}>
          <div style={{ display: "flex", fontSize: 30, color: accent, fontWeight: 700 }}>
            {payload.title}
          </div>
          {payload.name ? (
            <div style={{ display: "flex", fontSize: 52, fontWeight: 700, marginTop: 6 }}>
              {payload.name}
            </div>
          ) : null}
          {payload.body ? (
            <div style={{ display: "flex", fontSize: 28, color: "#aab6d4", marginTop: 14 }}>
              {payload.body}
            </div>
          ) : null}
        </div>

        {/* stats */}
        {payload.stats && payload.stats.length > 0 ? (
          <div style={{ display: "flex", gap: 20, marginTop: "auto" }}>
            {payload.stats.slice(0, 4).map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 18,
                  padding: "20px 22px",
                }}
              >
                <div style={{ display: "flex", fontSize: 22, color: "#8da0c4" }}>{s.label}</div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 40,
                    fontWeight: 700,
                    marginTop: 8,
                    color: TONE_COLOR[s.tone ?? "neutral"],
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {payload.org ? (
          <div style={{ display: "flex", fontSize: 20, color: "#5f6f92", marginTop: 28 }}>
            {payload.org}
          </div>
        ) : null}
      </div>
    ),
    {
      width: 1000,
      height: 600,
      fonts: font
        ? [{ name: "Cairo", data: font, weight: 700 as const, style: "normal" as const }]
        : undefined,
    }
  );
}
