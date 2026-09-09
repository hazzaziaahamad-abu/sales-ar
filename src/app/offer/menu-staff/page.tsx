import type { Metadata } from "next";
import Link from "next/link";
import {
  Info, MapPin, Users, QrCode, CreditCard, Store, Building2, Bike, Gift,
  MonitorSmartphone, Check, ArrowLeft, Sparkles, MessageSquareQuote,
} from "lucide-react";

export const metadata: Metadata = {
  title: "دليل عرض قائمة الطلبات — للموظفين",
  description: "سكربت عرض متسلسل لمندوب المبيعات: تعريف المنصة، الفئة المستهدفة، شرح الخدمات من المنيو إلى الكاشير، ثم الباقات.",
};

const ACCENT = "#6D28D9";
const ACCENT_DEEP = "#5B21B6";
const GOLD = "#F5B301";

const AUDIENCE = [
  { icon: Store, title: "المطاعم والكافيهات", text: "من يبغى منيو رقمي أنيق يعدّله بنفسه بلا طباعة." },
  { icon: Bike, title: "المعتمدون على التوصيل", text: "من يبيع عبر هنقرستيشن/جاهز/كيتا ويريد توحيد الطلبات وتقليل العمولات." },
  { icon: Building2, title: "السلاسل ومتعددو الفروع", text: "من يدير أكثر من فرع ويحتاج تقارير ودخل موحّد." },
  { icon: Users, title: "مطاعم الجلوس والوجهات", text: "من يعاني طوابير وحجوزات ويريد طلباً ودفعاً من الطاولة." },
  { icon: Gift, title: "من يبغى عملاء يرجعون", text: "من يصرف على إعلانات لجذب عملاء جدد ويريد ولاءً وزيارات متكرّرة." },
  { icon: Sparkles, title: "المشاريع الجديدة", text: "من يبدأ الآن ويريد يبني حضوره الرقمي من أول يوم بأقل تكلفة." },
];

const SERVICES = [
  {
    icon: QrCode,
    name: "١) المنيو الرقمي (باركود)",
    what: "منيو أنيق بصور وسعرات ومكوّنات، يفتحه العميل بمسح باركود من جواله.",
    owner: "بلا تكلفة طباعة — يعدّل السعر أو الصنف في ثوانٍ، والتغيير يظهر فوراً.",
    say: "«منيوك الورقي يتلف ويكلّفك طباعة كل ما تغيّر سعر — هنا تعدّله بجوالك في ثانية.»",
  },
  {
    icon: CreditCard,
    name: "٢) الطلب والدفع الإلكتروني",
    what: "العميل يطلب ويدفع أونلاين ويختار طريقة الاستلام.",
    owner: "طوابير وأخطاء أقل، وموظفك يخدم العميل بدل ما ينشغل بأخذ الطلبات.",
    say: "«خلّي العميل يطلب ويدفع من مكانه — أسرع للعميل وأقل ضغط على فريقك.»",
  },
  {
    icon: Store,
    name: "٣) الطاولات والحجوزات والدور",
    what: "طلب ودفع من الطاولة، نظام حجوزات، وإدارة الدور.",
    owner: "تدوير طاولات أسرع وتنظيم أفضل في أوقات الزحام.",
    say: "«في وقت الزحمة، الطاولة تطلب وتدفع لحالها — تخدم عملاء أكثر بنفس الفريق.»",
  },
  {
    icon: Building2,
    name: "٤) الفروع والدومين والبيكسل",
    what: "إدارة عدة فروع من مكان واحد، دومين خاص، وربط بيكسل للتسويق.",
    owner: "تحكّم مركزي وهوية احترافية وقياس دقيق لحملاتك.",
    say: "«كل فروعك بلوحة واحدة، وبدومينك أنت — تطلع احترافي قدام عميلك.»",
  },
  {
    icon: Bike,
    name: "٥) توحيد طلبات التوصيل + مزامنة فودكس",
    what: "تجميع هنقرستيشن وجاهز وكيتا داخل كاشيرك، ومزامنة مع فودكس Foodics.",
    owner: "تقرير دخل واحد دقيق بلا إدخال مزدوج ولا أخطاء.",
    say: "«بدل ما تطالع ٣ شاشات توصيل، كلها تجيك بمكان واحد مع دخلك الحقيقي.»",
  },
  {
    icon: Gift,
    name: "٦) بطاقات الهدايا والولاء",
    what: "بطاقة ولاء رقمية في محفظة آبل/قوقل — ختم مع كل زيارة وبطاقات هدايا.",
    owner: "العميل يرجع من نفسه عشان الكوب الخامس المجاني — تكرار زيارة بلا إعلانات.",
    say: "«بدل ما تصرف على إعلانات لعميل جديد، خلّي عميلك الحالي يرجع لك من نفسه.»",
  },
  {
    icon: MonitorSmartphone,
    name: "٧) الكاشير الموحّد + التقارير",
    what: "كل الطلبات (مباشر + أونلاين + توصيل) على شاشة واحدة، مع تقارير مبيعات وأصناف.",
    owner: "تجهيز أسرع، أخطاء أقل، وتعرف دخلك الحقيقي وأصنافك الأكثر ربحاً.",
    say: "«شاشة واحدة تجمع كل طلباتك، وتقرير يقول لك وش الصنف اللي يربّحك فعلاً.»",
  },
];

const TIERS = [
  { name: "الأساسية", price: "349", note: "منيو رقمي كامل بكل التفاصيل", features: ["منيو رقمي بكل التفاصيل", "صور وسعرات ومكوّنات", "تحديث فوري بلا طباعة"] },
  { name: "VIP", price: "879", note: "لمطاعم الجلوس والوجهات المزدحمة", features: ["منيو رقمي كامل", "طلب ودفع إلكتروني", "الطلب والدفع من الطاولة", "الحجوزات والدور", "الفروع والدومين والبيكسل"] },
  { name: "VIP بلس", price: "1079", note: "الأقوى — يشمل الولاء ومزامنة فودكس", highlight: true, badge: "بطاقات الولاء", features: ["كل مزايا VIP", "بطاقات الهدايا والولاء", "مزامنة فودكس Foodics"] },
  { name: "باقة الكاشير", price: "1349", note: "نظام فقط بدون أجهزة · للفرع الواحد", features: ["نظام كاشير متكامل", "بدون أجهزة", "كل فرع إضافي ٢٤٩ ريال"] },
];

function Section({ n, title, icon: Icon, children }: { n?: string; title: string; icon: LucideIconT; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-7">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: ACCENT }}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-xl font-black" style={{ color: "#2b2620" }}>
          {n && <span style={{ color: ACCENT }}>{n} </span>}{title}
        </h2>
      </div>
      {children}
    </section>
  );
}

type LucideIconT = typeof Info;

export default function MenuStaffGuide() {
  return (
    <div dir="rtl" className="min-h-screen" style={{ fontFamily: "'Tajawal', system-ui, sans-serif", backgroundColor: "#fbfaf5", color: "#2b2620" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 border-b" style={{ backgroundColor: "rgba(251,250,245,.9)", borderColor: "#eee3d6", backdropFilter: "blur(8px)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-lg px-2 py-1 text-xs font-black text-white" style={{ backgroundColor: ACCENT }}>دليل الموظف</span>
            <span className="text-sm font-bold">قائمة الطلبات</span>
          </div>
          <Link href="/offer/menu" target="_blank" className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: ACCENT_DEEP }}>
            صفحة العميل <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Intro banner */}
      <div className="px-4 pt-6">
        <div className="mx-auto max-w-3xl rounded-3xl p-6 text-white" style={{ background: `linear-gradient(140deg, ${ACCENT_DEEP}, ${ACCENT})` }}>
          <p className="text-sm font-bold opacity-90">سكربت العرض — اعرضه بالتسلسل</p>
          <h1 className="mt-1 text-2xl font-black leading-snug">من التعريف إلى الإغلاق: كيف تعرض «قائمة الطلبات» خطوة بخطوة</h1>
          <p className="mt-2 text-sm opacity-90">ابدأ بتعريف المنصة، حدّد إن كان العميل من الفئة المستهدفة، اشرح الخدمات من المنيو إلى الكاشير، ثم اعرض الباقة الأنسب.</p>
        </div>
      </div>

      {/* 1. About */}
      <Section title="عن المنصة" icon={Info}>
        <div className="rounded-2xl bg-white p-5" style={{ border: "1px solid #ece1d3" }}>
          <p className="text-lg font-black" style={{ color: ACCENT_DEEP }}>قائمة الطلبات</p>
          <p className="mt-1 leading-relaxed text-[15px]">
            منصة سعودية متكاملة للمطاعم والكافيهات: <b>منيو إلكتروني + طلب ودفع أونلاين + نظام كاشير موحّد + ولاء وبطاقات هدايا</b> — تدير مطعمك رقمياً من مكان واحد، بلا تكلفة طباعة وبتحديث لحظي.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ backgroundColor: `${ACCENT}12`, color: ACCENT_DEEP }}>
              <MapPin className="h-4 w-4" /> السوق: السعودية · دعم فني طوال الاشتراك
            </span>
            <Link href="/offer/menu" target="_blank" className="flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-white" style={{ backgroundColor: ACCENT }}>
              رابط العرض للعميل <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mt-3 rounded-xl p-3 text-[13px]" style={{ backgroundColor: "#f6f1ff", color: ACCENT_DEEP }}>
            <MessageSquareQuote className="mb-1 inline h-4 w-4" /> افتتاحية مقترحة: «قائمة الطلبات تخلّي مطعمك يستقبل الطلبات أونلاين، يقلّل الأخطاء، ويرفع مبيعاته — منيو وكاشير وولاء بمكان واحد.»
          </p>
        </div>
      </Section>

      {/* 2. Target audience */}
      <Section title="الفئة المستهدفة" icon={Users}>
        <p className="mb-3 text-sm text-neutral-600">تأكّد أول إن العميل من هذي الفئات — يسهّل عليك ربط الحاجة بالحل:</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {AUDIENCE.map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-white p-4" style={{ border: "1px solid #ece1d3" }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${ACCENT}14`, color: ACCENT_DEEP }}>
                <a.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold">{a.title}</p>
                <p className="text-[13px] leading-relaxed text-neutral-600">{a.text}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 3. Services in sequence */}
      <Section title="الخدمات بالتسلسل — من المنيو إلى الكاشير" icon={QrCode}>
        <div className="space-y-3">
          {SERVICES.map((s, i) => (
            <div key={i} className="rounded-2xl bg-white p-5" style={{ border: "1px solid #ece1d3" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: ACCENT }}>
                  <s.icon className="h-5 w-5" />
                </span>
                <p className="text-[17px] font-black">{s.name}</p>
              </div>
              <div className="mt-3 space-y-2 text-[14px] leading-relaxed">
                <p><span className="font-bold" style={{ color: ACCENT_DEEP }}>الخدمة:</span> {s.what}</p>
                <p><span className="font-bold" style={{ color: "#0f766e" }}>الفايدة لصاحب المحل:</span> {s.owner}</p>
                <p className="rounded-xl p-3 text-[13px]" style={{ backgroundColor: "#f6f1ff", color: ACCENT_DEEP }}>
                  <MessageSquareQuote className="mb-1 ml-1 inline h-4 w-4" />{s.say}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* 4. Packages */}
      <Section title="الباقات" icon={CreditCard}>
        <p className="mb-3 text-sm text-neutral-600">أسعار سنوية · دعم فني لجميع الباقات — اعرض الأنسب حسب حاجة العميل.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIERS.map((t, i) => (
            <div key={i} className="relative rounded-2xl p-5" style={{ backgroundColor: t.highlight ? "#fffdf7" : "#fff", border: t.highlight ? `2px solid ${GOLD}` : "1px solid #ece1d3" }}>
              {t.badge && (
                <span className="absolute -top-3 right-5 rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: GOLD, color: "#4a3410" }}>{t.badge}</span>
              )}
              <p className="text-lg font-black">{t.name}</p>
              <p className="mt-1">
                <span className="text-3xl font-black" style={{ color: ACCENT_DEEP }}>{t.price}</span>
                <span className="text-sm text-neutral-500"> ريال/سنة</span>
              </p>
              <p className="mt-1 text-[13px] text-neutral-600">{t.note}</p>
              <ul className="mt-3 space-y-1.5">
                {t.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-[13px]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <div className="mx-auto max-w-3xl px-4 pb-10 pt-2">
        <div className="rounded-2xl p-5 text-center text-white" style={{ background: `linear-gradient(140deg, ${ACCENT_DEEP}, ${ACCENT})` }}>
          <p className="text-lg font-black">أغلق بسؤال واضح</p>
          <p className="mt-1 text-sm opacity-90">«أي باقة تشوفها الأنسب لمطعمك، نبدأ فيها اليوم؟» — ثم جهّز له المنيو والباركود وابدأ التفعيل.</p>
        </div>
      </div>
    </div>
  );
}
