"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Renewal, Employee } from "@/types";
import {
  fetchRenewals,
  createRenewal,
  updateRenewal,
  deleteRenewal,
  createFollowUpNote,
  fetchRecentFollowUpNotes,
  fetchQuoteCommitments,
  addQuoteCommitment,
  removeQuoteCommitment,
  fetchEmployees,
} from "@/lib/supabase/db";
import { AssignTaskModal } from "@/components/tasks/AssignTaskModal";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import {
  RENEWAL_STATUSES,
  RENEWAL_STATUS_COLORS,
  RENEWAL_CANCEL_REASONS,
  PLANS,
  MONTHS_AR,
  getKpiStatus,
  KPI_STATUS_STYLES,
} from "@/lib/utils/constants";
import { formatMoneyFull, formatDate, formatPhone, formatPercent } from "@/lib/utils/format";
import { FollowUpLogButton } from "@/components/follow-up-log";
import { StatCard } from "@/components/ui/stat-card";
import { DonutChart } from "@/components/ui/donut-chart";
import { LineChart } from "@/components/ui/line-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Target,
  SquareCheck,
  Download,
  Share2,
  UserPlus,
  Award,
  Calendar,
  TrendingUp,
  Zap,
  ThumbsUp,
  Bell,
  AlertTriangle,
  User,
  Archive,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ─── Permanently closed cancel reasons — excluded from main list ─── */
const CLOSED_FOREVER_REASONS = new Set(["اغلاق المحل", "مو حاب يجدد بدون سبب", "الادارة رفضت"]);

function isClosedForever(r: Renewal): boolean {
  return r.status === "ملغي بسبب" && CLOSED_FOREVER_REASONS.has(r.cancel_reason || "");
}

/* ─── Status badge color mapping ─── */
const STATUS_BADGE: Record<string, { text: string; color: string; bg: string }> = {
  "مجدول": { text: "مجدول", color: "text-cc-blue", bg: "bg-blue-dim" },
  "جاري المتابعة": { text: "جاري المتابعة", color: "text-amber", bg: "bg-amber-dim" },
  "انتظار الدفع": { text: "انتظار الدفع", color: "text-cc-purple", bg: "bg-purple-dim" },
  "مكتمل": { text: "مكتمل", color: "text-cc-green", bg: "bg-green-dim" },
  "ملغي بسبب": { text: "ملغي بسبب", color: "text-cc-red", bg: "bg-red-dim" },
  "إيقاف مؤقت": { text: "إيقاف مؤقت", color: "text-amber", bg: "bg-amber-dim" },
  "الرقم غلط": { text: "الرقم غلط", color: "text-cc-red", bg: "bg-red-dim" },
  "مافي تجاوب": { text: "مافي تجاوب", color: "text-cc-red", bg: "bg-red-dim" },
  "مؤجل مؤقتاً": { text: "مؤجل مؤقتاً", color: "text-cc-blue", bg: "bg-blue-dim" },
  "تواصل وقت آخر": { text: "تواصل وقت آخر", color: "text-cc-purple", bg: "bg-purple-dim" },
  "متردد": { text: "متردد", color: "text-amber", bg: "bg-amber-dim" },
};

/* ─── Empty form shape ─── */
const EMPTY_FORM = {
  customer_name: "",
  customer_phone: "",
  plan_name: "",
  plan_price: 0,
  renewal_date: "",
  status: "مجدول",
  cancel_reason: "",
  assigned_rep: "",
  notes: "",
};

/* ─── Helpers ─── */
function getDaysRemaining(renewalDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  return Math.ceil((renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDaysRemainingStyle(days: number) {
  if (days < 0) return { color: "text-cc-red", label: `متأخر ${Math.abs(days)} يوم` };
  if (days === 0) return { color: "text-cc-red", label: "اليوم!" };
  if (days <= 7) return { color: "text-cc-red", label: `${days} يوم` };
  if (days <= 30) return { color: "text-amber", label: `${days} يوم` };
  return { color: "text-cc-green", label: `${days} يوم` };
}

export default function RenewalsPage() {
  const { activeOrgId: orgId, user: authUser } = useAuth();
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0, timeUp: false });

  useEffect(() => {
    function tick() {
      const now = new Date();
      const end = new Date(now);
      end.setHours(17, 0, 0, 0);
      const diff = Math.max(0, end.getTime() - now.getTime());
      setCountdown({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        timeUp: diff === 0,
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* delete confirmation */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* assign task modal */
  const [assignRenewal, setAssignRenewal] = useState<Renewal | null>(null);

  /* Achievement summary period */
  type SummaryPeriod = "today" | "week" | "month" | "quarter" | "custom";
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("month");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  type SummaryFilterType = "completed" | "revenue" | "contacted" | "success" | "lost" | null;
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilterType>(null);

  /* daily target selection — persisted per day in localStorage */
  const todayKey = `daily_target_${new Date().toISOString().slice(0, 10)}`;
  const [dailyTargetIds, setDailyTargetIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(todayKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  function toggleDailyTarget(id: string) {
    setDailyTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(todayKey, JSON.stringify([...next]));
      return next;
    });
  }

  function selectAllVisible() {
    setDailyTargetIds((prev) => {
      const next = new Set(prev);
      filteredRenewals.forEach((r) => next.add(r.id));
      localStorage.setItem(todayKey, JSON.stringify([...next]));
      return next;
    });
  }

  function deselectAll() {
    setDailyTargetIds(new Set());
    localStorage.setItem(todayKey, JSON.stringify([]));
  }

  async function buildDailyReport() {
    const targetRenewals = renewals.filter((r) => dailyTargetIds.has(r.id));
    const completed = targetRenewals.filter((r) => r.status === "مكتمل");
    const remaining = targetRenewals.filter((r) => r.status !== "مكتمل");
    const total = targetRenewals.length;
    const rate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    const todayStr = new Date().toLocaleDateString("ar-SA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Fetch latest follow-up notes for all target renewals
    const latestNotes: Record<string, string> = {};
    try {
      const allNotes = await fetchRecentFollowUpNotes(100);
      const renewalNotes = allNotes.filter((n) => n.entity_type === "renewal");
      // Get only the latest note per entity (already sorted by created_at desc)
      renewalNotes.forEach((n) => {
        if (!latestNotes[n.entity_id]) {
          latestNotes[n.entity_id] = n.note;
        }
      });
    } catch { /* ignore */ }

    // Countdown info
    const { h, m, s, timeUp } = countdown;
    const allDone = remaining.length === 0 && total > 0;
    const timeStr = allDone ? "تم الإنجاز! 🏆" : timeUp ? "انتهى وقت العمل ⏰" : `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    const statusIcon = allDone ? "🏆" : rate >= 80 ? "💪" : rate >= 50 ? "🔥" : rate > 0 ? "⚡" : "🚀";
    const statusMsg = allDone ? "ممتاز! أنجزت كل الأهداف" : rate >= 80 ? "أنت قريب جداً!" : rate >= 50 ? "استمر، باقي القليل!" : rate > 0 ? "بداية جيدة، واصل!" : "ابدأ الآن!";

    let report = `📋 تقرير الهدف اليومي — التجديدات\n`;
    report += `📅 ${todayStr}\n`;
    report += `${"─".repeat(35)}\n\n`;
    report += `${statusIcon} الحالة: ${statusMsg}\n`;
    report += `⏱ الوقت المتبقي: ${timeStr}\n\n`;
    report += `🎯 الهدف: ${total} عميل\n`;
    report += `✅ مكتمل: ${completed.length}\n`;
    report += `⏳ متبقي: ${remaining.length}\n`;
    report += `📊 نسبة الإنجاز: ${rate}%\n\n`;

    if (completed.length > 0) {
      report += `── ✅ المكتملة ──\n`;
      completed.forEach((r, i) => {
        report += `${i + 1}. ${r.customer_name}${r.customer_phone ? ` — ${r.customer_phone}` : ""} — ${r.plan_name} — ${r.plan_price} ر.س\n`;
        if (latestNotes[r.id]) {
          report += `   💬 ${latestNotes[r.id]}\n`;
        }
      });
      report += `\n`;
    }

    if (remaining.length > 0) {
      report += `── ⏳ المتبقية ──\n`;
      remaining.forEach((r, i) => {
        report += `${i + 1}. ${r.customer_name}${r.customer_phone ? ` — ${r.customer_phone}` : ""} — ${r.plan_name} — ${r.status} — ${r.plan_price} ر.س\n`;
        if (latestNotes[r.id]) {
          report += `   💬 ${latestNotes[r.id]}\n`;
        }
      });
    }

    return report;
  }

  async function exportReport() {
    const report = await buildDailyReport();
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير-الهدف-اليومي-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareReport() {
    const report = await buildDailyReport();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `تقرير الهدف اليومي — ${new Date().toLocaleDateString("ar-SA")}`,
          text: report,
        });
      } catch {
        // User cancelled or share failed — fallback to copy
        await navigator.clipboard.writeText(report);
        alert("تم نسخ التقرير!");
      }
    } else {
      await navigator.clipboard.writeText(report);
      alert("تم نسخ التقرير! يمكنك لصقه في واتساب أو أي تطبيق.");
    }
  }

  /* month filter — by month only (ignoring year) based on renewal_date */
  const { activeMonthIndex, filterCutoff } = useTopbarControls();
  const allMonthRenewals = filterCutoff
    ? renewals.filter((r) => new Date(r.renewal_date) >= filterCutoff)
    : activeMonthIndex
      ? renewals.filter((r) => {
          const rd = new Date(r.renewal_date);
          return rd.getMonth() + 1 === activeMonthIndex.month;
        })
      : renewals;

  // Separate closed-forever from active renewals
  const closedForeverRenewals = allMonthRenewals.filter(isClosedForever);
  const monthRenewals = allMonthRenewals.filter((r) => !isClosedForever(r));

  /* card filter */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [repFilter, setRepFilter] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const PENDING_STATUSES = new Set(["مجدول", "جاري المتابعة", "انتظار الدفع"]);
  const repFilteredRenewals = repFilter
    ? monthRenewals.filter((r) => r.assigned_rep === repFilter)
    : monthRenewals;
  const statusFilteredRenewals = statusFilter
    ? statusFilter === "pending"
      ? repFilteredRenewals.filter((r) => PENDING_STATUSES.has(r.status))
      : repFilteredRenewals.filter((r) => r.status === statusFilter)
    : repFilteredRenewals;
  const filteredRenewals_base = clientSearch
    ? statusFilteredRenewals.filter((r) => r.customer_name.toLowerCase().includes(clientSearch.toLowerCase()) || (r.client_code && r.client_code.toLowerCase().includes(clientSearch.toLowerCase())))
    : statusFilteredRenewals;

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRenewals(), fetchEmployees()])
      .then(([renewalsData, employeesData]) => {
        setRenewals(renewalsData);
        setEmployees(employeesData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* ─── Quote Commitment ─── */
  const todayStr = new Date().toISOString().slice(0, 10);
  const [commitments, setCommitments] = useState<{ user_name: string; created_at: string }[]>([]);
  const myName = authUser?.name || authUser?.email || "";
  const hasCommitted = commitments.some((c) => c.user_name === myName);

  useEffect(() => {
    if (orgId) {
      fetchQuoteCommitments(orgId, todayStr, "renewals").then(setCommitments).catch(console.error);
    }
  }, [orgId, todayStr]);

  const toggleCommitment = useCallback(async () => {
    if (!orgId || !myName) return;
    try {
      if (hasCommitted) {
        await removeQuoteCommitment(orgId, myName, todayStr, "renewals");
        setCommitments((prev) => prev.filter((c) => c.user_name !== myName));
      } else {
        await addQuoteCommitment(orgId, myName, todayStr, "renewals");
        setCommitments((prev) => [...prev, { user_name: myName, created_at: new Date().toISOString() }]);
      }
    } catch (e) { console.error(e); }
  }, [orgId, myName, todayStr, hasCommitted]);

  /* ─── Computed analytics ─── */
  const analyticsBase = repFilter ? monthRenewals.filter(r => r.assigned_rep === repFilter) : monthRenewals;
  const analytics = useMemo(() => {
    const total = analyticsBase.length;
    const renewed = analyticsBase.filter((r) => r.status === "مكتمل").length;
    const cancelled = analyticsBase.filter((r) => r.status === "ملغي بسبب").length;
    const scheduled = analyticsBase.filter((r) => r.status === "مجدول").length;
    const following = analyticsBase.filter((r) => r.status === "جاري المتابعة").length;
    const waiting = analyticsBase.filter((r) => r.status === "انتظار الدفع").length;
    const renewalRate = total > 0 ? Math.round((renewed / total) * 100) : 0;
    const churnRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const revenueLoss = analyticsBase
      .filter((r) => r.status === "ملغي بسبب")
      .reduce((sum, r) => sum + r.plan_price, 0);
    const totalRevenue = analyticsBase
      .filter((r) => r.status === "مكتمل")
      .reduce((sum, r) => sum + r.plan_price, 0);

    // Cancellation reasons breakdown
    const cancelReasons = analyticsBase
      .filter((r) => r.status === "ملغي بسبب" && r.cancel_reason)
      .reduce<Record<string, number>>((acc, r) => {
        acc[r.cancel_reason!] = (acc[r.cancel_reason!] || 0) + 1;
        return acc;
      }, {});

    const cancelReasonsArr = Object.entries(cancelReasons)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: cancelled > 0 ? Math.round((count / cancelled) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Monthly trend (last 6 months)
    const now = new Date();
    const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const month = d.getMonth();
      const year = d.getFullYear();
      const mRenewals = renewals.filter((r) => {
        const rd = new Date(r.renewal_date);
        return rd.getMonth() === month && rd.getFullYear() === year;
      });
      const mTotal = mRenewals.length;
      const mRenewed = mRenewals.filter((r) => r.status === "مكتمل").length;
      const mCancelled = mRenewals.filter((r) => r.status === "ملغي بسبب").length;
      return {
        label: MONTHS_AR[month].slice(0, 3),
        value: mTotal > 0 ? Math.round((mRenewed / mTotal) * 100) : 0,
        target: mTotal > 0 ? Math.round((mCancelled / mTotal) * 100) : 0,
      };
    });

    return {
      total,
      renewed,
      cancelled,
      scheduled,
      following,
      waiting,
      renewalRate,
      churnRate,
      revenueLoss,
      totalRevenue,
      cancelReasonsArr,
      monthlyTrend,
    };
  }, [renewals, analyticsBase]);

  /* ─── Achievement Summary (filtered by period) ─── */
  const achievementSummary = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (summaryPeriod === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (summaryPeriod === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
      // End of week (Saturday)
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else if (summaryPeriod === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    } else if (summaryPeriod === "quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), qMonth, 1);
      endDate = new Date(now.getFullYear(), qMonth + 3, 0);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // custom
      startDate = customRange.from ? new Date(customRange.from) : new Date(now.getFullYear(), now.getMonth(), 1);
      if (customRange.to) endDate = new Date(customRange.to + "T23:59:59");
    }

    // Filter renewals by renewal_date (due date) within the period
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const fmtDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const startStr = fmtDate(startDate);
    const endStr = fmtDate(endDate);
    const periodRenewals = renewals.filter(r =>
      r.renewal_date >= startStr && r.renewal_date <= endStr
    );

    const completed = periodRenewals.filter(r => r.status === "مكتمل");
    const cancelled = periodRenewals.filter(r => r.status === "ملغي بسبب");
    const contacted = periodRenewals.filter(r => r.status === "جاري المتابعة" || r.status === "انتظار الدفع");
    const completedRevenue = completed.reduce((s, r) => s + r.plan_price, 0);
    const lostRevenue = cancelled.reduce((s, r) => s + r.plan_price, 0);
    const avgDealValue = completed.length > 0 ? Math.round(completedRevenue / completed.length) : 0;
    const successRate = periodRenewals.length > 0 ? Math.round((completed.length / periodRenewals.length) * 100) : 0;

    // Top performer (assigned_rep with most completions)
    const repMap: Record<string, number> = {};
    completed.forEach(r => { if (r.assigned_rep) repMap[r.assigned_rep] = (repMap[r.assigned_rep] || 0) + 1; });
    const topRep = Object.entries(repMap).sort((a, b) => b[1] - a[1])[0];

    // Plan/package breakdown for completed renewals
    const planMap: Record<string, { count: number; revenue: number }> = {};
    completed.forEach(r => {
      const plan = r.plan_name || "بدون باقة";
      if (!planMap[plan]) planMap[plan] = { count: 0, revenue: 0 };
      planMap[plan].count += 1;
      planMap[plan].revenue += r.plan_price;
    });
    const planBreakdown = Object.entries(planMap)
      .map(([plan, data]) => ({ plan, ...data }))
      .sort((a, b) => b.count - a.count);

    // Generate recommendations
    const recommendations: string[] = [];
    if (completed.length > 0) {
      const completedPlanNames = new Set(Object.keys(planMap));
      const missingPlans = [...PLANS].filter(p => !completedPlanNames.has(p));
      if (missingPlans.length > 0) {
        recommendations.push(`💡 لم يتحقق أي تجديد في: ${missingPlans.join("، ")} — ركّز على التواصل مع عملاء هذه الباقات`);
      }
      const maxCount = Math.max(...planBreakdown.map(p => p.count));
      const weakPlans = planBreakdown.filter(p => p.count > 0 && p.count <= maxCount * 0.3);
      if (weakPlans.length > 0 && missingPlans.length === 0) {
        recommendations.push(`📊 باقات تحتاج تركيز أكثر: ${weakPlans.map(p => p.plan).join("، ")}`);
      }
    } else if (periodRenewals.length > 0) {
      recommendations.push(`⚠️ لا يوجد تجديد مكتمل في هذه الفترة — حاول إغلاق تجديد واحد على الأقل`);
    }

    return {
      periodRenewals: periodRenewals.length,
      completed: completed.length,
      cancelled: cancelled.length,
      contacted: contacted.length,
      completedRevenue,
      lostRevenue,
      avgDealValue,
      successRate,
      topRep: topRep ? { name: topRep[0], count: topRep[1] } : null,
      planBreakdown,
      recommendations,
      // Store IDs for filtering
      completedIds: new Set(completed.map(r => r.id)),
      cancelledIds: new Set(cancelled.map(r => r.id)),
      contactedIds: new Set(contacted.map(r => r.id)),
      allPeriodIds: new Set(periodRenewals.map(r => r.id)),
    };
  }, [renewals, summaryPeriod, customRange]);

  // Apply summary filter if active (overrides base filter to show matching renewals)
  const filteredRenewals = summaryFilter
    ? (() => {
        const ids = summaryFilter === "completed" || summaryFilter === "revenue" || summaryFilter === "success"
          ? achievementSummary.completedIds
          : summaryFilter === "lost" ? achievementSummary.cancelledIds
          : summaryFilter === "contacted" ? achievementSummary.contactedIds
          : achievementSummary.allPeriodIds;
        const result = renewals.filter(r => ids.has(r.id));
        return clientSearch ? result.filter(r => r.customer_name.toLowerCase().includes(clientSearch.toLowerCase()) || (r.client_code && r.client_code.toLowerCase().includes(clientSearch.toLowerCase()))) : result;
      })()
    : filteredRenewals_base;

  /* ─── Donut data ─── */
  const donutSegments = [
    { label: "مكتمل", value: analytics.renewed, color: "#10B981" },
    { label: "ملغي بسبب", value: analytics.cancelled, color: "#EF4444" },
    { label: "مجدول", value: analytics.scheduled, color: "#3B82F6" },
    { label: "جاري المتابعة", value: analytics.following, color: "#F59E0B" },
    { label: "انتظار الدفع", value: analytics.waiting, color: "#A855F7" },
  ];

  /* ─── KPI Statuses ─── */
  const renewalStatus = getKpiStatus(analytics.renewalRate, 75);
  const churnStatus = getKpiStatus(15, analytics.churnRate); // inverted

  /* ─── Handlers ─── */
  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(renewal: Renewal) {
    setEditingId(renewal.id);
    setForm({
      customer_name: renewal.customer_name,
      customer_phone: renewal.customer_phone || "",
      plan_name: renewal.plan_name,
      plan_price: renewal.plan_price,
      renewal_date: renewal.renewal_date,
      status: renewal.status,
      cancel_reason: renewal.cancel_reason || "",
      assigned_rep: renewal.assigned_rep || "",
      notes: renewal.notes || "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.customer_name.trim() || !form.plan_name.trim() || !form.renewal_date) return;
    setSaving(true);
    try {
      const payload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || undefined,
        plan_name: form.plan_name,
        plan_price: form.plan_price,
        renewal_date: form.renewal_date,
        status: form.status,
        cancel_reason: form.status === "ملغي بسبب" ? form.cancel_reason || undefined : undefined,
        assigned_rep: form.assigned_rep || undefined,
        notes: form.notes || undefined,
      };

      if (editingId) {
        const oldRenewal = renewals.find((r) => r.id === editingId);
        const updated = await updateRenewal(editingId, payload);
        setRenewals((prev) => prev.map((r) => (r.id === editingId ? updated : r)));

        /* Auto-track changes */
        if (oldRenewal) {
          const author = authUser?.name || "النظام";
          const changes: string[] = [];
          if (oldRenewal.status !== form.status) changes.push(`الحالة: ${oldRenewal.status} ← ${form.status}`);
          if (oldRenewal.plan_name !== form.plan_name) changes.push(`الباقة: ${oldRenewal.plan_name} ← ${form.plan_name}`);
          if (oldRenewal.plan_price !== form.plan_price) changes.push(`السعر: ${oldRenewal.plan_price} ← ${form.plan_price} ر.س`);
          if ((oldRenewal.assigned_rep || "") !== (form.assigned_rep || "")) changes.push(`المسؤول: ${oldRenewal.assigned_rep || "—"} ← ${form.assigned_rep || "—"}`);
          if (oldRenewal.renewal_date !== form.renewal_date) changes.push(`تاريخ التجديد: ${oldRenewal.renewal_date} ← ${form.renewal_date}`);
          if (changes.length > 0) {
            createFollowUpNote("renewal", editingId, `📝 تحديث تلقائي:\n${changes.join("\n")}`, author).catch(console.error);
          }
        }
      } else {
        const created = await createRenewal(payload as Omit<Renewal, "id" | "org_id" | "created_at" | "updated_at">);
        setRenewals((prev) => [...prev, created].sort(
          (a, b) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime()
        ));
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: string) {
    setDeleteId(id);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (deleteId) {
      try {
        await deleteRenewal(deleteId);
        setRenewals((prev) => prev.filter((r) => r.id !== deleteId));
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-dim flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">التجديدات</h1>
            <p className="text-xs text-muted-foreground">
              تتبع تجديد اشتراكات العملاء وأيام التجديد المتبقية
            </p>
            {(() => {
              const quotes = [
                { text: "الحفاظ على عميل حالي أسهل 5 مرات من كسب عميل جديد", author: "فيليب كوتلر" },
                { text: "العملاء المخلصون لا يعودون فقط، بل يحيلون غيرهم إليك", author: "تشيب بيل" },
                { text: "خدمة ما بعد البيع هي بداية البيع القادم", author: "جو جيرارد" },
                { text: "اجعل تجربة العميل أولوية وسيكافئك بالولاء", author: "جيف بيزوس" },
                { text: "العميل لا يهتم بما تعرفه حتى يعرف كم تهتم به", author: "زيغ زيغلار" },
                { text: "أفضل طريقة للاحتفاظ بالعملاء هي التفكير بما يريدون مسبقاً", author: "ستيف جوبز" },
                { text: "التجديد ليس نهاية العلاقة، بل إعادة التأكيد عليها", author: "لينكولن مورفي" },
                { text: "العميل الراضي يخبر 3 أشخاص، والغاضب يخبر 3000", author: "بيت بلاكشو" },
                { text: "لا تبع منتجاً، بل ابنِ علاقة تدوم", author: "هارفي ماكاي" },
                { text: "الولاء لا يُشترى بالخصومات، بل يُبنى بالثقة", author: "سيث غودين" },
                { text: "الاستماع للعميل أهم من إقناعه", author: "بريان تريسي" },
                { text: "العميل الذي يجدد هو العميل الذي يثق بك", author: "توم بيترز" },
                { text: "الشركات العظيمة تبنيها العلاقات، لا المبيعات", author: "ريتشارد برانسون" },
                { text: "كل تجديد ناجح هو قصة نجاح مشتركة", author: "نيك ميتا" },
                { text: "ركز على القيمة التي تقدمها والتجديد سيأتي تلقائياً", author: "جايسون ليمكين" },
                { text: "المتابعة المستمرة تحوّل العميل العادي إلى سفير لعلامتك", author: "شيب هايكن" },
                { text: "الاحتفاظ بالعملاء ليس تكلفة، بل استثمار", author: "فريد رايشهلد" },
                { text: "كل مكالمة متابعة هي فرصة لتقوية العلاقة", author: "جو جيرارد" },
                { text: "التميز ليس في البيع الأول، بل في استمرار العلاقة", author: "ماري كاي آش" },
                { text: "الخدمة الممتازة هي أقوى استراتيجية تسويقية", author: "آل ريس" },
                { text: "اهتم بعميلك وسيهتم هو بأرباحك", author: "جون ماكسويل" },
                { text: "العلاقات المبنية على الثقة تصمد أمام أي منافس", author: "ستيفن كوفي" },
                { text: "لا يوجد عميل صغير، كل عميل يستحق أفضل خدمة", author: "سام والتون" },
                { text: "النجاح الحقيقي هو أن يعود العميل مراراً وتكراراً", author: "جان كارلزون" },
                { text: "الإنصات للعميل يكشف لك ما لا تكشفه أي أبحاث", author: "دايل كارنيجي" },
                { text: "اجعل كل تفاعل مع العميل لا يُنسى", author: "والت ديزني" },
                { text: "العميل الذي يشعر بالتقدير لن يفكر في المغادرة", author: "تيري ليهي" },
                { text: "في عالم التجديدات، المتابعة هي الملك", author: "ديفيد سكوك" },
                { text: "أسهل طريقة لزيادة الإيرادات هي عدم فقدان العملاء الحاليين", author: "باتريك كامبل" },
                { text: "كل يوم هو فرصة لتحويل عميل عادي إلى عميل دائم", author: "كين بلانشارد" },
              ];
              const dayIndex = Math.floor(Date.now() / 86400000) % quotes.length;
              const q = quotes[dayIndex];
              return (
                <>
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-l from-amber/[0.08] via-cc-purple/[0.05] to-transparent border border-amber/15">
                    <span className="text-lg">🔥</span>
                    <div className="flex-1">
                      <p className="text-[11px] font-medium text-amber italic leading-tight">"{q.text}"</p>
                      <p className="text-[10px] text-cc-purple mt-0.5 font-semibold">📖 {q.author}</p>
                    </div>
                    <button
                      onClick={toggleCommitment}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                        hasCommitted
                          ? "bg-green-500/15 text-green-600 border border-green-500/30"
                          : "bg-muted/50 text-muted-foreground border border-border hover:bg-amber/10 hover:text-amber hover:border-amber/30"
                      }`}
                    >
                      <ThumbsUp className={`w-3 h-3 ${hasCommitted ? "fill-green-500" : ""}`} />
                      {hasCommitted ? "ملتزم" : "ألتزم"}
                      {commitments.length > 0 && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber/20 text-amber text-[9px] font-bold">
                          {commitments.length}
                        </span>
                      )}
                    </button>
                  </div>
                  {commitments.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 px-3">
                      {commitments.map((c) => (
                        <span key={c.user_name} className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                          {c.user_name}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
        <Button onClick={openAddModal} className="gap-1.5">
          <Plus className="w-4 h-4" />
          إضافة تجديد
        </Button>
      </div>

      {/* ─── Achievement Summary ─── */}
      {!loading && (
        <div className="cc-card rounded-[14px] p-5 border border-cyan/10 bg-gradient-to-l from-cyan/[0.03] to-transparent">
          {/* Header + period selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-cyan" />
              <h3 className="text-sm font-bold text-foreground">ملخص الإنجازات</h3>
            </div>
            <div className="flex items-center gap-1.5 bg-white/[0.05] rounded-lg p-1 border border-white/[0.06]">
              {([
                { key: "today" as SummaryPeriod, label: "اليوم" },
                { key: "week" as SummaryPeriod, label: "الأسبوع" },
                { key: "month" as SummaryPeriod, label: "الشهر" },
                { key: "quarter" as SummaryPeriod, label: "الربع" },
                { key: "custom" as SummaryPeriod, label: "مخصص" },
              ]).map(p => (
                <button
                  key={p.key}
                  onClick={() => { setSummaryPeriod(p.key); setSummaryFilter(null); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    summaryPeriod === p.key
                      ? "bg-cyan text-white shadow-lg"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.10]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          {summaryPeriod === "custom" && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/[0.05] border border-white/[0.06]">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="date"
                  value={customRange.from}
                  onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-foreground text-xs focus:outline-none focus:border-cyan/50"
                  dir="ltr"
                />
                <span className="text-xs text-muted-foreground">إلى</span>
                <input
                  type="date"
                  value={customRange.to}
                  onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-foreground text-xs focus:outline-none focus:border-cyan/50"
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Achievement cards - clickable to filter table */}
          {summaryFilter && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-cyan/10 border border-cyan/20">
              <span className="text-xs text-cyan font-medium">🔍 عرض: {
                summaryFilter === "completed" ? "التجديدات المكتملة" :
                summaryFilter === "revenue" ? "الإيرادات المحققة" :
                summaryFilter === "contacted" ? "تم التواصل معهم" :
                summaryFilter === "success" ? "نسبة النجاح" :
                "الإيرادات المفقودة"
              } ({filteredRenewals.length} عميل)</span>
              <button
                onClick={() => setSummaryFilter(null)}
                className="mr-auto text-xs text-cyan hover:text-white font-medium px-2 py-1 rounded-md hover:bg-cyan/20 transition-colors"
              >
                ✕ إلغاء الفلتر
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
            <button
              onClick={() => { setSummaryFilter(summaryFilter === "completed" ? null : "completed"); setStatusFilter(null); document.getElementById("renewals-table")?.scrollIntoView({ behavior: "smooth" }); }}
              className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
                summaryFilter === "completed" ? "bg-cc-green/20 border-2 border-cc-green/50 ring-2 ring-cc-green/20" : "bg-cc-green/10 border border-cc-green/20 hover:bg-cc-green/15 hover:scale-[1.02]"
              }`}
            >
              <CheckCircle2 className="w-5 h-5 text-cc-green mx-auto mb-1" />
              <p className="text-2xl font-bold text-cc-green">{achievementSummary.completed}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">تجديد مكتمل</p>
            </button>
            <button
              onClick={() => { setSummaryFilter(summaryFilter === "revenue" ? null : "revenue"); setStatusFilter(null); document.getElementById("renewals-table")?.scrollIntoView({ behavior: "smooth" }); }}
              className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
                summaryFilter === "revenue" ? "bg-cyan/20 border-2 border-cyan/50 ring-2 ring-cyan/20" : "bg-cyan/10 border border-cyan/20 hover:bg-cyan/15 hover:scale-[1.02]"
              }`}
            >
              <TrendingUp className="w-5 h-5 text-cyan mx-auto mb-1" />
              <p className="text-2xl font-bold text-cyan">{formatMoneyFull(achievementSummary.completedRevenue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">إيرادات محققة</p>
            </button>
            <button
              onClick={() => { setSummaryFilter(summaryFilter === "contacted" ? null : "contacted"); setStatusFilter(null); document.getElementById("renewals-table")?.scrollIntoView({ behavior: "smooth" }); }}
              className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
                summaryFilter === "contacted" ? "bg-cc-purple/20 border-2 border-cc-purple/50 ring-2 ring-cc-purple/20" : "bg-cc-purple/10 border border-cc-purple/20 hover:bg-cc-purple/15 hover:scale-[1.02]"
              }`}
            >
              <Users className="w-5 h-5 text-cc-purple mx-auto mb-1" />
              <p className="text-2xl font-bold text-cc-purple">{achievementSummary.contacted}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">تم التواصل</p>
            </button>
            <button
              onClick={() => { setSummaryFilter(summaryFilter === "success" ? null : "success"); setStatusFilter(null); document.getElementById("renewals-table")?.scrollIntoView({ behavior: "smooth" }); }}
              className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
                summaryFilter === "success" ? "bg-amber/20 border-2 border-amber/50 ring-2 ring-amber/20" : "bg-amber/10 border border-amber/20 hover:bg-amber/15 hover:scale-[1.02]"
              }`}
            >
              <Zap className="w-5 h-5 text-amber mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber">{achievementSummary.successRate}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">نسبة النجاح</p>
            </button>
            <button
              onClick={() => { setSummaryFilter(summaryFilter === "lost" ? null : "lost"); setStatusFilter(null); document.getElementById("renewals-table")?.scrollIntoView({ behavior: "smooth" }); }}
              className={`p-3 rounded-[14px] text-center transition-all cursor-pointer col-span-2 md:col-span-1 ${
                summaryFilter === "lost" ? "bg-cc-red/20 border-2 border-cc-red/50 ring-2 ring-cc-red/20" : "bg-cc-red/10 border border-cc-red/20 hover:bg-cc-red/15 hover:scale-[1.02]"
              }`}
            >
              <TrendingDown className="w-5 h-5 text-cc-red mx-auto mb-1" />
              <p className="text-2xl font-bold text-cc-red">{formatMoneyFull(achievementSummary.lostRevenue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">إيرادات مفقودة</p>
            </button>
          </div>

          {/* Progress bar + extra info */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Success rate bar */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">معدل الإنجاز</span>
                <span className={`text-xs font-bold ${
                  achievementSummary.successRate >= 70 ? "text-cc-green" :
                  achievementSummary.successRate >= 40 ? "text-amber" : "text-cc-red"
                }`}>{achievementSummary.successRate}%</span>
              </div>
              <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    achievementSummary.successRate >= 70 ? "bg-gradient-to-l from-emerald-400 to-emerald-600" :
                    achievementSummary.successRate >= 40 ? "bg-gradient-to-l from-amber-400 to-amber-600" :
                    "bg-gradient-to-l from-red-400 to-red-600"
                  }`}
                  style={{ width: `${achievementSummary.successRate}%` }}
                />
              </div>
            </div>

            {achievementSummary.avgDealValue > 0 && (
              <div className="text-center px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
                <p className="text-xs font-bold text-foreground">{formatMoneyFull(achievementSummary.avgDealValue)}</p>
                <p className="text-[10px] text-muted-foreground">متوسط القيمة</p>
              </div>
            )}

            {achievementSummary.topRep && (
              <div className="text-center px-3 py-1.5 rounded-lg bg-amber/10 border border-amber/20">
                <p className="text-xs font-bold text-amber">🏆 {achievementSummary.topRep.name}</p>
                <p className="text-[10px] text-muted-foreground">{achievementSummary.topRep.count} تجديد</p>
              </div>
            )}
          </div>

          {/* Plan/Package breakdown */}
          {achievementSummary.planBreakdown.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-[11px] text-muted-foreground mb-2.5 font-medium">📦 توزيع الباقات المنجزة</p>
              <div className="flex flex-wrap gap-2">
                {achievementSummary.planBreakdown.map(p => (
                  <div key={p.plan} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <span className="text-xs font-bold text-cc-green">{p.count}</span>
                    <span className="text-xs text-foreground">{p.plan}</span>
                    <span className="text-[10px] text-muted-foreground">({formatMoneyFull(p.revenue)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {achievementSummary.recommendations.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {achievementSummary.recommendations.map((rec, i) => (
                <div key={i} className="px-3 py-2 rounded-lg bg-amber/[0.06] border border-amber/15 text-xs text-amber">
                  {rec}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Employee Filter ─── */}
      {!loading && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span className="font-medium">الموظف:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setRepFilter(null)}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all border ${
                !repFilter ? "bg-cyan/15 text-cyan font-medium border-cyan/30" : "text-muted-foreground hover:text-foreground border-border"
              }`}
            >
              الكل
            </button>
            {[...new Set(renewals.map(r => r.assigned_rep).filter(Boolean))].map((name) => (
              <button
                key={name}
                onClick={() => setRepFilter(repFilter === name ? null : name!)}
                className={`px-3 py-1.5 rounded-xl text-xs transition-all border ${
                  repFilter === name ? "bg-cyan/15 text-cyan font-medium border-cyan/30" : "text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Renewal Alerts Banner ─── */}
      {!loading && (() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const activeStatuses = new Set(["مجدول", "جاري المتابعة", "انتظار الدفع", "مؤجل مؤقتاً", "تواصل وقت آخر", "متردد"]);
        const activeRenewals = (repFilter ? renewals.filter(r => r.assigned_rep === repFilter) : renewals)
          .filter(r => activeStatuses.has(r.status));

        const overdue = activeRenewals
          .filter(r => {
            const d = getDaysRemaining(r.renewal_date);
            return d < 0;
          })
          .sort((a, b) => getDaysRemaining(a.renewal_date) - getDaysRemaining(b.renewal_date));

        const urgent = activeRenewals
          .filter(r => {
            const d = getDaysRemaining(r.renewal_date);
            return d >= 0 && d <= 7;
          })
          .sort((a, b) => getDaysRemaining(a.renewal_date) - getDaysRemaining(b.renewal_date));

        const stale = activeRenewals
          .filter(r => {
            const daysSinceUpdate = Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000);
            return daysSinceUpdate >= 5 && getDaysRemaining(r.renewal_date) > 7;
          })
          .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

        const totalAlerts = overdue.length + urgent.length + stale.length;
        if (totalAlerts === 0) return null;

        const alerts = [
          ...overdue.map(r => ({ renewal: r, type: "overdue" as const, days: getDaysRemaining(r.renewal_date) })),
          ...urgent.map(r => ({ renewal: r, type: "urgent" as const, days: getDaysRemaining(r.renewal_date) })),
          ...stale.map(r => ({ renewal: r, type: "stale" as const, days: Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000) })),
        ];

        return (
          <div className="cc-card rounded-[14px] border border-cc-red/20 bg-gradient-to-l from-cc-red/[0.04] via-amber/[0.03] to-transparent overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b border-border/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cc-red/10 flex items-center justify-center relative">
                  <Bell className="w-4 h-4 text-cc-red" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cc-red text-white text-[9px] font-bold flex items-center justify-center">
                    {totalAlerts}
                  </span>
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-bold text-foreground">تنبيهات التجديدات</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {overdue.length > 0 && <span className="text-cc-red font-semibold">{overdue.length} متأخر</span>}
                    {overdue.length > 0 && urgent.length > 0 && " · "}
                    {urgent.length > 0 && <span className="text-amber font-semibold">{urgent.length} خلال أسبوع</span>}
                    {(overdue.length > 0 || urgent.length > 0) && stale.length > 0 && " · "}
                    {stale.length > 0 && <span className="text-cc-blue font-semibold">{stale.length} بدون متابعة</span>}
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-border/20 max-h-[280px] overflow-y-auto">
              {alerts.slice(0, 12).map((alert) => (
                <div key={alert.renewal.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center border ${
                    alert.type === "overdue" ? "bg-cc-red/10 border-cc-red/30" :
                    alert.type === "urgent" ? "bg-amber/10 border-amber/30" :
                    "bg-cc-blue/10 border-cc-blue/30"
                  }`}>
                    {alert.type === "overdue" ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-cc-red" />
                    ) : alert.type === "urgent" ? (
                      <Clock className="w-3.5 h-3.5 text-amber" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-cc-blue" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {alert.type === "overdue"
                        ? `🚨 ${alert.renewal.customer_name} — متأخر ${Math.abs(alert.days)} يوم!`
                        : alert.type === "urgent"
                        ? `⏰ ${alert.renewal.customer_name} — يجدد خلال ${alert.days} ${alert.days === 0 ? "(اليوم!)" : "يوم"}`
                        : `📋 ${alert.renewal.customer_name} — بدون متابعة منذ ${alert.days} يوم`}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${
                        alert.type === "overdue" ? "bg-cc-red/10 border-cc-red/30 text-cc-red" :
                        alert.type === "urgent" ? "bg-amber/10 border-amber/30 text-amber" :
                        "bg-cc-blue/10 border-cc-blue/30 text-cc-blue"
                      }`}>
                        {alert.type === "overdue" ? "متأخر" : alert.type === "urgent" ? "عاجل" : "راكد"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{alert.renewal.plan_name} · {formatMoneyFull(alert.renewal.plan_price)}</span>
                      {alert.renewal.assigned_rep && (
                        <span className="text-[10px] text-muted-foreground">• {alert.renewal.assigned_rep}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openEditModal(alert.renewal)}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-cyan/10 text-cyan border border-cyan/30 hover:bg-cyan/20 transition-colors font-medium shrink-0"
                  >
                    متابعة
                  </button>
                </div>
              ))}
            </div>
            {totalAlerts > 12 && (
              <div className="px-4 py-2 text-center border-t border-border/30">
                <span className="text-[10px] text-muted-foreground">و {totalAlerts - 12} تنبيه آخر...</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── 4 KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              value={analytics.total.toLocaleString()}
              label="إجمالي التجديدات"
              color="cyan"
              icon={<Users className="w-4 h-4 text-cyan" />}
              onClick={() => setStatusFilter(null)}
              active={statusFilter === null}
            />
            <StatCard
              value={analytics.renewed.toLocaleString()}
              label="مكتمل"
              color="green"
              icon={<CheckCircle2 className="w-4 h-4 text-cc-green" />}
              subtext={`${analytics.renewalRate}%`}
              progress={analytics.renewalRate}
              onClick={() => setStatusFilter(statusFilter === "مكتمل" ? null : "مكتمل")}
              active={statusFilter === "مكتمل"}
            />
            <StatCard
              value={analytics.cancelled.toLocaleString()}
              label="ملغي بسبب"
              color="red"
              icon={<XCircle className="w-4 h-4 text-cc-red" />}
              subtext={`${analytics.churnRate}%`}
              onClick={() => setStatusFilter(statusFilter === "ملغي بسبب" ? null : "ملغي بسبب")}
              active={statusFilter === "ملغي بسبب"}
            />
            <StatCard
              value={(analytics.scheduled + analytics.following + analytics.waiting).toLocaleString()}
              label="قيد المتابعة"
              color="amber"
              icon={<Clock className="w-4 h-4 text-amber" />}
              subtext={analytics.total > 0 ? `${Math.round(((analytics.scheduled + analytics.following + analytics.waiting) / analytics.total) * 100)}%` : "0%"}
              onClick={() => setStatusFilter(statusFilter === "pending" ? null : "pending")}
              active={statusFilter === "pending"}
            />
          </>
        )}
      </div>

      {/* ─── Target Tracking ─── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TargetCard
            label="معدل التجديد"
            actual={analytics.renewalRate}
            target={75}
            unit="%"
            status={renewalStatus}
          />
          <TargetCard
            label="معدل الإلغاء (Churn)"
            actual={analytics.churnRate}
            target={15}
            unit="%"
            status={churnStatus}
            inverted
          />
          <div className="cc-card rounded-[14px] p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-5 h-5 text-cc-red" />
              <p className="text-xs text-muted-foreground">خسارة الإيرادات</p>
            </div>
            <p className="text-2xl font-extrabold text-cc-red">
              {formatMoneyFull(analytics.revenueLoss)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              إجمالي الإيرادات المفقودة من العملاء الذين ألغوا
            </p>
          </div>
        </div>
      )}

      {/* ─── Daily Target Summary ─── */}
      {dailyTargetIds.size > 0 && !loading && (() => {
        const targetRenewals = renewals.filter((r) => dailyTargetIds.has(r.id));
        const completed = targetRenewals.filter((r) => r.status === "مكتمل").length;
        const total = targetRenewals.length;
        const remaining = total - completed;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const allDone = remaining === 0 && total > 0;

        const { h: hoursLeft, m: minutesLeft, s: secondsLeft, timeUp } = countdown;

        const motivationMsg = allDone
          ? "ممتاز! أنجزت كل أهداف اليوم 🏆"
          : timeUp ? "انتهى وقت العمل! أكمل ما تبقى"
          : rate >= 80 ? "أنت قريب جداً من الإنجاز! 💪"
          : rate >= 50 ? `باقي ${remaining} فقط، استمر! 🔥`
          : rate > 0 ? "بداية جيدة، واصل التقدم ⚡"
          : `${total} عميل بانتظارك، ابدأ الآن! 🚀`;

        const borderColor = allDone ? "border-cc-green/30" : "border-cyan/20";
        const bgGrad = allDone
          ? "bg-gradient-to-l from-cc-green/[0.06] to-transparent"
          : "bg-gradient-to-l from-cyan/[0.04] to-transparent";

        return (
          <div className={`cc-card rounded-[14px] p-4 border ${borderColor} ${bgGrad} transition-all duration-500`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${allDone ? "bg-cc-green/15" : "bg-cyan/10"}`}>
                  <Target className={`w-4 h-4 ${allDone ? "text-cc-green" : "text-cyan"}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">الهدف اليومي</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`hidden sm:inline text-xs font-medium px-2.5 py-1 rounded-full ${
                  allDone ? "bg-cc-green/15 text-cc-green" : rate >= 50 ? "bg-amber/15 text-amber" : "bg-cyan/10 text-cyan"
                }`}>
                  {motivationMsg}
                </span>
                <button
                  onClick={shareReport}
                  className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-cc-purple/30 text-cc-purple hover:bg-cc-purple/10 transition-colors"
                  title="مشاركة التقرير"
                >
                  <Share2 className="w-3 h-3" />
                  مشاركة
                </button>
                <button
                  onClick={exportReport}
                  className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-cyan/30 text-cyan hover:bg-cyan/10 transition-colors"
                  title="تحميل التقرير"
                >
                  <Download className="w-3 h-3" />
                  تصدير
                </button>
                <button
                  onClick={deselectAll}
                  className="text-[10px] text-muted-foreground hover:text-cc-red transition-colors"
                >
                  مسح
                </button>
              </div>
            </div>

            {/* Progress bar with segments */}
            <div className="relative mb-3">
              <div className="h-3 rounded-full bg-muted/40 overflow-hidden flex">
                {targetRenewals.map((r) => (
                  <div
                    key={r.id}
                    className={`h-full transition-all duration-700 ${
                      r.status === "مكتمل" ? "bg-cc-green" : "bg-muted/60"
                    }`}
                    style={{ width: `${100 / total}%` }}
                    title={`${r.customer_name} — ${r.status}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{completed} / {total}</span>
                <span className={`text-xs font-extrabold ${
                  allDone ? "text-cc-green" : rate >= 50 ? "text-amber" : "text-cyan"
                }`}>
                  {rate}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-lg mb-0.5">{allDone ? "🏆" : timeUp ? "⏰" : hoursLeft < 2 ? "😰" : "🎯"}</p>
                <p className="text-xl font-extrabold text-cyan">{total}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">الهدف</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-lg mb-0.5">{completed > 0 ? "✅" : "⭕"}</p>
                <p className="text-xl font-extrabold text-cc-green">{completed}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">مكتمل</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-lg mb-0.5">{remaining === 0 ? "🎉" : remaining <= 2 ? "💪" : "⏳"}</p>
                <p className={`text-xl font-extrabold ${remaining > 0 ? "text-amber" : "text-cc-green"}`}>{remaining}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">متبقي</p>
              </div>
              <div className={`text-center p-2.5 rounded-lg border ${
                allDone ? "bg-cc-green/10 border-cc-green/30" : timeUp ? "bg-red-500/10 border-red-500/30" : hoursLeft < 2 ? "bg-amber/10 border-amber/30" : "bg-card/50 border-border/30"
              }`}>
                <p className="text-lg mb-0.5">{allDone ? "🎊" : timeUp ? "🔴" : hoursLeft < 2 ? "🟡" : "🟢"}</p>
                <p className={`text-xl font-extrabold ${
                  allDone ? "text-cc-green" : timeUp ? "text-cc-red" : hoursLeft < 2 ? "text-amber" : "text-cyan"
                }`}>
                  {allDone ? "تم!" : timeUp ? "انتهى" : `${hoursLeft}:${String(minutesLeft).padStart(2, "0")}:${String(secondsLeft).padStart(2, "0")}`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{allDone ? "أنجزت الهدف" : "الوقت المتبقي"}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Renewals Table ─── */}
      <div id="renewals-table" className="cc-card rounded-[14px] overflow-x-auto scroll-mt-4">
        <div className="p-4 pb-0 flex items-center gap-3">
          <Input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="ابحث باسم العميل..."
            className="max-w-xs"
          />
          <button
            onClick={selectAllVisible}
            className="text-[10px] px-2.5 py-1.5 rounded-lg border border-cyan/30 text-cyan hover:bg-cyan/10 transition-colors whitespace-nowrap"
            title="تحديد الكل كهدف يومي"
          >
            <SquareCheck className="w-3 h-3 inline-block ml-1" />
            تحديد الكل
          </button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">هدف</TableHead>
              <TableHead className="w-20">الكود</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>الخطة</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>تاريخ التجديد</TableHead>
              <TableHead>الأيام المتبقية</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>المسؤول</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredRenewals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  {statusFilter ? "لا توجد تجديدات مطابقة" : "لا توجد تجديدات بعد. اضغط \"إضافة تجديد\" لإضافة أول تجديد."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRenewals.map((renewal) => {
                const days = getDaysRemaining(renewal.renewal_date);
                const daysStyle = getDaysRemainingStyle(days);
                const badge = STATUS_BADGE[renewal.status] || STATUS_BADGE["مجدول"];

                const isTarget = dailyTargetIds.has(renewal.id);
                const isTargetDone = isTarget && renewal.status === "مكتمل";

                return (
                  <TableRow
                    key={renewal.id}
                    className={isTarget ? (isTargetDone ? "bg-cc-green/[0.04]" : "bg-cyan/[0.04]") : ""}
                  >
                    <TableCell className="text-center">
                      <button
                        onClick={() => toggleDailyTarget(renewal.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isTargetDone
                            ? "border-cc-green bg-cc-green text-white"
                            : isTarget
                            ? "border-cyan bg-cyan/20 text-cyan"
                            : "border-muted-foreground/30 hover:border-cyan/50"
                        }`}
                      >
                        {isTarget && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {renewal.client_code || "—"}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {renewal.customer_name}
                      {isTarget && !isTargetDone && (
                        <span className="mr-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded bg-cyan/10 text-cyan font-medium">
                          هدف اليوم
                        </span>
                      )}
                      {isTargetDone && (
                        <span className="mr-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded bg-cc-green/15 text-cc-green font-medium">
                          تم الإنجاز
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {renewal.plan_name}
                    </TableCell>
                    <TableCell className="font-bold text-cyan text-xs">
                      {formatMoneyFull(renewal.plan_price)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(renewal.renewal_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className={`w-3.5 h-3.5 ${daysStyle.color}`} />
                        <span className={`text-xs font-bold ${daysStyle.color}`}>
                          {daysStyle.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-medium ${badge.bg} ${badge.color}`}>
                          {badge.text}
                          {renewal.status === "ملغي بسبب" && renewal.cancel_reason && (
                            <span className="mr-1 text-[9px] opacity-70">({renewal.cancel_reason})</span>
                          )}
                        </span>
                        {renewal.status === "ملغي بسبب" && ["قلة الاستخدام", "الادارة رفضت", "مشكلات تقنية", "مو حاب يجدد بدون سبب"].includes(renewal.cancel_reason || "") && (
                          <span title="قابل لإعادة الاستهداف" className="flex items-center justify-center w-6 h-6 rounded-full bg-amber/10 text-amber cursor-default animate-pulse">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {renewal.assigned_rep || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <div className="relative">
                          <FollowUpLogButton entityType="renewal" entityId={renewal.id} entityName={renewal.customer_name} />
                          {renewal.status !== "مكتمل" && renewal.status !== "ملغي بسبب" && (() => {
                            const daysSince = Math.floor((Date.now() - new Date(renewal.updated_at).getTime()) / 86400000);
                            if (daysSince < 3) return null;
                            return (
                              <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold px-1 ${
                                daysSince >= 7 ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                              }`} title={`${daysSince} يوم بدون تحديث`}>
                                {daysSince}
                              </span>
                            );
                          })()}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setAssignRenewal(renewal)}
                          title="تعيين لموظف"
                          className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEditModal(renewal)}
                          title="تعديل"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-xs"
                          onClick={() => confirmDelete(renewal.id)}
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Charts Row ─── */}
      {!loading && analytics.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Donut chart */}
          <div className="cc-card rounded-[14px] p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">
              توزيع حالات التجديد
            </h3>
            <DonutChart
              segments={donutSegments}
              centerValue={analytics.total.toLocaleString()}
              centerLabel="تجديد"
            />
            <div className="mt-4 space-y-2.5">
              {donutSegments.map((seg, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="text-muted-foreground">{seg.label}</span>
                    </div>
                    <span className="text-foreground font-medium">
                      {seg.value.toLocaleString()} ({analytics.total > 0 ? formatPercent(seg.value / analytics.total * 100) : "0%"})
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${analytics.total > 0 ? (seg.value / analytics.total) * 100 : 0}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rejection reasons + Revenue info */}
          <div className="space-y-4">
            {/* Revenue cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="cc-card rounded-[14px] p-4 text-center">
                <p className="text-2xl font-extrabold text-cc-green">
                  {formatMoneyFull(analytics.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">إيرادات التجديد</p>
              </div>
              <div className="cc-card rounded-[14px] p-4 text-center">
                <p className="text-2xl font-extrabold text-cc-red">
                  {formatMoneyFull(analytics.revenueLoss)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">خسارة الإلغاء</p>
              </div>
            </div>

            {/* Rejection reasons */}
            <div className="cc-card rounded-[14px] p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">
                أسباب الإلغاء
              </h3>
              {analytics.cancelReasonsArr.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  لا توجد إلغاءات بعد
                </p>
              ) : (
                <div className="space-y-3">
                  {analytics.cancelReasonsArr.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium">{r.reason}</span>
                        <span className="text-muted-foreground">{r.percentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cc-red/70 transition-all"
                          style={{ width: `${r.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── 6-Month Trend ─── */}
      {!loading && analytics.total > 0 && (
        <div className="cc-card rounded-[14px] p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">اتجاه التجديد والإلغاء</h3>
            <p className="text-xs text-muted-foreground mt-1">
              آخر 6 أشهر — نسبة التجديد (أخضر) مقابل نسبة الإلغاء (أحمر)
            </p>
          </div>
          <LineChart data={analytics.monthlyTrend} showArea height={200} />
        </div>
      )}

      {/* ─── Closed Forever Section ─── */}
      {!loading && closedForeverRenewals.length > 0 && (
        <div className="cc-card rounded-xl overflow-hidden">
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-bold text-muted-foreground">التجديدات المغلقة نهائياً</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground font-medium">
                {closedForeverRenewals.length}
              </span>
            </div>
            {showClosed ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showClosed && (
            <div className="border-t border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العميل</TableHead>
                    <TableHead>الجوال</TableHead>
                    <TableHead>الخطة</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>تاريخ التجديد</TableHead>
                    <TableHead>سبب الإغلاق</TableHead>
                    <TableHead>المسؤول</TableHead>
                    <TableHead className="text-center">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closedForeverRenewals.map((renewal) => {
                    const badge = STATUS_BADGE[renewal.status] || STATUS_BADGE["مجدول"];
                    return (
                      <TableRow key={renewal.id} className="opacity-70 hover:opacity-100 transition-opacity">
                        <TableCell className="font-medium text-foreground">{renewal.customer_name}</TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono" dir="ltr">
                          {renewal.customer_phone ? formatPhone(renewal.customer_phone) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{renewal.plan_name}</TableCell>
                        <TableCell className="font-bold text-cc-red text-xs">{formatMoneyFull(renewal.plan_price)}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatDate(renewal.renewal_date)}</TableCell>
                        <TableCell>
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-medium bg-red-dim text-cc-red">
                            {renewal.cancel_reason || "ملغي"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{renewal.assigned_rep || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <FollowUpLogButton entityType="renewal" entityId={renewal.id} entityName={renewal.customer_name} />
                            <Button variant="ghost" size="icon-xs" onClick={() => openEditModal(renewal)} title="تعديل">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="destructive" size="icon-xs" onClick={() => confirmDelete(renewal.id)} title="حذف">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ─── Add / Edit Renewal Modal ─── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل تجديد" : "إضافة تجديد جديد"}</DialogTitle>
            <DialogDescription>
              {editingId ? "قم بتحديث بيانات التجديد" : "أدخل بيانات تجديد الاشتراك"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Customer name */}
            <div className="grid gap-1.5">
              <Label htmlFor="customer_name">اسم العميل</Label>
              <Input
                id="customer_name"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="أدخل اسم العميل"
              />
            </div>

            {/* Phone + Plan name */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="customer_phone">رقم الجوال</Label>
                <Input
                  id="customer_phone"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>اسم الخطة</Label>
                <Select value={form.plan_name} onValueChange={(v) => v && setForm({ ...form, plan_name: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الخطة" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price + Rep */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="plan_price">سعر الخطة (ر.س)</Label>
                <Input
                  id="plan_price"
                  type="number"
                  value={form.plan_price || ""}
                  onChange={(e) =>
                    setForm({ ...form, plan_price: Number(e.target.value) || 0 })
                  }
                  placeholder="0"
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>المسؤول</Label>
                <Select value={form.assigned_rep} onValueChange={(v) => v && setForm({ ...form, assigned_rep: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر المسؤول" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter((e) => e.status === "نشط" || e.status === "متاح").map((e) => (
                      <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Renewal date */}
            <div className="grid gap-1.5">
              <Label htmlFor="renewal_date">تاريخ التجديد</Label>
              <Input
                id="renewal_date"
                type="date"
                value={form.renewal_date}
                onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
                dir="ltr"
                className="text-right"
              />
            </div>

            {/* Status */}
            <div className="grid gap-1.5">
              <Label>الحالة</Label>
              <div className="flex flex-wrap gap-2">
                {RENEWAL_STATUSES.map((st) => (
                  <label
                    key={st}
                    className={`flex items-center gap-1.5 cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      form.status === st
                        ? "border-cyan bg-cyan-dim text-cyan"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={st}
                      checked={form.status === st}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="sr-only"
                    />
                    {st}
                  </label>
                ))}
              </div>
            </div>

            {/* Cancel reason - only when status is ملغي */}
            {form.status === "ملغي بسبب" && (
              <div className="grid gap-1.5">
                <Label>سبب الإلغاء</Label>
                <Select
                  value={form.cancel_reason}
                  onValueChange={(val) => val && setForm({ ...form, cancel_reason: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر سبب الإلغاء" />
                  </SelectTrigger>
                  <SelectContent>
                    {RENEWAL_CANCEL_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ملاحظات إضافية (اختياري)"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة التجديد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا التجديد؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              حذف التجديد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Task Modal */}
      {assignRenewal && (
        <AssignTaskModal
          open={!!assignRenewal}
          onClose={() => setAssignRenewal(null)}
          clientName={assignRenewal.customer_name}
          clientPhone={assignRenewal.customer_phone}
          entityType="renewal"
          entityId={assignRenewal.id}
          defaultTaskType="renewal"
          defaultTitle={`متابعة تجديد ${assignRenewal.customer_name} — ${assignRenewal.plan_name}`}
        />
      )}
    </div>
  );
}

/* ─── Target KPI Card ─── */
function TargetCard({
  label,
  actual,
  target,
  unit,
  status,
  inverted = false,
  formatValue,
}: {
  label: string;
  actual: number;
  target: number;
  unit: string;
  status: "excellent" | "improving" | "behind";
  inverted?: boolean;
  formatValue?: (v: number) => string;
}) {
  const styles = KPI_STATUS_STYLES[status];
  const display = formatValue ? formatValue(actual) : `${actual}${unit}`;
  const targetDisplay = formatValue ? formatValue(target) : `${inverted ? "<" : ""}${target}${unit}`;

  return (
    <div className={`cc-card rounded-[14px] p-5 ${styles.bg}`}>
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
        <span className={`text-2xl font-extrabold ${styles.text}`}>{display}</span>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        الهدف: <span className="text-foreground font-medium">{targetDisplay}</span>
        {" · "}
        <span className={styles.text}>{styles.label}</span>
      </p>
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function StatCardSkeleton() {
  return (
    <div className="cc-card rounded-[14px] p-4 border-t-2 border-t-muted">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
