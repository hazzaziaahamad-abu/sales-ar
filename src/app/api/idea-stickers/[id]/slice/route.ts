import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { suggestSlices } from "@/lib/ai/slice-suggest";

export const runtime = "nodejs";

/** POST /api/idea-stickers/[id]/slice → يقترح تقطيع الفكرة إلى ٣–٥ شرائح (ما تنحفظ). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: idea } = await supabaseAdmin
    .from("idea_stickers").select("title, body").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!idea) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });
  try {
    return NextResponse.json({ slices: await suggestSlices(idea.title || "", idea.body || "", "الفكرة") });
  } catch {
    return NextResponse.json({ error: "تعذّر التقطيع التلقائي — اكتب الشرائح بنفسك أو جرّب مرة ثانية" }, { status: 502 });
  }
}
