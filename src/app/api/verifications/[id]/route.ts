import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { NO_CONTACT, statusOptions, type VerifyItem, type VerifyResponse, type VerifyExtra } from "@/lib/verifications";

export const runtime = "nodejs";

async function load(id: string, orgId: string) {
  const { data } = await supabaseAdmin.from("verification_requests").select("*").eq("id", id).eq("org_id", orgId).maybeSingle();
  return data as (Record<string, unknown> & { assignee_id: string; status: string; items: VerifyItem[] }) | null;
}

/**
 * PATCH /api/verifications/[id]
 *  - الموظف المكلَّف: { responses, extras, submit? } — يحفظ الرد (وsubmit=true يرسله للمدير)
 *  - المدير: { reviewed: true }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await load(id, access.orgId);
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  if (body.reviewed === true) {
    if (!access.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { data, error } = await supabaseAdmin.from("verification_requests")
      .update({ status: "reviewed", reviewed_at: now, updated_at: now }).eq("id", id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data });
  }

  if (existing.assignee_id !== access.userId) return NextResponse.json({ error: "هذا الطلب مو لك" }, { status: 403 });
  if (existing.status === "reviewed") return NextResponse.json({ error: "الطلب تمت مراجعته ومقفل" }, { status: 400 });

  // تنظيف الردود: حالات صالحة فقط ولعناصر موجودة في الطلب
  const validIds = new Map(existing.items.map((it) => [it.entity_id, it.entity_type]));
  const responses: Record<string, VerifyResponse> = {};
  for (const [eid, r] of Object.entries((body.responses ?? {}) as Record<string, VerifyResponse>)) {
    const type = validIds.get(eid);
    if (!type || !r?.status) continue;
    if (r.status !== NO_CONTACT && !statusOptions(type).includes(r.status)) continue;
    responses[eid] = {
      status: r.status,
      note: String(r.note ?? "").trim().slice(0, 500) || undefined,
      last_contact: typeof r.last_contact === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.last_contact) ? r.last_contact : undefined,
    };
  }
  const extras: VerifyExtra[] = (Array.isArray(body.extras) ? body.extras : [])
    .map((x: VerifyExtra) => ({ name: String(x?.name ?? "").trim().slice(0, 120), status: String(x?.status ?? "").trim().slice(0, 60), note: String(x?.note ?? "").trim().slice(0, 300) || undefined }))
    .filter((x: VerifyExtra) => x.name)
    .slice(0, 50);

  const patch: Record<string, unknown> = { responses, extras, updated_at: now };
  if (body.submit === true) {
    patch.status = "answered";
    patch.responded_at = now;
  }
  const { data, error } = await supabaseAdmin.from("verification_requests").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}

/** DELETE /api/verifications/[id] — المدير فقط. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin.from("verification_requests").delete().eq("id", id).eq("org_id", access.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
