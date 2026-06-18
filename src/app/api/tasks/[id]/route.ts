import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeNextRun } from "@/lib/tasks/schedule";
import { runTaskAndRecord } from "@/lib/tasks/executor";
import { requireUser } from "../../wa/_auth";
import type { ScheduledTask } from "@/types";

export const runtime = "nodejs";

async function loadTask(id: string, orgId: string): Promise<ScheduledTask | null> {
  const { data } = await supabaseAdmin
    .from("scheduled_tasks")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  return (data as ScheduledTask) ?? null;
}

/** PATCH /api/tasks/[id]  → update fields (status toggle, schedule, config) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { orgId } = body;
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  const existing = await loadTask(id, orgId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = [
    "title", "description", "action_type", "action_config", "status",
    "frequency", "at_hour", "at_minute", "weekday", "day_of_month", "run_at", "timezone",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  // Recompute next_run_at if scheduling changed or task was (re)activated.
  const merged = { ...existing, ...patch } as ScheduledTask;
  const scheduleTouched = ["frequency", "at_hour", "at_minute", "weekday", "day_of_month", "run_at", "timezone", "status"]
    .some((k) => k in patch);
  if (scheduleTouched) {
    const next = merged.status === "active" ? computeNextRun(merged, new Date()) : null;
    patch.next_run_at = next ? next.toISOString() : merged.status === "active" ? null : existing.next_run_at;
  }

  const { data, error } = await supabaseAdmin
    .from("scheduled_tasks")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

/** DELETE /api/tasks/[id]?orgId=... */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("scheduled_tasks")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** POST /api/tasks/[id]  with { orgId, action: "run" } → run the task now */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { orgId, action } = body;
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  if (action !== "run") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const task = await loadTask(id, orgId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await runTaskAndRecord(task);
  await supabaseAdmin
    .from("scheduled_tasks")
    .update({ last_run_at: new Date().toISOString(), run_count: (task.run_count ?? 0) + 1 })
    .eq("id", id)
    .eq("org_id", orgId);

  return NextResponse.json({ ok: true, result });
}
