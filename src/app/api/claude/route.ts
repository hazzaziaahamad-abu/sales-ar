import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { model, max_tokens = 1000, system, messages } = body;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens, system, messages }),
  });

  const data = await r.text();
  return new NextResponse(data, {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}
