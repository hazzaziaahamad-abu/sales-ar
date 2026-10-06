import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, isSuperAdmin, hasPermission } from "@/lib/permissions";
import { getChallengeProfile, isHuddleManager } from "@/lib/api/challenge-access";
import { STATUS_LABELS, type ChallengeStatus } from "@/lib/challenges";

export const runtime = "nodejs";

const STATUSES = Object.keys(STATUS_LABELS);

/**
 * صلاحيات لوحة «التحديات والطلبات والتطويرات» في المتابعة اليومية:
 *  - مدير التحديات (سوبر أدمن / challenges_manage): يشوف ويحدّث كل شي.
 *  - مدير المتابعة اليومية: يشوف ويحدّث طلبات العملاء والتطويرات (التحديات خاصة بمدير التحديات).
 *  - الموظف: يشوف اللي رفعه هو فقط.
 */
async function getBoardAccess() {
  const user = await getAuthUser();
  if (!user) return null;
  const profile = await getChallengeProfile(user.id);
  const orgId = profile?.org_id;
  if (!orgId) return null;
  const challengeManager = (await isSuperAdmin(user.id)) || (await hasPermission(user.id, "challenges_manage"));
  const huddleManager = challengeManager || (await isHuddleManager(user.id, orgId));
  return { userId: user.id, orgId, name: profile?.name ?? null, challengeManager, huddleManager };
}

/** GET /api/challenges/board → العناصر المسموح للمستخدم يشوفها. */
export async function GET() {
  const access = await getBoardAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let query = supabaseAdmin
    .from("employee_challenges")
    .select("id, challenge_number, kind, client_name, category, title, description, against_party, severity, status, is_anonymous, submitted_by, submitter_name, created_at, updated_at, resolved_at")
    .eq("org_id", access.orgId)
    // الطلبات والتطويرات صارت تذاكر في work_tickets — المركز للتحديات فقط.
    .eq("kind", "challenge")
    .order("created_at", { ascending: false })
    .limit(300);

  if (!access.challengeManager) {
    query = query.eq("submitted_by", access.userId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((c) => {
    const mine = c.submitted_by === access.userId;
    return {
      ...c,
      mine,
      // إخفاء هوية المقدّم عند اختياره الإخفاء (إلا عن نفسه).
      submitter_name: c.is_anonymous && !mine ? null : c.submitter_name,
      submitted_by: undefined,
      // تفاصيل التحدي للمدير ولصاحبه فقط.
      description: c.kind === "challenge" && !mine && !access.challengeManager ? null : c.description,
      can_update: access.challengeManager || (access.huddleManager && c.kind !== "challenge"),
    };
  });

  return NextResponse.json({
    items,
    role: access.challengeManager ? "challenge_manager" : access.huddleManager ? "huddle_manager" : "employee",
  });
}

/** PATCH /api/challenges/board  { id, status } → تحديث الحالة لمن يملك الصلاحية. */
export async function PATCH(req: NextRequest) {
  const access = await getBoardAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const status = String(body.status ?? "") as ChallengeStatus;
  if (!id || !STATUSES.includes(status)) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("employee_challenges")
    .select("id, org_id, kind, status, resolved_at")
    .eq("id", id)
    .eq("org_id", access.orgId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const allowed = access.challengeManager || (access.huddleManager && existing.kind !== "challenge");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (existing.status === status) return NextResponse.json({ ok: true });

  const { error } = await supabaseAdmin
    .from("employee_challenges")
    .update({
      status,
      resolved_at: status === "resolved" ? new Date().toISOString() : existing.resolved_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("challenge_events").insert({
    challenge_id: id,
    org_id: access.orgId,
    event_type: status === "resolved" ? "resolved" : "status_changed",
    description: `تغيّرت الحالة إلى: ${STATUS_LABELS[status]}`,
    actor_name: access.name,
  });

  return NextResponse.json({ ok: true });
}
