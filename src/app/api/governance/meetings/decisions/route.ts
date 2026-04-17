import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hasPermission } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("governance_weekly_decisions")
    .select("*, decided_by_profile:user_profiles!decided_by(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await hasPermission(user.id, "create_weekly_decisions"))) {
    return NextResponse.json({ error: "ممنوع" }, { status: 403 });
  }

  const body = await req.json();
  const { decisions } = body;

  if (!Array.isArray(decisions) || decisions.length === 0) {
    return NextResponse.json({ error: "decisions array is required" }, { status: 400 });
  }

  if (decisions.length > 3) {
    return NextResponse.json(
      { error: "الحد الأقصى ٣ قرارات في الأسبوع" },
      { status: 400 }
    );
  }

  const weekStart = getWeekStart();

  const { data: existing } = await supabaseAdmin
    .from("governance_weekly_decisions")
    .select("id")
    .eq("week_start", weekStart);

  const totalThisWeek = (existing?.length || 0) + decisions.length;
  if (totalThisWeek > 3) {
    return NextResponse.json(
      { error: `تم تسجيل ${existing?.length || 0} قرارات هذا الأسبوع. الحد الأقصى ٣.` },
      { status: 400 }
    );
  }

  const rows = decisions.map((d: { text: string; notes?: string }) => ({
    decision_text: d.text,
    decided_by: user.id,
    week_start: weekStart,
    notes_ar: d.notes || null,
  }));

  const { data, error } = await supabaseAdmin
    .from("governance_weekly_decisions")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}
