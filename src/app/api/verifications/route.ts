import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { saudiDateStr } from "@/lib/utils/format";
import { TEMPLATE_KEYS, type VerifyItem, type VerifyScope, type VerifyTemplate } from "@/lib/verifications";

export const runtime = "nodejs";

const CLOSED_DEAL = ["مكتملة", "مرفوض مع سبب", "استهداف خاطئ", "كنسل التجربة"];
// «بدون تواصل»: نركّز على المراحل النشطة في خط المبيعات
const ACTIVE_DEAL = ["عميل جديد", "تفاوض", "تجهيز", "انتظار الدفع", "تم إرسال العرض", "تجريبي"];
const CLOSED_RENEWAL = ["مكتمل", "ملغي بسبب"];
const MAX_ITEMS = 100;

/** يجهّز لقطة القائمة حسب القالب والقسم. */
async function buildItems(orgId: string, template: VerifyTemplate, scope: VerifyScope, staleDays: number): Promise<VerifyItem[]> {
  if (template === "renewals_week") {
    const today = saudiDateStr();
    const until = saudiDateStr(new Date(Date.now() + 7 * 86_400_000));
    const since = saudiDateStr(new Date(Date.now() - 30 * 86_400_000));
    let q = supabaseAdmin.from("renewals")
      .select("id, customer_name, customer_phone, assigned_rep, plan_name, plan_price, renewal_date, status, updated_at")
      .eq("org_id", orgId).gte("renewal_date", since).lte("renewal_date", until)
      .not("status", "in", `(${CLOSED_RENEWAL.map((s) => `"${s}"`).join(",")})`)
      .order("renewal_date", { ascending: true }).limit(MAX_ITEMS);
    if (scope === "support") q = q.eq("sales_type", "support");
    if (scope === "office") q = q.or("sales_type.eq.office,sales_type.is.null");
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({
      entity_type: "renewal", entity_id: r.id, name: r.customer_name, phone: r.customer_phone ?? null,
      rep: r.assigned_rep ?? null, value: r.plan_price ?? 0, system_status: r.status,
      last_activity: r.updated_at ?? null,
      extra: `${r.plan_name ?? ""} · موعد التجديد ${r.renewal_date}${r.renewal_date < today ? " (متأخر)" : ""}`,
    }));
  }

  let q = supabaseAdmin.from("deals")
    .select("id, client_name, client_phone, assigned_rep_name, deal_value, plan, stage, last_contact, updated_at, created_at")
    .eq("org_id", orgId);
  if (scope === "support") q = q.eq("sales_type", "support");
  if (scope === "office") q = q.or("sales_type.eq.office,sales_type.is.null");
  if (template === "trial") q = q.eq("stage", "تجريبي");
  else if (template === "awaiting_payment") q = q.eq("stage", "انتظار الدفع");
  else q = q.in("stage", ACTIVE_DEAL);
  const { data, error } = await q.order("updated_at", { ascending: true }).limit(2000);
  if (error) throw error;

  let rows = (data ?? []).filter((d) => !CLOSED_DEAL.includes(d.stage));
  const lastOf = (d: (typeof rows)[number]) => d.last_contact || d.updated_at || d.created_at;
  if (template === "stale") {
    const cutoff = Date.now() - staleDays * 86_400_000;
    rows = rows.filter((d) => new Date(lastOf(d)).getTime() < cutoff);
  }
  return rows.slice(0, MAX_ITEMS).map((d) => ({
    entity_type: "deal", entity_id: d.id, name: d.client_name, phone: d.client_phone ?? null,
    rep: d.assigned_rep_name ?? null, value: d.deal_value ?? 0, system_status: d.stage,
    last_activity: lastOf(d) ?? null, extra: d.plan ?? null,
  }));
}

/** الحالة الحالية في النظام لكل عنصر في الطلبات. */
async function currentStatuses(orgId: string, rows: { items: VerifyItem[] }[]) {
  const dealIds = new Set<string>(), renewalIds = new Set<string>();
  for (const r of rows) for (const it of r.items) (it.entity_type === "deal" ? dealIds : renewalIds).add(it.entity_id);
  const map: Record<string, string | null> = {};
  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  for (const ids of chunk([...dealIds], 200)) {
    const { data } = await supabaseAdmin.from("deals").select("id, stage").eq("org_id", orgId).in("id", ids);
    for (const d of data ?? []) map[d.id] = d.stage;
  }
  for (const ids of chunk([...renewalIds], 200)) {
    const { data } = await supabaseAdmin.from("renewals").select("id, status").eq("org_id", orgId).in("id", ids);
    for (const r of data ?? []) map[r.id] = r.status;
  }
  return map;
}

/** GET /api/verifications → المدير: كل الطلبات مع الحالة الحالية؛ الموظف: طلباته فقط. */
export async function GET() {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let q = supabaseAdmin.from("verification_requests").select("*").eq("org_id", access.orgId)
    .order("created_at", { ascending: false }).limit(60);
  if (!access.isManager) q = q.eq("assignee_id", access.userId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { items: VerifyItem[] }[];
  if (access.isManager && rows.length) {
    const current = await currentStatuses(access.orgId, rows);
    for (const r of rows as (typeof rows[number] & { current?: Record<string, string | null> })[]) {
      r.current = Object.fromEntries(r.items.map((it) => [it.entity_id, current[it.entity_id] ?? null]));
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
  const template = TEMPLATE_KEYS.includes(body.template) ? (body.template as VerifyTemplate) : null;
  const scope: VerifyScope = ["support", "office", "all"].includes(body.scope) ? body.scope : "all";
  const staleDays = Math.min(Math.max(Number(body.stale_days) || 7, 1), 90);
  const assigneeId = typeof body.assignee_id === "string" ? body.assignee_id : "";
  const dueAt = typeof body.due_at === "string" && !Number.isNaN(Date.parse(body.due_at)) ? new Date(body.due_at).toISOString() : null;
  if (!template || !assigneeId) return NextResponse.json({ error: "اختر نوع التقرير والموظف" }, { status: 400 });

  const { data: assignee } = await supabaseAdmin.from("user_profiles").select("id, name, org_id").eq("id", assigneeId).maybeSingle();
  if (!assignee || assignee.org_id !== access.orgId) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 400 });

  let items: VerifyItem[];
  try {
    items = await buildItems(access.orgId, template, scope, staleDays);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر تجهيز القائمة" }, { status: 500 });
  }
  if (items.length === 0) return NextResponse.json({ error: "ما فيه عملاء ينطبق عليهم هالتقرير حالياً" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("verification_requests").insert({
    org_id: access.orgId, template, scope, params: template === "stale" ? { stale_days: staleDays } : {},
    assignee_id: assignee.id, assignee_name: assignee.name, note: String(body.note ?? "").trim().slice(0, 1000) || null,
    due_at: dueAt, items, created_by: access.userId, created_by_name: access.name,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
