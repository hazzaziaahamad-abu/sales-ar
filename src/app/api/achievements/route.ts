import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { hasPermission } from "@/lib/permissions";
import { saudiDateStr } from "@/lib/utils/format";
import { ACHIEVEMENT_CATEGORIES, type AchievementItem } from "@/lib/achievements";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dayOf = (s?: string | null) => (!s ? "" : s.length === 10 ? s : saudiDateStr(new Date(s)));
/** حدود الفترة كـ timestamps (بداية يوم from إلى نهاية يوم to بتوقيت السعودية). */
const startTs = (d: string) => new Date(`${d}T00:00:00+03:00`).toISOString();
const endTs = (d: string) => new Date(new Date(`${d}T00:00:00+03:00`).getTime() + 86_400_000).toISOString();

/** GET /api/achievements?from&to → كل الإنجازات في الفترة (تلقائية + يدوية). */
export async function GET(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: "فترة غير صالحة" }, { status: 400 });
  }
  const org = access.orgId;
  const canSeeChallenges = access.isManager || (await hasPermission(access.userId, "challenges_manage"));

  const [deals, renewals, tickets, challenges, meetings, tasks, manual] = await Promise.all([
    supabaseAdmin.from("deals").select("id, client_name, deal_value, assigned_rep_name, close_date, plan, sales_type")
      .eq("org_id", org).eq("stage", "مكتملة").gte("close_date", startTs(from)).lt("close_date", endTs(to)).limit(1000),
    supabaseAdmin.from("renewals").select("id, customer_name, plan_name, plan_price, assigned_rep, payment_date, updated_at")
      .eq("org_id", org).eq("status", "مكتمل").gte("updated_at", startTs(from)).lt("updated_at", endTs(to)).limit(1000),
    supabaseAdmin.from("work_tickets").select("id, ticket_number, kind, title, client_name, resolution, assigned_to_name, closed_by_name, closed_at")
      .eq("org_id", org).eq("status", "done").gte("closed_at", startTs(from)).lt("closed_at", endTs(to)).limit(500),
    supabaseAdmin.from("employee_challenges").select("id, challenge_number, title, resolved_at")
      .eq("org_id", org).eq("kind", "challenge").eq("status", "resolved").gte("resolved_at", startTs(from)).lt("resolved_at", endTs(to)).limit(500),
    supabaseAdmin.from("meetings").select("id, title, meeting_date, attendees, minutes")
      .eq("org_id", org).eq("status", "done").gte("meeting_date", from).lte("meeting_date", to).limit(500),
    supabaseAdmin.from("employee_tasks").select("id, title, assigned_to_name, completed_at, client_name")
      .eq("org_id", org).eq("status", "completed").gte("completed_at", startTs(from)).lt("completed_at", endTs(to)).limit(1000),
    supabaseAdmin.from("achievements").select("*")
      .eq("org_id", org).gte("achieved_on", from).lte("achieved_on", to).limit(500),
  ]);

  const items: AchievementItem[] = [];
  for (const d of deals.data ?? []) items.push({
    id: `deal:${d.id}`, source: "deal", title: d.client_name,
    detail: [d.sales_type === "support" ? "مبيعات الدعم" : "مبيعات المكتب", d.plan].filter(Boolean).join(" · "),
    who: d.assigned_rep_name, day: dayOf(d.close_date), value: d.deal_value ?? 0,
  });
  for (const r of renewals.data ?? []) items.push({
    id: `renewal:${r.id}`, source: "renewal", title: r.customer_name, detail: r.plan_name,
    who: r.assigned_rep, day: dayOf(r.payment_date || r.updated_at), value: r.plan_price ?? 0,
  });
  for (const t of tickets.data ?? []) items.push({
    id: `ticket:${t.id}`, source: "ticket",
    title: `#${t.ticket_number} ${t.title}`,
    detail: [t.kind === "customer_request" ? `طلب عميل${t.client_name ? ` — ${t.client_name}` : ""}` : "تطوير على النظام", t.resolution].filter(Boolean).join(" · "),
    who: t.assigned_to_name || t.closed_by_name, day: dayOf(t.closed_at), value: null,
  });
  for (const c of challenges.data ?? []) items.push({
    id: `challenge:${c.id}`, source: "challenge",
    // تفاصيل التحديات خاصة بمدير التحديات
    title: canSeeChallenges ? `#${c.challenge_number} ${c.title}` : `تم حل تحدٍّ #${c.challenge_number}`,
    detail: null, who: null, day: dayOf(c.resolved_at), value: null,
  });
  for (const m of meetings.data ?? []) items.push({
    id: `meeting:${m.id}`, source: "meeting", title: m.title,
    detail: m.minutes ? m.minutes.split("\n")[0].slice(0, 140) : null,
    who: (m.attendees ?? []).slice(0, 4).join("، ") || null, day: m.meeting_date, value: null,
  });
  for (const t of tasks.data ?? []) items.push({
    id: `task:${t.id}`, source: "task", title: t.title, detail: t.client_name || null,
    who: t.assigned_to_name, day: dayOf(t.completed_at), value: null,
  });
  for (const a of manual.data ?? []) items.push({
    id: `manual:${a.id}`, source: "manual", title: a.title, detail: a.description,
    who: a.owner_name || a.created_by_name, day: a.achieved_on, value: null,
    category: a.category, can_delete: access.isManager || a.created_by === access.userId,
  });

  items.sort((a, b) => b.day.localeCompare(a.day));
  return NextResponse.json({ items });
}

/** POST /api/achievements → تسجيل إنجاز يدوي. */
export async function POST(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const achievedOn = typeof body.achieved_on === "string" && DATE_RE.test(body.achieved_on) ? body.achieved_on : saudiDateStr();
  if (!title) return NextResponse.json({ error: "عنوان الإنجاز مطلوب" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("achievements")
    .insert({
      org_id: access.orgId,
      title: title.slice(0, 200),
      description: String(body.description ?? "").trim().slice(0, 2000) || null,
      owner_name: String(body.owner_name ?? "").trim().slice(0, 120) || access.name,
      category: ACHIEVEMENT_CATEGORIES.includes(body.category) ? body.category : "other",
      achieved_on: achievedOn,
      created_by: access.userId,
      created_by_name: access.name,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
