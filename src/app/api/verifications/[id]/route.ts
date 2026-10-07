import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";

export const runtime = "nodejs";

async function load(id: string, orgId: string) {
  const { data } = await supabaseAdmin.from("verification_requests").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  return data as (Record<string, unknown> & { assignee_id: string; status: string }) | null;
}

/**
 * PATCH /api/verifications/[id]
 *  - الموظف المكلَّف: { submit: true } — «خلّصت التحديث» (يرسله للمدير يراجع)
 *  - المدير: { reviewed: true }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await load(id, access.orgId);
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.reviewed === true) {
    if (!access.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data, error } = await supabaseAdmin.from("verification_requests")
      .update({ status: "reviewed", reviewed_at: now, updated_at: now }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data });
  }

  if (existing.assignee_id !== access.userId) return NextResponse.json({ error: "هذا الطلب مو لك" }, { status: 403 });
  if (existing.status === "reviewed") return NextResponse.json({ error: "الطلب تمت مراجعته ومقفل" }, { status: 400 });

  if (body.submit !== true) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const patch = { status: "answered", responded_at: now, updated_at: now };
  const { data, error } = await supabaseAdmin.from("verification_requests").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}

/** DELETE /api/verifications/[id] — المدير فقط. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin.from("verification_requests").delete().eq("id", id).eq("org_id", access.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
