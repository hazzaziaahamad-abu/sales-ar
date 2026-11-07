import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isSuperAdmin } from "@/lib/permissions";
import { meetingOutcome, type ClientMeetingRow } from "@/lib/client-meetings";
import { ensureClientMeetingLink, CLIENT_MEETING_COLS as COLS } from "@/lib/api/client-meeting-link";

export const runtime = "nodejs";

/**
 * POST /api/client-meetings { deal_id } → رابط خطة اجتماع لصفقة.
 * رابط واحد لكل صفقة: لو موجود نرجّعه، وإلا ننشئه باسم الموظف الحالي.
 */
export async function POST(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { deal_id?: string };
  const dealId = String(body.deal_id ?? "");
  if (!dealId) return NextResponse.json({ error: "deal_id مطلوب" }, { status: 400 });

  const res = await ensureClientMeetingLink(dealId, access);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ meeting: res.meeting, url: `/offer/meeting?m=${res.meeting.token}` });
}

/**
 * GET /api/client-meetings → اجتماعات + نتيجة كل واحد (من مرحلة الصفقة الحالية).
 * السوبر أدمن: كل المنظمات · المدير: منظمته · الموظف: اجتماعاته فقط.
 */
export async function GET() {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const superAdmin = await isSuperAdmin(access.userId);

  let q = supabaseAdmin.from("client_meetings").select(COLS).order("created_at", { ascending: false }).limit(2000);
  if (!superAdmin) q = q.eq("org_id", access.orgId);
  if (!access.isManager) q = q.eq("rep_id", access.userId);
  const { data: meetings, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dealIds = [...new Set((meetings ?? []).map((m) => m.deal_id).filter(Boolean))] as string[];
  const stages = new Map<string, string | null>();
  for (let i = 0; i < dealIds.length; i += 300) {
    const { data: deals } = await supabaseAdmin.from("deals").select("id, stage").in("id", dealIds.slice(i, i + 300));
    for (const d of deals ?? []) stages.set(d.id, d.stage ?? null);
  }

  const rows: ClientMeetingRow[] = (meetings ?? []).map((m) => {
    const current = m.deal_id ? stages.get(m.deal_id) ?? null : null;
    return { ...m, current_stage: current, outcome: meetingOutcome(m.stage_at_start, current) };
  });
  return NextResponse.json(
    { meetings: rows, me: { id: access.userId, isManager: access.isManager || superAdmin } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
