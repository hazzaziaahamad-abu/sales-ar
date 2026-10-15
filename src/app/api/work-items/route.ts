import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSliceAccess } from "@/lib/api/focus-slices-access";

export const runtime = "nodejs";

const COLS = "id, title, notes, done_at, sort_order, created_at";

/** GET /api/work-items → بنود «العمل الوظيفي» للمستخدم (السوبر أدمن فقط). */
export async function GET() {
  const access = await getSliceAccess("work");
  if (access instanceof NextResponse) return access;
  const { data, error } = await supabaseAdmin
    .from("work_items").select(COLS)
    .eq("org_id", access.orgId).eq("user_id", access.userId)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/work-items { title } → التقاط سريع لبند عمل. */
export async function POST(req: NextRequest) {
  const access = await getSliceAccess("work");
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const title = String(b.title ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!title) return NextResponse.json({ error: "اكتب البند" }, { status: 400 });
  const { data: last } = await supabaseAdmin
    .from("work_items").select("sort_order").eq("org_id", access.orgId).eq("user_id", access.userId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("work_items")
    .insert({ org_id: access.orgId, user_id: access.userId, title, sort_order: (last?.sort_order ?? -1) + 1 })
    .select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
