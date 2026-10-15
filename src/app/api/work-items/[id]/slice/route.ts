import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSliceAccess } from "@/lib/api/focus-slices-access";
import { suggestSlices } from "@/lib/ai/slice-suggest";

export const runtime = "nodejs";

/** POST /api/work-items/[id]/slice → يقترح تقطيع بند العمل إلى ٣–٥ شرائح (ما تنحفظ). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getSliceAccess("work");
  if (access instanceof NextResponse) return access;
  const { id } = await params;
  const { data: item } = await supabaseAdmin
    .from("work_items").select("title, notes").eq("id", id).eq("org_id", access.orgId).eq("user_id", access.userId).maybeSingle();
  if (!item) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  try {
    return NextResponse.json({ slices: await suggestSlices(item.title, item.notes || "", "مهمة العمل الوظيفي") });
  } catch {
    return NextResponse.json({ error: "تعذّر التقطيع التلقائي — اكتب الشرائح بنفسك أو جرّب مرة ثانية" }, { status: 502 });
  }
}
