import { NextRequest, NextResponse } from "next/server";
import { generateJSON } from "@/lib/ai/gemini";
import { CHALLENGE_SOLUTIONS_PROMPT } from "@/lib/ai/prompts";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getManagerContext } from "@/lib/api/challenge-access";

export const runtime = "nodejs";

const CATEGORY_LABELS: Record<string, string> = {
  communication: "مشكلة تواصل",
  coworker_error: "خطأ من زميل",
  admin_delay: "تأخر الدعم الإداري",
  other: "أخرى",
};

type AIResult = {
  root_cause: string;
  solutions: Array<{ title: string; steps: string[]; expected_impact: string }>;
  measurement: {
    metric_name: string;
    unit: string;
    baseline_hint: string;
    target_value: number;
    direction: "increase" | "decrease";
    timeframe_days: number;
  };
};

/** POST /api/ai/challenge-solutions { challengeId } → يولّد حلول AI ويخزّنها. */
export async function POST(req: NextRequest) {
  const mgr = await getManagerContext();
  if (!mgr.ok) return NextResponse.json({ error: "Unauthorized" }, { status: mgr.status });

  const body = await req.json().catch(() => ({}));
  const challengeId = String(body.challengeId ?? "");
  if (!challengeId) return NextResponse.json({ error: "challengeId مطلوب" }, { status: 400 });

  const { data: challenge } = await supabaseAdmin
    .from("employee_challenges")
    .select("*")
    .eq("id", challengeId)
    .single();
  if (!challenge) return NextResponse.json({ error: "غير موجود" }, { status: 404 });

  const challengeContext = {
    التصنيف: CATEGORY_LABELS[challenge.category] ?? challenge.category,
    العنوان: challenge.title,
    الوصف: challenge.description,
    الطرف_المعني: challenge.against_party ?? "غير محدد",
    الشدة: challenge.severity,
  };

  let result: AIResult;
  try {
    const prompt = CHALLENGE_SOLUTIONS_PROMPT.replace("{challenge}", JSON.stringify(challengeContext, null, 2));
    result = await generateJSON<AIResult>(prompt);
  } catch (e) {
    console.error("AI challenge solutions error:", e);
    return NextResponse.json({ error: "تعذّر توليد الحلول من الذكاء الاصطناعي" }, { status: 502 });
  }

  const solutionsToInsert = (result.solutions ?? []).map((s) => ({
    challenge_id: challengeId,
    org_id: challenge.org_id,
    source: "ai" as const,
    content: s.title + (s.expected_impact ? `\n\nالأثر المتوقع: ${s.expected_impact}` : ""),
    steps: Array.isArray(s.steps) ? s.steps : null,
    expected_impact: s.expected_impact ?? null,
    created_by: mgr.user.id,
  }));

  let inserted: unknown[] = [];
  if (solutionsToInsert.length > 0) {
    const { data } = await supabaseAdmin.from("challenge_solutions").insert(solutionsToInsert).select("*");
    inserted = data ?? [];
  }

  await supabaseAdmin.from("challenge_events").insert({
    challenge_id: challengeId,
    org_id: challenge.org_id,
    event_type: "solution_added",
    description: `اقترح الذكاء الاصطناعي ${solutionsToInsert.length} حلول`,
    actor_name: "الذكاء الاصطناعي",
  });

  // ترقية الحالة تلقائيًا إذا كانت جديدة/قيد المراجعة.
  if (challenge.status === "new" || challenge.status === "under_review") {
    await supabaseAdmin
      .from("employee_challenges")
      .update({ status: "solutions_proposed", updated_at: new Date().toISOString() })
      .eq("id", challengeId);
  }

  return NextResponse.json({
    root_cause: result.root_cause ?? "",
    measurement: result.measurement ?? null,
    solutions: inserted,
  });
}
