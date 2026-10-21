import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { APPT_COLS, CLIENT_COLS } from "@/lib/salon-growth";
import { getSalonAccess, parseNewAppointment, toNum } from "../shared";

export const runtime = "nodejs";

/** POST /api/salon-growth/appointments → حجز جديد أو حضور مباشر (وتسجيل العميلة برقمها لو جديدة). */
export async function POST(req: NextRequest) {
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const parsed = parseNewAppointment(b);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.fields as { client_name: string; phone: string };

  // العميلة: نفس الرقم = نفس العميلة (نحتفظ باسمها المسجّل)
  let { data: client } = await supabaseAdmin
    .from("salon_clients").select(CLIENT_COLS).eq("org_id", access.orgId).eq("phone", f.phone).maybeSingle();
  if (!client) {
    const ins = await supabaseAdmin
      .from("salon_clients").insert({ org_id: access.orgId, name: f.client_name, phone: f.phone })
      .select(CLIENT_COLS).single();
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
    client = ins.data;
  }

  const { data, error } = await supabaseAdmin
    .from("salon_appointments")
    .insert({ ...parsed.fields, org_id: access.orgId, client_id: client.id, created_by: access.userId })
    .select(APPT_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    appointment: toNum(data, ["price", "duration_minutes"]),
    client: toNum(client, ["total_spent", "visits"]),
  });
}
