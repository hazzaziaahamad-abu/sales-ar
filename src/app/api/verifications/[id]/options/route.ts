import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { GENERAL } from "@/lib/verifications";
import { optionCounts } from "@/lib/verifications-server";

export const runtime = "nodejs";

/** GET /api/verifications/[id]/options → «طلب عام»: عدد العملاء لكل نوع، عشان الموظف يختار. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { data: r } = await supabaseAdmin.from("verification_requests")
    .select("assignee_id, template, params").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!r) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  if (!access.isManager && r.assignee_id !== access.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (r.template !== GENERAL) return NextResponse.json({ error: "الطلب مو عام" }, { status: 400 });
  try {
    const params = (r.params ?? {}) as { rep?: string; stale_days?: number };
    return NextResponse.json({ options: await optionCounts(access.orgId, params.rep ?? "", params.stale_days ?? null) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر الحساب" }, { status: 500 });
  }
}
