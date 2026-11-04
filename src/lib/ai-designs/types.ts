// «صمّم من مرجع» — الذكاء يقرأ تصميماً مرجعياً ويرجّع «مواصفة» JSON، والمنصة ترسمها بهوية قائمة الطلبات
// (الخط واللوقو والألوان مضمونة 100٪ — الذكاء ما يرسم بكسلات، يختار التخطيط ويكتب الكلام فقط).

export type DesignSize = "square" | "portrait" | "story";
export type DesignLayout = "photo" | "photoBottom" | "photoSplit" | "centered" | "editorial" | "split" | "card" | "bold";
export const PHOTO_LAYOUTS: DesignLayout[] = ["photo", "photoBottom", "photoSplit"];
export const isPhotoLayout = (l: DesignLayout) => PHOTO_LAYOUTS.includes(l);
/** marker = شريط بنفسجي خلف السطور (ستايل بوستاتنا) · boxes = كل سطر داخل كبسولة · plain = عادي. */
export type HeadlineStyle = "marker" | "boxes" | "plain";
export type DesignTheme = "light" | "dark" | "purple" | "gold";
export type DesignBackground = "dots" | "glow" | "solid" | "grid" | "rays" | "waves";
export type BulletStyle = "checks" | "chips" | "numbers" | "tags";
export type DesignDecor = "circles" | "sparkles" | "stripe" | "corners" | "ring";
export type ImageFrame = "none" | "phone" | "photo" | "floating";

export interface AiDesign {
  id: string;
  /** اسم قصير للاقتراح (مثلاً «جريء بنفسجي»). */
  name: string;
  /** لماذا هذا الاقتراح أفضل/ماذا أخذ من المرجع. */
  note?: string;
  size: DesignSize;
  layout: DesignLayout;
  theme: DesignTheme;
  background: DesignBackground;
  align: "center" | "start";
  decor: DesignDecor[];
  eyebrow?: string;
  /** يدعم تمييز جزء بصيغة [[نص]]. */
  headline: string;
  subheadline?: string;
  bullets: string[];
  bulletStyle: BulletStyle;
  headlineStyle: HeadlineStyle;
  /** وصف الصورة بالإنجليزي اللي يولّدها نموذج الصور (يكتبه الذكاء ويقدر المستخدم يعدّله). */
  photoPrompt?: string;
  /** صورة الخلفية (data URL) — مولّدة بالذكاء أو مرفوعة. */
  photo?: string;
  /** موضع الصورة (object-position) وتعتيمها 0→1. */
  photoX: number;
  photoY: number;
  shade: number;
  stat?: { value: string; label: string };
  cta?: string;
  showContact: boolean;
  imageFrame: ImageFrame;
  /** صورة المنتج/الشاشة (data URL) — يرفعها المستخدم، مو من الذكاء. */
  image?: string;
  updatedAt: string;
}

export const DESIGN_SIZE: Record<DesignSize, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: "مربع 1:1" },
  portrait: { w: 1080, h: 1350, label: "بوست 4:5" },
  story: { w: 1080, h: 1920, label: "ستوري 9:16" },
};

export const LAYOUT_LABEL: Record<DesignLayout, string> = {
  photo: "صورة كاملة — نص فوق",
  photoBottom: "صورة كاملة — نص تحت",
  photoSplit: "صورة فوق + لوح تحت",
  centered: "متمركز",
  editorial: "مجلة (يمين)",
  split: "مقسوم نصين",
  card: "كرت بالنص",
  bold: "عنوان ضخم",
};
export const THEME_LABEL: Record<DesignTheme, string> = {
  light: "فاتح", dark: "داكن", purple: "بنفسجي", gold: "ذهبي",
};
export const BG_LABEL: Record<DesignBackground, string> = {
  dots: "نقاط", glow: "توهّج", solid: "سادة", grid: "شبكة", rays: "أشعة", waves: "موجات",
};
export const DECOR_LABEL: Record<DesignDecor, string> = {
  circles: "دوائر", sparkles: "نجوم", stripe: "شريط مائل", corners: "زوايا", ring: "حلقة",
};
export const FRAME_LABEL: Record<ImageFrame, string> = {
  none: "بدون صورة", phone: "داخل جوال", photo: "صورة بإطار", floating: "عائمة",
};
export const BULLET_LABEL: Record<BulletStyle, string> = {
  checks: "علامات ✓", chips: "كبسولات", numbers: "أرقام", tags: "مربعات بنفسجية",
};
export const HEADLINE_LABEL: Record<HeadlineStyle, string> = {
  marker: "شريط خلف الكلام", boxes: "كبسولة لكل سطر", plain: "عادي",
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
const str = (v: unknown, max = 220) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export const newDesignId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** ينظّف أي مخرجات من الذكاء ويحوّلها لمواصفة صالحة (ما نثق بالـ JSON كما هو). */
export function normalizeDesign(raw: unknown, size: DesignSize): AiDesign {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const stat = r.stat && typeof r.stat === "object" ? (r.stat as Record<string, unknown>) : null;
  const statValue = stat ? str(stat.value, 16) : "";
  return {
    id: newDesignId(),
    name: str(r.name, 40) || "اقتراح",
    note: str(r.note, 300) || undefined,
    size,
    layout: pick(r.layout, ["photo", "photoBottom", "photoSplit", "centered", "editorial", "split", "card", "bold"] as const, "photo"),
    theme: pick(r.theme, ["light", "dark", "purple", "gold"] as const, "light"),
    background: pick(r.background, ["dots", "glow", "solid", "grid", "rays", "waves"] as const, "dots"),
    align: pick(r.align, ["center", "start"] as const, "center"),
    decor: Array.isArray(r.decor)
      ? Array.from(new Set(r.decor.map((d) => pick(d, ["circles", "sparkles", "stripe", "corners", "ring"] as const, "circles")))).slice(0, 3)
      : [],
    eyebrow: str(r.eyebrow, 50) || undefined,
    headline: str(r.headline, 120) || "منيو إلكتروني يرفع طلباتك",
    subheadline: str(r.subheadline, 200) || undefined,
    bullets: Array.isArray(r.bullets) ? r.bullets.map((b) => str(b, 80)).filter(Boolean).slice(0, 6) : [],
    bulletStyle: pick(r.bulletStyle, ["checks", "chips", "numbers", "tags"] as const, "checks"),
    headlineStyle: pick(r.headlineStyle, ["marker", "boxes", "plain"] as const, "marker"),
    photoPrompt: str(r.photoPrompt, 1200) || undefined,
    photoX: 50,
    photoY: 50,
    shade: typeof r.shade === "number" ? Math.min(1, Math.max(0, r.shade)) : 0.55,
    stat: statValue ? { value: statValue, label: str(stat!.label, 40) } : undefined,
    cta: str(r.cta, 50) || undefined,
    showContact: r.showContact !== false,
    imageFrame: pick(r.imageFrame, ["none", "phone", "photo", "floating"] as const, "none"),
    updatedAt: new Date().toISOString(),
  };
}
