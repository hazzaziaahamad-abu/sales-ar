import { NextResponse } from "next/server";
import { ensureSessionStarted, getQr, isWaConfigured } from "@/lib/wa/client";
import { requireUser } from "../_auth";

/** Ensure the session exists + is started, then return current status + QR. */
export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isWaConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp gateway is not configured" },
      { status: 503 }
    );
  }

  try {
    const session = await ensureSessionStarted();
    let qr = null;
    if (session?.status !== "CONNECTED") {
      qr = await getQr().catch(() => null);
    }
    return NextResponse.json({
      status: session?.status ?? "INITIALIZING",
      phoneNumber: session?.phoneNumber ?? null,
      qr,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway error" },
      { status: 502 }
    );
  }
}
