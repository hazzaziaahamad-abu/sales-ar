import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import {
  TICKET_STATUSES, TICKET_PRIORITIES, TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS,
  isClosedStatus, type TicketStatus, type TicketPriority,
} from "@/lib/work-tickets";

export const runtime = "nodejs";

/**
 * PATCH /api/work-tickets/[id]  { status?, resolution?, assigned_to?, assigned_to_name?, priority?, due_date? }
 * الإغلاق كـ«منجزة» يتطلب كتابة وش انعمل (resolution).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const { data: existing } = await supabaseAdmin
    .from("work_tickets")
    .select("*")
    .eq("id", id)
    .eq("org_id", access.orgId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });

  const isAssignee = existing.assigned_to === access.userId;
  if (!access.isManager && !isAssignee) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const events: { event_type: string; body: string }[] = [];

  if (TICKET_STATUSES.includes(body.status) && body.status !== existing.status) {
    const status = body.status as TicketStatus;
    const resolution = String(body.resolution ?? "").trim();
    if (status === "done" && !resolution) {
      return NextResponse.json({ error: "اكتب وش انعمل قبل إغلاق التذكرة" }, { status: 400 });
    }
    patch.status = status;
    if (isClosedStatus(status)) {
      patch.closed_at = new Date().toISOString();
      patch.closed_by_name = access.name;
      patch.resolution = resolution || null;
    } else {
      patch.closed_at = null;
      patch.closed_by_name = null;
    }
    events.push({
      event_type: "status",
      body: `${TICKET_STATUS_LABELS[status]}${resolution ? ` — ${resolution}` : ""}`,
    });
  }

  // الإسناد والأولوية والموعد: للمدراء فقط
  if (access.isManager) {
    if ("assigned_to" in body && (body.assigned_to || null) !== existing.assigned_to) {
      const assignedTo = typeof body.assigned_to === "string" && body.assigned_to ? body.assigned_to : null;
      const name = assignedTo ? String(body.assigned_to_name ?? "").trim() || null : null;
      patch.assigned_to = assignedTo;
      patch.assigned_to_name = name;
      events.push({ event_type: "assigned", body: name ? `أُسندت إلى ${name}` : "أُلغي الإسناد" });
    }
    if (TICKET_PRIORITIES.includes(body.priority) && body.priority !== existing.priority) {
      patch.priority = body.priority;
      events.push({ event_type: "edited", body: `الأولوية: ${TICKET_PRIORITY_LABELS[body.priority as TicketPriority]}` });
    }
    if ("due_date" in body) {
      const due = typeof body.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date) ? body.due_date : null;
      if (due !== existing.due_date) {
        patch.due_date = due;
        events.push({ event_type: "edited", body: due ? `موعد الإنجاز: ${due}` : "أُلغي موعد الإنجاز" });
      }
    }
  }

  if (events.length === 0) return NextResponse.json({ ticket: existing });

  const { data: ticket, error } = await supabaseAdmin
    .from("work_tickets")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("work_ticket_events").insert(
    events.map((e) => ({ ...e, ticket_id: id, org_id: access.orgId, actor_name: access.name }))
  );

  return NextResponse.json({ ticket });
}
