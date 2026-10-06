import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";

export const runtime = "nodejs";

/** DELETE /api/achievements/[id] → حذف إنجاز يدوي (صاحبه أو المدراء). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const { data: existing } = await supabaseAdmin
    .from("achievements").select("id, created_by").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (!access.isManager && existing.created_by !== access.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin.from("achievements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
