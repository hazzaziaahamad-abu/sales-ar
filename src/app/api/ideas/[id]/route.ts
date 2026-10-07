import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getIdeasAccess } from "@/lib/api/ideas-access";
import { IDEA_STAGES, sanitizePlan } from "@/lib/ideas";

export const runtime = "nodejs";

const COLUMNS = "id, text, notes, stage, plan, touches, last_touched_at, wilted_at, created_at";

async function ownIdea(id: string) {
  const access = await getIdeasAccess();
  if (access instanceof NextResponse) return { error: access };
  const { data } = await supabaseAdmin
    .from("ideas").select("id, touches").eq("id", id).eq("org_id", access.orgId).eq("user_id", access.userId).maybeSingle();
  if (!data) return { error: NextResponse.json({ error: "غير موجودة" }, { status: 404 }) };
  return { idea: data };
}

/**
 * PATCH /api/ideas/[id] → تعديل الفكرة (النص، الملاحظات، المرحلة، الخطة) أو ذبولها/إحياؤها.
 * أي تعديل على المحتوى أو «سقي» (touch) يرفع حرارة الفكرة.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const own = await ownIdea(id);
  if (own.error) return own.error;

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (!text) return NextResponse.json({ error: "الفكرة ما تكون فاضية" }, { status: 400 });
    patch.text = text.slice(0, 1000);
  }
  if (typeof body.notes === "string") patch.notes = body.notes.trim().slice(0, 5000) || null;
  if (IDEA_STAGES.includes(body.stage)) patch.stage = body.stage;
  if (body.plan !== undefined) patch.plan = sanitizePlan(body.plan);

  const nurtured = Object.keys(patch).length > 0 || body.touch === true;
  if (nurtured) {
    patch.touches = own.idea.touches + 1;
    patch.last_touched_at = new Date().toISOString();
  }
  if (typeof body.wilted === "boolean") patch.wilted_at = body.wilted ? new Date().toISOString() : null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "ما فيه تعديل" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("ideas").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ idea: data });
}

/** DELETE /api/ideas/[id] → حذف نهائي. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const own = await ownIdea(id);
  if (own.error) return own.error;

  const { error } = await supabaseAdmin.from("ideas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
