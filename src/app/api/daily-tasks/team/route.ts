import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDailyAccess } from "@/lib/daily-tasks/server";
import { riyadhDate } from "@/lib/daily-tasks/shared";

export const runtime = "nodejs";

/** GET /api/daily-tasks/team?date= → أولويات الفريق لليوم (للمتابعة اليومية). بلا تقارير ولا أرقام. */
export async function GET(req: NextRequest) {
  const access = await getDailyAccess(null);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const qd = req.nextUrl.searchParams.get("date");
  const date = qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : riyadhDate();
  const { data, error } = await supabaseAdmin.from("rep_daily_plans")
    .select("user_id, user_name, priorities, started_at, finished_at")
    .eq("org_id", access.orgId).eq("plan_date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orgId: access.orgId, date, plans: data ?? [] });
}
