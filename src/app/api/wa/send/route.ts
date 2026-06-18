import { NextRequest, NextResponse } from "next/server";
import { sendText, isWaConfigured } from "@/lib/wa/client";
import { requireUser } from "../_auth";

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isWaConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp gateway is not configured" },
      { status: 503 }
    );
  }

  const { to, text } = await req.json().catch(() => ({}));
  if (!to || !text) {
    return NextResponse.json(
      { error: "Both 'to' (phone number) and 'text' are required" },
      { status: 400 }
    );
  }

  try {
    const result = await sendText(String(to), String(text));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway error" },
      { status: 502 }
    );
  }
}
