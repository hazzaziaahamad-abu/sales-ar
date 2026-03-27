"use client";

import { useState, useEffect, useMemo } from "react";
import type { Renewal } from "@/types";
import {
  fetchRenewals,
  createRenewal,
  updateRenewal,
  deleteRenewal,
  createFollowUpNote,
} from "@/lib/supabase/db";
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
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  /* modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* delete confirmation */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  function buildDailyReport() {
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

    let report = `📋 تقرير الهدف اليومي — التجديدات\n`;
    report += `📅 ${todayStr}\n`;
    report += `${"─".repeat(35)}\n\n`;
    report += `🎯 الهدف: ${total} عميل\n`;
    report += `✅ مكتمل: ${completed.length}\n`;
    report += `⏳ متبقي: ${remaining.length}\n`;
    report += `📊 نسبة الإنجاز: ${rate}%\n\n`;

    if (completed.length > 0) {
      report += `── ✅ المكتملة ──\n`;
      completed.forEach((r, i) => {
        report += `${i + 1}. ${r.customer_name} — ${r.plan_name} — ${r.plan_price} ر.س\n`;
      });
      report += `\n`;
    }

    if (remaining.length > 0) {
      report += `── ⏳ المتبقية ──\n`;
      remaining.forEach((r, i) => {
        report += `${i + 1}. ${r.customer_name} — ${r.plan_name} — ${r.status} — ${r.plan_price} ر.س\n`;
      });
    }

    return report;
  }

  function exportReport() {
    const report = buildDailyReport();
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `تقرير-الهدف-اليومي-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareReport() {
    const report = buildDailyReport();
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
  const monthRenewals = filterCutoff
    ? renewals.filter((r) => new Date(r.renewal_date) >= filterCutoff)
    : activeMonthIndex
      ? renewals.filter((r) => {
          const rd = new Date(r.renewal_date);
          return rd.getMonth() + 1 === activeMonthIndex.month;
        })
      : renewals;

  /* card filter */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const PENDING_STATUSES = new Set(["مجدول", "جاري المتابعة", "انتظار الدفع"]);
  const statusFilteredRenewals = statusFilter
    ? statusFilter === "pending"
      ? monthRenewals.filter((r) => PENDING_STATUSES.has(r.status))
      : monthRenewals.filter((r) => r.status === statusFilter)
    : monthRenewals;
  const filteredRenewals = clientSearch
    ? statusFilteredRenewals.filter((r) => r.customer_name.toLowerCase().includes(clientSearch.toLowerCase()))
    : statusFilteredRenewals;

  useEffect(() => {
    setLoading(true);
    fetchRenewals()
      .then(setRenewals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* ─── Computed analytics ─── */
  const analytics = useMemo(() => {
    const total = monthRenewals.length;
    const renewed = monthRenewals.filter((r) => r.status === "مكتمل").length;
    const cancelled = monthRenewals.filter((r) => r.status === "ملغي بسبب").length;
    const scheduled = monthRenewals.filter((r) => r.status === "مجدول").length;
    const following = monthRenewals.filter((r) => r.status === "جاري المتابعة").length;
    const waiting = monthRenewals.filter((r) => r.status === "انتظار الدفع").length;
    const renewalRate = total > 0 ? Math.round((renewed / total) * 100) : 0;
    const churnRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const revenueLoss = monthRenewals
      .filter((r) => r.status === "ملغي بسبب")
      .reduce((sum, r) => sum + r.plan_price, 0);
    const totalRevenue = monthRenewals
      .filter((r) => r.status === "مكتمل")
      .reduce((sum, r) => sum + r.plan_price, 0);

    // Cancellation reasons breakdown
    const cancelReasons = monthRenewals
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
  }, [renewals, monthRenewals]);

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
          </div>
        </div>
        <Button onClick={openAddModal} className="gap-1.5">
          <Plus className="w-4 h-4" />
          إضافة تجديد
        </Button>
      </div>

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
          <div className="cc-card rounded-xl p-5">
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

        const motivationMsg = allDone
          ? "ممتاز! أنجزت كل أهداف اليوم"
          : rate >= 80
          ? "أنت قريب جداً من الإنجاز!"
          : rate >= 50
          ? `باقي ${remaining} فقط، استمر!`
          : rate > 0
          ? "بداية جيدة، واصل التقدم"
          : `${total} عميل بانتظارك، ابدأ الآن!`;

        const borderColor = allDone ? "border-cc-green/30" : "border-cyan/20";
        const bgGrad = allDone
          ? "bg-gradient-to-l from-cc-green/[0.06] to-transparent"
          : "bg-gradient-to-l from-cyan/[0.04] to-transparent";

        return (
          <div className={`cc-card rounded-xl p-4 border ${borderColor} ${bgGrad} transition-all duration-500`}>
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

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-xl font-extrabold text-cyan">{total}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">الهدف</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className="text-xl font-extrabold text-cc-green">{completed}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">مكتمل</p>
              </div>
              <div className="text-center p-2.5 rounded-lg bg-card/50 border border-border/30">
                <p className={`text-xl font-extrabold ${remaining > 0 ? "text-amber" : "text-cc-green"}`}>{remaining}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">متبقي</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Renewals Table ─── */}
      <div className="cc-card rounded-xl overflow-x-auto">
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
              <TableHead>العميل</TableHead>
              <TableHead>الجوال</TableHead>
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
                    <TableCell className="text-muted-foreground text-xs font-mono" dir="ltr">
                      {renewal.customer_phone ? formatPhone(renewal.customer_phone) : "—"}
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
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-medium ${badge.bg} ${badge.color}`}>
                        {badge.text}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {renewal.assigned_rep || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <FollowUpLogButton entityType="renewal" entityId={renewal.id} entityName={renewal.customer_name} />
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
          <div className="cc-card rounded-xl p-5">
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
              <div className="cc-card rounded-xl p-4 text-center">
                <p className="text-2xl font-extrabold text-cc-green">
                  {formatMoneyFull(analytics.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">إيرادات التجديد</p>
              </div>
              <div className="cc-card rounded-xl p-4 text-center">
                <p className="text-2xl font-extrabold text-cc-red">
                  {formatMoneyFull(analytics.revenueLoss)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">خسارة الإلغاء</p>
              </div>
            </div>

            {/* Rejection reasons */}
            <div className="cc-card rounded-xl p-5">
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
        <div className="cc-card rounded-xl p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-foreground">اتجاه التجديد والإلغاء</h3>
            <p className="text-xs text-muted-foreground mt-1">
              آخر 6 أشهر — نسبة التجديد (أخضر) مقابل نسبة الإلغاء (أحمر)
            </p>
          </div>
          <LineChart data={analytics.monthlyTrend} showArea height={200} />
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
                <Label htmlFor="assigned_rep">المسؤول</Label>
                <Input
                  id="assigned_rep"
                  value={form.assigned_rep}
                  onChange={(e) => setForm({ ...form, assigned_rep: e.target.value })}
                  placeholder="اسم المسؤول"
                />
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
    <div className={`cc-card rounded-xl p-5 ${styles.bg}`}>
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
    <div className="cc-card rounded-xl p-4 border-t-2 border-t-muted">
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
