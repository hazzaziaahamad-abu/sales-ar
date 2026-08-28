import { NextRequest, NextResponse } from "next/server";
import { generateJSON, generateJSONWithImages, type InlineImage } from "@/lib/ai/gemini";
import { DEAL_COACH_PROMPT } from "@/lib/ai/prompts";

type Coach = {
  diagnosis: string;
  real_objection: string;
  recommended_reply: string;
  closing_question: string;
  next_step: string;
  risk: string;
};

export async function POST(req: NextRequest) {
  try {
    const { context, conversation, images } = await req.json();
    const imgs: InlineImage[] = Array.isArray(images)
      ? images
          .filter((i: unknown): i is InlineImage => !!i && typeof (i as InlineImage).data === "string" && typeof (i as InlineImage).mimeType === "string")
          .slice(0, 4)
      : [];

    if (!conversation && imgs.length === 0) {
      return NextResponse.json({ error: "الصق رسالة العميل أو ارفع صورة المحادثة" }, { status: 400 });
    }

    const prompt = DEAL_COACH_PROMPT
      .replace("{deal_context}", JSON.stringify(context || {}, null, 2))
      .replace("{conversation}", (conversation || "").toString().slice(0, 6000) || "(المحادثة في الصورة المرفقة)");

    const result = imgs.length > 0
      ? await generateJSONWithImages<Coach>(prompt, imgs)
      : await generateJSON<Coach>(prompt);

    return NextResponse.json(result);
  } catch (error) {
    console.error("deal-coach error:", error);
    return NextResponse.json({ error: "فشل تحليل الصفقة" }, { status: 500 });
  }
}
