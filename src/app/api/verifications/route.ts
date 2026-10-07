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

const DAY = 86_400_000;
const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

/** وقت آخر تعليق (ملاحظة متابعة) في سجل كل عميل. اللي ما عليه تعليقات ما يرجع. */
async function lastNoteTimes(orgId: string, ids: string[]): Promise<Map<string, string>> {
  const last = new Map<string, string>();
  for (const part of chunk(ids, 100)) {
    // الترتيب تنازلي — أول ظهور لكل عميل هو آخر تعليق
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("follow_up_notes").select("entity_id, created_at")
        .eq("org_id", orgId).in("entity_id", part)
        .order("created_at", { ascending: false }).range(from, from + 999);
      if (error) throw error;
      for (const n of data ?? []) if (!last.has(n.entity_id)) last.set(n.entity_id, n.created_at);
      if ((data ?? []).length < 1000) break;
    }
  }
  return last;
}

const idleDays = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY) : null);

/**
 * يجهّز لقطة القائمة حسب القالب والقسم.
 * «بدون تحديث من X يوم» = آخر تعليق في سجل العميل أقدم من X يوم
 * (وإذا ما عليه ولا تعليق: من تاريخ إضافته).
 */
async function buildItems(orgId: string, template: VerifyTemplate, scope: VerifyScope, staleDays: number | null, rep: string): Promise<VerifyItem[]> {
  type Row = { item: VerifyItem; created_at: string | null; extra: (lastNote: string | null) => string | null };
  let rows: Row[];

  if (TEMPLATES[template].entity === "renewal") {
    let q = supabaseAdmin.from("renewals")
      .select("id, customer_name, customer_phone, assigned_rep, plan_name, plan_price, renewal_date, status, created_at")
      .eq("org_id", orgId);
    if (template === "renewals_week") {
      q = q.gte("renewal_date", saudiDateStr(new Date(Date.now() - 30 * DAY)))
        .lte("renewal_date", saudiDateStr(new Date(Date.now() + 7 * DAY)))
        .not("status", "in", `(${CLOSED_RENEWAL.map((s) => `"${s}"`).join(",")})`);
    } else {
      q = q.eq("status", template === "renewals_awaiting_payment" ? "انتظار الدفع" : "جاري المتابعة");
    }
    if (scope === "support") q = q.eq("sales_type", "support");
    if (scope === "office") q = q.or("sales_type.eq.office,sales_type.is.null");
    if (rep === REP_NONE) q = q.is("assigned_rep", null);
    else if (rep) q = q.eq("assigned_rep", rep);
    const { data, error } = await q.order("renewal_date", { ascending: true }).limit(2000);
    if (error) throw error;
    const today = saudiDateStr();
    rows = (data ?? []).map((r) => ({
      created_at: r.created_at ?? null,
      item: {
        entity_type: "renewal", entity_id: r.id, name: r.customer_name, phone: r.customer_phone ?? null,
        rep: r.assigned_rep ?? null, value: r.plan_price ?? 0, system_status: r.status, last_activity: null, extra: null,
      },
      extra: (lastNote) => {
        const idle = idleDays(lastNote);
        return `${r.plan_name ?? ""} · موعد التجديد ${r.renewal_date}${r.renewal_date < today ? " (متأخر)" : ""} · ${idle === null ? "بدون تعليقات" : `آخر تعليق قبل ${idle} يوم`}`;
      },
    }));
  } else {
    let q = supabaseAdmin.from("deals")
      .select("id, client_name, client_phone, assigned_rep_name, deal_value, plan, stage, created_at")
      .eq("org_id", orgId);
    if (scope === "support") q = q.eq("sales_type", "support");
    if (scope === "office") q = q.or("sales_type.eq.office,sales_type.is.null");
    if (rep === REP_NONE) q = q.is("assigned_rep_name", null);
    else if (rep) q = q.eq("assigned_rep_name", rep);
    if (template === "trial") q = q.eq("stage", "تجريبي");
    else if (template === "awaiting_payment") q = q.eq("stage", "انتظار الدفع");
    else q = q.in("stage", ACTIVE_DEAL);
    const { data, error } = await q.order("created_at", { ascending: true }).limit(2000);
    if (error) throw error;
    rows = (data ?? []).filter((d) => !CLOSED_DEAL.includes(d.stage)).map((d) => ({
      created_at: d.created_at ?? null,
      item: {
        entity_type: "deal", entity_id: d.id, name: d.client_name, phone: d.client_phone ?? null,
        rep: d.assigned_rep_name ?? null, value: d.deal_value ?? 0, system_status: d.stage, last_activity: null, extra: null,
      },
      extra: (lastNote) => {
        const idle = idleDays(lastNote);
        return [d.plan, idle === null ? "بدون تعليقات" : `آخر تعليق قبل ${idle} يوم`].filter(Boolean).join(" · ");
      },
    }));
  }

  const notes = await lastNoteTimes(orgId, rows.map((r) => r.item.entity_id));
  const sinceOf = (r: Row) => notes.get(r.item.entity_id) ?? r.created_at;
  if (staleDays) {
    const cutoff = Date.now() - staleDays * DAY;
    rows = rows.filter((r) => { const t = sinceOf(r); return !t || new Date(t).getTime() < cutoff; });
  }
  // الأقدم تعليقاً أولاً
  rows.sort((a, b) => (sinceOf(a) ?? "").localeCompare(sinceOf(b) ?? ""));
  return rows.slice(0, MAX_ITEMS).map((r) => {
    const lastNote = notes.get(r.item.entity_id) ?? null;
    return { ...r.item, last_activity: lastNote, extra: r.extra(lastNote) };
  });
}

/** الحالة الحالية وآخر تعليق لكل عنصر في الطلبات (العنصر المحذوف ما يرجع حالته). */
async function currentState(orgId: string, rows: { items: VerifyItem[] }[]) {
  const dealIds = new Set<string>(), renewalIds = new Set<string>();
  for (const r of rows) for (const it of r.items) (it.entity_type === "deal" ? dealIds : renewalIds).add(it.entity_id);
  const status: Record<string, string | null> = {};
  for (const ids of chunk([...dealIds], 200)) {
    const { data } = await supabaseAdmin.from("deals").select("id, stage").eq("org_id", orgId).in("id", ids);
    for (const d of data ?? []) status[d.id] = d.stage;
  }
  for (const ids of chunk([...renewalIds], 200)) {
    const { data } = await supabaseAdmin.from("renewals").select("id, status").eq("org_id", orgId).in("id", ids);
    for (const r of data ?? []) status[r.id] = r.status;
  }
  const notes = await lastNoteTimes(orgId, [...dealIds, ...renewalIds]);
  return { status, notes };
}

/** الإعدادات المشتركة بين المعاينة وإنشاء الطلب. */
function parseFilters(src: { template?: unknown; scope?: unknown; stale_days?: unknown; rep?: unknown }) {
  const template = TEMPLATE_KEYS.includes(src.template as VerifyTemplate) ? (src.template as VerifyTemplate) : null;
  const rawScope: VerifyScope = ["support", "office", "all", "renewals"].includes(src.scope as string) ? (src.scope as VerifyScope) : "all";
  // «التجديدات» = كل التجديدات؛ مع قوالب الصفقات تعني الكل
  const scope: VerifyScope = template && TEMPLATES[template].entity === "deal" && rawScope === "renewals" ? "all" : rawScope;
  // عدد الأيام: إجباري لقوالب «بدون تواصل/تحديث» (افتراضي 7)، واختياري للباقي (فاضي = الكل)
  const days = Math.min(Math.max(Math.round(Number(src.stale_days)) || 0, 0), 365);
  const staleDays = template && usesDays(template) ? days || 7 : days || null;
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
    const { status, notes } = await currentState(access.orgId, rows);
    for (const r of rows) {
      const sentAt = new Date(r.created_at).getTime();
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
    org_id: access.orgId, template, scope, params: { ...(staleDays ? { stale_days: staleDays } : {}), ...(rep ? { rep } : {}) },
    assignee_id: assignee.id, assignee_name: assignee.name, note: String(body.note ?? "").trim().slice(0, 1000) || null,
    due_at: dueAt, items, created_by: access.userId, created_by_name: access.name,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}
