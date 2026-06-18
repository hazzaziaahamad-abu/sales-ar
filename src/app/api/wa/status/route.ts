import { NextRequest, NextResponse } from "next/server";
import { getOrgSnapshot, isWaConfigured } from "@/lib/wa/client";
import { requireUser } from "../_auth";

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  if (!isWaConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp gateway is not configured" },
      { status: 503 }
    );
  }

  try {
    const { session, qr } = await getOrgSnapshot(orgId);
    if (!session) {
      return NextResponse.json({ status: "disconnected", session: null, qr: null });
    }
    return NextResponse.json({
      status: session.status,
      phone: session.phone ?? null,
      pushName: session.pushName ?? null,
      qr,
      session,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gateway error";
    // Surface rate-limiting distinctly so the client can back off.
    const status = msg.includes("429") ? 429 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
