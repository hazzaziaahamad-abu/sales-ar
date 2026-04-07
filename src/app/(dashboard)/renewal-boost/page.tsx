"use client";

import { useState, useEffect, useMemo } from "react";
import type { Renewal, Employee } from "@/types";
import { fetchRenewals, fetchEmployees } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import {
  RENEWAL_STATUSES,
  RENEWAL_STATUS_COLORS,
  RENEWAL_CANCEL_REASONS,
  MONTHS_AR,
  getKpiStatus,
} from "@/lib/utils/constants";
import { formatMoney, formatMoneyFull, formatPercent } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/stat-card";
import { ColorBadge } from "@/components/ui/color-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  Activity,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Shield,
  Target,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  MessageSquare,
  UserX,
  DollarSign,
  BarChart3,
  Lightbulb,
  ClipboardList,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Eye,
  UserCheck,
  CalendarClock,
  ShieldAlert,
  Flame,
  Star,
} from "lucide-react";

/* ─── Helpers ─── */
function getDaysRemaining(renewalDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  return Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/* ─── Strategy Map ─── */
const STRATEGY_MAP: Record<string, {
  icon: React.ReactNode;
  impact: string;
  steps: string[];
  script: string;
}> = {
  "ارتفاع السعر": {
    icon: <DollarSign className="w-4 h-4" />,
    impact: "high",
    steps: [
      "عرض خصم تجديد مبكر (10-15%)",
      "تقديم خطة دفع مرنة (أقساط شهرية)",
      "إعداد عرض قيمة يوضح العائد على الاستثمار",
      "مقارنة التكلفة مع البدائل في السوق",
    ],
    script: "مرحباً [اسم العميل]، نقدّر شراكتكم معنا. بمناسبة تجديد اشتراككم، لدينا عرض خاص لكم: خصم [النسبة]% على التجديد السنوي، مع إمكانية الدفع على أقساط مريحة. كما أن الخدمة وفّرت لكم [القيمة] خلال الفترة الماضية. هل يناسبكم نتحدث عن التفاصيل؟",
  },
  "قلة الاستخدام": {
    icon: <Eye className="w-4 h-4" />,
    impact: "high",
    steps: [
      "جدولة جلسة تدريب مجانية للفريق",
      "مشاركة قصص نجاح عملاء مشابهين",
      "تعيين مسؤول دعم مخصص للمتابعة",
      "إرسال تقرير شهري بفرص الاستفادة غير المستغلة",
    ],
    script: "مرحباً [اسم العميل]، لاحظنا أن هناك ميزات كثيرة في النظام ممكن تساعدكم أكثر. نحب نرتب لكم جلسة تدريب مجانية لفريقكم عشان تستفيدون من كامل إمكانيات النظام. عميل مشابه لكم زاد مبيعاته 30% بعد التدريب. متى يناسبكم؟",
  },
  "التحوّل لمنافس": {
    icon: <Shield className="w-4 h-4" />,
    impact: "high",
    steps: [
      "إجراء تحليل مقارنة تنافسية مفصل",
      "مطابقة أو تحسين العرض المنافس",
      "إبراز الميزات الفريدة والتكاملات الحصرية",
      "عرض فترة تجربة مجانية للميزات الجديدة",
    ],
    script: "مرحباً [اسم العميل]، فهمنا أنكم تدرسون خيارات أخرى. نحب نشارككم مقارنة شاملة توضح المزايا اللي عندنا وما تقدرون تحصلونها عند غيرنا. كمان عندنا عرض خاص لكم كعملاء مميزين. ممكن نرتب اجتماع سريع نستعرض فيه كل شي؟",
  },
  "نقص ميزات": {
    icon: <Lightbulb className="w-4 h-4" />,
    impact: "medium",
    steps: [
      "توثيق الميزات المطلوبة وإرسالها لفريق التطوير",
      "مشاركة خارطة طريق المنتج القادمة",
      "عرض وصول مبكر للميزات التجريبية",
      "اقتراح حلول بديلة مؤقتة",
    ],
    script: "مرحباً [اسم العميل]، شكراً على ملاحظاتكم القيّمة. الميزات اللي طلبتوها موجودة في خطة التطوير القادمة. نحب نعطيكم وصول حصري للنسخة التجريبية قبل الإطلاق. كمان عندنا حلول بديلة تقدر تساعدكم حالياً. هل يناسبكم نشرحها لكم؟",
  },
  "مشكلات تقنية": {
    icon: <ShieldAlert className="w-4 h-4" />,
    impact: "high",
    steps: [
      "تصعيد فوري لفريق التطوير مع أولوية قصوى",
      "تعيين مهندس دعم مخصص للعميل",
      "تقديم ضمان مستوى خدمة (SLA) محسّن",
      "عرض تعويض أو تمديد مجاني",
    ],
    script: "مرحباً [اسم العميل]، نعتذر بشدة عن المشكلات التقنية اللي واجهتوها. تم تصعيد حالتكم كأولوية قصوى وعيّنا لكم مهندس دعم مخصص. كتعويض، نقدم لكم [شهر/شهرين] مجاناً مع ضمان SLA محسّن. هل تحبون نرتب مكالمة مع المهندس المختص؟",
  },
  "اغلاق المحل": {
    icon: <XCircle className="w-4 h-4" />,
    impact: "low",
    steps: [
      "عرض خيار تجميد الاشتراك مؤقتاً",
      "تسهيل نقل الاشتراك لموقع/فرع جديد",
      "تقديم برنامج إحالة مع مكافآت",
      "الحفاظ على العلاقة للمستقبل",
    ],
    script: "مرحباً [اسم العميل]، نأسف لسماع ذلك. نحب نساعدكم: نقدر نجمّد اشتراككم بدون رسوم لمدة [3-6] شهور لحين ترتيب أموركم. وإذا عندكم فرع ثاني، نقدر ننقل الاشتراك بسهولة. كمان لو تعرفون أحد يحتاج خدماتنا، عندنا برنامج إحالة مميز.",
  },
  "مو حاب يجدد بدون سبب": {
    icon: <UserX className="w-4 h-4" />,
    impact: "medium",
    steps: [
      "تواصل شخصي من المدير أو المسؤول الأعلى",
      "تقديم عرض حصري ومحدود المدة",
      "إجراء استبيان خروج مختصر لفهم السبب الحقيقي",
      "عرض تجربة مجانية لمدة شهر إضافي",
    ],
    script: "مرحباً [اسم العميل]، أنا [اسم المدير] مدير قسم [القسم]. حبيت أتواصل معكم شخصياً لأن عملاءنا المميزين مهمين لنا. نحب نفهم كيف نقدر نخدمكم أفضل. كمان لدينا عرض حصري لكم: [تفاصيل العرض]. هل عندكم وقت لمكالمة سريعة؟",
  },
  "الادارة رفضت": {
    icon: <ClipboardList className="w-4 h-4" />,
    impact: "medium",
    steps: [
      "إعداد عرض ROI مخصص لصاحب القرار",
      "طلب اجتماع مباشر مع الإدارة العليا",
      "تقديم دراسة حالة من نفس القطاع",
      "عرض خطة تجريبية بمخاطر منخفضة",
    ],
    script: "مرحباً [اسم العميل]، نتفهم أن القرار يحتاج موافقة الإدارة. جهّزنا لكم تقرير عائد استثمار مخصص يوضح القيمة الفعلية للخدمة. كمان عندنا دراسة حالة من شركة في نفس مجالكم حققت [النتائج]. هل نقدر نرتب اجتماع قصير مع صاحب القرار؟",
  },
  "أخرى": {
    icon: <MessageSquare className="w-4 h-4" />,
    impact: "low",
    steps: [
      "إجراء مقابلة خروج شاملة",
      "توثيق جميع الملاحظات والأسباب",
      "مشاركة التقرير مع الفرق المعنية",
      "متابعة بعد شهر للتحقق من إمكانية العودة",
    ],
    script: "مرحباً [اسم العميل]، نحب نفهم تجربتكم معنا بشكل أفضل. هل عندكم دقائق لمشاركتنا ملاحظاتكم؟ رأيكم مهم جداً لنا لتحسين خدماتنا. وبابنا مفتوح لكم دائماً إذا حبيتوا ترجعون.",
  },
};

const IMPACT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "تأثير عالي", color: "text-cc-red", bg: "bg-red-dim" },
  medium: { label: "تأثير متوسط", color: "text-amber", bg: "bg-amber-dim" },
  low: { label: "تأثير منخفض", color: "text-cc-blue", bg: "bg-blue-dim" },
};

/* ─── Health Score SVG Arc ─── */
function HealthScoreRing({ score, size = 180 }: { score: number; size?: number }) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = clamp(score, 0, 100) / 100;
  const dashOffset = circumference * (1 - progress);
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  const bgColor = score >= 70 ? "rgba(16,185,129,0.1)" : score >= 40 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-extrabold font-mono" style={{ color }}>{Math.round(score)}</span>
        <span className="text-[10px] text-muted-foreground mt-0.5">من 100</span>
      </div>
    </div>
  );
}

/* ─── Simple Bar ─── */
function SimpleBar({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "var(--border)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}


/* ─── STATUS BADGE ─── */
const STATUS_BADGE: Record<string, { color: string; bg: string }> = {
  "مجدول": { color: "text-cc-blue", bg: "bg-blue-dim" },
  "جاري المتابعة": { color: "text-amber", bg: "bg-amber-dim" },
  "انتظار الدفع": { color: "text-cc-purple", bg: "bg-purple-dim" },
  "مكتمل": { color: "text-cc-green", bg: "bg-green-dim" },
  "ملغي بسبب": { color: "text-cc-red", bg: "bg-red-dim" },
  "إيقاف مؤقت": { color: "text-amber", bg: "bg-amber-dim" },
  "الرقم غلط": { color: "text-cc-red", bg: "bg-red-dim" },
  "مافي تجاوب": { color: "text-cc-red", bg: "bg-red-dim" },
  "مؤجل مؤقتاً": { color: "text-cc-blue", bg: "bg-blue-dim" },
  "تواصل وقت آخر": { color: "text-cc-purple", bg: "bg-purple-dim" },
  "متردد": { color: "text-amber", bg: "bg-amber-dim" },
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function RenewalBoostPage() {
  const { activeOrgId: orgId } = useAuth();
  const { activeMonthIndex, filterCutoff } = useTopbarControls();

  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStrategies, setExpandedStrategies] = useState<Set<string>>(new Set());

  /* ─── Fetch data ─── */
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([fetchRenewals(), fetchEmployees()])
      .then(([r, e]) => { setRenewals(r); setEmployees(e); })
      .finally(() => setLoading(false));
  }, [orgId]);

  /* ─── Month filtering (same as renewals page) ─── */
  const monthRenewals = useMemo(() => {
    if (filterCutoff) return renewals.filter((r) => new Date(r.renewal_date) >= filterCutoff);
    if (activeMonthIndex) return renewals.filter((r) => {
      const rd = new Date(r.renewal_date);
      return rd.getMonth() + 1 === activeMonthIndex.month;
    });
    return renewals;
  }, [renewals, filterCutoff, activeMonthIndex]);

  /* ─── Core metrics ─── */
  const metrics = useMemo(() => {
    const total = monthRenewals.length;
    const completed = monthRenewals.filter((r) => r.status === "مكتمل").length;
    const cancelled = monthRenewals.filter((r) => r.status === "ملغي بسبب").length;
    const scheduled = monthRenewals.filter((r) => r.status === "مجدول").length;
    const activeFollowUp = monthRenewals.filter((r) => r.status !== "مجدول" && r.status !== "مكتمل" && r.status !== "ملغي بسبب").length;

    const renewalRate = total > 0 ? (completed / total) * 100 : 0;
    const churnRate = total > 0 ? (cancelled / total) * 100 : 0;
    const coverageRate = total > 0 ? ((total - scheduled) / total) * 100 : 0;

    const totalRevenue = monthRenewals.reduce((s, r) => s + (r.plan_price || 0), 0);
    const completedRevenue = monthRenewals.filter((r) => r.status === "مكتمل").reduce((s, r) => s + (r.plan_price || 0), 0);
    const lostRevenue = monthRenewals.filter((r) => r.status === "ملغي بسبب").reduce((s, r) => s + (r.plan_price || 0), 0);
    const revenueRetention = totalRevenue > 0 ? (completedRevenue / totalRevenue) * 100 : 0;

    return { total, completed, cancelled, scheduled, activeFollowUp, renewalRate, churnRate, coverageRate, totalRevenue, completedRevenue, lostRevenue, revenueRetention };
  }, [monthRenewals]);

  /* ─── Health Score ─── */
  const healthScore = useMemo(() => {
    const renewalScore = clamp(metrics.renewalRate / 75, 0, 1) * 40;
    const churnScore = metrics.churnRate <= 15 ? 30 : clamp(1 - ((metrics.churnRate - 15) / 50), 0, 1) * 30;
    const coverageScore = clamp(metrics.coverageRate / 100, 0, 1) * 20;
    const revenueScore = clamp(metrics.revenueRetention / 100, 0, 1) * 10;
    return Math.round(renewalScore + churnScore + coverageScore + revenueScore);
  }, [metrics]);

  /* ─── Cancel reasons breakdown ─── */
  const cancelReasons = useMemo(() => {
    const cancelled = monthRenewals.filter((r) => r.status === "ملغي بسبب");
    const reasons: Record<string, number> = {};
    cancelled.forEach((r) => {
      const reason = r.cancel_reason || "أخرى";
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    const sorted = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
    return { sorted, maxCount, totalCancelled: cancelled.length };
  }, [monthRenewals]);

  /* ─── At-risk renewals ─── */
  const atRiskRenewals = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const risky = monthRenewals.filter((r) => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      const days = getDaysRemaining(r.renewal_date);
      if (r.status === "مجدول" && days <= 7) return true;
      if (["مافي تجاوب", "الرقم غلط", "متردد"].includes(r.status)) return true;
      if (!r.assigned_rep) return true;
      return false;
    });
    return risky.sort((a, b) => getDaysRemaining(a.renewal_date) - getDaysRemaining(b.renewal_date));
  }, [monthRenewals]);

  /* ─── Team performance ─── */
  const teamPerformance = useMemo(() => {
    const repMap: Record<string, { total: number; completed: number; cancelled: number; pending: number }> = {};
    monthRenewals.forEach((r) => {
      const rep = r.assigned_rep || "غير معيّن";
      if (!repMap[rep]) repMap[rep] = { total: 0, completed: 0, cancelled: 0, pending: 0 };
      repMap[rep].total++;
      if (r.status === "مكتمل") repMap[rep].completed++;
      else if (r.status === "ملغي بسبب") repMap[rep].cancelled++;
      else repMap[rep].pending++;
    });
    return Object.entries(repMap).sort((a, b) => b[1].total - a[1].total);
  }, [monthRenewals]);

  /* ─── Weekly action plan ─── */
  const actionPlan = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const overdue = monthRenewals.filter((r) => r.status !== "مكتمل" && r.status !== "ملغي بسبب" && getDaysRemaining(r.renewal_date) < 0);
    const noResponse = monthRenewals.filter((r) => r.status === "مافي تجاوب");
    const unassigned = monthRenewals.filter((r) => !r.assigned_rep && r.status !== "مكتمل" && r.status !== "ملغي بسبب");
    const hesitant = monthRenewals.filter((r) => r.status === "متردد");
    const stale = monthRenewals.filter((r) => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      const updated = new Date(r.updated_at);
      const diff = Math.ceil((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 7;
    });

    return [
      { priority: 1, label: "تواصل فوري مع التجديدات المتأخرة", count: overdue.length, color: "#EF4444", icon: <Flame className="w-4 h-4" />, guidance: "اتصل بهؤلاء العملاء اليوم. كل يوم تأخير يزيد احتمال الإلغاء." },
      { priority: 2, label: "متابعة العملاء اللي ما ردوا", count: noResponse.length, color: "#F59E0B", icon: <Phone className="w-4 h-4" />, guidance: "جرّب التواصل بطريقة مختلفة (واتساب، إيميل) أو في وقت مختلف." },
      { priority: 3, label: "معالجة أكثر سبب إلغاء", count: cancelReasons.sorted.length > 0 ? cancelReasons.sorted[0][1] : 0, color: "#8B5CF6", icon: <Target className="w-4 h-4" />, guidance: cancelReasons.sorted.length > 0 ? `السبب الأول: "${cancelReasons.sorted[0][0]}" - راجع الاستراتيجية المقترحة أعلاه.` : "لا يوجد إلغاءات حالياً." },
      { priority: 4, label: "توزيع التجديدات غير المعيّنة", count: unassigned.length, color: "#00D4FF", icon: <UserCheck className="w-4 h-4" />, guidance: "وزّع هذه التجديدات على الفريق حسب الحمل الحالي لكل موظف." },
      { priority: 5, label: "مراجعة التجديدات الراكدة (+7 أيام)", count: stale.length, color: "#7da6ff", icon: <CalendarClock className="w-4 h-4" />, guidance: "هذه التجديدات لم يتم تحديثها منذ أسبوع أو أكثر. تحتاج مراجعة ومتابعة." },
      { priority: 6, label: "إقناع العملاء المترددين", count: hesitant.length, color: "#F59E0B", icon: <Star className="w-4 h-4" />, guidance: "قدّم عروض محدودة المدة أو اطلب من المدير التواصل شخصياً." },
    ];
  }, [monthRenewals, cancelReasons]);

  function toggleStrategy(reason: string) {
    setExpandedStrategies((prev) => {
      const next = new Set(prev);
      if (next.has(reason)) next.delete(reason); else next.add(reason);
      return next;
    });
  }


  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-72 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[14px]" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-[14px]" />
        <Skeleton className="h-96 rounded-[14px]" />
      </div>
    );
  }

  const scoreColor = healthScore >= 70 ? "cc-green" : healthScore >= 40 ? "amber" : "cc-red";
  const scoreLabel = healthScore >= 70 ? "صحة ممتازة" : healthScore >= 40 ? "تحتاج تحسين" : "وضع حرج";

  return (
    <div className="space-y-6 p-1">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-dim flex items-center justify-center ring-1 ring-white/8">
          <Zap className="w-5 h-5 text-amber" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">خطة تحسين التجديدات</h1>
          <p className="text-[11px] text-muted-foreground">تحليل ذكي للأرقام وخطط عملية لرفع معدل التجديد وتقليل الإلغاء</p>
        </div>
      </div>

      {/* ═══ HEALTH SCORE + DIAGNOSIS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Health Score Card */}
        <div className="lg:col-span-4 cc-card rounded-[14px] border border-white/[0.06] p-6 flex flex-col items-center justify-center gap-3">
          <p className="text-xs font-semibold text-muted-foreground">نتيجة الصحة</p>
          <HealthScoreRing score={healthScore} />
          <span className={`text-xs font-bold ${healthScore >= 70 ? "text-cc-green" : healthScore >= 40 ? "text-amber" : "text-cc-red"}`}>
            {scoreLabel}
          </span>
          <div className="w-full mt-2 space-y-1.5">
            {[
              { label: "معدل التجديد", value: metrics.renewalRate, target: 75, weight: "40%" },
              { label: "معدل الإلغاء", value: metrics.churnRate, target: 15, weight: "30%", inverted: true },
              { label: "تغطية المتابعة", value: metrics.coverageRate, target: 100, weight: "20%" },
              { label: "استرداد الإيرادات", value: metrics.revenueRetention, target: 100, weight: "10%" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground w-24 shrink-0">{item.label}</span>
                <div className="flex-1">
                  <SimpleBar
                    value={item.inverted ? Math.max(0, item.target - (item.value - item.target)) : item.value}
                    max={item.target}
                    color={
                      item.inverted
                        ? item.value <= item.target ? "#10B981" : item.value <= item.target * 1.5 ? "#F59E0B" : "#EF4444"
                        : item.value >= item.target ? "#10B981" : item.value >= item.target * 0.7 ? "#F59E0B" : "#EF4444"
                    }
                    height={4}
                  />
                </div>
                <span className="text-foreground font-mono w-10 text-left">{item.value.toFixed(0)}%</span>
                <span className="text-muted-foreground w-8">({item.weight})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Diagnosis Cards */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="معدل التجديد"
            value={formatPercent(metrics.renewalRate)}
            color={metrics.renewalRate >= 75 ? "green" : metrics.renewalRate >= 50 ? "amber" : "red"}
            icon={<CheckCircle2 className="w-5 h-5 text-cc-green" />}
            progress={metrics.renewalRate}
            subtext={`الهدف: 75% | الفجوة: ${Math.max(0, 75 - metrics.renewalRate).toFixed(0)}%`}
          />
          <StatCard
            label="معدل الإلغاء"
            value={formatPercent(metrics.churnRate)}
            color={metrics.churnRate <= 15 ? "green" : metrics.churnRate <= 25 ? "amber" : "red"}
            icon={<TrendingDown className="w-5 h-5 text-cc-red" />}
            progress={Math.min(100, metrics.churnRate * 2)}
            subtext={`الهدف: أقل من 15% | الزيادة: ${Math.max(0, metrics.churnRate - 15).toFixed(0)}%`}
          />
          <StatCard
            label="الإيرادات المفقودة"
            value={formatMoney(metrics.lostRevenue)}
            color="red"
            icon={<DollarSign className="w-5 h-5 text-cc-red" />}
            subtext={`من إجمالي ${formatMoney(metrics.totalRevenue)}`}
          />
          <StatCard
            label="تغطية المتابعة"
            value={formatPercent(metrics.coverageRate)}
            color={metrics.coverageRate >= 80 ? "green" : metrics.coverageRate >= 50 ? "amber" : "red"}
            icon={<Activity className="w-5 h-5 text-cyan" />}
            progress={metrics.coverageRate}
            subtext={`${metrics.scheduled} تجديد لم يُتابع بعد من ${metrics.total}`}
          />
        </div>
      </div>

      {/* ═══ TOP CHURN REASONS ═══ */}
      {cancelReasons.totalCancelled > 0 && (
        <div className="cc-card rounded-[14px] border border-cc-red/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-red-dim flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-cc-red" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">أسباب الإلغاء الرئيسية</h2>
              <p className="text-[10px] text-muted-foreground">{cancelReasons.totalCancelled} إلغاء في هذه الفترة</p>
            </div>
          </div>
          <div className="space-y-3">
            {cancelReasons.sorted.map(([reason, count]) => {
              const pct = cancelReasons.totalCancelled > 0 ? (count / cancelReasons.totalCancelled) * 100 : 0;
              const strategy = STRATEGY_MAP[reason] || STRATEGY_MAP["أخرى"];
              return (
                <div key={reason} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-semibold">{reason}</span>
                      <span className="text-muted-foreground">({count})</span>
                    </div>
                    <span className="text-muted-foreground font-mono">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                    <div
                      className="h-full rounded-full bg-cc-red transition-all duration-500"
                      style={{ width: `${pct}%`, opacity: 0.6 + (pct / 100) * 0.4 }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {strategy && `الاستراتيجية: ${strategy.steps[0]}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ STRATEGY PLAYBOOKS ═══ */}
      {cancelReasons.totalCancelled > 0 && (
        <div className="cc-card rounded-[14px] border border-amber/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-amber/10 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-amber" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">استراتيجيات الاستعادة</h2>
              <p className="text-[10px] text-muted-foreground">خطط عملية لكل سبب إلغاء مع سكربتات جاهزة للتواصل</p>
            </div>
          </div>
          <div className="space-y-2">
            {cancelReasons.sorted.map(([reason]) => {
              const strategy = STRATEGY_MAP[reason] || STRATEGY_MAP["أخرى"];
              if (!strategy) return null;
              const isExpanded = expandedStrategies.has(reason);
              const impact = IMPACT_STYLES[strategy.impact] || IMPACT_STYLES.low;
              return (
                <div key={reason} className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <button
                    onClick={() => toggleStrategy(reason)}
                    className="w-full flex items-center gap-3 p-3.5 text-right hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center shrink-0 text-amber">
                      {strategy.icon}
                    </div>
                    <div className="flex-1 text-right">
                      <span className="text-xs font-bold text-foreground">{reason}</span>
                      <span className={`mr-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${impact.bg} ${impact.color}`}>
                        {impact.label}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
                      {/* Steps */}
                      <div>
                        <p className="text-[11px] font-bold text-foreground mb-2">الخطوات المقترحة:</p>
                        <div className="space-y-1.5">
                          {strategy.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="w-5 h-5 rounded-full bg-amber/10 text-amber flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                                {i + 1}
                              </div>
                              <span className="text-xs text-foreground/80">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Script */}
                      <div>
                        <p className="text-[11px] font-bold text-foreground mb-1.5">سكربت التواصل:</p>
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-foreground/70 leading-relaxed">
                          {strategy.script}
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

      {/* ═══ WEEKLY ACTION PLAN ═══ */}
      <div className="cc-card rounded-[14px] border border-cyan/10 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-cyan/10 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-cyan" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">خطة العمل الأسبوعية</h2>
            <p className="text-[10px] text-muted-foreground">مرتبة حسب الأولوية - ابدأ من الأعلى</p>
          </div>
        </div>
        <div className="space-y-2">
          {actionPlan.filter((a) => a.count > 0).map((action) => (
            <div
              key={action.priority}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${action.color}15`, color: action.color }}
              >
                {action.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{action.label}</span>
                  <span
                    className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full"
                    style={{ background: `${action.color}15`, color: action.color }}
                  >
                    {action.count}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{action.guidance}</p>
              </div>
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-white/[0.04] text-[10px] font-bold text-muted-foreground">
                {action.priority}
              </div>
            </div>
          ))}
          {actionPlan.filter((a) => a.count > 0).length === 0 && (
            <div className="text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-cc-green mx-auto mb-2" />
              <p className="text-sm text-cc-green font-medium">ممتاز! لا توجد مهام عاجلة حالياً</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ TEAM PERFORMANCE ═══ */}
      {teamPerformance.length > 0 && (
        <div className="cc-card rounded-[14px] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-cc-blue/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-cc-blue" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">أداء الفريق</h2>
              <p className="text-[10px] text-muted-foreground">توزيع التجديدات ومعدل النجاح لكل موظف</p>
            </div>
          </div>
          <div className="space-y-3">
            {teamPerformance.map(([rep, data]) => {
              const rate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
              const rateColor = rate >= 70 ? "#10B981" : rate >= 40 ? "#F59E0B" : "#EF4444";
              return (
                <div key={rep} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-cc-blue/10 text-cc-blue flex items-center justify-center text-[10px] font-bold">
                        {rep.charAt(0)}
                      </div>
                      <span className="font-medium text-foreground">{rep}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-cc-green">{data.completed} مكتمل</span>
                      <span className="text-cc-red">{data.cancelled} ملغي</span>
                      <span className="text-amber">{data.pending} معلق</span>
                      <span className="font-bold font-mono" style={{ color: rateColor }}>{rate}%</span>
                    </div>
                  </div>
                  <SimpleBar value={data.completed} max={data.total} color={rateColor} height={4} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ AT-RISK RENEWALS ═══ */}
      {atRiskRenewals.length > 0 && (
        <div className="cc-card rounded-[14px] border border-cc-red/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-red-dim flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-cc-red" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">تجديدات في خطر</h2>
              <p className="text-[10px] text-muted-foreground">{atRiskRenewals.length} تجديد يحتاج تدخل فوري</p>
            </div>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {atRiskRenewals.slice(0, 20).map((r) => {
              const days = getDaysRemaining(r.renewal_date);
              const badge = STATUS_BADGE[r.status] || { color: "text-muted-foreground", bg: "bg-white/5" };
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${days < 0 ? "bg-red-dim text-cc-red" : days <= 3 ? "bg-amber/10 text-amber" : "bg-white/5 text-muted-foreground"}`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{r.customer_name}</span>
                      {r.client_code && <span className="text-[10px] text-muted-foreground font-mono">{r.client_code}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>{r.status}</span>
                      <span className="text-[10px] text-muted-foreground">{r.plan_name} - {formatMoneyFull(r.plan_price)}</span>
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <span className={`text-xs font-bold font-mono ${days < 0 ? "text-cc-red" : days <= 3 ? "text-amber" : "text-muted-foreground"}`}>
                      {days < 0 ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? "اليوم!" : `${days} يوم`}
                    </span>
                    {r.assigned_rep ? (
                      <p className="text-[10px] text-muted-foreground">{r.assigned_rep}</p>
                    ) : (
                      <p className="text-[10px] text-cc-red">غير معيّن!</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ QUICK TIPS ═══ */}
      <div className="cc-card rounded-[14px] border border-emerald-500/10 bg-gradient-to-l from-emerald-500/[0.03] to-transparent p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Star className="w-4 h-4 text-emerald-400" />
          </div>
          <h2 className="text-sm font-bold text-foreground">نصائح ذهبية لرفع معدل التجديد</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { title: "تواصل مبكر", desc: "ابدأ التواصل قبل 30 يوم من التجديد. كلما بدأت أبكر زادت فرص النجاح.", icon: "1" },
            { title: "اسأل قبل ما تبيع", desc: "اسأل العميل عن تجربته أولاً. الاستماع يبني الثقة ويكشف المشاكل مبكراً.", icon: "2" },
            { title: "أظهر القيمة", desc: "شارك العميل أرقام نجاحه: عدد الطلبات، المبيعات، التوفير. الأرقام تتكلم.", icon: "3" },
            { title: "عروض محدودة", desc: "قدّم عرض خاص بمدة محدودة. الإلحاح يسرّع القرار.", icon: "4" },
            { title: "تابع بذكاء", desc: "لا تكرر نفس الرسالة. غيّر القناة (مكالمة، واتساب، إيميل) والتوقيت.", icon: "5" },
            { title: "احتفل بالنجاح", desc: "شارك قصص نجاح التجديد مع الفريق. التحفيز يرفع الأداء.", icon: "6" },
          ].map((tip) => (
            <div key={tip.icon} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                  {tip.icon}
                </div>
                <span className="text-xs font-bold text-foreground">{tip.title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

