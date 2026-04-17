import { NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasPermission(user.id, "view_total_revenue"))) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("deals")
    .select("deal_value, stage, deal_date")
    .eq("stage", "مكتملة");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalRevenue = (data || []).reduce((sum, d) => sum + (d.deal_value || 0), 0);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const monthlyRevenue = (data || [])
    .filter((d) => (d.deal_date || "") >= monthStart)
    .reduce((sum, d) => sum + (d.deal_value || 0), 0);

  return NextResponse.json({
    total_revenue: totalRevenue,
    monthly_revenue: monthlyRevenue,
    completed_deals: data?.length || 0,
  });
}
