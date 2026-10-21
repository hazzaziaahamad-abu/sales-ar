"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  QrCode, CreditCard, Store, MonitorSmartphone, Bike, Gift, Globe, Clock, MessageCircle,
  Wallet, LayoutDashboard, Rocket, Check, ChevronLeft, ChevronRight, Maximize2, Minimize2,
  Printer, Link2, Sparkles, Stamp, BellRing, GraduationCap, Headphones, CalendarCheck,
  TrendingUp, Users, Palette, ImageIcon, ClipboardList, Timer, Handshake, PartyPopper,
  Coffee, Scissors, Presentation, ShieldCheck, Star,
} from "lucide-react";
import { waLink } from "@/components/offer/OfferCta";

/* ──────────────────────────── بيانات المنتجين ──────────────────────────── */

type ProductKey = "menu" | "nahjez";

type Tier = {
  name: string;
  price: number;        // السعر المعروض
  period: string;
  yearly: number;       // التكلفة السنوية (لحساب العائد)
  note: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
  loyalty: boolean;     // هل تشمل الولاء والهدايا
};

type CalcField = { key: string; label: string; min: number; max: number; step: number; def: number; unit: string };

type Product = {
  key: ProductKey;
  brand: string;
  accent: string;
  accentDeep: string;
  icon: LucideIcon;
  tagline: string;
  pitch: string;
  site: string;          // اسم "الموقع" بلغة المنتج
  stampWord: string;     // وحدة الختم
  reward: string;        // المكافأة الافتراضية
  features: { icon: LucideIcon; title: string; text: string }[];
  tiers: Tier[];
  defaultTier: number;
  fromClient: { icon: LucideIcon; text: string }[];
  fromUs: string[];
  calc: CalcField[];
  compute: (v: Record<string, number>) => { label: string; value: number; color: string }[];
};

const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (n: number) => Math.round(n).toLocaleString(LOCALE);

const PRODUCTS: Record<ProductKey, Product> = {
  menu: {
    key: "menu",
    brand: "قائمة الطلبات",
    accent: "#8B5CF6",
    accentDeep: "#6D28D9",
    icon: QrCode,
    tagline: "منيو إلكتروني ونظام كاشير متكامل",
    pitch: "مطعمك يستقبل الطلبات أونلاين، يقلّل الأخطاء، ويرجّع عملاءه من نفسهم.",
    site: "المنيو الإلكتروني",
    stampWord: "زيارة",
    reward: "الكوب الخامس مجاناً",
    features: [
      { icon: QrCode, title: "منيو رقمي بمسح باركود", text: "صور وسعرات ومكوّنات، تعدّله في ثوانٍ بلا تكلفة طباعة." },
      { icon: CreditCard, title: "طلب ودفع إلكتروني", text: "العميل يطلب ويدفع ويختار طريقة الاستلام — أخطاء أقل." },
      { icon: Store, title: "الطاولات والحجوزات والفروع", text: "طلب ودفع من الطاولة، حجوزات، دور، وعدة فروع." },
      { icon: MonitorSmartphone, title: "كاشير موحّد", text: "كل الطلبات على شاشة واحدة — تجهيز أسرع." },
      { icon: Bike, title: "توحيد طلبات التوصيل", text: "هنقرستيشن وجاهز وكيتا داخل كاشيرك بتقرير واحد." },
      { icon: Gift, title: "بطاقات الهدايا والولاء", text: "عميلك يرجع لك عشان الختم القادم — ولاء بلا إعلانات." },
    ],
    tiers: [
      { name: "الأساسية", price: 349, period: "ريال/سنة", yearly: 349, note: "منيو رقمي كامل", loyalty: false,
        features: ["منيو رقمي بكل التفاصيل", "صور وسعرات ومكوّنات", "تحديث فوري بلا طباعة"] },
      { name: "VIP", price: 879, period: "ريال/سنة", yearly: 879, note: "لمطاعم الجلوس والوجهات المزدحمة", loyalty: false,
        features: ["منيو رقمي كامل", "طلب ودفع إلكتروني", "الطلب من الطاولة", "الحجوزات والدور", "الفروع والدومين والبيكسل"] },
      { name: "VIP بلس", price: 1079, period: "ريال/سنة", yearly: 1079, note: "الأقوى — ولاء وهدايا وفودكس", loyalty: true,
        highlight: true, badge: "الموصى بها", features: ["كل مزايا VIP", "بطاقات الهدايا والولاء", "مزامنة فودكس Foodics"] },
      { name: "الكاشير", price: 1349, period: "ريال/سنة", yearly: 1349, note: "نظام فقط بدون أجهزة · فرع واحد", loyalty: false,
        features: ["نظام كاشير متكامل", "بدون أجهزة", "كل فرع إضافي ٢٤٩ ريال"] },
    ],
    defaultTier: 2,
    fromClient: [
      { icon: Palette, text: "الشعار والهوية (الألوان والخط)" },
      { icon: ClipboardList, text: "المنيو: الأصناف والأقسام والأسعار" },
      { icon: ImageIcon, text: "صور الأصناف (أو نصوّرها لك بالتنسيق)" },
      { icon: Coffee, text: "السعرات والمكوّنات والإضافات" },
      { icon: Store, text: "الفروع وأوقات العمل وعدد الطاولات" },
      { icon: Wallet, text: "بيانات حساب الدفع الإلكتروني" },
    ],
    fromUs: [
      "بناء المنيو كامل بهوية مطعمك",
      "رفع الأصناف والصور والتنسيق",
      "إعداد الطلب والدفع وطرق الاستلام",
      "تجهيز باركود الطاولات للطباعة",
      "ربط الدومين والبيكسل والفروع",
      "تجربة طلب كاملة قبل الإطلاق",
    ],
    calc: [
      { key: "orders", label: "طلبات يومياً", min: 10, max: 600, step: 5, def: 80, unit: "طلب" },
      { key: "ticket", label: "متوسط الفاتورة", min: 10, max: 300, step: 5, def: 45, unit: "ريال" },
      { key: "uplift", label: "زيادة الزيارات بالولاء", min: 0, max: 30, step: 1, def: 8, unit: "٪" },
      { key: "delivery", label: "طلبات توصيل يومياً", min: 0, max: 300, step: 5, def: 25, unit: "طلب" },
      { key: "shift", label: "نسبة تتحوّل لطلب مباشر", min: 0, max: 50, step: 1, def: 10, unit: "٪" },
      { key: "printing", label: "تكلفة طباعة المنيو سنوياً", min: 0, max: 6000, step: 100, def: 1200, unit: "ريال" },
    ],
    compute: (v) => [
      { label: "زيارات إضافية من الولاء", value: v.orders * 30 * v.ticket * (v.uplift / 100), color: "var(--acc)" },
      { label: "عمولات توصيل موفّرة", value: v.delivery * 30 * (v.shift / 100) * v.ticket * 0.2, color: "#F5B301" },
      { label: "توفير الطباعة", value: v.printing / 12, color: "#38BDF8" },
    ],
  },
  nahjez: {
    key: "nahjez",
    brand: "نحجز",
    accent: "#14B8A6",
    accentDeep: "#0F766E",
    icon: CalendarCheck,
    tagline: "منصة حجوزات لصالونك ومركزك",
    pitch: "عميلاتك يحجزن بأنفسهن ٢٤ ساعة، الغياب ينخفض، ودخلك يرتفع.",
    site: "صفحة الحجز",
    stampWord: "زيارة",
    reward: "الجلسة الخامسة مجاناً",
    features: [
      { icon: Globe, title: "موقع باسم صالونك", text: "خدماتك وأسعارك وفريقك وأوقاتك برابط واحد." },
      { icon: Clock, title: "حجز ذاتي ٢٤/٧", text: "العميلة تختار الخدمة والموظفة والوقت بلا تعارض." },
      { icon: MessageCircle, title: "تأكيد وتذكير واتساب", text: "رسائل تلقائية — الغياب ينخفض أكثر من ٥٠٪." },
      { icon: Wallet, title: "عربون بدون عمولة", text: "يضمن الجدّية، والمبلغ يوصل حسابك مباشرة." },
      { icon: LayoutDashboard, title: "لوحة تحكم وتقارير", text: "إيراداتك وأوقات الذروة وملفات العميلات." },
      { icon: Gift, title: "بطاقات الهدايا والولاء", text: "سيولة مقدّمة وعميلات جدد بلا إعلانات." },
    ],
    tiers: [
      { name: "الأساسية", price: 59, period: "ريال/شهر", yearly: 599, note: "أو ٥٩٩ سنوياً — موقع عرض بدون حجوزات", loyalty: false,
        features: ["صفحة باسم مركزك", "الخدمات والأسعار", "صور الفريق والتقييمات", "روابط التواصل وأوقات العمل"] },
      { name: "نمو الأعمال", price: 120, period: "ريال/شهر", yearly: 1149, note: "أو ١١٤٩ سنوياً · وفّر ٢٩١", loyalty: true,
        highlight: true, badge: "الموصى بها",
        features: ["كل مزايا الأساسية", "حجز أونلاين ونظام حجوزات", "تأكيد وتذكير واتساب", "عربون بدون عمولة", "تقارير ولوحة تحكم", "متجر وفروع + هدايا وولاء"] },
    ],
    defaultTier: 1,
    fromClient: [
      { icon: Palette, text: "الشعار والهوية (الألوان والخط)" },
      { icon: Scissors, text: "الخدمات ومدّة كل خدمة وأسعارها" },
      { icon: Users, text: "الموظفات وتخصّص كل وحدة" },
      { icon: ImageIcon, text: "صور المكان والأعمال السابقة" },
      { icon: Clock, text: "أوقات العمل والإجازات" },
      { icon: Wallet, text: "سياسة العربون وبيانات حساب الدفع" },
    ],
    fromUs: [
      "بناء صفحة الحجز بهوية صالونك",
      "إدخال الخدمات والموظفات والجداول",
      "إعداد رسائل التأكيد والتذكير واتساب",
      "تفعيل العربون والدفع الإلكتروني",
      "ربط الرابط بالإنستقرام وقوقل ماب",
      "تجربة حجز كاملة قبل الإطلاق",
    ],
    calc: [
      { key: "bookings", label: "حجوزات شهرياً", min: 20, max: 1500, step: 10, def: 200, unit: "حجز" },
      { key: "price", label: "متوسط سعر الخدمة", min: 30, max: 1000, step: 10, def: 150, unit: "ريال" },
      { key: "noshow", label: "نسبة الغياب الحالية", min: 0, max: 40, step: 1, def: 15, unit: "٪" },
      { key: "uplift", label: "زيادة الزيارات بالولاء", min: 0, max: 30, step: 1, def: 6, unit: "٪" },
      { key: "gifts", label: "بطاقات هدايا شهرياً", min: 0, max: 100, step: 1, def: 8, unit: "بطاقة" },
      { key: "giftValue", label: "متوسط قيمة البطاقة", min: 50, max: 1000, step: 25, def: 200, unit: "ريال" },
    ],
    compute: (v) => [
      { label: "مواعيد مستردّة من الغياب", value: v.bookings * (v.noshow / 100) * 0.5 * v.price, color: "var(--acc)" },
      { label: "زيارات إضافية من الولاء", value: v.bookings * v.price * (v.uplift / 100), color: "#38BDF8" },
      { label: "سيولة بطاقات الهدايا", value: v.gifts * v.giftValue, color: "#F5B301" },
    ],
  },
};

const GOLD = "#F5B301";

/* ──────────────────────────── فصول الاجتماع ──────────────────────────── */

const CHAPTERS = [
  { id: "intro", label: "البداية", icon: Handshake },
  { id: "system", label: "النظام", icon: Sparkles },
  { id: "pricing", label: "الباقات", icon: Star },
  { id: "activation", label: "التفعيل", icon: Rocket },
  { id: "site", label: "تجهيز الموقع", icon: Globe },
  { id: "loyalty", label: "الولاء", icon: Stamp },
  { id: "gift", label: "الهدايا", icon: Gift },
  { id: "training", label: "التدريب", icon: GraduationCap },
  { id: "followup", label: "المتابعة", icon: Headphones },
  { id: "results", label: "النتائج", icon: TrendingUp },
  { id: "next", label: "الخطوة التالية", icon: Check },
] as const;

const ACTIVATION = [
  { day: 0, title: "الاشتراك والترحيب", text: "اختيار الباقة، تفعيل الحساب، وفتح قروب واتساب خاص بمشروعك." },
  { day: 1, title: "استلام البيانات", text: "نرسل لك قائمة مختصرة بما نحتاجه — ترسله صور أو ملفات على راحتك." },
  { day: 2, title: "بناء الموقع", text: "فريقنا يبني كل شي بهويتك ويرفع البيانات والصور." },
  { day: 4, title: "تجهيز الولاء والهدايا", text: "تصميم بطاقة الولاء وبطاقات الهدايا وربطها بالمحفظة." },
  { day: 5, title: "المراجعة والاعتماد", text: "نعرض عليك النسخة النهائية وتعدّل اللي تبغاه قبل الإطلاق." },
  { day: 6, title: "تدريب الفريق", text: "جلسات قصيرة عملية للإدارة والموظفين." },
  { day: 7, title: "الإطلاق", text: "نطلق معك رسمياً ونكون جنبك أول أسبوع لحظة بلحظة." },
];

const TRAINING = [
  { icon: LayoutDashboard, who: "المالك / الإدارة", mins: 45, items: ["لوحة التحكم والتقارير", "تعديل الأسعار والأصناف", "متابعة الولاء والهدايا"] },
  { icon: MonitorSmartphone, who: "الكاشير / الاستقبال", mins: 30, items: ["استقبال الطلبات والحجوزات", "ختم بطاقة الولاء", "صرف بطاقة الهدية"] },
  { icon: Users, who: "فريق الخدمة", mins: 20, items: ["شرح الباركود للعميل", "دعوة العميل لبطاقة الولاء", "حالات شائعة وحلولها"] },
];

const FOLLOWUP = [
  { when: "الأسبوع الأول", icon: Rocket, title: "مرافقة الإطلاق", text: "متابعة يومية، نحل أي ملاحظة بنفس اليوم." },
  { when: "الأسبوع الثاني", icon: ClipboardList, title: "مراجعة الاستخدام", text: "نشوف وش يشتغل وش يحتاج تحسين ونعدّله." },
  { when: "نهاية الشهر الأول", icon: TrendingUp, title: "تقرير الأداء الأول", text: "أرقام الطلبات/الحجوزات والولاء، وخطة الشهر الجاي." },
  { when: "كل ربع سنة", icon: Presentation, title: "جلسة نمو", text: "أفكار حملات للمواسم: رمضان، العيد، اليوم الوطني، الصيف." },
  { when: "طوال الاشتراك", icon: Headphones, title: "دعم فني مستمر", text: "واتساب مباشر مع فريق يعرف مشروعك بالاسم." },
];

/* ──────────────────────────── أدوات صغيرة ──────────────────────────── */

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const dayLabel = (d: Date) => d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Chapter({ id, n, kicker, title, lead, children }: {
  id: string; n: number; kicker: string; title: React.ReactNode; lead?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} data-chapter={id} className="mp-chapter relative scroll-mt-28 px-4 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-3 flex items-center gap-3 text-sm font-bold" style={{ color: "var(--acc)" }}>
            <span className="grid h-8 w-8 place-items-center rounded-full border text-xs" style={{ borderColor: "var(--acc)" }}>
              {fmt(n)}
            </span>
            {kicker}
          </div>
          <h2 className="text-3xl font-black leading-tight text-white sm:text-5xl">{title}</h2>
          {lead && <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">{lead}</p>}
        </Reveal>
        <div className="mt-10 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}

const card = "rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm";

/* ──────────────────────────── الصفحة ──────────────────────────── */

const noop = () => () => {};

// الصفحة تعتمد على تاريخ/ساعة جهاز العارض — نرسمها على المتصفح فقط
export default function MeetingPlan() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <div className="min-h-screen bg-[#070A12]" />;
  return <MeetingPlanInner />;
}

function MeetingPlanInner() {
  const params = useSearchParams();
  const [productKey, setProductKey] = useState<ProductKey>(params.get("p") === "nahjez" ? "nahjez" : "menu");
  const P = PRODUCTS[productKey];
  const [client, setClient] = useState(params.get("c") ?? "");
  const [tierIdx, setTierIdx] = useState<number>(() => {
    const t = Number(params.get("t") ?? NaN);
    return Number.isInteger(t) && t >= 0 && t < P.tiers.length ? t : P.defaultTier;
  });
  const tier = P.tiers[Math.min(tierIdx, P.tiers.length - 1)];

  const [active, setActive] = useState<string>("intro");
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [startAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  // checklist / demos
  const [ready, setReady] = useState<boolean[]>(() => Array(6).fill(false));
  const [stampsTotal, setStampsTotal] = useState(5);
  const [stamps, setStamps] = useState(2);
  const [reward, setReward] = useState(P.reward);
  const [giftAmount, setGiftAmount] = useState(200);
  const [giftTo, setGiftTo] = useState("نورة");
  const [calc, setCalc] = useState<Record<string, number>>(() => Object.fromEntries(P.calc.map((f) => [f.key, f.def])));

  const switchProduct = (k: ProductKey) => {
    if (k === productKey) return;
    const np = PRODUCTS[k];
    setProductKey(k);
    setTierIdx(np.defaultTier);
    setReward(np.reward);
    setReady(Array(6).fill(false));
    setCalc(Object.fromEntries(np.calc.map((f) => [f.key, f.def])));
  };

  // مزامنة الرابط ليصير قابل للمشاركة
  useEffect(() => {
    const q = new URLSearchParams();
    q.set("p", productKey);
    if (client.trim()) q.set("c", client.trim());
    q.set("t", String(tierIdx));
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  }, [productKey, client, tierIdx]);

  // ساعة الاجتماع
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.floor((now - startAt) / 1000);
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  // تتبّع الفصل الحالي
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-chapter]"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.chapter!); });
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const activeIdx = CHAPTERS.findIndex((c) => c.id === active);
  const goTo = useCallback((i: number) => {
    const c = CHAPTERS[Math.max(0, Math.min(CHAPTERS.length - 1, i))];
    document.getElementById(c.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // تنقّل بالكيبورد (عربي: اليسار = التالي)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft" || e.key === "PageDown") { e.preventDefault(); goTo(activeIdx + 1); }
      if (e.key === "ArrowRight" || e.key === "PageUp") { e.preventDefault(); goTo(activeIdx - 1); }
      if (e.key.toLowerCase() === "f") toggleFs();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  const today = useMemo(() => new Date(), []);
  const launchDate = addDays(today, 7);
  const who = client.trim() || "عميلنا العزيز";

  const parts = P.compute(calc);
  const monthly = parts.reduce((s, p) => s + p.value, 0);
  const yearly = monthly * 12;
  const roi = tier.yearly > 0 ? yearly / tier.yearly : 0;
  const paybackDays = monthly > 0 ? Math.max(1, Math.ceil(tier.yearly / (monthly / 30))) : 0;
  const readyCount = ready.filter(Boolean).length;

  const summaryMsg =
    `السلام عليكم، ملخص اجتماعنا اليوم:\n` +
    `• العميل: ${who}\n• النظام: ${P.brand}\n• الباقة: ${tier.name} — ${fmt(tier.price)} ${tier.period}\n` +
    `• موعد الإطلاق المتوقع: ${launchDate.toLocaleDateString(LOCALE, { day: "numeric", month: "long" })}\n` +
    `• العائد الشهري المتوقع: ~${fmt(monthly)} ريال\n\nنبدأ بإذن الله 🚀`;

  return (
    <div
      dir="rtl"
      className="mp-root min-h-screen w-full overflow-x-hidden bg-[#070A12] text-slate-200"
      style={{ ["--acc" as string]: P.accent, ["--acc-deep" as string]: P.accentDeep, fontFamily: "var(--font-tajawal), system-ui, sans-serif" } as React.CSSProperties}
    >
      <style>{`
        html { scroll-behavior: smooth; }
        .mp-root ::selection { background: var(--acc); color: white; }
        .mp-glow { background: radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--acc) 35%, transparent), transparent 70%); }
        .mp-grid { background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px); background-size: 48px 48px; mask-image: radial-gradient(70% 60% at 50% 30%, black, transparent); }
        .mp-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; background: rgba(255,255,255,.08); outline: none; }
        .mp-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 999px; background: white; border: 4px solid var(--acc); cursor: pointer; box-shadow: 0 0 0 6px color-mix(in srgb, var(--acc) 20%, transparent); }
        .mp-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 999px; background: white; border: 4px solid var(--acc); cursor: pointer; }
        @keyframes mp-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-10px) rotate(-1deg); } }
        .mp-float { animation: mp-float 6s ease-in-out infinite; }
        @keyframes mp-pop { 0% { transform: scale(.4); opacity: 0; } 70% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
        .mp-pop { animation: mp-pop .35s ease-out both; }
        @keyframes mp-shine { from { transform: translateX(120%) skewX(-20deg); } to { transform: translateX(-220%) skewX(-20deg); } }
        .mp-shine::after { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent); animation: mp-shine 3.5s ease-in-out infinite; }
        @media print {
          .mp-noprint { display: none !important; }
          .mp-root { background: white !important; color: #111 !important; }
          .mp-chapter { break-inside: avoid; padding-top: 24px !important; padding-bottom: 24px !important; }
          .mp-root * { color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* ─── شريط علوي ─── */}
      <header className="mp-noprint fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#070A12]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" }}>
              <P.icon size={18} />
            </span>
            <div className="hidden leading-tight sm:block">
              <div className="text-sm font-black text-white">{P.brand}</div>
              <div className="text-[11px] text-slate-500">خطة الانطلاق</div>
            </div>
          </div>

          <div className="mx-auto flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs font-bold">
            {(Object.keys(PRODUCTS) as ProductKey[]).map((k) => (
              <button
                key={k}
                onClick={() => switchProduct(k)}
                className="rounded-full px-3 py-1.5 transition-colors sm:px-4"
                style={productKey === k ? { background: PRODUCTS[k].accent, color: "white" } : { color: "#94a3b8" }}
              >
                {PRODUCTS[k].brand}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 font-mono text-xs text-slate-400 md:flex" title="مدة الاجتماع">
              <Timer size={13} /> {clock}
            </span>
            <IconBtn onClick={copyLink} title="نسخ رابط الاجتماع">{copied ? <Check size={16} /> : <Link2 size={16} />}</IconBtn>
            <IconBtn onClick={() => window.print()} title="طباعة / PDF"><Printer size={16} /></IconBtn>
            <IconBtn onClick={toggleFs} title="وضع العرض (F)">{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</IconBtn>
          </div>
        </div>
        {/* الأجندة */}
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2.5 sm:px-6 [scrollbar-width:none]">
          {CHAPTERS.map((c, i) => {
            const on = c.id === active;
            const done = i < activeIdx;
            return (
              <button
                key={c.id}
                onClick={() => goTo(i)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all"
                style={on ? { background: "color-mix(in srgb, var(--acc) 22%, transparent)", color: "white", boxShadow: "inset 0 0 0 1px var(--acc)" } : { color: done ? "#cbd5e1" : "#64748b" }}
              >
                {done ? <Check size={12} style={{ color: "var(--acc)" }} /> : <c.icon size={12} />}
                {c.label}
              </button>
            );
          })}
        </nav>
        <div className="h-[2px] bg-white/[0.04]">
          <div className="h-full transition-all duration-500" style={{ width: `${((activeIdx + 1) / CHAPTERS.length) * 100}%`, background: "linear-gradient(90deg, var(--acc), " + GOLD + ")" }} />
        </div>
      </header>

      {/* ─── ٠. الغلاف ─── */}
      <section id="intro" data-chapter="intro" className="mp-chapter relative flex min-h-[100svh] items-center overflow-hidden px-4 pb-16 pt-36 sm:px-8">
        <div className="mp-glow pointer-events-none absolute inset-0" />
        <div className="mp-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-bold text-slate-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "var(--acc)" }} />
              خطة انطلاق مُعدّة خصيصاً · {today.toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <h1 className="text-4xl font-black leading-[1.15] text-white sm:text-6xl">
              أهلاً
              <input
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="اسم العميل / المنشأة"
                className="mp-noprint mx-2 inline-block w-[8.5em] max-w-full rounded-xl border border-dashed border-white/20 bg-transparent px-2 align-baseline text-[0.85em] font-black outline-none placeholder:text-slate-600 focus:border-[var(--acc)]"
                style={{ color: "var(--acc)" }}
              />
              <span className="hidden print:inline" style={{ color: "var(--acc)" }}>{who}</span>
              <br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, #fff, ${GOLD})` }}>
                خلّنا نرسم طريق نجاحك
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              {P.pitch} في هذا الاجتماع نمشي معك خطوة بخطوة: من الاشتراك إلى الإطلاق، ومن تدريب فريقك إلى أول تقرير نتائج.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => goTo(1)} className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-extrabold text-white shadow-2xl transition-transform hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", boxShadow: "0 20px 50px -15px var(--acc)" }}>
                ابدأ العرض <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-2 rounded-full border border-white/10 px-5 py-3.5 text-sm text-slate-400">
                <Rocket size={16} style={{ color: GOLD }} /> الإطلاق خلال <b className="text-white">٧ أيام</b>
              </div>
            </div>
          </Reveal>

          {/* خريطة الاجتماع */}
          <Reveal delay={150}>
            <div className={`${card} p-6`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-black text-white">أجندة الاجتماع</div>
                <div className="text-xs text-slate-500">~ ٣٠ دقيقة</div>
              </div>
              <ol className="space-y-1">
                {CHAPTERS.slice(1).map((c, i) => (
                  <li key={c.id}>
                    <button onClick={() => goTo(i + 1)} className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right transition-colors hover:bg-white/[0.04]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-slate-400 transition-colors group-hover:text-white" style={{}}>
                        <c.icon size={15} />
                      </span>
                      <span className="flex-1 text-sm font-bold text-slate-300 group-hover:text-white">{c.label}</span>
                      <span className="font-mono text-[11px] text-slate-600">{String(i + 1).padStart(2, "0")}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── ١. النظام ─── */}
      <Chapter id="system" n={1} kicker="تعرّف على النظام" title={<>{P.brand} — <span style={{ color: "var(--acc)" }}>{P.tagline}</span></>} lead="كل اللي يحتاجه مشروعك في مكان واحد، بدون تعقيد ولا أجهزة إضافية.">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {P.features.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className={`${card} group h-full p-6 transition-all hover:-translate-y-1 hover:border-[var(--acc)]/40`}>
                  <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl text-white transition-transform group-hover:scale-110" style={{ background: "color-mix(in srgb, var(--acc) 18%, transparent)", color: "var(--acc)" }}>
                    <f.icon size={22} />
                  </span>
                  <div className="text-lg font-black text-white">{f.title}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200} className="hidden lg:block">
            <PhoneMock product={P} who={who} />
          </Reveal>
        </div>
      </Chapter>

      {/* ─── ٢. الباقات ─── */}
      <Chapter id="pricing" n={2} kicker="الباقات والأسعار" title="اختر الباقة اللي تناسب مرحلتك" lead="اضغط على الباقة لاختيارها — كل الحسابات في العرض تتحدّث عليها مباشرة. دعم فني لجميع الباقات.">
        <div className={`grid gap-4 ${P.tiers.length > 2 ? "sm:grid-cols-2 lg:grid-cols-4" : "mx-auto max-w-3xl sm:grid-cols-2"}`}>
          {P.tiers.map((t, i) => {
            const sel = i === tierIdx;
            return (
              <Reveal key={t.name} delay={i * 70}>
                <button
                  onClick={() => setTierIdx(i)}
                  className={`relative flex h-full w-full flex-col rounded-3xl border p-6 text-right transition-all ${sel ? "-translate-y-1" : "hover:-translate-y-0.5"}`}
                  style={sel
                    ? { borderColor: "var(--acc)", background: "linear-gradient(180deg, color-mix(in srgb, var(--acc) 16%, transparent), rgba(255,255,255,.02))", boxShadow: "0 30px 60px -30px var(--acc)" }
                    : { borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)" }}
                >
                  {t.badge && (
                    <span className="absolute -top-3 left-5 rounded-full px-3 py-1 text-[11px] font-black text-[#1a1306]" style={{ background: GOLD }}>{t.badge}</span>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-white">{t.name}</span>
                    <span className="grid h-6 w-6 place-items-center rounded-full border-2 transition-colors" style={{ borderColor: sel ? "var(--acc)" : "rgba(255,255,255,.2)", background: sel ? "var(--acc)" : "transparent" }}>
                      {sel && <Check size={13} className="text-white" />}
                    </span>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-white">{fmt(t.price)}</span>
                    <span className="text-sm text-slate-400">{t.period}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{t.note}</p>
                  <ul className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                        <Check size={15} className="mt-0.5 shrink-0" style={{ color: "var(--acc)" }} /> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              </Reveal>
            );
          })}
        </div>
        {!tier.loyalty && (
          <Reveal>
            <p className="mt-6 text-center text-sm text-slate-500">
              💡 بطاقات الولاء والهدايا متاحة في باقة <b className="text-slate-300">{P.tiers.find((t) => t.loyalty)?.name}</b> — وهي اللي تصنع العميل المتكرّر.
            </p>
          </Reveal>
        )}
      </Chapter>

      {/* ─── ٣. التفعيل ─── */}
      <Chapter id="activation" n={3} kicker="خطوات التفعيل" title={<>من اليوم إلى الإطلاق في <span style={{ color: GOLD }}>٧ أيام</span></>} lead="أنت تركّز على مشروعك، وفريقنا يتكفّل بالباقي. هذا جدولك الفعلي بالتواريخ:">
        <div className="relative">
          <div className="absolute bottom-0 right-[19px] top-0 w-px bg-gradient-to-b from-[var(--acc)] via-white/10 to-[#F5B301] md:hidden" />
          <div className="absolute left-0 right-0 top-[19px] hidden h-px bg-gradient-to-l from-[var(--acc)] via-white/10 to-[#F5B301] md:block" />
          <ol className="grid gap-6 md:grid-cols-7 md:gap-3">
            {ACTIVATION.map((s, i) => {
              const last = i === ACTIVATION.length - 1;
              return (
                <Reveal key={s.title} delay={i * 80}>
                  <li className="relative flex gap-4 md:flex-col md:gap-3">
                    <span
                      className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black"
                      style={last ? { background: GOLD, color: "#1a1306", boxShadow: `0 0 0 6px ${GOLD}22` } : { background: "#0d1220", color: "var(--acc)", boxShadow: "inset 0 0 0 2px var(--acc)" }}
                    >
                      {last ? <Rocket size={17} /> : fmt(i + 1)}
                    </span>
                    <div>
                      <div className="text-[11px] font-bold text-slate-500">{s.day === 0 ? "اليوم" : `يوم ${fmt(s.day)}`} · {dayLabel(addDays(today, s.day))}</div>
                      <div className="mt-0.5 font-black text-white">{s.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{s.text}</p>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </Chapter>

      {/* ─── ٤. تجهيز الموقع ─── */}
      <Chapter id="site" n={4} kicker="خدمة ما بعد البيع · تجهيز الموقع" title={<>نجهّز {P.site} <span style={{ color: "var(--acc)" }}>معك</span>، مو بس لك</>} lead="قائمة واضحة: اللي نحتاجه منك، واللي علينا. علّم على اللي جاهز عندك الحين.">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_260px]">
          <Reveal>
            <div className={`${card} h-full p-6`}>
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><ClipboardList size={16} style={{ color: GOLD }} /> منك</div>
              <ul className="space-y-2">
                {P.fromClient.map((it, i) => (
                  <li key={it.text}>
                    <button
                      onClick={() => setReady((r) => r.map((v, j) => (j === i ? !v : v)))}
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] px-3 py-3 text-right transition-all hover:bg-white/[0.03]"
                      style={ready[i] ? { borderColor: "color-mix(in srgb, var(--acc) 50%, transparent)", background: "color-mix(in srgb, var(--acc) 8%, transparent)" } : {}}
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-colors" style={{ borderColor: ready[i] ? "var(--acc)" : "rgba(255,255,255,.18)", background: ready[i] ? "var(--acc)" : "transparent" }}>
                        {ready[i] && <Check size={13} className="mp-pop text-white" />}
                      </span>
                      <it.icon size={16} className="shrink-0 text-slate-500" />
                      <span className={`text-sm font-bold ${ready[i] ? "text-white" : "text-slate-300"}`}>{it.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className={`${card} h-full p-6`}>
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-white"><ShieldCheck size={16} style={{ color: "var(--acc)" }} /> علينا</div>
              <ul className="space-y-3">
                {P.fromUs.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-slate-300">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--acc) 20%, transparent)" }}>
                      <Check size={12} style={{ color: "var(--acc)" }} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className={`${card} flex h-full flex-col items-center justify-center p-6 text-center`}>
              <Ring value={readyCount / P.fromClient.length} />
              <div className="mt-4 text-sm font-black text-white">جاهزية البيانات</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {readyCount === P.fromClient.length ? "كل شي جاهز — نقدر نبدأ البناء اليوم 🎉" : `باقي ${fmt(P.fromClient.length - readyCount)} — نرسل لك القائمة على الواتساب`}
              </p>
            </div>
          </Reveal>
        </div>
      </Chapter>

      {/* ─── ٥. الولاء ─── */}
      <Chapter id="loyalty" n={5} kicker="تجهيز نظام بطاقات الولاء" title={<>عميلك يرجع لك <span style={{ color: "var(--acc)" }}>من نفسه</span></>} lead="بطاقة ختم رقمية في محفظة آبل وقوقل — بدون تطبيق. جرّب: اضغط على البطاقة وأضف ختم.">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="mx-auto w-full max-w-md">
              <button
                onClick={() => setStamps((s) => (s >= stampsTotal ? 0 : s + 1))}
                className="mp-shine relative block w-full overflow-hidden rounded-[28px] p-6 text-right text-white shadow-2xl transition-transform active:scale-[.98]"
                style={{ background: `linear-gradient(135deg, var(--acc-deep), var(--acc) 60%, ${GOLD}aa)`, boxShadow: "0 40px 80px -30px var(--acc)" }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold opacity-75">بطاقة الولاء</div>
                    <div className="mt-0.5 text-xl font-black">{who}</div>
                  </div>
                  <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-bold">Wallet</span>
                </div>
                <div className="mt-6 grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(stampsTotal, 5)}, minmax(0, 1fr))` }}>
                  {Array.from({ length: stampsTotal }).map((_, i) => (
                    <span key={i} className="grid aspect-square place-items-center rounded-full border-2 border-dashed border-white/40 bg-white/10">
                      {i < stamps && (
                        <span key={stamps} className="mp-pop grid h-[80%] w-[80%] place-items-center rounded-full bg-white" style={{ color: "var(--acc-deep)" }}>
                          {i === stampsTotal - 1 ? <Gift size={18} /> : <P.icon size={18} />}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="font-bold">{fmt(stamps)} / {fmt(stampsTotal)} {P.stampWord}</span>
                  <span className="opacity-80">{reward}</span>
                </div>
                {stamps >= stampsTotal && (
                  <div className="mp-pop absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-sm">
                    <div className="text-center">
                      <PartyPopper size={40} className="mx-auto" style={{ color: GOLD }} />
                      <div className="mt-2 text-2xl font-black">مبروك! {reward}</div>
                      <div className="mt-1 text-xs opacity-75">اضغط للبدء من جديد</div>
                    </div>
                  </div>
                )}
              </button>

              {/* إشعار قرب المحل */}
              <div className="mx-auto mt-5 flex max-w-sm items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: "var(--acc)" }}><BellRing size={16} /></span>
                <div className="text-xs leading-relaxed">
                  <div className="font-black text-white">{who} · الآن</div>
                  <div className="text-slate-400">أنت قريب منّا 👋 باقي لك {fmt(Math.max(stampsTotal - stamps, 0))} {P.stampWord} على {reward}!</div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-5">
              <div className={`${card} p-5`}>
                <div className="mb-3 text-sm font-black text-white">صمّم برنامجك الآن</div>
                <label className="mb-1.5 block text-xs text-slate-500">عدد الأختام للمكافأة</label>
                <div className="flex flex-wrap gap-2">
                  {[4, 5, 6, 8, 10].map((n) => (
                    <button key={n} onClick={() => { setStampsTotal(n); setStamps((s) => Math.min(s, n)); }}
                      className="h-10 w-12 rounded-xl border text-sm font-black transition-colors"
                      style={stampsTotal === n ? { borderColor: "var(--acc)", background: "var(--acc)", color: "white" } : { borderColor: "rgba(255,255,255,.1)", color: "#94a3b8" }}>
                      {fmt(n)}
                    </button>
                  ))}
                </div>
                <label className="mb-1.5 mt-4 block text-xs text-slate-500">المكافأة</label>
                <input value={reward} onChange={(e) => setReward(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-[var(--acc)]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { icon: QrCode, t: "يمسح ويضيف", d: "العميل يضيف البطاقة لمحفظته بثانية" },
                  { icon: Stamp, t: "يجمع الأختام", d: "الكاشير يختم مع كل زيارة" },
                  { icon: BellRing, t: "يتذكّرك", d: "إشعارات عند القرب وفي المواسم" },
                ].map((s) => (
                  <div key={s.t} className={`${card} p-4`}>
                    <s.icon size={18} style={{ color: "var(--acc)" }} />
                    <div className="mt-2 text-sm font-black text-white">{s.t}</div>
                    <div className="mt-1 text-xs leading-relaxed text-slate-500">{s.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Chapter>

      {/* ─── ٦. الهدايا ─── */}
      <Chapter id="gift" n={6} kicker="تجهيز بطاقات الهدايا" title={<>سيولة <span style={{ color: GOLD }}>قبل الخدمة</span> + عملاء جدد</>} lead="عميلك يهدي صديقه بطاقة باسم مشروعك — أنت تستلم المبلغ اليوم، وتكسب عميل جديد بكرة.">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal className="lg:order-2">
            <div className="mp-float relative mx-auto aspect-[1.6] w-full max-w-md overflow-hidden rounded-[28px] p-7 text-white shadow-2xl"
              style={{ background: `radial-gradient(120% 120% at 0% 0%, ${GOLD}, #b45309 45%, #1c1206)`, boxShadow: `0 40px 80px -30px ${GOLD}` }}>
              <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 right-10 h-48 w-48 rounded-full bg-black/20" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs font-bold opacity-80">بطاقة هدية</div>
                    <div className="text-lg font-black">{who}</div>
                  </div>
                  <Gift size={28} />
                </div>
                <div>
                  <div className="text-xs opacity-80">إلى: {giftTo || "—"}</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span key={giftAmount} className="mp-pop text-5xl font-black">{fmt(giftAmount)}</span>
                    <span className="text-sm font-bold opacity-80">ريال</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={120} className="lg:order-1">
            <div className="space-y-5">
              <div className={`${card} p-5`}>
                <div className="mb-3 text-sm font-black text-white">جرّب تصميم بطاقة</div>
                <div className="flex flex-wrap gap-2">
                  {[100, 200, 300, 500, 1000].map((a) => (
                    <button key={a} onClick={() => setGiftAmount(a)}
                      className="rounded-xl border px-4 py-2 text-sm font-black transition-colors"
                      style={giftAmount === a ? { borderColor: GOLD, background: GOLD, color: "#1a1306" } : { borderColor: "rgba(255,255,255,.1)", color: "#94a3b8" }}>
                      {fmt(a)}
                    </button>
                  ))}
                </div>
                <label className="mb-1.5 mt-4 block text-xs text-slate-500">اسم المُهدى إليه</label>
                <input value={giftTo} onChange={(e) => setGiftTo(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-[#F5B301]" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { e: "💰", t: "دخل مقدّم", d: "تستلم قيمة البطاقة فوراً قبل تقديم الخدمة" },
                  { e: "🧲", t: "عميل جديد مجاناً", d: "المُهدى إليه يجرّبك لأول مرة بلا تكلفة إعلان" },
                  { e: "🌙", t: "مواسم ذهبية", d: "رمضان، العيد، اليوم الوطني، المناسبات" },
                  { e: "🔗", t: "رابط شراء مباشر", d: "تُشترى أونلاين وتُرسل بالواتساب خلال ثوانٍ" },
                ].map((s) => (
                  <div key={s.t} className={`${card} flex gap-3 p-4`}>
                    <span className="text-2xl">{s.e}</span>
                    <div>
                      <div className="text-sm font-black text-white">{s.t}</div>
                      <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </Chapter>

      {/* ─── ٧. التدريب ─── */}
      <Chapter id="training" n={7} kicker="تدريب الموظفين" title="فريقك يتقن النظام من أول يوم" lead={`جلسات عملية قصيرة قبل الإطلاق (${dayLabel(addDays(today, 6))}) — حضورياً أو عن بُعد، مع دليل مختصر ومقاطع مسجّلة للرجوع لها.`}>
        <div className="grid gap-4 md:grid-cols-3">
          {TRAINING.map((s, i) => (
            <Reveal key={s.who} delay={i * 90}>
              <div className={`${card} h-full p-6`}>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: "color-mix(in srgb, var(--acc) 18%, transparent)", color: "var(--acc)" }}>
                    <s.icon size={22} />
                  </span>
                  <span className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-400">
                    <Clock size={12} /> {fmt(s.mins)} دقيقة
                  </span>
                </div>
                <div className="mt-4 text-lg font-black text-white">{s.who}</div>
                <ul className="mt-3 space-y-2">
                  {s.items.map((it) => (
                    <li key={it} className="flex items-center gap-2 text-sm text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--acc)" }} /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </Chapter>

      {/* ─── ٨. المتابعة ─── */}
      <Chapter id="followup" n={8} kicker="المتابعة المستمرة" title={<>ما نختفي بعد البيع — <span style={{ color: "var(--acc)" }}>نكبر معك</span></>} lead="مدير حساب يعرف مشروعك بالاسم، وخطة متابعة واضحة طوال فترة اشتراكك.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FOLLOWUP.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className={`${card} relative h-full overflow-hidden p-5`}>
                <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, var(--acc), ${GOLD})`, opacity: 0.35 + i * 0.15 }} />
                <div className="text-[11px] font-bold" style={{ color: "var(--acc)" }}>{f.when}</div>
                <f.icon size={20} className="mt-3 text-white" />
                <div className="mt-2 font-black text-white">{f.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Chapter>

      {/* ─── ٩. النتائج ─── */}
      <Chapter id="results" n={9} kicker="النتائج المتوقعة" title="خلّنا نحسبها بأرقامك أنت" lead={`حرّك المؤشرات حسب واقع مشروعك — والنتائج تتحدّث مباشرة على باقة «${tier.name}».`}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <Reveal>
            <div className={`${card} space-y-6 p-6`}>
              {P.calc.map((f) => (
                <div key={f.key}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-300">{f.label}</span>
                    <span className="font-black text-white">{fmt(calc[f.key])} <span className="text-xs font-bold text-slate-500">{f.unit}</span></span>
                  </div>
                  <input
                    type="range" min={f.min} max={f.max} step={f.step} value={calc[f.key]}
                    onChange={(e) => setCalc((c) => ({ ...c, [f.key]: Number(e.target.value) }))}
                    className="mp-range w-full"
                    style={{ background: `linear-gradient(to left, var(--acc) ${((calc[f.key] - f.min) / (f.max - f.min)) * 100}%, rgba(255,255,255,.08) 0)` }}
                    dir="rtl"
                  />
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-3xl p-7" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--acc) 30%, #0b0f1a), #0b0f1a)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--acc) 40%, transparent)" }}>
                <div className="text-sm font-bold text-slate-300">عائد إضافي متوقع شهرياً</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white sm:text-6xl">{fmt(monthly)}</span>
                  <span className="text-lg font-bold text-slate-400">ريال</span>
                </div>
                <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
                  {parts.map((p) => (
                    <div key={p.label} className="h-full transition-all duration-500" style={{ width: `${monthly ? (p.value / monthly) * 100 : 0}%`, background: p.color }} />
                  ))}
                </div>
                <ul className="mt-4 space-y-2">
                  {parts.map((p) => (
                    <li key={p.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.label}</span>
                      <span className="font-black text-white">{fmt(p.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="سنوياً" value={fmt(yearly)} unit="ريال" />
                <Stat label="تكلفة الباقة" value={fmt(tier.yearly)} unit="ريال/سنة" />
                <Stat label="العائد" value={`×${roi >= 10 ? fmt(roi) : roi.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}`} unit="من قيمة الاشتراك" accent />
              </div>
              <div className="flex items-center gap-3 rounded-2xl border p-4 text-sm" style={{ borderColor: `${GOLD}55`, background: `${GOLD}10` }}>
                <Sparkles size={20} style={{ color: GOLD }} className="shrink-0" />
                <span className="text-slate-300">
                  {paybackDays > 0
                    ? <>الاشتراك يسدّد قيمته خلال <b className="text-white">{fmt(paybackDays)} يوم</b> تقريباً — والباقي ربح صافي لك.</>
                    : "حرّك المؤشرات لرؤية العائد."}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                * تقديرات استرشادية مبنية على الأرقام المُدخلة{productKey === "menu" ? " (عمولة توصيل افتراضية ٢٠٪)" : " (انخفاض الغياب ٥٠٪ بالتذكير)"}، والنتائج الفعلية تختلف حسب النشاط والتطبيق.
              </p>
            </div>
          </Reveal>
        </div>
      </Chapter>

      {/* ─── ١٠. الخطوة التالية ─── */}
      <section id="next" data-chapter="next" className="mp-chapter relative overflow-hidden px-4 pb-32 pt-20 sm:px-8 sm:pt-28">
        <div className="mp-glow pointer-events-none absolute inset-0 rotate-180" />
        <div className="relative mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="mb-3 text-sm font-bold" style={{ color: "var(--acc)" }}>الخطوة التالية</div>
            <h2 className="text-3xl font-black leading-tight text-white sm:text-5xl">جاهزين نبدأ يا {who}؟</h2>
          </Reveal>
          <Reveal delay={100}>
            <div className={`${card} mx-auto mt-10 max-w-xl p-6 text-right`}>
              <div className="mb-4 text-xs font-bold text-slate-500">ملخص الاتفاق</div>
              {[
                ["النظام", P.brand],
                ["الباقة", `${tier.name} — ${fmt(tier.price)} ${tier.period}`],
                ["بداية التجهيز", dayLabel(addDays(today, 1))],
                ["الإطلاق المتوقع", launchDate.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" })],
                ["العائد الشهري المتوقع", `~ ${fmt(monthly)} ريال`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/[0.05] py-3 text-sm last:border-0">
                  <span className="text-slate-400">{k}</span>
                  <span className="font-black text-white">{v}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="mp-noprint mt-8 flex flex-wrap justify-center gap-3">
              <a href={waLink(summaryMsg)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-extrabold text-white transition-transform hover:-translate-y-0.5"
                style={{ background: "#16a34a", boxShadow: "0 20px 50px -15px #16a34a" }}>
                <MessageCircle size={18} /> أرسل الملخص واتساب
              </a>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 font-bold text-slate-200 hover:bg-white/[0.05]">
                <Printer size={17} /> حفظ PDF
              </button>
              <button onClick={copyLink} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 font-bold text-slate-200 hover:bg-white/[0.05]">
                {copied ? <Check size={17} /> : <Link2 size={17} />} {copied ? "تم النسخ" : "نسخ الرابط"}
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── تنقّل سفلي ─── */}
      <div className="mp-noprint fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#0d1220]/90 p-1.5 shadow-2xl backdrop-blur-xl">
        <button onClick={() => goTo(activeIdx - 1)} disabled={activeIdx <= 0} className="grid h-9 w-9 place-items-center rounded-full text-slate-300 hover:bg-white/10 disabled:opacity-30" aria-label="السابق">
          <ChevronRight size={18} />
        </button>
        <span className="min-w-[110px] px-2 text-center text-xs font-bold text-slate-300">
          {CHAPTERS[Math.max(0, activeIdx)].label} <span className="text-slate-600">· {fmt(Math.max(0, activeIdx) + 1)}/{fmt(CHAPTERS.length)}</span>
        </span>
        <button onClick={() => goTo(activeIdx + 1)} disabled={activeIdx >= CHAPTERS.length - 1} className="grid h-9 w-9 place-items-center rounded-full text-white disabled:opacity-30" style={{ background: "var(--acc)" }} aria-label="التالي">
          <ChevronLeft size={18} />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────── مكوّنات مساعدة ──────────────────────────── */

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
      {children}
    </button>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className={`${card} p-4`} style={accent ? { borderColor: `${GOLD}55` } : {}}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black sm:text-2xl" style={{ color: accent ? GOLD : "white" }}>{value}</div>
      <div className="text-[10px] text-slate-600">{unit}</div>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--acc)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-2xl font-black text-white">{fmt(value * 100)}٪</div>
    </div>
  );
}

function PhoneMock({ product, who }: { product: Product; who: string }) {
  const isMenu = product.key === "menu";
  const items = isMenu
    ? [["لاتيه مثلّج", "18"], ["كرواسون زعتر", "14"], ["سبانش لاتيه", "21"], ["كوكيز", "9"]]
    : [["قص وتصفيف", "120"], ["صبغة كاملة", "350"], ["مناكير وباديكير", "140"], ["بروتين", "600"]];
  return (
    <div className="mp-float relative mx-auto w-[280px] rounded-[44px] border border-white/10 bg-[#0b0f1a] p-3 shadow-2xl" style={{ boxShadow: "0 50px 100px -40px var(--acc)" }}>
      <div className="mx-auto mb-2 h-5 w-24 rounded-full bg-black" />
      <div className="overflow-hidden rounded-[32px] bg-[#f8f7f3] text-[#1f1b16]">
        <div className="p-5 text-white" style={{ background: "linear-gradient(135deg, var(--acc-deep), var(--acc))" }}>
          <div className="text-[10px] opacity-80">{isMenu ? "المنيو" : "احجزي موعدك"}</div>
          <div className="text-lg font-black">{who}</div>
        </div>
        <div className="flex gap-1.5 px-4 pt-3 text-[10px] font-bold">
          {(isMenu ? ["الكل", "مشروبات", "حلى"] : ["الكل", "شعر", "أظافر"]).map((t, i) => (
            <span key={t} className="rounded-full px-2.5 py-1" style={i === 0 ? { background: "var(--acc)", color: "white" } : { background: "#ebe8e0" }}>{t}</span>
          ))}
        </div>
        <ul className="space-y-2 p-4">
          {items.map(([n, p]) => (
            <li key={n} className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm">
              <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--acc) 15%, white)", color: "var(--acc-deep)" }}>
                {isMenu ? <Coffee size={16} /> : <Scissors size={16} />}
              </span>
              <span className="flex-1 text-xs font-bold">{n}</span>
              <span className="text-xs font-black" style={{ color: "var(--acc-deep)" }}>{p} ر.س</span>
            </li>
          ))}
        </ul>
        <div className="px-4 pb-5">
          <div className="rounded-2xl py-2.5 text-center text-xs font-black text-white" style={{ background: "var(--acc-deep)" }}>
            {isMenu ? "أكمل الطلب والدفع" : "احجزي الآن"}
          </div>
        </div>
      </div>
    </div>
  );
}
