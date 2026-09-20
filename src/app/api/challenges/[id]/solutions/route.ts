import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getManagerContext } from "@/lib/api/challenge-access";

export const runtime = "nodejs";

/** POST /api/challenges/[id]/solutions → إضافة حل يدوي من المدير. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "محتوى الحل مطلوب" }, { status: 400 });

  const { data: challenge } = await supabaseAdmin
    .from("employee_challenges")
    .select("id, org_id")
    .eq("id", id)
    .single();
  if (!challenge) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const { data: solution, error } = await supabaseAdmin
    .from("challenge_solutions")
    .insert({
      challenge_id: id,
      org_id: challenge.org_id,
      source: "manager",
      content,
      expected_impact: body.expected_impact ? String(body.expected_impact).trim() : null,
      created_by: mgr.user.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("challenge_events").insert({
    challenge_id: id,
    org_id: challenge.org_id,
    event_type: "solution_added",
    description: "أضاف المدير حلاً",
    actor_name: mgr.profile?.name ?? "المدير",
  });

  return NextResponse.json({ solution });
}

/** PATCH /api/challenges/[id]/solutions → تعليم حل كمطبَّق/غير مطبَّق. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const solutionId = String(body.solution_id ?? "");
  if (!solutionId) return NextResponse.json({ error: "solution_id مطلوب" }, { status: 400 });

  const isApplied = body.is_applied === true;

  const { data: solution, error } = await supabaseAdmin
    .from("challenge_solutions")
    .update({ is_applied: isApplied, applied_at: isApplied ? new Date().toISOString() : null })
    .eq("id", solutionId)
    .eq("challenge_id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (isApplied && solution) {
    await supabaseAdmin.from("challenge_events").insert({
      challenge_id: id,
      org_id: solution.org_id,
      event_type: "solution_applied",
      description: "تم تطبيق حل",
      actor_name: mgr.profile?.name ?? "المدير",
    });
  }

  return NextResponse.json({ solution });
}

/** DELETE /api/challenges/[id]/solutions?solutionId=... → حذف حل. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const { id } = await ctx.params;
  const solutionId = req.nextUrl.searchParams.get("solutionId");
  if (!solutionId) return NextResponse.json({ error: "solutionId مطلوب" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("challenge_solutions")
    .delete()
    .eq("id", solutionId)
    .eq("challenge_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
