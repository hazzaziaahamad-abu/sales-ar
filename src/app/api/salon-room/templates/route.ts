import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoomAccess } from "@/lib/api/salon-room-auth";
import { MEETING_KIND_IDS, type MeetingKind } from "@/lib/salon-room-meetings";
import { parseTemplates } from "../shared";

export const runtime = "nodejs";

/** PUT /api/salon-room/templates { kind, agenda | null } → حفظ أجندة افتراضية لنوع اجتماع (null = رجوع للقالب المدمج). */
export async function PUT(req: NextRequest) {
  const access = await getRoomAccess(req);
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const kind = b.kind as MeetingKind;
  if (!MEETING_KIND_IDS.includes(kind)) return NextResponse.json({ error: "نوع غير صالح" }, { status: 400 });
  const { data: row } = await supabaseAdmin.from("consult_room_settings").select("meeting_templates").eq("org_id", access.orgId).maybeSingle();
  const templates = parseTemplates(row?.meeting_templates);
  if (b.agenda === null) delete templates[kind];
  else {
    const parsed = parseTemplates({ [kind]: b.agenda })[kind];
    if (!parsed) return NextResponse.json({ error: "أجندة غير صالحة" }, { status: 400 });
    templates[kind] = parsed;
  }
  const { error } = await supabaseAdmin.from("consult_room_settings").update({ meeting_templates: templates }).eq("org_id", access.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates });
}
