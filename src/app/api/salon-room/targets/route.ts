import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoomAccess } from "@/lib/api/salon-room-auth";
import { parseTargets } from "../shared";

export const runtime = "nodejs";

/** PUT /api/salon-room/targets { contacts, meetings, contracts } → أهداف الفريق الأسبوعية. */
export async function PUT(req: NextRequest) {
  const access = await getRoomAccess(req);
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const targets = parseTargets(b);
  const { error } = await supabaseAdmin.from("consult_room_settings").update({ targets }).eq("org_id", access.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ targets });
}
