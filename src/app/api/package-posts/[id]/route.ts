import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isTemplateId } from "@/lib/package-posts/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** سقف حجم البوست (مع الصور المرفوعة كـ data URL). */
const MAX_BYTES = 4_000_000;

/** PUT /api/package-posts/[id] { ...PostData } → إنشاء أو تحديث (upsert). */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "حجم البوست كبير — صغّر الصور المرفوعة" }, { status: 413 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 }); }
  if (!isTemplateId(body.template)) return NextResponse.json({ error: "قالب غير معروف" }, { status: 400 });

  // ما نسمح بنقل بوست من منظمة لثانية
  const { data: existing } = await supabaseAdmin
    .from("package_posts").select("org_id").eq("id", id).maybeSingle();
  if (existing && existing.org_id !== access.orgId) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const now = new Date().toISOString();
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : "";
  const data = { ...body, id, updatedAt: now };
  const row = existing
    ? { template: body.template, title, data, updated_by: access.userId, updated_at: now }
    : { id, org_id: access.orgId, template: body.template, title, data, created_by: access.userId, updated_by: access.userId, updated_at: now };
  const q = existing
    ? supabaseAdmin.from("package_posts").update(row).eq("id", id).eq("org_id", access.orgId)
    : supabaseAdmin.from("package_posts").insert(row);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  return NextResponse.json({ ok: true, updatedAt: now });
}

/** DELETE /api/package-posts/[id] */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabaseAdmin.from("package_posts").delete().eq("id", id).eq("org_id", access.orgId);
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  return NextResponse.json({ ok: true });
}
