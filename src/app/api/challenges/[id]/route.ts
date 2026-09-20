import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getManagerContext } from "@/lib/api/challenge-access";

export const runtime = "nodejs";

const STATUSES = ["new", "under_review", "solutions_proposed", "in_progress", "measuring", "resolved", "closed"];
const SEVERITIES = ["low", "medium", "high"];

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  under_review: "قيد المراجعة",
  solutions_proposed: "حلول مقترحة",
  in_progress: "قيد التطبيق",
  measuring: "قياس النتائج",
  resolved: "تم الحل",
  closed: "مغلق",
};

/** GET /api/challenges/[id] → التفاصيل الكاملة للمدير (تحدٍّ + حلول + قياسات + أحداث). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const { id } = await ctx.params;

  const { data: challenge, error } = await supabaseAdmin
    .from("employee_challenges")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !challenge) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const [{ data: solutions }, { data: measurements }, { data: events }] = await Promise.all([
    supabaseAdmin.from("challenge_solutions").select("*").eq("challenge_id", id).order("created_at", { ascending: true }),
    supabaseAdmin.from("challenge_measurements").select("*").eq("challenge_id", id).order("created_at", { ascending: true }),
    supabaseAdmin.from("challenge_events").select("*").eq("challenge_id", id).order("created_at", { ascending: true }),
  ]);

  const view = {
    ...challenge,
    submitter_name: challenge.is_anonymous ? null : challenge.submitter_name,
    submitted_by: challenge.is_anonymous ? null : challenge.submitted_by,
  };

  return NextResponse.json({
    challenge: view,
    solutions: solutions ?? [],
    measurements: measurements ?? [],
    events: events ?? [],
  });
}

/** PATCH /api/challenges/[id] → تحديث الحالة/الشدة (المدير). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const { data: existing } = await supabaseAdmin
    .from("employee_challenges")
    .select("*")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let statusChanged = false;

  if (typeof body.status === "string" && STATUSES.includes(body.status)) {
    patch.status = body.status;
    statusChanged = body.status !== existing.status;
    patch.resolved_at = body.status === "resolved" ? new Date().toISOString() : existing.resolved_at;
  }
  if (typeof body.severity === "string" && SEVERITIES.includes(body.severity)) {
    patch.severity = body.severity;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("employee_challenges")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (statusChanged) {
    await supabaseAdmin.from("challenge_events").insert({
      challenge_id: id,
      org_id: existing.org_id,
      event_type: patch.status === "resolved" ? "resolved" : "status_changed",
      description: `تغيّرت الحالة إلى: ${STATUS_LABELS[patch.status as string] ?? patch.status}`,
      actor_name: mgr.profile?.name ?? "المدير",
    });
  }

  return NextResponse.json({ challenge: updated });
}
