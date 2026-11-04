import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { getDailyAccess, loadSettings, loadBaselines, managerIds, prospectCountToday, reviewKey, saveSetting, type DailyReview } from "@/lib/daily-tasks/server";
import {
  OUTCOMES, countOutcomes, departmentsOf, minutesBetween, monthWorkdays, riyadhDate, riyadhPeriod,
  type DailyPlan, type DailyReport, type Department, type ExtraTask, type PlanActivity, type PlanPriority,
} from "@/lib/daily-tasks/shared";

export const runtime = "nodejs";

const PLAN_COLS = "id, user_id, user_name, plan_date, departments, started_at, first_activity_at, last_activity_at, finished_at, priorities, extra_tasks, unfinished_reason, blocker_note, close_exceptions, report";
const ACT_COLS = "id, created_at, entity_type, deal_id, renewal_id, client_name, department, outcome, next_action_at";

async function todayPlan(orgId: string, userId: string, date: string) {
  const { data } = await supabaseAdmin.from("rep_daily_plans").select(PLAN_COLS)
    .eq("org_id", orgId).eq("user_id", userId).eq("plan_date", date).maybeSingle();
  return (data as DailyPlan | null) ?? null;
}

async function todayActivities(orgId: string, userId: string, date: string) {
  const { data } = await supabaseAdmin.from("sales_activities").select(ACT_COLS)
    .eq("org_id", orgId).eq("user_id", userId).eq("activity_date", date)
    .order("created_at", { ascending: true }).limit(1000);
  return (data ?? []) as PlanActivity[];
}

/** GET /api/daily-tasks → كل ما يحتاجه شريط «مهام اليوم» للموظف الحالي. */
export async function GET(req: NextRequest) {
  const access = await getDailyAccess(req.nextUrl.searchParams.get("as"));
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = riyadhDate();
  const period = riyadhPeriod();
  const settings = await loadSettings(access.orgId);
  const departments = departmentsOf(access.userId, settings.members);

  const dayStart = new Date(`${date}T00:00:00+03:00`).toISOString();
  const dayEnd = new Date(`${date}T23:59:59+03:00`).toISOString();
  const [plan, activities, targetsRes, baselines, prospectToday, meetingsRes, reviewRes] = await Promise.all([
    todayPlan(access.orgId, access.userId, date),
    todayActivities(access.orgId, access.userId, date),
    supabaseAdmin.from("dept_targets").select("department, user_id, metric, min_value, target_value, stretch_value, share_pct, method, approved_at")
      .eq("org_id", access.orgId).eq("period", period).eq("metric", "revenue"),
    departments.length ? loadBaselines(access.orgId, period, false) : Promise.resolve(null),
    departments.includes("office") ? prospectCountToday(access.orgId, access.name) : Promise.resolve(0),
    // اجتماعات موعدها اليوم (حُجزت اليوم أو قبله)
    supabaseAdmin.from("sales_activities").select(ACT_COLS)
      .eq("org_id", access.orgId).eq("user_id", access.userId).eq("outcome", "meeting_booked")
      .gte("next_action_at", dayStart).lte("next_action_at", dayEnd).order("next_action_at").limit(50),
    supabaseAdmin.from("sales_guide_settings").select("setting_value")
      .eq("org_id", access.orgId).eq("setting_key", reviewKey(date, access.userId)).maybeSingle(),
  ]);

  const targets = (targetsRes.data ?? []).filter((t) => departments.includes(t.department as Department) && (t.user_id === null || t.user_id === access.userId));
  const mtd = baselines
    ? Object.fromEntries(departments.map((d) => [d, { dept: baselines[d].mtd, mine: Math.round(baselines[d].mtdByRep[access.name.trim()] ?? 0) }]))
    : {};

  return NextResponse.json({
    me: { id: access.userId, name: access.name, isManager: access.isManager, viewingAs: access.viewingAs },
    orgId: access.orgId, date, period,
    workdays: monthWorkdays(settings.workDays, date),
    settings: { queueCap: settings.queueCap, speed: settings.speed, activity: settings.activity, members: settings.members },
    departments, plan, activities, targets, mtd, prospectToday,
    meetingsToday: meetingsRes.data ?? [],
    review: (reviewRes.data?.setting_value as DailyReview | null) ?? null,
  });
}

/** POST /api/daily-tasks — { action: start | update | activity | finish } */
export async function POST(req: NextRequest) {
  const access = await getDailyAccess(null);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const date = riyadhDate();
  const now = new Date().toISOString();

  // ملاحظة المدير على يوم موظف (للمدير فقط) — تظهر للموظف في شريطه
  if (body.action === "review") {
    if (!access.isManager) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });
    const target = await getDailyAccess(typeof body.user_id === "string" ? body.user_id : null);
    if (!target?.viewingAs) return NextResponse.json({ error: "الموظف غير موجود" }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
    const value: DailyReview | null = note ? { note, by_name: access.name, at: now } : null;
    await saveSetting(access.orgId, reviewKey(date, target.userId), value);
    if (note) {
      await sendPushToUser(target.userId, { title: "ملاحظة من المدير على مهام اليوم", body: note.slice(0, 140), url: "/sales", tag: `daily-review-${target.userId}-${date}` }).catch(() => 0);
    }
    return NextResponse.json({ review: value });
  }

  if (body.action === "start") {
    const settings = await loadSettings(access.orgId);
    const departments = departmentsOf(access.userId, settings.members);
    if (!departments.length) return NextResponse.json({ error: "لست ضمن توزيع أي قسم في مركز الإعدادات" }, { status: 400 });
    const existing = await todayPlan(access.orgId, access.userId, date);
    if (existing) return NextResponse.json({ plan: existing });
    const { data, error } = await supabaseAdmin.from("rep_daily_plans")
      .insert({ org_id: access.orgId, user_id: access.userId, user_name: access.name, plan_date: date, departments, started_at: now })
      .select(PLAN_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const due = Math.max(0, Math.round(Number(body.dueCount) || 0));
    const meetings = Math.max(0, Math.round(Number(body.meetingsToday) || 0));
    const ids = (await managerIds(access.orgId)).filter((id) => id !== access.userId);
    const text = `${access.name} بدأ مهام اليوم — ${due} مستحقة${meetings ? `، ${meetings} اجتماع` : ""}`;
    await Promise.allSettled(ids.map((id) => sendPushToUser(id, { title: "مهام اليوم", body: text, url: "/daily-tasks", tag: `daily-start-${access.userId}-${date}` })));
    return NextResponse.json({ plan: data });
  }

  const plan = await todayPlan(access.orgId, access.userId, date);
  if (!plan) return NextResponse.json({ error: "ابدأ مهام اليوم أولاً" }, { status: 400 });

  if (body.action === "update") {
    const patch: Record<string, unknown> = { updated_at: now };
    if (Array.isArray(body.priorities)) {
      patch.priorities = (body.priorities as PlanPriority[]).slice(0, 3)
        .filter((p) => p && typeof p.key === "string" && /^(deal|renewal):[0-9a-f-]{36}$/.test(p.key))
        .map((p) => ({ key: p.key, title: String(p.title ?? "").slice(0, 120) }));
    }
    if (Array.isArray(body.extra_tasks)) {
      patch.extra_tasks = (body.extra_tasks as ExtraTask[]).slice(0, 30)
        .filter((t) => t && typeof t.text === "string" && t.text.trim())
        .map((t) => ({ id: String(t.id || crypto.randomUUID()).slice(0, 40), text: t.text.trim().slice(0, 200), done_at: t.done_at ? String(t.done_at) : null }));
      const doneNow = (patch.extra_tasks as ExtraTask[]).some((t) => t.done_at && !plan.extra_tasks.find((o) => o.id === t.id)?.done_at);
      if (doneNow) { patch.last_activity_at = now; if (!plan.first_activity_at) patch.first_activity_at = now; }
    }
    const { data, error } = await supabaseAdmin.from("rep_daily_plans").update(patch).eq("id", plan.id).select(PLAN_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plan: data });
  }

  if (body.action === "activity") {
    const def = OUTCOMES.find((o) => o.key === body.outcome);
    const entityType = body.entity_type === "renewal" ? "renewal" : body.entity_type === "deal" ? "deal" : null;
    const id = typeof body.entity_id === "string" && /^[0-9a-f-]{36}$/.test(body.entity_id) ? body.entity_id : null;
    if (!def || !entityType || !id) return NextResponse.json({ error: "بيانات النتيجة غير مكتملة" }, { status: 400 });
    const dept = (["office", "support", "renewals"] as const).find((d) => d === body.department) ?? null;
    const nextAt = typeof body.next_action_at === "string" && !Number.isNaN(Date.parse(body.next_action_at)) ? body.next_action_at : null;
    const { data, error } = await supabaseAdmin.from("sales_activities").insert({
      org_id: access.orgId,
      user_id: access.userId,
      employee_name: access.name,
      activity_date: date,
      activity_type: def.activityType,
      result: def.result,
      deal_id: entityType === "deal" ? id : null,
      renewal_id: entityType === "renewal" ? id : null,
      entity_type: entityType,
      department: dept,
      client_name: typeof body.client_name === "string" ? body.client_name.slice(0, 200) : null,
      phone: typeof body.phone === "string" ? body.phone.slice(0, 30) : null,
      outcome: def.key,
      next_action_at: nextAt,
      notes: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
      plan_id: plan.id,
    }).select(ACT_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from("rep_daily_plans")
      .update({ last_activity_at: now, first_activity_at: plan.first_activity_at ?? now, updated_at: now }).eq("id", plan.id);
    return NextResponse.json({ activity: data });
  }

  if (body.action === "finish") {
    if (plan.finished_at) return NextResponse.json({ plan });
    const acts = await todayActivities(access.orgId, access.userId, date);
    const doneKeys = new Set(acts.map((a) => `${a.entity_type}:${a.deal_id || a.renewal_id}`));
    const pending = (Array.isArray(body.pending) ? body.pending : []).slice(0, 200)
      .filter((p: { key?: unknown }) => typeof p?.key === "string")
      .map((p: { key: string; title?: string }) => ({ key: p.key, title: String(p.title ?? "").slice(0, 120) }));
    const byDept: DailyReport["by_department"] = {};
    const qb = body.queue_by_department && typeof body.queue_by_department === "object" ? body.queue_by_department : {};
    for (const d of plan.departments) {
      const remaining = Math.max(0, Number(qb[d]?.remaining) || 0);
      const done = new Set(acts.filter((a) => a.department === d).map((a) => a.deal_id || a.renewal_id)).size;
      byDept[d] = { done, total: done + remaining };
    }
    const outcomes = countOutcomes(acts);
    const paidAmount = Math.max(0, Number(body.paid_amount) || 0);
    const prospect = plan.departments.includes("office") ? await prospectCountToday(access.orgId, access.name) : 0;
    const unfinished = typeof body.unfinished_reason === "string" ? body.unfinished_reason.trim().slice(0, 500) || null : null;
    const blocker = typeof body.blocker_note === "string" ? body.blocker_note.trim().slice(0, 500) || null : null;
    const report: DailyReport = {
      started_at: plan.started_at,
      first_activity_at: plan.first_activity_at,
      last_activity_at: plan.last_activity_at,
      finished_at: now,
      gap_minutes: minutesBetween(plan.started_at, plan.first_activity_at),
      queue_total: Math.max(0, Number(body.queue_remaining) || 0) + doneKeys.size,
      queue_done: doneKeys.size,
      pending,
      priorities_done: plan.priorities.filter((p) => doneKeys.has(p.key)).length,
      priorities_total: plan.priorities.length,
      extras_done: plan.extra_tasks.filter((t) => t.done_at).length,
      extras_total: plan.extra_tasks.length,
      prospect_added: prospect,
      meetings_booked: outcomes.meeting_booked ?? 0,
      meetings_held: outcomes.meeting_held ?? 0,
      paid_count: outcomes.paid ?? 0,
      paid_amount: paidAmount,
      outcomes,
      by_department: byDept,
      unfinished_reason: unfinished,
      blocker_note: blocker,
    };
    const { data, error } = await supabaseAdmin.from("rep_daily_plans").update({
      finished_at: now, unfinished_reason: unfinished, blocker_note: blocker,
      close_exceptions: pending, report, updated_at: now,
    }).eq("id", plan.id).select(PLAN_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plan: data });
  }

  return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
}
