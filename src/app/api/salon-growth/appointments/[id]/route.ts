import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  APPT_COLS, CLIENT_COLS, applyStatus, clientAfterVisit,
  type ApptRow, type ApptStatus, type ClientRow,
} from "@/lib/salon-growth";
import { getSalonAccess, parseAddons, toNum } from "../../shared";

export const runtime = "nodejs";

const STATUSES: ApptStatus[] = ["waiting", "in_progress", "done"];

/** PATCH /api/salon-growth/appointments/[id] { status?, addons?, reminded? } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;

  const { data: existing } = await supabaseAdmin
    .from("salon_appointments").select(APPT_COLS).eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const before = toNum(existing as ApptRow, ["price", "duration_minutes"]);
  const nowIso = new Date().toISOString();

  let next: ApptRow = { ...before };
  if ("addons" in b) {
    const addons = parseAddons(b.addons);
    if (!addons) return NextResponse.json({ error: "إضافات غير صالحة" }, { status: 400 });
    next.addons = addons;
  }
  if ("status" in b) {
    if (!STATUSES.includes(b.status as ApptStatus)) return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    next = applyStatus(next, b.status as ApptStatus, nowIso);
  }
  if (b.reminded === true) next.reminded_at = nowIso;

  const { data, error } = await supabaseAdmin
    .from("salon_appointments")
    .update({
      addons: next.addons, status: next.status, started_at: next.started_at, completed_at: next.completed_at,
      reminded_at: next.reminded_at, updated_at: nowIso,
    })
    .eq("id", id).eq("org_id", access.orgId)
    .select(APPT_COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const appointment = toNum(data as ApptRow, ["price", "duration_minutes"]);

  // اكتمال الموعد: آخر زيارة + إجمالي الإنفاق + عدد الزيارات للعميلة
  let client: ClientRow | null = null;
  if (before.status !== "done" && appointment.status === "done" && appointment.client_id) {
    const { data: c } = await supabaseAdmin
      .from("salon_clients").select(CLIENT_COLS).eq("id", appointment.client_id).eq("org_id", access.orgId).maybeSingle();
    if (c) {
      const updated = clientAfterVisit(toNum(c as ClientRow, ["total_spent", "visits"]), appointment, nowIso);
      const res = await supabaseAdmin
        .from("salon_clients")
        .update({
          last_visit_at: updated.last_visit_at, total_spent: updated.total_spent, visits: updated.visits,
          favorite_service: updated.favorite_service, updated_at: nowIso,
        })
        .eq("id", updated.id).select(CLIENT_COLS).single();
      if (!res.error) client = toNum(res.data as ClientRow, ["total_spent", "visits"]);
    }
  }
  return NextResponse.json({ appointment, client });
}

/** DELETE /api/salon-growth/appointments/[id] → إلغاء موعد (لم يكتمل). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  const { error } = await supabaseAdmin
    .from("salon_appointments").delete().eq("id", id).eq("org_id", access.orgId).neq("status", "done");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
