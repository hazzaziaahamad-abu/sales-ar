import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai/gemini";
import { CLIENT_INSIGHTS_PROMPT } from "@/lib/ai/prompts";

export type ClientInsights = {
  summary: string;
  temperature: string;
  recommendations: string[];
  next_action: string;
  warning: string;
};

export async function POST(req: NextRequest) {
  try {
    const { client } = await req.json();
    if (!client || !Array.isArray(client.notes) || client.notes.length === 0) {
      return NextResponse.json({ error: "ما فيه متابعات كافية لتوليد توصيات" }, { status: 400 });
    }

    const prompt = CLIENT_INSIGHTS_PROMPT
      .replace("{today}", new Date().toISOString().slice(0, 10))
      .replace("{client}", JSON.stringify(client, null, 2).slice(0, 12000));

    const result = await generateJSON<ClientInsights>(prompt);
    return NextResponse.json({
      summary: result.summary || "",
      temperature: result.temperature || "",
      recommendations: Array.isArray(result.recommendations) ? result.recommendations.slice(0, 5) : [],
      next_action: result.next_action || "",
      warning: result.warning || "",
    });
  } catch (error) {
    console.error("client-insights error:", error);
    return NextResponse.json({ error: "فشل توليد التوصيات" }, { status: 500 });
  }
}
