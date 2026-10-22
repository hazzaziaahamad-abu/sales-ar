import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRoomAccess } from "@/lib/api/salon-room-auth";
import { CLIENT_COLS, DEFAULT_TARGETS, LOG_COLS, TASK_COLS, TEAM_COLS, type RoomClient } from "@/lib/salon-room";

export const runtime = "nodejs";

/** GET /api/salon-room → عملاء الغرفة ومهامهم وآخر السجل والفريق. */
export async function GET(req: NextRequest) {
  const access = await getRoomAccess(req);
  if (access instanceof NextResponse) return access;
  const o = access.orgId;
  const [clients, tasks, logs, team, settings] = await Promise.all([
    supabaseAdmin.from("consult_clients").select(CLIENT_COLS).eq("org_id", o).eq("archived", false).order("updated_at", { ascending: false }).limit(500),
    supabaseAdmin.from("consult_tasks").select(TASK_COLS).eq("org_id", o).order("sort_order").limit(10000),
    supabaseAdmin.from("consult_logs").select(LOG_COLS).eq("org_id", o).order("created_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("consult_team").select(TEAM_COLS).eq("org_id", o).order("created_at"),
    supabaseAdmin.from("consult_room_settings").select("targets").eq("org_id", o).maybeSingle(),
  ]);
  const err = clients.error ?? tasks.error ?? logs.error ?? team.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  const active = new Set((clients.data ?? []).map((c) => c.id));
  return NextResponse.json(
    {
      clients: ((clients.data ?? []) as RoomClient[]).map((c) => ({ ...c, contract_value: c.contract_value === null ? null : Number(c.contract_value) })),
      tasks: (tasks.data ?? []).filter((t) => active.has(t.client_id)),
      logs: (logs.data ?? []).filter((l) => active.has(l.client_id)),
      team: team.data ?? [],
      targets: { ...DEFAULT_TARGETS, ...(settings.data?.targets ?? {}) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
