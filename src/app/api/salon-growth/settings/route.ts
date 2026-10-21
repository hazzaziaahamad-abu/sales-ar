import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSalonAccess, isSettingKey } from "../shared";

export const runtime = "nodejs";

/** PUT /api/salon-growth/settings { key, value } → حفظ إعداد (القوالب، الاستقبال، الخصم، اسم الصالون…). */
export async function PUT(req: NextRequest) {
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  if (!isSettingKey(b.key)) return NextResponse.json({ error: "مفتاح غير معروف" }, { status: 400 });
  if (b.value === undefined || JSON.stringify(b.value).length > 60000) {
    return NextResponse.json({ error: "قيمة غير صالحة" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("salon_growth_settings").upsert(
    { org_id: access.orgId, key: b.key, value: b.value, updated_at: new Date().toISOString() },
    { onConflict: "org_id,key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
