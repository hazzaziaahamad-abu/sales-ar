// «الخطة المبسطة» للصالونات والخدمات المنزلية: نموذج العمل، تشخيص خفيف بخمس محاور،
// حاسبة التسعير من التكلفة الحقيقية، قائمة الخدمات، توصيات الجلسة، خطة شهرية تنبني من الفجوات، و٦ مؤشرات.
// صفحة مستقلة (/offer/salon-simple) للسوبر أدمن ومن صفحتها مفعّلة في دوره — تُحفظ في salon_growth_settings بالمفتاح «simple»
// عبر /api/salon-simple، ومستبعدة من بيانات «الخطة التسويقية» الشاملة.

export type BizModel = "salon" | "home_visit" | "home_studio";
export type ServiceKind = "core" | "entry" | "addon" | "package";
export type AxisId = "services" | "pricing" | "clients" | "social" | "ops";

export type SimpleService = {
  id: string; name: string; kind: ServiceKind;
  minutes: number | null; materials: number | null; price: number | null; per_month: number | null;
};

export type Costs = {
  rent: number | null; salaries: number | null; other: number | null;
  hours_month: number | null; utilization: number | null;
  travel_cost: number | null; travel_minutes: number | null;
  commission_pct: number | null; margin_pct: number | null; vat: boolean;
};

export type SimpleKpiKey = "revenue" | "clients" | "return_pct" | "avg_ticket" | "margin_pct" | "cpa";

/** شهر في الخطة: إجراءات مختارة بالأولوية + مراجعة نهاية الشهر (الأرقام والملاحظات). */
export type MonthPlan = {
  id: string; month: string; focus: string;
  actions: string[]; done: Record<string, boolean>; carried: string[];
  numbers: Partial<Record<SimpleKpiKey, number | null>>; notes: string; closed_at: string | null;
};

export type Session = { date: string; attendees: string; notes: string; done_at: string | null };

export type Simple = {
  name: string;
  model: BizModel | null;
  session: Session;
  checks: Record<string, boolean>;
  nums: Record<string, number | null>;
  costs: Costs;
  services: SimpleService[];
  /** أرقام «قبل» من الجلسة. */
  baseline: Partial<Record<SimpleKpiKey, number | null>>;
  months: MonthPlan[];
};

export const DEFAULT_COSTS: Costs = {
  rent: null, salaries: null, other: null, hours_month: null, utilization: 60,
  travel_cost: null, travel_minutes: null, commission_pct: 0, margin_pct: 40, vat: false,
};
export const DEFAULT_SESSION: Session = { date: "", attendees: "", notes: "", done_at: null };
export const DEFAULT_SIMPLE: Simple = {
  name: "", model: null, session: DEFAULT_SESSION, checks: {}, nums: {}, costs: DEFAULT_COSTS, services: [], baseline: {}, months: [],
};

export const MODELS: { id: BizModel; label: string; desc: string; risk: string }[] = [
  { id: "salon", label: "صالون (محل)", desc: "محل مرخّص وفريق خبيرات", risk: "التكاليف الثابتة تاكل الربح وقت الركود" },
  { id: "home_visit", label: "خدمة منزلية بالزيارة", desc: "الخبيرة تروح لبيت العميلة", risk: "وقت الطريق والمواصلات ما تنحسب في السعر" },
  { id: "home_studio", label: "استقبال في البيت", desc: "العميلة تجي لمكان مجهّز في بيت الخبيرة", risk: "الثقة والنظام، والدخل مربوط بساعاتها" },
];
export const modelOf = (id: string | null) => MODELS.find((m) => m.id === id) ?? null;
const HOME: BizModel[] = ["home_visit", "home_studio"];

export const SERVICE_KINDS: { id: ServiceKind; label: string; color: string; hint: string }[] = [
  { id: "core", label: "أساسية", color: "#581845", hint: "الخدمات اللي يقوم عليها الدخل" },
  { id: "entry", label: "خدمة دخول", color: "#2563EB", hint: "سعر مغري يجيب العميلة أول مرة (مثل تجربة أول زيارة)" },
  { id: "addon", label: "إضافة", color: "#D4AF37", hint: "١٠–٢٠ دقيقة ترفع الفاتورة (حمام زيت، قناع، رسم حواجب)" },
  { id: "package", label: "باقة", color: "#16A34A", hint: "تضمن رجوع العميلة (باقة شهرية، باقة عروس، رصيد مسبق)" },
];
export const serviceKind = (id: string) => SERVICE_KINDS.find((k) => k.id === id) ?? SERVICE_KINDS[0];

export const SERVICE_IDEAS: Record<BizModel, Record<Exclude<ServiceKind, "core">, string[]>> = {
  salon: {
    entry: ["تجربة أول زيارة: سشوار + استشارة شعر", "تنظيف بشرة سريع ٣٠ دقيقة"],
    addon: ["حمام زيت مغذّي", "قناع كولاجين", "رسم حواجب", "بديكير سريع"],
    package: ["باقة شهرية (٤ سشوار + بديكير)", "باقة العروس والمعازيم", "رصيد مسبق بقيمة إضافية ١٠٪"],
  },
  home_visit: {
    entry: ["زيارة تعارف: خدمة سريعة + استشارة (حد أدنى للطلب)"],
    addon: ["خدمة لشخص ثاني في نفس الزيارة", "قناع أو حمام زيت مع الخدمة", "رسم حواجب"],
    package: ["باقة البيت: زيارة شهرية لأكثر من خدمة", "باقة المناسبات (العروس + أهلها)", "باقة الأم وبناتها"],
  },
  home_studio: {
    entry: ["تجربة أول زيارة بموعد محدد وقت الفراغ"],
    addon: ["حمام زيت", "رسم حواجب", "قناع للوجه"],
    package: ["باقة شهرية بمواعيد ثابتة", "رصيد مسبق", "باقة المناسبات"],
  },
};

/* ─── التشخيص: أسئلة نعم/لا + أرقام، وكل فحص يقود لإجراء في الخطة ─── */

export const AXES: { id: AxisId; title: string; lead: string }[] = [
  { id: "services", title: "الخدمات", lead: "قائمة مصمّمة: أساسية + دخول + إضافات + باقة" },
  { id: "pricing", title: "التسعير والتكاليف", lead: "كل سعر فوق تكلفته الحقيقية بهامش واضح" },
  { id: "clients", title: "العميلات والعودة", lead: "العميلة ترجع — هنا الربح الحقيقي" },
  { id: "social", title: "السوشال والتواجد", lead: "الحساب هو الواجهة — خصوصاً للمنزلي" },
  { id: "ops", title: "التشغيل والثقة", lead: "حجز منظم، عربون، ونظام يحمي النشاط" },
];

export type Question = { id: string; axis: AxisId; text: string; models?: BizModel[] };
export const QUESTIONS: Question[] = [
  { id: "s_list", axis: "services", text: "فيه قائمة خدمات مكتوبة بالأسعار (ترسلينها للعميلة أو في البايو)" },
  { id: "s_focus", axis: "services", text: "تعرفين أكثر ٥ خدمات تجيب دخل، وتركّزين عليها" },
  { id: "p_discount", axis: "pricing", text: "ما تعتمدين على خصومات كبيرة (٣٠٪ أو أكثر) لجلب العميلات" },
  { id: "p_offpeak", axis: "pricing", text: "عروض أو أسعار مختلفة لأوقات الفراغ", models: ["salon", "home_studio"] },
  { id: "p_visit_fee", axis: "pricing", text: "رسوم زيارة أو حد أدنى للطلب", models: ["home_visit"] },
  { id: "c_list", axis: "clients", text: "سجل للعميلات: الاسم، الجوال، آخر زيارة" },
  { id: "c_followup", axis: "clients", text: "تواصل بعد الزيارة وتذكير بالموعد الجاي" },
  { id: "c_reviews", axis: "clients", text: "تطلبين تقييم أو رأي بعد كل خدمة" },
  { id: "so_link", axis: "social", text: "رابط حجز أو واتساب في البايو" },
  { id: "so_google", axis: "social", text: "ملف نشاط في قوقل (للمنزلي: منطقة خدمة بدون عنوان معلن)" },
  { id: "so_identity", axis: "social", text: "الحساب له هوية واضحة ومحتوى يمثّل شغلك الحقيقي" },
  { id: "so_measure", axis: "social", text: "لو تعلنين: تعرفين كم عميلة جت من كل إعلان" },
  { id: "o_license", axis: "ops", text: "الترخيص النظامي (بلدي / سجل تجاري أو وثيقة عمل حر) والشهادات الصحية" },
  { id: "o_deposit", axis: "ops", text: "عربون أو سياسة إلغاء واضحة" },
  { id: "o_booking", axis: "ops", text: "حجز منظم (رابط أو تقويم) بدل رسائل متفرقة" },
  { id: "o_standard", axis: "ops", text: "معيار خدمة موحّد للخبيرات (خطوات ووقت)", models: ["salon"] },
  { id: "o_zone", axis: "ops", text: "نطاق خدمة محدد (أحياء أو مسافة)", models: ["home_visit"] },
  { id: "o_kit", axis: "ops", text: "عدة جاهزة ومرتبة لكل خدمة", models: ["home_visit"] },
  { id: "o_hygiene", axis: "ops", text: "التعقيم ظاهر للعميلة (أدوات مغلّفة، صور، شرح)", models: HOME },
];

export const NUMS: { id: string; axis: AxisId; label: string; unit: string; good: string }[] = [
  { id: "return_pct", axis: "clients", label: "كم ٪ من العميلات يرجعن خلال شهرين؟", unit: "٪", good: "٥٠٪ أو أكثر" },
  { id: "posts_week", axis: "social", label: "منشورات بالأسبوع (كل المنصات)", unit: "منشور", good: "٣ أو أكثر" },
  { id: "dm_minutes", axis: "social", label: "وقت الرد على الرسائل", unit: "دقيقة", good: "ساعة أو أقل" },
  { id: "google_rating", axis: "social", label: "تقييم قوقل", unit: "من ٥", good: "٤٫٥ أو أكثر" },
];

export const questionsFor = (model: BizModel | null) => QUESTIONS.filter((q) => !q.models || (model && q.models.includes(model)));

/* ─── التسعير ─── */

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function costBase(c: Costs) {
  const fixed = n(c.rent) + n(c.salaries) + n(c.other);
  const effHours = n(c.hours_month) * (n(c.utilization || 60) / 100);
  const perHour = fixed > 0 && effHours > 0 ? fixed / effHours : null;
  return { fixed, effHours, perHour };
}

export type ServicePrice = {
  cost: number | null; min: number | null; suggested: number | null; withVat: number | null;
  profit: number | null; status: "ok" | "low" | "loss" | null;
};

/** التكلفة = المواد + الوقت × تكلفة الساعة (+ المواصلات ووقت الطريق للزيارة)؛ الأدنى = التكلفة ÷ (١ − الهامش − العمولة). */
export function pricing(s: SimpleService, c: Costs, model: BizModel | null): ServicePrice {
  const { perHour } = costBase(c);
  const empty: ServicePrice = { cost: null, min: null, suggested: null, withVat: null, profit: null, status: null };
  if (perHour === null || !s.minutes) return empty;
  const travel = model === "home_visit" ? n(c.travel_cost) + (n(c.travel_minutes) / 60) * perHour : 0;
  const cost = n(s.materials) + (s.minutes / 60) * perHour + travel;
  const commission = n(c.commission_pct) / 100;
  const denom = 1 - n(c.margin_pct) / 100 - commission;
  if (denom <= 0.05) return { ...empty, cost };
  const min = cost / denom;
  const suggested = Math.ceil(min / 5) * 5;
  const withVat = c.vat ? Math.ceil((suggested * 1.15) / 5) * 5 : null;
  if (s.price === null || s.price <= 0) return { cost, min, suggested, withVat, profit: null, status: null };
  const profit = s.price * (1 - commission) - cost;
  const status = s.price >= min - 0.5 ? "ok" : profit >= 0 ? "low" : "loss";
  return { cost, min, suggested, withVat, profit, status };
}

/** تقدير الشهر من قائمة الخدمات: الدخل، والربح بعد المواد والمواصلات والعمولة والمصاريف الثابتة. */
export function monthEstimate(services: SimpleService[], c: Costs, model: BizModel | null) {
  const { fixed } = costBase(c);
  const commission = n(c.commission_pct) / 100;
  let revenue = 0, variable = 0, visits = 0;
  for (const s of services) {
    const q = n(s.per_month);
    if (!q || !s.price) continue;
    revenue += s.price * q;
    variable += (n(s.materials) + (model === "home_visit" ? n(c.travel_cost) : 0) + s.price * commission) * q;
    visits += q;
  }
  const contribution = revenue - variable;
  const profit = revenue ? contribution - fixed : null;
  const avgContribution = visits ? contribution / visits : null;
  return {
    revenue, visits, fixed, profit,
    margin: revenue && profit !== null ? profit / revenue : null,
    breakEven: avgContribution && avgContribution > 0 ? Math.ceil(fixed / avgContribution) : null,
  };
}

/* ─── نتيجة كل محور ─── */

export type CheckResult = { id: string; axis: AxisId; label: string; pass: boolean | null };

export function evaluate(s: Simple): CheckResult[] {
  const out: CheckResult[] = [];
  for (const q of questionsFor(s.model)) out.push({ id: q.id, axis: q.axis, label: q.text, pass: q.id in s.checks ? s.checks[q.id] : null });
  const has = (k: ServiceKind, min = 1) => s.services.filter((x) => x.kind === k && x.name.trim()).length >= min;
  const named = s.services.filter((x) => x.name.trim());
  out.push(
    { id: "d_entry", axis: "services", label: "خدمة دخول تجيب العميلة أول مرة", pass: named.length ? has("entry") : null },
    { id: "d_addon", axis: "services", label: "إضافتين أو أكثر ترفع الفاتورة", pass: named.length ? has("addon", 2) : null },
    { id: "d_package", axis: "services", label: "باقة تضمن رجوع العميلة", pass: named.length ? has("package") : null },
  );
  const { perHour, fixed } = costBase(s.costs);
  const costsTouched = fixed > 0 || n(s.costs.hours_month) > 0;
  out.push({ id: "d_costs", axis: "pricing", label: "التكاليف الشهرية وساعات العمل محسوبة", pass: perHour !== null ? true : costsTouched ? false : null });
  const priced = named.map((x) => pricing(x, s.costs, s.model)).filter((p) => p.status !== null);
  out.push({ id: "d_prices", axis: "pricing", label: "كل الأسعار فوق السعر الأدنى", pass: priced.length ? priced.every((p) => p.status === "ok") : null });
  const num = (k: string) => (typeof s.nums[k] === "number" ? s.nums[k]! : null);
  const rp = num("return_pct"), pw = num("posts_week"), dm = num("dm_minutes"), gr = num("google_rating");
  out.push(
    { id: "d_return", axis: "clients", label: "نصف العميلات أو أكثر يرجعن خلال شهرين", pass: rp === null ? null : rp >= 50 },
    { id: "d_posts", axis: "social", label: "نشر ٣ مرات بالأسبوع أو أكثر", pass: pw === null ? null : pw >= 3 },
    { id: "d_dm", axis: "social", label: "الرد على الرسائل خلال ساعة", pass: dm === null ? null : dm <= 60 },
    { id: "d_rating", axis: "social", label: "تقييم قوقل ٤٫٥ أو أكثر", pass: gr === null ? null : gr >= 4.5 },
  );
  return out;
}

export function axisScore(results: CheckResult[], axis: AxisId) {
  const rs = results.filter((r) => r.axis === axis);
  const known = rs.filter((r) => r.pass !== null);
  return { total: rs.length, known: known.length, passed: known.filter((r) => r.pass).length, score: known.length ? known.filter((r) => r.pass).length / known.length : null };
}

/* ─── الخطة الشهرية: كل فحص ما نجح يضيف إجراء، والشهر ياخذ أعلاها أولوية ─── */

export type Action = { id: string; phase: 1 | 2 | 3; axis: AxisId; check: string; title: string; how: string };

/** المراحل للترتيب والتصنيف فقط (مو مدد زمنية): الأساس قبل الفاتورة، والفاتورة قبل الاستقطاب. */
export const PHASES: { id: 1 | 2 | 3; title: string; goal: string }[] = [
  { id: 1, title: "الأساس", goal: "نوقف الخسارة: أسعار فوق التكلفة، حجز منظم، وواجهة تثق فيها العميلة" },
  { id: 2, title: "الفاتورة والعودة", goal: "نرفع الفاتورة ونرجّع العميلة: إضافات، باقة، ومتابعة بعد الزيارة" },
  { id: 3, title: "الاستقطاب", goal: "نجيب عميلات جدد بمحتوى منتظم وحملة صغيرة تنقاس" },
];

export const ACTIONS: Action[] = [
  { id: "a_costs", phase: 1, axis: "pricing", check: "d_costs", title: "احسبي تكاليفك الشهرية وساعات العمل", how: "الإيجار + الرواتب (ومنها راتبك أنتِ) + الباقي، وكم ساعة تشتغلون فعلاً — منها تطلع تكلفة الساعة." },
  { id: "a_prices", phase: 1, axis: "pricing", check: "d_prices", title: "صحّحي الأسعار اللي تحت السعر الأدنى", how: "ابدئي بالخدمات الخاسرة، وارفعي على مرحلتين لو الفرق كبير. العميلة اللي تجي عشان الأرخص ما تبني نشاط." },
  { id: "a_visit_fee", phase: 1, axis: "pricing", check: "p_visit_fee", title: "رسوم زيارة أو حد أدنى للطلب", how: "مثال: حد أدنى للطلب، أو رسوم مواصلات حسب الحي — تحمي وقت الطريق." },
  { id: "a_discount", phase: 2, axis: "pricing", check: "p_discount", title: "استبدلي الخصم الكبير بقيمة مضافة", how: "بدل «٣٠٪ خصم»: إضافة مجانية أو تجربة أول زيارة — نفس الجذب بدون ما تهدمين السعر." },
  { id: "a_offpeak", phase: 2, axis: "pricing", check: "p_offpeak", title: "عرض لأوقات الفراغ", how: "سعر أو إضافة خاصة بالأيام والساعات الهادية — يملي الوقت الضايع بدون ما يمس أسعار الذروة." },
  { id: "a_list", phase: 1, axis: "services", check: "s_list", title: "قائمة خدمات مكتوبة بالأسعار", how: "صورة أو PDF مرتب في البايو والواتساب — العميلة تقرر أسرع لما تشوف السعر." },
  { id: "a_focus", phase: 1, axis: "services", check: "s_focus", title: "حددي أكثر ٥ خدمات تجيب دخل", how: "سجّلي عدد كل خدمة بالشهر في «التسعير والخدمات» — التركيز عليها في المحتوى والعروض." },
  { id: "a_entry", phase: 2, axis: "services", check: "d_entry", title: "صممي خدمة دخول", how: "خدمة قصيرة بسعر مغري تعرّف العميلة عليك — وبعدها تقترحين الأساسية." },
  { id: "a_addon", phase: 2, axis: "services", check: "d_addon", title: "أضيفي ٢–٣ إضافات للفاتورة", how: "خدمات ١٠–٢٠ دقيقة تنعرض قبل البدء: «بشرتك محتاجة قناع ١٥ دقيقة؟»." },
  { id: "a_package", phase: 2, axis: "services", check: "d_package", title: "أطلقي باقة تضمن الرجوع", how: "باقة شهرية أو رصيد مسبق — الدفع المقدّم يضمن الزيارة الجاية." },
  { id: "a_clients", phase: 1, axis: "clients", check: "c_list", title: "ابدئي سجل العميلات", how: "الاسم، الجوال، الخدمة، تاريخ آخر زيارة — حتى لو في ملف بسيط. بدونه ما فيه متابعة." },
  { id: "a_followup", phase: 2, axis: "clients", check: "c_followup", title: "رسالة متابعة وتذكير", how: "بعد الزيارة بيومين: «كيف شعرك؟»، وقبل موعدها المتوقع بأسبوع: تذكير مع رابط الحجز." },
  { id: "a_return", phase: 2, axis: "clients", check: "d_return", title: "استرجاع العميلات اللي ما رجعن", how: "كل عميلة غابت شهرين: رسالة شخصية بعرض خاص لها — من السجل." },
  { id: "a_reviews", phase: 2, axis: "clients", check: "c_reviews", title: "اطلبي تقييم بعد كل خدمة", how: "رسالة جاهزة برابط قوقل أو طلب صورة رأي — بموافقة العميلة على النشر." },
  { id: "a_link", phase: 1, axis: "social", check: "so_link", title: "رابط حجز أو واتساب في كل البايوهات", how: "رابط مباشر واحد — كل خطوة زيادة تخسرك عميلة." },
  { id: "a_google", phase: 1, axis: "social", check: "so_google", title: "ملف نشاط في قوقل", how: "صور، ساعات، خدمات، ورابط الحجز. للمنزلي: منطقة خدمة بدون إظهار العنوان." },
  { id: "a_rating", phase: 3, axis: "social", check: "d_rating", title: "ارفعي تقييم قوقل", how: "اطلبي التقييم من العميلات الراضيات، وردّي على كل تقييم خصوصاً السلبي." },
  { id: "a_identity", phase: 3, axis: "social", check: "so_identity", title: "هوية واضحة للحساب", how: "لونين وخط ثابت، و٩ منشورات تمثّل شغلك الحقيقي قبل أي إعلان." },
  { id: "a_posts", phase: 3, axis: "social", check: "d_posts", title: "نشر منتظم ٣ مرات بالأسبوع", how: "قبل وبعد، فيديو قصير لطريقة الشغل، ورأي عميلة — وستوري يومي بالمواعيد الفاضية." },
  { id: "a_dm", phase: 1, axis: "social", check: "d_dm", title: "رد خلال ساعة", how: "ردود جاهزة للأسئلة المتكررة (السعر، الموقع، الحجز) — العميلة تحجز من أول من يرد." },
  { id: "a_measure", phase: 3, axis: "social", check: "so_measure", title: "حملة صغيرة تنقاس", how: "دائرة ٣–٥ كم، هدف «رسالة أو حجز»، واسألي كل عميلة «من وين عرفتينا؟» — نقيس تكلفة الحجز." },
  { id: "a_license", phase: 1, axis: "ops", check: "o_license", title: "رتّبي الترخيص والشهادات الصحية", how: "تأكدي من المتطلبات الحالية في منصة «بلدي» — النظام يحمي النشاط ويفتح الإعلان وبوابات الدفع." },
  { id: "a_deposit", phase: 1, axis: "ops", check: "o_deposit", title: "عربون وسياسة إلغاء", how: "عربون بسيط يُخصم من الفاتورة، وإلغاء قبل ٢٤ ساعة — ينهي الغياب بدون إحراج." },
  { id: "a_booking", phase: 1, axis: "ops", check: "o_booking", title: "حجز منظم", how: "رابط حجز أو تقويم واحد بدل الرسائل المتفرقة — ما يضيع موعد ولا يتكرر." },
  { id: "a_standard", phase: 2, axis: "ops", check: "o_standard", title: "معيار خدمة موحّد", how: "خطوات ووقت لكل خدمة أساسية — نفس التجربة مهما تغيّرت الخبيرة." },
  { id: "a_zone", phase: 1, axis: "ops", check: "o_zone", title: "حددي نطاق الخدمة", how: "أحياء محددة أو مسافة قصوى، ورسوم أعلى خارجها — المشوار البعيد خسارة." },
  { id: "a_kit", phase: 1, axis: "ops", check: "o_kit", title: "جهّزي عدة لكل خدمة", how: "شنطة مرتبة لكل نوع خدمة — تختصر وقت التجهيز وتبين احترافية." },
  { id: "a_hygiene", phase: 1, axis: "ops", check: "o_hygiene", title: "خلّي التعقيم ظاهر", how: "أدوات مغلّفة تُفتح قدام العميلة، وستوري يوضح طريقة التعقيم — أكبر سبب ثقة للمنزلي." },
];

/** ترتيب الأولوية: الخسارة والنظام أولاً، بعدها الحجز والواجهة، بعدها الفاتورة والعودة، وآخرها الاستقطاب. */
const RANK = [
  "a_costs", "a_prices", "a_license", "a_deposit", "a_visit_fee", "a_booking", "a_link", "a_dm", "a_zone", "a_hygiene",
  "a_clients", "a_list", "a_focus", "a_kit", "a_google", "a_followup", "a_return", "a_addon", "a_package", "a_entry",
  "a_reviews", "a_discount", "a_offpeak", "a_standard", "a_posts", "a_identity", "a_rating", "a_measure",
];
const rankOf = (id: string) => { const i = RANK.indexOf(id); return i < 0 ? RANK.length : i; };
export const actionById = (id: string) => ACTIONS.find((a) => a.id === id) ?? null;

/** الإجراءات المفتوحة بالأولوية: فحصها ما نجح (أو ما تجاوب عليه) وما انجزت في أي شهر. */
export function openActions(s: Simple, results: CheckResult[]) {
  const byId = new Map(results.map((r) => [r.id, r]));
  const doneEver = new Set(s.months.flatMap((m) => Object.keys(m.done).filter((k) => m.done[k])));
  return ACTIONS.filter((a) => {
    const r = byId.get(a.check);
    return r && r.pass !== true && !doneEver.has(a.id);
  }).sort((a, b) => rankOf(a.id) - rankOf(b.id)).map((a) => ({ ...a, unknown: byId.get(a.check)?.pass === null }));
}

/* ─── الشهور ─── */

export const MONTH_SIZE = 5;
export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export function nextMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m, 1));
}
export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("ar-SA-u-ca-gregory", { month: "long", year: "numeric" });
}

/** خطة شهر جديد: الإجراءات اللي ما انجزت في الشهر اللي قبله تترحّل، والباقي من الأعلى أولوية. */
export function buildMonth(s: Simple, results: CheckResult[], month: string, id: string): MonthPlan {
  const last = s.months[s.months.length - 1];
  const open = openActions(s, results).map((a) => a.id);
  const carried = last ? last.actions.filter((a) => !last.done[a] && open.includes(a)) : [];
  const fresh = open.filter((a) => !carried.includes(a)).slice(0, Math.max(0, MONTH_SIZE - carried.length));
  return { id, month, focus: "", actions: [...carried, ...fresh], done: {}, carried, numbers: {}, notes: "", closed_at: null };
}

/* ─── توصيات الجلسة: أهم ٣ حسب الأثر + فوز سريع ─── */

export type Rec = { id: string; title: string; why: string; impact: string | null; actions: string[] };

const fmtN = (v: number) => Math.round(v).toLocaleString("ar-SA-u-ca-gregory");

export function recommendations(s: Simple, results: CheckResult[]): { top: Rec[]; quickWin: Action | null } {
  const byId = new Map(results.map((r) => [r.id, r.pass]));
  const failed = (id: string) => byId.get(id) === false;
  const open = new Set(openActions(s, results).map((a) => a.id));
  const b = s.baseline;
  const out: Rec[] = [];

  const priced = s.services.filter((x) => x.name.trim()).map((x) => ({ x, p: pricing(x, s.costs, s.model) }));
  const losing = priced.filter(({ p }) => p.status === "loss" || p.status === "low");
  if (losing.length) {
    const now = monthEstimate(s.services, s.costs, s.model);
    const fixedSvcs = s.services.map((x) => { const p = pricing(x, s.costs, s.model); return p.suggested && (x.price ?? 0) < p.suggested ? { ...x, price: p.suggested } : x; });
    const after = monthEstimate(fixedSvcs, s.costs, s.model);
    out.push({
      id: "pricing", title: "صحّحي الأسعار اللي تحت التكلفة",
      why: `${fmtN(losing.length)} خدمة سعرها أقل من السعر الأدنى${losing.some(({ p }) => p.status === "loss") ? " — وبعضها خسارة على كل عميلة" : ""}.`,
      impact: now.profit !== null && after.profit !== null ? `صافي الربح الشهري من ${fmtN(now.profit)} إلى ${fmtN(after.profit)} ر.س` : null,
      actions: ["a_prices"],
    });
  } else if (byId.get("d_costs") !== true) {
    out.push({ id: "costs", title: "احسبي تكلفتك الحقيقية", why: "بدون تكلفة الساعة ما نعرف هل الأسعار تربح — أغلب الصالونات والمنزليات يسعّرون تحت التكلفة بدون ما يدرون.", impact: null, actions: ["a_costs"] });
  }
  if (failed("o_license")) {
    out.push({ id: "license", title: "رتّبي الترخيص والشهادات الصحية", why: "النشاط بدون ترخيص معرّض للإغلاق، وما يقدر يعلن رسمياً أو يفتح بوابة دفع.", impact: null, actions: ["a_license"] });
  }
  const rp = s.nums.return_pct ?? b.return_pct ?? null;
  if (rp !== null && rp < 50) {
    const clients = b.clients ?? null, ticket = b.avg_ticket ?? (b.revenue && b.clients ? b.revenue / b.clients : null);
    const extra = clients ? (clients * (0.5 - rp / 100)) / 2 : null;
    out.push({
      id: "return", title: "رجّعي العميلات", why: `${fmtN(rp)}٪ بس يرجعن خلال شهرين — الربح الحقيقي في الزيارة الثانية.`,
      impact: extra && ticket ? `لو وصلت العودة ٥٠٪: تقريباً ${fmtN(extra)} زيارة زيادة بالشهر ≈ ${fmtN(extra * ticket)} ر.س` : null,
      actions: ["a_clients", "a_followup", "a_return"].filter((a) => open.has(a)),
    });
  }
  if (failed("d_addon") || failed("d_package")) {
    const clients = b.clients ?? null;
    out.push({
      id: "ticket", title: "ارفعي الفاتورة بالإضافات والباقة", why: "ما فيه إضافات ترفع الفاتورة أو باقة تضمن الرجوع.",
      impact: clients ? `لو ٣٠٪ من العميلات أخذن إضافة بـ٥٠ ر.س: تقريباً ${fmtN(clients * 0.3 * 50)} ر.س زيادة بالشهر` : null,
      actions: ["a_addon", "a_package"].filter((a) => open.has(a)),
    });
  }
  if (failed("o_deposit") || failed("o_booking")) {
    out.push({ id: "booking", title: "نظّمي الحجز والعربون", why: "الغياب والإلغاء المتأخر يضيّعون مواعيد ما تتعوض.", impact: null, actions: ["a_deposit", "a_booking"].filter((a) => open.has(a)) });
  }
  if (failed("so_link") || failed("so_google") || failed("d_posts") || failed("d_dm")) {
    out.push({ id: "social", title: "رتّبي واجهتك الرقمية", why: "العميلة تحكم من الحساب وقوقل وسرعة الرد قبل ما تحجز.", impact: null, actions: ["a_link", "a_google", "a_dm", "a_posts"].filter((a) => open.has(a)) });
  }

  const QUICK = ["a_link", "a_deposit", "a_dm", "a_list", "a_google", "a_reviews", "a_followup"];
  const quickWin = QUICK.map((id) => (open.has(id) ? actionById(id) : null)).find(Boolean) ?? null;
  return { top: out.slice(0, 3), quickWin };
}

/* ─── المؤشرات الستة ─── */

export const SIMPLE_KPIS: { key: SimpleKpiKey; label: string; unit: string; lowerIsBetter?: boolean }[] = [
  { key: "revenue", label: "الدخل الشهري", unit: "ر.س" },
  { key: "clients", label: "عدد العميلات بالشهر", unit: "عميلة" },
  { key: "return_pct", label: "نسبة العودة خلال شهرين", unit: "٪" },
  { key: "avg_ticket", label: "متوسط الفاتورة", unit: "ر.س" },
  { key: "margin_pct", label: "هامش الربح", unit: "٪" },
  { key: "cpa", label: "تكلفة العميلة الجديدة", unit: "ر.س", lowerIsBetter: true },
];

/* ─── محتوى حسب النموذج ─── */

export const CONTENT_BY_MODEL: Record<BizModel, string[]> = {
  salon: ["جولة في المكان والنظافة", "تعريف بكل خبيرة وتخصصها", "قبل وبعد من شغل الأسبوع", "المواعيد الفاضية اليوم (ستوري)"],
  home_visit: ["«يوم معي»: من تجهيز العدة لين النتيجة", "التعقيم: فتح الأدوات المغلّفة قدام الكاميرا", "الأحياء اللي نخدمها ومواعيد الأسبوع", "آراء العميلات (بموافقتهن)"],
  home_studio: ["الركن المجهّز ونظافته وخصوصيته", "قبل وبعد", "المواعيد بالحجز المسبق فقط", "آراء العميلات (بموافقتهن)"],
};
