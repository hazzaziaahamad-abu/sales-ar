import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getManagerContext } from "@/lib/api/challenge-access";

export const runtime = "nodejs";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** POST /api/challenges/[id]/measurements → إنشاء مؤشر قياس. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const metricName = String(body.metric_name ?? "").trim();
  if (!metricName) return NextResponse.json({ error: "اسم المؤشر مطلوب" }, { status: 400 });

  const { data: challenge } = await supabaseAdmin
    .from("employee_challenges")
    .select("id, org_id, status")
    .eq("id", id)
    .single();
  if (!challenge) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const { data: measurement, error } = await supabaseAdmin
    .from("challenge_measurements")
    .insert({
      challenge_id: id,
      org_id: challenge.org_id,
      metric_name: metricName,
      unit: body.unit ? String(body.unit).trim() : null,
      baseline_value: toNum(body.baseline_value),
      target_value: toNum(body.target_value),
      current_value: toNum(body.current_value),
      direction: body.direction === "decrease" ? "decrease" : "increase",
      measured_at: body.measured_at || null,
      note: body.note ? String(body.note).trim() : null,
      created_by: mgr.user.id,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("challenge_events").insert({
    challenge_id: id,
    org_id: challenge.org_id,
    event_type: "measurement_logged",
    description: `تم تعريف مؤشر القياس: ${metricName}`,
    actor_name: mgr.profile?.name ?? "المدير",
  });

  return NextResponse.json({ measurement });
}

/** PATCH /api/challenges/[id]/measurements → تحديث القيمة الحالية (بعد التطبيق). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const measurementId = String(body.measurement_id ?? "");
  if (!measurementId) return NextResponse.json({ error: "measurement_id مطلوب" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("current_value" in body) patch.current_value = toNum(body.current_value);
  if ("baseline_value" in body) patch.baseline_value = toNum(body.baseline_value);
  if ("target_value" in body) patch.target_value = toNum(body.target_value);
  if (typeof body.note === "string") patch.note = body.note.trim();
  if (body.measured_at) patch.measured_at = body.measured_at;

  const { data: measurement, error } = await supabaseAdmin
    .from("challenge_measurements")
    .update(patch)
    .eq("id", measurementId)
    .eq("challenge_id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if ("current_value" in body && measurement) {
    await supabaseAdmin.from("challenge_events").insert({
      challenge_id: id,
      org_id: measurement.org_id,
      event_type: "measurement_logged",
      description: `تحديث قياس «${measurement.metric_name}»: ${patch.current_value ?? "—"} ${measurement.unit ?? ""}`,
      actor_name: mgr.profile?.name ?? "المدير",
    });
  }

  return NextResponse.json({ measurement });
}

/** DELETE /api/challenges/[id]/measurements?measurementId=... */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const { id } = await ctx.params;
  const measurementId = req.nextUrl.searchParams.get("measurementId");
  if (!measurementId) return NextResponse.json({ error: "measurementId مطلوب" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("challenge_measurements")
    .delete()
    .eq("id", measurementId)
    .eq("challenge_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
