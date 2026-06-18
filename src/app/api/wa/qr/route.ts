import { NextResponse } from "next/server";
import { getQr, getSession, isWaConfigured } from "@/lib/wa/client";
import { requireUser } from "../_auth";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isWaConfigured()) {
    return NextResponse.json(
      { error: "WhatsApp gateway is not configured" },
      { status: 503 }
    );
  }

  try {
    const session = await getSession();
    // Already connected — no QR to show.
    if (session?.status === "CONNECTED") {
      return NextResponse.json({ status: "CONNECTED", qr: null });
    }
    const qr = await getQr();
    return NextResponse.json({ status: session?.status ?? "DISCONNECTED", qr });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway error" },
      { status: 502 }
    );
  }
}
