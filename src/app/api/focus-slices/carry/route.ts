import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSliceAccess } from "@/lib/api/focus-slices-access";
import { DAY_LIMIT, SLICE_COLS, isSliceSpace, nextDayFor, todayRiyadh, type SliceKind } from "@/lib/focus-slices";

export const runtime = "nodejs";

/**
 * POST /api/focus-slices/carry { space } → ترحيل شرائح اليوم غير المنجزة لليوم التالي
 * (في العمل الوظيفي = يوم الدوام التالي). يحترم حد اليوم (عميقة + ٣ سطحية) —
 * اللي ما لها مكان ترجع «باقي الشرائح».
 */
export async function POST(req: NextRequest) {
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const space = isSliceSpace(b.space) ? b.space : "work";
  const access = await getSliceAccess(space);
  if (access instanceof NextResponse) return access;

  const today = todayRiyadh();
  const target = nextDayFor(space);
  const base = () => supabaseAdmin.from("focus_slices").select(SLICE_COLS)
    .eq("org_id", access.orgId).eq("user_id", access.userId).eq("space", space);

  const [{ data: pending, error }, { data: already }] = await Promise.all([
    base().eq("planned_for", today).is("done_at", null).order("sort_order"),
    base().eq("planned_for", target),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const free: Record<SliceKind, number> = {
    deep: DAY_LIMIT.deep - (already ?? []).filter((s) => s.kind === "deep").length,
    shallow: DAY_LIMIT.shallow - (already ?? []).filter((s) => s.kind === "shallow").length,
  };
  const moved: string[] = [], overflow: string[] = [];
  for (const s of pending ?? []) {
    const k = s.kind as SliceKind;
    if (free[k] > 0) { free[k]--; moved.push(s.id); } else overflow.push(s.id);
  }
  const now = new Date().toISOString();
  if (moved.length) await supabaseAdmin.from("focus_slices").update({ planned_for: target, session_at: null, updated_at: now }).in("id", moved);
  if (overflow.length) await supabaseAdmin.from("focus_slices").update({ planned_for: null, session_at: null, updated_at: now }).in("id", overflow);
  return NextResponse.json({ moved: moved.length, overflow: overflow.length, target });
}
