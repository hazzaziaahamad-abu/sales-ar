import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoomAccess } from "@/lib/api/salon-room-auth";
import { CLIENT_COLS, LOG_COLS, PLAYBOOK, TASK_COLS, TEAM_COLS, stageLabel, type Stage } from "@/lib/salon-room";
import { CONTRACTED_STAGES, parseClient, parseLog, parseTask, parseTeam } from "../shared";

export const runtime = "nodejs";

/** POST /api/salon-room/{clients|tasks|logs|team} → إضافة. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  const access = await getRoomAccess(req);
  if (access instanceof NextResponse) return access;
  const { orgId, author } = access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;

  const clientInOrg = async (id: unknown) => {
    if (typeof id !== "string") return false;
    const { data } = await supabaseAdmin.from("consult_clients").select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
    return !!data;
  };

  if (entity === "clients") {
    const p = parseClient(b, false);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    const stage = (p.fields.stage as Stage | undefined) ?? "lead";
    const now = new Date().toISOString();
    const { data: client, error } = await supabaseAdmin
      .from("consult_clients").insert({
        ...p.fields, org_id: orgId,
        converted_at: stage !== "lead" ? now : null,
        contracted_at: CONTRACTED_STAGES.includes(stage) ? now : null,
      }).select(CLIENT_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // مهام دليل الآلية لكل المراحل
    const rows = PLAYBOOK.flatMap((ph) => ph.tasks.map((title, i) => ({
      org_id: orgId, client_id: client.id, phase: ph.stage, title, sort_order: i, assignee: client.consultant,
    })));
    const [tasks, log] = await Promise.all([
      supabaseAdmin.from("consult_tasks").insert(rows).select(TASK_COLS),
      supabaseAdmin.from("consult_logs").insert({
        org_id: orgId, client_id: client.id, kind: "stage", author,
        body: `أُضيف الصالون للغرفة — المرحلة: ${stageLabel(client.stage as Stage)}`,
      }).select(LOG_COLS).single(),
    ]);
    if (tasks.error) return NextResponse.json({ error: tasks.error.message }, { status: 500 });
    return NextResponse.json({ client, tasks: tasks.data ?? [], log: log.data ?? null });
  }

  if (entity === "tasks") {
    const p = parseTask(b, false);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    if (!(await clientInOrg(p.fields.client_id))) return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    const { data: last } = await supabaseAdmin.from("consult_tasks").select("sort_order")
      .eq("client_id", p.fields.client_id as string).eq("phase", p.fields.phase as string)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabaseAdmin.from("consult_tasks")
      .insert({ ...p.fields, org_id: orgId, custom: true, sort_order: (last?.sort_order ?? -1) + 1 }).select(TASK_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ task: data });
  }

  if (entity === "logs") {
    const p = parseLog(b);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    if (!(await clientInOrg(p.fields.client_id))) return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    const { data, error } = await supabaseAdmin.from("consult_logs")
      .insert({ ...p.fields, org_id: orgId, author }).select(LOG_COLS).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // محاولة تواصل: آخر تواصل + «جديد» يصير «تم التواصل»
    let client = null;
    if (p.fields.kind === "contact") {
      const now = new Date().toISOString();
      await supabaseAdmin.from("consult_clients").update({ lead_status: "contacted" })
        .eq("id", p.fields.client_id as string).eq("org_id", orgId).eq("lead_status", "new");
      const res = await supabaseAdmin.from("consult_clients").update({ last_contact_at: now, updated_at: now })
        .eq("id", p.fields.client_id as string).eq("org_id", orgId).select(CLIENT_COLS).single();
      client = res.data;
    }
    return NextResponse.json({ log: data, client });
  }

  if (entity === "team") {
    const p = parseTeam(b, false);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    const { data, error } = await supabaseAdmin.from("consult_team").insert({ ...p.fields, org_id: orgId }).select(TEAM_COLS).single();
    if (error) {
      const dup = error.code === "23505";
      return NextResponse.json({ error: dup ? "الاسم موجود في الفريق" : error.message }, { status: dup ? 409 : 500 });
    }
    return NextResponse.json({ member: data });
  }

  return NextResponse.json({ error: "غير موجود" }, { status: 404 });
}
