import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDailyAccess, loadSettings } from "@/lib/daily-tasks/server";
import { DEPARTMENTS, riyadhDate } from "@/lib/daily-tasks/shared";

export const runtime = "nodejs";

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * GET /api/daily-tasks/team?date=[&from=] → أولويات الفريق (للمتابعة اليومية). بلا تقارير ولا أرقام.
 * from = أول يوم (لتقييم أولويات الأسبوع). members = أسماء الموزّعين على أقسام «مهام اليوم».
 */
export async function GET(req: NextRequest) {
  const access = await getDailyAccess(null);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const qd = req.nextUrl.searchParams.get("date");
  const date = isDay(qd) ? qd : riyadhDate();
  const qf = req.nextUrl.searchParams.get("from");
  const from = isDay(qf) && qf <= date ? qf : date;
  const [plansRes, settings] = await Promise.all([
    supabaseAdmin.from("rep_daily_plans")
      .select("user_id, user_name, plan_date, priorities, started_at, finished_at")
      .eq("org_id", access.orgId).gte("plan_date", from).lte("plan_date", date),
    loadSettings(access.orgId),
  ]);
  if (plansRes.error) return NextResponse.json({ error: plansRes.error.message }, { status: 500 });
  const members = [...new Set(DEPARTMENTS.flatMap((d) => (settings.members[d] ?? []).map((m) => m.name)))];
  return NextResponse.json({ orgId: access.orgId, date, from, plans: plansRes.data ?? [], members });
}
