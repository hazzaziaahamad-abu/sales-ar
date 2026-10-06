import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";

export const runtime = "nodejs";

async function ticketInOrg(id: string, orgId: string) {
  const { data } = await supabaseAdmin.from("work_tickets").select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
  return !!data;
}

/** GET /api/work-tickets/[id]/events → سجل التذكرة (الأقدم أولاً). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await ticketInOrg(id, access.orgId))) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("work_ticket_events")
    .select("id, event_type, body, actor_name, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

/** POST /api/work-tickets/[id]/events  { body } → تعليق (لأي مستخدم في المنظمة). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!(await ticketInOrg(id, access.orgId))) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });

  const payload = await req.json().catch(() => ({}));
  const text = String(payload.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "التعليق فاضي" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("work_ticket_events")
    .insert({ ticket_id: id, org_id: access.orgId, event_type: "comment", body: text.slice(0, 2000), actor_name: access.name })
    .select("id, event_type, body, actor_name, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("work_tickets").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ event: data });
}
