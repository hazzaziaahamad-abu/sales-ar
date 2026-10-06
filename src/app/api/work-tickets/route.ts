import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { TICKET_KINDS, TICKET_PRIORITIES } from "@/lib/work-tickets";

export const runtime = "nodejs";

/** GET /api/work-tickets → تذاكر المنظمة. */
export async function GET() {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("work_tickets")
    .select("*")
    .eq("org_id", access.orgId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tickets: data ?? [], me: { id: access.userId, isManager: access.isManager } });
}

/** POST /api/work-tickets → فتح تذكرة. */
export async function POST(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = TICKET_KINDS.includes(body.kind) ? body.kind : null;
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const clientName = kind === "customer_request" ? String(body.client_name ?? "").trim() || null : null;
  const priority = TICKET_PRIORITIES.includes(body.priority) ? body.priority : "normal";
  const dueDate = typeof body.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.due_date) ? body.due_date : null;
  const assignedTo = typeof body.assigned_to === "string" && body.assigned_to ? body.assigned_to : null;
  const assignedToName = assignedTo ? String(body.assigned_to_name ?? "").trim() || null : null;

  if (!kind || !title) return NextResponse.json({ error: "النوع والعنوان مطلوبان" }, { status: 400 });
  if (kind === "customer_request" && !clientName) return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });

  const { data: ticket, error } = await supabaseAdmin
    .from("work_tickets")
    .insert({
      org_id: access.orgId,
      kind, title, description, client_name: clientName, priority, due_date: dueDate,
      assigned_to: assignedTo, assigned_to_name: assignedToName,
      created_by: access.userId, created_by_name: access.name,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("work_ticket_events").insert({
    ticket_id: ticket.id, org_id: access.orgId, event_type: "created",
    body: assignedToName ? `تم فتح التذكرة وإسنادها إلى ${assignedToName}` : "تم فتح التذكرة",
    actor_name: access.name,
  });

  return NextResponse.json({ ticket });
}
