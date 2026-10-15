import { generateJSON } from "@/lib/ai/gemini";
import { SLICE_MAX, SLICE_MIN, cleanSliceTitle, isSliceKind, type SliceKind } from "@/lib/focus-slices";

/**
 * يقترح تقطيع فكرة/بند عمل إلى ٣–٥ شرائح (🔥 عميقة / ⚡ سطحية). ما تنحفظ —
 * المستخدم يعدّلها ويعتمدها من الواجهة. يرمي خطأ لو ما رجع شي صالح.
 */
export async function suggestSlices(title: string, body: string, context = ""): Promise<{ title: string; kind: SliceKind }[]> {
  const prompt = `أنت مدرّب إنتاجية يطبّق مبدأ «العمل العميق» وتقطيع المهام لشرائح.
قطّع ${context || "الفكرة"} التالية إلى ${SLICE_MIN}–${SLICE_MAX} شرائح عملية مرتبة، بحيث:
- كل شريحة عنوانها يبدأ بفعل أمر (مثل: اكتب، جهّز، راجع، اتصل) وقابلة للإنجاز في جلسة واحدة.
- لكل شريحة نوع: "deep" لو تحتاج تركيز عميق ٦٠–٩٠ دقيقة، أو "shallow" لو تنجز في أقل من ١٥ دقيقة.
- عادةً شريحة أو شريحتين عميقة والباقي سطحية.
- اكتب باللهجة السعودية البسيطة، كل عنوان سطر واحد قصير (أقل من ٩٠ حرف).

العنوان: ${title}
${body ? `التفاصيل: ${body}` : ""}

أرجع JSON فقط بهذا الشكل: {"slices": [{"title": "...", "kind": "deep"}, {"title": "...", "kind": "shallow"}]}`;

  const result = await generateJSON<{ slices?: unknown }>(prompt);
  const slices = (Array.isArray(result.slices) ? result.slices : [])
    .map((s): Record<string, unknown> => (s && typeof s === "object" ? (s as Record<string, unknown>) : { title: s }))
    .map((s) => ({ title: cleanSliceTitle(s.title), kind: (isSliceKind(s.kind) ? s.kind : "shallow") as SliceKind }))
    .filter((s) => s.title)
    .slice(0, SLICE_MAX);
  if (!slices.length) throw new Error("empty");
  return slices;
}
