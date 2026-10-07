import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getIdeasAccess } from "@/lib/api/ideas-access";
import { generateJSON } from "@/lib/ai/gemini";
import { sanitizePlan } from "@/lib/ideas";

export const runtime = "nodejs";

/** POST /api/ideas/[id]/plan → يقترح خطة تنفيذ للفكرة (ما تنحفظ — المستخدم يعدّلها ويعتمدها). */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await getIdeasAccess();
  if (access instanceof NextResponse) return access;
  const { id } = await ctx.params;

  const { data: idea } = await supabaseAdmin
    .from("ideas").select("text, notes").eq("id", id).eq("org_id", access.orgId).eq("user_id", access.userId).maybeSingle();
  if (!idea) return NextResponse.json({ error: "غير موجودة" }, { status: 404 });

  const prompt = `أنت مساعد تخطيط عملي لفريق مبيعات ودعم في شركة سعودية تقدم أنظمة SaaS (منيو إلكتروني ونظام حجوزات).
حوّل الفكرة التالية إلى خطة تنفيذ قصيرة وواضحة من 3 إلى 6 خطوات عملية مرتبة، كل خطوة تبدأ بفعل وتكون قابلة للتنفيذ خلال أيام.
اكتب باللهجة السعودية البسيطة، وكل خطوة سطر واحد قصير (أقل من 120 حرف).

الفكرة: ${idea.text}
${idea.notes ? `ملاحظات صاحب الفكرة: ${idea.notes}` : ""}

أرجع JSON فقط بهذا الشكل: {"steps": ["...", "..."]}`;

  try {
    const result = await generateJSON<{ steps?: unknown }>(prompt);
    const steps = sanitizePlan(result.steps).slice(0, 6);
    if (steps.length === 0) throw new Error("empty");
    return NextResponse.json({ steps });
  } catch {
    return NextResponse.json({ error: "تعذّر اقتراح خطة، جرّب مرة ثانية" }, { status: 502 });
  }
}
