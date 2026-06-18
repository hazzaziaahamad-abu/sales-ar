import { NextRequest, NextResponse } from "next/server";
import { sendTextFromOrg, isWaConfigured } from "@/lib/wa/client";
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

  const { orgId, to, text } = await req.json().catch(() => ({}));
  if (!orgId || !to || !text) {
    return NextResponse.json(
      { error: "orgId, to (phone number) and text are required" },
      { status: 400 }
    );
  }

  try {
    const result = await sendTextFromOrg(String(orgId), String(to), String(text));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway error" },
      { status: 502 }
    );
  }
}
