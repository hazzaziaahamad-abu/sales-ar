import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, isSuperAdmin, hasPermission } from "@/lib/permissions";
import { getManagerContext, getChallengeProfile } from "@/lib/api/challenge-access";

export const runtime = "nodejs";

const CATEGORIES = ["communication", "coworker_error", "admin_delay", "other"];
const SEVERITIES = ["low", "medium", "high"];

/** GET /api/challenges?orgId=...  → قائمة التحديات للمدير (مع أعداد الحلول). */
export async function GET(req: NextRequest) {
  const ctx = await getManagerContext();
  if (!ctx.ok) return NextResponse.json({ error: "Unauthorized" }, { status: ctx.status });

  const orgId = req.nextUrl.searchParams.get("orgId") || ctx.profile?.org_id;
  if (!orgId) return NextResponse.json({ error: "orgId is required" }, { status: 400 });

  const { data: challenges, error } = await supabaseAdmin
    .from("employee_challenges")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (challenges ?? []).map((c) => ({
    ...c,
    // إخفاء هوية المقدّم عند اختياره الإخفاء.
    submitter_name: c.is_anonymous ? null : c.submitter_name,
    submitted_by: c.is_anonymous ? null : c.submitted_by,
  }));

  return NextResponse.json({ challenges: rows });
}

/** POST /api/challenges  → رفع تحدٍّ جديد من الموظف. */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const category = CATEGORIES.includes(body.category) ? body.category : "communication";
  const severity = SEVERITIES.includes(body.severity) ? body.severity : "medium";
  const isAnonymous = body.is_anonymous === true;
  const againstParty = body.against_party ? String(body.against_party).trim() : null;

  if (!title || !description) {
    return NextResponse.json({ error: "العنوان والوصف مطلوبان" }, { status: 400 });
  }

  const profile = await getChallengeProfile(user.id);
  const orgId = profile?.org_id;
  if (!orgId) return NextResponse.json({ error: "تعذّر تحديد المنظمة" }, { status: 400 });

  // origin = 'manager' مسموح فقط لمن يملك صلاحية إدارة التحديات (وإلا يبقى employee).
  let origin: "employee" | "manager" = "employee";
  if (body.origin === "manager") {
    const isManager = (await isSuperAdmin(user.id)) || (await hasPermission(user.id, "challenges_manage"));
    if (isManager) origin = "manager";
  }

  const { data: challenge, error } = await supabaseAdmin
    .from("employee_challenges")
    .insert({
      org_id: orgId,
      submitted_by: user.id,
      submitter_name: profile?.name ?? null,
      is_anonymous: origin === "manager" ? false : isAnonymous,
      category,
      against_party: againstParty,
      title,
      description,
      severity,
      status: "new",
      origin,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("challenge_events").insert({
    challenge_id: challenge.id,
    org_id: orgId,
    event_type: "submitted",
    description: origin === "manager" ? "رفع المدير تحديًا" : "تم رفع التحدي",
    actor_name: origin === "manager" ? profile?.name ?? "المدير" : isAnonymous ? "موظف (بدون اسم)" : profile?.name ?? null,
  });

  return NextResponse.json({ id: challenge.id, challenge_number: challenge.challenge_number });
}
