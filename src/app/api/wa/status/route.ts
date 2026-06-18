import { NextResponse } from "next/server";
import { getSession, isWaConfigured } from "@/lib/wa/client";
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
    if (!session) {
      return NextResponse.json({ status: "DISCONNECTED", session: null });
    }
    return NextResponse.json({
      status: session.status,
      phoneNumber: session.phoneNumber ?? null,
      session,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gateway error" },
      { status: 502 }
    );
  }
}
