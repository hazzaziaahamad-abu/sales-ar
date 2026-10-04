import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateJSON } from "@/lib/ai/gemini";
import { CONTACT_FLOW, INTERESTED_FLOW, TIERS, CUSTOMER_FAQ } from "@/lib/sales/contact-flow-content";
import * as NAHJEZ from "@/lib/sales/nahjez-content";
import type { CFStep } from "@/components/sales/ContactFlowPanel";
import type { FAQItem } from "@/components/sales/CustomerFAQPanel";

// مساعد الصياغة في «مسار الاتصال»: الموظف يكتب طلب العميل، ونرجّع له
// سكربت مكالمة + رسالة واتساب مبنية على محتوى المسار والأسئلة المعتمد.
// عام (يخدم /flow بدون تسجيل دخول) لذلك محدود الحجم والمعدّل.
const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

type Draft = { summary: string; call: string; wa: string; tip: string };

// حدّ بسيط لكل IP داخل الذاكرة (يكفي لمنع الإساءة العابرة).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();
function rateLimited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_WINDOW;
}

async function loadSetting<T>(key: string): Promise<T | null> {
  const { data } = await supabaseAdmin
    .from("sales_guide_settings")
    .select("setting_value")
    .eq("org_id", DEFAULT_ORG)
    .eq("setting_key", key)
    .maybeSingle();
  return (data?.setting_value as T) ?? null;
}

export type AssistProduct = "menu" | "nahjez";

type FlowStep = Pick<CFStep, "title" | "goal" | "call" | "wa">;
const fmtSteps = (s: FlowStep[]) => s.map((x, i) => `${i + 1}. ${x.title} — ${x.goal}\n   مكالمة: ${x.call}\n   واتساب: ${x.wa}`).join("\n");

// نحجز: منصة إدارة الحجوزات للصالونات والمراكز + بطاقات الهدايا والولاء.
async function buildNahjezKnowledge() {
  const flow = await loadSetting<{ steps?: CFStep[]; interestedSteps?: CFStep[]; loyalty?: typeof NAHJEZ.LOYALTY }>("contact_flow_nahjez").catch(() => null);
  const steps: FlowStep[] = flow?.steps?.length ? flow.steps : NAHJEZ.CONTACT_FLOW;
  const interested: FlowStep[] = flow?.interestedSteps?.length ? flow.interestedSteps : NAHJEZ.INTERESTED_FLOW;
  const loyalty = flow?.loyalty?.title ? flow.loyalty : NAHJEZ.LOYALTY;
  return [
    "## الباقات",
    NAHJEZ.TIERS.map((t) => `- ${t.name}: ${t.monthly} ريال شهرياً أو ${t.yearly} سنوياً (توفير ${t.save}) — ${t.note}`).join("\n"),
    "بدون عمولة على الحجوزات · فوترة متوافقة مع هيئة الزكاة والضريبة · إلغاء بأي وقت",
    "## مطابقة الاحتياج بالباقة",
    NAHJEZ.MATCHING.map((m) => `- ${m.type} ← ${m.pkg}`).join("\n"),
    `## ${loyalty.title} (${loyalty.pkg})`,
    `${loyalty.why}\n${(loyalty.bullets || []).map((b) => `• ${b}`).join("\n")}\nاعتراض: ${loyalty.objection?.q}\nالرد: ${loyalty.objection?.a}`,
    "## مسار الاتصال المعتمد",
    fmtSteps(steps),
    "## مسار العميل المهتم",
    fmtSteps(interested),
    "## تحديات واعتراضات شائعة وحلولها",
    NAHJEZ.CHALLENGES.map((c) => `- ${c.challenge}: ${c.solution}`).join("\n"),
  ].join("\n\n");
}

async function buildMenuKnowledge() {
  const [flow, faq] = await Promise.all([
    loadSetting<{ steps?: CFStep[]; interestedSteps?: CFStep[] }>("contact_flow_menu").catch(() => null),
    loadSetting<{ items?: FAQItem[] }>("customer_faq_menu").catch(() => null),
  ]);
  const steps: FlowStep[] = flow?.steps?.length ? flow.steps : CONTACT_FLOW;
  const interested: FlowStep[] = flow?.interestedSteps?.length ? flow.interestedSteps : INTERESTED_FLOW;
  const items: FAQItem[] = faq?.items?.length ? faq.items : CUSTOMER_FAQ;

  return [
    "## الباقات (سنوياً قبل الضريبة)",
    TIERS.map((t) => `- ${t.name}: ${t.price} ريال — ${t.note}`).join("\n"),
    "## مسار الاتصال المعتمد",
    fmtSteps(steps),
    "## مسار العميل المهتم",
    fmtSteps(interested),
    "## ردود معتمدة على أسئلة العملاء",
    items.map((f) => `س: ${f.q}\nج: ${f.call}${f.note ? `\n(ملاحظة داخلية: ${f.note})` : ""}`).join("\n\n"),
  ].join("\n\n");
}

const PRODUCT_INTRO: Record<AssistProduct, string> = {
  menu: "فريق «قائمة الطلبات» (منيو رقمي + نظام طلب ودفع + كاشير + بطاقات ولاء للمطاعم والكوفيهات في السعودية)",
  nahjez: "فريق «نحجز» (منصة إدارة الحجوزات للصالونات ومراكز التجميل والعناية في السعودية: حجز أونلاين + تذكير واتساب + مدفوعات وعربون + بطاقات الهدايا والولاء). العميلات غالباً نساء فخاطب صاحبة الصالون بصيغة المؤنث إن كان مناسباً",
};

const PROMPT = `أنت مساعد مبيعات لـ{intro}.
الموظف كتب لك ماذا طلب العميل أو ماذا قال. مهمتك تصيغ له رداً جاهزاً بلهجة سعودية بيضاء مهذّبة ودافئة، بنفس أسلوب المسار المعتمد أدناه.

قواعد:
- اعتمد فقط على المعلومات والأسعار الموجودة في المعرفة أدناه. لا تخترع ميزة أو سعراً أو خصماً غير موجود.
- إذا كان طلب العميل غير مغطّى في المعرفة، صغ رداً لطيفاً يعد بالتأكد والرجوع له، واذكر ذلك في النصيحة.
- رشّح باقة واحدة فقط إن كان مناسباً، واختم بسؤال أو خطوة تالية واضحة (موعد/تأكيد).
- استخدم {اسمك} مكان اسم الموظف إن لم يُذكر، واسم العميل إن ذُكر.
- المكالمة: كلام شفهي قصير طبيعي (٢-٥ جمل). الواتساب: رسالة مرتّبة بأسطر قصيرة ونقاط وإيموجي خفيف.

{knowledge}

## بيانات إضافية
اسم الموظف: {rep}
اسم العميل: {client}

## ما كتبه الموظف عن طلب العميل
{request}

أرجع JSON فقط بهذا الشكل:
{"summary": "جملة واحدة: ماذا يريد العميل فعلياً", "call": "سكربت المكالمة", "wa": "رسالة الواتساب", "tip": "نصيحة قصيرة للموظف (اعتراض متوقّع أو تنبيه)"}`;

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ error: "طلبات كثيرة، حاول بعد دقائق" }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const request = String(body?.request || "").trim().slice(0, 2000);
    if (request.length < 3) {
      return NextResponse.json({ error: "اكتب ماذا طلب العميل" }, { status: 400 });
    }
    const rep = String(body?.rep || "").trim().slice(0, 60) || "{اسمك}";
    const client = String(body?.client || "").trim().slice(0, 60) || "(غير مذكور)";

    const product: AssistProduct = body?.product === "nahjez" ? "nahjez" : "menu";
    const knowledge = product === "nahjez" ? await buildNahjezKnowledge() : await buildMenuKnowledge();

    const prompt = PROMPT.replace("{intro}", PRODUCT_INTRO[product])
      .replace("{knowledge}", knowledge)
      .replace("{rep}", rep)
      .replace("{client}", client)
      .replace("{request}", request);

    const r = await generateJSON<Draft>(prompt);
    return NextResponse.json({
      summary: String(r?.summary || ""),
      call: String(r?.call || ""),
      wa: String(r?.wa || ""),
      tip: String(r?.tip || ""),
    });
  } catch (error) {
    console.error("contact-flow assist error:", error);
    return NextResponse.json({ error: "تعذّرت الصياغة، حاول مرة ثانية" }, { status: 500 });
  }
}
