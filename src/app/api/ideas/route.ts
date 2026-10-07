import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getIdeasAccess } from "@/lib/api/ideas-access";

export const runtime = "nodejs";

/** GET /api/ideas → أفكار المستخدم نفسه (البذور خاصة بصاحبها). */
export async function GET() {
  const access = await getIdeasAccess();
  if (access instanceof NextResponse) return access;

  const { data, error } = await supabaseAdmin
    .from("ideas")
    .select("id, text, notes, stage, plan, touches, last_touched_at, wilted_at, created_at")
    .eq("org_id", access.orgId).eq("user_id", access.userId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ideas: data ?? [] });
}

/** POST /api/ideas → رمي بذرة جديدة. */
export async function POST(req: NextRequest) {
  const access = await getIdeasAccess();
  if (access instanceof NextResponse) return access;

  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "اكتب الفكرة" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("ideas")
    .insert({ org_id: access.orgId, user_id: access.userId, text: text.slice(0, 1000) })
    .select("id, text, notes, stage, plan, touches, last_touched_at, wilted_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ idea: data });
}
