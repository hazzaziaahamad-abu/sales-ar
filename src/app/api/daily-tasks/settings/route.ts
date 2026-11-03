import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDailyAccess, loadBaselines, loadSettings, saveSetting } from "@/lib/daily-tasks/server";
import { DEPARTMENTS, SETTING_KEYS, riyadhDate, riyadhPeriod, type Department, type DeptMembers } from "@/lib/daily-tasks/shared";

export const runtime = "nodejs";

/** GET /api/daily-tasks/settings?date=YYYY-MM-DD — مركز الإعدادات (للمدير). */
export async function GET(req: NextRequest) {
  const access = await getDailyAccess(null);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.isManager) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });

  const period = riyadhPeriod();
  const qd = req.nextUrl.searchParams.get("date");
  const date = qd && /^\d{4}-\d{2}-\d{2}$/.test(qd) ? qd : riyadhDate();

  const [settings, baselines, targetsRes, usersRes, plansRes] = await Promise.all([
    loadSettings(access.orgId),
    loadBaselines(access.orgId, period, true),
    supabaseAdmin.from("dept_targets").select("*").eq("org_id", access.orgId).eq("period", period),
    supabaseAdmin.from("user_profiles").select("id, name").eq("org_id", access.orgId).eq("is_active", true).order("name"),
    supabaseAdmin.from("rep_daily_plans").select("*").eq("org_id", access.orgId).eq("plan_date", date).order("started_at"),
  ]);

  return NextResponse.json({
    period, date, settings, baselines,
    targets: targetsRes.data ?? [],
    users: usersRes.data ?? [],
    plans: plansRes.data ?? [],
  });
}

const num = (v: unknown, min = 0, max = 1e9) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };

/** POST /api/daily-tasks/settings — { settings?: {...}, target?: {...} } */
export async function POST(req: NextRequest) {
  const access = await getDailyAccess(null);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!access.isManager) return NextResponse.json({ error: "للمدير فقط" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  try {
    const s = body.settings;
    if (s && typeof s === "object") {
      if (Array.isArray(s.workDays)) {
        const wd = [...new Set((s.workDays as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
        if (!wd.length) return NextResponse.json({ error: "اختر يوم عمل واحداً على الأقل" }, { status: 400 });
        await saveSetting(access.orgId, SETTING_KEYS.workDays, wd);
      }
      if (s.queueCap !== undefined) {
        const cap = num(s.queueCap, 5, 500);
        if (cap !== null) await saveSetting(access.orgId, SETTING_KEYS.queueCap, Math.round(cap));
      }
      if (s.speed && typeof s.speed === "object") {
        const f = num(s.speed.fast, 0, 365), n = num(s.speed.normal, 0, 365), sl = num(s.speed.slow, 0, 365);
        if (f === null || n === null || sl === null || !(f <= n && n <= sl)) return NextResponse.json({ error: "حدود السرعة يجب أن تكون تصاعدية" }, { status: 400 });
        await saveSetting(access.orgId, SETTING_KEYS.speed, { fast: f, normal: n, slow: sl });
      }
      if (s.activity && typeof s.activity === "object") {
        const out: Record<string, { prospect: number; meetings: number }> = {};
        for (const d of DEPARTMENTS) {
          const a = s.activity[d] ?? {};
          out[d] = { prospect: Math.round(num(a.prospect, 0, 1000) ?? 0), meetings: Math.round(num(a.meetings, 0, 100) ?? 0) };
        }
        await saveSetting(access.orgId, SETTING_KEYS.activity, out);
      }
      if (s.members && typeof s.members === "object") {
        const { data: users } = await supabaseAdmin.from("user_profiles").select("id, name").eq("org_id", access.orgId);
        const valid = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]));
        const out: DeptMembers = {};
        for (const d of DEPARTMENTS) {
          const list = Array.isArray(s.members[d]) ? s.members[d] : [];
          out[d] = list
            .filter((m: { user_id?: string }) => m?.user_id && valid.has(m.user_id))
            .map((m: { user_id: string; sales_type?: string }) => ({
              user_id: m.user_id, name: valid.get(m.user_id)!,
              ...(d === "renewals" ? { sales_type: m.sales_type === "office" ? "office" as const : "support" as const } : {}),
            }));
        }
        await saveSetting(access.orgId, SETTING_KEYS.members, out);
      }
    }

    const t = body.target;
    if (t && typeof t === "object") {
      const dept = DEPARTMENTS.find((d) => d === t.department) as Department | undefined;
      const method = ["history", "pipeline", "manual"].includes(t.method) ? t.method : null;
      const target = num(t.target, 0);
      if (!dept || !method || !target) return NextResponse.json({ error: "الهدف غير مكتمل" }, { status: 400 });
      const min = num(t.min, 0), stretch = num(t.stretch, 0);
      if ((min !== null && min > target) || (stretch !== null && stretch < target)) {
        return NextResponse.json({ error: "الحد الأدنى ≤ الهدف ≤ الطموح" }, { status: 400 });
      }
      const shares = (Array.isArray(t.shares) ? t.shares : []) as { user_id: string; share_pct: number }[];
      const total = shares.reduce((a, x) => a + (Number(x.share_pct) || 0), 0);
      if (shares.length && Math.round(total) !== 100) return NextResponse.json({ error: "نسب التوزيع يجب أن تساوي ١٠٠٪" }, { status: 400 });

      const period = riyadhPeriod();
      const stamp = { approved_by: access.userId, approved_by_name: access.name, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      // نستبدل أهداف القسم وموظفيه لهذا الشهر دفعة واحدة
      const { error: delErr } = await supabaseAdmin.from("dept_targets").delete()
        .eq("org_id", access.orgId).eq("department", dept).eq("period", period).eq("metric", "revenue");
      if (delErr) throw delErr;
      const rows = [
        { org_id: access.orgId, department: dept, user_id: null, period, metric: "revenue", min_value: min, target_value: target, stretch_value: stretch, share_pct: null, method, basis: t.basis ?? null, ...stamp },
        ...shares.filter((x) => /^[0-9a-f-]{36}$/.test(x.user_id)).map((x) => {
          const p = (Number(x.share_pct) || 0) / 100;
          return { org_id: access.orgId, department: dept, user_id: x.user_id, period, metric: "revenue", min_value: min !== null ? Math.round(min * p) : null, target_value: Math.round(target * p), stretch_value: stretch !== null ? Math.round(stretch * p) : null, share_pct: Number(x.share_pct) || 0, method, basis: null, ...stamp };
        }),
      ];
      const { error } = await supabaseAdmin.from("dept_targets").insert(rows);
      if (error) throw error;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "تعذّر الحفظ" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
