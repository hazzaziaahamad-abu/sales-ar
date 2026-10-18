import slidesJson from "./slides.json";
import packagesJson from "./packages.json";

// «معرض شاشات MENU» (/showcase): الشرائح ثابتة للكل، والباقات يعدّلها المدير فقط.

export type ShowcaseFrame = "tablet" | "phone" | "none";

export interface ShowcaseSlide {
  image: string;
  frame: ShowcaseFrame;
  title: string;
  note?: string;
  description: string;
}

export interface ShowcasePackage {
  name: string;
  price: string;
  period: string;
  featured: boolean;
  features: string[];
}

export const SHOWCASE_SLIDES = slidesJson as ShowcaseSlide[];
export const DEFAULT_SHOWCASE_PACKAGES = packagesJson as ShowcasePackage[];

/** مفتاح الصلاحية (صفحة الحوكمة) — السوبر أدمن يملكه دائماً. */
export const SHOWCASE_EDIT_PERMISSION = "showcase_packages_edit";

const MAX_PACKAGES = 12;
const MAX_FEATURES = 60;
const MAX_TEXT = 200;

const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");

/** ينظّف قائمة الباقات (يحذف المزايا الفاضية). يرجّع null لو الشكل غير صالح. */
export function sanitizePackages(input: unknown): ShowcasePackage[] | null {
  if (!Array.isArray(input) || input.length > MAX_PACKAGES) return null;
  const out: ShowcasePackage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    const p = raw as Record<string, unknown>;
    if (!Array.isArray(p.features) || p.features.length > MAX_FEATURES) return null;
    const name = text(p.name);
    if (!name) return null;
    out.push({
      name,
      price: text(p.price),
      period: text(p.period),
      featured: p.featured === true,
      features: p.features.map(text).filter(Boolean),
    });
  }
  return out;
}
