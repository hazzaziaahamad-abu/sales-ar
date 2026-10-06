import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { NO_CONTACT, statusOptions, type VerifyItem, type VerifyResponse, type VerifyApplied } from "@/lib/verifications";

export const runtime = "nodejs";

/**
 * POST /api/verifications/[id]/apply  { entity_id }
 * المدير يحدّث النظام مباشرة بحالة الموظف لعنصر مختلف — ويتسجّل في الطلب (applied).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const entityId = String(body.entity_id ?? "");

  const { data: request } = await supabaseAdmin.from("verification_requests").select("*").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!request) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const item = (request.items as VerifyItem[]).find((it) => it.entity_id === entityId);
  const response = (request.responses as Record<string, VerifyResponse>)[entityId];
  if (!item || !response?.status || response.status === NO_CONTACT || !statusOptions(item.entity_type).includes(response.status)) {
    return NextResponse.json({ error: "ما فيه رد صالح لهالعميل" }, { status: 400 });
  }

  const now = new Date().toISOString();
  let from: string | null = null;
  if (item.entity_type === "deal") {
    const { data: deal } = await supabaseAdmin.from("deals").select("id, stage, close_date").eq("id", entityId).eq("org_id", access.orgId).maybeSingle();
    if (!deal) return NextResponse.json({ error: "الصفقة غير موجودة" }, { status: 404 });
    from = deal.stage;
    const patch: Record<string, unknown> = { stage: response.status, updated_at: now };
    if (response.status === "مكتملة" && !deal.close_date) patch.close_date = now;
    const { error } = await supabaseAdmin.from("deals").update(patch).eq("id", entityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { data: renewal } = await supabaseAdmin.from("renewals").select("id, status").eq("id", entityId).eq("org_id", access.orgId).maybeSingle();
    if (!renewal) return NextResponse.json({ error: "التجديد غير موجود" }, { status: 404 });
    from = renewal.status;
    const { error } = await supabaseAdmin.from("renewals").update({ status: response.status, updated_at: now }).eq("id", entityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const applied: Record<string, VerifyApplied> = { ...(request.applied ?? {}), [entityId]: { from: from ?? "", to: response.status, by: access.name, at: now } };
  await supabaseAdmin.from("verification_requests").update({ applied, updated_at: now }).eq("id", id);

  // سجل العمليات (لو الجدول موجود) — ما نفشل التحديث لو تعذّر
  await supabaseAdmin.from("activity_logs").insert({
    org_id: access.orgId, user_name: access.name, action: "update",
    section: item.entity_type === "deal" ? "sales" : "renewals",
    section_label: item.entity_type === "deal" ? "المبيعات" : "التجديدات",
    entity_id: entityId, entity_title: item.name,
    details: `تغيير ${item.entity_type === "deal" ? "المرحلة" : "الحالة"}: ${from} ← ${response.status} (من طلب التحقق #${request.request_number})`,
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ ok: true, current: response.status, applied: applied[entityId] });
}
