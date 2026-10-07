import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { GENERAL, type VerifyItem } from "@/lib/verifications";
import { buildItems, currentState, parseFilters } from "@/lib/verifications-server";

export const runtime = "nodejs";

/**
 * GET /api/verifications → المدير: كل الطلبات؛ الموظف: طلباته فقط. مع تقدّم كل طلب
 * (كم عميل تحدّث في النظام بعد إرسال الطلب).
 * GET /api/verifications?preview=1&template=… → المدير: عدد العملاء اللي ينطبق عليهم التقرير.
 */
export async function GET(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  if (sp.get("preview")) {
    if (!access.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const f = parseFilters(Object.fromEntries(sp));
    if (!f.template) return NextResponse.json({ error: "اختر نوع التقرير" }, { status: 400 });
    try {
      const items = await buildItems(access.orgId, f.template, f.scope, f.staleDays, f.rep);
      return NextResponse.json({ count: items.length, value: items.reduce((a, it) => a + (Number(it.value) || 0), 0) });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر الحساب" }, { status: 500 });
    }
  }

  let q = supabaseAdmin.from("verification_requests").select("*").eq("org_id", access.orgId)
    .order("created_at", { ascending: false }).limit(60);
  if (!access.isManager) q = q.eq("assignee_id", access.userId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { items: VerifyItem[]; created_at: string; params: { chosen_at?: string }; updated_ids?: string[] }[];
  if (rows.length) {
    const { status, notes } = await currentState(access.orgId, rows);
    for (const r of rows) {
      // الطلب العام: التقدّم يبدأ من وقت ما اختار الموظف
      const sentAt = new Date(r.params?.chosen_at ?? r.created_at).getTime();
      // «تحدّث» = انضاف تعليق في سجله بعد إرسال الطلب، أو تغيّرت حالته، أو انحذف
      r.updated_ids = r.items.filter((it) => {
        if (!(it.entity_id in status)) return true;
        if (status[it.entity_id] !== it.system_status) return true;
        const note = notes.get(it.entity_id);
        return !!note && new Date(note).getTime() > sentAt;
      }).map((it) => it.entity_id);
    }
  }
  return NextResponse.json({ requests: rows, me: { id: access.userId, isManager: access.isManager } });
}

/** POST /api/verifications → المدير يرسل طلب تحقق. */
export async function POST(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const isGeneral = body.template === GENERAL;
  const { template, scope, staleDays, rep } = parseFilters(body);
  const assigneeId = typeof body.assignee_id === "string" ? body.assignee_id : "";
  const dueAt = typeof body.due_at === "string" && !Number.isNaN(Date.parse(body.due_at)) ? new Date(body.due_at).toISOString() : null;
  if ((!template && !isGeneral) || !assigneeId) return NextResponse.json({ error: "اختر نوع التقرير والموظف" }, { status: 400 });

  const { data: assignee } = await supabaseAdmin.from("user_profiles").select("id, name, org_id").eq("id", assigneeId).maybeSingle();
  if (!assignee || assignee.org_id !== access.orgId) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 400 });

  // الطلب العام: القائمة تنبني لما يختار الموظف النوع
  let items: VerifyItem[] = [];
  if (!isGeneral && template) try {
    items = await buildItems(access.orgId, template, scope, staleDays, rep);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر تجهيز القائمة" }, { status: 500 });
  }
  if (!isGeneral && items.length === 0) return NextResponse.json({ error: "ما فيه عملاء ينطبق عليهم هالتقرير حالياً" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("verification_requests").insert({
    org_id: access.orgId, template: isGeneral ? GENERAL : template, scope: isGeneral ? "all" : scope,
    params: { ...(staleDays ? { stale_days: staleDays } : {}), ...(rep ? { rep } : {}) },
    assignee_id: assignee.id, assignee_name: assignee.name, note: String(body.note ?? "").trim().slice(0, 1000) || null,
    due_at: dueAt, items, created_by: access.userId, created_by_name: access.name,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
