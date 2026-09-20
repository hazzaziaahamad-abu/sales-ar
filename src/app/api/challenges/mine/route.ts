import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * GET /api/challenges/mine → تحديات الموظف الحالي (الحالة فقط، بدون حلول أو ملاحظات).
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("employee_challenges")
    .select("id, challenge_number, category, title, severity, status, is_anonymous, created_at, updated_at, resolved_at")
    .eq("submitted_by", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ challenges: data ?? [] });
}
