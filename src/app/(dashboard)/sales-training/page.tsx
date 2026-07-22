"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import {
  QrCode,
  CreditCard,
  Store,
  MonitorSmartphone,
  Bike,
  RefreshCw,
  Gift,
  Star,
  TrendingUp,
  Target,
  Flame,
  Headset,
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
  الذهبية: { bg: "#FBE7C0", fg: "#92400E" },
  "الذهبية + VIP": { bg: "#EFE3EC", fg: "#6D28D9" },
  VIP: { bg: "#DDD6FE", fg: "#5B21B6" },
  "VIP بلس": { bg: "#C7D2FE", fg: "#3730A3" },
  "نظام الكاشير": { bg: "#BBF7D0", fg: "#065F46" },
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
  { n: "١", t: "اسأل", d: "نشاطك مطعم أو كوفي؟ وش أهم شي تحتاجه — منيو للعرض فقط، أو العميل يطلب ويدفع من المنيو؟" },
  { n: "٢", t: "طابِق", d: "اربط وجعه بالباقة الأنسب له." },
  { n: "٣", t: "أثبِت", d: "اعرض النتيجة الملموسة ومؤشّر القيمة." },
  { n: "٤", t: "أغلِق", d: "اطرح الاعتراض بردّ جاهز واطلب القرار." },
];

type MatchRow = { type: string; pkg: string };
const MATCHING: MatchRow[] = [
  { type: "كوفي أو مطعم صغير", pkg: "الأساسية / الذهبية" },
  { type: "يبي طلب أونلاين وتوصيل بميزانية أقل", pkg: "الذهبية (٥٧٩)" },
  { type: "مطعم جلوس أو كافيه", pkg: "VIP" },
  { type: "مزدحم أو وجهة شعبية", pkg: "VIP + الدور والحجوزات" },
  { type: "يحتاج بطاقات الولاء (أو فودكس والفروع)", pkg: "VIP بلس" },
];

type Tier = {
  name: string;
  price: string;
  note: string;
  deal?: boolean;
  star?: boolean;
  cashier?: boolean;
};
const TIERS: Tier[] = [
  { name: "الأساسية", price: "349", note: "منيو رقمي كامل بكل التفاصيل" },
  {
    name: "الذهبية",
    price: "579",
    note: "طلب أونلاين + تطبيق استقبال الطلبات + تسليم ودفع + واتساب + تقييمات + كوبونات + عروض مؤقتة",
    deal: true,
  },
  {
    name: "VIP",
    price: "879",
    note: "كل الذهبية + الطلب والدفع من الطاولة + الحجوزات + الدور + الفروع + الدومين + البيكسل",
    star: true,
  },
  { name: "VIP بلس", price: "1079", note: "كل VIP + بطاقات الهدايا والولاء (الأبرز) + مزامنة فودكس" },
  {
    name: "باقة الكاشير",
    price: "1349",
    note: "نظام فقط بدون أجهزة · للفرع الواحد · كل فرع إضافي ٢٤٩ ريال",
    cashier: true,
  },
];

const SUPPORT_TEXT = "دعم فني طوال فترة الاشتراك — لجميع الباقات";

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
  hook: string;
  objection: { q: string; a: string };
  metric: string;
  fit: string;
};

const NOTES: NoteData[] = [
  {
    id: 1,
    icon: QrCode,
    tape: "violet",
    pkg: "كل الباقات",
    who: "من منظور العميل",
    pos: { x: 83, y: 20 },
    rot: -3,
    bend: 70,
    title: "مسح الباركود وتصفّح المنيو",
    short: "يمسح الباركود ويتصفّح المنتجات بكل تفاصيلها.",
    details: [
      "يفتح المنيو عبر باركود الطاولة أو رابط المتجر أو الدومين المخصّص.",
      "يتنقّل بين الفئات الرئيسية ويشاهد الصور المتحركة.",
      "يطّلع على السعرات الحرارية ومسبّبات الحساسية لكل صنف.",
      "يختار منتجاته ويضيفها إلى السلّة.",
    ],
    pain: "منيو ورقي يتلف ويصعب تعديله، وتجربة تصفّح ضعيفة تُنفّر العميل.",
    hook: "منيو رقمي أنيق يفتح بمسح باركود — تعدّله في ثوانٍ وبلا تكلفة طباعة.",
    objection: {
      q: "الورقي يكفيني.",
      a: "كل تعديل سعر أو صنف = طباعة جديدة وتكلفة؛ الرقمي تحدّثه فوراً ومجاناً، وأجمل لعميلك.",
    },
    metric: "صفر تكلفة طباعة + تحديث لحظي للأصناف والأسعار.",
    fit: "نقطة البداية لكل نشاط.",
  },
  {
    id: 2,
    icon: CreditCard,
    tape: "violet",
    pkg: "الذهبية + VIP",
    who: "من منظور العميل",
    pos: { x: 89, y: 50 },
    rot: 2.5,
    bend: -64,
    recommended: true,
    title: "الطلب والدفع الإلكتروني",
    short: "طلب أونلاين مع تسليم ودفع مرن — في الذهبية و VIP.",
    details: [
      "طلب أونلاين مباشر من المنيو مع اختيار طريقة التسليم وطريقة الدفع.",
      "الاستلام من المحل أو التوصيل حسب ما يناسب العميل.",
      "استقبال وإدارة الطلبات عبر تطبيق مخصّص متاح من الذهبية فأعلى.",
      "مشاركة الطلب عبر الواتساب، وتطبيق كوبونات الخصم.",
      "متاح في الباقة الذهبية وباقة VIP.",
    ],
    pain: "طوابير وأخطاء طلبات، وموظف مشغول بأخذ الطلبات بدل خدمة العميل.",
    hook: "خلّي عميلك يطلب ويدفع أونلاين ويختار طريقة استلامه — متاح من الباقة الذهبية.",
    objection: {
      q: "الـVIP غالية عليّ.",
      a: "انزل للباقة الذهبية بـ٥٧٩: تعطيه الطلب الأونلاين والدفع والتقييمات والكوبونات — نفس قلب الفكرة بسعر أقل، ويقدر يترقّى لاحقاً.",
    },
    metric: "طلب أونلاين أسهل + تطبيق استقبال منظّم = مبيعات أعلى وإدارة أبسط.",
    fit: "الذهبية للأونلاين باقتصاد، و VIP تضيف الطاولات والحجوزات والفروع.",
  },
  {
    id: 3,
    icon: Store,
    tape: "violet",
    pkg: "VIP",
    who: "من منظور العميل",
    pos: { x: 83, y: 80 },
    rot: -2,
    bend: 66,
    recommended: true,
    title: "الطاولات والحجوزات والفروع",
    short: "طلب ودفع من الطاولة، حجوزات، دور، وتعدد فروع.",
    details: [
      "الطلب والدفع من الطاولة عبر باركود الطاولة مباشرة.",
      "حجز الطاولات مسبقاً وتنظيم الجلوس.",
      "قائمة انتظار الدور مع تحديثات على الواتساب.",
      "إدارة تعدد الفروع من لوحة واحدة.",
    ],
    pain: "زحمة الطاولات وسوء تنظيم الحجوزات، وصعوبة إدارة أكثر من فرع.",
    hook: "طاولات وحجوزات ودور وفروع في مكان واحد — تشغيل منظّم وتجربة جلوس أرقى.",
    objection: {
      q: "أنا فرع واحد وما أحتاج كل هذا.",
      a: "حتى بفرع واحد، الطلب من الطاولة والحجوزات والدور يرفعون تدوير الطاولات والرضا؛ ولو كبرت، الفروع جاهزة معك.",
    },
    metric: "تدوير طاولات أعلى + حجوزات منظّمة + إدارة فروع موحّدة.",
    fit: "مطاعم الجلوس، الوجهات المزدحمة، وأصحاب الفروع.",
  },
  {
    id: 4,
    icon: MonitorSmartphone,
    tape: "emerald",
    pkg: "نظام الكاشير",
    who: "من منظور الموظف",
    pos: { x: 17, y: 20 },
    rot: 3,
    bend: -70,
    title: "استقبال الطلب في الكاشير",
    short: "الطلب المباشر يصل تلقائياً إلى الشاشة.",
    details: [
      "الطلبات المباشرة من المنيو تظهر فوراً على شاشة الكاشير.",
      "الموظف يستعرض تفاصيل الطلب ويؤكّده.",
      "يجهّز الطلب ويحدّث حالته للعميل.",
      "كل الطلبات المباشرة موحّدة في شاشة واحدة.",
    ],
    pain: "طلبات متفرّقة وشاشات متعددة وفوضى في التجهيز.",
    hook: "كل الطلبات المباشرة تنزل تلقائياً على شاشة واحدة — تجهيز منظّم وسريع.",
    objection: {
      q: "نظامي الحالي يكفي.",
      a: "شاشة موحّدة تقلّل الأخطاء وتسرّع التجهيز، والموظف يشتغل مرتاح ومركّز.",
    },
    metric: "شاشة واحدة = أخطاء أقل وسرعة تجهيز أعلى.",
    fit: "أساس تشغيلي لكل عميل يفعّل الطلب الرقمي.",
  },
  {
    id: 5,
    icon: Bike,
    tape: "emerald",
    pkg: "نظام الكاشير",
    who: "من منظور الموظف",
    pos: { x: 11, y: 50 },
    rot: -3,
    bend: 60,
    title: "توحيد طلبات التوصيل في الكاشير",
    short: "كل طلبات التطبيقات داخل كاشيرك — رؤية كاملة لدخلك.",
    details: [
      "تُدخل طلبات هنقرستيشن وجاهز وكيتا في نفس شاشة الكاشير.",
      "كل مبيعاتك — المباشرة والتطبيقات — في مكان واحد.",
      "تقارير دخل دقيقة تجمع جميع القنوات.",
      "متابعة الأصناف الأكثر مبيعاً عبر كل المنصّات.",
    ],
    pain: "مبيعات التطبيقات مبعثرة خارج نظامك، فما تعرف دخلك الحقيقي ولا أرباحك.",
    hook: "اجمع مبيعات هنقرستيشن وجاهز وكيتا داخل كاشيرك — تقرير دخل واحد يوريك أرباحك بدقّة.",
    objection: {
      q: "التطبيقات لها لوحاتها الخاصة.",
      a: "لوحات متفرّقة تصعّب حساب دخلك الكلي؛ توحيدها في الكاشير يعطيك صورة مالية واضحة وقرارات أذكى.",
    },
    metric: "كل القنوات في تقرير واحد = معرفة دقيقة بالدخل والأصناف الأكثر ربحاً.",
    fit: "يناسب أي مطعم يعتمد على تطبيقات التوصيل.",
  },
  {
    id: 6,
    icon: RefreshCw,
    tape: "indigo",
    pkg: "VIP بلس",
    who: "ربط متقدّم",
    pos: { x: 17, y: 80 },
    rot: 2,
    bend: -66,
    title: "المزامنة مع فودكس Foodics",
    short: "ربط مباشر يوحّد الطلبات والمخزون.",
    details: [
      "ربط مباشر بين قائمة الطلبات ونظام Foodics.",
      "مزامنة الطلبات تلقائياً دون إدخال مزدوج.",
      "توحيد الأصناف والأسعار والمخزون.",
      "ميزة حصرية في باقة VIP بلس.",
    ],
    pain: "إدخال مزدوج بين المنيو والكاشير، وأخطاء ووقت ضائع.",
    hook: "اربط قائمة الطلبات بفودكس — مزامنة تلقائية توحّد كل شيء بلا إدخال مكرّر.",
    objection: {
      q: "عندي فودكس أصلاً.",
      a: "ممتاز — VIP بلس يكمّله لا يستبدله: يزامن طلباتك ومخزونك مباشرة في مكان واحد.",
    },
    metric: "صفر إدخال مزدوج + توحيد الطلبات والمخزون.",
    fit: "للسلاسل والفروع ومستخدمي فودكس.",
  },
  {
    id: 7,
    icon: Gift,
    tape: "indigo",
    pkg: "VIP بلس",
    who: "من منظور العميل",
    pos: { x: 50, y: 87 },
    rot: -2.5,
    bend: 52,
    recommended: true,
    headline: "أهم ميزة في VIP بلس",
    title: "بطاقات الهدايا والولاء",
    short: "اجمع ٤ أكواب والخامس مجاناً عبر محفظة آبل.",
    details: [
      "بطاقة ولاء رقمية تُضاف مباشرة إلى محفظة آبل (Apple Wallet).",
      "يجمع العميل ختماً مع كل عملية — مثال: ٤ أكواب والخامس مجاناً.",
      "بطاقات هدايا رقمية يختار قيمتها ويُهديها لأصدقائه.",
      "إشعارات تلقائية على الجوال عند الاقتراب من المكافأة.",
      "أداة تسويقية ترفع تكرار الزيارة وولاء العملاء.",
    ],
    pain: "العميل يجرّبك مرة وما يرجع، وتصرف على إعلانات لجذب عملاء جدد باستمرار.",
    hook: "بطاقة ولاء في محفظة آبل — عميلك يرجع من نفسه عشان الكوب الخامس المجاني، ولاء بلا إعلانات.",
    objection: {
      q: "ما أحتاج نظام ولاء.",
      a: "جذب عميل جديد أغلى بكثير من إرجاع عميل حالي؛ الولاء يرفع تكرار الزيارة ومبيعاتك المتكرّرة.",
    },
    metric: "تكرار زيارة أعلى + مبيعات متكرّرة + بطاقات هدايا تجلب عملاء جدد.",
    fit: "قوي للكافيهات والمطاعم ذات الزيارات المتكرّرة.",
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
function MenuLogo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="3" y="3" width="15" height="15" rx="3" fill={PURPLE} />
      <rect x="22" y="3" width="15" height="15" rx="3" fill={PURPLE} />
      <rect x="3" y="22" width="15" height="15" rx="3" fill={PURPLE} />
      <rect x="22" y="22" width="15" height="15" rx="3" fill={PURPLE} />
      <circle cx="29.5" cy="29.5" r="3.6" fill="#F6D44B" />
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
              جملة الإقناع
            </span>
            <Star size={11} fill={GOLD} stroke={GOLD} />
          </div>
          <p className="text-xs font-semibold leading-relaxed" style={{ color: INK }}>
            {note.hook}
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
        <MenuLogo size={30} />
        <span className="text-sm font-black tracking-tight" style={{ color: PURPLE_DEEP }}>
          قائمة الطلبات
        </span>
      </div>
      <div className="text-base font-black leading-snug" style={{ color: INK }}>
        نظام المنيو والكاشير
        <br /> المتكامل
      </div>
      <div className="mt-1 text-xs font-semibold" style={{ color: rep ? PURPLE : "#8a7c70" }}>
        {rep ? "بِع النتيجة لا الميزة" : "رحلة الطلب من العميل إلى الكاشير"}
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
          طابِق نوع المطعم بالباقة
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
        <Headset size={16} /> {SUPPORT_TEXT}
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
              backgroundColor: t.deal ? "#FEF6DD" : t.cashier ? "#EAF7EE" : "#faf4ee",
              border: t.deal
                ? `1.5px solid ${GOLD}`
                : t.cashier
                ? "1.5px solid #A7D7B9"
                : "1px solid #efe2d5",
            }}
          >
            <span
              className="flex shrink-0 flex-col items-center rounded-xl px-2.5 py-1 text-white"
              style={{ backgroundColor: t.cashier ? "#059669" : PURPLE, minWidth: 62 }}
            >
              <span className="text-base font-black leading-none">{t.price}</span>
              <span style={{ fontSize: 9 }}>ريال/سنة</span>
            </span>
            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-1.5">
                {t.deal && (
                  <span
                    className="rounded-full px-2 py-0.5 font-black"
                    style={{ backgroundColor: GOLD, color: "#4a3410", fontSize: 10 }}
                  >
                    الأوفر · خيار مخفّض
                  </span>
                )}
                {t.cashier && (
                  <span
                    className="rounded-full px-2 py-0.5 font-black text-white"
                    style={{ backgroundColor: "#059669", fontSize: 10 }}
                  >
                    نظام فقط · بدون أجهزة
                  </span>
                )}
                {t.star && <Star size={14} fill={GOLD} stroke={GOLD} />}
                <span className="font-black" style={{ color: INK }}>
                  {t.name}
                </span>
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
        نصيحة إغلاق: لو الـVIP كثير على العميل، انزل للباقة الذهبية (٥٧٩) وأغلِق — ويقدر يترقّى لاحقاً.
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
              label="جملة الإقناع — احفظها"
              icon={<Star size={14} fill={GOLD} stroke={GOLD} />}
              bg="#FEF6DD"
              border={`1.5px solid ${GOLD}`}
            >
              <p className="text-sm font-bold leading-relaxed" style={{ color: INK }}>
                «{note.hook}»
              </p>
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
export default function MenuMindMap() {
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
          <MenuLogo size={38} />
          <div>
            <h1 className="display text-xl font-bold leading-tight" style={{ color: PURPLE_DEEP }}>
              الخريطة التفاعلية لرحلة الطلب
            </h1>
            <p className="text-sm" style={{ color: "#8a7c70" }}>
              {rep
                ? "أداة تدريب الموظف · اضغط أي بطاقة لسكربت الإقناع الكامل"
                : "نظام المنيو والكاشير — قائمة الطلبات · اضغط أي بطاقة لعرض التفاصيل"}
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
          : "العميل يميناً · الموظف يساراً · الميزات المتقدّمة (VIP بلس) في الأسفل — كل بطاقة تفتح تفاصيلها عند الضغط"}
      </p>

      <DetailModal note={active} mode={mode} onClose={close} />
    </div>
  );
}
