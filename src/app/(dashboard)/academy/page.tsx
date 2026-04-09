"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useOrg } from "@/lib/org-context";
import {
  fetchAcademyContent,
  createAcademyContent,
  updateAcademyContent,
  deleteAcademyContent,
  fetchSalesMessages,
  createSalesMessage,
  updateSalesMessage,
  deleteSalesMessage,
  addMessageRating,
  fetchMessageRatings,
  fetchProductFeatures,
  createProductFeature,
  updateProductFeature,
  deleteProductFeature,
} from "@/lib/supabase/db";
import type { AcademyContent, SalesMessage, SalesMessageRating, ProductFeature } from "@/types";

import { TrainingSession } from "@/components/academy/TrainingSession";
import { TrainingKnowledgeEditor } from "@/components/academy/TrainingKnowledgeEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorBadge } from "@/components/ui/color-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  GraduationCap,
  UtensilsCrossed,
  CalendarCheck,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Star,
  Users,
  QrCode,
  MessageCircle,
  BarChart3,
  Smartphone,
  Clock,
  ShieldCheck,
  Globe,
  MessageSquare,
  PhoneCall,
  BrainCircuit,
  Monitor,
  CreditCard,
  Receipt,
  ClipboardList,
  Layers,
  Link,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Icon map for dynamic features                                       */
/* ------------------------------------------------------------------ */
const ICON_MAP: Record<string, LucideIcon> = {
  QrCode, Smartphone, MessageCircle, Clock, CalendarCheck, Star, BarChart3, Globe,
  Users, ShieldCheck, Monitor, CreditCard, Receipt, ClipboardList, Layers, Link,
  Wifi, BookOpen, Sparkles, PhoneCall,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

/* ------------------------------------------------------------------ */
/*  Section config                                                      */
/* ------------------------------------------------------------------ */
const SECTIONS = {
  menu: {
    label: "المنيو الالكتروني",
    icon: UtensilsCrossed,
    color: "emerald",
    gradient: "from-emerald-500/10 to-transparent",
    link: "https://menus-sa.com/ar",
    description: "تعلّم كل شيء عن منصة المنيو الالكتروني وكيفية بيع الخدمة للعملاء",
    features: [
      {
        icon: QrCode,
        title: "منيو رقمي بـ QR",
        desc: "إنشاء قائمة طعام إلكترونية جذابة يصل إليها العميل عبر مسح الباركود",
        marketing: "🔴 المشكلة: صاحب المطعم يصرف آلاف الريالات سنوياً على طباعة القوائم الورقية، وكل ما غيّر سعر أو أضاف صنف يحتاج يطبع من جديد — تكلفة مستمرة وتأخير.\n\n✅ الحل: المنيو الرقمي يخلّي العميل يمسح QR ويشوف القائمة كاملة بصور احترافية، وصاحب النشاط يعدّل الأسعار والأصناف لحظياً بدون أي تكلفة إضافية.\n\n💡 الفايدة: توفير تكاليف الطباعة + تحديث فوري + تجربة عصرية ترفع صورة المطعم عند العميل.",
      },
      {
        icon: Smartphone,
        title: "طلب من الطاولة",
        desc: "العميل يمسح باركود الطاولة ويطلب مباشرة برقم الطاولة",
        marketing: "🔴 المشكلة: العميل جالس ينتظر الويتر يجي ياخذ طلبه، والويتر مشغول بطاولات ثانية — النتيجة: تأخير وزعل العميل وضغط على الموظفين.\n\n✅ الحل: العميل يمسح الباركود على الطاولة ويطلب بنفسه مباشرة بدون ما ينتظر أحد. الطلب يوصل المطبخ تلقائي برقم الطاولة.\n\n💡 الفايدة: تقليل وقت الانتظار + زيادة عدد الطلبات + تقليل الحاجة لعدد كبير من الويترز = توفير رواتب.",
      },
      {
        icon: MessageCircle,
        title: "ربط واتساب",
        desc: "العميل يشارك طلبه عبر واتساب بعد إتمامه",
        marketing: "🔴 المشكلة: صاحب المطعم يحتاج قناة تواصل مباشرة مع عملائه، والاتصال التقليدي بطيء ويضيع طلبات.\n\n✅ الحل: بعد ما العميل يختار طلبه من المنيو، يقدر يرسله مباشرة عبر واتساب — أسرع وأسهل وما يحتاج تطبيق إضافي.\n\n💡 الفايدة: تسهيل الطلبات الخارجية (توصيل/استلام) + تواصل مباشر مع العميل + بدون عمولات منصات التوصيل.",
      },
      {
        icon: Clock,
        title: "قائمة انتظار مطورة",
        desc: "إدارة قائمة الانتظار إلكترونياً مع إشعارات فورية للعميل عند وصول دوره",
        marketing: "🔴 المشكلة: العملاء يزدحمون عند الباب وينتظرون بدون معرفة متى يجي دورهم — كثير منهم يمشون ويروحون لمنافس.\n\n✅ الحل: العميل يسجّل اسمه إلكترونياً ويطلع يتمشى، ولما يجي دوره يوصله إشعار فوري على جواله.\n\n💡 الفايدة: تقليل فقدان العملاء بسبب الانتظار + تجربة احترافية + تقليل الازدحام عند المدخل.",
      },
      {
        icon: CalendarCheck,
        title: "حجز طاولة",
        desc: "إمكانية حجز الطاولات مسبقاً",
        marketing: "🔴 المشكلة: العميل يروح المطعم ويلاقي زحمة وما يلاقي طاولة — يزعل ويروح مكان ثاني، وصاحب المطعم يخسر عميل.\n\n✅ الحل: العميل يحجز طاولته مسبقاً أونلاين ويوصل وطاولته جاهزة — بدون انتظار.\n\n💡 الفايدة: ضمان تجربة مريحة للعميل + تنظيم أفضل للطاولات + تقليل أوقات الفراغ في المطعم.",
      },
      {
        icon: Star,
        title: "تقييمات العملاء",
        desc: "نظام تقييمات يسمح للعملاء بمشاركة آرائهم",
        marketing: "🔴 المشكلة: صاحب المطعم ما يعرف رأي عملائه الحقيقي — إذا كان فيه مشكلة بالخدمة أو الطعام يفقد عملاء بدون ما يدري ليش.\n\n✅ الحل: بعد كل زيارة، العميل يقدر يقيّم تجربته مباشرة — التقييمات الإيجابية تنعرض والسلبية توصل صاحب المطعم بشكل خاص.\n\n💡 الفايدة: معرفة نقاط القوة والضعف + تحسين مستمر + بناء ثقة مع العملاء الجدد.",
      },
      {
        icon: BarChart3,
        title: "إحصائيات متقدمة",
        desc: "لوحة تحليلات شاملة لتتبع الطلبات والأداء",
        marketing: "🔴 المشكلة: صاحب المطعم يدير نشاطه بالإحساس — ما يعرف وش الأصناف اللي تنباع أكثر، أو وش أوقات الذروة، أو كم طلب يجيه يومياً.\n\n✅ الحل: لوحة تحليلات شاملة تعطيه أرقام دقيقة عن كل شيء: الأصناف الأكثر طلباً، أوقات الذروة، متوسط قيمة الطلب، وأداء كل فرع.\n\n💡 الفايدة: قرارات مبنية على بيانات حقيقية + معرفة وش يشتغل ووش يحتاج تحسين + زيادة الأرباح.",
      },
      {
        icon: Globe,
        title: "دعم متعدد الفروع",
        desc: "إدارة عدة فروع من لوحة تحكم واحدة",
        marketing: "🔴 المشكلة: صاحب السلسلة عنده 3-4 فروع وكل فرع يُدار بشكل مستقل — صعوبة في توحيد القوائم والأسعار ومتابعة الأداء.\n\n✅ الحل: لوحة تحكم مركزية واحدة تدير جميع الفروع — تحديث القائمة مرة وحدة وينطبق على الكل، مع تقارير مقارنة بين الفروع.\n\n💡 الفايدة: توفير وقت الإدارة + توحيد الجودة + سهولة التوسع وفتح فروع جديدة.",
      },
    ],
  },
  reservations: {
    label: "إدارة الحجوزات",
    icon: CalendarCheck,
    color: "violet",
    gradient: "from-violet-500/10 to-transparent",
    link: "https://nehgz.com/ar",
    description: "تعلّم كل شيء عن نظام إدارة الحجوزات وكيفية تسويقه للعملاء",
    features: [
      {
        icon: CalendarCheck,
        title: "حجز أونلاين",
        desc: "نظام حجز إلكتروني يتيح للعملاء الحجز في أي وقت ومن أي مكان",
        marketing: "🔴 المشكلة: العميل يتصل يبي يحجز والخط مشغول أو بعد الدوام — يزهق ويحجز عند المنافس. وصاحب النشاط يضيع حجوزات كثيرة بسبب عدم الرد.\n\n✅ الحل: نظام حجز إلكتروني ٢٤/٧ — العميل يدخل الرابط ويحجز بنفسه في أي وقت بدون ما يحتاج يتصل.\n\n💡 الفايدة: عدم فقدان أي حجز + راحة العميل + تقليل الضغط على موظفي الاستقبال.",
      },
      {
        icon: Users,
        title: "إدارة العملاء",
        desc: "قاعدة بيانات شاملة للعملاء مع سجل الحجوزات والتفضيلات",
        marketing: "🔴 المشكلة: صاحب النشاط ما يعرف عملائه المتكررين ولا تفضيلاتهم — كل زيارة تبدأ من الصفر وما فيه تجربة شخصية.\n\n✅ الحل: قاعدة بيانات تحفظ كل عميل: عدد الزيارات، التفضيلات، المناسبات الخاصة — تقدر تستخدمها لتقديم خدمة مميزة.\n\n💡 الفايدة: بناء علاقة شخصية مع العميل + زيادة الولاء + فرص تسويقية مستهدفة (عروض خاصة للعملاء المميزين).",
      },
      {
        icon: Clock,
        title: "إدارة المواعيد",
        desc: "تنظيم المواعيد وتجنب التعارضات مع تذكيرات تلقائية",
        marketing: "🔴 المشكلة: حجوزات متداخلة وتعارضات — عميلين يجون نفس الوقت وما فيه مكان، ينتج عنه إحراج وخسارة عملاء.\n\n✅ الحل: النظام يمنع التعارضات تلقائياً ويرسل تذكيرات قبل الموعد — ما يصير حجزين على نفس المكان أبداً.\n\n💡 الفايدة: صفر تعارضات + تقليل حالات عدم الحضور بنسبة ٤٠٪ بفضل التذكيرات + تنظيم أفضل للجدول اليومي.",
      },
      {
        icon: MessageCircle,
        title: "إشعارات تلقائية",
        desc: "تأكيد الحجز وتذكيرات عبر واتساب والرسائل النصية",
        marketing: "🔴 المشكلة: العميل يحجز وينسى، أو ما يجي ولا يلغي — صاحب النشاط يخسر الموعد ويخسر عميل ثاني كان ممكن يحجز مكانه.\n\n✅ الحل: إشعار تأكيد فوري عند الحجز + تذكير قبل الموعد بـ ٢٤ ساعة عبر واتساب — تلقائي بالكامل بدون تدخل.\n\n💡 الفايدة: تقليل حالات عدم الحضور (No-shows) + العميل يحس باحترافية + لو ما يقدر يجي يلغي بدري وتقدر تفتح الموعد لغيره.",
      },
      {
        icon: BarChart3,
        title: "تقارير وإحصائيات",
        desc: "تحليل أنماط الحجز وأوقات الذروة والإيرادات",
        marketing: "🔴 المشكلة: صاحب النشاط ما يعرف متى أوقات الذروة ومتى أوقات الفراغ — ما يقدر يخطط عروض أو يوزع الموظفين بشكل صحيح.\n\n✅ الحل: تقارير مفصّلة توضح أنماط الحجز: أيام الذروة، أوقات الفراغ، معدل الإلغاء، والإيرادات الشهرية.\n\n💡 الفايدة: قرارات ذكية مبنية على أرقام + تقدر تسوي عروض في أوقات الفراغ لزيادة الإشغال + تخطيط أفضل للموظفين.",
      },
      {
        icon: ShieldCheck,
        title: "إدارة الإلغاء",
        desc: "سياسات إلغاء مرنة مع حماية من عدم الحضور",
        marketing: "🔴 المشكلة: عملاء يحجزون ولا يجون — صاحب النشاط يخسر الموعد والمكان كان ممكن ينباع لعميل ثاني.\n\n✅ الحل: سياسات إلغاء مرنة تقدر تخصصها: إلغاء مجاني قبل ٢٤ ساعة مثلاً، أو طلب دفعة مقدمة للحجوزات الكبيرة.\n\n💡 الفايدة: حماية من خسائر عدم الحضور + مرونة في التعامل مع العملاء + إمكانية فتح الموعد للغير عند الإلغاء المبكر.",
      },
      {
        icon: Smartphone,
        title: "تطبيق جوال",
        desc: "إدارة الحجوزات من الجوال مع إشعارات فورية",
        marketing: "🔴 المشكلة: صاحب النشاط يحتاج يكون في المكتب عشان يشوف الحجوزات ويدير الجدول — ما يقدر يتابع وهو برا.\n\n✅ الحل: كل شيء على جواله — يشوف الحجوزات الجديدة، يوافق أو يرفض، يتواصل مع العملاء، كله من الجوال.\n\n💡 الفايدة: إدارة النشاط من أي مكان + إشعارات فورية لكل حجز جديد + ما يفوته شيء حتى لو مو في الموقع.",
      },
      {
        icon: Globe,
        title: "صفحة حجز مخصصة",
        desc: "رابط حجز مخصص لكل نشاط تجاري بتصميم احترافي",
        marketing: "🔴 المشكلة: صاحب النشاط يبي يسوّق لخدمة الحجز بس ما عنده صفحة احترافية يرسلها للعملاء — يعتمد على الاتصال بس.\n\n✅ الحل: صفحة حجز بتصميم احترافي باسم النشاط ولوقو الخاصة — رابط واحد يرسله في السوشال ميديا والواتساب والقوقل.\n\n💡 الفايدة: صورة احترافية للنشاط + سهولة مشاركة رابط الحجز في كل مكان + زيادة الحجوزات من السوشال ميديا.",
      },
    ],
  },
} as const;

type SectionKey = keyof typeof SECTIONS;

/* ------------------------------------------------------------------ */
/*  Selling tips data                                                   */
/* ------------------------------------------------------------------ */
const SELLING_TIPS: Record<SectionKey, { title: string; tips: string[] }> = {
  menu: {
    title: "نصائح بيع المنيو الالكتروني",
    tips: [
      "ابدأ بسؤال العميل: كم تكلفك طباعة القوائم الورقية سنوياً؟ القائمة الإلكترونية تحذف هذه التكلفة نهائياً",
      "أكد على ميزة الطلب من الطاولة — تقلل وقت الانتظار وتزيد رضا العملاء ومعدل الطلبات",
      "وضّح أن المنيو يتم تحديثه لحظياً — لا حاجة لطباعة جديدة عند تغيير الأسعار أو إضافة أصناف",
      "استخدم إحصائية: عملاؤنا حققوا ضعف المبيعات مقارنة بالقوائم الورقية",
      "اعرض ميزة قائمة الانتظار المطورة — تجربة احترافية ترفع رضا العملاء وتقلل الازدحام",
      "ركز على ميزة واتساب — العميل يرسل طلبه مباشرة وهذا يسهّل التواصل",
      "اعرض أمثلة حية من عملاء حاليين لإقناع العميل المحتمل",
      "إذا كان العميل متردداً، اعرض تجربة مجانية محدودة ليرى النتائج بنفسه",
    ],
  },
  reservations: {
    title: "نصائح بيع نظام الحجوزات",
    tips: [
      "اسأل العميل: كم حجز تخسر شهرياً بسبب عدم الرد على المكالمات؟ النظام يحجز 24/7",
      "وضّح أن الإشعارات التلقائية تقلل نسبة عدم الحضور (No-show) بشكل كبير",
      "أكد على توفير وقت الموظفين — النظام يتعامل مع الحجوزات تلقائياً بدون تدخل بشري",
      "اعرض ميزة التقارير — العميل يعرف أوقات الذروة ويوزع موارده بذكاء",
      "ركز على تجربة العميل النهائي — حجز سهل من الجوال بدون مكالمات أو انتظار",
      "وضّح سهولة الإعداد — النظام جاهز خلال دقائق وليس أيام",
      "استخدم أمثلة: صالونات، عيادات، مطاعم، مراكز ترفيه — كلها تحتاج إدارة حجوزات",
      "إذا كان العميل يستخدم دفتر ورقي، أظهر كيف يمكن أن يخسر حجوزات بسبب الأخطاء البشرية",
    ],
  },
};

const MSG_CATEGORIES = [
  { value: "new_client" as const, label: "عميل جديد", icon: "🆕" },
  { value: "renewal_client" as const, label: "عميل تجديد", icon: "🔄" },
  { value: "cashier_client" as const, label: "عميل نظام كاشير", icon: "💳" },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */
export default function AcademyPage() {
  const { activeOrgId: orgId, user } = useAuth();
  const { orgId: currentOrgId } = useOrg();
  const isSuperAdmin = user?.isSuperAdmin ?? false;

  // Map org to platform: org ...001 = menu, org ...002 = reservations
  const platformSection: SectionKey = currentOrgId === "00000000-0000-0000-0000-000000000002" ? "reservations" : "menu";

  const [showTraining, setShowTraining] = useState(false);
  const [showKnowledgeEditor, setShowKnowledgeEditor] = useState(false);
  const activeSection = platformSection;
  const [contents, setContents] = useState<AcademyContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  /* Messages & scripts state */
  const [messages, setMessages] = useState<SalesMessage[]>([]);
  const [msgDialog, setMsgDialog] = useState(false);
  const [editingMsg, setEditingMsg] = useState<SalesMessage | null>(null);
  const [msgForm, setMsgForm] = useState({
    title: "",
    content: "",
    category: "new_client" as SalesMessage["category"],
    msg_type: "message" as SalesMessage["msg_type"],
  });
  const [msgCategoryFilter, setMsgCategoryFilter] = useState<string>("all");
  const [ratingDialog, setRatingDialog] = useState(false);
  const [ratingMsgId, setRatingMsgId] = useState<string | null>(null);
  const [ratingForm, setRatingForm] = useState({ rating: 5, comment: "" });
  const [viewRatings, setViewRatings] = useState<{ msgId: string; ratings: SalesMessageRating[] } | null>(null);

  /* Edit dialog */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formSection, setFormSection] = useState<SectionKey>("menu");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* Product Features state */
  const [dbFeatures, setDbFeatures] = useState<ProductFeature[]>([]);
  const [featDialog, setFeatDialog] = useState(false);
  const [editingFeat, setEditingFeat] = useState<ProductFeature | null>(null);
  const [featForm, setFeatForm] = useState({ title: "", description: "", marketing_text: "", icon: "Star", category: "general" });

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      fetchAcademyContent(),
      fetchSalesMessages(undefined, activeSection),
      fetchProductFeatures(activeSection),
    ]).then(([contentRes, msgRes, featRes]) => {
      if (contentRes.status === "fulfilled") setContents(contentRes.value);
      if (msgRes.status === "fulfilled") setMessages(msgRes.value);
      if (featRes.status === "fulfilled") setDbFeatures(featRes.value);
      setLoading(false);
    });
  }, [orgId, activeSection]);

  useEffect(() => {
    setMsgCategoryFilter("all");
    setViewRatings(null);
  }, [activeSection]);

  const sectionContents = contents.filter((c) => c.section === activeSection && c.is_published);
  const sectionConfig = SECTIONS[activeSection];
  const SectionIcon = sectionConfig.icon;
  const tips = SELLING_TIPS[activeSection];

  // Combine hardcoded + DB features
  const hardcodedFeats = sectionConfig.features.map((f, i) => ({
    id: `hc-${i}`,
    title: f.title,
    description: f.desc,
    marketing_text: f.marketing,
    icon: Object.entries(ICON_MAP).find(([, v]) => v === f.icon)?.[0] || "Star",
    category: "general",
    isHardcoded: true,
  }));
  const dynamicFeats = dbFeatures.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    marketing_text: f.marketing_text || "",
    icon: f.icon,
    category: f.category,
    isHardcoded: false,
  }));
  // Show DB features if any exist, otherwise show hardcoded defaults
  const allFeatures = dynamicFeats.length > 0 ? dynamicFeats : hardcodedFeats;
  const [expandedFeat, setExpandedFeat] = useState<string | null>(null);

  /* Feature handlers */
  function openAddFeat() {
    setEditingFeat(null);
    setFeatForm({ title: "", description: "", marketing_text: "", icon: "Star", category: "general" });
    setFeatDialog(true);
  }
  function openEditFeat(feat: ProductFeature) {
    setEditingFeat(feat);
    setFeatForm({ title: feat.title, description: feat.description, marketing_text: feat.marketing_text || "", icon: feat.icon, category: feat.category });
    setFeatDialog(true);
  }
  async function handleSaveFeat() {
    if (!featForm.title.trim()) return;
    setSaving(true);
    try {
      if (editingFeat) {
        const updated = await updateProductFeature(editingFeat.id, {
          title: featForm.title,
          description: featForm.description,
          marketing_text: featForm.marketing_text,
          icon: featForm.icon,
          category: featForm.category,
          updated_by: user?.name || "",
        });
        setDbFeatures((prev) => prev.map((f) => (f.id === editingFeat.id ? updated : f)));
      } else {
        const maxOrder = Math.max(0, ...dbFeatures.map((f) => f.sort_order));
        const created = await createProductFeature({
          org_id: orgId || "00000000-0000-0000-0000-000000000001",
          section: activeSection,
          category: featForm.category,
          title: featForm.title,
          description: featForm.description,
          marketing_text: featForm.marketing_text,
          icon: featForm.icon,
          sort_order: maxOrder + 1,
          created_by: user?.name || "",
        });
        setDbFeatures((prev) => [...prev, created]);
      }
      setFeatDialog(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }
  async function handleDeleteFeat(id: string) {
    try {
      await deleteProductFeature(id);
      setDbFeatures((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  function openCreate() {
    setEditingId(null);
    setFormTitle("");
    setFormContent("");
    setFormSection(activeSection);
    setDialogOpen(true);
  }

  function openEdit(item: AcademyContent) {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormContent(item.content);
    setFormSection(item.section);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formTitle.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateAcademyContent(editingId, {
          title: formTitle,
          content: formContent,
          section: formSection,
          updated_by: user?.name || "",
        });
        setContents((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const maxOrder = Math.max(0, ...contents.filter((c) => c.section === formSection).map((c) => c.sort_order));
        const created = await createAcademyContent({
          org_id: orgId || "00000000-0000-0000-0000-000000000001",
          section: formSection,
          title: formTitle,
          content: formContent,
          sort_order: maxOrder + 1,
          is_published: true,
          created_by: user?.name || "",
        });
        setContents((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteAcademyContent(id);
      setContents((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  /* ── Messages handlers ── */
  function openAddMsg(msgType: SalesMessage["msg_type"]) {
    setEditingMsg(null);
    setMsgForm({ title: "", content: "", category: "new_client", msg_type: msgType });
    setMsgDialog(true);
  }

  function openEditMsg(msg: SalesMessage) {
    setEditingMsg(msg);
    setMsgForm({ title: msg.title, content: msg.content, category: msg.category, msg_type: msg.msg_type });
    setMsgDialog(true);
  }

  async function handleSaveMsg() {
    if (!msgForm.title.trim() || !msgForm.content.trim()) return;
    setSaving(true);
    try {
      if (editingMsg) {
        const updated = await updateSalesMessage(editingMsg.id, { title: msgForm.title, content: msgForm.content, category: msgForm.category });
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await createSalesMessage({
          title: msgForm.title,
          content: msgForm.content,
          category: msgForm.category,
          msg_type: msgForm.msg_type,
          product: activeSection,
          created_by: user?.name,
        });
        setMessages((prev) => [created, ...prev]);
      }
      setMsgDialog(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMsg(id: string) {
    await deleteSalesMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  function openRating(msgId: string) {
    setRatingMsgId(msgId);
    setRatingForm({ rating: 5, comment: "" });
    setRatingDialog(true);
  }

  async function handleSubmitRating() {
    if (!ratingMsgId) return;
    setSaving(true);
    try {
      await addMessageRating(ratingMsgId, ratingForm.rating, ratingForm.comment || undefined, user?.name);
      const updated = await fetchSalesMessages(undefined, activeSection);
      setMessages(updated);
      setRatingDialog(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleViewRatings(msgId: string) {
    const ratings = await fetchMessageRatings(msgId);
    setViewRatings({ msgId, ratings });
  }

  /* Color maps */
  const colorMap: Record<string, { bg: string; text: string; ring: string; iconBg: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/30", iconBg: "bg-emerald-500/15" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", ring: "ring-violet-500/30", iconBg: "bg-violet-500/15" },
  };
  const colors = colorMap[sectionConfig.color];

  if (showTraining) {
    return <TrainingSession onBack={() => setShowTraining(false)} platform={activeSection} />;
  }

  if (showKnowledgeEditor) {
    return <TrainingKnowledgeEditor onBack={() => setShowKnowledgeEditor(false)} />;
  }

  return (
    <div className="space-y-6">
      {/* -------- Header -------- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${colors.iconBg} flex items-center justify-center`}>
            <GraduationCap className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">الأكاديمية</h1>
            <p className="text-xs text-muted-foreground">تعلّم المنتجات وطرق البيع الاحترافية</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowTraining(true)} className="gap-1.5 border-cyan/30 text-cyan hover:bg-cyan/10">
            <Sparkles className="w-4 h-4" />
            جلسة تدريبية
          </Button>
          {isSuperAdmin && (
            <Button variant="outline" onClick={() => setShowKnowledgeEditor(true)} className="gap-1.5 border-amber/30 text-amber hover:bg-amber/10">
              <BrainCircuit className="w-4 h-4" />
              تحرير المعرفة
            </Button>
          )}
          {isSuperAdmin && (
            <Button onClick={openCreate} className="gap-1.5">
              <Plus className="w-4 h-4" />
              إضافة محتوى
            </Button>
          )}
        </div>
      </div>

      {/* -------- Section Hero -------- */}
      <div className={`cc-card rounded-[14px] p-6 border border-${sectionConfig.color}-500/10 bg-gradient-to-l ${sectionConfig.gradient}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center shrink-0`}>
            <SectionIcon className={`w-6 h-6 ${colors.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground">{sectionConfig.label}</h2>
            <p className="text-sm text-muted-foreground mt-1">{sectionConfig.description}</p>
            <a
              href={sectionConfig.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 mt-3 text-xs font-medium ${colors.text} hover:underline`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              زيارة الموقع
            </a>
          </div>
        </div>
      </div>

      {/* -------- Features Grid (grouped by category) -------- */}
      {(() => {
        const grouped = new Map<string, typeof allFeatures>();
        for (const feat of allFeatures) {
          const cat = feat.category || "general";
          if (!grouped.has(cat)) grouped.set(cat, []);
          grouped.get(cat)!.push(feat);
        }
        const categoryLabels: Record<string, { title: string; icon: LucideIcon }> = {
          "منيو": { title: "مميزات المنيو الإلكتروني", icon: UtensilsCrossed },
          "كاشير": { title: "مميزات نظام الكاشير (POS)", icon: Monitor },
          "حجوزات": { title: "مميزات نظام الحجوزات", icon: CalendarCheck },
        };
        return Array.from(grouped.entries()).map(([cat, feats]) => {
          const label = categoryLabels[cat] || { title: `مميزات ${cat}`, icon: Sparkles };
          const CatIcon = label.icon;
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CatIcon className={`w-4 h-4 ${colors.text}`} />
                  {label.title}
                </h3>
                {isSuperAdmin && (
                  <Button variant="outline" size="sm" onClick={openAddFeat} className="gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" />
                    إضافة ميزة
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {feats.map((feat) => {
                  const FeatIcon = ICON_MAP[feat.icon] || Star;
                  const isExpanded = expandedFeat === feat.id;
                  return (
                    <div
                      key={feat.id}
                      className={`cc-card rounded-[14px] p-4 hover:bg-white/[0.06] transition-all group relative cursor-pointer ${isExpanded ? "col-span-1 sm:col-span-2 lg:col-span-4 ring-1 ring-white/10" : ""}`}
                      onClick={() => setExpandedFeat(isExpanded ? null : feat.id)}
                    >
                      {isSuperAdmin && !feat.isHardcoded && (
                        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditFeat(dbFeatures.find((f) => f.id === feat.id)!); }}
                            className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFeat(feat.id); }}
                            className="p-1 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg ${colors.iconBg} flex items-center justify-center shrink-0`}>
                          <FeatIcon className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground">{feat.title}</h4>
                            {feat.marketing_text && (
                              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{feat.description}</p>
                        </div>
                      </div>
                      {isExpanded && feat.marketing_text && (
                        <div className="mt-4 pt-4 border-t border-white/[0.06]">
                          <div className="space-y-3">
                            {feat.marketing_text.split("\n\n").map((block, idx) => (
                              <p key={idx} className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                {block}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}

      {/* -------- Selling Tips -------- */}
      <div className="cc-card rounded-[14px] p-5">
        <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Star className={`w-4 h-4 ${colors.text}`} />
          {tips.title}
        </h3>
        <div className="space-y-3">
          {tips.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-6 h-6 rounded-full ${colors.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                <span className={`text-[10px] font-bold ${colors.text}`}>{i + 1}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* -------- Custom Content (Editable) -------- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <BookOpen className={`w-4 h-4 ${colors.text}`} />
            محتوى تعليمي إضافي
          </h3>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="cc-card rounded-[14px] p-5">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-1" />
              </div>
            ))}
          </div>
        ) : sectionContents.length === 0 ? (
          <div className="cc-card rounded-[14px] p-8 text-center">
            <div className={`w-12 h-12 mx-auto rounded-xl ${colors.iconBg} flex items-center justify-center mb-3`}>
              <BookOpen className={`w-6 h-6 ${colors.text} opacity-50`} />
            </div>
            <p className="text-sm text-muted-foreground">
              لا يوجد محتوى إضافي حالياً
            </p>
            {isSuperAdmin && (
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openCreate}>
                <Plus className="w-3.5 h-3.5" />
                إضافة محتوى
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sectionContents.map((item) => {
              const isExpanded = expandedCard === item.id;
              return (
                <div key={item.id} className="cc-card rounded-[14px] overflow-hidden">
                  <button
                    onClick={() => setExpandedCard(isExpanded ? null : item.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/[0.03] transition-all text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center shrink-0`}>
                        <CheckCircle2 className={`w-4 h-4 ${colors.text}`} />
                      </div>
                      <span className="text-sm font-bold text-foreground">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSuperAdmin && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                            className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            disabled={deletingId === item.id}
                            className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="border-t border-border/30 pt-3">
                        <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {item.content}
                        </div>
                        {item.updated_by && (
                          <p className="text-[10px] text-muted-foreground/50 mt-3">
                            آخر تعديل بواسطة: {item.updated_by}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -------- Messages & Scripts -------- */}
      <Tabs defaultValue="messages" dir="rtl">
        <TabsList className="cc-card rounded-2xl p-1.5 gap-1">
          <TabsTrigger value="messages" className="rounded-[14px] text-xs px-4 py-2">رسائل الاستهداف</TabsTrigger>
          <TabsTrigger value="scripts" className="rounded-[14px] text-xs px-4 py-2">سكربت المكالمات</TabsTrigger>
        </TabsList>

        {(["messages", "scripts"] as const).map((tabKey) => {
          const msgType = tabKey === "messages" ? "message" : "script";
          const tabLabel = tabKey === "messages" ? "رسائل الاستهداف" : "سكربت المكالمات";
          const tabIcon = tabKey === "messages" ? <MessageSquare className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />;
          const filtered = messages.filter((m) => m.msg_type === msgType && (msgCategoryFilter === "all" || m.category === msgCategoryFilter));

          return (
            <TabsContent key={tabKey} value={tabKey} className="mt-4">
              <div className="cc-card rounded-[14px] p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {tabIcon}
                    <h3 className="text-base font-bold">{tabLabel} — {sectionConfig.label}</h3>
                  </div>
                  <Button size="sm" onClick={() => openAddMsg(msgType)} className="gap-1.5">
                    <Plus className="w-4 h-4" /> إضافة
                  </Button>
                </div>

                {/* Category filter */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => setMsgCategoryFilter("all")}
                    className={`px-3 py-1.5 rounded-[14px] text-xs transition-all ${
                      msgCategoryFilter === "all"
                        ? "bg-cyan/15 text-cyan font-medium border border-cyan/30"
                        : "text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    الكل
                  </button>
                  {MSG_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setMsgCategoryFilter(cat.value)}
                      className={`px-3 py-1.5 rounded-[14px] text-xs transition-all ${
                        msgCategoryFilter === cat.value
                          ? "bg-cyan/15 text-cyan font-medium border border-cyan/30"
                          : "text-muted-foreground hover:text-foreground border border-border"
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Messages list */}
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {tabKey === "messages" ? <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" /> : <PhoneCall className="w-12 h-12 mx-auto mb-3 opacity-30" />}
                    <p>لا توجد {tabLabel} بعد</p>
                    <p className="text-sm mt-1">أضف أول {tabKey === "messages" ? "رسالة" : "سكربت"} خاص بـ{sectionConfig.label}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filtered.map((m) => {
                      const catInfo = MSG_CATEGORIES.find((c) => c.value === m.category);
                      return (
                        <div key={m.id} className="rounded-2xl p-4 border border-border bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-foreground">{m.title}</h4>
                              <ColorBadge
                                text={`${catInfo?.icon || ""} ${catInfo?.label || m.category}`}
                                color={m.category === "new_client" ? "green" : m.category === "renewal_client" ? "amber" : "purple"}
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => openEditMsg(m)} className="w-7 h-7 p-0 text-muted-foreground hover:text-cyan">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteMsg(m.id)} className="w-7 h-7 p-0 text-muted-foreground hover:text-cc-red">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed mb-3">{m.content}</p>
                          <div className="flex items-center justify-between border-t border-border pt-3">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`w-4 h-4 ${s <= Math.round(m.avg_rating) ? "text-amber fill-amber" : "text-muted-foreground/30"}`} />
                              ))}
                              <span className="text-xs text-muted-foreground mr-1">
                                {m.avg_rating > 0 ? m.avg_rating.toFixed(1) : "—"} ({m.ratings_count})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleViewRatings(m.id)} className="text-xs text-muted-foreground gap-1">
                                <MessageSquare className="w-3.5 h-3.5" /> التعليقات
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openRating(m.id)} className="text-xs text-cyan gap-1">
                                <Star className="w-3.5 h-3.5" /> تقييم
                              </Button>
                            </div>
                          </div>
                          {viewRatings?.msgId === m.id && viewRatings.ratings.length > 0 && (
                            <div className="mt-3 border-t border-border pt-3 space-y-2">
                              {viewRatings.ratings.map((r) => (
                                <div key={r.id} className="flex items-start gap-2 text-xs">
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "text-amber fill-amber" : "text-muted-foreground/20"}`} />
                                    ))}
                                  </div>
                                  <div className="flex-1">
                                    <span className="font-medium text-foreground">{r.rated_by || "مجهول"}</span>
                                    {r.comment && <p className="text-muted-foreground mt-0.5">{r.comment}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {viewRatings?.msgId === m.id && viewRatings.ratings.length === 0 && (
                            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground text-center">لا توجد تعليقات بعد</p>
                          )}
                          {m.created_by && (
                            <p className="text-[10px] text-muted-foreground/50 mt-2">بواسطة: {m.created_by}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* ─── Message Add/Edit Dialog ─── */}
      <Dialog open={msgDialog} onOpenChange={setMsgDialog}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingMsg ? "تعديل" : "إضافة"} {msgForm.msg_type === "message" ? "رسالة استهداف" : "سكربت مكالمة"}
            </DialogTitle>
            <DialogDescription>
              {editingMsg ? "تعديل المحتوى" : `أضف محتوى جديد خاص بـ${sectionConfig.label}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>الفئة</Label>
              <Select
                value={msgForm.category}
                onValueChange={(v) => setMsgForm({ ...msgForm, category: v as SalesMessage["category"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MSG_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>العنوان</Label>
              <Input
                value={msgForm.title}
                onChange={(e) => setMsgForm({ ...msgForm, title: e.target.value })}
                placeholder={msgForm.msg_type === "message" ? "عنوان الرسالة..." : "عنوان السكربت..."}
              />
            </div>
            <div>
              <Label>المحتوى</Label>
              <Textarea
                value={msgForm.content}
                onChange={(e) => setMsgForm({ ...msgForm, content: e.target.value })}
                placeholder={msgForm.msg_type === "message" ? "نص الرسالة..." : "نص السكربت..."}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMsgDialog(false)}>إلغاء</Button>
            <Button onClick={handleSaveMsg} disabled={saving || !msgForm.title.trim() || !msgForm.content.trim()}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Rating Dialog ─── */}
      <Dialog open={ratingDialog} onOpenChange={setRatingDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>تقييم وتعليق</DialogTitle>
            <DialogDescription>قيّم هذا المحتوى وأضف تعليقك</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>التقييم</Label>
              <div className="flex items-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRatingForm({ ...ratingForm, rating: s })}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`w-7 h-7 ${s <= ratingForm.rating ? "text-amber fill-amber" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
                <span className="text-sm font-bold text-amber mr-2">{ratingForm.rating}/5</span>
              </div>
            </div>
            <div>
              <Label>تعليق (اختياري)</Label>
              <Textarea
                value={ratingForm.comment}
                onChange={(e) => setRatingForm({ ...ratingForm, comment: e.target.value })}
                placeholder="أضف تعليقك..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRatingDialog(false)}>إلغاء</Button>
            <Button onClick={handleSubmitRating} disabled={saving}>
              {saving ? "جارٍ الإرسال..." : "إرسال التقييم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- Edit/Create Dialog -------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل المحتوى" : "إضافة محتوى جديد"}</DialogTitle>
            <DialogDescription>
              {editingId ? "عدّل المحتوى التعليمي ثم اضغط حفظ" : "أضف محتوى تعليمي جديد للأكاديمية"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>العنوان</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="مثال: كيفية عرض المنتج على العميل"
              />
            </div>
            <div className="space-y-1.5">
              <Label>المحتوى</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="اكتب المحتوى التعليمي هنا..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving || !formTitle.trim()}>
              {saving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Feature Add/Edit Dialog ─── */}
      <Dialog open={featDialog} onOpenChange={setFeatDialog}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingFeat ? "تعديل الميزة" : "إضافة ميزة جديدة"}</DialogTitle>
            <DialogDescription>
              {editingFeat ? "عدّل بيانات الميزة والمحتوى التسويقي" : "أضف ميزة جديدة لمنتج " + sectionConfig.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>اسم الميزة</Label>
              <Input
                value={featForm.title}
                onChange={(e) => setFeatForm({ ...featForm, title: e.target.value })}
                placeholder="مثال: نظام الكاشير"
              />
            </div>
            <div>
              <Label>الوصف المختصر</Label>
              <Textarea
                value={featForm.description}
                onChange={(e) => setFeatForm({ ...featForm, description: e.target.value })}
                placeholder="وصف مختصر للميزة يظهر في الكرت..."
                rows={2}
              />
            </div>
            <div>
              <Label>المحتوى التسويقي</Label>
              <p className="text-[11px] text-muted-foreground mb-1.5">اكتب المشكلة + الحل + الفايدة — يظهر عند الضغط على الميزة</p>
              <Textarea
                value={featForm.marketing_text}
                onChange={(e) => setFeatForm({ ...featForm, marketing_text: e.target.value })}
                placeholder={"🔴 المشكلة: ...\n\n✅ الحل: ...\n\n💡 الفايدة: ..."}
                rows={8}
                dir="rtl"
              />
            </div>
            <div>
              <Label>التصنيف</Label>
              <Input
                value={featForm.category}
                onChange={(e) => setFeatForm({ ...featForm, category: e.target.value })}
                placeholder="مثال: كاشير، طلبات، عام"
              />
            </div>
            <div>
              <Label>الأيقونة</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ICON_OPTIONS.map((name) => {
                  const Ic = ICON_MAP[name];
                  const isActive = featForm.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setFeatForm({ ...featForm, icon: name })}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all ${
                        isActive ? `${colors.iconBg} ${colors.text} border-current` : "border-border text-muted-foreground hover:text-foreground hover:border-white/20"
                      }`}
                      title={name}
                    >
                      <Ic className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFeatDialog(false)}>إلغاء</Button>
            <Button onClick={handleSaveFeat} disabled={saving || !featForm.title.trim()}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
