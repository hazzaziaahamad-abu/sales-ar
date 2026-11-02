import type { ImageSlot, PostData, TemplateId } from "./types";

// المحتوى الافتراضي للبوستات الأربعة — يتعبّى تلقائياً أول تشغيل، ويُستخدم كأساس لأي «بوست جديد».

const CONTACT = { phone: "920031843", whatsapp: "+966 59 116 6861", handle: "menuspages" };
const COLORS = { purple: "#4A2C9F", gold: "#F5C518" };

const img = (file: string, fit: ImageSlot["fit"] = "contain"): ImageSlot => ({
  src: `/package-posts/${file}`, x: 50, y: 50, zoom: 1, fit,
});

const VIP_FEATURES = [
  "إمكانية الطلب والدفع من المنيو واستلام الطلبات",
  "إمكانية الطلب من باركود الطاولة والدفع مباشرة أو لاحقاً",
  "إتاحة الربط مع بكسل سناب وإنستقرام وتيك توك",
  "التحكم في ظهور المنتجات في أوقات محددة",
  "إتاحة ظهور المنتجات المفضلة للعميل",
  "إتاحة إرسال الطلب على الواتساب",
  "إتاحة تسجيل قائمة انتظار الدور",
  "التحكم بمظهر المتجر",
  "إتاحة فئات رئيسية",
  "كوبونات الخصم",
  "إتاحة حجوزات الطاولات",
  "نظام استبيان خاص للعملاء",
  "إتاحة إضافة دومين مخصص",
  "إضافة الفروع",
  "تقييمات العملاء",
];

const VIP_INTRO =
  "الأنسب لنمو نشاطك وزيادة معدل الطلبات، [[تتيح لك إمكانية الطلب من المنيو مع كل الخيارات]]، وغيرها من المزايا المهمة مثل: [[+ مزايا الباقة الأساسية]]";

type Seed = Omit<PostData, "id" | "updatedAt">;

const SEEDS: Record<TemplateId, Seed> = {
  basic: {
    template: "basic",
    title: "الباقة الأساسية",
    colors: COLORS,
    packageName: "الباقة الأساسية",
    price: "349",
    priceUnit: "ريال/سنة",
    headline: "تسهّل عليك إضافة وتعديل منتجاتك",
    banner: "في أسرع وقت وبدون أي صعوبات",
    intro: "هذي الباقة الأنسب لك وفيها المزايا التالية:",
    features: [
      "إضافة وتعديل وإخفاء جميع منتجاتك مع تفاصيلها",
      "مسببات الحساسية والسعرات تضيفها بسهولة",
      "كل الروابط اللي يحتاجها عميلك تضيفها",
      "صور إعلانية متحركة",
      "دعم فني طوال مدة الاشتراك",
    ],
    images: { hero: img("basic-hero.png") },
    contact: CONTACT,
  },
  vip: {
    template: "vip",
    title: "باقة VIP",
    colors: COLORS,
    packageName: "باقة VIP",
    price: "879",
    priceUnit: "ريال/سنة",
    intro: VIP_INTRO,
    features: VIP_FEATURES,
    side: {
      title: "مزايا الولاء",
      items: ["استهداف العملاء الحاليين", "إرسال إشعارات", "ظهور إشعار عند الاقتراب من المحل"],
      variant: "loyalty",
    },
    images: { hero: img("vip-hero.png"), side: img("vip-loyalty.png") },
    contact: CONTACT,
  },
  vipPlus: {
    template: "vipPlus",
    title: "باقة VIP بلس",
    colors: COLORS,
    packageName: "باقة VIP بلس",
    price: "949",
    priceUnit: "ريال/سنة",
    intro: VIP_INTRO,
    features: [...VIP_FEATURES, "الربط مع فودكس"],
    side: {
      title: "يمكنك أيضاً طلب المزايا المخصصة التالية بأسعار خاصة:",
      items: ["الربط مع رسائل الواتساب المدفوعة", "تفعيل نظام الويتر الذكي", "تصميم صفحة خاصة للمتجر"],
      variant: "addons",
    },
    images: { hero: img("vipplus-hero.png") },
    contact: CONTACT,
  },
  cashier: {
    template: "cashier",
    title: "اكتملت الحلقة — الكاشير",
    colors: COLORS,
    packageName: "",
    price: "",
    priceUnit: "",
    headline: "اكتملت الحلقة..",
    banner: "نظام الكاشير الجديد صار متاح!",
    badge: { strong: "نظام منيو متكامل", text: "(منيو وكاشير وطلبات أونلاين وبطاقات الولاء)" },
    features: [],
    cards: [
      {
        title: "VIP مع نظام الكاشير",
        desc: "باقة VIP المتكاملة تشمل جميع المزايا مع جهاز الكاشير وطابعة الإيصالات.",
        price: "1349",
        unit: "ريال / للفرع",
      },
      {
        title: "VIP مع بطاقات الولاء",
        desc: "كل مزايا باقة VIP مع نظام الكاشير، + نظام بطاقات الولاء المخصصة لعملائك.",
        price: "1549",
        unit: "ريال / للفرع",
      },
    ],
    cta: "تواصل معنا الآن",
    images: { hero: img("cashier-device.png", "cover") },
    contact: CONTACT,
  },
};

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** نسخة جديدة (عميقة) من المحتوى الافتراضي لقالب. */
export function makeDefaultPost(template: TemplateId, title?: string): PostData {
  const seed = structuredClone(SEEDS[template]);
  return { ...seed, id: newId(), title: title ?? seed.title, updatedAt: new Date().toISOString() };
}

/** البوستات الأربعة الافتراضية لأول تشغيل. */
export function defaultPosts(): PostData[] {
  return (["basic", "vip", "vipPlus", "cashier"] as TemplateId[]).map((t) => makeDefaultPost(t));
}

/** يكمّل أي حقول ناقصة في بوست محفوظ (لو تغيّر النموذج لاحقاً). */
export function normalizePost(p: PostData): PostData {
  const base = SEEDS[p.template] ?? SEEDS.basic;
  return {
    ...structuredClone(base),
    ...p,
    colors: { ...base.colors, ...(p.colors ?? {}) },
    contact: { ...base.contact, ...(p.contact ?? {}) },
    images: { ...(p.images ?? {}) },
    features: Array.isArray(p.features) ? p.features : [],
  };
}
