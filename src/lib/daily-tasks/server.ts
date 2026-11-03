// «مهام اليوم» — مساعدات الخادم (service role). لا تُستورد في مكونات العميل.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, isSuperAdmin } from "@/lib/permissions";
import { getChallengeProfile, isHuddleManager } from "@/lib/api/challenge-access";
import {
  DEFAULT_PIPELINE_RATES, SETTING_KEYS, parseSettings, riyadhDate,
  type DailySettings, type Department, type DeptBaseline,
} from "./shared";

export interface DailyAccess {
  userId: string;
  name: string;
  orgId: string;
  isManager: boolean;
  isSuper: boolean;
  /** السوبر أدمن يتصفّح كموظف آخر (قراءة فقط) */
  viewingAs: boolean;
}

/** المستخدم + المنشأة. ?as= مسموح للسوبر أدمن فقط وللقراءة. */
export async function getDailyAccess(asUserId?: string | null): Promise<DailyAccess | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const profile = await getChallengeProfile(user.id);
  if (!profile?.org_id) return null;
  const isSuper = await isSuperAdmin(user.id);
  const isManager = isSuper || (await isHuddleManager(user.id, profile.org_id));
  if (asUserId && isSuper && asUserId !== user.id) {
    const other = await getChallengeProfile(asUserId);
    if (other?.org_id) {
      return { userId: other.id, name: other.name ?? "", orgId: other.org_id, isManager: false, isSuper: false, viewingAs: true };
    }
  }
  return { userId: user.id, name: profile.name ?? "", orgId: profile.org_id, isManager, isSuper, viewingAs: false };
}

export async function loadSettings(orgId: string): Promise<DailySettings> {
  const { data } = await supabaseAdmin
    .from("sales_guide_settings")
    .select("setting_key, setting_value")
    .eq("org_id", orgId)
    .in("setting_key", Object.values(SETTING_KEYS));
  return parseSettings((data ?? []) as { setting_key: string; setting_value: unknown }[]);
}

export async function saveSetting(orgId: string, key: string, value: unknown) {
  const { error } = await supabaseAdmin
    .from("sales_guide_settings")
    .upsert({ org_id: orgId, setting_key: key, setting_value: value, updated_at: new Date().toISOString() }, { onConflict: "org_id,setting_key" });
  if (error) throw error;
}

/** مستلمو إشعار «بدأ مهام اليوم»: السوبر أدمن في المنشأة + مدراء المتابعة اليومية. */
export async function managerIds(orgId: string): Promise<string[]> {
  const [{ data: supers }, { data: hm }] = await Promise.all([
    supabaseAdmin.from("user_profiles").select("id").eq("org_id", orgId).eq("is_super_admin", true).eq("is_active", true),
    supabaseAdmin.from("sales_guide_settings").select("setting_value").eq("org_id", orgId).eq("setting_key", "huddle_managers").maybeSingle(),
  ]);
  const ids = new Set<string>((supers ?? []).map((u: { id: string }) => u.id));
  const list = hm?.setting_value;
  if (Array.isArray(list)) for (const m of list as { id?: string }[]) if (m?.id) ids.add(m.id);
  return [...ids];
}

// ─── المحقق والأساسيات ───────────────────────────────────────────────────
const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
function prevMonths(period: string, n: number): string[] {
  let [y, m] = period.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) { m--; if (m === 0) { m = 12; y--; } out.unshift(ym(y, m)); }
  return out;
}

/** تاريخ احتساب التجديد المكتمل — نفس صفحة التجديدات. */
const renewalPaidDate = (r: { payment_date: string | null; updated_at: string | null; renewal_date: string | null }) =>
  (r.payment_date || r.updated_at || r.renewal_date || "").slice(0, 10);

type DealRow = { deal_value: number | null; sales_type: string | null; assigned_rep_name: string | null; month: number | null; year: number | null };
type RenewalRow = { plan_price: number | null; assigned_rep: string | null; status: string; renewal_date: string | null; payment_date: string | null; updated_at: string | null; sales_type: string | null };

/** أساسيات الأقسام الثلاثة للشهر: المحقق، آخر ٣ أشهر، القائمة الساخنة. */
export async function loadBaselines(orgId: string, period: string, withHistory: boolean): Promise<Record<Department, DeptBaseline>> {
  const months = withHistory ? prevMonths(period, 3) : [];
  const all = [...months, period];
  const years = [...new Set(all.map((p) => Number(p.slice(0, 4))))];

  const { data: dealsData } = await supabaseAdmin
    .from("deals")
    .select("deal_value, sales_type, assigned_rep_name, month, year")
    .eq("org_id", orgId)
    .eq("stage", "مكتملة")
    .in("year", years)
    .limit(5000);
  const deals = ((dealsData ?? []) as DealRow[]).filter((d) => d.year && d.month && all.includes(ym(d.year, d.month)));

  const fromDate = `${all[0]}-01`;
  const { data: renData } = await supabaseAdmin
    .from("renewals")
    .select("plan_price, assigned_rep, status, renewal_date, payment_date, updated_at, sales_type")
    .eq("org_id", orgId)
    .or(`renewal_date.gte.${fromDate},payment_date.gte.${fromDate},updated_at.gte.${fromDate}`)
    .limit(5000);
  const renewals = (renData ?? []) as RenewalRow[];

  const empty = (): DeptBaseline => ({ history: [], pipeline: [], avgValue: 0, mtd: 0, mtdByRep: {}, newPerDay: 0 });
  const out: Record<Department, DeptBaseline> = { office: empty(), support: empty(), renewals: empty() };

  for (const dept of ["office", "support"] as const) {
    const rows = deals.filter((d) => d.sales_type === dept);
    const per = (p: string) => rows.filter((d) => ym(d.year!, d.month!) === p);
    const b = out[dept];
    b.history = months.map((p) => [p, Math.round(per(p).reduce((s, d) => s + Number(d.deal_value || 0), 0))]);
    for (const d of per(period)) {
      b.mtd += Number(d.deal_value || 0);
      const rep = (d.assigned_rep_name || "").trim();
      if (rep) b.mtdByRep[rep] = (b.mtdByRep[rep] ?? 0) + Number(d.deal_value || 0);
    }
    const hist = rows.filter((d) => months.includes(ym(d.year!, d.month!)) && Number(d.deal_value) > 0);
    b.avgValue = hist.length ? Math.round(hist.reduce((s, d) => s + Number(d.deal_value), 0) / hist.length) : 0;
  }

  // التجديدات
  {
    const b = out.renewals;
    const done = renewals.filter((r) => r.status === "مكتمل");
    const per = (p: string) => done.filter((r) => renewalPaidDate(r).slice(0, 7) === p);
    b.history = months.map((p) => [p, Math.round(per(p).reduce((s, r) => s + Number(r.plan_price || 0), 0))]);
    for (const r of per(period)) {
      b.mtd += Number(r.plan_price || 0);
      const rep = (r.assigned_rep || "").trim();
      if (rep) b.mtdByRep[rep] = (b.mtdByRep[rep] ?? 0) + Number(r.plan_price || 0);
    }
    const histDone = done.filter((r) => months.includes(renewalPaidDate(r).slice(0, 7)) && Number(r.plan_price) > 0);
    b.avgValue = histDone.length ? Math.round(histDone.reduce((s, r) => s + Number(r.plan_price), 0) / histDone.length) : 0;
    if (withHistory) {
      // نسبة التجديد الفعلية = المكتمل ÷ كل المستحق في الشهر (حسب تاريخ التجديد)
      const due = (p: string) => renewals.filter((r) => (r.renewal_date || "").slice(0, 7) === p);
      const rates = months.map((p) => { const all = due(p); return all.length ? all.filter((r) => r.status === "مكتمل").length / all.length : null; })
        .filter((x): x is number => x !== null);
      const rate = rates.length ? Math.round((rates.reduce((a, c) => a + c, 0) / rates.length) * 100) : 50;
      b.pipeline = [["مستحق تجديده هذا الشهر", due(period).length, rate]];
    }
  }

  if (withHistory) {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    await Promise.all((["office", "support"] as const).map(async (dept) => {
      const stages = Object.keys(DEFAULT_PIPELINE_RATES);
      const counts = await Promise.all(stages.map(async (stage) => {
        const { count } = await supabaseAdmin.from("deals").select("id", { count: "exact", head: true })
          .eq("org_id", orgId).eq("sales_type", dept).eq("stage", stage);
        return count ?? 0;
      }));
      out[dept].pipeline = stages.map((s, i) => [s, counts[i], DEFAULT_PIPELINE_RATES[s]]);
      const { count } = await supabaseAdmin.from("deals").select("id", { count: "exact", head: true })
        .eq("org_id", orgId).eq("sales_type", dept).gte("created_at", since);
      out[dept].newPerDay = Math.round(((count ?? 0) / 30) * 10) / 10;
    }));
  }

  for (const d of ["office", "support", "renewals"] as const) out[d].mtd = Math.round(out[d].mtd);
  return out;
}

/** صفقات الاستهداف التي أضافها الموظف اليوم (بتوقيت الرياض). */
export async function prospectCountToday(orgId: string, userName: string): Promise<number> {
  const today = riyadhDate();
  const start = new Date(`${today}T00:00:00+03:00`).toISOString();
  const name = `"${userName.trim().replace(/["\\]/g, "")}"`; // اقتباس لأن الأسماء فيها مسافات
  const { count } = await supabaseAdmin.from("deals").select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("source", ["استهداف", "من ارقام عشوائية"])
    .gte("created_at", start)
    .or(`added_by_name.eq.${name},and(added_by_name.is.null,assigned_rep_name.eq.${name})`);
  return count ?? 0;
}
