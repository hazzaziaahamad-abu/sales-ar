"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchRenewals, fetchEmployees } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { formatMoneyFull } from "@/lib/utils/format";
import type { Renewal, Employee } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Target,
  Users,
  Phone,
  MessageSquare,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ChevronDown,
  DollarSign,
  UserX,
  RefreshCw,
  Flame,
  Eye,
  Heart,
  Award,
  BookOpen,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Strategy Map — per cancel reason                                   */
/* ------------------------------------------------------------------ */
const STRATEGY_MAP: Record<
  string,
  {
    icon: string;
    color: string;
    impact: string;
    steps: string[];
    script: string;
  }
> = {
  "ارتفاع السعر": {
    icon: "💰",
    color: "amber",
    impact: "عالي",
    steps: [
      "قدّم عرض خصم تجديد مبكّر (10-15%) لمدة محدودة",
      "وضّح العائد على الاستثمار مقارنة بالتكلفة الشهرية",
      "اعرض خطة دفع مرنة (شهري بدل سنوي) لتخفيف العبء",
      "قارن السعر مع تكلفة البدائل (أنظمة يدوية أو منافسين)",
    ],
    script:
      "مرحبا {اسم_العميل}، نقدّر شراكتك معنا. بمناسبة تجديد اشتراكك، عندنا عرض خاص لك: خصم {نسبة}% على التجديد السنوي. النظام ساعدك توفّر وقت وجهد كبير، ونبي نضمن لك استمرار هالفائدة. تبي أشرح لك التفاصيل؟",
  },
  "قلة الاستخدام": {
    icon: "📉",
    color: "sky",
    impact: "عالي",
    steps: [
      "حدد جلسة تدريب مجانية 1-على-1 لشرح المزايا غير المُستخدمة",
      "شارك قصص نجاح عملاء مشابهين يستخدمون النظام بفعالية",
      "عيّن مسؤول دعم مخصص للمتابعة الأسبوعية لمدة شهر",
      "أرسل تقرير شهري يوضّح كم وفّر العميل باستخدام النظام",
    ],
    script:
      "مرحبا {اسم_العميل}، لاحظنا إن فيه مزايا كثيرة في النظام ممكن تساعدك أكثر. نبي نخصص لك جلسة تدريب مجانية عشان تستفيد من كل الإمكانيات. متى يناسبك؟",
  },
  "التحوّل لمنافس": {
    icon: "🔄",
    color: "red",
    impact: "حرج",
    steps: [
      "اسأل عن المنافس المحدد واعرف ايش ميّزه عندهم",
      "جهّز مقارنة واضحة توضّح مزاياك الفريدة",
      "قدّم عرض مطابقة أو تفوّق على عرض المنافس",
      "وضّح تكلفة النقل (وقت، بيانات، تدريب من جديد)",
    ],
    script:
      "مرحبا {اسم_العميل}، سمعنا إنك تفكر في خيارات ثانية. نحب نعرف ايش اللي يهمك عشان نشوف كيف نقدر نخدمك أحسن. عندنا مزايا حصرية مثل {ميزة_1} و{ميزة_2}. ممكن نتكلم 5 دقايق؟",
  },
  "نقص ميزات": {
    icon: "🧩",
    color: "indigo",
    impact: "متوسط",
    steps: [
      "اجمع طلبات المزايا المحددة من العميل",
      "شارك خارطة الطريق القادمة وبيّن إن طلبه مُدرج",
      "قدّم وصول مبكر (Beta) للمزايا الجديدة",
      "اقترح حلول بديلة مؤقتة باستخدام المزايا الحالية",
    ],
    script:
      "مرحبا {اسم_العميل}، شكراً لملاحظاتك. فريق التطوير يشتغل على تحديثات جديدة تشمل {ميزة_مطلوبة}. نبي نعطيك وصول مبكر لها. هل تحب نرتب لك عرض للمزايا القادمة؟",
  },
  "مشكلات تقنية": {
    icon: "🔧",
    color: "orange",
    impact: "حرج",
    steps: [
      "صعّد المشكلة فوراً لفريق التطوير مع أولوية عالية",
      "وفّر دعم مخصص ومباشر حتى حل المشكلة بالكامل",
      "قدّم تعويض (شهر مجاني أو خصم) كاعتذار",
      "تابع بعد الحل للتأكد من رضا العميل التام",
    ],
    script:
      "مرحبا {اسم_العميل}، نعتذر جداً عن المشكلة التقنية اللي واجهتك. خصصنا فريق لحلها بأسرع وقت. كتعويض، بنقدم لك {تعويض}. أولويتنا رضاك التام.",
  },
  "اغلاق المحل": {
    icon: "🏪",
    color: "slate",
    impact: "منخفض",
    steps: [
      "اعرض إمكانية إيقاف الاشتراك مؤقتاً بدل الإلغاء",
      "اسأل عن خطط فتح فرع جديد أو مشروع آخر",
      "اطلب ترشيح (Referral) لمعارف يحتاجون النظام",
      "احتفظ ببيانات العميل للتواصل المستقبلي",
    ],
    script:
      "نتمنى لك التوفيق. لو فكّرت تفتح مشروع جديد، اشتراكك محفوظ وتقدر ترجع بنفس الشروط. هل تعرف أحد ممكن يستفيد من النظام؟ عندنا عرض إحالة مميز.",
  },
  "مو حاب يجدد بدون سبب": {
    icon: "🤷",
    color: "purple",
    impact: "متوسط",
    steps: [
      "تواصل شخصي من المدير لفهم السبب الحقيقي",
      "قدّم عرض حصري (خصم كبير أو ميزة إضافية)",
      "أرسل استبيان خروج قصير ومباشر",
      "حدد موعد مكالمة متابعة بعد أسبوع",
    ],
    script:
      "مرحبا {اسم_العميل}، أنا {اسم_المدير} مدير العلاقات. نقدّر تعاملك معنا ونبي نفهم كيف نقدر نخدمك أحسن. عندنا عرض خاص مخصص لك. ممكن نتكلم دقيقتين؟",
  },
  "الادارة رفضت": {
    icon: "👔",
    color: "blue",
    impact: "عالي",
    steps: [
      "جهّز عرض تقديمي ROI مخصص لصاحب القرار",
      "اطلب اجتماع مباشر مع الإدارة لشرح القيمة",
      "وفّر بيانات وأرقام عن توفير التكاليف",
      "اعرض فترة تجربة مجانية إضافية لإثبات القيمة",
    ],
    script:
      "مرحبا {اسم_العميل}، جهزنا لك تقرير يوضح كيف النظام وفّر لكم {مبلغ} ريال وساعد في تحسين العمليات. ممكن نرتب اجتماع قصير مع الإدارة لعرض الأرقام؟",
  },
  "أخرى": {
    icon: "📋",
    color: "gray",
    impact: "متوسط",
    steps: [
      "تواصل هاتفي لفهم السبب الحقيقي",
      "وثّق الملاحظات بالتفصيل لتحسين الخدمة",
      "قدّم عرض مخصص بناءً على احتياج العميل",
      "تابع بعد أسبوع حتى لو رفض",
    ],
    script:
      "مرحبا {اسم_العميل}، نحب نسمع رأيك عشان نتطور. ايش الشي اللي نقدر نحسنه عشان نخليك تستمر معنا؟ رأيك يهمنا جداً.",
  },
};


/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */
export default function RenewalBoostPage() {
  const { activeOrgId: orgId } = useAuth();
  const { activeMonthIndex, filterCutoff } = useTopbarControls();
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRenewals(), fetchEmployees()])
      .then(([r, e]) => { setRenewals(r); setEmployees(e); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* ─── Month filter ─── */
  const monthRenewals = useMemo(() => {
    if (filterCutoff) return renewals.filter((r) => new Date(r.renewal_date) >= filterCutoff);
    if (activeMonthIndex) {
      return renewals.filter((r) => {
        const d = new Date(r.renewal_date);
        return d.getMonth() + 1 === activeMonthIndex.month && d.getFullYear() === activeMonthIndex.year;
      });
    }
    return renewals;
  }, [renewals, activeMonthIndex, filterCutoff]);

  /* ─── Analytics ─── */
  const analytics = useMemo(() => {
    const total = monthRenewals.length;
    const renewed = monthRenewals.filter((r) => r.status === "مكتمل").length;
    const cancelled = monthRenewals.filter((r) => r.status === "ملغي بسبب").length;
    const scheduled = monthRenewals.filter((r) => r.status === "مجدول").length;
    const following = monthRenewals.filter((r) => r.status === "جاري المتابعة").length;
    const waiting = monthRenewals.filter((r) => r.status === "انتظار الدفع").length;
    const noResponse = monthRenewals.filter((r) => ["مافي تجاوب", "الرقم غلط"].includes(r.status)).length;
    const hesitant = monthRenewals.filter((r) => r.status === "متردد").length;
    const renewalRate = total > 0 ? Math.round((renewed / total) * 100) : 0;
    const churnRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const activeFollowUp = total > 0 ? Math.round(((following + waiting) / total) * 100) : 0;
    const idle = total > 0 ? Math.round((scheduled / total) * 100) : 0;
    const revenueLoss = monthRenewals.filter((r) => r.status === "ملغي بسبب").reduce((s, r) => s + r.plan_price, 0);
    const totalRevenue = monthRenewals.filter((r) => r.status === "مكتمل").reduce((s, r) => s + r.plan_price, 0);
    const potentialRevenue = monthRenewals.reduce((s, r) => s + r.plan_price, 0);
    const retentionRate = potentialRevenue > 0 ? Math.round((totalRevenue / potentialRevenue) * 100) : 0;

    // Cancel reasons
    const cancelReasons = monthRenewals
      .filter((r) => r.status === "ملغي بسبب" && r.cancel_reason)
      .reduce<Record<string, number>>((acc, r) => { acc[r.cancel_reason!] = (acc[r.cancel_reason!] || 0) + 1; return acc; }, {});
    const cancelReasonsArr = Object.entries(cancelReasons)
      .map(([reason, count]) => ({ reason, count, pct: cancelled > 0 ? Math.round((count / cancelled) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // Health score (0-100)
    const renewalScore = Math.min(40, (renewalRate / 75) * 40);
    const churnScore = Math.min(30, churnRate <= 15 ? 30 : Math.max(0, 30 - ((churnRate - 15) / 85) * 30));
    const coverageScore = Math.min(20, (activeFollowUp / 50) * 20);
    const revenueScore = Math.min(10, (retentionRate / 100) * 10);
    const healthScore = Math.round(renewalScore + churnScore + coverageScore + revenueScore);

    // At-risk renewals
    const now = new Date();
    const atRisk = monthRenewals.filter((r) => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      const daysUntil = Math.ceil((new Date(r.renewal_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7) return true;
      if (["مافي تجاوب", "الرقم غلط", "متردد"].includes(r.status)) return true;
      if (!r.assigned_rep) return true;
      // Stale: no update in 7+ days
      const daysSinceUpdate = Math.ceil((now.getTime() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate >= 7 && !["مكتمل", "ملغي بسبب"].includes(r.status)) return true;
      return false;
    }).sort((a, b) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime());

    // Team performance
    const repMap = new Map<string, { total: number; completed: number; cancelled: number; pending: number }>();
    for (const r of monthRenewals) {
      const rep = r.assigned_rep || "غير معيّن";
      if (!repMap.has(rep)) repMap.set(rep, { total: 0, completed: 0, cancelled: 0, pending: 0 });
      const d = repMap.get(rep)!;
      d.total++;
      if (r.status === "مكتمل") d.completed++;
      else if (r.status === "ملغي بسبب") d.cancelled++;
      else d.pending++;
    }
    const teamPerformance = Array.from(repMap.entries())
      .map(([name, data]) => ({ name, ...data, rate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);

    // Weekly action plan
    const overdue = monthRenewals.filter((r) => {
      if (["مكتمل", "ملغي بسبب"].includes(r.status)) return false;
      return new Date(r.renewal_date) < now;
    }).length;
    const noResponseCount = noResponse;
    const unassigned = monthRenewals.filter((r) => !r.assigned_rep && !["مكتمل", "ملغي بسبب"].includes(r.status)).length;
    const stale = monthRenewals.filter((r) => {
      if (["مكتمل", "ملغي بسبب"].includes(r.status)) return false;
      return Math.ceil((now.getTime() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24)) >= 7;
    }).length;

    return {
      total, renewed, cancelled, scheduled, following, waiting, noResponse, hesitant,
      renewalRate, churnRate, activeFollowUp, idle, revenueLoss, totalRevenue, potentialRevenue, retentionRate,
      cancelReasonsArr, healthScore, atRisk, teamPerformance,
      overdue, noResponseCount, unassigned, stale,
      topReason: cancelReasonsArr[0]?.reason || null,
    };
  }, [monthRenewals]);

  /* ─── Health color ─── */
  const healthColor = analytics.healthScore >= 70 ? "emerald" : analytics.healthScore >= 40 ? "amber" : "red";
  const healthLabel = analytics.healthScore >= 70 ? "جيد" : analytics.healthScore >= 40 ? "يحتاج تحسين" : "حرج";

  /* ─── SVG Arc for health score ─── */
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (analytics.healthScore / 100) * circumference;
  const strokeColor = healthColor === "emerald" ? "#10B981" : healthColor === "amber" ? "#F59E0B" : "#EF4444";


  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[14px]" />)}
        </div>
        <Skeleton className="h-64 rounded-[14px]" />
        <Skeleton className="h-48 rounded-[14px]" />
      </div>
    );
  }

  if (analytics.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <RefreshCw className="w-12 h-12 text-muted-foreground mb-4 opacity-30" />
        <h2 className="text-lg font-bold text-foreground mb-2">لا توجد تجديدات</h2>
        <p className="text-sm text-muted-foreground">أضف تجديدات من صفحة التجديدات أولاً لعرض خطة التحسين</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* -------- Header -------- */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center ring-1 ring-amber-500/20">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">خطة تحسين التجديدات</h1>
            <p className="text-xs text-muted-foreground">تحليل ذكي للأرقام وخطط عملية لرفع معدل التجديد وتقليل الإلغاء</p>
          </div>
        </div>
      </div>

      {/* -------- Health Score + Diagnosis -------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score */}
        <div className="cc-card rounded-[14px] p-6 border border-white/[0.06] flex flex-col items-center justify-center text-center">
          <p className="text-xs font-bold text-muted-foreground mb-4">نتيجة صحة التجديدات</p>
          <div className="relative w-[140px] h-[140px]">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-white/[0.06]" strokeWidth="10" />
              <circle cx="60" cy="60" r={radius} fill="none" stroke={strokeColor} strokeWidth="10"
                strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - progress}
                className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold font-mono" style={{ color: strokeColor }}>{analytics.healthScore}</span>
              <span className="text-[10px] text-muted-foreground">من 100</span>
            </div>
          </div>
          <span className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
            healthColor === "emerald" ? "bg-emerald-500/10 text-emerald-400" :
            healthColor === "amber" ? "bg-amber-500/10 text-amber-400" :
            "bg-red-500/10 text-red-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              healthColor === "emerald" ? "bg-emerald-400" : healthColor === "amber" ? "bg-amber-400" : "bg-red-400"
            }`} />
            {healthLabel}
          </span>
          <div className="mt-4 w-full space-y-2 text-[11px]">
            {[
              { label: "معدل التجديد", value: analytics.renewalRate, target: 75, weight: "40%" },
              { label: "معدل الإلغاء", value: analytics.churnRate, target: 15, weight: "30%", inverted: true },
              { label: "تغطية المتابعة", value: analytics.activeFollowUp, target: 50, weight: "20%" },
              { label: "الاحتفاظ بالإيرادات", value: analytics.retentionRate, target: 100, weight: "10%" },
            ].map((item) => {
              const isGood = item.inverted ? item.value <= item.target : item.value >= item.target;
              return (
                <div key={item.label} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${isGood ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="text-muted-foreground flex-1 text-right">{item.label}</span>
                  <span className="font-mono font-bold text-foreground">{item.value}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnosis Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3">
          {/* Renewal Rate */}
          <div className="cc-card rounded-[14px] p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${analytics.renewalRate >= 75 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <TrendingUp className={`w-4 h-4 ${analytics.renewalRate >= 75 ? "text-emerald-400" : "text-red-400"}`} />
              </div>
              <span className="text-xs font-bold text-foreground">معدل التجديد</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-extrabold font-mono ${analytics.renewalRate >= 75 ? "text-emerald-400" : "text-red-400"}`}>{analytics.renewalRate}%</span>
              <span className="text-[10px] text-muted-foreground">الهدف: 75%</span>
            </div>
            <div className="mt-2 h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${analytics.renewalRate >= 75 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, (analytics.renewalRate / 75) * 100)}%` }} />
            </div>
            {analytics.renewalRate < 75 && (
              <p className="text-[10px] text-red-400 mt-2">ينقصك {75 - analytics.renewalRate} نقطة للوصول للهدف — تحتاج تجديد {Math.ceil(analytics.total * 0.75) - analytics.renewed} عميل إضافي</p>
            )}
          </div>

          {/* Churn Rate */}
          <div className="cc-card rounded-[14px] p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${analytics.churnRate <= 15 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                <TrendingDown className={`w-4 h-4 ${analytics.churnRate <= 15 ? "text-emerald-400" : "text-red-400"}`} />
              </div>
              <span className="text-xs font-bold text-foreground">معدل الإلغاء (Churn)</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-extrabold font-mono ${analytics.churnRate <= 15 ? "text-emerald-400" : "text-red-400"}`}>{analytics.churnRate}%</span>
              <span className="text-[10px] text-muted-foreground">الهدف: أقل من 15%</span>
            </div>
            <div className="mt-2 h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${analytics.churnRate <= 15 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, analytics.churnRate)}%` }} />
            </div>
            {analytics.churnRate > 15 && (
              <p className="text-[10px] text-red-400 mt-2">تجاوز الهدف بـ {analytics.churnRate - 15} نقطة — {analytics.cancelled} عميل ألغى من أصل {analytics.total}</p>
            )}
          </div>

          {/* Revenue Loss */}
          <div className="cc-card rounded-[14px] p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10">
                <DollarSign className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-xs font-bold text-foreground">الإيرادات المفقودة</span>
            </div>
            <span className="text-2xl font-extrabold font-mono text-red-400">{formatMoneyFull(analytics.revenueLoss)}</span>
            <p className="text-[10px] text-muted-foreground mt-1">من أصل {formatMoneyFull(analytics.potentialRevenue)} إجمالي محتمل</p>
            {analytics.potentialRevenue > 0 && (
              <p className="text-[10px] text-amber-400 mt-1">فقدان {Math.round((analytics.revenueLoss / analytics.potentialRevenue) * 100)}% من الإيرادات المحتملة</p>
            )}
          </div>

          {/* Follow-up Coverage */}
          <div className="cc-card rounded-[14px] p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${analytics.idle < 30 ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                <Eye className={`w-4 h-4 ${analytics.idle < 30 ? "text-emerald-400" : "text-amber-400"}`} />
              </div>
              <span className="text-xs font-bold text-foreground">تغطية المتابعة</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-extrabold font-mono ${analytics.idle < 30 ? "text-emerald-400" : "text-amber-400"}`}>{analytics.activeFollowUp}%</span>
              <span className="text-[10px] text-muted-foreground">متابعة نشطة</span>
            </div>
            <div className="flex gap-1 mt-2 text-[10px]">
              <span className="text-amber-400">{analytics.scheduled} مجدول</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-red-400">{analytics.noResponse} بلا تجاوب</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-amber-400">{analytics.hesitant} متردد</span>
            </div>
          </div>
        </div>
      </div>


      {/* -------- Weekly Action Plan -------- */}
      <div className="cc-card rounded-[14px] p-5 border border-cyan/10 bg-gradient-to-l from-cyan/[0.03] to-transparent">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-cyan" />
          <h2 className="text-sm font-bold text-foreground">خطة العمل الأسبوعية</h2>
          <span className="text-[10px] text-muted-foreground mr-auto">مرتبة حسب الأولوية</span>
        </div>
        <div className="space-y-2">
          {[
            { priority: 1, label: "تواصل فوري مع التجديدات المتأخرة", count: analytics.overdue, icon: Flame, color: "red", desc: "تجديدات تجاوزت موعدها — تحتاج اتصال اليوم" },
            { priority: 2, label: "متابعة العملاء بدون تجاوب", count: analytics.noResponseCount, icon: Phone, color: "orange", desc: "جرّب التواصل بقناة مختلفة (واتساب، زيارة)" },
            { priority: 3, label: "معالجة السبب الرئيسي للإلغاء", count: analytics.cancelReasonsArr[0]?.count || 0, icon: Shield, color: "amber", desc: analytics.topReason ? `أكثر سبب: "${analytics.topReason}" — طبّق الاستراتيجية المقترحة أدناه` : "لا توجد إلغاءات" },
            { priority: 4, label: "تعيين مسؤول للتجديدات غير المعيّنة", count: analytics.unassigned, icon: UserX, color: "purple", desc: "تجديدات بدون مسؤول متابعة" },
            { priority: 5, label: "مراجعة التجديدات الراكدة", count: analytics.stale, icon: Clock, color: "blue", desc: "لم يتم تحديثها منذ 7 أيام أو أكثر" },
            { priority: 6, label: "متابعة العملاء المترددين", count: analytics.hesitant, icon: Heart, color: "pink", desc: "يحتاجون دفعة أخيرة — قدّم عرض حصري أو اتصال من المدير" },
          ].filter((a) => a.count > 0).map((action) => {
            const Icon = action.icon;
            return (
              <div key={action.priority} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-${action.color}-500/10`}>
                  <Icon className={`w-4 h-4 text-${action.color}-400`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-${action.color}-500/10 text-${action.color}-400`}>
                      أولوية {action.priority}
                    </span>
                    <span className="text-xs font-bold text-foreground">{action.label}</span>
                    <span className="text-xs font-extrabold font-mono text-foreground mr-auto">{action.count}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{action.desc}</p>
                </div>
              </div>
            );
          })}
          {[analytics.overdue, analytics.noResponseCount, analytics.unassigned, analytics.stale, analytics.hesitant].every((c) => c === 0) && analytics.cancelReasonsArr.length === 0 && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-400">ممتاز! لا توجد إجراءات عاجلة</p>
              <p className="text-[11px] text-muted-foreground mt-1">استمر في المتابعة المنتظمة للحفاظ على النتائج</p>
            </div>
          )}
        </div>
      </div>

      {/* -------- Cancel Reasons + Strategies -------- */}
      {analytics.cancelReasonsArr.length > 0 && (
        <div className="cc-card rounded-[14px] p-5 border border-red-500/10 bg-gradient-to-l from-red-500/[0.03] to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-bold text-foreground">أسباب الإلغاء والخطط الاستراتيجية</h2>
            <span className="text-[10px] text-muted-foreground mr-auto">{analytics.cancelled} إلغاء</span>
          </div>

          {/* Reasons bars */}
          <div className="space-y-3 mb-4">
            {analytics.cancelReasonsArr.map((item) => (
              <div key={item.reason}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-1.5">
                    <span>{STRATEGY_MAP[item.reason]?.icon || "📋"}</span>
                    <span className="font-medium text-foreground">{item.reason}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">{item.count} عميل</span>
                    <span className="font-bold text-red-400">{item.pct}%</span>
                  </span>
                </div>
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-red-500/60 transition-all" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Strategy cards */}
          <div className="space-y-3">
            {analytics.cancelReasonsArr.map((item) => {
              const strategy = STRATEGY_MAP[item.reason];
              if (!strategy) return null;
              const isExpanded = expandedStrategy === item.reason;
              return (
                <div key={item.reason} className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                  <button
                    onClick={() => setExpandedStrategy(isExpanded ? null : item.reason)}
                    className="w-full flex items-center gap-3 p-3.5 text-right hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-xl">{strategy.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{item.reason}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          strategy.impact === "حرج" ? "bg-red-500/10 text-red-400" :
                          strategy.impact === "عالي" ? "bg-amber-500/10 text-amber-400" :
                          "bg-sky-500/10 text-sky-400"
                        }`}>
                          {strategy.impact}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{item.count} عميل · {item.pct}% من الإلغاءات</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3">
                      {/* Steps */}
                      <div>
                        <p className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-cyan" />
                          خطوات التنفيذ
                        </p>
                        <div className="space-y-1.5">
                          {strategy.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px]">
                              <span className="w-5 h-5 rounded-full bg-cyan/10 text-cyan flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">{i + 1}</span>
                              <span className="text-muted-foreground leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Script */}
                      <div>
                        <p className="text-[11px] font-bold text-foreground mb-2 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                          نص مقترح للتواصل
                        </p>
                        <div className="rounded-lg bg-amber-500/[0.05] border border-amber-500/10 p-3">
                          <p className="text-[11px] text-amber-200/80 leading-relaxed" dir="rtl">
                            {strategy.script}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* -------- At-Risk Renewals -------- */}
      {analytics.atRisk.length > 0 && (
        <div className="cc-card rounded-[14px] p-5 border border-amber-500/10 bg-gradient-to-l from-amber-500/[0.03] to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-foreground">تجديدات تحتاج تدخل عاجل</h2>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 rounded-full px-2 py-0.5 font-bold">{analytics.atRisk.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">العميل</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">الباقة</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">السعر</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">الحالة</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">الأيام</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">المسؤول</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">السبب</th>
                </tr>
              </thead>
              <tbody>
                {analytics.atRisk.slice(0, 20).map((r) => {
                  const daysUntil = Math.ceil((new Date(r.renewal_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysUntil < 0;
                  const daysSinceUpdate = Math.ceil((new Date().getTime() - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                  let riskReason = "";
                  if (isOverdue) riskReason = "متأخر";
                  else if (["مافي تجاوب", "الرقم غلط"].includes(r.status)) riskReason = "بلا تجاوب";
                  else if (r.status === "متردد") riskReason = "متردد";
                  else if (!r.assigned_rep) riskReason = "بدون مسؤول";
                  else if (daysSinceUpdate >= 7) riskReason = "راكد " + daysSinceUpdate + " يوم";
                  else if (daysUntil <= 7) riskReason = "قريب";
                  return (
                    <tr key={r.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2 font-medium text-foreground">{r.customer_name}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{r.plan_name}</td>
                      <td className="py-2.5 px-2 text-muted-foreground font-mono">{r.plan_price}</td>
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          r.status === "مكتمل" ? "bg-emerald-500/10 text-emerald-400" :
                          r.status === "ملغي بسبب" ? "bg-red-500/10 text-red-400" :
                          ["مافي تجاوب", "الرقم غلط"].includes(r.status) ? "bg-red-500/10 text-red-400" :
                          r.status === "متردد" ? "bg-amber-500/10 text-amber-400" :
                          "bg-sky-500/10 text-sky-400"
                        }`}>{r.status}</span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`font-mono font-bold ${isOverdue ? "text-red-400" : daysUntil <= 3 ? "text-red-400" : "text-amber-400"}`}>
                          {isOverdue ? `${Math.abs(daysUntil)}-` : daysUntil} يوم
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{r.assigned_rep || <span className="text-red-400">—</span>}</td>
                      <td className="py-2.5 px-2">
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{riskReason}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {analytics.atRisk.length > 20 && (
            <p className="text-center text-[11px] text-muted-foreground mt-3">يتم عرض أول 20 من أصل {analytics.atRisk.length}</p>
          )}
        </div>
      )}

      {/* -------- Team Performance -------- */}
      {analytics.teamPerformance.length > 0 && (
        <div className="cc-card rounded-[14px] p-5 border border-sky-500/10 bg-gradient-to-l from-sky-500/[0.03] to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-bold text-foreground">أداء الفريق</h2>
          </div>
          <div className="space-y-3">
            {analytics.teamPerformance.map((rep, idx) => (
              <div key={rep.name} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    idx === 0 && rep.rate >= 50 ? "bg-amber-500/15 text-amber-400" : "bg-white/[0.06] text-muted-foreground"
                  }`}>
                    {idx === 0 && rep.rate >= 50 ? <Award className="w-4 h-4" /> : rep.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{rep.name}</span>
                      <span className={`text-sm font-extrabold font-mono ${rep.rate >= 70 ? "text-emerald-400" : rep.rate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                        {rep.rate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      <span className="text-muted-foreground">الكل: {rep.total}</span>
                      <span className="text-emerald-400">مكتمل: {rep.completed}</span>
                      <span className="text-red-400">ملغي: {rep.cancelled}</span>
                      <span className="text-amber-400">معلق: {rep.pending}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-white/[0.04] rounded-full overflow-hidden flex">
                      {rep.total > 0 && (
                        <>
                          <div className="h-full bg-emerald-500" style={{ width: `${(rep.completed / rep.total) * 100}%` }} />
                          <div className="h-full bg-red-500" style={{ width: `${(rep.cancelled / rep.total) * 100}%` }} />
                          <div className="h-full bg-amber-500/50" style={{ width: `${(rep.pending / rep.total) * 100}%` }} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------- Quick Tips -------- */}
      <div className="cc-card rounded-[14px] p-5 border border-emerald-500/10 bg-gradient-to-l from-emerald-500/[0.03] to-transparent">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-bold text-foreground">نصائح ذهبية لتحسين التجديدات</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { tip: "تواصل مع العميل قبل موعد التجديد بـ 30 يوم على الأقل — لا تنتظر اللحظة الأخيرة", icon: "📅" },
            { tip: "استخدم اسم العميل في كل تواصل واذكر تفاصيل تخصه — يحس إنه مهم مو رقم", icon: "💬" },
            { tip: "شارك قصص نجاح عملاء مشابهين — الدليل الاجتماعي أقوى من أي خصم", icon: "⭐" },
            { tip: "إذا العميل رفض، اسأل: 'ايش نقدر نسوي عشان نخليك تستمر؟' — أحياناً الحل بسيط", icon: "🤝" },
            { tip: "تابع كل عميل ألغى بعد شهر — ممكن يكون غيّر رأيه أو جرّب البديل وما عجبه", icon: "🔄" },
            { tip: "اعمل تقرير أسبوعي للفريق يوضح التقدم والتحديات — الشفافية تحفّز المنافسة الإيجابية", icon: "📊" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{item.tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
