import { NextRequest, NextResponse } from "next/server";
import { deleteOrgSession, isWaConfigured } from "@/lib/wa/client";
import { requireUser } from "../_auth";

/**
 * Disconnect an org's WhatsApp number. Deletes the org's session on the
 * gateway so a subsequent /connect creates a fresh session and shows a new
 * QR — i.e. lets you switch to a different number. Only ever touches the
 * `dash-org-<orgId>` session, never the legacy session.
 */
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
    const ok = await deleteOrgSession(String(orgId));
    return NextResponse.json({ ok });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway error" },
      { status: 502 }
    );
  }
}
