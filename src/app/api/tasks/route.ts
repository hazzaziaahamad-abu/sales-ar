import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeNextRun } from "@/lib/tasks/schedule";
import { requireUser } from "../wa/_auth";
import type { ScheduledTask } from "@/types";

export const runtime = "nodejs";

/** GET /api/tasks?orgId=...  → org's tasks + recent runs */
export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  const [{ data: tasks }, { data: runs }] = await Promise.all([
    supabaseAdmin
      .from("scheduled_tasks")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("scheduled_task_runs")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({ tasks: tasks ?? [], runs: runs ?? [] });
}

/** POST /api/tasks  → create a task (manual form or agent passthrough) */
export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { orgId } = body;
  if (!orgId || !body.title) {
    return NextResponse.json({ error: "orgId and title are required" }, { status: 400 });
  }

  const row: Partial<ScheduledTask> = {
    org_id: orgId,
    title: body.title,
    description: body.description ?? null,
    action_type: body.action_type ?? "custom_message",
    action_config: body.action_config ?? { audience: { kind: "all_team" }, message: { template: "" } },
    status: "active",
    frequency: body.frequency ?? "once",
    at_hour: body.at_hour ?? 9,
    at_minute: body.at_minute ?? 0,
    weekday: body.weekday ?? null,
    day_of_month: body.day_of_month ?? null,
    run_at: body.run_at ?? null,
    timezone: body.timezone ?? "Asia/Riyadh",
    created_by: user.id,
  };

  const next = computeNextRun(row as ScheduledTask, new Date());
  row.next_run_at = next ? next.toISOString() : null;

  const { data, error } = await supabaseAdmin
    .from("scheduled_tasks")
    .insert(row)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}
