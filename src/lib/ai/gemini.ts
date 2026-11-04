import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export type InlineImage = { mimeType: string; data: string }; // data = base64 بدون بادئة data:

export function getGeminiModel() {
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
  });
}

export async function generateContent(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  const text = await generateContent(prompt);
  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

// يقرأ نصاً + صوراً (مثل سكرين شوت محادثة) ويرجّع JSON
export async function generateJSONWithImages<T>(prompt: string, images: InlineImage[]): Promise<T> {
  const model = getGeminiModel();
  const parts: Part[] = [
    { text: prompt },
    ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
  ];
  const result = await model.generateContent(parts);
  const text = result.response.text();
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
  return JSON.parse(jsonStr) as T;
}

// ─── توليد الصور (نموذج Gemini للصور) ─────────────────────────────────────────
// نستخدم REST مباشرة لأن مكتبة @google/generative-ai ما تدعم responseModalities/imageConfig.

export type ImageAspect = "1:1" | "4:5" | "9:16" | "3:4" | "16:9";

/** يولّد صورة من وصف (+ صور مساعدة اختيارية: لقطة شاشة تنحط في الجوال، أو مرجع للستايل). يرجّع base64. */
export async function generateImage(
  prompt: string,
  images: InlineImage[] = [],
  aspectRatio: ImageAspect = "4:5"
): Promise<InlineImage> {
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: prompt }, ...images.map((i) => ({ inlineData: { mimeType: i.mimeType, data: i.data } }))],
      }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
    }),
  });
  if (!res.ok) throw new Error(`image model ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const parts: { inlineData?: InlineImage; inline_data?: { mime_type: string; data: string } }[] =
    json?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) return { mimeType: p.inlineData.mimeType || "image/png", data: p.inlineData.data };
    if (p.inline_data?.data) return { mimeType: p.inline_data.mime_type || "image/png", data: p.inline_data.data };
  }
  throw new Error("image model returned no image");
}
