import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { MEETING_STATUSES } from "@/lib/meetings";
import { parseMeetingFields } from "../shared";

export const runtime = "nodejs";

/** التعديل والحذف: منشئ الاجتماع، أو السوبر أدمن ومدراء المتابعة اليومية. */
async function loadEditable(id: string) {
  const access = await getTicketAccess();
  if (!access) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: existing } = await supabaseAdmin
    .from("meetings")
    .select("id, created_by")
    .eq("id", id)
    .eq("org_id", access.orgId)
    .maybeSingle();
  if (!existing) return { error: NextResponse.json({ error: "غير موجود" }, { status: 404 }) };
  if (!access.isManager && existing.created_by !== access.userId) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { access };
}

/** PATCH /api/meetings/[id] → تعديل الحقول أو الحالة أو المحضر. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await loadEditable(id);
  if (res.error) return res.error;

  const body = await req.json().catch(() => ({}));
  const parsed = parseMeetingFields(body, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const patch: Record<string, unknown> = { ...parsed.fields, updated_at: new Date().toISOString(), updated_by_name: res.access.name };
  if (MEETING_STATUSES.includes(body.status)) patch.status = body.status;

  const { data, error } = await supabaseAdmin.from("meetings").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meeting: data });
}

/** DELETE /api/meetings/[id] */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const res = await loadEditable(id);
  if (res.error) return res.error;

  const { error } = await supabaseAdmin.from("meetings").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
