import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { suggestSlices } from "@/lib/ai/slice-suggest";
import { timelineOf, type IdeaSticker } from "@/lib/idea-stickers";

export const runtime = "nodejs";

/** POST /api/idea-stickers/[id]/slice → يقترح تقطيع الفكرة إلى ٣–٥ شرائح (ما تنحفظ). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: idea } = await supabaseAdmin
    .from("idea_stickers").select("*").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!idea) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });
  try {
    // ورقة التطوير: نقطّع المرحلة الحالية بالذات (مع ملاحظات الاجتماع) بدل الفكرة كلها
    if (idea.kind === "dev") {
      const next = timelineOf(idea as IdeaSticker).find((s) => !s.done_at);
      const notes = String(idea.notes ?? "").replace(/\{\{[ypgbo]:([\s\S]*?)\}\}/g, "$1").replace(/\*\*([^*\n]+?)\*\*/g, "$1").trim().slice(0, 1500);
      const context = [
        idea.body || "",
        next ? `المرحلة الحالية في التطوير: ${next.label} — قطّع هذه المرحلة تحديداً.` : "",
        notes ? `ملاحظات الاجتماع:\n${notes}` : "",
      ].filter(Boolean).join("\n\n");
      return NextResponse.json({ slices: await suggestSlices(idea.title || "", context, "ورقة التطوير") });
    }
    return NextResponse.json({ slices: await suggestSlices(idea.title || "", idea.body || "", "الفكرة") });
  } catch {
    return NextResponse.json({ error: "تعذّر التقطيع التلقائي — اكتب الشرائح بنفسك أو جرّب مرة ثانية" }, { status: 502 });
  }
}
