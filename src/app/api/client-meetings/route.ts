import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isSuperAdmin } from "@/lib/permissions";
import { ORG_PRODUCT, meetingOutcome, type ClientMeetingRow } from "@/lib/client-meetings";

export const runtime = "nodejs";

const COLS =
  "id, org_id, deal_id, token, product, client_name, client_phone, rep_id, rep_name, stage_at_start, tier_name, open_count, first_opened_at, last_opened_at, created_at";

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

  const { data: deal } = await supabaseAdmin
    .from("deals").select("id, org_id, client_name, client_phone, stage").eq("id", dealId).maybeSingle();
  if (!deal) return NextResponse.json({ error: "الصفقة غير موجودة" }, { status: 404 });
  if (deal.org_id !== access.orgId && !(await isSuperAdmin(access.userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const product = ORG_PRODUCT[deal.org_id];
  if (!product) return NextResponse.json({ error: "منتج غير معروف" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("client_meetings").select(COLS).eq("deal_id", dealId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return NextResponse.json({ meeting: existing, url: `/offer/meeting?m=${existing.token}` });

  const { data, error } = await supabaseAdmin
    .from("client_meetings")
    .insert({
      org_id: deal.org_id,
      deal_id: deal.id,
      token: randomBytes(9).toString("base64url"),
      product,
      client_name: deal.client_name ?? "",
      client_phone: deal.client_phone ?? null,
      rep_id: access.userId,
      rep_name: access.name,
      stage_at_start: deal.stage ?? null,
    })
    .select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meeting: data, url: `/offer/meeting?m=${data.token}` });
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
