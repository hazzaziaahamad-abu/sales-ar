import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isStickerKind } from "@/lib/idea-stickers";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** صاحب الاستكر أو المدراء فقط يعدّلون ويحذفون. */
async function ownStickerAccess(id: string) {
  const access = await getTicketAccess();
  if (!access) return { res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: existing } = await supabaseAdmin
    .from("idea_stickers").select("id, created_by").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!existing) return { res: NextResponse.json({ error: "غير موجود" }, { status: 404 }) };
  if (!access.isManager && existing.created_by !== access.userId) {
    return { res: NextResponse.json({ error: "تقدر تعدّل أفكارك فقط" }, { status: 403 }) };
  }
  return { access };
}

/** PATCH /api/idea-stickers/[id] { kind?, tag?, title?, body?, notes? } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { res } = await ownStickerAccess(id);
  if (res) return res;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isStickerKind(b.kind)) patch.kind = b.kind;
  if (typeof b.tag === "string") patch.tag = b.tag.trim().slice(0, 60);
  if (typeof b.title === "string") patch.title = b.title.trim().slice(0, 200);
  if (typeof b.body === "string") patch.body = b.body.trim().slice(0, 3000);
  // ملاحظات الاجتماع (ورقة التطوير) — تتحفظ تلقائياً أثناء الكتابة
  if (typeof b.notes === "string") patch.notes = b.notes.slice(0, 20000);
  const { data, error } = await supabaseAdmin.from("idea_stickers").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sticker: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { res } = await ownStickerAccess(id);
  if (res) return res;
  const { error } = await supabaseAdmin.from("idea_stickers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
