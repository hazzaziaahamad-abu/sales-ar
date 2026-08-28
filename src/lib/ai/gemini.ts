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
