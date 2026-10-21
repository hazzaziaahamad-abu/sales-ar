import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MEMBERSHIP_COLS, type MembershipRow } from "@/lib/salon-growth";
import { getSalonAccess, parseMembership, toNum } from "../shared";

export const runtime = "nodejs";

/** POST /api/salon-growth/memberships → باقة عضوية جديدة. */
export async function POST(req: NextRequest) {
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const parsed = parseMembership(b, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data: last } = await supabaseAdmin
    .from("salon_memberships").select("sort_order").eq("org_id", access.orgId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("salon_memberships")
    .insert({ ...parsed.fields, org_id: access.orgId, sort_order: (last?.sort_order ?? -1) + 1 })
    .select(MEMBERSHIP_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ membership: toNum(data as MembershipRow, ["price", "members"]) });
}
