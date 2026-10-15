import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { generateJSON } from "@/lib/ai/gemini";
import { SLICE_MAX, SLICE_MIN, cleanSliceTitle, isSliceKind } from "@/lib/focus-slices";

export const runtime = "nodejs";

/**
 * POST /api/idea-stickers/[id]/slice → يقترح تقطيع الفكرة إلى ٣–٥ شرائح (ما تنحفظ —
 * المستخدم يعدّلها ويعتمدها من الواجهة).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: idea } = await supabaseAdmin
    .from("idea_stickers").select("title, body, tag").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!idea) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });

  const prompt = `أنت مدرّب إنتاجية يطبّق مبدأ «العمل العميق» وتقطيع المهام لشرائح.
قطّع الفكرة التالية إلى ${SLICE_MIN}–${SLICE_MAX} شرائح عملية مرتبة، بحيث:
- كل شريحة عنوانها يبدأ بفعل أمر (مثل: اكتب، جهّز، راجع، اتصل) وقابلة للإنجاز في جلسة واحدة.
- لكل شريحة نوع: "deep" لو تحتاج تركيز عميق ٦٠–٩٠ دقيقة، أو "shallow" لو تنجز في أقل من ١٥ دقيقة.
- عادةً شريحة أو شريحتين عميقة والباقي سطحية.
- اكتب باللهجة السعودية البسيطة، كل عنوان سطر واحد قصير (أقل من ٩٠ حرف).

الفكرة: ${idea.title || ""}
${idea.body ? `التفاصيل: ${idea.body}` : ""}

أرجع JSON فقط بهذا الشكل: {"slices": [{"title": "...", "kind": "deep"}, {"title": "...", "kind": "shallow"}]}`;

  try {
    const result = await generateJSON<{ slices?: unknown }>(prompt);
    const slices = (Array.isArray(result.slices) ? result.slices : [])
      .map((s): Record<string, unknown> => (s && typeof s === "object" ? (s as Record<string, unknown>) : { title: s }))
      .map((s) => ({ title: cleanSliceTitle(s.title), kind: isSliceKind(s.kind) ? s.kind : "shallow" }))
      .filter((s) => s.title)
      .slice(0, SLICE_MAX);
    if (slices.length === 0) throw new Error("empty");
    return NextResponse.json({ slices });
  } catch {
    return NextResponse.json({ error: "تعذّر التقطيع التلقائي — اكتب الشرائح بنفسك أو جرّب مرة ثانية" }, { status: 502 });
  }
}
