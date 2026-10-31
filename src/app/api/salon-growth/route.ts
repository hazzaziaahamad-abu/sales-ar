import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  APPT_COLS, CLIENT_COLS, MEMBERSHIP_COLS, DEFAULT_SETTINGS, SETTING_KEYS, buildDemoData,
  type ApptRow, type ClientRow, type MembershipRow, type Settings,
} from "@/lib/salon-growth";
import { isSuperAdmin } from "@/lib/permissions";
import { fetchAll, getSalonAccess, toNum } from "./shared";

export const runtime = "nodejs";

const DAY = 86_400_000;

async function loadAll(orgId: string) {
  const from = new Date(Date.now() - 200 * DAY).toISOString();
  const to = new Date(Date.now() + 60 * DAY).toISOString();
  const [clients, appts, memberships, settingsRes] = await Promise.all([
    fetchAll<ClientRow>((a, b) =>
      supabaseAdmin.from("salon_clients").select(CLIENT_COLS).eq("org_id", orgId).order("created_at").range(a, b)),
    fetchAll<ApptRow>((a, b) =>
      supabaseAdmin.from("salon_appointments").select(APPT_COLS).eq("org_id", orgId)
        .gte("starts_at", from).lte("starts_at", to).order("starts_at").range(a, b), 20000),
    supabaseAdmin.from("salon_memberships").select(MEMBERSHIP_COLS).eq("org_id", orgId).order("sort_order").order("created_at"),
    supabaseAdmin.from("salon_growth_settings").select("key, value").eq("org_id", orgId),
  ]);
  if (memberships.error) throw new Error(memberships.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  const settings: Settings = { ...DEFAULT_SETTINGS };
  // مفاتيح اللوحة فقط — «الخطة المبسطة» (simple) للسوبر أدمن عبر /api/salon-simple وما تطلع هنا
  for (const r of settingsRes.data ?? []) if ((SETTING_KEYS as readonly string[]).includes(r.key)) (settings as Record<string, unknown>)[r.key] = r.value;
  return {
    clients: clients.map((c) => toNum(c, ["total_spent", "visits"])),
    appts: appts.map((a) => toNum(a, ["price", "duration_minutes"])),
    memberships: ((memberships.data ?? []) as MembershipRow[]).map((m) => toNum(m, ["price", "members"])),
    settings: {
      ...settings,
      templates: { ...DEFAULT_SETTINGS.templates, ...settings.templates },
      diagnosis: { ...DEFAULT_SETTINGS.diagnosis, ...settings.diagnosis },
      marketing: { ...DEFAULT_SETTINGS.marketing, ...settings.marketing },
    },
  };
}

/** GET /api/salon-growth → كل بيانات اللوحة للمنظمة (العميلات، مواعيد ~٦ أشهر، العضويات، الإعدادات). */
export async function GET() {
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  try {
    const data = await loadAll(access.orgId);
    return NextResponse.json({ ...data, me: { isManager: access.isManager, isSuper: await isSuperAdmin(access.userId) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** POST /api/salon-growth { action: "seed" } → تعبئة ببيانات تجريبية (فقط لو اللوحة فاضية). */
export async function POST(req: NextRequest) {
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  if (b.action !== "seed") return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });

  const [{ count: c1 }, { count: c2 }, { count: c3 }] = await Promise.all([
    supabaseAdmin.from("salon_clients").select("id", { count: "exact", head: true }).eq("org_id", access.orgId),
    supabaseAdmin.from("salon_appointments").select("id", { count: "exact", head: true }).eq("org_id", access.orgId),
    supabaseAdmin.from("salon_memberships").select("id", { count: "exact", head: true }).eq("org_id", access.orgId),
  ]);
  if ((c1 ?? 0) + (c2 ?? 0) + (c3 ?? 0) > 0) {
    return NextResponse.json({ error: "اللوحة فيها بيانات — التعبئة التجريبية للّوحة الفاضية فقط" }, { status: 409 });
  }

  const demo = buildDemoData(Date.now(), Math.floor(Math.random() * 1e9));
  const org_id = access.orgId;
  const insertChunks = async (table: string, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from(table).insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
  };
  try {
    await insertChunks("salon_clients", demo.clients.map((c) => ({ ...c, org_id })));
    await insertChunks("salon_appointments", demo.appts.map((a) => ({ ...a, org_id, created_by: access.userId })));
    await insertChunks("salon_memberships", demo.memberships.map((m) => ({ ...m, org_id })));
    const data = await loadAll(org_id);
    return NextResponse.json({ ...data, me: { isManager: access.isManager } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
