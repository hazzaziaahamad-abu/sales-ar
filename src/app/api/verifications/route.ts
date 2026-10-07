import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { saudiDateStr } from "@/lib/utils/format";
import { TEMPLATES, TEMPLATE_KEYS, usesDays, REP_ALL, REP_NONE, type VerifyItem, type VerifyScope, type VerifyTemplate } from "@/lib/verifications";

export const runtime = "nodejs";

const CLOSED_DEAL = ["مكتملة", "مرفوض مع سبب", "استهداف خاطئ", "كنسل التجربة"];
// «بدون تواصل»: نركّز على المراحل النشطة في خط المبيعات
const ACTIVE_DEAL = ["عميل جديد", "تفاوض", "تجهيز", "انتظار الدفع", "تم إرسال العرض", "تجريبي"];
const CLOSED_RENEWAL = ["مكتمل", "ملغي بسبب"];
const MAX_ITEMS = 1000;

/** يجهّز لقطة القائمة حسب القالب والقسم. */
async function buildItems(orgId: string, template: VerifyTemplate, scope: VerifyScope, staleDays: number, rep: string): Promise<VerifyItem[]> {
  if (template === "renewals_awaiting_payment" || template === "renewals_following_stale") {
    const status = template === "renewals_awaiting_payment" ? "انتظار الدفع" : "جاري المتابعة";
    let q = supabaseAdmin.from("renewals")
      .select("id, customer_name, customer_phone, assigned_rep, plan_name, plan_price, renewal_date, status, updated_at")
      .eq("org_id", orgId).eq("status", status)
      .order("updated_at", { ascending: true }).limit(MAX_ITEMS);
    if (template === "renewals_following_stale") {
      q = q.lt("updated_at", new Date(Date.now() - staleDays * 86_400_000).toISOString());
    }
    if (scope === "support") q = q.eq("sales_type", "support");
    if (scope === "office") q = q.or("sales_type.eq.office,sales_type.is.null");
    if (rep === REP_NONE) q = q.is("assigned_rep", null);
    else if (rep) q = q.eq("assigned_rep", rep);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => {
      const idle = r.updated_at ? Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86_400_000) : null;
      return {
        entity_type: "renewal" as const, entity_id: r.id, name: r.customer_name, phone: r.customer_phone ?? null,
        rep: r.assigned_rep ?? null, value: r.plan_price ?? 0, system_status: r.status,
        last_activity: r.updated_at ?? null,
        extra: `${r.plan_name ?? ""} · موعد التجديد ${r.renewal_date}${idle !== null ? ` · بدون تحديث ${idle} يوم` : ""}`,
      };
    });
  }

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
    if (rep === REP_NONE) q = q.is("assigned_rep", null);
    else if (rep) q = q.eq("assigned_rep", rep);
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
  if (rep === REP_NONE) q = q.is("assigned_rep_name", null);
  else if (rep) q = q.eq("assigned_rep_name", rep);
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

/** الحالة وآخر تحديث في النظام لكل عنصر في الطلبات (العنصر المحذوف ما يرجع). */
async function currentState(orgId: string, rows: { items: VerifyItem[] }[]) {
  const dealIds = new Set<string>(), renewalIds = new Set<string>();
  for (const r of rows) for (const it of r.items) (it.entity_type === "deal" ? dealIds : renewalIds).add(it.entity_id);
  const map: Record<string, { status: string | null; updated_at: string | null }> = {};
  const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  for (const ids of chunk([...dealIds], 200)) {
    const { data } = await supabaseAdmin.from("deals").select("id, stage, updated_at").eq("org_id", orgId).in("id", ids);
    for (const d of data ?? []) map[d.id] = { status: d.stage, updated_at: d.updated_at };
  }
  for (const ids of chunk([...renewalIds], 200)) {
    const { data } = await supabaseAdmin.from("renewals").select("id, status, updated_at").eq("org_id", orgId).in("id", ids);
    for (const r of data ?? []) map[r.id] = { status: r.status, updated_at: r.updated_at };
  }
  return map;
}

/** الإعدادات المشتركة بين المعاينة وإنشاء الطلب. */
function parseFilters(src: { template?: unknown; scope?: unknown; stale_days?: unknown; rep?: unknown }) {
  const template = TEMPLATE_KEYS.includes(src.template as VerifyTemplate) ? (src.template as VerifyTemplate) : null;
  const rawScope: VerifyScope = ["support", "office", "all", "renewals"].includes(src.scope as string) ? (src.scope as VerifyScope) : "all";
  // «التجديدات» = كل التجديدات؛ مع قوالب الصفقات تعني الكل
  const scope: VerifyScope = template && TEMPLATES[template].entity === "deal" && rawScope === "renewals" ? "all" : rawScope;
  const staleDays = Math.min(Math.max(Number(src.stale_days) || 7, 1), 90);
  const rep = typeof src.rep === "string" ? src.rep.trim().slice(0, 120) : REP_ALL;
  return { template, scope, staleDays, rep };
}

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

  const rows = (data ?? []) as { items: VerifyItem[]; created_at: string; updated_ids?: string[] }[];
  if (rows.length) {
    const state = await currentState(access.orgId, rows);
    for (const r of rows) {
      const sentAt = new Date(r.created_at).getTime();
      // «تحدّث» = تغيّرت حالته، أو انعدّل بعد إرسال الطلب، أو انحذف
      r.updated_ids = r.items.filter((it) => {
        const s = state[it.entity_id];
        if (!s) return true;
        if (s.status !== it.system_status) return true;
        return !!s.updated_at && new Date(s.updated_at).getTime() > sentAt;
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
  const { template, scope, staleDays, rep } = parseFilters(body);
  const assigneeId = typeof body.assignee_id === "string" ? body.assignee_id : "";
  const dueAt = typeof body.due_at === "string" && !Number.isNaN(Date.parse(body.due_at)) ? new Date(body.due_at).toISOString() : null;
  if (!template || !assigneeId) return NextResponse.json({ error: "اختر نوع التقرير والموظف" }, { status: 400 });

  const { data: assignee } = await supabaseAdmin.from("user_profiles").select("id, name, org_id").eq("id", assigneeId).maybeSingle();
  if (!assignee || assignee.org_id !== access.orgId) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 400 });

  let items: VerifyItem[];
  try {
    items = await buildItems(access.orgId, template, scope, staleDays, rep);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر تجهيز القائمة" }, { status: 500 });
  }
  if (items.length === 0) return NextResponse.json({ error: "ما فيه عملاء ينطبق عليهم هالتقرير حالياً" }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("verification_requests").insert({
    org_id: access.orgId, template, scope, params: { ...(usesDays(template) ? { stale_days: staleDays } : {}), ...(rep ? { rep } : {}) },
    assignee_id: assignee.id, assignee_name: assignee.name, note: String(body.note ?? "").trim().slice(0, 1000) || null,
    due_at: dueAt, items, created_by: access.userId, created_by_name: access.name,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
