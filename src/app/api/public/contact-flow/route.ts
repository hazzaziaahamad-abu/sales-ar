import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PUBLIC_CONTENT_KEYS } from "@/lib/sales/public-content";

// قراءة فقط لمحتوى «مسار الاتصال» و«العميل سأل؟» للصفحة العامة /flow.
// مقصورة على المفاتيح المسموحة فقط.
const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!(PUBLIC_CONTENT_KEYS as readonly string[]).includes(key)) {
    return NextResponse.json({ value: null }, { status: 400 });
  }
  const { data } = await supabaseAdmin
    .from("sales_guide_settings")
    .select("setting_value")
    .eq("org_id", DEFAULT_ORG)
    .eq("setting_key", key)
    .maybeSingle();
  return NextResponse.json(
    { value: data?.setting_value ?? null },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}
