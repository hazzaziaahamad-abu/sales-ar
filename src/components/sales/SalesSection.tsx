"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import type { Deal, Marketer, Package, Employee, EmployeeTask } from "@/types";
import { fetchDeals, createDeal, updateDeal, deleteDeal, fetchMarketers, createFollowUpNote, fetchRecentFollowUpNotes, fetchPackages, fetchQuoteCommitments, addQuoteCommitment, removeQuoteCommitment, fetchEmployees, fetchEmployeeTasks, createEmployeeTask, createRenewal } from "@/lib/supabase/db";
import { checkDealsForFollowUp, buildFollowUpTask, type FollowUpAction } from "@/lib/auto-followup";
import { StarEmployeeCard, Leaderboard } from "@/components/star-employee";
import { AssignTaskModal } from "@/components/tasks/AssignTaskModal";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { STAGES, SOURCES, SOURCE_COLORS, PLANS } from "@/lib/utils/constants";

import SalesKPIsView from "@/components/SalesKPIsView";
import { formatMoney, formatMoneyFull, formatDate, formatPhone, formatPercent } from "@/lib/utils/format";
import { FollowUpLogButton } from "@/components/follow-up-log";
import { AchievementSummary } from "@/components/achievement-summary";
import { getKpiStatus, KPI_STATUS_STYLES, KPI_TARGETS } from "@/lib/utils/constants";
import { StatCard } from "@/components/ui/stat-card";
import { KPICard } from "@/components/ui/kpi-card";
import { ColorBadge } from "@/components/ui/color-badge";
import { BarChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  Settings,
  MessageSquare,
  Phone,
  Target,
  BarChart3,
  RefreshCw,
  Heart,
  ArrowLeft,
  BookOpen,
  FlaskConical,
  XCircle,
  SquareCheck,
  Download,
  Share2,
  UserPlus,
  User,
  ThumbsUp,
  Bell,
  AlertTriangle,
  PhoneCall,
} from "lucide-react";

/* ─── Stage badge color mapping ─── */
const STAGE_BADGE_COLOR: Record<string, "green" | "amber" | "purple" | "cyan" | "red" | "blue"> = {
  "تواصل": "green",
  "قيد التواصل": "cyan",
  "عميل جديد": "blue",
  "تفاوض": "purple",
  "تجهيز": "cyan",
  "انتظار الدفع": "amber",
  "مكتملة": "green",
  "تاجيل": "blue",
  "اعادة الاتصال في وقت اخر": "amber",
  "تجريبي": "purple",
  "كنسل التجربة": "red",
  "مرفوض مع سبب": "red",
  "استهداف خاطئ": "red",
  "تم إرسال العرض": "purple",
};

/* ─── Stage summary config ─── */
const STAGE_SUMMARY = [
  { stage: "مكتملة", color: "green" as const, icon: <CheckCircle className="w-4 h-4 text-cc-green" /> },
  { stage: "انتظار الدفع", color: "amber" as const, icon: <Clock className="w-4 h-4 text-amber" /> },
  { stage: "تجهيز", color: "cyan" as const, icon: <Settings className="w-4 h-4 text-cyan" /> },
  { stage: "تفاوض", color: "purple" as const, icon: <MessageSquare className="w-4 h-4 text-cc-purple" /> },
  { stage: "تجريبي", color: "blue" as const, icon: <FlaskConical className="w-4 h-4 text-cc-blue" /> },
  { stage: "كنسل التجربة", color: "red" as const, icon: <XCircle className="w-4 h-4 text-cc-red" /> },
  { stage: "مرفوض مع سبب", color: "red" as const, icon: <XCircle className="w-4 h-4 text-cc-red" /> },
];

/* ─── Empty deal form shape ─── */
const EMPTY_FORM = {
  client_name: "",
  client_phone: "",
  deal_value: 0,
  assigned_rep_name: "",
  source: "حملة اعلانية",
  stage: "تواصل",
  plan: "",
  deal_date: new Date().toISOString().slice(0, 10),
  probability: 50,
  marketer_name: "",
  notes: "",
  last_contact: new Date().toISOString().slice(0, 10),
};

export interface SalesPageProps {
  salesType: "office" | "support";
}

export function SalesSection({ salesType }: SalesPageProps) {
  const isOffice = salesType === "office";
  const pageTitle = isOffice ? "مبيعات المكتب" : "مبيعات الدعم";
  const pageDesc = isOffice ? "متابعة مبيعات المكتب وخط الأنابيب" : "متابعة مبيعات الدعم وخط الأنابيب";
  const clientCodePrefix = isOffice ? "S" : "D";
  const { activeOrgId: orgId, user: authUser } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [marketers, setMarketers] = useState<Marketer[]>([]);
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
  const [assignDeal, setAssignDeal] = useState<Deal | null>(null);

  /* auto follow-up engine */
  const [followUpActions, setFollowUpActions] = useState<FollowUpAction[]>([]);
  const [existingTasks, setExistingTasks] = useState<EmployeeTask[]>([]);
  const [creatingFollowUpTask, setCreatingFollowUpTask] = useState<string | null>(null);
  const [dismissedFollowUps, setDismissedFollowUps] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(`followup_dismissed_${new Date().toISOString().slice(0, 10)}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  /* daily target selection — persisted per day in localStorage */
  const salesTodayKey = `sales_daily_target_${salesType}_${new Date().toISOString().slice(0, 10)}`;
  const [dailyTargetIds, setDailyTargetIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(salesTodayKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  function toggleDailyTarget(id: string) {
    setDailyTargetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(salesTodayKey, JSON.stringify([...next]));
      return next;
    });
  }

  function selectAllVisible() {
    setDailyTargetIds((prev) => {
      const next = new Set(prev);
      filteredDeals.forEach((d) => next.add(d.id));
      localStorage.setItem(salesTodayKey, JSON.stringify([...next]));
      return next;
    });
  }

  function deselectAll() {
    setDailyTargetIds(new Set());
    localStorage.setItem(salesTodayKey, JSON.stringify([]));
  }

  /* ─── Follow-up (متابعة) selection ─── */
  const [followUpIds, setFollowUpIds] = useState<Set<string>>(new Set());
  const [showFollowUp, setShowFollowUp] = useState(false);

  function toggleFollowUp(id: string) {
    setFollowUpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllFollowUp() {
    setFollowUpIds(new Set(nonCompletedDeals.map((d) => d.id)));
  }

  function clearFollowUp() {
    setFollowUpIds(new Set());
  }

  function getRecommendation(deal: Deal): { text: string; color: string; icon: string } {
    const daysSince = deal.deal_date ? Math.floor((Date.now() - new Date(deal.deal_date).getTime()) / 86400000) : 0;

    if (deal.stage === "انتظار الدفع") {
      return { text: "تذكير بالدفع — أرسل رسالة تذكير ودية للعميل", color: "text-amber", icon: "💳" };
    }
    if (deal.stage === "تفاوض" && deal.probability < 50) {
      return { text: "قدّم خصم خاص أو عرض محدود لتحفيز القرار", color: "text-cc-purple", icon: "🏷️" };
    }
    if (deal.stage === "تفاوض" && deal.probability >= 50) {
      return { text: "العميل مهتم — ركّز على إبراز القيمة وأرسل عرض سعر نهائي", color: "text-cc-purple", icon: "📋" };
    }
    if (deal.stage === "تجريبي") {
      return { text: "تابع تجربة العميل واسأل عن رأيه ومدى رضاه", color: "text-cc-blue", icon: "🧪" };
    }
    if (deal.stage === "تجهيز") {
      return { text: "أسرع في التجهيز وأبلغ العميل بالتقدم", color: "text-cyan", icon: "⚙️" };
    }
    if (daysSince > 14 && deal.stage === "تواصل") {
      return { text: "مضى أكثر من أسبوعين — اتصل بالعميل مباشرة أو قدّم عرض جديد", color: "text-cc-red", icon: "🔥" };
    }
    if (daysSince > 7 && deal.stage === "تواصل") {
      return { text: "لم يتم التواصل منذ أسبوع — أرسل رسالة متابعة", color: "text-amber", icon: "📱" };
    }
    if (deal.deal_value >= 500) {
      return { text: "صفقة ذات قيمة عالية — أعطها أولوية قصوى", color: "text-cyan", icon: "⭐" };
    }
    return { text: "تواصل مع العميل واستفسر عن احتياجاته", color: "text-muted-foreground", icon: "📞" };
  }

  function buildFollowUpReport() {
    const followUpDeals = deals.filter((d) => followUpIds.has(d.id));
    const todayStr = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    let report = `📋 قائمة متابعة العملاء\n`;
    report += `📅 ${todayStr}\n`;
    report += `${"─".repeat(35)}\n`;
    report += `📊 عدد العملاء: ${followUpDeals.length}\n`;
    report += `💰 إجمالي القيمة: ${followUpDeals.reduce((s, d) => s + d.deal_value, 0).toLocaleString()} ر.س\n\n`;
    followUpDeals.forEach((d, i) => {
      const rec = getRecommendation(d);
      report += `${i + 1}. ${d.client_name}\n`;
      report += `   المرحلة: ${d.stage} | القيمة: ${d.deal_value.toLocaleString()} ر.س\n`;
      report += `   ${rec.icon} التوصية: ${rec.text}\n`;
      if (d.assigned_rep_name) report += `   المسؤول: ${d.assigned_rep_name}\n`;
      report += `\n`;
    });
    return report;
  }

  async function shareFollowUpReport() {
    const report = buildFollowUpReport();
    if (navigator.share) {
      try { await navigator.share({ title: "قائمة متابعة العملاء", text: report }); }
      catch { await navigator.clipboard.writeText(report); alert("تم نسخ التقرير!"); }
    } else {
      await navigator.clipboard.writeText(report);
      alert("تم نسخ التقرير! يمكنك لصقه في واتساب أو أي تطبيق.");
    }
  }

  async function buildSalesReport() {
    const targetDeals = deals.filter((d) => dailyTargetIds.has(d.id));
    const closed = targetDeals.filter((d) => d.stage === "مكتملة");
    const remaining = targetDeals.filter((d) => d.stage !== "مكتملة");
    const total = targetDeals.length;
    const rate = total > 0 ? Math.round((closed.length / total) * 100) : 0;
    const totalValue = closed.reduce((s, d) => s + d.deal_value, 0);
    const todayStr = new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // Fetch latest follow-up notes for all target deals
    const latestNotes: Record<string, string> = {};
    try {
      const allNotes = await fetchRecentFollowUpNotes(100);
      const dealNotes = allNotes.filter((n) => n.entity_type === "deal");
      dealNotes.forEach((n) => {
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

    let report = `📋 تقرير الهدف اليومي — ${pageTitle}\n`;
    report += `📅 ${todayStr}\n`;
    report += `${"─".repeat(35)}\n\n`;
    report += `${statusIcon} الحالة: ${statusMsg}\n`;
    report += `⏱ الوقت المتبقي: ${timeStr}\n\n`;
    report += `🎯 الهدف: ${total} عميل\n`;
    report += `✅ مكتمل: ${closed.length}\n`;
    report += `⏳ متبقي: ${remaining.length}\n`;
    report += `📊 نسبة الإنجاز: ${rate}%\n`;
    report += `💰 قيمة المبيعات المغلقة: ${totalValue.toLocaleString()} ر.س\n\n`;

    if (closed.length > 0) {
      report += `── ✅ المغلقة ──\n`;
      closed.forEach((d, i) => {
        report += `${i + 1}. ${d.client_name}${d.client_phone ? ` — ${d.client_phone}` : ""} — ${d.deal_value.toLocaleString()} ر.س\n`;
        if (latestNotes[d.id]) {
          report += `   💬 ${latestNotes[d.id]}\n`;
        }
      });
      report += `\n`;
    }
    if (remaining.length > 0) {
      report += `── ⏳ المتبقية ──\n`;
      remaining.forEach((d, i) => {
        report += `${i + 1}. ${d.client_name}${d.client_phone ? ` — ${d.client_phone}` : ""} — ${d.stage} — ${d.deal_value.toLocaleString()} ر.س\n`;
        if (latestNotes[d.id]) {
          report += `   💬 ${latestNotes[d.id]}\n`;
        }
      });
    }

    // Top 3 performers
    const closedWithRep = targetDeals.filter((d) => d.stage === "مكتملة" && d.assigned_rep_name);
    if (closedWithRep.length > 0) {
      const repCount: Record<string, { count: number; value: number }> = {};
      closedWithRep.forEach((d) => {
        const name = d.assigned_rep_name!;
        if (!repCount[name]) repCount[name] = { count: 0, value: 0 };
        repCount[name].count++;
        repCount[name].value += d.deal_value;
      });
      const sorted = Object.entries(repCount).sort((a, b) => b[1].count - a[1].count || b[1].value - a[1].value);
      const top3 = sorted.slice(0, 3);
      const medals = ["🥇", "🥈", "🥉"];
      report += `\n── 🏆 أفضل الموظفين ──\n`;
      top3.forEach(([name, stats], i) => {
        report += `${medals[i]} ${name} — ${stats.count} صفقة — ${stats.value.toLocaleString()} ر.س\n`;
      });
    }

    return report;
  }

  async function exportSalesReport() {
    const report = await buildSalesReport();
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير-${isOffice ? "مبيعات-مكتب" : "مبيعات-دعم"}-يومي-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareSalesReport() {
    const report = await buildSalesReport();
    if (navigator.share) {
      try { await navigator.share({ title: `تقرير ${pageTitle} اليومي`, text: report }); }
      catch { await navigator.clipboard.writeText(report); alert("تم نسخ التقرير!"); }
    } else {
      await navigator.clipboard.writeText(report);
      alert("تم نسخ التقرير! يمكنك لصقه في واتساب أو أي تطبيق.");
    }
  }

  /* card filter */
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [repFilter, setRepFilter] = useState<string | null>(null);

  /* achievement summary filter */
  const [achieveFilter, setAchieveFilter] = useState<string | null>(null);
  const [achieveFilterIds, setAchieveFilterIds] = useState<Set<string>>(new Set());
  const { activeMonthIndex, filterCutoff } = useTopbarControls();

  /* time/month-filtered deals (used for all analytics + table) */
  const monthDeals = filterCutoff
    ? deals.filter((d) => new Date(d.deal_date || d.created_at) >= filterCutoff)
    : activeMonthIndex
      ? deals.filter((d) => {
          const dt = new Date(d.deal_date || d.created_at);
          return dt.getMonth() + 1 === activeMonthIndex.month && dt.getFullYear() === activeMonthIndex.year;
        })
      : deals;
  const repFilteredDeals = repFilter
    ? monthDeals.filter((d) => d.assigned_rep_name === repFilter)
    : monthDeals;
  const nonCompletedDeals = repFilteredDeals.filter((d) => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب");

  /* Achievement summary items — uses all deals (filtered by rep only, not month)
     because AchievementSummary has its own internal period filter on updated_at */
  const repOnlyDeals = repFilter ? deals.filter((d) => d.assigned_rep_name === repFilter) : deals;
  const achievementItems = useMemo(() => repOnlyDeals.map(d => ({
    id: d.id,
    updated_at: d.updated_at,
    value: d.deal_value,
    isCompleted: d.stage === "مكتملة",
    isCancelled: d.stage === "مرفوض مع سبب" || d.stage === "كنسل التجربة",
    isContacted: d.stage === "تواصل" || d.stage === "تفاوض" || d.stage === "انتظار الدفع",
    repName: d.assigned_rep_name || undefined,
    planName: d.plan || undefined,
  })), [repOnlyDeals]);

  // Apply achievement filter or stage filter
  const baseFilteredDeals = achieveFilter
    ? repFilteredDeals.filter(d => achieveFilterIds.has(d.id))
    : stageFilter ? repFilteredDeals.filter((d) => d.stage === stageFilter) : repFilteredDeals;
  const filteredDeals = clientSearch
    ? baseFilteredDeals.filter((d) => d.client_name.toLowerCase().includes(clientSearch.toLowerCase()) || (d.client_code && d.client_code.toLowerCase().includes(clientSearch.toLowerCase())) || (d.client_phone && d.client_phone.includes(clientSearch)))
    : baseFilteredDeals;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchDeals(salesType),
      fetchMarketers(),
      fetchPackages(),
      fetchEmployees(),
      fetchEmployeeTasks(),
    ])
      .then(([dealsData, marketersData, packagesData, employeesData, tasksData]) => {
        setDeals(dealsData);
        setMarketers(marketersData);
        setPackages(packagesData);
        setEmployees(employeesData);
        setExistingTasks(tasksData);
        // Run follow-up check
        const actions = checkDealsForFollowUp(dealsData, tasksData);
        setFollowUpActions(actions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, salesType]);

  /* ─── Quote Commitment ─── */
  const todayStr = new Date().toISOString().slice(0, 10);
  const [commitments, setCommitments] = useState<{ user_name: string; created_at: string }[]>([]);
  const myName = authUser?.name || authUser?.email || "";
  const hasCommitted = commitments.some((c) => c.user_name === myName);

  useEffect(() => {
    if (orgId) {
      fetchQuoteCommitments(orgId, todayStr, salesType).then(setCommitments).catch(console.error);
    }
  }, [orgId, todayStr, salesType]);

  const toggleCommitment = useCallback(async () => {
    if (!orgId || !myName) return;
    try {
      if (hasCommitted) {
        await removeQuoteCommitment(orgId, myName, todayStr, salesType);
        setCommitments((prev) => prev.filter((c) => c.user_name !== myName));
      } else {
        await addQuoteCommitment(orgId, myName, todayStr, salesType);
        setCommitments((prev) => [...prev, { user_name: myName, created_at: new Date().toISOString() }]);
      }
    } catch (e) { console.error(e); }
  }, [orgId, myName, todayStr, salesType, hasCommitted]);

  /* ─── Computed values ─── */
  const totalDeals = repFilteredDeals.length;
  const totalValue = repFilteredDeals.reduce((s, d) => s + d.deal_value, 0);
  const avgDealValue = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0;

  const stageCounts = repFilteredDeals.reduce<Record<string, { count: number; value: number }>>((acc, d) => {
    if (!acc[d.stage]) acc[d.stage] = { count: 0, value: 0 };
    acc[d.stage].count++;
    acc[d.stage].value += d.deal_value;
    return acc;
  }, {});

  const sourceCounts = repFilteredDeals.reduce<Record<string, number>>((acc, d) => {
    if (d.source) acc[d.source] = (acc[d.source] || 0) + 1;
    return acc;
  }, {});

  /* KPI calculations */
  const closedDeals = repFilteredDeals.filter((d) => d.stage === "مكتملة").length;
  const winRate = totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0;
  const avgCycleDays = totalDeals > 0 ? Math.round(repFilteredDeals.reduce((s, d) => s + d.cycle_days, 0) / totalDeals) : 0;
  const pipelineValue = repFilteredDeals.filter((d) => d.stage !== "مكتملة").reduce((s, d) => s + d.deal_value, 0);

  /* Rep performance */
  // Build price map from packages
  const pkgPriceMap = new Map<string, number>();
  packages.forEach((p) => pkgPriceMap.set(p.name.toLowerCase().trim(), p.original_price));
  const getOrigPrice = (plan: string | undefined): number | null => {
    if (!plan) return null;
    const n = plan.toLowerCase().trim();
    if (pkgPriceMap.has(n)) return pkgPriceMap.get(n)!;
    for (const [key, val] of pkgPriceMap) {
      if (n.includes(key) || key.includes(n)) return val;
    }
    return null;
  };

  const repPerformance = (() => {
    const repMap: Record<string, { deals: number; closed: number; value: number; cycleDays: number; plans: Record<string, number>; fullPrice: number; discounted: number; discountTotal: number }> = {};
    repFilteredDeals.forEach((d) => {
      const rep = d.assigned_rep_name || "غير محدد";
      if (!repMap[rep]) repMap[rep] = { deals: 0, closed: 0, value: 0, cycleDays: 0, plans: {}, fullPrice: 0, discounted: 0, discountTotal: 0 };
      repMap[rep].deals++;
      repMap[rep].value += d.deal_value;
      repMap[rep].cycleDays += d.cycle_days;
      if (d.stage === "مكتملة") {
        repMap[rep].closed++;
        const origP = getOrigPrice(d.plan);
        if (origP !== null) {
          if (d.deal_value >= origP) {
            repMap[rep].fullPrice++;
          } else {
            repMap[rep].discounted++;
            repMap[rep].discountTotal += origP - d.deal_value;
          }
        }
      }
      if (d.plan) repMap[rep].plans[d.plan] = (repMap[rep].plans[d.plan] || 0) + 1;
    });
    return Object.entries(repMap)
      .map(([name, data]) => ({
        name,
        deals: data.deals,
        closed: data.closed,
        value: data.value,
        plans: data.plans,
        winRate: data.deals > 0 ? Math.round((data.closed / data.deals) * 100) : 0,
        avgCycle: data.deals > 0 ? Math.round(data.cycleDays / data.deals) : 0,
        fullPrice: data.fullPrice,
        discounted: data.discounted,
        discountTotal: data.discountTotal,
        fullPriceRate: (data.fullPrice + data.discounted) > 0 ? Math.round((data.fullPrice / (data.fullPrice + data.discounted)) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  })();

  /* Lost deals analysis — from real deals with stage "مرفوض مع سبب" */
  const lostDeals = repFilteredDeals.filter((d) => d.stage === "مرفوض مع سبب");
  const lostReasons = lostDeals.reduce<Record<string, { count: number; value: number }>>((acc, d) => {
    const reason = d.loss_reason || "أخرى";
    if (!acc[reason]) acc[reason] = { count: 0, value: 0 };
    acc[reason].count++;
    acc[reason].value += d.deal_value;
    return acc;
  }, {});
  const totalLostValue = lostDeals.reduce((s, d) => s + d.deal_value, 0);

  /* Source ROI data */
  const sourceData = SOURCES.map((src) => {
    const srcDeals = monthDeals.filter((d) => d.source === src);
    const srcWon = srcDeals.filter((d) => d.stage === "مكتملة");
    return {
      source: src,
      count: srcDeals.length,
      value: srcDeals.reduce((s, d) => s + d.deal_value, 0),
      won: srcWon.length,
      winRate: srcDeals.length > 0 ? Math.round((srcWon.length / srcDeals.length) * 100) : 0,
    };
  }).filter((s) => s.count > 0);

  /* Funnel data */
  const funnelStages = ["تواصل", "تفاوض", "تجهيز", "انتظار الدفع", "مكتملة"];
  const funnelData = funnelStages.map((stage) => ({
    stage,
    count: stageCounts[stage]?.count || 0,
    value: stageCounts[stage]?.value || 0,
  }));

  /* ─── Handlers ─── */
  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(deal: Deal) {
    setEditingId(deal.id);
    setForm({
      client_name: deal.client_name,
      client_phone: deal.client_phone || "",
      deal_value: deal.deal_value,
      assigned_rep_name: deal.assigned_rep_name || "",
      source: deal.source || "حملة اعلانية",
      stage: deal.stage,
      plan: deal.plan || "",
      deal_date: deal.deal_date || new Date().toISOString().slice(0, 10),
      probability: deal.probability,
      marketer_name: deal.marketer_name || "",
      notes: deal.notes || "",
      last_contact: deal.last_contact || deal.deal_date || new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.client_name.trim()) return;
    setSaving(true);
    try {
      const dealDate = form.deal_date;
      const month = new Date(dealDate).getMonth() + 1;
      const year = new Date(dealDate).getFullYear();

      const marketerName = form.source === "تسويق بالعمولة" ? form.marketer_name : undefined;

      if (editingId) {
        const oldDeal = deals.find((d) => d.id === editingId);
        const updated = await updateDeal(editingId, {
          client_name: form.client_name,
          client_phone: form.client_phone,
          deal_value: form.deal_value,
          assigned_rep_name: form.assigned_rep_name,
          source: form.source,
          stage: form.stage,
          plan: form.plan || undefined,
          deal_date: form.deal_date,
          probability: form.probability,
          marketer_name: marketerName || undefined,
          notes: form.notes || undefined,
          last_contact: form.last_contact || undefined,
          month,
          year,
        });
        setDeals((prev) => prev.map((d) => (d.id === editingId ? updated : d)));

        /* Auto-track changes */
        if (oldDeal) {
          const author = authUser?.name || "النظام";
          const changes: string[] = [];
          if (oldDeal.stage !== form.stage) changes.push(`المرحلة: ${oldDeal.stage} ← ${form.stage}`);
          if (oldDeal.deal_value !== form.deal_value) changes.push(`القيمة: ${oldDeal.deal_value} ← ${form.deal_value} ر.س`);
          if (oldDeal.probability !== form.probability) changes.push(`الاحتمالية: ${oldDeal.probability}% ← ${form.probability}%`);
          if ((oldDeal.assigned_rep_name || "") !== form.assigned_rep_name) changes.push(`المسؤول: ${oldDeal.assigned_rep_name || "—"} ← ${form.assigned_rep_name || "—"}`);
          if ((oldDeal.plan || "") !== (form.plan || "")) changes.push(`الباقة: ${oldDeal.plan || "—"} ← ${form.plan || "—"}`);
          if ((oldDeal.source || "") !== form.source) changes.push(`المصدر: ${oldDeal.source || "—"} ← ${form.source}`);
          if (changes.length > 0) {
            createFollowUpNote("deal", editingId, `📝 تحديث تلقائي:\n${changes.join("\n")}`, author).catch(console.error);
          }

          /* Auto-create renewal when deal is completed */
          if (oldDeal.stage !== "مكتملة" && form.stage === "مكتملة" && form.plan) {
            const renewalDate = new Date();
            renewalDate.setFullYear(renewalDate.getFullYear() + 1);
            createRenewal({
              customer_name: form.client_name,
              customer_phone: form.client_phone || undefined,
              plan_name: form.plan,
              plan_price: form.deal_value,
              renewal_date: renewalDate.toISOString().slice(0, 10),
              status: "مجدول",
              assigned_rep: form.assigned_rep_name || undefined,
              notes: `تجديد تلقائي من صفقة مكتملة — ${author}`,
            }).then(() => {
              createFollowUpNote("deal", editingId, `🔄 تم إنشاء تجديد تلقائي للعميل بتاريخ ${renewalDate.toISOString().slice(0, 10)}`, author).catch(console.error);
            }).catch(console.error);
          }
        }
      } else {
        const created = await createDeal({
          client_name: form.client_name,
          client_phone: form.client_phone,
          deal_value: form.deal_value,
          assigned_rep_name: form.assigned_rep_name,
          source: form.source,
          stage: form.stage,
          plan: form.plan || undefined,
          deal_date: form.deal_date,
          probability: form.probability,
          marketer_name: marketerName,
          notes: form.notes || undefined,
          last_contact: form.last_contact || undefined,
          cycle_days: 0,
          month,
          year,
          sales_type: salesType,
        });
        setDeals((prev) => [created, ...prev]);
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
        await deleteDeal(deleteId);
        setDeals((prev) => prev.filter((d) => d.id !== deleteId));
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  /* ─── Auto Follow-up Handlers ─── */
  const visibleFollowUps = followUpActions.filter((a) => !dismissedFollowUps.has(a.deal.id));

  function dismissFollowUp(dealId: string) {
    setDismissedFollowUps((prev) => {
      const next = new Set(prev);
      next.add(dealId);
      localStorage.setItem(`followup_dismissed_${new Date().toISOString().slice(0, 10)}`, JSON.stringify([...next]));
      return next;
    });
  }

  async function handleCreateFollowUpTask(action: FollowUpAction) {
    setCreatingFollowUpTask(action.deal.id);
    try {
      const taskData = buildFollowUpTask(action, authUser?.id, authUser?.name || "النظام");
      await createEmployeeTask(taskData);
      // Remove from list after creating
      setFollowUpActions((prev) => prev.filter((a) => a.deal.id !== action.deal.id));
      // Refresh tasks
      const updatedTasks = await fetchEmployeeTasks();
      setExistingTasks(updatedTasks);
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingFollowUpTask(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isOffice ? "bg-cyan-dim" : "bg-orange-500/15"}`}>
            <TrendingUp className={`w-4 h-4 ${isOffice ? "text-cyan" : "text-orange-400"}`} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
            <p className="text-xs text-muted-foreground">{pageDesc}</p>
            {(() => {
              const quotes = [
                // ── إغلاق الصفقات ──
                { text: "الإغلاق لا يبدأ في النهاية، بل من أول ثانية تبني فيها الثقة", author: "بريان تريسي" },
                { text: "لا تسأل العميل هل يريد الشراء — اسأله متى يريد أن يبدأ", author: "توم هوبكنز" },
                { text: "أقوى تقنية إغلاق هي أن تجعل العميل يشعر أنه اتخذ القرار بنفسه", author: "دانيال بينك" },
                { text: "الصفقة تُغلق عندما يرى العميل نفسه في المستقبل مع منتجك", author: "جيل كونراث" },
                { text: "لا تغلق بالضغط، أغلق بالقيمة — العميل يشتري عندما يفهم العائد", author: "نيل راكهام" },
                { text: "سر الإغلاق: اجعل تكلفة عدم الشراء أوضح من تكلفة الشراء", author: "غرانت كاردون" },
                { text: "أفضل وقت لطلب الإغلاق هو عندما يبدأ العميل يسأل عن التفاصيل", author: "زيغ زيغلار" },
                { text: "الإغلاق ليس نهاية المحادثة — إنه بداية الشراكة", author: "جيفري غيتومر" },
                { text: "اسأل عن الطلب. كثير من المبيعات تضيع لأن البائع لم يطلب ببساطة", author: "جاك كانفيلد" },
                { text: "حين تقدم حلاً حقيقياً لمشكلة حقيقية، الإغلاق يحدث تلقائياً", author: "مارك هنتر" },
                { text: "لا تخف من الصمت بعد طرح السعر — من يتكلم أولاً يخسر", author: "ستيلي إيفتي" },
                { text: "العميل لا يشتري المنتج، يشتري الثقة فيك أنت", author: "ديفيد ساندلر" },

                // ── التعامل مع الرفض ──
                { text: "كل 'لا' تسمعها هي خطوة أقرب لـ 'نعم' — الرفض جزء من اللعبة", author: "مارك فيكتور هانسن" },
                { text: "البيع الحقيقي يبدأ عندما يقول العميل لا", author: "إلمر ليترمان" },
                { text: "الرفض ليس شخصياً — العميل يرفض العرض وليس أنت", author: "جيل كونراث" },
                { text: "الفرق بين الناجح والفاشل: الناجح سمع 'لا' أكثر واستمر", author: "أندريا والتز" },
                { text: "عندما يقول العميل 'غالي'، فهو يقول 'لم أفهم القيمة بعد'", author: "كريس فوس" },
                { text: "لا تأخذ الرفض كنهاية — خذه كفرصة لفهم العميل أعمق", author: "بو بينيت" },
                { text: "كل اعتراض هو سؤال مقنّع — أجب عن السؤال وستكسب العميل", author: "توم هوبكنز" },
                { text: "الرفض هو أفضل معلم في المبيعات — كل 'لا' تعلمك شيئاً جديداً", author: "أوج ماندينو" },
                { text: "لا تجادل الاعتراض — اعترف به أولاً ثم أعد صياغة القيمة", author: "ديفيد ساندلر" },
                { text: "90% من المبيعات تتم بعد المحاولة الخامسة، لكن أغلب البائعين يتوقفون بعد الأولى", author: "هربرت ترو" },
                { text: "العميل المتردد ليس رافضاً — هو يحتاج سبباً أقوى ليوافق", author: "نيل راكهام" },
                { text: "حوّل 'لا أحتاج' إلى 'لم أكن أعرف أني أحتاج' بقصة نجاح مشابهة", author: "مايك واينبرغ" },

                // ── قصص ودروس المبيعات ──
                { text: "جو جيرارد باع 13,001 سيارة في حياته — سره: كل عميل يعرف 250 شخص، عامله كبوابة", author: "جو جيرارد" },
                { text: "سارة بلاكلي بدأت Spanx بـ 5000 دولار فقط — نجحت لأنها باعت الحل وليس المنتج", author: "سارة بلاكلي" },
                { text: "هوارد شولتز أُرفض من 242 بنكاً قبل أن يموّل ستاربكس — المثابرة تصنع الإمبراطوريات", author: "هوارد شولتز" },
                { text: "مارك بينيوف بنى Salesforce من الصفر بفكرة واحدة: البرمجيات كخدمة — البساطة تفوز", author: "مارك بينيوف" },
                { text: "كولونيل ساندرز أُرفضت وصفته 1009 مرات قبل أن تقبلها مطعم — لا تتوقف", author: "كولونيل ساندرز" },
                { text: "ستيف جوبز لم يبع تقنية — باع تجربة حياة أفضل وأبسط", author: "ستيف جوبز" },
                { text: "والت ديزني أُفلس 7 مرات وطُرد لأنه 'يفتقر للإبداع' — الرؤية أقوى من الرفض", author: "والت ديزني" },
                { text: "إيلون ماسك خاطر بآخر أمواله على SpaceX وTesla — الإيمان بمنتجك هو أقوى أداة بيع", author: "إيلون ماسك" },

                // ── فن البيع والتفاوض ──
                { text: "لا تبيع بالمنطق فقط — العميل يقرر بالعاطفة ويبرر بالمنطق", author: "أنطونيو داماسيو" },
                { text: "أقوى كلمة في المبيعات ليست 'اشترِ' بل 'لأنّ' — الناس تحتاج سبباً", author: "روبرت تشالديني" },
                { text: "اسأل أسئلة ذكية بدل أن تقدم عروضاً — من يسأل يقود المحادثة", author: "نيل راكهام" },
                { text: "في التفاوض، لا تتنازل مجاناً — كل تنازل يجب أن يقابله شيء", author: "كريس فوس" },
                { text: "العميل لا يهتم بميزات منتجك — يهتم بكيف ستتغير حياته بعد الشراء", author: "سايمون سينك" },
                { text: "بِع كما لو أنك تنصح صديقاً — الصدق أقوى تقنية بيع في العالم", author: "زيغ زيغلار" },
                { text: "استمع ضعف ما تتكلم — أذناك اثنتان وفمك واحد لسبب", author: "دايل كارنيجي" },
                { text: "لا تتكلم عن نفسك — تكلم عن عميلك ومشاكله وأحلامه", author: "دونالد ميلر" },
                { text: "أقوى عرض تقدمي هو شهادة عميل سابق ناجح", author: "روبرت تشالديني" },
                { text: "السعر اعتراض فقط حين لا يرى العميل قيمة كافية", author: "غرانت كاردون" },

                // ── المثابرة والتحفيز ──
                { text: "المبيعات ليست مهنة للضعفاء — هي ميدان للمحاربين الذين لا يستسلمون", author: "غرانت كاردون" },
                { text: "في كل صباح لديك خيار: أن تكون متوسطاً أو استثنائياً. اختر", author: "هال إلرود" },
                { text: "النجاح عادة وليس حدثاً — كرر العادات الصحيحة يومياً", author: "أرسطو" },
                { text: "لا تقارن نفسك بالآخرين — قارن نفسك بمن كنت أمس", author: "جوردان بيترسون" },
                { text: "أنجح البائعين ليسوا الأذكى — هم الأكثر انضباطاً", author: "جيب بلونت" },
                { text: "الفرق بين البائع العادي والنجم: النجم يتابع، العادي ينتظر", author: "مايك واينبرغ" },
                { text: "كل يوم بدون مكالمة بيع هو يوم ضائع — الأرقام لا تكذب", author: "فابيان فريدريكسون" },
                { text: "الخوف من الرفض يكلفك أكثر من الرفض نفسه — تحرك", author: "تيم فيريس" },

                // ── بناء العلاقات ──
                { text: "الناس يشترون من أشخاص يعرفونهم ويحبونهم ويثقون بهم", author: "بوب بيرغ" },
                { text: "أنت لا تغلق صفقة، أنت تفتح علاقة طويلة الأمد", author: "بو بينيت" },
                { text: "اجعل عميلك بطل القصة وليس شركتك — هو البطل وأنت المرشد", author: "دونالد ميلر" },
                { text: "أغلى استثمار في المبيعات هو الوقت الذي تقضيه في فهم عميلك", author: "ستيفن شيفمان" },
                { text: "العلاقة التي تبنيها اليوم هي الصفقة التي تغلقها غداً", author: "هارفي ماكاي" },
                { text: "كل تواصل مع عميل هو فرصة لبناء ولاء مدى الحياة", author: "جيف بيزوس" },
                { text: "لا تبع وتمشي — تابع واخدم، والعميل سيبيع لك بنفسه", author: "جو جيرارد" },
                { text: "أفضل مصدر لعملاء جدد هو عملاؤك الحاليون — اطلب التوصية", author: "بوب بيرغ" },

                // ── عقلية البائع المحترف ──
                { text: "البائع المحترف لا يبيع — يساعد الناس على اتخاذ قرارات أفضل", author: "ماثيو ديكسون" },
                { text: "توقف عن البيع وابدأ في حل المشاكل — المبيعات ستتبعك", author: "مارك روبرج" },
                { text: "المبيعات ليست إقناعاً — هي فن اكتشاف ما يحتاجه العميل فعلاً", author: "نيل راكهام" },
                { text: "ليس المهم أن تكون الأرخص — المهم أن تكون الأفضل قيمة", author: "وارن بافيت" },
                { text: "العميل يتذكر الخدمة أطول بكثير مما يتذكر السعر", author: "لورين فليس" },
                { text: "اعرف منتجك كخبير واعرف عميلك كصديق — هذه هي المعادلة", author: "بريان تريسي" },
                { text: "المبيعات مرآة — كلما أعطيت أكثر، عاد إليك أكثر", author: "زيغ زيغلار" },
                { text: "لا يوجد منتج سيء، يوجد بائع لم يجد الزاوية الصحيحة للعرض", author: "أوج ماندينو" },
                { text: "أقوى سلاح في ترسانتك هو الاستعداد — حضّر قبل كل مكالمة", author: "أنتوني يانارينو" },
                { text: "اجعل هدفك أن يقول العميل 'أنا محظوظ إني تعاملت معك'", author: "شيب هايكن" },
                { text: "البائع المتميز يتعلم من كل صفقة خسرها أكثر مما يحتفل بما ربحها", author: "مارك هنتر" },
                { text: "لا تكن مندوب مبيعات — كن مستشاراً موثوقاً يلجأ إليه العميل", author: "ماثيو ديكسون" },
              ];
              const hourIndex = Math.floor(Date.now() / 3600000) % quotes.length;
              const q = quotes[hourIndex];
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
        <div className="flex items-center gap-2">
          <Link href="/sales-guide">
            <Button variant="outline" className="gap-1.5">
              <BookOpen className="w-4 h-4" />
              دليل المبيعات
            </Button>
          </Link>
          <Button onClick={openAddModal} className="gap-1.5">
            <Plus className="w-4 h-4" />
            إضافة مبيع
          </Button>
        </div>
      </div>

      {/* ─── Auto Follow-up Reminders ─── */}
      {!loading && visibleFollowUps.length > 0 && (
        <div className="cc-card rounded-[14px] border border-cc-red/20 bg-gradient-to-l from-cc-red/[0.04] via-amber/[0.03] to-transparent overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-border/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cc-red/10 flex items-center justify-center relative">
                <Bell className="w-4 h-4 text-cc-red" />
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cc-red text-white text-[9px] font-bold flex items-center justify-center">
                  {visibleFollowUps.length}
                </span>
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-foreground">تنبيهات المتابعة التلقائية</h3>
                <p className="text-[10px] text-muted-foreground">
                  {visibleFollowUps.filter((a) => a.rule.priority === "urgent").length > 0
                    ? `${visibleFollowUps.filter((a) => a.rule.priority === "urgent").length} تصعيد عاجل — `
                    : ""}
                  {visibleFollowUps.length} عميل يحتاج متابعة
                </p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/20 max-h-[320px] overflow-y-auto">
            {visibleFollowUps.slice(0, 10).map((action) => {
              const priorityStyles: Record<string, { bg: string; text: string; label: string }> = {
                urgent: { bg: "bg-cc-red/10 border-cc-red/30", text: "text-cc-red", label: "عاجل" },
                high: { bg: "bg-amber/10 border-amber/30", text: "text-amber", label: "مرتفع" },
                medium: { bg: "bg-cc-blue/10 border-cc-blue/30", text: "text-cc-blue", label: "متوسط" },
                low: { bg: "bg-muted/50 border-border", text: "text-muted-foreground", label: "منخفض" },
              };
              const ps = priorityStyles[action.rule.priority] || priorityStyles.medium;
              return (
                <div key={action.deal.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                  <div className={`shrink-0 w-7 h-7 rounded-full ${ps.bg} border flex items-center justify-center`}>
                    {action.rule.priority === "urgent" ? (
                      <AlertTriangle className={`w-3.5 h-3.5 ${ps.text}`} />
                    ) : action.rule.taskType === "call" ? (
                      <PhoneCall className={`w-3.5 h-3.5 ${ps.text}`} />
                    ) : (
                      <Bell className={`w-3.5 h-3.5 ${ps.text}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{action.taskTitle}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${ps.bg} ${ps.text} font-semibold`}>
                        {ps.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{action.rule.label}</span>
                      {action.deal.assigned_rep_name && (
                        <span className="text-[10px] text-muted-foreground">• {action.deal.assigned_rep_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCreateFollowUpTask(action)}
                      disabled={creatingFollowUpTask === action.deal.id}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg bg-cc-green/10 text-cc-green border border-cc-green/30 hover:bg-cc-green/20 transition-colors disabled:opacity-50 font-medium"
                    >
                      {creatingFollowUpTask === action.deal.id ? "جاري..." : "إنشاء مهمة"}
                    </button>
                    <button
                      onClick={() => dismissFollowUp(action.deal.id)}
                      className="text-[10px] px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      تخطي
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {visibleFollowUps.length > 10 && (
            <div className="px-4 py-2 text-center border-t border-border/30">
              <span className="text-[10px] text-muted-foreground">و {visibleFollowUps.length - 10} تنبيه آخر...</span>
            </div>
          )}
        </div>
      )}

      {/* ─── Stage Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
          : STAGE_SUMMARY.map((s) => {
              const data = stageCounts[s.stage] || { count: 0, value: 0 };
              const pct = totalDeals > 0 ? Math.round((data.count / totalDeals) * 100) : 0;
              return (
                <StatCard
                  key={s.stage}
                  value={String(data.count)}
                  label={s.stage}
                  color={s.color}
                  progress={pct}
                  icon={s.icon}
                  subtext={formatMoney(data.value)}
                  onClick={() => setStageFilter(stageFilter === s.stage ? null : s.stage)}
                  active={stageFilter === s.stage}
                />
              );
            })}
      </div>

      {/* ─── Financial Summary Row ─── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="cc-card rounded-[14px] p-5 text-center">
            <p className="text-2xl font-extrabold text-cyan">{formatMoney(totalValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي قيمة المبيعات</p>
          </div>
          <div className="cc-card rounded-2xl p-5 text-center" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
            <p className="text-2xl font-extrabold text-cc-green">{totalDeals}</p>
            <p className="text-xs text-muted-foreground mt-1">عدد المبيعات</p>
          </div>
          <div className="cc-card rounded-2xl p-5 text-center" style={{ borderColor: "rgba(139,92,246,0.3)" }}>
            <p className="text-2xl font-extrabold text-cc-purple">{formatMoney(avgDealValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">متوسط قيمة المبيع</p>
          </div>
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
            {[...new Set(monthDeals.map(d => d.assigned_rep_name).filter(Boolean))].map((name) => (
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

      {/* ─── Achievement Summary ─── */}
      {!loading && (
        <AchievementSummary
          items={achievementItems}
          allPlans={[...PLANS]}
          labels={{
            completed: "صفقة مكتملة",
            revenue: "إيرادات محققة",
            contacted: "تم التواصل",
            successRate: "نسبة النجاح",
            lostRevenue: "إيرادات مفقودة",
            topRep: "صفقة",
          }}
          onFilterChange={(filter, ids) => {
            setAchieveFilter(filter);
            setAchieveFilterIds(ids);
            if (filter) setStageFilter(null);
          }}
          activeFilter={achieveFilter}
          filteredCount={filteredDeals.length}
          tableAnchorId="sales-table"
        />
      )}

      {/* ─── Source Distribution Cards ─── */}
      <div className="flex flex-wrap gap-3 justify-center">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          : SOURCES.map((src) => {
              const count = sourceCounts[src] || 0;
              const pct = totalDeals > 0 ? Math.round((count / totalDeals) * 100) : 0;
              const rawColor = SOURCE_COLORS[src] || "cyan";
              const isTop = count > 0 && count === Math.max(...SOURCES.map((s) => sourceCounts[s] || 0));
              return (
                <div
                  key={src}
                  className={`cc-card rounded-2xl p-4 text-center min-w-[120px] flex-1 max-w-[160px] border transition-all duration-300 ${
                    isTop ? `border-${rawColor}/40 bg-${rawColor}/[0.06] shadow-lg shadow-${rawColor}/10` : "border-border/30"
                  }`}
                >
                  <p className={`text-2xl font-extrabold ${count > 0 ? `text-${rawColor}` : "text-muted-foreground/50"}`}>{count}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{src}</p>
                  <div className="flex justify-center mt-2.5 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${count > 0 ? `bg-${rawColor}` : "bg-muted-foreground/20"}`} />
                  </div>
                  <p className={`text-[11px] font-semibold ${count > 0 ? `text-${rawColor}` : "text-muted-foreground/40"}`}>{pct}%</p>
                </div>
              );
            })}
      </div>

      {/* ─── Follow-up Section ─── */}
      {!loading && nonCompletedDeals.length > 0 && (
        <div className="cc-card rounded-[14px] border border-amber/20 bg-gradient-to-l from-amber/[0.04] to-transparent">
          <button
            onClick={() => setShowFollowUp(!showFollowUp)}
            className="w-full p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-amber" />
              </div>
              <div className="text-right">
                <h3 className="text-sm font-bold text-foreground">متابعة العملاء</h3>
                <span className="text-[10px] text-muted-foreground">{nonCompletedDeals.length} عميل غير مكتمل — {followUpIds.size > 0 ? `${followUpIds.size} محدد` : "اختر للمتابعة"}</span>
              </div>
            </div>
            <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showFollowUp ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFollowUp && (
            <div className="px-4 pb-4 space-y-3">
              {/* Actions bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={selectAllFollowUp} className="text-[10px] px-2.5 py-1.5 rounded-lg border border-amber/30 text-amber hover:bg-amber/10 transition-colors">
                  <SquareCheck className="w-3 h-3 inline-block ml-1" />تحديد الكل
                </button>
                {followUpIds.size > 0 && (
                  <>
                    <button onClick={shareFollowUpReport} className="text-[10px] px-2.5 py-1.5 rounded-lg border border-cc-purple/30 text-cc-purple hover:bg-cc-purple/10 transition-colors">
                      <Share2 className="w-3 h-3 inline-block ml-1" />مشاركة مع الفريق
                    </button>
                    <button onClick={clearFollowUp} className="text-[10px] text-muted-foreground hover:text-cc-red transition-colors">مسح التحديد</button>
                    <span className="text-[10px] text-muted-foreground mr-auto">
                      {followUpIds.size} عميل | {formatMoney(deals.filter((d) => followUpIds.has(d.id)).reduce((s, d) => s + d.deal_value, 0))}
                    </span>
                  </>
                )}
              </div>

              {/* Client cards */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {nonCompletedDeals.map((deal) => {
                  const isSelected = followUpIds.has(deal.id);
                  const rec = getRecommendation(deal);
                  const daysSince = deal.deal_date ? Math.floor((Date.now() - new Date(deal.deal_date).getTime()) / 86400000) : 0;

                  return (
                    <div
                      key={deal.id}
                      onClick={() => toggleFollowUp(deal.id)}
                      className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected ? "border-amber/40 bg-amber/[0.06]" : "border-border/30 bg-card/30 hover:border-border/60"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                        isSelected ? "border-amber bg-amber/20 text-amber" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{deal.client_name}</span>
                          <ColorBadge color={STAGE_BADGE_COLOR[deal.stage] || "cyan"} text={deal.stage} />
                          <span className="text-xs font-bold text-cyan">{formatMoney(deal.deal_value)}</span>
                          {daysSince > 0 && (
                            <span className={`text-[10px] ${daysSince > 14 ? "text-cc-red" : daysSince > 7 ? "text-amber" : "text-muted-foreground"}`}>
                              منذ {daysSince} يوم
                            </span>
                          )}
                          {deal.assigned_rep_name && <span className="text-[10px] text-muted-foreground">{deal.assigned_rep_name}</span>}
                        </div>
                        {/* Recommendation */}
                        <div className={`flex items-start gap-1.5 mt-1.5 ${rec.color}`}>
                          <span className="text-xs leading-none">{rec.icon}</span>
                          <span className="text-[11px] leading-relaxed">{rec.text}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Daily Sales Target ─── */}
      {dailyTargetIds.size > 0 && !loading && (() => {
        const targetDeals = deals.filter((d) => dailyTargetIds.has(d.id));
        const closed = targetDeals.filter((d) => d.stage === "مكتملة").length;
        const total = targetDeals.length;
        const remaining = total - closed;
        const rate = total > 0 ? Math.round((closed / total) * 100) : 0;
        const allDone = remaining === 0 && total > 0;
        const closedValue = targetDeals.filter((d) => d.stage === "مكتملة").reduce((s, d) => s + d.deal_value, 0);

        const { h: hoursLeft, m: minutesLeft, s: secondsLeft, timeUp } = countdown;

        const motivationMsg = allDone
          ? "ممتاز! أنجزت كل أهداف اليوم 🏆"
          : timeUp ? "انتهى وقت العمل! أكمل ما تبقى"
          : rate >= 80 ? "أنت قريب جداً! 💪"
          : rate >= 50 ? `باقي ${remaining} فقط، استمر! 🔥`
          : rate > 0 ? "بداية جيدة، واصل التقدم ⚡"
          : `${total} عميل بانتظارك، ابدأ الآن! 🚀`;

        return (
          <div className={`cc-card rounded-[14px] p-4 border transition-all duration-500 ${
            allDone ? "border-cc-green/30 bg-gradient-to-l from-cc-green/[0.06] to-transparent" : "border-cyan/20 bg-gradient-to-l from-cyan/[0.04] to-transparent"
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${allDone ? "bg-cc-green/15" : "bg-cyan/10"}`}>
                  <Target className={`w-4 h-4 ${allDone ? "text-cc-green" : "text-cyan"}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">هدف {pageTitle} اليومي</h3>
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
                <button onClick={shareSalesReport} className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-cc-purple/30 text-cc-purple hover:bg-cc-purple/10 transition-colors" title="مشاركة">
                  <Share2 className="w-3 h-3" />مشاركة
                </button>
                <button onClick={exportSalesReport} className="flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-cyan/30 text-cyan hover:bg-cyan/10 transition-colors" title="تصدير">
                  <Download className="w-3 h-3" />تصدير
                </button>
                <button onClick={deselectAll} className="text-[10px] text-muted-foreground hover:text-cc-red transition-colors">مسح</button>
              </div>
            </div>

            <div className="relative mb-3">
              <div className="h-3 rounded-full bg-muted/40 overflow-hidden flex">
                {targetDeals.map((d) => (
                  <div key={d.id} className={`h-full transition-all duration-700 ${d.stage === "مكتملة" ? "bg-cc-green" : "bg-muted/60"}`} style={{ width: `${100 / total}%` }} title={`${d.client_name} — ${d.stage}`} />
                ))}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{closed} / {total}</span>
                <span className={`text-xs font-extrabold ${allDone ? "text-cc-green" : rate >= 50 ? "text-amber" : "text-cyan"}`}>{rate}%</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-lg mb-0.5">{allDone ? "🏆" : timeUp ? "⏰" : hoursLeft < 2 ? "😰" : "🎯"}</p>
                <p className="text-xl font-extrabold text-cyan">{total}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">الهدف</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-lg mb-0.5">{closed > 0 ? "✅" : "⭕"}</p>
                <p className="text-xl font-extrabold text-cc-green">{closed}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">مكتمل</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-lg mb-0.5">{remaining === 0 ? "🎉" : remaining <= 2 ? "💪" : "⏳"}</p>
                <p className={`text-xl font-extrabold ${remaining > 0 ? "text-amber" : "text-cc-green"}`}>{remaining}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">متبقي</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-lg mb-0.5">💰</p>
                <p className="text-xl font-extrabold text-cc-purple">{formatMoney(closedValue)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">قيمة المغلقة</p>
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

            {/* Top 3 performers */}
            {(() => {
              const closedDeals = targetDeals.filter((d) => d.stage === "مكتملة" && d.assigned_rep_name);
              if (closedDeals.length === 0) return null;
              const repCount: Record<string, { count: number; value: number }> = {};
              closedDeals.forEach((d) => {
                const name = d.assigned_rep_name!;
                if (!repCount[name]) repCount[name] = { count: 0, value: 0 };
                repCount[name].count++;
                repCount[name].value += d.deal_value;
              });
              const sorted = Object.entries(repCount).sort((a, b) => b[1].count - a[1].count || b[1].value - a[1].value);
              const top3 = sorted.slice(0, 3);
              const medals = ["🥇", "🥈", "🥉"];
              const borderColors = ["border-amber/25", "border-muted-foreground/20", "border-orange-700/20"];
              const bgGrads = ["from-amber/[0.08]", "from-muted-foreground/[0.04]", "from-orange-700/[0.05]"];
              const textColors = ["text-amber", "text-muted-foreground", "text-orange-600"];

              return (
                <div className="mt-3 grid gap-2">
                  {top3.map(([name, stats], i) => (
                    <div key={name} className={`flex items-center gap-3 p-3 rounded-lg bg-gradient-to-l ${bgGrads[i]} to-transparent border ${borderColors[i]}`}>
                      <div className="w-9 h-9 rounded-full bg-card/80 flex items-center justify-center text-lg">{medals[i]}</div>
                      <div className="flex-1">
                        {i === 0 && <p className="text-[10px] text-muted-foreground">الموظف الأكثر إنجازاً اليوم 🔥</p>}
                        <p className={`text-sm font-bold text-foreground`}>{name}</p>
                      </div>
                      <div className="text-left">
                        <p className={`text-xs font-bold ${textColors[i]}`}>{stats.count} صفقة</p>
                        <p className="text-[10px] text-muted-foreground">{stats.value.toLocaleString()} ر.س</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ─── Deals Table ─── */}
      <div id="sales-table" className="cc-card rounded-2xl overflow-x-auto">
        <div className="p-4 pb-0 flex items-center gap-3">
          <Input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="ابحث باسم العميل أو رقم الجوال..."
            className="max-w-xs"
          />
          <button onClick={selectAllVisible} className="text-[10px] px-2.5 py-1.5 rounded-lg border border-cyan/30 text-cyan hover:bg-cyan/10 transition-colors whitespace-nowrap" title="تحديد الكل كهدف يومي">
            <SquareCheck className="w-3 h-3 inline-block ml-1" />تحديد الكل
          </button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">هدف</TableHead>
              <TableHead className="w-20">الكود</TableHead>
              <TableHead>العميل</TableHead>
              <TableHead>رقم الجوال</TableHead>
              <TableHead>المصدر</TableHead>
              <TableHead>الباقة</TableHead>
              <TableHead>المرحلة</TableHead>
              <TableHead>القيمة</TableHead>
              <TableHead>احتمالية</TableHead>
              <TableHead>المسؤول</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>آخر تواصل</TableHead>
              <TableHead>أيام بدون تواصل</TableHead>
              <TableHead>ملاحظات</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Skeleton className="h-7 w-7 rounded-md" />
                      <Skeleton className="h-7 w-7 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground py-8">
                  {stageFilter ? `لا توجد مبيعات في مرحلة "${stageFilter}"` : "لا توجد مبيعات"}
                </TableCell>
              </TableRow>
            ) : (
              filteredDeals.map((deal) => {
                const isTarget = dailyTargetIds.has(deal.id);
                const isTargetDone = isTarget && deal.stage === "مكتملة";
                return (
                <TableRow key={deal.id} className={isTarget ? (isTargetDone ? "bg-cc-green/[0.04]" : "bg-cyan/[0.04]") : ""}>
                  <TableCell className="text-center">
                    <button
                      onClick={() => toggleDailyTarget(deal.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isTargetDone ? "border-cc-green bg-cc-green text-white"
                        : isTarget ? "border-cyan bg-cyan/20 text-cyan"
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
                    {deal.client_code || "—"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {deal.client_name}
                    {isTarget && !isTargetDone && (
                      <span className="mr-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded bg-cyan/10 text-cyan font-medium">هدف اليوم</span>
                    )}
                    {isTargetDone && (
                      <span className="mr-1.5 inline-block text-[9px] px-1.5 py-0.5 rounded bg-cc-green/15 text-cc-green font-medium">تم الإنجاز</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs" dir="ltr">
                    {deal.client_phone ? formatPhone(deal.client_phone) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {deal.source || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{deal.plan || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <ColorBadge
                      text={deal.stage}
                      color={STAGE_BADGE_COLOR[deal.stage] || "blue"}
                    />
                  </TableCell>
                  <TableCell className="font-bold text-cyan text-xs">
                    {formatMoneyFull(deal.deal_value)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatPercent(deal.probability)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {deal.assigned_rep_name || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {deal.deal_date ? formatDate(deal.deal_date) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {deal.last_contact ? formatDate(deal.last_contact) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(() => {
                      const ref = deal.last_contact || deal.deal_date;
                      if (!ref) return "—";
                      const days = Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
                      return (
                        <span className={days > 7 ? "text-cc-red font-medium" : days > 3 ? "text-amber" : "text-cc-green"}>
                          {days} يوم
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate" title={deal.notes || ""}>
                    {deal.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <div className="relative">
                        <FollowUpLogButton entityType="deal" entityId={deal.id} entityName={deal.client_name} />
                        {deal.stage !== "مكتملة" && deal.stage !== "مرفوض مع سبب" && (() => {
                          const daysSince = Math.floor((Date.now() - new Date(deal.updated_at).getTime()) / 86400000);
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
                        onClick={() => setAssignDeal(deal)}
                        title="تعيين لموظف"
                        className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEditModal(deal)}
                        title="تعديل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => confirmDelete(deal.id)}
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ); })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Sales Team Performance ─── */}
      {!loading && repPerformance.length > 0 && (
        <div className="cc-card rounded-2xl overflow-hidden">
          <div className="p-5 pb-0">
            <h3 className="text-sm font-bold text-foreground">أداء فريق المبيعات</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 px-5 text-right font-medium">المندوب</th>
                  <th className="py-3 px-4 text-center font-medium">الصفقات</th>
                  <th className="py-3 px-4 text-center font-medium">مُغلق</th>
                  <th className="py-3 px-4 text-right font-medium">الباقات</th>
                  <th className="py-3 px-4 text-right font-medium min-w-[140px]">معدل الإغلاق</th>
                  <th className="py-3 px-4 text-center font-medium">بالأصلي</th>
                  <th className="py-3 px-4 text-center font-medium">بخصم</th>
                  <th className="py-3 px-4 text-right font-medium min-w-[100px]">نسبة الأصلي</th>
                  <th className="py-3 px-4 text-center font-medium">متوسط الدورة</th>
                  <th className="py-3 px-4 text-right font-medium">إجمالي القيمة</th>
                  <th className="py-3 px-4 text-center font-medium">الترتيب</th>
                </tr>
              </thead>
              <tbody>
                {repPerformance.map((rep, idx) => {
                  const initial = rep.name.charAt(0);
                  const avatarColors = [
                    "bg-cyan/20 text-cyan",
                    "bg-cc-green/20 text-cc-green",
                    "bg-amber/20 text-amber",
                    "bg-cc-purple/20 text-cc-purple",
                    "bg-cc-blue/20 text-cc-blue",
                    "bg-pink/20 text-pink",
                  ];
                  const avatarColor = avatarColors[idx % avatarColors.length];
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "—";
                  const rateColor = rep.winRate >= 30 ? "bg-amber" : rep.winRate > 0 ? "bg-cc-red" : "bg-muted-foreground/30";

                  return (
                    <tr key={rep.name} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-1 ring-white/10 ${avatarColor}`}>
                            {initial}
                          </div>
                          <span className="font-medium text-foreground text-sm">{rep.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-muted-foreground">{rep.deals}</td>
                      <td className="py-3.5 px-4 text-center text-muted-foreground">{rep.closed}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-wrap gap-1 justify-end">
                          {Object.entries(rep.plans).map(([plan, count]) => (
                            <span key={plan} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-muted-foreground">
                              {plan} <span className="text-cyan font-bold">{count}</span>
                            </span>
                          ))}
                          {Object.keys(rep.plans).length === 0 && <span className="text-muted-foreground/50">—</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${rep.winRate >= 30 ? "text-amber" : rep.winRate > 0 ? "text-cc-red" : "text-muted-foreground"}`}>
                            {rep.winRate}%
                          </span>
                          <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${rateColor} transition-all`} style={{ width: `${rep.winRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-emerald-400 font-medium">{rep.fullPrice}</td>
                      <td className="py-3.5 px-4 text-center text-amber-400">{rep.discounted}</td>
                      <td className="py-3.5 px-4">
                        {(rep.fullPrice + rep.discounted) > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${rep.fullPriceRate >= 70 ? "bg-emerald-400" : rep.fullPriceRate >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${rep.fullPriceRate}%` }} />
                            </div>
                            <span className={`text-xs font-bold ${rep.fullPriceRate >= 70 ? "text-emerald-400" : rep.fullPriceRate >= 40 ? "text-amber-400" : "text-red-400"}`}>{rep.fullPriceRate}%</span>
                          </div>
                        ) : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center text-muted-foreground">
                        <span dir="ltr">+{rep.avgCycle}</span> ي
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-cyan">{formatMoney(rep.value)}</td>
                      <td className="py-3.5 px-4 text-center text-lg">{medal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Star Employee + Leaderboard ─── */}
      {!loading && repFilteredDeals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StarEmployeeCard deals={repFilteredDeals} />
          <Leaderboard deals={repFilteredDeals} />
        </div>
      )}

      {/* ─── KPI Sub-tabs Section ─── */}
      <Tabs defaultValue="kpis" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="kpis">مؤشرات المبيعات</TabsTrigger>
          <TabsTrigger value="kpis-full">مؤشرات الأداء KPIs</TabsTrigger>
          <TabsTrigger value="renewals">التجديدات</TabsTrigger>
          <TabsTrigger value="satisfaction">رضا العملاء</TabsTrigger>
        </TabsList>

        {/* Tab 1: Sales KPIs */}
        <TabsContent value="kpis" className="space-y-6">
          {/* 4 KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="معدل الإغلاق"
              value={`${winRate}%`}
              target={`${KPI_TARGETS.win_rate}%`}
              status={getKpiStatus(winRate, KPI_TARGETS.win_rate)}
              icon={<Target className="w-4 h-4" />}
            />
            <KPICard
              label="متوسط دورة البيع"
              value={`${avgCycleDays} يوم`}
              target={`${KPI_TARGETS.avg_cycle_days} يوم`}
              status={getKpiStatus(KPI_TARGETS.avg_cycle_days, avgCycleDays)}
              icon={<Clock className="w-4 h-4" />}
            />
            <KPICard
              label="قيمة الأنبوب"
              value={formatMoney(pipelineValue)}
              target={formatMoney(KPI_TARGETS.pipeline_value)}
              status={getKpiStatus(pipelineValue, KPI_TARGETS.pipeline_value)}
              icon={<BarChart3 className="w-4 h-4" />}
            />
            <KPICard
              label="متوسط قيمة المبيع"
              value={formatMoney(avgDealValue)}
              target={formatMoney(KPI_TARGETS.avg_deal_value)}
              status={getKpiStatus(avgDealValue, KPI_TARGETS.avg_deal_value)}
              icon={<TrendingUp className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales Funnel (Pipeline) */}
            <div className="cc-card rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-5">قمع المبيعات (Sales Pipeline)</h3>
              <div className="space-y-4">
                {funnelData.map((f, i) => {
                  const maxValue = Math.max(...funnelData.map((x) => x.value), 1);
                  const widthPct = Math.max((f.value / maxValue) * 100, 15);
                  const barColors = ["bg-cyan", "bg-amber", "bg-cc-purple", "bg-amber", "bg-cc-green"];
                  const badgeColors = ["bg-cyan", "bg-amber/80", "bg-cc-purple", "bg-amber", "bg-cc-green"];
                  const prevValue = i > 0 ? (funnelData[i - 1]?.value || 0) : 0;
                  const changePct = prevValue > 0 ? Math.round(((f.value - prevValue) / prevValue) * 100) : null;
                  return (
                    <div key={f.stage} className="flex items-center gap-3">
                      {/* Stage label */}
                      <span className="text-xs text-muted-foreground w-20 text-right shrink-0">{f.stage}</span>
                      {/* Change percentage */}
                      {changePct !== null ? (
                        <span className="text-[10px] text-muted-foreground w-10 text-left shrink-0" dir="ltr">
                          {changePct > 0 ? `${changePct}%↑` : `${Math.abs(changePct)}%↓`}
                        </span>
                      ) : (
                        <span className="w-10 shrink-0" />
                      )}
                      {/* Value */}
                      <span className="text-xs text-muted-foreground w-12 text-left shrink-0">{formatMoney(f.value)}</span>
                      {/* Bar with badge */}
                      <div className="flex-1 h-9 bg-muted/15 rounded-lg overflow-visible relative flex items-center">
                        <div
                          className={`h-full rounded-lg ${barColors[i]} transition-all`}
                          style={{ width: `${widthPct}%` }}
                        />
                        {f.count > 0 && (
                          <span className={`mr-2 ${badgeColors[i]} text-white text-[11px] font-bold px-3 py-1 rounded-full shrink-0 whitespace-nowrap`}>
                            {f.count} عميل
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lost Deals Analysis */}
            <div className="cc-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-lg">🔍</span>
                <h3 className="text-sm font-bold text-foreground">تحليل المبيعات الخاسرة</h3>
              </div>
              <div className="space-y-5">
                {(() => {
                  const reasonColors: Record<string, { bar: string; dot: string }> = {
                    "سعر": { bar: "bg-cc-red", dot: "bg-cc-red" },
                    "منافس": { bar: "bg-amber", dot: "bg-amber" },
                    "ميزة ناقصة": { bar: "bg-cc-purple", dot: "bg-cc-purple" },
                    "توقيت": { bar: "bg-cc-blue", dot: "bg-cc-blue" },
                    "أخرى": { bar: "bg-muted-foreground", dot: "bg-muted-foreground" },
                  };
                  const defaultColor = { bar: "bg-cyan", dot: "bg-cyan" };
                  return Object.entries(lostReasons)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([reason, data]) => {
                      const pct = Math.round((data.count / lostDeals.length) * 100);
                      const colors = reasonColors[reason] || defaultColor;
                      return (
                        <div key={reason} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-sm ${colors.dot}`} />
                              <span className="text-xs text-muted-foreground">{reason}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-cc-red text-xs font-bold">{data.count} مبيع</span>
                              <span className="text-muted-foreground text-xs">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-2.5 bg-muted/20 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colors.bar} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
              <div className="mt-5 pt-4 border-t border-border space-y-3">
                <p className="text-xs text-muted-foreground">آخر المبيعات الخاسرة</p>
                {lostDeals.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 text-center py-2">لا توجد صفقات خاسرة</p>
                ) : (
                  lostDeals.slice(0, 3).map((d) => (
                    <div key={d.id} className="flex items-center justify-between bg-white/[0.02] rounded-[14px] p-3 border border-cc-red/10">
                      <div>
                        <p className="text-xs font-bold text-foreground">{d.client_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{d.notes || d.loss_reason || ""}</p>
                        {d.loss_reason && (
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-cc-red/10 text-cc-red">{d.loss_reason}</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-cc-red whitespace-nowrap">{formatMoney(d.deal_value)}-</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Source ROI */}
          <div className="cc-card rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">أداء المصادر</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 text-right font-medium">المصدر</th>
                    <th className="py-2 text-right font-medium">الصفقات</th>
                    <th className="py-2 text-right font-medium">القيمة</th>
                    <th className="py-2 text-right font-medium">فاز</th>
                    <th className="py-2 text-right font-medium">معدل الإغلاق</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceData.map((s) => (
                    <tr key={s.source} className="border-b border-border/50">
                      <td className="py-2.5 font-medium text-foreground">
                        <span className={`inline-block w-2 h-2 rounded-full bg-${SOURCE_COLORS[s.source] || "cyan"} ml-2`} />
                        {s.source}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{s.count}</td>
                      <td className="py-2.5 text-cyan font-medium">{formatMoney(s.value)}</td>
                      <td className="py-2.5 text-cc-green font-medium">{s.won}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-cyan" style={{ width: `${s.winRate}%` }} />
                          </div>
                          <span className="text-muted-foreground">{s.winRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Full KPIs Dashboard */}
        <TabsContent value="kpis-full" className="space-y-6">
          <SalesKPIsView deals={monthDeals} lostDeals={lostDeals} />
        </TabsContent>

        {/* Tab 2: Renewals link */}
        <TabsContent value="renewals" className="space-y-6">
          <div className="cc-card rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-dim mx-auto flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-cyan" />
            </div>
            <h3 className="text-lg font-bold text-foreground">التجديدات</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              تابع تجديد العملاء ومعدلات الاحتفاظ وأسباب عدم التجديد من صفحة التجديدات المخصصة
            </p>
            <Link href="/renewals">
              <Button className="gap-2 mt-2">
                الذهاب إلى التجديدات
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </TabsContent>

        {/* Tab 3: Satisfaction link */}
        <TabsContent value="satisfaction" className="space-y-6">
          <div className="cc-card rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-green-dim mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8 text-cc-green" />
            </div>
            <h3 className="text-lg font-bold text-foreground">رضا العملاء</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              قياس رضا العملاء عبر CSAT وNPS وآرائهم التفصيلية من صفحة رضا العملاء المخصصة
            </p>
            <Link href="/satisfaction">
              <Button className="gap-2 mt-2">
                الذهاب إلى رضا العملاء
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Add / Edit Deal Modal ─── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل مبيع" : "إضافة مبيع جديد"}</DialogTitle>
            <DialogDescription>
              {editingId ? "قم بتحديث بيانات المبيع" : "أدخل بيانات المبيع الجديد"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Client name */}
            <div className="grid gap-1.5">
              <Label htmlFor="client_name">اسم العميل</Label>
              <Input
                id="client_name"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="أدخل اسم العميل"
              />
            </div>

            {/* Phone + Value row */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="client_phone">رقم الجوال</Label>
                <Input
                  id="client_phone"
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deal_value">القيمة (ر.س)</Label>
                <Input
                  id="deal_value"
                  type="number"
                  value={form.deal_value || ""}
                  onChange={(e) =>
                    setForm({ ...form, deal_value: Number(e.target.value) || 0 })
                  }
                  placeholder="0"
                  dir="ltr"
                  className="text-right"
                />
              </div>
            </div>

            {/* Rep + Date row */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="assigned_rep_name">المسؤول</Label>
                <Select
                  value={form.assigned_rep_name}
                  onValueChange={(val) => val && setForm({ ...form, assigned_rep_name: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر المسؤول" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter((e) => e.status === "نشط" || e.status === "مشغول" || e.status === "متاح").map((e) => (
                      <SelectItem key={e.id} value={e.name}>
                        {e.name}{e.role ? ` — ${e.role}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deal_date">التاريخ</Label>
                <Input
                  id="deal_date"
                  type="date"
                  value={form.deal_date}
                  onChange={(e) => setForm({ ...form, deal_date: e.target.value })}
                  dir="ltr"
                  className="text-right"
                />
              </div>
            </div>

            {/* Last contact */}
            <div className="grid gap-1.5">
              <Label htmlFor="last_contact">آخر تواصل</Label>
              <Input
                id="last_contact"
                type="date"
                value={form.last_contact}
                onChange={(e) => setForm({ ...form, last_contact: e.target.value })}
                dir="ltr"
                className="text-right"
              />
            </div>

            {/* Source (radio buttons) */}
            <div className="grid gap-1.5">
              <Label>المصدر</Label>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((src) => (
                  <label
                    key={src}
                    className={`flex items-center gap-1.5 cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      form.source === src
                        ? "border-cyan bg-cyan-dim text-cyan"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={src}
                      checked={form.source === src}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className="sr-only"
                    />
                    {src}
                  </label>
                ))}
              </div>
            </div>

            {/* Marketer (shown only when source is تسويق بالعمولة) */}
            {form.source === "تسويق بالعمولة" && (
              <div className="grid gap-1.5">
                <Label>المسوّق</Label>
                <Select
                  value={form.marketer_name}
                  onValueChange={(val) => val && setForm({ ...form, marketer_name: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر المسوّق" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketers.filter((m) => m.is_active).map((m) => (
                      <SelectItem key={m.id} value={m.name}>
                        {m.name} ({m.commission_rate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {marketers.filter((m) => m.is_active).length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    لا يوجد مسوقين. أضف مسوقين من صفحة المسوقين أولاً.
                  </p>
                )}
              </div>
            )}

            {/* Stage (dropdown) */}
            <div className="grid gap-1.5">
              <Label>المرحلة</Label>
              <Select value={form.stage} onValueChange={(val) => val && setForm({ ...form, stage: val })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المرحلة" />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((stg) => (
                    <SelectItem key={stg} value={stg}>
                      {stg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plan (dropdown) */}
            <div className="grid gap-1.5">
              <Label>الباقة</Label>
              <Select value={form.plan} onValueChange={(val) => val && setForm({ ...form, plan: val })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الباقة" />
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

            {/* Notes */}
            <div className="grid gap-1.5">
              <Label htmlFor="notes">الملاحظات</Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="أضف ملاحظات..."
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* Probability slider */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="probability">احتمالية الإغلاق</Label>
                <span className="text-xs font-bold text-cyan">{form.probability}%</span>
              </div>
              <input
                id="probability"
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.probability}
                onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-cyan [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المبيع"}
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
              هل أنت متأكد من حذف هذا المبيع؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              حذف المبيع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Task Modal */}
      {assignDeal && (
        <AssignTaskModal
          open={!!assignDeal}
          onClose={() => setAssignDeal(null)}
          clientName={assignDeal.client_name}
          clientPhone={assignDeal.client_phone}
          entityType="deal"
          entityId={assignDeal.id}
          defaultTitle={`متابعة ${assignDeal.client_name} — ${assignDeal.stage}`}
        />
      )}
    </div>
  );
}

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
