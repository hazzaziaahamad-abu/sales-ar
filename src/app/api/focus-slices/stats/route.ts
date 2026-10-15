import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { addDays, deepStreak, todayRiyadh, weekStart, type FocusStats } from "@/lib/focus-slices";
import { saudiDateStr } from "@/lib/utils/format";

export const runtime = "nodejs";

/** GET /api/focus-slices/stats → عدّاد العمل العميق للمستخدم (كل المساحات). */
export async function GET() {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = todayRiyadh();
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("focus_slices").select("kind, done_at, focus_minutes")
    .eq("org_id", access.orgId).eq("user_id", access.userId)
    .not("done_at", "is", null).gte("done_at", since)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const start = weekStart(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => ({ date: addDays(start, i), deep: 0 }));
  const deepDays = new Set<string>();
  let weekMinutes = 0;
  for (const r of data ?? []) {
    const day = saudiDateStr(new Date(r.done_at as string));
    if (day >= start) weekMinutes += r.focus_minutes ?? 0;
    if (r.kind !== "deep") continue;
    deepDays.add(day);
    const w = weekDays.find((d) => d.date === day);
    if (w) w.deep++;
  }

  // أطول سلسلة خلال الفترة
  let best = 0, run = 0, prev = "";
  for (const d of [...deepDays].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  const stats: FocusStats = {
    today,
    weekDeep: weekDays.reduce((a, d) => a + d.deep, 0),
    weekDays,
    weekMinutes,
    streak: deepStreak(deepDays, today),
    bestStreak: best,
  };
  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}
