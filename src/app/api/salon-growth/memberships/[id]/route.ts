import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MEMBERSHIP_COLS, type MembershipRow } from "@/lib/salon-growth";
import { getSalonAccess, parseMembership, toNum } from "../../shared";

export const runtime = "nodejs";

/** PATCH /api/salon-growth/memberships/[id] { active?, members?, name?… } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const parsed = parseMembership(b, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("salon_memberships").update({ ...parsed.fields, updated_at: new Date().toISOString() })
    .eq("id", id).eq("org_id", access.orgId).select(MEMBERSHIP_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ membership: toNum(data as MembershipRow, ["price", "members"]) });
}

/** DELETE /api/salon-growth/memberships/[id] → حذف باقة (المدراء فقط). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  if (!access.isManager) return NextResponse.json({ error: "الحذف للمدراء فقط" }, { status: 403 });
  const { error } = await supabaseAdmin.from("salon_memberships").delete().eq("id", id).eq("org_id", access.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
