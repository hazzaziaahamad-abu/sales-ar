// «استوديو بوستات الباقات» — نموذج البيانات. كل بوست = كائن JSON + قالب React يرسمه بالمقاس الحقيقي.

export type TemplateId = "basic" | "vip" | "vipPlus" | "cashier";

export interface ImageSlot {
  /** رابط (/package-posts/…) أو data URL لصورة مرفوعة. */
  src: string;
  /** موضع الصورة داخل خانتها (object-position) بالنسبة المئوية. */
  x: number;
  y: number;
  /** تكبير بسيط 1 → 2. */
  zoom: number;
  fit: "contain" | "cover";
}

export interface PriceCard {
  title: string;
  desc: string;
  price: string;
  unit: string;
}

export interface PostData {
  id: string;
  template: TemplateId;
  /** اسم داخلي يظهر في قائمة البوستات. */
  title: string;
  colors: { purple: string; gold: string };
  packageName: string;
  price: string;
  priceUnit: string;
  /** العنوان: basic = سطر الوصف · cashier = «اكتملت الحلقة..». */
  headline?: string;
  /** basic = الشريط البنفسجي · cashier = السطر الأبيض تحت العنوان. */
  banner?: string;
  /** فقرة تدعم تمييز جزء باللون البنفسجي بصيغة [[نص]]. */
  intro?: string;
  features: string[];
  side?: { title: string; items: string[]; variant: "loyalty" | "addons" };
  /** كبسولة قالب الكاشير: جزء ذهبي بارز + وصف. */
  badge?: { strong: string; text: string };
  cards?: PriceCard[];
  /** نص الكبسولة الذهبية (قالب الكاشير). */
  cta?: string;
  images: { hero?: ImageSlot; side?: ImageSlot };
  contact: { phone: string; whatsapp: string; handle: string };
  updatedAt: string;
}

export const TEMPLATE_SIZE: Record<TemplateId, { w: number; h: number }> = {
  basic: { w: 1080, h: 1920 },
  vip: { w: 1080, h: 1920 },
  vipPlus: { w: 1080, h: 1920 },
  cashier: { w: 1080, h: 1350 },
};

export const TEMPLATE_LABEL: Record<TemplateId, string> = {
  basic: "الباقة الأساسية",
  vip: "باقة VIP",
  vipPlus: "باقة VIP بلس",
  cashier: "اكتملت الحلقة — الكاشير",
};

export const PURPLE_PRESETS = ["#4A2C9F", "#3B1F8C", "#5B2DB8"];
export const GOLD_PRESETS = ["#F5C518", "#F2B705", "#FFD54A"];

export const TEMPLATE_IDS: TemplateId[] = ["basic", "vip", "vipPlus", "cashier"];

export function isTemplateId(v: unknown): v is TemplateId {
  return typeof v === "string" && (TEMPLATE_IDS as string[]).includes(v);
}
