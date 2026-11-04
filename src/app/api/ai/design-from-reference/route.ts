import { NextRequest, NextResponse } from "next/server";
import { generateJSON, generateJSONWithImages, type InlineImage } from "@/lib/ai/gemini";
import { normalizeDesign, type DesignSize } from "@/lib/ai-designs/types";

// «صمّم من مرجع»: يقرأ تصميماً مرجعياً (صورة) + فكرة البوست، ويرجّع مواصفات تصاميم بهوية قائمة الطلبات.
// وضع ثاني (refine): يعدّل تصميم حالي حسب تعليمات المستخدم.

export const maxDuration = 60;

const BRAND = `الهوية: «قائمة الطلبات MENU» — منيو إلكتروني ونظام كاشير للمطاعم والكوفيهات في السعودية.
الألوان: بنفسجي #4A2C9F (أساسي) · ذهبي #F5C518 (للتمييز والأزرار) · كحلي غامق #1E1433 (نصوص/خلفيات داكنة) · فاتح #F4F3F7.
الخط: Tajawal عريض. النبرة: سعودية بيضاء ودودة وواثقة، جمل قصيرة، بدون مبالغة أو إيموجي.
الباقات (ريال/سنة): الأساسية 349 · الذهبية 579 (طلب ودفع أونلاين + واتساب + تقييمات + كوبونات) · VIP 879 (طلب ودفع من الطاولة + حجوزات + دور + ولاء + هدايا + فروع) · VIP بلس 1079 · الكاشير 1349.
اللوقو والتواصل (920031843 · واتساب · @menuspages) تضيفها المنصة تلقائياً — لا تكتبها داخل النصوص.`;

const SPEC = `كل تصميم كائن JSON بهذه الحقول فقط:
{
  "name": "اسم قصير للاقتراح (2-3 كلمات)",
  "note": "سطر واحد: ايش أخذت من المرجع وايش حسّنت",
  "layout": "photo | photoBottom | photoSplit | centered | editorial | split | card | bold",
  "theme": "light | dark | purple | gold",
  "background": "dots | glow | solid | grid | rays | waves",
  "align": "center | start",
  "decor": ["circles" | "sparkles" | "stripe" | "corners" | "ring"]  (0 إلى 2 — وغالباً فاضي مع تخطيطات الصور),
  "eyebrow": "عبارة قصيرة فوق العنوان (≤ 4 كلمات) أو فاضي",
  "headline": "العنوان ≤ 9 كلمات. افصل السطور بـ \\n (2-3 سطور قصيرة متوازنة). ميّز كلمة بـ [[ ]] لو تبي لون مختلف",
  "headlineStyle": "marker | boxes | plain",
  "subheadline": "سطر داعم ≤ 16 كلمة أو فاضي",
  "bullets": ["نقاط قصيرة ≤ 4 كلمات، 0 إلى 6"],
  "bulletStyle": "checks | chips | numbers | tags",
  "stat": {"value": "رقم قصير مثل 349 أو 24 أو +40%", "label": "وصفه بكلمتين"} أو null,
  "cta": "دعوة لإجراء ≤ 5 كلمات، ولو تبيها سطرين افصل بـ \\n",
  "showContact": true,
  "imageFrame": "none | phone | photo | floating",
  "shade": 0.0 إلى 1.0 (تعتيم الصورة عشان يبان الكلام الأبيض — عادة 0.45-0.7),
  "photoPrompt": "وصف بالإنجليزي لصورة الخلفية (مشهد تصوير احترافي بدون أي كتابة) — إلزامي مع تخطيطات photo*"
}
التخطيطات:
- photo = صورة فوتوغرافية تغطي البوست كامل، اللوقو فوق يمين، العنوان الأبيض الكبير فوق، والدعوة والتواصل تحت (هذا ستايلنا الأساسي).
- photoBottom = صورة كاملة والعنوان والدعوة تحت فوق تدرّج غامق.
- photoSplit = صورة بالجزء العلوي ولوح فاتح تحت فيه العنوان والمربعات البنفسجية والدعوة.
- centered/editorial/split/card/bold = تصاميم جرافيك بدون صورة فوتوغرافية.
headlineStyle: marker = شريط بنفسجي خلف نص أبيض (ستايلنا المميز) · boxes = كل سطر داخل كبسولة (ذهبي/أبيض) · plain = نص عادي.
bulletStyle tags = مربعات بنفسجية بنص أبيض جنب بعض (مثل: تعديل المنتجات · إضافة العروض · السعرات).
photoPrompt: اكتب مشهد واقعي محدد يخدم الرسالة، مثل: "A smiling young Saudi man in a white thobe and red shemagh holding a smartphone toward the camera, the phone screen facing the viewer, inside a warm modern Saudi restaurant, blurred background" أو "Close-up of a hand holding a phone above a wooden restaurant table, a QR code table stand beside it, cozy cafe bokeh". لو فيه لقطة شاشة منيو مرفوعة اذكر إن الجوال يعرض الشاشة.`;

const GENERATE_PROMPT = `أنت مدير فني (Art Director) وكاتب إعلانات سعودي محترف لبراند سوشال ميديا.
${BRAND}

ستايل بوستاتنا الحالية (التزم فيه إلا لو المرجع يطلب غيره): صورة فوتوغرافية واقعية كاملة (شخص سعودي بالثوب والشماغ يمسك جوال فيه منيو، أو جوال بيد على طاولة مطعم مع باركود)، اللوقو فوق يمين، عنوان أبيض عريض جداً 2-3 سطور بشريط بنفسجي خلف الكلام، وأحياناً كبسولات ذهبية للدعوة، وتحت: أيقونات X/انستقرام/تيك توك + MENUSPAGES يسار ورقم الواتساب يمين. نستخدم الكشيدة (ـــ) أحياناً عشان تتوازن السطور مثل «علـــشان» و«مبيـــعات» — استخدمها بخفة.

المطلوب: المستخدم أرفق تصميماً مرجعياً أعجبه (من أي براند أو من بوستاتنا). حلّله: التخطيط، ترتيب الأهمية، الإحساس (جريء/هادئ/فاخر/مرح)، استخدام الألوان، الزخارف، وكمية النص.
ثم صمّم {count} اقتراحات **مستوحاة منه لكن أفضل** وبهويتنا نحن:
- خذ روح المرجع وتركيبته، لا تنسخ كلامه ولا اسم براندهم.
- أفضل = تسلسل بصري أوضح، عنوان أقصر وأقوى، نص أقل، ودعوة واضحة للإجراء.
- الاقتراح الأول الأقرب للمرجع، والباقي تنويعات مختلفة فعلاً (تخطيط/ثيم/خلفية مختلفة).
- اكتب الكلام عن موضوع المستخدم. لو ما حدد موضوع، كيّف رسالة المرجع لمنتجنا.
- لو المرجع فيه صورة فوتوغرافية (أشخاص/مطعم/جهاز) استخدم تخطيطات photo* واكتب photoPrompt دقيق يشبه مشهد المرجع لكن بسياقنا (مطاعم وكوفيهات سعودية + منيو إلكتروني).
- المقاس: {size}. في المربع خفّف النقاط (≤ 3) والنص.
- {image_rule}

موضوع/فكرة البوست من المستخدم:
"""{brief}"""

${SPEC}

أرجع JSON فقط بهذا الشكل بدون أي شرح:
{"analysis": "تحليل المرجع في سطرين", "designs": [ ... {count} كائنات ... ]}`;

const REFINE_PROMPT = `أنت مدير فني وكاتب إعلانات سعودي محترف.
${BRAND}

هذا تصميم حالي (JSON):
{current}

طلب المستخدم للتعديل:
"""{instruction}"""

طبّق الطلب بدقة وحسّن ما يلزم فقط، وخلّ الباقي كما هو. المقاس: {size}. {image_rule}
${SPEC}

أرجع JSON فقط بهذا الشكل: {"design": { ... }}`;

const SIZE_TEXT: Record<DesignSize, string> = {
  square: "مربع 1080×1080 (بوست انستقرام)",
  portrait: "طولي 1080×1350 (بوست 4:5)",
  story: "ستوري 1080×1920",
};

function cleanImages(images: unknown): InlineImage[] {
  return Array.isArray(images)
    ? images
        .filter((i: unknown): i is InlineImage => !!i && typeof (i as InlineImage).data === "string" && typeof (i as InlineImage).mimeType === "string")
        .filter((i) => /^image\/(png|jpe?g|webp|gif|heic|heif)$/.test(i.mimeType))
        .slice(0, 3)
    : [];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const size: DesignSize = ["square", "portrait", "story"].includes(body.size) ? body.size : "portrait";
    const imageRule = body.hasProductImage
      ? "المستخدم رفع لقطة شاشة منيو/منتج — مع تخطيطات photo* اجعل الجوال في المشهد يعرضها (اذكر ذلك في photoPrompt) و imageFrame = none، ومع تخطيطات الجرافيك استخدم imageFrame = phone."
        : "ما فيه لقطة شاشة — خلّ imageFrame = none.";
    const brief = String(body.brief || "").slice(0, 1500) || "(ما حدد — استوحِ الرسالة من المرجع وكيّفها لقائمة الطلبات)";

    // ─── تعديل تصميم حالي ───
    if (body.mode === "refine") {
      const instruction = String(body.instruction || "").trim().slice(0, 800);
      if (!instruction || !body.current) return NextResponse.json({ error: "اكتب التعديل المطلوب" }, { status: 400 });
      const { image: _img, photo: _ph, id: _id, updatedAt: _u, ...current } = body.current as Record<string, unknown>;
      void _img; void _ph; void _id; void _u;
      const prompt = REFINE_PROMPT
        .replace("{current}", JSON.stringify(current, null, 2).slice(0, 6000))
        .replace("{instruction}", instruction)
        .replace("{size}", SIZE_TEXT[size])
        .replace("{image_rule}", imageRule);
      const imgs = cleanImages(body.images);
      const out = imgs.length
        ? await generateJSONWithImages<{ design: unknown }>(prompt, imgs)
        : await generateJSON<{ design: unknown }>(prompt);
      return NextResponse.json({ design: normalizeDesign(out.design ?? out, size) });
    }

    // ─── توليد من مرجع ───
    const imgs = cleanImages(body.images);
    if (!imgs.length && !String(body.brief || "").trim()) {
      return NextResponse.json({ error: "ارفع تصميم مرجعي أو اكتب فكرة البوست" }, { status: 400 });
    }
    const count = Math.min(4, Math.max(1, Number(body.count) || 3));
    const prompt = GENERATE_PROMPT
      .replaceAll("{count}", String(count))
      .replace("{size}", SIZE_TEXT[size])
      .replace("{image_rule}", imageRule)
      .replace("{brief}", brief);

    const out = imgs.length
      ? await generateJSONWithImages<{ analysis?: string; designs?: unknown[] }>(prompt, imgs)
      : await generateJSON<{ analysis?: string; designs?: unknown[] }>(prompt);

    const designs = (Array.isArray(out.designs) ? out.designs : []).slice(0, count).map((d) => normalizeDesign(d, size));
    if (!designs.length) return NextResponse.json({ error: "ما طلع تصميم — جرّب مرة ثانية" }, { status: 502 });
    return NextResponse.json({ analysis: typeof out.analysis === "string" ? out.analysis : "", designs });
  } catch (error) {
    console.error("design-from-reference error:", error);
    return NextResponse.json({ error: "فشل توليد التصميم — جرّب مرة ثانية" }, { status: 500 });
  }
}
