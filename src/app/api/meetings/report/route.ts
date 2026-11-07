import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isSuperAdmin } from "@/lib/permissions";
import {
  ORG_PRODUCT, CONVERTED_STAGES, LOST_STAGES, meetingOutcome, isUpgradeDeal, phoneKey,
  type ReportRow, type ReportOutcome,
} from "@/lib/client-meetings";
import { CLIENT_PURPOSES, type ClientBrief, type ClientPurpose } from "@/lib/meetings";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type CalRow = {
  id: string; org_id: string; title: string; meeting_date: string; start_time: string; status: string;
  client_brief: ClientBrief | null; created_by: string | null; created_by_name: string | null;
  deal_id: string | null; client_meeting_id: string | null;
};
type PlanRow = {
  id: string; org_id: string; deal_id: string | null; token: string; product: string; client_name: string;
  client_phone: string | null; rep_id: string | null; rep_name: string | null; stage_at_start: string | null;
  tier_name: string | null; open_count: number; created_at: string;
};
type DealRow = {
  id: string; org_id: string; client_name: string | null; client_phone: string | null; stage: string | null;
  plan: string | null; source: string | null; created_at: string;
};

const PLAN_COLS = "id, org_id, deal_id, token, product, client_name, client_phone, rep_id, rep_name, stage_at_start, tier_name, open_count, created_at";
const DEAL_COLS = "id, org_id, client_name, client_phone, stage, plan, source, created_at";

async function inChunks<T>(ids: string[], fetchChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await fetchChunk(ids.slice(i, i + 300));
    out.push(...(data ?? []));
  }
  return out;
}

/**
 * GET /api/meetings/report?from=YYYY-MM-DD&to=YYYY-MM-DD
 * تقرير «اجتماعات العملاء»: مواعيد التقويم (نوع «مع عميل») + روابط خطة الاجتماع اللي ما لها موعد،
 * مع النتيجة حسب هدف الاجتماع (تحويل عميل جديد / ترقية عميل حالي) وإكمال المحاور، وكل الموظفين.
 * السوبر أدمن: كل المنظمات · المدير: منظمته · الموظف: اجتماعاته فقط.
 */
export async function GET(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const superAdmin = await isSuperAdmin(access.userId);
  const isManager = access.isManager || superAdmin;

  const fromP = req.nextUrl.searchParams.get("from");
  const toP = req.nextUrl.searchParams.get("to");
  const from = fromP && DATE_RE.test(fromP) ? fromP : null;
  const to = toP && DATE_RE.test(toP) ? toP : null;

  // 1) مواعيد التقويم مع العملاء في الفترة (بدون الملغية).
  let calQ = supabaseAdmin
    .from("meetings")
    .select("id, org_id, title, meeting_date, start_time, status, client_brief, created_by, created_by_name, deal_id, client_meeting_id")
    .eq("meeting_type", "client")
    .neq("status", "cancelled")
    .order("meeting_date", { ascending: false })
    .limit(2000);
  if (!superAdmin) calQ = calQ.eq("org_id", access.orgId);
  if (!isManager) calQ = calQ.eq("created_by", access.userId);
  if (from) calQ = calQ.gte("meeting_date", from);
  if (to) calQ = calQ.lte("meeting_date", to);
  const { data: calData, error: calErr } = await calQ;
  if (calErr) return NextResponse.json({ error: calErr.message }, { status: 500 });
  const cal = (calData ?? []) as CalRow[];

  // 2) روابط خطة الاجتماع: المربوطة بالمواعيد + المنشأة في الفترة.
  let planQ = supabaseAdmin.from("client_meetings").select(PLAN_COLS).order("created_at", { ascending: false }).limit(2000);
  if (!superAdmin) planQ = planQ.eq("org_id", access.orgId);
  if (!isManager) planQ = planQ.eq("rep_id", access.userId);
  if (from) planQ = planQ.gte("created_at", `${from}T00:00:00+03:00`);
  if (to) planQ = planQ.lte("created_at", `${to}T23:59:59+03:00`);
  const { data: periodPlans } = await planQ;

  const linkedPlanIds = [...new Set(cal.map((m) => m.client_meeting_id).filter(Boolean))] as string[];
  const linkedPlans = await inChunks<PlanRow>(linkedPlanIds, (c) => supabaseAdmin.from("client_meetings").select(PLAN_COLS).in("id", c));
  const plans = new Map<string, PlanRow>();
  for (const p of [...((periodPlans ?? []) as PlanRow[]), ...linkedPlans]) plans.set(p.id, p);

  // روابط بلا موعد = ما فيه أي موعد (حتى خارج الفترة) مربوط فيها.
  const candidateIds = ((periodPlans ?? []) as PlanRow[]).map((p) => p.id).filter((id) => !linkedPlanIds.includes(id));
  const usedElsewhere = new Set(
    (await inChunks<{ client_meeting_id: string }>(candidateIds, (c) =>
      supabaseAdmin.from("meetings").select("client_meeting_id").in("client_meeting_id", c),
    )).map((r) => r.client_meeting_id),
  );
  const orphanPlans = candidateIds.filter((id) => !usedElsewhere.has(id)).map((id) => plans.get(id)!);

  // 3) الصفقات المربوطة.
  const dealIds = [...new Set([
    ...cal.map((m) => m.deal_id),
    ...[...plans.values()].map((p) => p.deal_id),
  ].filter(Boolean))] as string[];
  const deals = new Map<string, DealRow>();
  for (const d of await inChunks<DealRow>(dealIds, (c) => supabaseAdmin.from("deals").select(DEAL_COLS).in("id", c))) deals.set(d.id, d);

  // 4) صفقات الترقية المكتملة بعد أقدم اجتماع ترقية — نطابقها بالجوال أو الاسم.
  const purposeOf = (m: CalRow): ClientPurpose =>
    CLIENT_PURPOSES.includes(m.client_brief?.purpose as ClientPurpose) ? (m.client_brief!.purpose as ClientPurpose) : "new";
  const upgradeMeetings = cal.filter((m) => purposeOf(m) === "upgrade");
  let upgradeDeals: DealRow[] = [];
  if (upgradeMeetings.length) {
    const minDate = upgradeMeetings.reduce((a, m) => (m.meeting_date < a ? m.meeting_date : a), upgradeMeetings[0].meeting_date);
    let uq = supabaseAdmin
      .from("deals")
      .select(DEAL_COLS)
      .in("stage", CONVERTED_STAGES)
      .or("source.eq.ترقية,plan.ilike.ترقي*")
      .gte("created_at", `${minDate}T00:00:00+03:00`)
      .limit(2000);
    const orgIds = [...new Set(upgradeMeetings.map((m) => m.org_id))];
    uq = uq.in("org_id", orgIds);
    const { data } = await uq;
    upgradeDeals = ((data ?? []) as DealRow[]).filter(isUpgradeDeal);
  }

  const rows: ReportRow[] = [];

  for (const m of cal) {
    const plan = m.client_meeting_id ? plans.get(m.client_meeting_id) ?? null : null;
    const dealId = m.deal_id ?? plan?.deal_id ?? null;
    const deal = dealId ? deals.get(dealId) ?? null : null;
    const purpose = purposeOf(m);
    const name = m.client_brief?.client_name || deal?.client_name || plan?.client_name || m.title;
    const phone = m.client_brief?.client_phone || deal?.client_phone || plan?.client_phone || null;

    let outcome: ReportOutcome;
    if (purpose === "upgrade") {
      const pk = phoneKey(phone);
      const hit = upgradeDeals.find((d) =>
        d.org_id === m.org_id
        && d.created_at.slice(0, 10) >= m.meeting_date
        && (d.id === dealId || (pk && phoneKey(d.client_phone) === pk) || (!!name && d.client_name?.trim() === name.trim())));
      outcome = hit ? "upgraded" : deal?.stage && LOST_STAGES.includes(deal.stage) ? "lost" : "open";
    } else {
      outcome = deal ? meetingOutcome(plan?.stage_at_start ?? null, deal.stage) : "unlinked";
    }

    rows.push({
      key: `m:${m.id}`,
      kind: "calendar",
      org_id: m.org_id,
      product: ORG_PRODUCT[m.org_id] ?? plan?.product ?? "",
      client_name: name,
      client_phone: phone,
      rep_id: m.created_by,
      rep_name: m.created_by_name,
      date: m.meeting_date,
      time: m.start_time,
      status: m.status as ReportRow["status"],
      purpose,
      script_done: m.client_brief?.done?.length ?? 0,
      deal_id: dealId,
      deal_stage: deal?.stage ?? null,
      token: plan?.token ?? null,
      open_count: plan?.open_count ?? 0,
      tier_name: plan?.tier_name ?? null,
      outcome,
    });
  }

  for (const p of orphanPlans) {
    const deal = p.deal_id ? deals.get(p.deal_id) ?? null : null;
    rows.push({
      key: `p:${p.id}`,
      kind: "plan",
      org_id: p.org_id,
      product: p.product,
      client_name: p.client_name || deal?.client_name || "—",
      client_phone: p.client_phone,
      rep_id: p.rep_id,
      rep_name: p.rep_name,
      date: new Date(new Date(p.created_at).getTime() + 3 * 3600000).toISOString().slice(0, 10),
      time: null,
      status: null,
      purpose: "new",
      script_done: 0,
      deal_id: p.deal_id,
      deal_stage: deal?.stage ?? null,
      token: p.token,
      open_count: p.open_count,
      tier_name: p.tier_name,
      outcome: deal ? meetingOutcome(p.stage_at_start, deal.stage) : "unlinked",
    });
  }

  rows.sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? "").localeCompare(a.time ?? ""));

  // 5) كل الموظفين — حتى اللي ما سوّوا ولا اجتماع.
  let employees: { id: string; name: string; org_id: string }[] = [];
  if (isManager) {
    let eq = supabaseAdmin.from("user_profiles").select("id, name, org_id").order("name");
    if (!superAdmin) eq = eq.eq("org_id", access.orgId);
    const { data } = await eq;
    employees = ((data ?? []) as { id: string; name: string | null; org_id: string }[])
      .filter((e) => e.name)
      .map((e) => ({ id: e.id, name: e.name!, org_id: e.org_id }));
  } else {
    employees = [{ id: access.userId, name: access.name ?? "أنا", org_id: access.orgId }];
  }

  return NextResponse.json(
    { rows, employees: employees.map((e) => ({ ...e, product: ORG_PRODUCT[e.org_id] ?? "" })), me: { id: access.userId, isManager } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
