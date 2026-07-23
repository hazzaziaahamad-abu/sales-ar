"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Clock,
  MessageCircle,
  Wallet,
  LayoutDashboard,
  Store,
  Gift,
  Star,
  TrendingUp,
  Target,
  Flame,
  ShieldCheck,
  X,
} from "lucide-react";

/* ---------- brand tokens ---------- */
const INK = "#40332b";
const PAPER = "#fbfaf5";
const GRID = "#dbe4f2";
const NOTE = "#FCC9B9"; // soft coral-peach
const NOTE_EDGE = "#F3A48E";
const PURPLE = "#6D28D9";
const PURPLE_DEEP = "#5B21B6";
const GOLD = "#F5B301";

type Mode = "product" | "rep";

const PKG_STYLE: Record<string, { bg: string; fg: string }> = {
  "كل الباقات": { bg: "#E9E4F7", fg: "#5B21B6" },
  الأساسية: { bg: "#CCFBF1", fg: "#0F766E" },
  "نمو الأعمال": { bg: "#FBE7C0", fg: "#92400E" },
};

const TAPE: Record<string, string> = {
  violet: "#C4B5FD",
  emerald: "#6EE7B7",
  amber: "#FCD34D",
  indigo: "#A5B4FC",
};

/* ---------- sales-training data ---------- */
type SellStep = { n: string; t: string; d: string };
const SELL_PATH: SellStep[] = [
  { n: "١", t: "اسأل", d: "صالونك يستقبل حجوزاته كيف الحين؟ وش أكثر شي يضيّع وقتك — الرد على الجوال، أو غياب العميلات عن مواعيدهن؟" },
  { n: "٢", t: "طابِق", d: "اربط حاجة الصالون بالباقة الأنسب له." },
  { n: "٣", t: "أثبِت", d: "اعرض النتيجة الملموسة (٤٠٪ حجوزات خارج الدوام · غياب -٥٠٪) ومؤشّر القيمة." },
  { n: "٤", t: "أغلِق", d: "اطرح الاعتراض بردّ جاهز واطلب القرار." },
];

type MatchRow = { type: string; pkg: string };
const MATCHING: MatchRow[] = [
  { type: "صالون يبي بس يستقبل حجوزاته أونلاين", pkg: "الأساسية" },
  { type: "صالون يبي بطاقات هدايا وولاء عميلات", pkg: "نمو الأعمال" },
  { type: "صالون يبيع منتجات عناية مع خدماته", pkg: "نمو الأعمال" },
  { type: "صالون عدة فروع أو يبي تقارير دقيقة", pkg: "نمو الأعمال" },
  { type: "سبا يبي عربون يضمن جدّية العميلة", pkg: "الأساسية فأعلى" },
];

type Tier = {
  name: string;
  monthly: string;
  yearly: string;
  save: string;
  note: string;
  recommended?: boolean;
};
const TIERS: Tier[] = [
  {
    name: "الأساسية",
    monthly: "59",
    yearly: "599",
    save: "109",
    note: "صفحة حجز باسم مشروعك · حجز مباشر ٢٤/٧ · معرض صور وتقييمات · روابط التواصل وأوقات العمل",
  },
  {
    name: "نمو الأعمال",
    monthly: "120",
    yearly: "1149",
    save: "291",
    note: "كل الأساسية + متجر وفروع + تقارير وتحليلات + بطاقات هدايا وولاء + نظام إدارة حجوزات متكامل + لوحة تفاصيل الحجوزات + كل موظف على حجوزاته + إضافة حجز من اللوحة أو الموقع",
    recommended: true,
  },
];

const SUPPORT_TEXT = "بدون عمولة على حجوزاتك · فوترة متوافقة مع هيئة الزكاة والضريبة · إلغاء بأي وقت";

/* ---------- content ---------- */
type NoteData = {
  id: number;
  icon: LucideIcon;
  tape: string;
  pkg: string;
  who: string;
  pos: { x: number; y: number };
  rot: number;
  bend: number;
  recommended?: boolean;
  headline?: string;
  title: string;
  short: string;
  details: string[];
  pain: string;
  hooks: string[]; // جمل الإقناع — يمكن إضافة أكثر من جملة لكل بطاقة
  objection: { q: string; a: string };
  metric: string;
  fit: string;
};

const NOTES: NoteData[] = [
  {
    id: 1,
    icon: CalendarDays,
    tape: "violet",
    pkg: "كل الباقات",
    who: "من منظور العميلة",
    pos: { x: 83, y: 20 },
    rot: -3,
    bend: 70,
    title: "صفحة حجز باسم صالونك",
    short: "رابط واحد يفتح صفحة حجز فيها خدماتك وأسعارك وأوقاتك.",
    details: [
      "صفحة حجز باسم صالونك تفتح ٢٤ ساعة من رابط واحد.",
      "تحطّ الرابط في الإنستقرام أو سناب أو قوقل ماب.",
      "العميلة تشوف خدماتك وأسعارك وأوقات عملك ومعرض صورك وتقييماتك.",
      "روابط وسائل التواصل الاجتماعي داخل الصفحة.",
    ],
    pain: "تعتمد على المكالمات ورسائل الإنستقرام لاستقبال الحجوزات، وتضيع مواعيد خارج الدوام.",
    hooks: [
      "رابط واحد تحطّه في حساب صالونك — صفحة حجز باسمك تستقبل عميلاتك ٢٤ ساعة وأنت مرتاح.",
      "٤٠٪ من الحجوزات تصير خارج ساعات الدوام — الصفحة تستقبلها عنك بدل ما تضيع.",
    ],
    objection: {
      q: "عندي إنستقرام وأستقبل منه الحجوزات.",
      a: "رسايل الإنستقرام تضيع وتتأخّر وتتعارض المواعيد؛ صفحة الحجز تنظّم كل شي وتشتغل ٢٤ ساعة بلا ما ترد بنفسك.",
    },
    metric: "استقبال حجوزات ٢٤/٧ + صفر مكالمات ضائعة.",
    fit: "نقطة البداية لأي صالون أو سبا.",
  },
  {
    id: 2,
    icon: Clock,
    tape: "violet",
    pkg: "كل الباقات",
    who: "من منظور العميلة",
    pos: { x: 89, y: 50 },
    rot: 2.5,
    bend: -64,
    recommended: true,
    title: "العميلة تحجز بنفسها وتختار وقتها",
    short: "تختار الخدمة والموظفة والوقت — والحجز يظهر فوراً بلا تعارض.",
    details: [
      "العميلة تختار الخدمة والموظفة والوقت المناسب لها.",
      "الحجز يظهر فوراً بلوحة تحكمك وجدول موظفاتك.",
      "ما في تعارض مواعيد ولا حجز مكرر.",
      "حجز مباشر ٢٤/٧ بدون تدخّل منك.",
    ],
    pain: "تنسّق المواعيد يدوياً فتصير أخطاء وتعارض وحجوزات مكررة.",
    hooks: [
      "خلّي عميلتك تحجز بنفسها وتختار وقتها — والجدول يترتّب تلقائياً بلا تعارض.",
      "كل حجز ينزل مباشرة على جدول الموظفة المعنية — صفر تنسيق يدوي.",
    ],
    objection: {
      q: "أخاف يصير حجز غلط أو موعدين بنفس الوقت.",
      a: "النظام يمنع الحجز المكرر والتعارض تلقائياً — يعرض بس الأوقات المتاحة فعلاً لكل موظفة.",
    },
    metric: "صفر تعارض مواعيد + جدول موظفات منظّم تلقائياً.",
    fit: "أي صالون فيه أكثر من موظفة أو خدمة.",
  },
  {
    id: 3,
    icon: MessageCircle,
    tape: "violet",
    pkg: "كل الباقات",
    who: "من منظور العميلة",
    pos: { x: 83, y: 80 },
    rot: -2,
    bend: 66,
    recommended: true,
    title: "تأكيد وتذكير بالواتساب",
    short: "رسائل تلقائية تأكّد الحجز وتذكّر العميلة — الغياب ينخفض +٥٠٪.",
    details: [
      "رسالة تأكيد تلقائية فور الحجز.",
      "رسالة تذكير قبل الموعد تقلّل الغياب.",
      "كل شي تلقائي بلا ما ترسل بنفسك.",
      "العميلة تجيها الرسالة على واتسابها مباشرة.",
    ],
    pain: "العميلات ينسون مواعيدهن، والغياب يأكل من دخلك ووقت موظفاتك.",
    hooks: [
      "الواتساب يأكّد ويذكّر عميلتك تلقائياً — الغياب عن المواعيد ينخفض أكثر من ٥٠٪.",
      "كل موعد ضايع = دخل ضايع؛ التذكير التلقائي يعبّي كرسيك بدل ما يفضى.",
    ],
    objection: {
      q: "أذكّر عميلاتي بنفسي.",
      a: "التذكير اليدوي ينسى ويتأخّر؛ الأوتوماتيكي يوصل لكل عميلة في وقتها ويوفّر عليك ساعات كل أسبوع.",
    },
    metric: "غياب أقل من النصف + ساعات موفّرة أسبوعياً.",
    fit: "قوي جداً لكل صالون وسبا.",
  },
  {
    id: 4,
    icon: Wallet,
    tape: "emerald",
    pkg: "كل الباقات",
    who: "من منظور العميلة",
    pos: { x: 17, y: 20 },
    rot: 3,
    bend: -70,
    recommended: true,
    title: "مدفوعات وعربون بدون عمولة",
    short: "عربون أو دفع كامل عند الحجز — يوصل حسابك مباشرة بلا عمولة.",
    details: [
      "عربون أو دفع كامل وقت الحجز.",
      "المبلغ يوصل حسابك مباشرة.",
      "بدون أي عمولة على حجوزاتك.",
      "العربون يضمن جدّية العميلة ويقلّل الإلغاء.",
    ],
    pain: "حجوزات وهمية وإلغاءات بآخر لحظة، وتحصيل يدوي متعب.",
    hooks: [
      "خذ عربون وقت الحجز — يضمن جدّية العميلة ويقطع الحجوزات الوهمية.",
      "دفع أونلاين بلا أي عمولة — كل ريال يوصل حسابك مباشرة.",
    ],
    objection: {
      q: "المنصّات الثانية تاخذ عمولة على كل حجز.",
      a: "نحجز بدون عمولة على حجوزاتك — المبلغ كامل يوصلك مباشرة، والعربون يقلّل الإلغاءات.",
    },
    metric: "عمولة صفر + إلغاءات أقل بفضل العربون.",
    fit: "ممتاز للسبا والصالونات ذات الخدمات المرتفعة.",
  },
  {
    id: 5,
    icon: LayoutDashboard,
    tape: "emerald",
    pkg: "نمو الأعمال",
    who: "من منظور الصالون",
    pos: { x: 11, y: 50 },
    rot: -3,
    bend: 60,
    title: "لوحة التحكم والتقارير وملفات العميلات",
    short: "حجوزاتك وإيراداتك وأوقات ذروتك وملفات عميلاتك — لحظة بلحظة.",
    details: [
      "لوحة تحكم فيها كل تفاصيل الحجوزات، وكل موظفة تدخل على حجوزاتها.",
      "تقارير الإيرادات وأوقات الذروة وأفضل الخدمات لحظة بلحظة.",
      "ملف كامل لكل عميلة: بياناتها ومواعيدها السابقة وتقييماتها.",
      "إضافة حجز من اللوحة أو استقبال الحجز من الموقع.",
    ],
    pain: "ما تعرف أرقامك الحقيقية ولا أوقات ذروتك، ومعلومات عميلاتك مبعثرة بالدفاتر والإكسل.",
    hooks: [
      "شوف إيراداتك وأوقات ذروتك وأفضل خدماتك من أي جهاز — قرارات مبنية على أرقام.",
      "كل موظفة تدير حجوزاتها، وكل عميلة لها ملف كامل — كل شي منظّم بلا دفاتر.",
    ],
    objection: {
      q: "صالوني بسيط وما أحتاج تقارير.",
      a: "التقارير تكشف أوقات الذروة وأفضل خدمة ربحاً، وملف العميلة يرفع تجربتها — نمو مبني على أرقام لا تخمين.",
    },
    metric: "رؤية كاملة للإيرادات + قاعدة عميلات منظّمة.",
    fit: "للصالونات النامية وأصحاب الفروع.",
  },
  {
    id: 6,
    icon: Store,
    tape: "emerald",
    pkg: "نمو الأعمال",
    who: "من منظور الصالون",
    pos: { x: 17, y: 80 },
    rot: 2,
    bend: -66,
    title: "متجر ومنتجات وفروع",
    short: "بِع منتجات العناية مع خدماتك، وأدِر فروعك من لوحة واحدة.",
    details: [
      "متجر إلكتروني يبيع منتجاتك مع خدماتك من نفس صفحة الحجز.",
      "متابعة الطلبات والمخزون بسهولة.",
      "إدارة عدة فروع من لوحة واحدة.",
      "دخل إضافي من المنتجات فوق الحجوزات.",
    ],
    pain: "تبيع خدمات بس، وتفوّت دخل منتجات العناية، وإدارة الفروع متفرّقة.",
    hooks: [
      "بِع منتجات العناية مع خدماتك من نفس صفحة الحجز — دخل إضافي بلا متجر منفصل.",
      "أدِر كل فروعك ومخزونك من لوحة واحدة — توسّع منظّم بلا فوضى.",
    ],
    objection: {
      q: "أنا أقدّم خدمات مو منتجات.",
      a: "منتجات العناية المكمّلة دخل إضافي سهل من نفس الصفحة — وعميلتك تشتريها وهي تحجز.",
    },
    metric: "دخل إضافي من المنتجات + إدارة فروع موحّدة.",
    fit: "للصالونات اللي تبيع منتجات أو عندها فروع.",
  },
  {
    id: 7,
    icon: Gift,
    tape: "indigo",
    pkg: "نمو الأعمال",
    who: "من منظور العميلة",
    pos: { x: 50, y: 87 },
    rot: -2.5,
    bend: 52,
    recommended: true,
    headline: "ميزة تحبها الصالونات",
    title: "بطاقات الهدايا والولاء",
    short: "عميلتك تشتري بطاقة وترسلها بالواتساب — تستلم المبلغ قبل الخدمة.",
    details: [
      "بطاقة هدية رقمية تُشترى أونلاين وتُرسل لصديقتها بالواتساب.",
      "سيولة مقدمة — تستلم قيمة البطاقة قبل تقديم الخدمة.",
      "أغلب مستلمات البطاقات عميلات جديدات ما زاروك قبل.",
      "بطاقات ولاء ترفع تكرار الزيارة.",
      "الرصيد والاستخدام يتتبع تلقائياً بلوحة تحكمك.",
    ],
    pain: "تعتمد على عميلاتك الحاليات بس، وتصرف على إعلانات لجذب عميلات جدد.",
    hooks: [
      "بطاقة هدية تشتريها عميلتك وترسلها لصديقتها — تستلم المبلغ اليوم، وتجيك عميلة جديدة بكرة.",
      "الهدايا والولاء يرجّعون عميلاتك من نفسهن — دخل متكرّر بلا تكلفة إعلانات.",
    ],
    objection: {
      q: "ما أحتاج بطاقات هدايا.",
      a: "البطاقة سيولة مقدمة تستلمها قبل الخدمة، وأغلب المستلمات عميلات جدد — نمو بلا تكلفة تسويق.",
    },
    metric: "سيولة مقدمة + عميلات جدد + دخل متكرّر.",
    fit: "الأبرز للصالونات والسبا.",
  },
];

/* ---------- helpers ---------- */
function arrowPath(nx: number, ny: number, bend: number) {
  const cx = 500,
    cy = 380;
  const NX = (nx / 100) * 1000,
    NY = (ny / 100) * 760;
  const dx = NX - cx,
    dy = NY - cy;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len,
    py = dx / len;
  const S = [cx + dx * 0.17, cy + dy * 0.17];
  const E = [cx + dx * 0.74, cy + dy * 0.74];
  const c1 = [cx + dx * 0.38 + px * bend, cy + dy * 0.38 + py * bend];
  const c2 = [cx + dx * 0.6 + px * bend, cy + dy * 0.6 + py * bend];
  return `M ${S[0].toFixed(1)} ${S[1].toFixed(1)} C ${c1[0].toFixed(1)} ${c1[1].toFixed(
    1
  )}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${E[0].toFixed(1)} ${E[1].toFixed(1)}`;
}

function useIsDesktop() {
  const [d, setD] = useState(true);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 900px)");
    const h = () => setD(m.matches);
    h();
    m.addEventListener("change", h);
    return () => m.removeEventListener("change", h);
  }, []);
  return d;
}

/* ---------- small pieces ---------- */
function NahjezLogo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="5" y="9" width="30" height="27" rx="5" fill={PURPLE} />
      <rect x="5" y="9" width="30" height="9" rx="5" fill={PURPLE_DEEP} />
      <rect x="12" y="5" width="3.4" height="8" rx="1.7" fill={PURPLE_DEEP} />
      <rect x="24.6" y="5" width="3.4" height="8" rx="1.7" fill={PURPLE_DEEP} />
      <path
        d="M14 26.8 L18.4 31 L27 22.2"
        fill="none"
        stroke="#F6D44B"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Pill({ pkg }: { pkg: string }) {
  const s = PKG_STYLE[pkg] || PKG_STYLE["كل الباقات"];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {pkg}
    </span>
  );
}

function stickyStyle(rot: number): React.CSSProperties {
  return {
    backgroundColor: NOTE,
    borderRadius: "16px 24px 18px 26px / 26px 16px 28px 18px",
    boxShadow: `0 1px 0 ${NOTE_EDGE}, 0 10px 18px -10px rgba(64,51,43,0.45)`,
    transform: `rotate(${rot}deg)`,
  };
}

function Tape({ color }: { color: string }) {
  return (
    <span
      className="absolute left-1/2 -top-2 h-4 w-14 -translate-x-1/2"
      style={{
        backgroundColor: TAPE[color],
        opacity: 0.9,
        borderRadius: "3px",
        transform: "translateX(-50%) rotate(-4deg)",
        boxShadow: "0 2px 4px -2px rgba(64,51,43,0.4)",
      }}
      aria-hidden="true"
    />
  );
}

/* the sticky note card (used in both layouts and both modes) */
function Note({
  note,
  onOpen,
  delay = 0,
  absolute = false,
  mode,
}: {
  note: NoteData;
  onOpen: (n: NoteData) => void;
  delay?: number;
  absolute?: boolean;
  mode: Mode;
}) {
  const Icon = note.icon;
  const rep = mode === "rep";
  const inner = (
    <button
      onClick={() => onOpen(note)}
      className="note-pop group relative block w-full cursor-pointer p-3.5 pt-4 text-right outline-none transition duration-200 hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-violet-300 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ ...stickyStyle(note.rot), animationDelay: `${delay}ms` }}
      aria-label={`${note.title} — ${rep ? "اضغط لسكربت الإقناع" : "اضغط لعرض التفاصيل"}`}
    >
      <Tape color={note.tape} />
      {note.recommended && (
        <span
          className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: "#FFFBEB", border: `2px solid ${GOLD}`, boxShadow: "0 3px 6px -2px rgba(64,51,43,.5)" }}
          aria-hidden="true"
        >
          <Star size={14} fill={GOLD} stroke={GOLD} />
        </span>
      )}
      <span
        className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold text-white"
        style={{ backgroundColor: PURPLE, boxShadow: "0 3px 6px -2px rgba(64,51,43,.5)" }}
      >
        {note.id}
      </span>

      {note.headline && (
        <div className="mb-1.5 flex justify-end">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-black text-white"
            style={{ backgroundColor: "#4338CA", fontSize: 10 }}
          >
            <Star size={10} fill="#fff" stroke="#fff" /> {note.headline}
          </span>
        </div>
      )}

      <div className="mb-1 flex items-center justify-end gap-2">
        <span className="text-sm font-bold" style={{ color: INK }}>
          {note.title}
        </span>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: "rgba(64,51,43,.08)", color: INK }}
        >
          <Icon size={18} strokeWidth={2.2} />
        </span>
      </div>

      {rep ? (
        <>
          <div className="mb-1 flex items-center justify-end gap-1" style={{ color: PURPLE_DEEP }}>
            <span className="font-bold" style={{ fontSize: 10 }}>
              {note.hooks.length > 1 ? `جمل الإقناع (${note.hooks.length})` : "جملة الإقناع"}
            </span>
            <Star size={11} fill={GOLD} stroke={GOLD} />
          </div>
          <p className="text-xs font-semibold leading-relaxed" style={{ color: INK }}>
            {note.hooks[0]}
          </p>
        </>
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: "#5f5248" }}>
          {note.short}
        </p>
      )}

      {note.recommended && (
        <span
          className="mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold"
          style={{ backgroundColor: "#FEF3C7", color: "#92400E", border: `1px solid ${GOLD}`, fontSize: 10 }}
        >
          <Star size={11} fill={GOLD} stroke={GOLD} /> موصى به لرفع المبيعات
        </span>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="font-semibold" style={{ color: "#8a7c70", fontSize: 10 }}>
          {rep ? "اضغط للسكربت الكامل" : "اضغط للتفاصيل"}
        </span>
        <Pill pkg={note.pkg} />
      </div>
    </button>
  );

  if (!absolute) return inner;
  return (
    <div
      className="absolute"
      style={{ left: `${note.pos.x}%`, top: `${note.pos.y}%`, width: 208, transform: "translate(-50%, -50%)" }}
    >
      {inner}
    </div>
  );
}

function CenterNode({ mode }: { mode: Mode }) {
  const rep = mode === "rep";
  return (
    <div
      className="relative p-4 text-center"
      style={{
        backgroundColor: "#fffdf7",
        border: `2.5px solid ${PURPLE}`,
        borderRadius: "18px 26px 20px 28px / 26px 18px 28px 20px",
        boxShadow: "0 14px 30px -12px rgba(91,33,182,.45)",
        transform: "rotate(-1deg)",
      }}
    >
      <span
        className="absolute left-1/2 -top-2.5 h-5 w-16 -translate-x-1/2"
        style={{ backgroundColor: "#F6D44B", borderRadius: "3px", transform: "translateX(-50%) rotate(-3deg)", opacity: 0.95 }}
        aria-hidden="true"
      />
      <div className="mb-1 flex items-center justify-center gap-2">
        <NahjezLogo size={30} />
        <span className="text-sm font-black tracking-tight" style={{ color: PURPLE_DEEP }}>
          نحجز هب
        </span>
      </div>
      <div className="text-base font-black leading-snug" style={{ color: INK }}>
        منصة إدارة
        <br /> الحجوزات المتكاملة
      </div>
      <div className="mt-1 text-xs font-semibold" style={{ color: rep ? PURPLE : "#8a7c70" }}>
        {rep ? "بِع النتيجة لا الميزة" : "رحلة الحجز من العميلة إلى لوحة التحكم"}
      </div>
    </div>
  );
}

/* ---------- rep-mode strips ---------- */
function SellPathStrip() {
  return (
    <div className="mx-auto mb-6 max-w-5xl">
      <div className="mb-2 text-center text-sm font-bold" style={{ color: PURPLE_DEEP }}>
        مسار الزيارة: اسأل ← طابِق ← أثبِت ← أغلِق
      </div>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {SELL_PATH.map((s) => (
          <div
            key={s.n}
            className="flex-1 rounded-2xl p-3 text-right"
            style={{ minWidth: 150, backgroundColor: "#fffdf7", border: "1.5px solid #ead9c9", boxShadow: "0 6px 14px -10px rgba(64,51,43,.4)" }}
          >
            <div className="mb-1 flex items-center justify-end gap-2">
              <span className="font-black" style={{ color: INK }}>
                {s.t}
              </span>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white"
                style={{ backgroundColor: PURPLE }}
              >
                {s.n}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#6f6156" }}>
              {s.d}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchingPanel() {
  return (
    <div
      className="mx-auto mt-8 max-w-3xl rounded-3xl p-5"
      style={{ backgroundColor: "#fffdf7", border: "1.5px solid #ead9c9", boxShadow: "0 12px 26px -16px rgba(64,51,43,.5)" }}
    >
      <div className="mb-3 flex items-center justify-end gap-2">
        <h3 className="text-base font-black" style={{ color: PURPLE_DEEP }}>
          طابِق حالة الصالون بالباقة
        </h3>
        <Target size={18} style={{ color: PURPLE }} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {MATCHING.map((m) => (
          <div
            key={m.type}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
            style={{ backgroundColor: "#faf4ee", border: "1px solid #efe2d5" }}
          >
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: PURPLE }}
            >
              {m.pkg}
            </span>
            <span className="text-right text-sm font-semibold" style={{ color: INK }}>
              {m.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupportBanner() {
  return (
    <div className="mx-auto mb-6 flex max-w-5xl justify-center">
      <span
        className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold"
        style={{ backgroundColor: "#EAF7EE", color: "#065F46", border: "1.5px solid #A7D7B9" }}
      >
        <ShieldCheck size={16} /> {SUPPORT_TEXT}
      </span>
    </div>
  );
}

function PackagesPanel() {
  return (
    <div
      className="mx-auto mt-6 max-w-3xl rounded-3xl p-5"
      style={{ backgroundColor: "#fffdf7", border: "1.5px solid #ead9c9", boxShadow: "0 12px 26px -16px rgba(64,51,43,.5)" }}
    >
      <div className="mb-3 flex items-center justify-end gap-2">
        <h3 className="text-base font-black" style={{ color: PURPLE_DEEP }}>
          سلّم الباقات والأسعار
        </h3>
        <TrendingUp size={18} style={{ color: PURPLE }} />
      </div>

      <div className="space-y-2">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
            style={{
              backgroundColor: t.recommended ? "#FEF6DD" : "#faf4ee",
              border: t.recommended ? `1.5px solid ${GOLD}` : "1px solid #efe2d5",
            }}
          >
            <span
              className="flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1 text-white"
              style={{ backgroundColor: PURPLE, minWidth: 66 }}
            >
              <span className="text-base font-black leading-none">{t.monthly}</span>
              <span style={{ fontSize: 9 }}>ريال/شهر</span>
            </span>
            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-1.5">
                {t.recommended && (
                  <span
                    className="rounded-full px-2 py-0.5 font-black"
                    style={{ backgroundColor: GOLD, color: "#4a3410", fontSize: 10 }}
                  >
                    الموصى بها
                  </span>
                )}
                {t.recommended && <Star size={14} fill={GOLD} stroke={GOLD} />}
                <span className="font-black" style={{ color: INK }}>
                  {t.name}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] font-bold" style={{ color: PURPLE_DEEP }}>
                أو {t.yearly} ريال سنوياً · وفّر {t.save} ريال
              </div>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "#6f6156" }}>
                {t.note}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-3 rounded-xl px-3 py-2 text-right text-xs font-bold"
        style={{ backgroundColor: "#F4ECFB", color: PURPLE_DEEP, border: "1px solid #D8C7EE" }}
      >
        نصيحة إغلاق: ابدأ بالأساسية (٥٩ شهرياً) لو الميزانية أقل وأغلِق — وتقدر ترقّيها لنمو الأعمال لما تبي الهدايا والتقارير والمتجر.
      </div>
    </div>
  );
}

function RepSection({
  label,
  icon,
  bg,
  border,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-3 text-right" style={{ backgroundColor: bg, border }}>
      <div className="mb-1 flex items-center justify-end gap-1.5 text-xs font-black" style={{ color: INK }}>
        {label}
        {icon}
      </div>
      {children}
    </div>
  );
}

function DetailModal({ note, mode, onClose }: { note: NoteData | null; mode: Mode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!note) return null;
  const Icon = note.icon;
  const rep = mode === "rep";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(43,35,32,.55)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={note.title}
    >
      <div
        className="modal-pop relative w-full max-w-md overflow-y-auto p-6 text-right"
        style={{
          backgroundColor: NOTE,
          maxHeight: "90vh",
          borderRadius: "20px 30px 22px 32px / 30px 20px 32px 22px",
          boxShadow: "0 24px 50px -12px rgba(43,35,32,.6)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tape color={note.tape} />
        <button
          onClick={onClose}
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full outline-none transition hover:rotate-90 focus-visible:ring-4 focus-visible:ring-violet-300 motion-reduce:transition-none"
          style={{ backgroundColor: "rgba(64,51,43,.1)", color: INK }}
          aria-label="إغلاق"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="mb-3 flex items-center justify-end gap-3">
          <div>
            <div className="text-lg font-black" style={{ color: INK }}>
              {note.title}
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
              {note.recommended && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: "#FEF3C7", color: "#92400E", border: `1px solid ${GOLD}` }}
                >
                  <Star size={13} fill={GOLD} stroke={GOLD} /> موصى به لرفع المبيعات
                </span>
              )}
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold"
                style={{ backgroundColor: "rgba(109,40,217,.12)", color: PURPLE_DEEP }}
              >
                {note.who}
              </span>
              <Pill pkg={note.pkg} />
            </div>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: PURPLE }}>
            <Icon size={24} strokeWidth={2.2} />
          </span>
        </div>

        {note.headline && (
          <div
            className="mb-3 flex items-center justify-end gap-2 rounded-xl px-3 py-2 text-sm font-black text-white"
            style={{ backgroundColor: "#4338CA" }}
          >
            {note.headline}
            <Star size={15} fill="#fff" stroke="#fff" />
          </div>
        )}

        {rep ? (
          <div className="space-y-2.5">
            <RepSection
              label="الوجع الذي يعالجه"
              icon={<Flame size={14} style={{ color: "#B45309" }} />}
              bg="#FBE8E1"
              border="1px solid #F3C7B7"
            >
              <p className="text-sm leading-relaxed" style={{ color: "#5a4a40" }}>
                {note.pain}
              </p>
            </RepSection>

            <RepSection
              label={note.hooks.length > 1 ? "جمل الإقناع — احفظها" : "جملة الإقناع — احفظها"}
              icon={<Star size={14} fill={GOLD} stroke={GOLD} />}
              bg="#FEF6DD"
              border={`1.5px solid ${GOLD}`}
            >
              <div className="space-y-2">
                {note.hooks.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg px-3 py-2"
                    style={{ backgroundColor: "#fffdf7", border: `1px solid ${GOLD}` }}
                  >
                    {note.hooks.length > 1 && (
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black"
                        style={{ backgroundColor: GOLD, color: "#4a3410" }}
                      >
                        {i + 1}
                      </span>
                    )}
                    <p className="text-sm font-bold leading-relaxed" style={{ color: INK }}>
                      «{h}»
                    </p>
                  </div>
                ))}
              </div>
            </RepSection>

            <RepSection
              label="اعتراض شائع + الرد"
              icon={<X size={14} style={{ color: "#9f1239" }} />}
              bg="#F4ECFB"
              border="1px solid #D8C7EE"
            >
              <p className="mb-1 text-sm font-bold" style={{ color: "#9f1239" }}>
                «{note.objection.q}»
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#4a3f36" }}>
                {note.objection.a}
              </p>
            </RepSection>

            <RepSection
              label="مؤشّر القيمة"
              icon={<TrendingUp size={14} style={{ color: PURPLE }} />}
              bg="#EEE8FA"
              border="1px solid #D8C7EE"
            >
              <p className="text-sm font-semibold leading-relaxed" style={{ color: PURPLE_DEEP }}>
                {note.metric}
              </p>
            </RepSection>

            <div className="flex items-center justify-end gap-1.5 pt-0.5 text-sm font-bold" style={{ color: INK }}>
              <span>الأنسب لـ: {note.fit}</span>
              <Target size={14} style={{ color: PURPLE }} />
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {note.details.map((d, i) => (
              <li key={i} className="flex items-start justify-end gap-2 text-sm leading-relaxed" style={{ color: "#4a3f36" }}>
                <span>{d}</span>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PURPLE }} aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- main ---------- */
export default function NahjezMindMap() {
  const [active, setActive] = useState<NoteData | null>(null);
  const [mode, setMode] = useState<Mode>("product"); // 'product' | 'rep'
  const isDesktop = useIsDesktop();
  const open = useCallback((n: NoteData) => setActive(n), []);
  const close = useCallback(() => setActive(null), []);
  const rep = mode === "rep";

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full px-4 py-8"
      style={{
        fontFamily: "'Tajawal', system-ui, sans-serif",
        backgroundColor: PAPER,
        backgroundImage: `linear-gradient(${GRID} 1px, transparent 1px), linear-gradient(90deg, ${GRID} 1px, transparent 1px)`,
        backgroundSize: "26px 26px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lemonada:wght@500;600;700&family=Tajawal:wght@400;500;700;800&display=swap');
        .display { font-family: 'Lemonada', 'Tajawal', cursive; }
        @keyframes popIn { 0% { opacity: 0; transform: scale(.7); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes modalPop { 0% { opacity: 0; transform: scale(.9) translateY(8px); } 100% { opacity: 1; transform: none; } }
        @keyframes draw { to { stroke-dashoffset: 0; } }
        .note-pop { animation: popIn .5s cubic-bezier(.34,1.56,.64,1) both; }
        .modal-pop { animation: modalPop .28s ease both; }
        .arrow { stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw .9s ease forwards; }
        @media (prefers-reduced-motion: reduce) {
          .note-pop, .modal-pop { animation: none; }
          .arrow { stroke-dashoffset: 0; animation: none; }
        }
      `}</style>

      {/* header */}
      <header className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <NahjezLogo size={38} />
          <div>
            <h1 className="display text-xl font-bold leading-tight" style={{ color: PURPLE_DEEP }}>
              الخريطة التفاعلية لرحلة الحجز
            </h1>
            <p className="text-sm" style={{ color: "#8a7c70" }}>
              {rep
                ? "أداة تدريب الموظف · اضغط أي بطاقة لسكربت الإقناع الكامل"
                : "منصة نحجز — إدارة الحجوزات · اضغط أي بطاقة لعرض التفاصيل"}
            </p>
          </div>
        </div>

        {/* mode toggle */}
        <div className="flex rounded-full p-1" style={{ backgroundColor: "#efe6dd" }}>
          {[
            { k: "product", t: "وضع المنتج" },
            { k: "rep", t: "وضع الموظف" },
          ].map((o) => {
            const on = mode === o.k;
            return (
              <button
                key={o.k}
                onClick={() => setMode(o.k as Mode)}
                className="rounded-full px-4 py-1.5 text-sm font-bold outline-none transition focus-visible:ring-4 focus-visible:ring-violet-300 motion-reduce:transition-none"
                style={{ backgroundColor: on ? PURPLE : "transparent", color: on ? "#fff" : "#7a6b5e" }}
                aria-pressed={on}
              >
                {o.t}
              </button>
            );
          })}
        </div>
      </header>

      {/* rep-mode sell path OR product-mode legend */}
      {rep ? (
        <SellPathStrip />
      ) : (
        <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-center gap-3 text-xs font-semibold">
          {Object.keys(PKG_STYLE).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PKG_STYLE[k].fg }} />
              <span style={{ color: "#5f5248" }}>{k}</span>
            </span>
          ))}
        </div>
      )}

      <SupportBanner />

      {/* stage */}
      {isDesktop ? (
        <div className="relative mx-auto" style={{ width: "100%", maxWidth: 1000, aspectRatio: "1000 / 760" }}>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1000 760"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <marker id="ah" markerWidth="16" markerHeight="16" refX="7" refY="6" orient="auto">
                <path d="M1 1 L10 6 L1 11" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>
            {NOTES.map((n, i) => (
              <path
                key={n.id}
                className="arrow"
                d={arrowPath(n.pos.x, n.pos.y, n.bend)}
                fill="none"
                stroke={INK}
                strokeWidth="2.6"
                strokeLinecap="round"
                pathLength="1"
                markerEnd="url(#ah)"
                style={{ animationDelay: `${250 + i * 90}ms` }}
              />
            ))}
            {[
              [352, 300],
              [648, 300],
              [352, 460],
              [648, 460],
            ].map(([x, y], i) => (
              <path
                key={i}
                d={`M${x} ${y - 9} C ${x + 1} ${y - 2}, ${x + 2} ${y - 1}, ${x + 9} ${y} C ${x + 2} ${y + 1}, ${x + 1} ${y + 2}, ${x} ${y + 9} C ${x - 1} ${y + 2}, ${x - 2} ${y + 1}, ${x - 9} ${y} C ${x - 2} ${y - 1}, ${x - 1} ${y - 2}, ${x} ${y - 9} Z`}
                fill={PURPLE}
                opacity="0.5"
              />
            ))}
          </svg>

          <div className="absolute" style={{ left: "50%", top: "50%", width: 236, transform: "translate(-50%, -50%)" }}>
            <CenterNode mode={mode} />
          </div>

          {NOTES.map((n, i) => (
            <Note key={n.id} note={n} onOpen={open} delay={200 + i * 90} absolute mode={mode} />
          ))}
        </div>
      ) : (
        <div className="mx-auto flex max-w-md flex-col gap-5">
          <CenterNode mode={mode} />
          {NOTES.map((n, i) => (
            <Note key={n.id} note={n} onOpen={open} delay={i * 70} mode={mode} />
          ))}
        </div>
      )}

      {rep && <MatchingPanel />}
      {rep && <PackagesPanel />}

      <p className="mx-auto mt-8 max-w-5xl text-center text-xs" style={{ color: "#a89c90" }}>
        {rep
          ? "اسأل · طابِق · أثبِت · أغلِق — واطلب القرار بثقة"
          : "من صفحة الحجز إلى لوحة التحكم — كل بطاقة تفتح تفاصيلها عند الضغط"}
      </p>

      <DetailModal note={active} mode={mode} onClose={close} />
    </div>
  );
}
