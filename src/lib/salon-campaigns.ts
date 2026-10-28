// «التسويق الرقمي والحملات» للصالون: جاهزية الحملات (قوقل ← الحسابات ← الإعلان)، سجل الحملات
// ومؤشراتها (تكلفة الحجز، العائد، العودة)، ودليل المحتوى. مشترك بين «الخطة التسويقية للصالونات»
// (إعداد marketing) وبطاقة كل صالون في «إدارة مستشاري الصالونات» (عمود marketing).

export type CampaignPlatform = "snapchat" | "instagram" | "tiktok" | "google" | "other";
export type CampaignStatus = "draft" | "live" | "paused" | "done";

export type Campaign = {
  id: string; name: string; platform: CampaignPlatform; status: CampaignStatus;
  offer: string; audience: string; start: string; end: string;
  budget: number | null; spend: number | null;
  leads: number | null; bookings: number | null; showed: number | null;
  revenue: number | null; returned: number | null;
  notes: string;
};

export type Marketing = { readiness: Record<string, boolean>; campaigns: Campaign[] };
export const DEFAULT_MARKETING: Marketing = { readiness: {}, campaigns: [] };

export const PLATFORMS: { id: CampaignPlatform; label: string; color: string; ink: string }[] = [
  { id: "snapchat", label: "سناب شات", color: "#FFFC00", ink: "#3f3d00" },
  { id: "instagram", label: "إنستقرام", color: "#E1306C", ink: "#ffffff" },
  { id: "tiktok", label: "تيك توك", color: "#111111", ink: "#ffffff" },
  { id: "google", label: "قوقل", color: "#4285F4", ink: "#ffffff" },
  { id: "other", label: "أخرى", color: "#7A6570", ink: "#ffffff" },
];
export const platformOf = (id: string) => PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[PLATFORMS.length - 1];

export const CAMPAIGN_STATUSES: { id: CampaignStatus; label: string; color: string }[] = [
  { id: "draft", label: "تجهيز", color: "#7A6570" },
  { id: "live", label: "شغّالة", color: "#16A34A" },
  { id: "paused", label: "موقوفة", color: "#D9A21B" },
  { id: "done", label: "منتهية", color: "#2563EB" },
];
export const campaignStatus = (id: string) => CAMPAIGN_STATUSES.find((s) => s.id === id) ?? CAMPAIGN_STATUSES[0];

/** جاهزية الحملات بالترتيب: ما نصرف على إعلان قبل ما تكون الواجهة والاحتفاظ جاهزين. */
export const READINESS: { id: string; title: string; lead: string; items: { id: string; text: string }[] }[] = [
  {
    id: "google", title: "١. قوقل ماب", lead: "أهم واجهة — أغلب البحث «صالون قريب مني». أسبوع واحد وبدون تكلفة تقريباً.",
    items: [
      { id: "g_profile", text: "البيانات كاملة: الصور، ساعات العمل، الخدمات، ورابط الحجز" },
      { id: "g_reviews", text: "رسالة طلب تقييم بعد كل زيارة شغّالة (هدف: +١٠ تقييمات شهرياً)" },
      { id: "g_reply", text: "الرد على كل التقييمات — خصوصاً السلبية" },
      { id: "g_rating", text: "التقييم ٤٫٥ فأعلى" },
    ],
  },
  {
    id: "organic", title: "٢. الحسابات بدون إعلان", lead: "٤–٦ أسابيع: الحساب يبين محترم ومليان لما تجيه زائرة من إعلان.",
    items: [
      { id: "s_bio", text: "بايو واضح + رابط حجز أو واتساب في كل الحسابات" },
      { id: "s_grid", text: "٩ منشورات على الأقل تمثّل الشغل (قبل وبعد، الخبيرات، المكان)" },
      { id: "s_cadence", text: "نشر ٣ مرات بالأسبوع + ستوري يومي لمدة ٤ أسابيع" },
      { id: "s_consent", text: "موافقة مكتوبة من العميلات على التصوير (ونصوّر الشعر واليدين بدل الوجوه)" },
      { id: "s_dm", text: "الرد على الرسائل خلال ساعة وقت الدوام" },
    ],
  },
  {
    id: "ads", title: "٣. جاهزية الإعلان", lead: "الإعلان يجيب عميلة جديدة — الربح الحقيقي لما ترجع، وهذا شغل مفاتيح النمو.",
    items: [
      { id: "a_retention", text: "مفاتيح النمو شغّالة: الاستقبال، استشارة الـ٥ دقائق، استرجاع النائمات" },
      { id: "a_offer", text: "عرض دخول واضح (تجربة أول زيارة أو إضافة مجانية) — مو خصم على كل شي" },
      { id: "a_tracking", text: "كل حجز ينسأل «من وين عرفتينا؟» وينسجّل مصدره" },
      { id: "a_capacity", text: "فيه مواعيد فاضية تستوعب العميلات الجدد" },
    ],
  },
];
export const READINESS_COUNT = READINESS.reduce((s, p) => s + p.items.length, 0);

/* ─── مؤشرات الحملة ─── */

const div = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? a / b : null);

export function campaignMetrics(c: Campaign) {
  return {
    cpl: div(c.spend, c.leads),            // تكلفة الرسالة/العميلة المهتمة
    cpb: div(c.spend, c.bookings),         // تكلفة الحجز — الرقم اللي يحدد إذا الإعلان يربح
    showRate: div(c.showed, c.bookings),   // نسبة الحضور
    roas: div(c.revenue, c.spend),         // العائد على الإعلان
    returnRate: div(c.returned, c.showed), // رجعن لزيارة ثانية
  };
}

export type Verdict = { label: string; color: string; why: string };

/** حكم مبسّط: العائد أولاً، ولو أقل من التكلفة نشوف العودة (الربح في الزيارة الثانية). */
export function campaignVerdict(c: Campaign): Verdict | null {
  const m = campaignMetrics(c);
  if (m.roas === null) return null;
  if (m.roas >= 2) return { label: "كبّريها", color: "#16A34A", why: "كل ريال يرجع ريالين أو أكثر من أول زيارة" };
  if (m.roas >= 1) return { label: "حسّنيها وراقبي", color: "#D9A21B", why: "تغطّي تكلفتها — جرّبي إعلان أو عرض أقوى قبل التكبير" };
  if (m.returnRate !== null && m.returnRate >= 0.3) return { label: "استمري بحذر", color: "#2563EB", why: "أول زيارة ما غطّت التكلفة، لكن العودة عالية — الربح في الزيارة الثانية" };
  return { label: "أوقفيها أو غيّري العرض", color: "#DC2626", why: "التكلفة أعلى من الدخل والعودة ضعيفة" };
}

export function marketingTotals(campaigns: Campaign[]) {
  const sum = (k: keyof Pick<Campaign, "spend" | "leads" | "bookings" | "showed" | "revenue" | "returned">) =>
    campaigns.reduce((s, c) => s + (c[k] ?? 0), 0);
  const spend = sum("spend"), bookings = sum("bookings"), revenue = sum("revenue"), showed = sum("showed");
  return {
    live: campaigns.filter((c) => c.status === "live").length,
    spend, leads: sum("leads"), bookings, showed, revenue, returned: sum("returned"),
    cpb: bookings ? spend / bookings : null,
    roas: spend ? revenue / spend : null,
    returnRate: showed ? sum("returned") / showed : null,
  };
}

export const newCampaign = (id: string): Campaign => ({
  id, name: "", platform: "snapchat", status: "draft", offer: "", audience: "نساء، دائرة ٣–٥ كم حول الصالون", start: "", end: "",
  budget: null, spend: null, leads: null, bookings: null, showed: null, revenue: null, returned: null, notes: "",
});

/* ─── دليل المحتوى ─── */

export const CONTENT_WEEK: { day: string; type: string; idea: string }[] = [
  { day: "الأحد", type: "قبل وبعد", idea: "تحوّل واحد واضح (شعر، صبغة، أظافر) — صورتين جنب بعض أو فيديو ١٠ ثواني" },
  { day: "الثلاثاء", type: "فيديو قصير", idea: "طريقة الشغل أو نصيحة عناية (٣ أخطاء تخرب الصبغة…)" },
  { day: "الخميس", type: "ناس الصالون", idea: "تعريف بخبيرة، رأي عميلة، أو عرض نهاية الأسبوع" },
  { day: "يومياً", type: "ستوري", idea: "كواليس، المواعيد الفاضية اليوم، وتصويت أو سؤال" },
];

export const CONTENT_SEASONS: { when: string; idea: string }[] = [
  { when: "قبل رمضان والعيد", idea: "باقات العيد وحجز مبكر — أعلى موسم طلب" },
  { when: "موسم الأعراس (الصيف)", idea: "باقة العروس والمعازيم، وحجز التجربة" },
  { when: "العودة للمدارس", idea: "عروض الأمهات وقت الدوام الصباحي (يملي أوقات الفراغ)" },
  { when: "يوم التأسيس ٢٢ فبراير واليوم الوطني ٢٣ سبتمبر", idea: "محتوى وطني وعرض محدود" },
];

export const SAUDI_NOTES = [
  "التعاون مع المشهورات يحتاج إن المعلنة عندها رخصة «موثوق».",
  "لا ادعاءات طبية في خدمات الليزر والبشرة (مثل «نتائج مضمونة»).",
  "لا نشر لصور العميلات بدون موافقة مكتوبة.",
];
