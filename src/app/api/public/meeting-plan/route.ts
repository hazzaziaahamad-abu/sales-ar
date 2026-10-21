import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser, isSuperAdmin } from "@/lib/permissions";

// محتوى صفحة «خطة اجتماع العميل» (/offer/meeting) — نص قابل للتعديل لكل منتج.
// القراءة عامة (الصفحة تُفتح بدون تسجيل دخول)، والتعديل للسوبر أدمن فقط.
export const runtime = "nodejs";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
const PRODUCTS = ["menu", "nahjez"] as const;
const keyOf = (p: string) => `meeting_plan_${p}`;
const MAX_BYTES = 200_000;

async function canEdit() {
  const user = await getAuthUser().catch(() => null);
  return !!user && (await isSuperAdmin(user.id));
}

export async function GET() {
  const { data } = await supabaseAdmin
    .from("sales_guide_settings")
    .select("setting_key, setting_value")
    .eq("org_id", DEFAULT_ORG)
    .in("setting_key", PRODUCTS.map(keyOf));
  const content: Record<string, unknown> = {};
  for (const row of data ?? []) content[row.setting_key.replace("meeting_plan_", "")] = row.setting_value;
  return NextResponse.json({ content, canEdit: await canEdit() }, { headers: { "Cache-Control": "no-store" } });
}

/** PUT { product, content } — content = null يرجّع المحتوى الافتراضي. */
export async function PUT(req: NextRequest) {
  if (!(await canEdit())) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { product?: string; content?: unknown };
  const product = String(body.product ?? "");
  if (!(PRODUCTS as readonly string[]).includes(product)) {
    return NextResponse.json({ error: "منتج غير معروف" }, { status: 400 });
  }
  if (body.content === null) {
    const { error } = await supabaseAdmin
      .from("sales_guide_settings").delete().eq("org_id", DEFAULT_ORG).eq("setting_key", keyOf(product));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (!body.content || typeof body.content !== "object" || Array.isArray(body.content)) {
    return NextResponse.json({ error: "محتوى غير صالح" }, { status: 400 });
  }
  if (JSON.stringify(body.content).length > MAX_BYTES) {
    return NextResponse.json({ error: "المحتوى كبير جداً" }, { status: 413 });
  }
  const { error } = await supabaseAdmin.from("sales_guide_settings").upsert(
    { org_id: DEFAULT_ORG, setting_key: keyOf(product), setting_value: body.content, updated_at: new Date().toISOString() },
    { onConflict: "org_id,setting_key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
