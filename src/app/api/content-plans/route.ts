import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMemberContext, sanitizePlanPatch } from "@/lib/content-plans/server";

export const runtime = "nodejs";

/** GET /api/content-plans?org=<id> → خطط المحتوى للمنظمة مع عدد العناصر. */
export async function GET(req: NextRequest) {
  const member = await getMemberContext();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = req.nextUrl.searchParams.get("org") || member.orgId;
  if (!orgId || !member.canAccessOrg(orgId)) return NextResponse.json({ plans: [] });

  const { data: plans, error } = await supabaseAdmin
    .from("content_plans")
    .select("*, content_items(count)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    plans: (plans ?? []).map(({ content_items, ...p }) => ({
      ...p,
      items_count: (content_items as { count: number }[] | null)?.[0]?.count ?? 0,
    })),
  });
}

/** POST /api/content-plans { org, title, ... } → إنشاء خطة محتوى. */
export async function POST(req: NextRequest) {
  const member = await getMemberContext();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const orgId = (typeof b.org === "string" && b.org) || member.orgId;
  if (!orgId || !member.canAccessOrg(orgId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const fields = sanitizePlanPatch(b, true);
  if (typeof fields.title !== "string" || !fields.title.trim()) {
    return NextResponse.json({ error: "العنوان مطلوب" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("content_plans")
    .insert({ ...fields, org_id: orgId, created_by: member.userId, created_by_name: member.name })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
