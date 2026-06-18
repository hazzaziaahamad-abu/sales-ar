import { NextRequest, NextResponse } from "next/server";
import { ensureOrgSession, getOrgQr, isConnectedStatus, isWaConfigured } from "@/lib/wa/client";
import { requireUser } from "../_auth";

/** Ensure the org's session exists + is started, then return status + QR. */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await req.json().catch(() => ({}));
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  if (!isWaConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp gateway is not configured" },
      { status: 503 }
    );
  }

  try {
    const session = await ensureOrgSession(orgId);
    let qr = null;
    if (!isConnectedStatus(session?.status)) {
      qr = await getOrgQr(orgId).catch(() => null);
    }
    return NextResponse.json({
      status: session?.status ?? "initializing",
      phone: session?.phone ?? null,
      pushName: session?.pushName ?? null,
      qr,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway error" },
      { status: 502 }
    );
  }
}
