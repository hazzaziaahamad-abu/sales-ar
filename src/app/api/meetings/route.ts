import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { parseMeetingFields } from "./shared";

export const runtime = "nodejs";

/** GET /api/meetings?from=YYYY-MM-DD&to=YYYY-MM-DD → اجتماعات الفترة. */
export async function GET(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  let query = supabaseAdmin
    .from("meetings")
    .select("*")
    .eq("org_id", access.orgId)
    .order("meeting_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(500);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("meeting_date", from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lte("meeting_date", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meetings: data ?? [], me: { id: access.userId, isManager: access.isManager } });
}

/** POST /api/meetings → جدولة اجتماع. */
export async function POST(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = parseMeetingFields(body, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("meetings")
    .insert({ ...parsed.fields, org_id: access.orgId, created_by: access.userId, created_by_name: access.name })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meeting: data });
}
