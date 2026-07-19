"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

/*
  لوحة المبيعات التفاعلية والدليل التشغيلي — منظومة MENU
  Interactive Sales Playbook & Dashboard
  - كل الحقول قابلة للتعديل مباشرة
  - الحفظ التلقائي عبر Supabase (مشترك لكل المنظمة)
*/

const NAVY = "#0E2A47";
const NAVY_2 = "#153a63";
const ACCENT = "#2563eb";

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultData = {
  roles: [
    {
      id: "r1",
      title: "القائد (حمد)",
      tag: "التوجيه والاعتماد",
      body:
        "التوجيه الاستراتيجي العام، المراجعة النهائية لأداء الفريق، واعتماد أي تعديل أو تطوير على المنهجية والأسعار. يقيس مؤشرات النتائج النهائية (Lagging).",
    },
    {
      id: "r2",
      title: "المختص المساعد",
      tag: "التنفيذ والمتابعة",
      body:
        "التنفيذ الميداني اليومي، متابعة التزام الفريق بالخطوات، وقيادة جلسات المحاكاة والتدريب الأسبوعية. يقود مؤشرات الأنشطة (Leading).",
    },
    {
      id: "r3",
      title: "فريق المبيعات",
      tag: "التطبيق والرفع",
      body:
        "التطبيق الصارم للمنهجية على كل عميل، الالتزام بترتيب مراحل القمع، وتعبئة استمارات التشخيص ورفع التقارير والبيانات بدقة في CommandCenter.",
    },
  ],

  pipeline: [
    {
      id: "p1",
      name: "التأهيل",
      en: "Qualification",
      tasks: [
        { id: uid(), task: "تحديد نوع المنشأة (مطعم / كافيه / عربة طعام) وحجم عملياتها اليومية.", output: "بطاقة عميل مؤهّل معبّأة في CommandCenter." },
        { id: uid(), task: "التأكد من أن جهة الاتصال هي صاحب القرار أو مؤثّر فيه (Authority).", output: "تصنيف العميل: ساخن / دافئ / بارد." },
        { id: uid(), task: "تقييم الملاءمة عبر BANT (الميزانية، الصلاحية، الحاجة، التوقيت).", output: "قرار: يُكمَّل أو يُستبعد مع السبب." },
      ],
    },
    {
      id: "p2",
      name: "الاكتشاف",
      en: "Discovery",
      tasks: [
        { id: uid(), task: "إجراء مكالمة أو زيارة تشخيصية باستخدام دليل الاكتشاف.", output: "تقرير احتياجات موثّق ومربوط بالعميل." },
        { id: uid(), task: "تعبئة استمارة تشخيص العميل كاملة أثناء اللقاء.", output: "قائمة أولويات ونقاط ألم مرتّبة." },
        { id: uid(), task: "رصد نقاط الألم التشغيلية: الإدخال اليدوي، وقت الذروة، زحام الطلبات.", output: "تحديد المنتج الأنسب: MENU / نحجز / درع." },
      ],
    },
    {
      id: "p3",
      name: "عرض الحل",
      en: "Presentation",
      tasks: [
        { id: uid(), task: "تجهيز عرض حي (Demo) مخصّص لحالة العميل لا عرض عام.", output: "عرض سعر مخصّص مبني على الاحتياج." },
        { id: uid(), task: "ربط كل ميزة تُعرض بمشكلة ذُكرت في مرحلة الاكتشاف.", output: "خطة تفعيل مقترحة بمراحل واضحة." },
        { id: uid(), task: "عرض حساب عائد مبسّط (كم يوفّر من وقت / أخطاء / إيراد ضائع).", output: "محضر لقاء بالخطوات والمواعيد التالية." },
      ],
    },
    {
      id: "p4",
      name: "الإغلاق",
      en: "Closing",
      tasks: [
        { id: uid(), task: "معالجة الاعتراضات النهائية (السعر، التوقيت، الالتزام العقدي).", output: "اتفاقية اشتراك سنوي موقّعة." },
        { id: uid(), task: "تقديم حافز محدّد بوقت لدفع القرار (Time-boxed).", output: "دفعة أولى مؤكدة." },
        { id: uid(), task: "تأكيد نطاق الخدمة وتسليم العميل لفريق التفعيل والدعم.", output: "تسليم Onboarding موثّق." },
      ],
    },
  ],

  discovery: {
    phases: [
      { id: "d1", title: "١. التمهيد وبناء الثقة", note: "افتح باحترافية، عرّف بنفسك وبقيمة اللقاء باختصار، واطلب الإذن بطرح أسئلة سريعة لفهم وضعهم. الهدف: يشعر العميل أنك جيت تحل، مو تبيع." },
      { id: "d2", title: "٢. التشخيص (الأسئلة الست)", note: "لا تعرض أي حل الآن. اسمع أكثر مما تتكلم (قاعدة ٧٠/٣٠)، ودوّن الإجابات حرفياً لأنها ذخيرتك في مرحلة العرض." },
      { id: "d3", title: "٣. تأكيد الفهم", note: "لخّص نقاط الألم بكلماتك واطلب تأكيدهم: «فهمت إن أكبر تحدٍ عندكم هو … صح؟» — هذا يبني الثقة ويمنع الاعتراضات لاحقاً." },
      { id: "d4", title: "٤. التمهيد للخطوة التالية", note: "اربط الألم المؤكَّد بموعد العرض القادم: «بناءً على كلامك، أجهّز لك عرض مخصص يحل تحديدًا مشكلة … نلتقي يوم …»." },
    ],
    questions: [
      { id: uid(), text: "كيف تستقبلون الطلبات حالياً في وقت الذروة، وكم طلب تقريباً يتأخر أو يضيع بسبب الزحام؟" },
      { id: uid(), text: "ما الخطوات التي يقوم بها الكاشير يدوياً من لحظة الطلب حتى إغلاق الفاتورة؟ وكم تأخذ من الوقت؟" },
      { id: uid(), text: "كم مرة تضطرون لإدخال نفس البيانات (الأصناف، الأسعار، الطلبات) في أكثر من مكان أو تطبيق؟" },
      { id: uid(), text: "كيف تعرفون الأصناف الأكثر مبيعاً وأوقات الذروة — بتقرير جاهز أم بالتقدير الشخصي؟" },
      { id: uid(), text: "كيف تديرون طلبات تطبيقات التوصيل (هنقرستيشن، جاهز، كيتا) مع طلبات الصالة في نفس اللحظة؟" },
      { id: uid(), text: "لو قدرت أوفّر لفريقك ساعة يومياً من العمل اليدوي، وش أول شيء بتوجّهها له؟" },
    ],
  },

  training: {
    schedule: [
      { id: uid(), day: "الأحد", time: "١٠:٠٠ ص", topic: "محاكاة مكالمة اكتشاف كاملة (الأسئلة الست)", lead: "المختص المساعد", who: "كامل الفريق", status: "مجدولة" },
      { id: uid(), day: "الثلاثاء", time: "١١:٠٠ ص", topic: "التعامل مع اعتراض: «السعر مرتفع»", lead: "المختص المساعد", who: "مجموعة أ", status: "مجدولة" },
      { id: uid(), day: "الخميس", time: "١٠:٣٠ ص", topic: "إغلاق صفقة اشتراك سنوي + التسليم للدعم", lead: "المختص المساعد", who: "مجموعة ب", status: "مجدولة" },
    ],
    scorecard: {
      employee: "",
      date: "",
      evaluator: "",
      criteria: [
        { id: uid(), label: "الإنصات الفعّال (Active Listening)", score: 3 },
        { id: uid(), label: "جودة الأسئلة التشخيصية", score: 3 },
        { id: uid(), label: "ربط الميزة بالمشكلة", score: 3 },
        { id: uid(), label: "التعامل مع الاعتراضات", score: 3 },
        { id: uid(), label: "الوضوح والثقة في العرض", score: 3 },
        { id: uid(), label: "الالتزام بخطوات المنهجية", score: 3 },
      ],
      notes: "",
    },
  },

  kpis: {
    leading: [
      { id: uid(), label: "مكالمات الاكتشاف المكتملة أسبوعياً / موظف", target: 15, actual: 0, unit: "مكالمة", lower: false },
      { id: uid(), label: "الالتزام بتعبئة استمارة التشخيص", target: 95, actual: 0, unit: "%", lower: false },
      { id: uid(), label: "ساعات التدريب والمحاكاة المنفّذة شهرياً", target: 8, actual: 0, unit: "ساعة", lower: false },
    ],
    lagging: [
      { id: uid(), label: "معدل التحويل من الاكتشاف إلى العرض", target: 40, actual: 0, unit: "%", lower: false },
      { id: uid(), label: "متوسط وقت إغلاق الصفقة", target: 21, actual: 0, unit: "يوم", lower: true },
      { id: uid(), label: "ثقة العميل بعد أول لقاء (Initial Trust)", target: 85, actual: 0, unit: "%", lower: false },
    ],
  },

  negotiation: {
    mistakeWrong:
      "«برجع أشيك مع الإدارة… السعر لك ٢٩٩ ريال شامل المزايا، حاب نحجز لك؟» — خصم يُمنح مباشرة دون شرط، وسؤال إغلاق ضعيف وسهل التجاهل. النتيجة: يفقد المنتج قيمته ويماطل العميل أو يطلب خصماً أكبر.",
    mistakeRight:
      "«أبشر بسعدك أستاذ [الاسم]، كلمت لك مدير المبيعات وطلع لك استثناء خاص تقديراً لجدّيتك: الباقة الشاملة بكل المزايا بـ[السعر المخفض]. لكن المدير اشترط شرطاً واحداً: نعتمد الاشتراك ونبدأ رفع المنيو وتجهيزه لك الليلة عشان يجهز حسابك شغّال قبل الويكند وتلحق زبائنك. عشان نستغل الاستثناء — أرسل لك رابط الدفع السريع الآن ونبدأ فوراً؟»",
    tactics: [
      { id: uid(), name: "المقايضة المشروطة", en: "Quid Pro Quo", body: "لا تمنح أي تنازل مجاناً. اربط الخصم بالتزام فوري: «أقدر أفعّل لك هذا الخصم الاستثنائي بشرط اعتماد الفاتورة والدفع خلال الساعات القادمة عشان يقبلها السيستم»." },
      { id: uid(), name: "التفاوض على القيمة لا السعر", en: "Value-Based", body: "عند شكوى السعر، لا تدافع عنه؛ أعد التذكير بحجم المشاكل التي يحلها المنتج والعائد والتوفير الذي سيحققه (ROI)." },
      { id: uid(), name: "الإرساء وثلاث باقات", en: "Anchoring", body: "قدّم ٣ باقات دائماً: باقة عالية جداً كمرساة نفسية، احترافية (وهي الهدف) بسعر عادل ومربح، وأساسية محدودة تجعل الاحترافية تبدو صفقة لا تُعوّض." },
      { id: uid(), name: "التعاطف التكتيكي والتسمية", en: "Tactical Empathy", body: "امتصّ هجوم العميل بالاعتراف بمخاوفه أولاً: «يبدو إنك حريص جداً على ميزانية الشركة وما تبي تخاطر بمبلغ بلا عائد واضح، صح؟»." },
      { id: uid(), name: "الرجوع لسلطة أعلى", en: "Higher Authority", body: "أظهر أنك في صف العميل تحارب قوانين الشركة أو السيستم لأجله: «أنا ودّي أخدمك، بس خلني أحاول أكلم الإدارة وأستخرج لك استثناء خاص»." },
      { id: uid(), name: "الأسئلة المعايرة", en: "Calibrated Questions", body: "انقل العميل من الهجوم إلى التفكير بأسئلة تبدأ بـ«كيف/ماذا»: «كيف تبغاني أقدّم لك نفس الجودة والدعم الفني اللحظي لو نزّلنا للسعر هذا؟»." },
    ],
    channels: [
      { id: uid(), name: "المحادثات النصية (واتساب / إيميل)", body: "الميزة: الوقت للتفكير. استغل تأخير الرد (١٠–٢٠ دقيقة) عند طلب الخصم لإشعار العميل بالجهد المبذول مع الإدارة، مع توثيق الشروط نصياً بوضوح." },
      { id: uid(), name: "المكالمات الهاتفية", body: "الميزة: نبرة الصوت والسرعة. اعتمد نبرة الهدوء واليقين، واستخدم «قوة الصمت» — اسكت تماماً بعد ذكر السعر أو العرض المشروط واترك العميل يتكلم أولاً." },
    ],
    schools: [
      { id: uid(), name: "جوردان بيلفورت — الخط المستقيم", body: "قيادة العميل في خط مستقيم من البداية للإغلاق. أوصل قناعته ١٠/١٠ في (المنتج، البائع، الشركة). احكم الثواني الأربع الأولى بانطباع الحماس والذكاء والخبرة، وأدِر نبرتك كمحرك عاطفي." },
      { id: uid(), name: "جرانت كاردون — 10X والإغلاق الفائق", body: "البيع معركة إصرار وطاقة عالية. «السعر غالي» شكوى عابرة لا رفض؛ امتصّها بالموافقة الفورية ثم أغلق: «أتفق تماماً السعر مرتفع لأن الجودة استثنائية، وقّع معي هنا ونبدأ». وذكّر بأن تكلفة التأخير أكبر من قيمة الاشتراك." },
    ],
  },
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/* ---------- عناصر واجهة صغيرة ---------- */

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      dir="rtl"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    />
  );
}

function AreaInput({ value, onChange, placeholder, rows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      dir="rtl"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls + " resize-y leading-7"}
    />
  );
}

function IconBtn({ onClick, title, children, tone = "slate" }: { onClick: () => void; title: string; children: React.ReactNode; tone?: "slate" | "red" }) {
  const tones = {
    slate: "text-slate-400 hover:text-slate-700 hover:bg-slate-100",
    red: "text-slate-400 hover:text-red-600 hover:bg-red-50",
  };
  return (
    <button
      onClick={onClick}
      title={title}
      className={"grid h-8 w-8 place-items-center rounded-lg transition " + tones[tone]}
    >
      {children}
    </button>
  );
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
    >
      <span className="text-base leading-none">＋</span>
      {children}
    </button>
  );
}

function SectionHeader({ n, title, en, desc }: { n: string; title: string; en: string; desc: string }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-white"
        style={{ background: NAVY }}
      >
        {n}
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">
          {title} <span className="text-sm font-semibold text-slate-400">— {en}</span>
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

function SectionWrap({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-slate-200 bg-white px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">{children}</div>
    </section>
  );
}

/* ---------- محرك المحاكاة الذكي ---------- */

const METHODOLOGY = `دليل التفاوض والإغلاق لمنظومة MENU (نظام كاشير واشتراكات مطاعم SaaS):
- المقايضة المشروطة (Quid Pro Quo): لا يُمنح أي خصم أو تنازل مجاناً؛ يُربط دائماً بالتزام فوري (اعتماد الفاتورة/الدفع خلال ساعات) أو زيادة مدة/كمية.
- التفاوض على القيمة لا السعر: عند شكوى السعر، ذكّر بالمشاكل التي يحلها المنتج وبالعائد والتوفير.
- الإرساء وثلاث باقات: عالية كمرساة، احترافية (الهدف)، أساسية محدودة.
- التعاطف التكتيكي: اعترف بمخاوف العميل قبل الرد.
- الرجوع لسلطة أعلى: البائع في صف العميل يحاول استخراج استثناء من الإدارة.
- الأسئلة المعايرة: أسئلة «كيف/ماذا» لنقل العميل من الهجوم إلى التفكير.
- مدرسة بيلفورت (الخط المستقيم): ثقة ١٠/١٠ في المنتج والبائع والشركة، وقيادة مستقيمة للإغلاق.
- مدرسة كاردون (10X): طاقة وإصرار؛ «السعر غالي» شكوى تُمتص بالموافقة الفورية ثم الإغلاق؛ تكلفة التأخير أكبر من قيمة الاشتراك.
- الخطأ الأخطر: منح الخصم مباشرة دون شرط (Instant Give) لأنه يفقد المنتج قيمته ويشجّع المماطلة.`;

const PERSONAS = [
  { id: "mumatil", label: "مماطل — يحتاج حسم كاردون", brief: "مالك مطعم مشغول يماطل ويؤجّل: «خلني أفكر»، «أرجع لك». يحتاج طاقة عالية وإصراراً وإغلاقاً حاسماً." },
  { id: "waai", label: "واعٍ بالسعر — يحتاج ثقة بيلفورت", brief: "صاحب سلسلة كافيهات يقارن بفودكس ومرن ويشكك في القيمة. يحتاج بناء ثقة ١٠/١٠ في المنتج والبائع والشركة." },
  { id: "khasm", label: "يطلب خصم فوري — اختبار المقايضة", brief: "يضغط مباشرة: «كم آخر سعر؟» و«ودّي خصم». الاختبار: هل يمنح المندوب الخصم مجاناً أم يربطه بالتزام فوري؟" },
  { id: "custom", label: "شخصية مخصّصة", brief: "اكتب وصف العميل بنفسك في الأسفل." },
];

type Persona = typeof PERSONAS[number];
type ChatMessage = { role: "user" | "assistant"; content: string };

function callClaude(messages: ChatMessage[], system: string) {
  return fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_tokens: 1000, system, messages }),
  }).then((r) => r.json());
}

function extractText(data: { content?: { type: string; text: string }[] }) {
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

function NegotiationSimulator() {
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]);
  const [customBrief, setCustomBrief] = useState("");
  const [phase, setPhase] = useState<"setup" | "chatting">("setup");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [evalData, setEvalData] = useState<{
    unconditionalDiscount: boolean;
    discountNote: string;
    scores: Record<string, number>;
    strengths: string[];
    improvements: string[];
    modelLine: string;
    schoolFit: string;
  } | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const brief = persona.id === "custom" ? (customBrief.trim() || "عميل مطاعم صعب يفاوض على السعر ويماطل.") : persona.brief;
  const sysCustomer = `أنت تمثّل عميلاً (مالك منشأة مطاعم) في تدريب مبيعات. المستخدم مندوب مبيعات في MENU (نظام كاشير واشتراكات) يتدرّب معك.
الشخصية: ${brief}
قواعدك: ردّ فقط بصوت العميل بلهجة سعودية واقعية، من جملة إلى ثلاث جمل قصيرة. مارس الاعتراض والضغط المناسب لشخصيتك ولا تستسلم بسهولة، لكن كن واقعياً وأبرِم الصفقة إذا أقنعك المندوب فعلاً بالقيمة والمقايضة المشروطة وإغلاق واثق. لا تخرج عن الدور ولا تقدّم أي نصائح تدريبية.`;

  const start = () => { setPhase("chatting"); setMessages([]); setEvalData(null); setError(""); setInput(""); };
  const reset = () => { setPhase("setup"); setMessages([]); setInput(""); setEvalData(null); setError(""); };

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    setError("");
    try {
      const data = await callClaude(next, sysCustomer);
      const reply = extractText(data) || "…";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setError("تعذّر الاتصال بالعميل الافتراضي. حاول مرة أخرى.");
    } finally {
      setThinking(false);
    }
  };

  const evaluate = async () => {
    if (messages.length < 2 || evalLoading) return;
    setEvalLoading(true);
    setError("");
    const transcript = messages.map((m) => (m.role === "user" ? "المندوب: " : "العميل: ") + m.content).join("\n");
    const sys = METHODOLOGY + `

أنت مدرّب مبيعات خبير. قيّم أداء المندوب من النص التالي. أعِد فقط JSON صالحاً دون أي نص أو علامات ماركداون، بهذا الشكل بالضبط:
{"unconditionalDiscount": false, "discountNote": "", "scores": {"listening": 3, "questioning": 3, "objection": 3, "closing": 3}, "strengths": ["", ""], "improvements": ["", ""], "modelLine": "", "schoolFit": ""}
كل النصوص بالعربية واللهجة السعودية. إذا منح المندوب خصماً دون شرط اجعل unconditionalDiscount=true واذكر في discountNote التصحيح عبر المقايضة المشروطة. الدرجات من ١ إلى ٥. modelLine جملة إغلاق نموذجية واحدة. schoolFit أي مدرسة (بيلفورت/كاردون) كانت أنسب لهذا العميل ولماذا بإيجاز.`;
    try {
      const data = await callClaude([{ role: "user", content: transcript }], sys);
      const raw = extractText(data).replace(/```json/g, "").replace(/```/g, "").trim();
      setEvalData(JSON.parse(raw));
    } catch {
      setError("تعذّر توليد التقييم. جرّب مرة أخرى بعد قليل.");
    } finally {
      setEvalLoading(false);
    }
  };

  const scoreMeta: [string, string][] = [["listening", "الإنصات"], ["questioning", "الأسئلة"], ["objection", "الاعتراضات"], ["closing", "الإغلاق"]];

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-sm" style={{ borderColor: "#c7d2fe" }}>
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: ACCENT }}>🤖</span>
        <h3 className="text-base font-extrabold text-slate-900">محاكي التفاوض الذكي</h3>
      </div>
      <p className="mb-4 text-sm text-slate-500">يلعب Claude دور العميل الصعب بلهجة سعودية، ثم يقيّم أداء المندوب حسب المنهجية وينبّه لو مُنح خصم بلا شرط.</p>

      {phase === "setup" && (
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p)}
                className="rounded-xl border p-4 text-right transition"
                style={{ borderColor: persona.id === p.id ? ACCENT : "#e2e8f0", background: persona.id === p.id ? "#eff6ff" : "#fff" }}
              >
                <div className="text-sm font-extrabold text-slate-800">{p.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{p.brief}</div>
              </button>
            ))}
          </div>
          {persona.id === "custom" && (
            <div className="mt-3">
              <AreaInput value={customBrief} rows={2} placeholder="مثال: مالك عربة قهوة متردد، ميزانيته محدودة ويخاف من الالتزام السنوي…" onChange={setCustomBrief} />
            </div>
          )}
          <button onClick={start} className="mt-4 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90" style={{ background: NAVY }}>
            ابدأ التدريب ▸
          </button>
        </div>
      )}

      {phase === "chatting" && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="rounded-full px-3 py-1 font-bold text-blue-700" style={{ background: "#dbeafe" }}>{persona.label}</span>
            <span className="text-slate-400">أنت المندوب — ابدأ بفتح الحوار</span>
          </div>
          <div ref={scrollRef} className="h-72 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            {messages.length === 0 && <p className="mt-10 text-center text-sm text-slate-400">اكتب رسالة الترحيب وافتح الحوار مع العميل…</p>}
            {messages.map((m, i) => (
              <div key={i} className={"flex " + (m.role === "user" ? "justify-start" : "justify-end")}>
                <div className="max-w-[82%] rounded-2xl px-4 py-2 text-sm leading-6" style={m.role === "user" ? { background: ACCENT, color: "#fff" } : { background: "#fff", color: "#0f172a", border: "1px solid #e2e8f0" }}>
                  <div className="mb-0.5 text-[11px] font-bold opacity-70">{m.role === "user" ? "المندوب (أنت)" : "العميل"}</div>
                  {m.content}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-end">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400">العميل يكتب…</div>
              </div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              dir="rtl"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="اكتب ردّك كمندوب…"
              className={inputCls}
            />
            <button onClick={send} disabled={thinking} className="shrink-0 rounded-lg px-5 py-2 text-sm font-bold text-white transition disabled:opacity-40" style={{ background: ACCENT }}>
              إرسال
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={evaluate} disabled={messages.length < 2 || evalLoading} className="rounded-lg px-4 py-2 text-sm font-bold text-white transition disabled:opacity-40" style={{ background: NAVY }}>
              {evalLoading ? "يُقيّم الجولة…" : "قيّم الجولة"}
            </button>
            <button onClick={reset} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
              إعادة تعيين
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {evalData && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="mb-3 text-sm font-extrabold text-slate-900">تقييم الجولة</h4>
              {evalData.unconditionalDiscount && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                  <b>⚠ تنبيه — خصم بلا شرط:</b> {evalData.discountNote}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {scoreMeta.map(([k, lbl]) => {
                  const v = Number(evalData.scores?.[k]) || 0;
                  return (
                    <div key={k} className="rounded-xl bg-slate-50 p-3 text-center">
                      <div className="text-2xl font-extrabold" style={{ color: NAVY }}>{v}<span className="text-sm text-slate-400"> /٥</span></div>
                      <div className="text-xs font-semibold text-slate-500">{lbl}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <h5 className="mb-1 text-sm font-extrabold text-green-700">نقاط القوة</h5>
                  <ul className="list-disc space-y-1 pr-5 text-sm leading-6 text-slate-600">{(evalData.strengths || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
                <div>
                  <h5 className="mb-1 text-sm font-extrabold text-amber-700">فرص التطوير</h5>
                  <ul className="list-disc space-y-1 pr-5 text-sm leading-6 text-slate-600">{(evalData.improvements || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              </div>
              {evalData.modelLine && (
                <div className="mt-4 rounded-xl p-3 text-sm leading-6" style={{ borderRight: "4px solid " + ACCENT, background: "#eff6ff" }}>
                  <b>جملة إغلاق نموذجية:</b> {evalData.modelLine}
                </div>
              )}
              {evalData.schoolFit && <p className="mt-3 text-sm leading-6 text-slate-500"><b>المدرسة الأنسب:</b> {evalData.schoolFit}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Supabase helpers ---------- */

async function fetchPlaybook(orgId: string) {
  const sb = createClient();
  const { data } = await sb.from("sales_playbook").select("data").eq("org_id", orgId).maybeSingle();
  return data?.data ?? null;
}

async function savePlaybook(orgId: string, payload: typeof defaultData) {
  const sb = createClient();
  await sb.from("sales_playbook").upsert({ org_id: orgId, data: payload, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
}

/* ---------- المكوّن الرئيسي ---------- */

export default function SalesPlaybook() {
  const { activeOrgId } = useAuth();
  const [data, setData] = useState(clone(defaultData));
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // تحميل البيانات من Supabase
  useEffect(() => {
    if (!activeOrgId) return;
    fetchPlaybook(activeOrgId)
      .then((saved) => {
        if (saved) setData({ ...clone(defaultData), ...saved });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [activeOrgId]);

  // الحفظ التلقائي (debounced 600ms)
  useEffect(() => {
    if (!loaded || !activeOrgId) return;
    setSaveState("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      savePlaybook(activeOrgId, data)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [data, loaded, activeOrgId]);

  const update = (fn: (d: typeof defaultData) => void) =>
    setData((prev) => { const next = clone(prev); fn(next); return next; });

  /* روابط التنقل */
  const nav = [
    { id: "sec-roles", label: "الأدوار" },
    { id: "sec-pipeline", label: "قمع المبيعات" },
    { id: "sec-discovery", label: "دليل الاكتشاف" },
    { id: "sec-training", label: "التدريب والتقييم" },
    { id: "sec-kpis", label: "المؤشرات" },
    { id: "sec-negotiation", label: "التفاوض والإغلاق" },
  ];
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  const resetAll = () => {
    if (window.confirm("سيتم استرجاع كل الأقسام إلى المحتوى الافتراضي وحذف تعديلاتك. متأكد؟")) {
      setData(clone(defaultData));
    }
  };

  /* حسابات بطاقة التقييم */
  const sc = data.training.scorecard;
  const scMax = sc.criteria.length * 5;
  const scSum = sc.criteria.reduce((a, c) => a + (Number(c.score) || 0), 0);
  const scPct = scMax ? Math.round((scSum / scMax) * 100) : 0;
  const scRating =
    scPct >= 85 ? { t: "ممتاز", c: "#16a34a", bg: "#dcfce7" }
    : scPct >= 70 ? { t: "جيد جداً", c: "#2563eb", bg: "#dbeafe" }
    : scPct >= 55 ? { t: "جيد", c: "#d97706", bg: "#fef3c7" }
    : { t: "يحتاج إلى تطوير", c: "#dc2626", bg: "#fee2e2" };

  const kpiPct = (k: typeof defaultData.kpis.leading[number]) => {
    const a = Number(k.actual) || 0;
    const t = Number(k.target) || 0;
    if (!t) return 0;
    const raw = k.lower ? (a === 0 ? 0 : (t / a) * 100) : (a / t) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  };
  const kpiColor = (p: number) => (p >= 100 ? "#16a34a" : p >= 60 ? "#d97706" : "#dc2626");

  const saveLabel =
    saveState === "saving" ? { t: "جارٍ الحفظ…", c: "#d97706", d: "#fbbf24" }
    : saveState === "error" ? { t: "تعذّر الحفظ", c: "#dc2626", d: "#f87171" }
    : saveState === "saved" ? { t: "محفوظ", c: "#16a34a", d: "#22c55e" }
    : { t: "جاهز", c: "#94a3b8", d: "#cbd5e1" };

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif" }} className="min-h-screen bg-slate-100 text-slate-900">

      {/* الترويسة */}
      <header style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 100%)` }} className="px-5 py-8 text-white sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-wide">
              منظومة قائمة الطلبات · MENU
            </div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">
              لوحة المبيعات التفاعلية والدليل التشغيلي
            </h1>
            <p className="mt-1 text-sm text-blue-100">من الصفر إلى الاحتراف — قابل للتعديل بالكامل ليطابق سير عملياتكم.</p>
          </div>
          <div className="no-print flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full" style={{ background: saveLabel.d }} />
              {saveLabel.t}
            </span>
            <button onClick={() => window.print()} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-800 transition hover:bg-blue-50">
              طباعة / PDF
            </button>
            <button onClick={resetAll} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/20">
              استرجاع الافتراضي
            </button>
          </div>
        </div>
      </header>

      {/* شريط التنقل */}
      <nav className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-1 px-3 py-2 sm:px-8">
          {nav.map((it, i) => (
            <button
              key={it.id}
              onClick={() => go(it.id)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700"
            >
              <span className="ml-1 text-xs text-slate-400">{i + 1}</span>
              {it.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ١ — الأدوار */}
      <SectionWrap id="sec-roles">
        <SectionHeader
          n="١"
          title="الهيكل الإداري والأدوار"
          en="Governance & Roles"
          desc="من يملك القرار، من ينفّذ، ومن يطبّق. وضوح الأدوار يمنع تداخل المسؤوليات ويجعل المساءلة واضحة."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {data.roles.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-full px-3 py-1 text-xs font-bold text-blue-700" style={{ background: "#dbeafe" }}>
                  {r.tag}
                </span>
              </div>
              <input
                value={r.title}
                onChange={(e) => update((d) => { d.roles.find((x) => x.id === r.id)!.title = e.target.value; })}
                className="mb-2 w-full border-none bg-transparent text-lg font-extrabold text-slate-900 outline-none focus:bg-slate-50"
              />
              <AreaInput
                value={r.body}
                rows={5}
                onChange={(v) => update((d) => { d.roles.find((x) => x.id === r.id)!.body = v; })}
              />
            </div>
          ))}
        </div>
      </SectionWrap>

      {/* ٢ — قمع المبيعات */}
      <SectionWrap id="sec-pipeline">
        <SectionHeader
          n="٢"
          title="نظام قمع المبيعات المرن"
          en="Editable Sales Pipeline"
          desc="أربع مراحل متسلسلة. لكل مرحلة مهام مطلوبة من الموظف ومخرجات متوقعة — عدّل أو أضف ما يناسب نظام الكاشير والاشتراكات لديكم."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          {data.pipeline.map((stage, si) => (
            <div key={stage.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 px-5 py-4" style={{ background: NAVY }}>
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-extrabold" style={{ color: NAVY }}>
                  {si + 1}
                </span>
                <div className="text-white">
                  <div className="text-base font-extrabold">{stage.name}</div>
                  <div className="text-xs text-blue-200">{stage.en}</div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-2 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500">
                  <div>المهمة المطلوبة</div>
                  <div>المخرَج المتوقّع</div>
                </div>
                {stage.tasks.map((t) => (
                  <div key={t.id} className="group grid grid-cols-2 gap-2 px-4 py-3">
                    <AreaInput value={t.task} onChange={(v) => update((d) => { d.pipeline.find((s) => s.id === stage.id)!.tasks.find((x) => x.id === t.id)!.task = v; })} />
                    <div className="flex items-start gap-1">
                      <AreaInput value={t.output} onChange={(v) => update((d) => { d.pipeline.find((s) => s.id === stage.id)!.tasks.find((x) => x.id === t.id)!.output = v; })} />
                      <IconBtn tone="red" title="حذف" onClick={() => update((d) => { const s = d.pipeline.find((s) => s.id === stage.id)!; s.tasks = s.tasks.filter((x) => x.id !== t.id); })}>✕</IconBtn>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3">
                  <AddBtn onClick={() => update((d) => { d.pipeline.find((s) => s.id === stage.id)!.tasks.push({ id: uid(), task: "", output: "" }); })}>
                    إضافة مهمة
                  </AddBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionWrap>

      {/* ٣ — دليل الاكتشاف */}
      <SectionWrap id="sec-discovery">
        <SectionHeader
          n="٣"
          title="دليل مكالمة الاكتشاف التشخيصي"
          en="Discovery Script"
          desc="نموذج «طبيب المبيعات»: لا تصف الدواء قبل التشخيص. المراحل والأسئلة كلها قابلة للتعديل بحسب ردود فعل السوق."
        />

        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {data.discovery.phases.map((ph) => (
            <div key={ph.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <input
                value={ph.title}
                onChange={(e) => update((d) => { d.discovery.phases.find((x) => x.id === ph.id)!.title = e.target.value; })}
                className="mb-2 w-full border-none bg-transparent text-sm font-extrabold text-slate-800 outline-none focus:bg-white"
              />
              <AreaInput value={ph.note} rows={3} onChange={(v) => update((d) => { d.discovery.phases.find((x) => x.id === ph.id)!.note = v; })} />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-5 w-1.5 rounded-full" style={{ background: ACCENT }} />
            <h3 className="text-base font-extrabold text-slate-900">الأسئلة التشخيصية</h3>
          </div>
          <div className="space-y-2">
            {data.discovery.questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-extrabold text-white" style={{ background: NAVY }}>{i + 1}</span>
                <TextInput value={q.text} onChange={(v) => update((d) => { d.discovery.questions.find((x) => x.id === q.id)!.text = v; })} />
                <IconBtn tone="red" title="حذف السؤال" onClick={() => update((d) => { d.discovery.questions = d.discovery.questions.filter((x) => x.id !== q.id); })}>✕</IconBtn>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <AddBtn onClick={() => update((d) => { d.discovery.questions.push({ id: uid(), text: "" }); })}>إضافة سؤال تشخيصي</AddBtn>
          </div>
        </div>
      </SectionWrap>

      {/* ٤ — التدريب والتقييم */}
      <SectionWrap id="sec-training">
        <SectionHeader
          n="٤"
          title="مركز التدريب وحاسبة التقييم"
          en="Training Hub & Scorecard"
          desc="جدولة جلسات المحاكاة الأسبوعية بقيادة المختص المساعد، مع استمارة تقييم رقمية تحسب النتيجة تلقائياً."
        />

        {/* جدول الجلسات */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right text-sm">
              <thead>
                <tr className="text-xs font-bold text-slate-500" style={{ background: "#f1f5f9" }}>
                  <th className="px-3 py-3 font-bold">اليوم</th>
                  <th className="px-3 py-3 font-bold">الوقت</th>
                  <th className="px-3 py-3 font-bold">السيناريو / الموضوع</th>
                  <th className="px-3 py-3 font-bold">قائد الجلسة</th>
                  <th className="px-3 py-3 font-bold">المشاركون</th>
                  <th className="px-3 py-3 font-bold">الحالة</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.training.schedule.map((row) => (
                  <tr key={row.id} className="align-top">
                    {(["day", "time", "topic", "lead", "who"] as const).map((f) => (
                      <td key={f} className="px-2 py-2">
                        <TextInput value={row[f]} onChange={(v) => update((d) => { d.training.schedule.find((x) => x.id === row.id)![f] = v; })} />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <select
                        value={row.status}
                        onChange={(e) => update((d) => { d.training.schedule.find((x) => x.id === row.id)!.status = e.target.value; })}
                        className={inputCls + " cursor-pointer"}
                      >
                        <option>مجدولة</option>
                        <option>تمت</option>
                        <option>مؤجلة</option>
                        <option>ملغاة</option>
                      </select>
                    </td>
                    <td className="px-1 py-2">
                      <IconBtn tone="red" title="حذف الصف" onClick={() => update((d) => { d.training.schedule = d.training.schedule.filter((x) => x.id !== row.id); })}>✕</IconBtn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-3">
            <AddBtn onClick={() => update((d) => { d.training.schedule.push({ id: uid(), day: "", time: "", topic: "", lead: "المختص المساعد", who: "", status: "مجدولة" }); })}>
              إضافة جلسة
            </AddBtn>
          </div>
        </div>

        {/* بطاقة التقييم */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-5 w-1.5 rounded-full" style={{ background: ACCENT }} />
            <h3 className="text-base font-extrabold text-slate-900">استمارة تقييم وملاحظات الكوتشينج</h3>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">اسم الموظف</label>
              <TextInput value={sc.employee} onChange={(v) => update((d) => { d.training.scorecard.employee = v; })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">التاريخ</label>
              <TextInput value={sc.date} onChange={(v) => update((d) => { d.training.scorecard.date = v; })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500">المقيّم</label>
              <TextInput value={sc.evaluator} onChange={(v) => update((d) => { d.training.scorecard.evaluator = v; })} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* المعايير */}
            <div className="lg:col-span-2">
              <div className="space-y-2">
                {sc.criteria.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <input
                      value={c.label}
                      onChange={(e) => update((d) => { d.training.scorecard.criteria.find((x) => x.id === c.id)!.label = e.target.value; })}
                      className="w-full border-none bg-transparent text-sm font-semibold text-slate-800 outline-none focus:bg-white sm:max-w-xs"
                    />
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const on = Number(c.score) >= n;
                        return (
                          <button
                            key={n}
                            onClick={() => update((d) => { d.training.scorecard.criteria.find((x) => x.id === c.id)!.score = n; })}
                            className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold transition"
                            style={{ background: on ? NAVY : "#fff", color: on ? "#fff" : "#94a3b8", border: "1px solid " + (on ? NAVY : "#e2e8f0") }}
                          >
                            {n}
                          </button>
                        );
                      })}
                      <IconBtn tone="red" title="حذف المعيار" onClick={() => update((d) => { d.training.scorecard.criteria = d.training.scorecard.criteria.filter((x) => x.id !== c.id); })}>✕</IconBtn>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <AddBtn onClick={() => update((d) => { d.training.scorecard.criteria.push({ id: uid(), label: "معيار جديد", score: 3 }); })}>إضافة معيار</AddBtn>
              </div>
            </div>

            {/* النتيجة */}
            <div className="rounded-2xl p-5 text-center text-white" style={{ background: NAVY }}>
              <div className="text-xs font-bold text-blue-200">النتيجة الإجمالية</div>
              <div className="mt-2 text-4xl font-extrabold">
                {scSum}<span className="text-lg text-blue-300"> / {scMax}</span>
              </div>
              <div className="mt-1 text-sm text-blue-100">{scPct}%</div>
              <div className="mx-auto mt-4 inline-block rounded-full px-4 py-1.5 text-sm font-extrabold" style={{ background: scRating.bg, color: scRating.c }}>
                {scRating.t}
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full" style={{ width: scPct + "%", background: "#fff" }} />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-1 block text-xs font-bold text-slate-500">ملاحظات المدرّب (نقاط القوة + خطوة تطوير واحدة)</label>
            <AreaInput value={sc.notes} rows={3} onChange={(v) => update((d) => { d.training.scorecard.notes = v; })} placeholder="مثال: إنصات ممتاز، لكن يستعجل في العرض قبل تأكيد الألم. خطوة الأسبوع: يطبّق تلخيص الفهم قبل أي عرض." />
          </div>
        </div>
      </SectionWrap>

      {/* ٥ — المؤشرات */}
      <SectionWrap id="sec-kpis">
        <SectionHeader
          n="٥"
          title="مؤشرات الأداء القائمة على المعطيات"
          en="Data-Driven KPIs"
          desc="نوعان من المؤشرات: أنشطة يقودها المساعد (Leading)، ونتائج يقيسها القائد (Lagging). المستهدفات والقيم قابلة للتعديل."
        />

        {([
          { key: "leading" as const, title: "مؤشرات الأنشطة والسلوكيات", en: "Leading — يقودها المساعد ويطبّقها الفريق", tone: "#2563eb", toneBg: "#dbeafe" },
          { key: "lagging" as const, title: "مؤشرات النتائج النهائية", en: "Lagging — يقيسها القائد", tone: "#0E2A47", toneBg: "#e2e8f0" },
        ]).map((grp) => (
          <div key={grp.key} className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-extrabold" style={{ background: grp.toneBg, color: grp.tone }}>{grp.en}</span>
              <h3 className="text-base font-extrabold text-slate-900">{grp.title}</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {data.kpis[grp.key].map((k) => {
                const p = kpiPct(k);
                const col = kpiColor(p);
                return (
                  <div key={k.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-1">
                      <AreaInput value={k.label} rows={2} onChange={(v) => update((d) => { d.kpis[grp.key].find((x) => x.id === k.id)!.label = v; })} />
                      <IconBtn tone="red" title="حذف المؤشر" onClick={() => update((d) => { d.kpis[grp.key] = d.kpis[grp.key].filter((x) => x.id !== k.id); })}>✕</IconBtn>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-400">المستهدف</label>
                        <div className="flex items-center gap-1">
                          <input type="number" value={k.target} onChange={(e) => update((d) => { d.kpis[grp.key].find((x) => x.id === k.id)!.target = Number(e.target.value); })} className={inputCls + " text-center"} />
                          <span className="text-xs text-slate-400">{k.unit}</span>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-400">الفعلي</label>
                        <div className="flex items-center gap-1">
                          <input type="number" value={k.actual} onChange={(e) => update((d) => { d.kpis[grp.key].find((x) => x.id === k.id)!.actual = Number(e.target.value); })} className={inputCls + " text-center"} />
                          <span className="text-xs text-slate-400">{k.unit}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-bold" style={{ color: col }}>{p}%</span>
                        {k.lower && <span className="text-[11px] text-slate-400">الأقل أفضل</span>}
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all" style={{ width: p + "%", background: col }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3">
              <AddBtn onClick={() => update((d) => { d.kpis[grp.key].push({ id: uid(), label: "مؤشر جديد", target: 100, actual: 0, unit: "%", lower: false }); })}>إضافة مؤشر</AddBtn>
            </div>
          </div>
        ))}
      </SectionWrap>

      {/* ٦ — التفاوض والإغلاق المتقدم */}
      <SectionWrap id="sec-negotiation">
        <SectionHeader
          n="٦"
          title="مدرسة التفاوض والإغلاق المتقدم"
          en="Advanced Negotiation & Closing"
          desc="محاكاة واقعية لأبرز مدارس المبيعات (هارفارد، كريس فوس، بيلفورت، كاردون) — مرجع قابل للتعديل + محاكي تدريب ذكي."
        />

        {/* الأخطاء الشائعة */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1.5 rounded-full" style={{ background: ACCENT }} />
            <h3 className="text-base font-extrabold text-slate-900">الخطأ الأخطر: الخصم المجاني الفوري (Instant Give)</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="mb-2 inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">✗ الرد الخاطئ</div>
              <AreaInput value={data.negotiation.mistakeWrong} rows={4} onChange={(v) => update((d) => { d.negotiation.mistakeWrong = v; })} />
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <div className="mb-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">✓ الرد الصحيح (صياغة الإغلاق)</div>
              <AreaInput value={data.negotiation.mistakeRight} rows={6} onChange={(v) => update((d) => { d.negotiation.mistakeRight = v; })} />
            </div>
          </div>
        </div>

        {/* تكتيكات التفاوض */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-5 w-1.5 rounded-full" style={{ background: ACCENT }} />
            <h3 className="text-base font-extrabold text-slate-900">تكتيكات التفاوض</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.negotiation.tactics.map((t) => (
              <div key={t.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-1">
                  <div className="flex-1">
                    <input
                      value={t.name}
                      onChange={(e) => update((d) => { d.negotiation.tactics.find((x) => x.id === t.id)!.name = e.target.value; })}
                      className="w-full border-none bg-transparent text-sm font-extrabold text-slate-900 outline-none focus:bg-slate-50"
                    />
                    <input
                      value={t.en}
                      onChange={(e) => update((d) => { d.negotiation.tactics.find((x) => x.id === t.id)!.en = e.target.value; })}
                      className="w-full border-none bg-transparent text-xs font-semibold text-slate-400 outline-none focus:bg-slate-50"
                    />
                  </div>
                  <IconBtn tone="red" title="حذف التكتيك" onClick={() => update((d) => { d.negotiation.tactics = d.negotiation.tactics.filter((x) => x.id !== t.id); })}>✕</IconBtn>
                </div>
                <AreaInput value={t.body} rows={4} onChange={(v) => update((d) => { d.negotiation.tactics.find((x) => x.id === t.id)!.body = v; })} />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <AddBtn onClick={() => update((d) => { d.negotiation.tactics.push({ id: uid(), name: "تكتيك جديد", en: "", body: "" }); })}>إضافة تكتيك</AddBtn>
          </div>
        </div>

        {/* القنوات + المدارس */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-1.5 rounded-full" style={{ background: ACCENT }} />
              <h3 className="text-base font-extrabold text-slate-900">الفروق بين القنوات</h3>
            </div>
            <div className="space-y-3">
              {data.negotiation.channels.map((c) => (
                <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <input
                    value={c.name}
                    onChange={(e) => update((d) => { d.negotiation.channels.find((x) => x.id === c.id)!.name = e.target.value; })}
                    className="mb-2 w-full border-none bg-transparent text-sm font-extrabold text-slate-900 outline-none focus:bg-slate-50"
                  />
                  <AreaInput value={c.body} rows={3} onChange={(v) => update((d) => { d.negotiation.channels.find((x) => x.id === c.id)!.body = v; })} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-5 w-1.5 rounded-full" style={{ background: ACCENT }} />
              <h3 className="text-base font-extrabold text-slate-900">مقارنة مدارس العمالقة</h3>
            </div>
            <div className="space-y-3">
              {data.negotiation.schools.map((s) => (
                <div key={s.id} className="rounded-2xl border border-slate-200 p-4 shadow-sm" style={{ background: "#f8fafc" }}>
                  <input
                    value={s.name}
                    onChange={(e) => update((d) => { d.negotiation.schools.find((x) => x.id === s.id)!.name = e.target.value; })}
                    className="mb-2 w-full border-none bg-transparent text-sm font-extrabold outline-none focus:bg-white"
                    style={{ color: NAVY }}
                  />
                  <AreaInput value={s.body} rows={4} onChange={(v) => update((d) => { d.negotiation.schools.find((x) => x.id === s.id)!.body = v; })} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* المحاكي الذكي */}
        <NegotiationSimulator />
      </SectionWrap>

      <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-xs text-slate-400 sm:px-8">
        دليل تشغيلي حي — كل تعديل يُحفظ تلقائياً · منظومة MENU · قابل للطباعة كـ PDF.
      </footer>
    </div>
  );
}
