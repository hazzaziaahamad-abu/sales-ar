"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAcademyContent,
  createAcademyContent,
  updateAcademyContent,
  deleteAcademyContent,
} from "@/lib/supabase/db";
import type { AcademyContent } from "@/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

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
      { icon: QrCode, title: "منيو رقمي بـ QR", desc: "إنشاء قائمة طعام إلكترونية جذابة يصل إليها العميل عبر مسح الباركود" },
      { icon: Smartphone, title: "طلب من الطاولة", desc: "العميل يمسح باركود الطاولة ويطلب مباشرة برقم الطاولة" },
      { icon: MessageCircle, title: "ربط واتساب", desc: "العميل يشارك طلبه عبر واتساب بعد إتمامه" },
      { icon: Clock, title: "قائمة انتظار مطورة", desc: "إدارة قائمة الانتظار إلكترونياً مع إشعارات فورية للعميل عند وصول دوره" },
      { icon: CalendarCheck, title: "حجز طاولة", desc: "إمكانية حجز الطاولات مسبقاً" },
      { icon: Star, title: "تقييمات العملاء", desc: "نظام تقييمات يسمح للعملاء بمشاركة آرائهم" },
      { icon: BarChart3, title: "إحصائيات متقدمة", desc: "لوحة تحليلات شاملة لتتبع الطلبات والأداء" },
      { icon: Globe, title: "دعم متعدد الفروع", desc: "إدارة عدة فروع من لوحة تحكم واحدة" },
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
      { icon: CalendarCheck, title: "حجز أونلاين", desc: "نظام حجز إلكتروني يتيح للعملاء الحجز في أي وقت ومن أي مكان" },
      { icon: Users, title: "إدارة العملاء", desc: "قاعدة بيانات شاملة للعملاء مع سجل الحجوزات والتفضيلات" },
      { icon: Clock, title: "إدارة المواعيد", desc: "تنظيم المواعيد وتجنب التعارضات مع تذكيرات تلقائية" },
      { icon: MessageCircle, title: "إشعارات تلقائية", desc: "تأكيد الحجز وتذكيرات عبر واتساب والرسائل النصية" },
      { icon: BarChart3, title: "تقارير وإحصائيات", desc: "تحليل أنماط الحجز وأوقات الذروة والإيرادات" },
      { icon: ShieldCheck, title: "إدارة الإلغاء", desc: "سياسات إلغاء مرنة مع حماية من عدم الحضور" },
      { icon: Smartphone, title: "تطبيق جوال", desc: "إدارة الحجوزات من الجوال مع إشعارات فورية" },
      { icon: Globe, title: "صفحة حجز مخصصة", desc: "رابط حجز مخصص لكل نشاط تجاري بتصميم احترافي" },
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

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */
export default function AcademyPage() {
  const { activeOrgId: orgId, user } = useAuth();
  const isSuperAdmin = user?.isSuperAdmin ?? false;

  const [activeSection, setActiveSection] = useState<SectionKey>("menu");
  const [contents, setContents] = useState<AcademyContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  /* Edit dialog */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formSection, setFormSection] = useState<SectionKey>("menu");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAcademyContent()
      .then(setContents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  const sectionContents = contents.filter((c) => c.section === activeSection && c.is_published);
  const sectionConfig = SECTIONS[activeSection];
  const SectionIcon = sectionConfig.icon;
  const tips = SELLING_TIPS[activeSection];

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

  /* Color maps */
  const colorMap: Record<string, { bg: string; text: string; ring: string; iconBg: string }> = {
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/30", iconBg: "bg-emerald-500/15" },
    violet: { bg: "bg-violet-500/10", text: "text-violet-400", ring: "ring-violet-500/30", iconBg: "bg-violet-500/15" },
  };
  const colors = colorMap[sectionConfig.color];

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
        {isSuperAdmin && (
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="w-4 h-4" />
            إضافة محتوى
          </Button>
        )}
      </div>

      {/* -------- Section Tabs -------- */}
      <div className="flex gap-2">
        {(Object.entries(SECTIONS) as [SectionKey, typeof SECTIONS[SectionKey]][]).map(([key, sec]) => {
          const Icon = sec.icon;
          const isActive = activeSection === key;
          const cm = colorMap[sec.color];
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                isActive
                  ? `${cm.bg} ${cm.text} ring-1 ${cm.ring}`
                  : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {sec.label}
            </button>
          );
        })}
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

      {/* -------- Features Grid -------- */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Sparkles className={`w-4 h-4 ${colors.text}`} />
          مميزات المنتج
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sectionConfig.features.map((feat, i) => {
            const FeatIcon = feat.icon;
            return (
              <div key={i} className="cc-card rounded-[14px] p-4 hover:bg-white/[0.06] transition-all">
                <div className={`w-9 h-9 rounded-lg ${colors.iconBg} flex items-center justify-center mb-3`}>
                  <FeatIcon className={`w-4 h-4 ${colors.text}`} />
                </div>
                <h4 className="text-sm font-bold text-foreground">{feat.title}</h4>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

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
              <Label>القسم</Label>
              <Select value={formSection} onValueChange={(v) => setFormSection(v as SectionKey)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menu">المنيو الالكتروني</SelectItem>
                  <SelectItem value="reservations">إدارة الحجوزات</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
    </div>
  );
}
