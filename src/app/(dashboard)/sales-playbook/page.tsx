"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────── types ─────────────────────────── */
type Role = { id: string; title: string; tag: string; body: string };
type PipelineTask = { id: string; task: string; output: string };
type PipelineStage = { id: string; name: string; en: string; tasks: PipelineTask[] };
type DiscoveryPhase = { id: string; title: string; note: string };
type DiscoveryQuestion = { id: string; text: string };
type TrainingRow = { id: string; day: string; time: string; topic: string; lead: string; who: string; status: string };
type ScoreCriterion = { id: string; label: string; score: number };
type Kpi = { id: string; label: string; target: number; actual: number; unit: string; lower: boolean };
type Tactic = { id: string; name: string; en: string; body: string };
type Channel = { id: string; name: string; body: string };
type School = { id: string; name: string; body: string };

interface PlaybookData {
  roles: Role[];
  pipeline: PipelineStage[];
  discovery: { phases: DiscoveryPhase[]; questions: DiscoveryQuestion[] };
  training: {
    schedule: TrainingRow[];
    scorecard: { employee: string; date: string; evaluator: string; notes: string; criteria: ScoreCriterion[] };
  };
  kpis: { leading: Kpi[]; lagging: Kpi[] };
  negotiation: {
    mistakeWrong: string; mistakeRight: string;
    tactics: Tactic[]; channels: Channel[]; schools: School[];
  };
}

/* ─────────────────────────── defaults ─────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 9); }

function defaults(): PlaybookData {
  return {
    roles: [
      { id: "r1", title: "القائد (حمد)", tag: "التوجيه والاعتماد", body: "التوجيه الاستراتيجي العام، المراجعة النهائية لأداء الفريق، واعتماد أي تعديل أو تطوير على المنهجية والأسعار. يقيس مؤشرات النتائج النهائية (Lagging)." },
      { id: "r2", title: "المختص المساعد", tag: "التنفيذ والمتابعة", body: "التنفيذ الميداني اليومي، متابعة التزام الفريق بالخطوات، وقيادة جلسات المحاكاة والتدريب الأسبوعية. يقود مؤشرات الأنشطة (Leading)." },
      { id: "r3", title: "فريق المبيعات", tag: "التطبيق والرفع", body: "التطبيق الصارم للمنهجية على كل عميل، الالتزام بترتيب مراحل القمع، وتعبئة استمارات التشخيص ورفع التقارير والبيانات بدقة في CommandCenter." },
    ],
    pipeline: [
      { id: "p1", name: "التأهيل", en: "Qualification", tasks: [
        { id: uid(), task: "تحديد نوع المنشأة (مطعم / كافيه / عربة طعام) وحجم عملياتها اليومية.", output: "بطاقة عميل مؤهّل معبّأة في CommandCenter." },
        { id: uid(), task: "التأكد من أن جهة الاتصال هي صاحب القرار أو مؤثّر فيه (Authority).", output: "تصنيف العميل: ساخن / دافئ / بارد." },
        { id: uid(), task: "تقييم الملاءمة عبر BANT (الميزانية، الصلاحية، الحاجة، التوقيت).", output: "قرار: يُكمَّل أو يُستبعد مع السبب." },
      ]},
      { id: "p2", name: "الاكتشاف", en: "Discovery", tasks: [
        { id: uid(), task: "إجراء مكالمة أو زيارة تشخيصية باستخدام دليل الاكتشاف.", output: "تقرير احتياجات موثّق ومربوط بالعميل." },
        { id: uid(), task: "تعبئة استمارة تشخيص العميل كاملة أثناء اللقاء.", output: "قائمة أولويات ونقاط ألم مرتّبة." },
        { id: uid(), task: "رصد نقاط الألم التشغيلية: الإدخال اليدوي، وقت الذروة، زحام الطلبات.", output: "تحديد المنتج الأنسب: MENU / نحجز / درع." },
      ]},
      { id: "p3", name: "عرض الحل", en: "Presentation", tasks: [
        { id: uid(), task: "تجهيز عرض حي (Demo) مخصّص لحالة العميل لا عرض عام.", output: "عرض سعر مخصّص مبني على الاحتياج." },
        { id: uid(), task: "ربط كل ميزة تُعرض بمشكلة ذُكرت في مرحلة الاكتشاف.", output: "خطة تفعيل مقترحة بمراحل واضحة." },
        { id: uid(), task: "عرض حساب عائد مبسّط (كم يوفّر من وقت / أخطاء / إيراد ضائع).", output: "محضر لقاء بالخطوات والمواعيد التالية." },
      ]},
      { id: "p4", name: "الإغلاق", en: "Closing", tasks: [
        { id: uid(), task: "معالجة الاعتراضات النهائية (السعر، التوقيت، الالتزام العقدي).", output: "اتفاقية اشتراك سنوي موقّعة." },
        { id: uid(), task: "تقديم حافز محدّد بوقت لدفع القرار (Time-boxed).", output: "دفعة أولى مؤكدة." },
        { id: uid(), task: "تأكيد نطاق الخدمة وتسليم العميل لفريق التفعيل والدعم.", output: "تسليم Onboarding موثّق." },
      ]},
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
        employee: "", date: "", evaluator: "", notes: "",
        criteria: [
          { id: uid(), label: "الإنصات الفعّال (Active Listening)", score: 3 },
          { id: uid(), label: "جودة الأسئلة التشخيصية", score: 3 },
          { id: uid(), label: "ربط الميزة بالمشكلة", score: 3 },
          { id: uid(), label: "التعامل مع الاعتراضات", score: 3 },
          { id: uid(), label: "الوضوح والثقة في العرض", score: 3 },
          { id: uid(), label: "الالتزام بخطوات المنهجية", score: 3 },
        ],
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
      mistakeWrong: "«برجع أشيك مع الإدارة… السعر لك ٢٩٩ ريال شامل المزايا، حاب نحجز لك؟» — خصم يُمنح مباشرة دون شرط، وسؤال إغلاق ضعيف وسهل التجاهل. النتيجة: يفقد المنتج قيمته ويماطل العميل أو يطلب خصماً أكبر.",
      mistakeRight: "«أبشر بسعدك أستاذ [الاسم]، كلمت لك مدير المبيعات وطلع لك استثناء خاص تقديراً لجدّيتك: الباقة الشاملة بكل المزايا بـ[السعر المخفض]. لكن المدير اشترط شرطاً واحداً: نعتمد الاشتراك ونبدأ رفع المنيو وتجهيزه لك الليلة عشان يجهز حسابك شغّال قبل الويكند وتلحق زبائنك. عشان نستغل الاستثناء — أرسل لك رابط الدفع السريع الآن ونبدأ فوراً؟»",
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
}

/* ─────────────────────────── AI helpers ─────────────────────────── */
const METHODOLOGY = `دليل التفاوض والإغلاق لمنظومة MENU (نظام كاشير واشتراكات مطاعم SaaS):
- المقايضة المشروطة: لا يُمنح أي خصم أو تنازل مجاناً؛ يُربط دائماً بالتزام فوري.
- التفاوض على القيمة لا السعر: عند شكوى السعر، ذكّر بالمشاكل التي يحلها المنتج.
- الإرساء وثلاث باقات: عالية كمرساة، احترافية (الهدف)، أساسية محدودة.
- التعاطف التكتيكي: اعترف بمخاوف العميل قبل الرد.
- الرجوع لسلطة أعلى: البائع في صف العميل يحاول استخراج استثناء من الإدارة.
- الأسئلة المعايرة: أسئلة «كيف/ماذا» لنقل العميل من الهجوم إلى التفكير.
- مدرسة بيلفورت (الخط المستقيم): ثقة ١٠/١٠ في المنتج والبائع والشركة.
- مدرسة كاردون (10X): طاقة وإصرار؛ «السعر غالي» تُمتص بالموافقة ثم الإغلاق.
- الخطأ الأخطر: منح الخصم مباشرة دون شرط (Instant Give).`;

const SIM_PERSONAS = [
  { id: "mumatil", label: "مماطل — يحتاج حسم كاردون", brief: "مالك مطعم مشغول يماطل ويؤجّل: «خلني أفكر»، «أرجع لك». يحتاج طاقة عالية وإصراراً وإغلاقاً حاسماً." },
  { id: "waai", label: "واعٍ بالسعر — يحتاج ثقة بيلفورت", brief: "صاحب سلسلة كافيهات يقارن بفودكس ومرن ويشكك في القيمة. يحتاج بناء ثقة ١٠/١٠ في المنتج والبائع والشركة." },
  { id: "khasm", label: "يطلب خصم فوري — اختبار المقايضة", brief: "يضغط مباشرة: «كم آخر سعر؟» و«ودّي خصم». الاختبار: هل يمنح المندوب الخصم مجاناً أم يربطه بالتزام فوري؟" },
  { id: "custom", label: "شخصية مخصّصة", brief: "اكتب وصف العميل بنفسك." },
];

async function callClaude(messages: { role: string; content: string }[], system: string): Promise<string> {
  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system, messages }),
  });
  const data = await r.json();
  if (data.content && Array.isArray(data.content)) {
    return data.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
  }
  return data.text || data.content || "";
}

/* ─────────────────────────── DB helpers ─────────────────────────── */
async function fetchPlaybook(orgId: string): Promise<PlaybookData | null> {
  const supabase = createClient();
  const { data } = await supabase.from("sales_playbook").select("data").eq("org_id", orgId).single();
  return data?.data ?? null;
}

async function savePlaybook(orgId: string, data: PlaybookData) {
  const supabase = createClient();
  await supabase.from("sales_playbook").upsert({ org_id: orgId, data, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
}

/* ─────────────────────────── score helpers ─────────────────────────── */
function calcScore(criteria: ScoreCriterion[]) {
  const sum = criteria.reduce((a, c) => a + (c.score || 0), 0);
  const max = criteria.length * 5;
  const pct = max ? Math.round((sum / max) * 100) : 0;
  const rating = pct >= 85 ? "ممتاز" : pct >= 70 ? "جيد جداً" : pct >= 55 ? "جيد" : "يحتاج إلى تطوير";
  const color = pct >= 85 ? "#16a34a" : pct >= 70 ? "#2563eb" : pct >= 55 ? "#d97706" : "#dc2626";
  return { sum, max, pct, rating, color };
}

function calcKpi(k: Kpi) {
  const a = k.actual || 0, t = k.target || 0;
  const pct = t ? Math.max(0, Math.min(100, Math.round(k.lower ? (a === 0 ? 0 : (t / a) * 100) : (a / t) * 100))) : 0;
  const color = pct >= 100 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626";
  return { pct, color };
}

/* ─────────────────────────── sub-components ─────────────────────────── */
function SectionHeader({ num, title, en, desc }: { num: string; title: string; en: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start mb-6">
      <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-[#0E2A47] text-white grid place-items-center font-bold text-lg">{num}</div>
      <div>
        <h2 className="text-xl font-extrabold text-foreground">{title} <span className="text-sm font-bold text-muted-foreground">— {en}</span></h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-2xl">{desc}</p>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-2xl p-4 shadow-sm ${className}`}>{children}</div>;
}

function EditInput({ value, onChange, className = "", multiline = false, rows = 2, placeholder = "" }: {
  value: string; onChange: (v: string) => void; className?: string; multiline?: boolean; rows?: number; placeholder?: string;
}) {
  if (multiline) {
    return (
      <textarea
        className={`w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y leading-relaxed ${className}`}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    );
  }
  return (
    <input
      className={`w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${className}`}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
    />
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 border border-dashed border-slate-300 bg-card rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
      <span className="text-base leading-none">＋</span>{label}
    </button>
  );
}

function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-8 h-8 flex-shrink-0 border-none bg-transparent text-muted-foreground rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors text-sm">✕</button>
  );
}

/* ─────────────────────────── main page ─────────────────────────── */
export default function SalesPlaybookPage() {
  const { activeOrgId: orgId } = useAuth();
  const [data, setData] = useState<PlaybookData>(defaults());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* simulator state */
  const [simPersonaId, setSimPersonaId] = useState(SIM_PERSONAS[0].id);
  const [simCustom, setSimCustom] = useState("");
  const [simPhase, setSimPhase] = useState<"setup" | "chat">("setup");
  const [simMessages, setSimMessages] = useState<{ role: string; content: string }[]>([]);
  const [simThinking, setSimThinking] = useState(false);
  const [simInput, setSimInput] = useState("");
  const [simError, setSimError] = useState("");
  const [simEvalResult, setSimEvalResult] = useState<null | {
    unconditionalDiscount: boolean; discountNote: string;
    scores: { listening: number; questioning: number; objection: number; closing: number };
    strengths: string[]; improvements: string[]; modelLine: string; schoolFit: string;
  }>(null);
  const [simEvalLoading, setSimEvalLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  /* load */
  useEffect(() => {
    if (!orgId) return;
    fetchPlaybook(orgId).then(d => {
      if (d) setData({ ...defaults(), ...d });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [orgId]);

  /* save with debounce */
  const scheduleSave = useCallback((d: PlaybookData) => {
    if (!orgId) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePlaybook(orgId, d).then(() => setSaveState("saved")).catch(() => setSaveState("error"));
    }, 600);
  }, [orgId]);

  function update(fn: (d: PlaybookData) => PlaybookData) {
    setData(prev => {
      const next = fn(JSON.parse(JSON.stringify(prev)));
      scheduleSave(next);
      return next;
    });
  }

  /* export / import */
  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "menu-sales-playbook.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const imported = { ...defaults(), ...JSON.parse(rd.result as string) };
        setData(imported); scheduleSave(imported);
      } catch { alert("ملف غير صالح."); }
    };
    rd.readAsText(f); e.target.value = "";
  }

  /* simulator */
  const simPersona = SIM_PERSONAS.find(p => p.id === simPersonaId) || SIM_PERSONAS[0];
  const simBrief = simPersonaId === "custom" ? (simCustom.trim() || "عميل مطاعم صعب يفاوض على السعر ويماطل.") : simPersona.brief;
  const simSys = `أنت تمثّل عميلاً (مالك منشأة مطاعم) في تدريب مبيعات. المستخدم مندوب مبيعات في MENU (نظام كاشير واشتراكات) يتدرّب معك.\nالشخصية: ${simBrief}\nقواعدك: ردّ فقط بصوت العميل بلهجة سعودية واقعية، من جملة إلى ثلاث جمل قصيرة. مارس الاعتراض والضغط المناسب لشخصيتك ولا تستسلم بسهولة، لكن كن واقعياً وأبرِم الصفقة إذا أقنعك المندوب فعلاً بالقيمة والمقايضة المشروطة وإغلاق واثق. لا تخرج عن الدور ولا تقدّم أي نصائح تدريبية.`;

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [simMessages, simThinking]);

  async function simSend() {
    if (!simInput.trim() || simThinking) return;
    const msg = simInput.trim();
    setSimInput("");
    setSimError("");
    const next = [...simMessages, { role: "user", content: msg }];
    setSimMessages(next);
    setSimThinking(true);
    try {
      const reply = await callClaude(next, simSys);
      setSimMessages([...next, { role: "assistant", content: reply }]);
    } catch { setSimError("تعذّر الاتصال بالذكاء الاصطناعي — تأكد من إعداد ANTHROPIC_API_KEY."); }
    setSimThinking(false);
  }

  async function simEval() {
    if (simMessages.length < 2 || simThinking) return;
    setSimEvalLoading(true); setSimError("");
    const transcript = simMessages.map(m => (m.role === "user" ? "المندوب: " : "العميل: ") + m.content).join("\n");
    const sys = METHODOLOGY + "\n\nأنت مدرّب مبيعات خبير. قيّم أداء المندوب من النص التالي. أعِد فقط JSON صالحاً دون أي نص أو علامات ماركداون، بهذا الشكل بالضبط:\n{\"unconditionalDiscount\": false, \"discountNote\": \"\", \"scores\": {\"listening\": 3, \"questioning\": 3, \"objection\": 3, \"closing\": 3}, \"strengths\": [\"\", \"\"], \"improvements\": [\"\", \"\"], \"modelLine\": \"\", \"schoolFit\": \"\"}\nكل النصوص بالعربية واللهجة السعودية. إذا منح المندوب خصماً دون شرط اجعل unconditionalDiscount=true. الدرجات من ١ إلى ٥.";
    try {
      const raw = await callClaude([{ role: "user", content: transcript }], sys);
      const clean = raw.replace(/```json/g, "").replace(/```/g, "").trim();
      setSimEvalResult(JSON.parse(clean));
    } catch { setSimError("تعذّر التقييم — تأكد من إعداد ANTHROPIC_API_KEY."); }
    setSimEvalLoading(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">جارٍ تحميل اللوحة…</div>;
  }

  const score = calcScore(data.training.scorecard.criteria);

  const saveLabel = saveState === "saving" ? "جارٍ الحفظ…" : saveState === "saved" ? "محفوظ ✓" : saveState === "error" ? "خطأ في الحفظ" : "جاهز";
  const saveDot = saveState === "saving" ? "#fbbf24" : saveState === "saved" ? "#22c55e" : saveState === "error" ? "#f87171" : "#cbd5e1";

  return (
    <div className="space-y-0 pb-16" dir="rtl">
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0E2A47,#153a63)" }} className="rounded-2xl p-6 mb-6 text-white">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-xs font-bold mb-3">منظومة قائمة الطلبات · MENU</span>
            <h1 className="text-2xl font-extrabold">لوحة المبيعات التفاعلية والدليل التشغيلي</h1>
            <p className="mt-1 text-sm text-blue-200">من الصفر إلى الاحتراف — قابل للتعديل بالكامل ليطابق سير عملياتكم.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl text-xs font-bold">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: saveDot }} />
              {saveLabel}
            </span>
            <button onClick={exportJson} className="bg-white/10 hover:bg-white/20 text-white border-none rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition-colors">تصدير JSON</button>
            <label className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition-colors">
              استيراد<input type="file" accept="application/json" className="hidden" onChange={importJson} />
            </label>
            <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 text-white border-none rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition-colors">طباعة / PDF</button>
            <button onClick={() => { if (confirm("سيتم استرجاع كل الأقسام إلى المحتوى الافتراضي. متأكد؟")) { const d = defaults(); setData(d); scheduleSave(d); } }} className="bg-white/10 hover:bg-white/20 text-white border-none rounded-xl px-3 py-2 text-xs font-bold cursor-pointer transition-colors">استرجاع الافتراضي</button>
          </div>
        </div>
      </div>

      {/* ── Section 1: Roles ── */}
      <section className="bg-card border-t border-border py-10">
        <div className="max-w-4xl mx-auto px-4">
          <SectionHeader num="١" title="الهيكل الإداري والأدوار" en="Governance & Roles" desc="من يملك القرار، من ينفّذ، ومن يطبّق. وضوح الأدوار يمنع تداخل المسؤوليات ويجعل المساءلة واضحة." />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.roles.map(r => (
              <Card key={r.id}>
                <span className="inline-block bg-blue-100 text-blue-700 rounded-full px-3 py-1 text-xs font-bold mb-3">{r.tag}</span>
                <input className="w-full bg-transparent border-none outline-none font-extrabold text-lg text-foreground mb-2 focus:bg-slate-50 focus:rounded-lg focus:px-2" value={r.title} onChange={e => update(d => { d.roles.find(x => x.id === r.id)!.title = e.target.value; return d; })} />
                <EditInput multiline rows={4} value={r.body} onChange={v => update(d => { d.roles.find(x => x.id === r.id)!.body = v; return d; })} />
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 2: Pipeline ── */}
      <section className="bg-background border-t border-border py-10">
        <div className="max-w-4xl mx-auto px-4">
          <SectionHeader num="٢" title="نظام قمع المبيعات المرن" en="Editable Sales Pipeline" desc="أربع مراحل متسلسلة. لكل مرحلة مهام مطلوبة ومخرجات متوقعة — عدّل أو أضف ما يناسب نظام الكاشير والاشتراكات لديكم." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.pipeline.map((st, i) => (
              <div key={st.id} className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
                <div className="flex gap-3 items-center px-4 py-3" style={{ background: "#0E2A47", color: "#fff" }}>
                  <span className="w-7 h-7 rounded-lg bg-white text-[#0E2A47] grid place-items-center font-extrabold text-sm">{i + 1}</span>
                  <div>
                    <div className="font-extrabold">{st.name}</div>
                    <div className="text-xs text-blue-200">{st.en}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 bg-slate-50 px-4 py-2 text-xs font-bold text-muted-foreground border-b border-border">
                  <div>المهمة المطلوبة</div><div>المخرَج المتوقّع</div>
                </div>
                {st.tasks.map(t => (
                  <div key={t.id} className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-border/50">
                    <EditInput multiline rows={2} value={t.task} onChange={v => update(d => { d.pipeline.find(s => s.id === st.id)!.tasks.find(x => x.id === t.id)!.task = v; return d; })} />
                    <div className="flex gap-1 items-start">
                      <EditInput multiline rows={2} value={t.output} onChange={v => update(d => { d.pipeline.find(s => s.id === st.id)!.tasks.find(x => x.id === t.id)!.output = v; return d; })} />
                      <DelBtn onClick={() => update(d => { d.pipeline.find(s => s.id === st.id)!.tasks = d.pipeline.find(s => s.id === st.id)!.tasks.filter(x => x.id !== t.id); return d; })} />
                    </div>
                  </div>
                ))}
                <div className="px-4 py-3">
                  <AddBtn label="إضافة مهمة" onClick={() => update(d => { d.pipeline.find(s => s.id === st.id)!.tasks.push({ id: uid(), task: "", output: "" }); return d; })} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Discovery ── */}
      <section className="bg-card border-t border-border py-10">
        <div className="max-w-4xl mx-auto px-4">
          <SectionHeader num="٣" title="دليل مكالمة الاكتشاف التشخيصي" en="Discovery Script" desc="نموذج «طبيب المبيعات»: لا تصف الدواء قبل التشخيص. المراحل والأسئلة كلها قابلة للتعديل بحسب ردود فعل السوق." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {data.discovery.phases.map(p => (
              <Card key={p.id} className="bg-slate-50">
                <input className="w-full bg-transparent border-none outline-none font-extrabold text-sm text-foreground mb-2 focus:bg-white focus:rounded-lg focus:px-2" value={p.title} onChange={e => update(d => { d.discovery.phases.find(x => x.id === p.id)!.title = e.target.value; return d; })} />
                <EditInput multiline rows={3} value={p.note} onChange={v => update(d => { d.discovery.phases.find(x => x.id === p.id)!.note = v; return d; })} />
              </Card>
            ))}
          </div>
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-5 rounded-full bg-blue-600 inline-block" />
              <h3 className="font-extrabold text-base">الأسئلة التشخيصية</h3>
            </div>
            {data.discovery.questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-[#0E2A47] text-white grid place-items-center font-extrabold text-sm">{i + 1}</span>
                <EditInput value={q.text} onChange={v => update(d => { d.discovery.questions.find(x => x.id === q.id)!.text = v; return d; })} />
                <DelBtn onClick={() => update(d => { d.discovery.questions = d.discovery.questions.filter(x => x.id !== q.id); return d; })} />
              </div>
            ))}
            <div className="mt-4">
              <AddBtn label="إضافة سؤال تشخيصي" onClick={() => update(d => { d.discovery.questions.push({ id: uid(), text: "" }); return d; })} />
            </div>
          </Card>
        </div>
      </section>

      {/* ── Section 4: Training ── */}
      <section className="bg-background border-t border-border py-10">
        <div className="max-w-4xl mx-auto px-4">
          <SectionHeader num="٤" title="مركز التدريب وحاسبة التقييم" en="Training Hub & Scorecard" desc="جدولة جلسات المحاكاة الأسبوعية بقيادة المختص المساعد، مع استمارة تقييم رقمية تحسب النتيجة تلقائياً." />
          {/* Schedule */}
          <div className="overflow-x-auto border border-border rounded-2xl bg-card shadow-sm mb-8">
            <table className="w-full min-w-[700px] border-collapse text-right text-sm">
              <thead><tr className="bg-slate-50">
                {["اليوم","الوقت","السيناريو / الموضوع","قائد الجلسة","المشاركون","الحالة",""].map(h => <th key={h} className="px-3 py-2 text-xs font-bold text-muted-foreground">{h}</th>)}
              </tr></thead>
              <tbody>
                {data.training.schedule.map(r => (
                  <tr key={r.id} className="border-t border-border/50">
                    {(["day","time","topic","lead","who"] as const).map(f => (
                      <td key={f} className="p-1.5"><EditInput value={r[f]} onChange={v => update(d => { d.training.schedule.find(x => x.id === r.id)![f] = v; return d; })} /></td>
                    ))}
                    <td className="p-1.5">
                      <select className="w-full bg-background border border-border rounded-xl px-2 py-2 text-sm outline-none" value={r.status} onChange={e => update(d => { d.training.schedule.find(x => x.id === r.id)!.status = e.target.value; return d; })}>
                        {["مجدولة","تمت","مؤجلة","ملغاة"].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="p-1.5"><DelBtn onClick={() => update(d => { d.training.schedule = d.training.schedule.filter(x => x.id !== r.id); return d; })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-border/50 px-4 py-3">
              <AddBtn label="إضافة جلسة" onClick={() => update(d => { d.training.schedule.push({ id: uid(), day: "", time: "", topic: "", lead: "المختص المساعد", who: "", status: "مجدولة" }); return d; })} />
            </div>
          </div>

          {/* Scorecard */}
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <span className="w-1.5 h-5 rounded-full bg-blue-600 inline-block" />
              <h3 className="font-extrabold text-base">استمارة تقييم وملاحظات الكوتشينج</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {(["employee","date","evaluator"] as const).map((f, i) => (
                <div key={f}>
                  <span className="block text-xs font-bold text-muted-foreground mb-1">{["اسم الموظف","التاريخ","المقيّم"][i]}</span>
                  <EditInput value={data.training.scorecard[f] as string} onChange={v => update(d => { (d.training.scorecard as unknown as Record<string, string>)[f] = v; return d; })} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
              <div>
                {data.training.scorecard.criteria.map(c => (
                  <div key={c.id} className="flex flex-wrap gap-2 items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-2.5 mb-2">
                    <input className="flex-1 min-w-[160px] bg-transparent border-none outline-none font-semibold text-sm text-foreground" value={c.label} onChange={e => update(d => { d.training.scorecard.criteria.find(x => x.id === c.id)!.label = e.target.value; return d; })} />
                    <div className="flex gap-1.5 items-center">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} className={`w-9 h-9 rounded-xl border text-sm font-bold transition-colors ${c.score >= n ? "bg-[#0E2A47] text-white border-[#0E2A47]" : "bg-white text-muted-foreground border-border"}`} onClick={() => update(d => { d.training.scorecard.criteria.find(x => x.id === c.id)!.score = n; return d; })}>{n}</button>
                      ))}
                      <DelBtn onClick={() => update(d => { d.training.scorecard.criteria = d.training.scorecard.criteria.filter(x => x.id !== c.id); return d; })} />
                    </div>
                  </div>
                ))}
                <div className="mt-3">
                  <AddBtn label="إضافة معيار" onClick={() => update(d => { d.training.scorecard.criteria.push({ id: uid(), label: "معيار جديد", score: 3 }); return d; })} />
                </div>
              </div>
              <div className="rounded-2xl text-white p-5 text-center" style={{ background: "#0E2A47" }}>
                <div className="text-xs font-bold text-blue-200">النتيجة الإجمالية</div>
                <div className="text-4xl font-extrabold mt-1">{score.sum}<span className="text-lg text-blue-300"> / {score.max}</span></div>
                <div className="text-sm text-blue-200 mt-1">{score.pct}%</div>
                <div className="mt-3">
                  <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: score.color + "33", color: score.color }}>{score.rating}</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 mt-4 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all" style={{ width: `${score.pct}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-5">
              <span className="block text-xs font-bold text-muted-foreground mb-1">ملاحظات المدرّب (نقاط القوة + خطوة تطوير واحدة)</span>
              <EditInput multiline rows={3} value={data.training.scorecard.notes} onChange={v => update(d => { d.training.scorecard.notes = v; return d; })} />
            </div>
          </Card>
        </div>
      </section>

      {/* ── Section 5: KPIs ── */}
      <section className="bg-card border-t border-border py-10">
        <div className="max-w-4xl mx-auto px-4">
          <SectionHeader num="٥" title="مؤشرات الأداء القائمة على المعطيات" en="Data-Driven KPIs" desc="نوعان من المؤشرات: أنشطة يقودها المساعد (Leading)، ونتائج يقيسها القائد (Lagging)." />
          {(["leading","lagging"] as const).map(group => (
            <div key={group} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${group === "leading" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-[#0E2A47]"}`}>{group === "leading" ? "Leading — يقودها المساعد ويطبّقها الفريق" : "Lagging — يقيسها القائد"}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.kpis[group].map(k => {
                  const { pct, color } = calcKpi(k);
                  return (
                    <Card key={k.id}>
                      <div className="flex gap-1 items-start mb-3">
                        <EditInput multiline rows={2} value={k.label} onChange={v => update(d => { d.kpis[group].find(x => x.id === k.id)!.label = v; return d; })} />
                        <DelBtn onClick={() => update(d => { d.kpis[group] = d.kpis[group].filter(x => x.id !== k.id); return d; })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {(["target","actual"] as const).map((f, i) => (
                          <div key={f}>
                            <span className="block text-xs font-bold text-muted-foreground mb-1">{["المستهدف","الفعلي"][i]}</span>
                            <div className="flex items-center gap-1">
                              <input type="number" className="w-full bg-background border border-border rounded-xl px-2 py-2 text-sm text-center outline-none focus:border-blue-500" value={k[f]} onChange={e => update(d => { (d.kpis[group].find(x => x.id === k.id) as Record<string, number | boolean | string>)[f] = +e.target.value; return d; })} />
                              <span className="text-xs text-muted-foreground flex-shrink-0">{k.unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-bold" style={{ color }}>{pct}%</span>
                          {k.lower && <span className="text-muted-foreground">الأقل أفضل</span>}
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <div className="mt-3">
                <AddBtn label="إضافة مؤشر" onClick={() => update(d => { d.kpis[group].push({ id: uid(), label: "مؤشر جديد", target: 100, actual: 0, unit: "%", lower: false }); return d; })} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 6: Negotiation ── */}
      <section className="bg-background border-t border-border py-10">
        <div className="max-w-4xl mx-auto px-4">
          <SectionHeader num="٦" title="مدرسة التفاوض والإغلاق المتقدم" en="Advanced Negotiation & Closing" desc="محاكاة واقعية لأبرز مدارس المبيعات — مرجع قابل للتعديل + محاكي تدريب ذكي." />

          {/* Mistake wrong/right */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-5 rounded-full bg-blue-600 inline-block" />
              <h3 className="font-extrabold text-base">الخطأ الأخطر: الخصم المجاني الفوري (Instant Give)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <span className="inline-block bg-red-100 text-red-700 rounded-full px-3 py-1 text-xs font-bold mb-3">✗ الرد الخاطئ</span>
                <EditInput multiline rows={4} value={data.negotiation.mistakeWrong} onChange={v => update(d => { d.negotiation.mistakeWrong = v; return d; })} />
              </div>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <span className="inline-block bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-bold mb-3">✓ الرد الصحيح (صياغة الإغلاق)</span>
                <EditInput multiline rows={5} value={data.negotiation.mistakeRight} onChange={v => update(d => { d.negotiation.mistakeRight = v; return d; })} />
              </div>
            </div>
          </div>

          {/* Tactics */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-1.5 h-5 rounded-full bg-blue-600 inline-block" />
              <h3 className="font-extrabold text-base">تكتيكات التفاوض</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.negotiation.tactics.map(t => (
                <Card key={t.id}>
                  <div className="flex gap-1 items-start mb-2">
                    <div className="flex-1">
                      <input className="w-full bg-transparent border-none outline-none font-extrabold text-sm text-foreground mb-1 focus:bg-slate-50 focus:rounded" value={t.name} onChange={e => update(d => { d.negotiation.tactics.find(x => x.id === t.id)!.name = e.target.value; return d; })} />
                      <input className="w-full bg-transparent border-none outline-none text-xs text-muted-foreground font-semibold focus:bg-slate-50 focus:rounded" value={t.en} onChange={e => update(d => { d.negotiation.tactics.find(x => x.id === t.id)!.en = e.target.value; return d; })} />
                    </div>
                    <DelBtn onClick={() => update(d => { d.negotiation.tactics = d.negotiation.tactics.filter(x => x.id !== t.id); return d; })} />
                  </div>
                  <EditInput multiline rows={4} value={t.body} onChange={v => update(d => { d.negotiation.tactics.find(x => x.id === t.id)!.body = v; return d; })} />
                </Card>
              ))}
            </div>
            <div className="mt-3">
              <AddBtn label="إضافة تكتيك" onClick={() => update(d => { d.negotiation.tactics.push({ id: uid(), name: "تكتيك جديد", en: "", body: "" }); return d; })} />
            </div>
          </div>

          {/* Channels + Schools */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-5 rounded-full bg-blue-600 inline-block" />
                <h3 className="font-extrabold text-base">الفروق بين القنوات</h3>
              </div>
              <div className="space-y-3">
                {data.negotiation.channels.map(c => (
                  <Card key={c.id}>
                    <input className="w-full bg-transparent border-none outline-none font-extrabold text-sm text-foreground mb-2 focus:bg-slate-50 focus:rounded" value={c.name} onChange={e => update(d => { d.negotiation.channels.find(x => x.id === c.id)!.name = e.target.value; return d; })} />
                    <EditInput multiline rows={3} value={c.body} onChange={v => update(d => { d.negotiation.channels.find(x => x.id === c.id)!.body = v; return d; })} />
                  </Card>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-5 rounded-full bg-blue-600 inline-block" />
                <h3 className="font-extrabold text-base">مقارنة مدارس العمالقة</h3>
              </div>
              <div className="space-y-3">
                {data.negotiation.schools.map(s => (
                  <Card key={s.id} className="bg-slate-50">
                    <input className="w-full bg-transparent border-none outline-none font-extrabold text-sm text-[#0E2A47] mb-2 focus:bg-white focus:rounded" value={s.name} onChange={e => update(d => { d.negotiation.schools.find(x => x.id === s.id)!.name = e.target.value; return d; })} />
                    <EditInput multiline rows={3} value={s.body} onChange={v => update(d => { d.negotiation.schools.find(x => x.id === s.id)!.body = v; return d; })} />
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* ── AI Simulator ── */}
          <div className="border-2 border-indigo-200 rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-blue-600 text-white grid place-items-center text-base">🤖</span>
                <h3 className="font-extrabold text-base">محاكي التفاوض الذكي</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">يلعب النموذج دور العميل الصعب بلهجة سعودية، ثم يقيّم أداء المندوب حسب المنهجية وينبّه لو مُنح خصم بلا شرط.</p>

            {simPhase === "setup" ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {SIM_PERSONAS.map(p => (
                    <button key={p.id} onClick={() => setSimPersonaId(p.id)} className={`border rounded-xl p-3.5 text-right cursor-pointer transition-all ${simPersonaId === p.id ? "border-blue-500 bg-blue-50" : "border-border bg-white hover:border-blue-300"}`}>
                      <span className="block font-extrabold text-sm text-foreground">{p.label}</span>
                      <span className="block mt-1 text-xs leading-relaxed text-muted-foreground">{p.brief}</span>
                    </button>
                  ))}
                </div>
                {simPersonaId === "custom" && (
                  <EditInput multiline rows={2} placeholder="مثال: مالك عربة قهوة متردد، ميزانيته محدودة ويخاف من الالتزام السنوي…" value={simCustom} onChange={setSimCustom} className="mb-4" />
                )}
                <button onClick={() => { setSimPhase("chat"); setSimMessages([]); setSimEvalResult(null); }} className="bg-[#0E2A47] text-white border-none rounded-xl px-5 py-2.5 font-bold text-sm cursor-pointer hover:bg-[#153a63] transition-colors">ابدأ التدريب ▸</button>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center text-xs mb-3">
                  <span className="bg-blue-100 text-blue-700 rounded-full px-3 py-1 font-bold">{simPersona.label}</span>
                  <span className="text-muted-foreground">أنت المندوب — ابدأ بفتح الحوار</span>
                </div>
                <div ref={chatRef} className="h-72 overflow-y-auto border border-border bg-slate-50 rounded-xl p-4 mb-3">
                  {simMessages.length === 0 && <p className="text-center text-muted-foreground text-sm mt-14">اكتب رسالة الترحيب وافتح الحوار مع العميل…</p>}
                  {simMessages.map((m, i) => (
                    <div key={i} className={`flex mb-2.5 ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${m.role === "user" ? "bg-blue-600 text-white" : "bg-white border border-border"}`}>
                        <div className="text-xs font-bold opacity-70 mb-0.5">{m.role === "user" ? "المندوب (أنت)" : "العميل"}</div>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {simThinking && (
                    <div className="flex justify-end">
                      <div className="bg-white border border-border rounded-2xl px-3.5 py-2 text-sm text-muted-foreground">العميل يكتب…</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    className="flex-1 bg-white border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                    value={simInput}
                    placeholder="اكتب ردّك كمندوب…"
                    onChange={e => setSimInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); simSend(); } }}
                  />
                  <button onClick={simSend} disabled={simThinking} className="bg-blue-600 text-white border-none rounded-xl px-4 py-2 font-bold text-sm cursor-pointer disabled:opacity-40 hover:bg-blue-700 transition-colors">إرسال</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={simEval} disabled={simMessages.length < 2 || simThinking || simEvalLoading} className="bg-[#0E2A47] text-white border-none rounded-xl px-4 py-2 font-bold text-sm cursor-pointer disabled:opacity-40 hover:bg-[#153a63] transition-colors">
                    {simEvalLoading ? "يُقيّم الجولة…" : "قيّم الجولة"}
                  </button>
                  <button onClick={() => { setSimPhase("setup"); setSimMessages([]); setSimEvalResult(null); setSimError(""); }} className="bg-white border border-border text-foreground rounded-xl px-4 py-2 font-bold text-sm cursor-pointer hover:bg-slate-50 transition-colors">إعادة تعيين</button>
                </div>
                {simError && <p className="text-red-500 text-sm mt-2">{simError}</p>}

                {simEvalResult && (
                  <div className="mt-4 border border-border rounded-2xl bg-white p-4">
                    <h4 className="font-extrabold text-sm mb-4">تقييم الجولة</h4>
                    {simEvalResult.unconditionalDiscount && (
                      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm leading-relaxed mb-4">
                        <span className="font-bold">⚠ تنبيه — خصم بلا شرط: </span>{simEvalResult.discountNote}
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-3 mb-5">
                      {(["listening","questioning","objection","closing"] as const).map((k, i) => (
                        <div key={k} className="bg-slate-50 rounded-xl p-3 text-center">
                          <div className="text-2xl font-extrabold text-[#0E2A47]">{simEvalResult.scores[k]}<span className="text-sm text-muted-foreground"> /٥</span></div>
                          <div className="text-xs font-semibold text-muted-foreground mt-1">{["الإنصات","الأسئلة","الاعتراضات","الإغلاق"][i]}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h5 className="text-sm font-extrabold text-green-700 mb-2">نقاط القوة</h5>
                        <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1">{simEvalResult.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                      <div>
                        <h5 className="text-sm font-extrabold text-amber-700 mb-2">فرص التطوير</h5>
                        <ul className="list-disc list-inside text-sm text-muted-foreground leading-relaxed space-y-1">{simEvalResult.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                    </div>
                    {simEvalResult.modelLine && (
                      <div className="bg-blue-50 border-r-4 border-blue-600 rounded-xl p-3 text-sm leading-relaxed mb-3">
                        <span className="font-bold">جملة إغلاق نموذجية: </span>{simEvalResult.modelLine}
                      </div>
                    )}
                    {simEvalResult.schoolFit && (
                      <p className="text-sm text-muted-foreground leading-relaxed"><span className="font-bold">المدرسة الأنسب: </span>{simEvalResult.schoolFit}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
