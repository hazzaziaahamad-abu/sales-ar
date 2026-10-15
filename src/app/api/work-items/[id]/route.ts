import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSliceAccess } from "@/lib/api/focus-slices-access";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const COLS = "id, title, notes, done_at, sort_order, created_at";

async function own(id: string) {
  const access = await getSliceAccess("work");
  if (access instanceof NextResponse) return { res: access };
  const { data } = await supabaseAdmin
    .from("work_items").select("id").eq("id", id).eq("org_id", access.orgId).eq("user_id", access.userId).maybeSingle();
  if (!data) return { res: NextResponse.json({ error: "غير موجود" }, { status: 404 }) };
  return {};
}

/** PATCH /api/work-items/[id] { title?, notes?, done? } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { res } = await own(id);
  if (res) return res;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.title === "string") {
    const t = b.title.replace(/\s+/g, " ").trim().slice(0, 200);
    if (!t) return NextResponse.json({ error: "اكتب البند" }, { status: 400 });
    patch.title = t;
  }
  if (typeof b.notes === "string") patch.notes = b.notes.trim().slice(0, 3000);
  if (typeof b.done === "boolean") patch.done_at = b.done ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin.from("work_items").update(patch).eq("id", id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { res } = await own(id);
  if (res) return res;
  const { error } = await supabaseAdmin.from("work_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
