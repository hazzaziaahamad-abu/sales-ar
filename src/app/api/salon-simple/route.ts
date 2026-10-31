import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isSuperAdmin } from "@/lib/permissions";
import { DEFAULT_SESSION, DEFAULT_SIMPLE, type Simple } from "@/lib/salon-simple";

export const runtime = "nodejs";

const KEY = "simple";

/** «الخطة المبسطة للصالونات»: السوبر أدمن فقط. */
async function access() {
  const a = await getTicketAccess();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isSuperAdmin(a.userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return a;
}

/** GET /api/salon-simple → الخطة المحفوظة. */
export async function GET() {
  const a = await access();
  if (a instanceof NextResponse) return a;
  const { data, error } = await supabaseAdmin.from("salon_growth_settings").select("value").eq("org_id", a.orgId).eq("key", KEY).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const v = (data?.value ?? {}) as Partial<Simple>;
  const simple: Simple = {
    ...DEFAULT_SIMPLE, ...v,
    costs: { ...DEFAULT_SIMPLE.costs, ...v.costs },
    session: { ...DEFAULT_SESSION, ...v.session },
    months: Array.isArray(v.months) ? v.months : [],
  };
  return NextResponse.json({ simple }, { headers: { "Cache-Control": "no-store" } });
}

/** PUT /api/salon-simple { value } → حفظ الخطة. */
export async function PUT(req: NextRequest) {
  const a = await access();
  if (a instanceof NextResponse) return a;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const v = b.value;
  if (!v || typeof v !== "object" || Array.isArray(v) || JSON.stringify(v).length > 100000) {
    return NextResponse.json({ error: "قيمة غير صالحة" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("salon_growth_settings").upsert(
    { org_id: a.orgId, key: KEY, value: v, updated_at: new Date().toISOString() },
    { onConflict: "org_id,key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
