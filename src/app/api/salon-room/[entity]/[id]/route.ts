import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoomAccess } from "@/lib/api/salon-room-auth";
import { CLIENT_COLS, LOG_COLS, TASK_COLS, TEAM_COLS, addDays, planDueDates, stageLabel, type RoomTask, type Stage } from "@/lib/salon-room";
import { CONTRACTED_STAGES, parseClient, parseTask, parseTeam } from "../../shared";

export const runtime = "nodejs";

/** PATCH /api/salon-room/{clients|tasks|team}/[id] → تعديل. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await ctx.params;
  const access = await getRoomAccess(req);
  if (access instanceof NextResponse) return access;
  const { orgId, author } = access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  if (entity === "clients") {
    const p = parseClient(b, true);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    const { data: before } = await supabaseAdmin.from("consult_clients").select("stage, converted_at, contracted_at").eq("id", id).eq("org_id", orgId).maybeSingle();
    if (!before) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const stamps: Record<string, string> = {};
    const next = p.fields.stage as Stage | undefined;
    if (next && next !== "lead" && !before.converted_at) stamps.converted_at = now;
    if (next && CONTRACTED_STAGES.includes(next) && !before.contracted_at) stamps.contracted_at = now;
    const { data, error } = await supabaseAdmin.from("consult_clients")
      .update({ ...p.fields, ...stamps, updated_at: now }).eq("id", id).eq("org_id", orgId).select(CLIENT_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    let log = null;
    if (p.fields.stage && p.fields.stage !== before.stage) {
      const res = await supabaseAdmin.from("consult_logs").insert({
        org_id: orgId, client_id: id, kind: "stage", author,
        body: `انتقل من «${stageLabel(before.stage as Stage)}» إلى «${stageLabel(p.fields.stage as Stage)}»`,
      }).select(LOG_COLS).single();
      log = res.data;
    }
    return NextResponse.json({ client: data, log });
  }

  if (entity === "tasks") {
    const p = parseTask(b, true);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    const fields: Record<string, unknown> = { ...p.fields };
    if ("done" in b) Object.assign(fields, b.done ? { done_at: now, done_by: author } : { done_at: null, done_by: null });
    const { data, error } = await supabaseAdmin.from("consult_tasks")
      .update(fields).eq("id", id).eq("org_id", orgId).select(TASK_COLS).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    // أي تحديث على مهام العميل يحدّث «آخر نشاط»
    await supabaseAdmin.from("consult_clients").update({ updated_at: now }).eq("id", data.client_id).eq("org_id", orgId);
    return NextResponse.json({ task: data });
  }

  if (entity === "team") {
    const p = parseTeam(b, true);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("consult_team")
      .update(p.fields).eq("id", id).eq("org_id", orgId).select(TEAM_COLS).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    return NextResponse.json({ member: data });
  }

  return NextResponse.json({ error: "غير موجود" }, { status: 404 });
}

/**
 * POST /api/salon-room/clients/[id] { start_date, overwrite? } → توليد خطة التنفيذ:
 * تواريخ استحقاق لمهام كل المراحل حسب نوافذ الآلية (المهام المنجزة ما تتغيّر،
 * واللي لها تاريخ ما تتغيّر إلا مع overwrite)، ومراجعة أولى بعد ٣٠ يوم لو ما فيه مراجعة.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await ctx.params;
  if (entity !== "clients") return NextResponse.json({ error: "غير مسموح" }, { status: 405 });
  const access = await getRoomAccess(req);
  if (access instanceof NextResponse) return access;
  const { orgId, author } = access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const start = typeof b.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.start_date) ? b.start_date : null;
  if (!start) return NextResponse.json({ error: "حدّد تاريخ البداية" }, { status: 400 });

  const { data: client } = await supabaseAdmin.from("consult_clients").select("id, next_review").eq("id", id).eq("org_id", orgId).maybeSingle();
  if (!client) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const { data: tasks } = await supabaseAdmin.from("consult_tasks").select(TASK_COLS).eq("client_id", id).eq("org_id", orgId);
  const dues = planDueDates(start, (tasks ?? []) as RoomTask[]);
  const targets = ((tasks ?? []) as RoomTask[]).filter((t) => !t.done_at && (b.overwrite === true || !t.due_date) && dues.has(t.id));
  const results = await Promise.all(targets.map((t) =>
    supabaseAdmin.from("consult_tasks").update({ due_date: dues.get(t.id) }).eq("id", t.id).eq("org_id", orgId)));
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const now = new Date().toISOString();
  const [updated, fresh, log] = await Promise.all([
    supabaseAdmin.from("consult_clients").update({ start_date: start, next_review: client.next_review ?? addDays(start, 30), updated_at: now })
      .eq("id", id).eq("org_id", orgId).select(CLIENT_COLS).single(),
    supabaseAdmin.from("consult_tasks").select(TASK_COLS).eq("client_id", id).eq("org_id", orgId),
    supabaseAdmin.from("consult_logs").insert({
      org_id: orgId, client_id: id, kind: "note", author, body: `وُلّدت خطة التنفيذ من ${start} (${targets.length} مهمة بتواريخ)`,
    }).select(LOG_COLS).single(),
  ]);
  if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });
  return NextResponse.json({ client: updated.data, tasks: fresh.data ?? [], log: log.data });
}

/** DELETE /api/salon-room/{tasks|team}/[id] — المهام المخصّصة فقط (مهام الدليل ثابتة). العملاء تُؤرشف بالتعديل. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await ctx.params;
  const access = await getRoomAccess(req);
  if (access instanceof NextResponse) return access;
  const table = entity === "tasks" ? "consult_tasks" : entity === "team" ? "consult_team" : null;
  if (!table) return NextResponse.json({ error: "غير مسموح" }, { status: 405 });
  let q = supabaseAdmin.from(table).delete().eq("id", id).eq("org_id", access.orgId);
  if (entity === "tasks") q = q.eq("custom", true);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
