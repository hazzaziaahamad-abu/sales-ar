"use client";

import { useState, useEffect, useMemo } from "react";
import type { Renewal } from "@/types";
import {
  fetchRenewals,
  createRenewal,
  updateRenewal,
  deleteRenewal,
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
} from "lucide-react";

/* ─── Status badge color mapping ─── */
const STATUS_BADGE: Record<string, { text: string; color: string; bg: string }> = {
  "مجدول": { text: "مجدول", color: "text-cc-blue", bg: "bg-blue-dim" },
  "جاري المتابعة": { text: "جاري المتابعة", color: "text-amber", bg: "bg-amber-dim" },
  "انتظار الدفع": { text: "انتظار الدفع", color: "text-cc-purple", bg: "bg-purple-dim" },
  "مكتمل": { text: "مكتمل", color: "text-cc-green", bg: "bg-green-dim" },
  "ملغي بسبب": { text: "ملغي بسبب", color: "text-cc-red", bg: "bg-red-dim" },
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
  const { activeOrgId: orgId } = useAuth();
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

  /* month filter */
  const { activeMonthIndex, filterCutoff } = useTopbarControls();
  const monthRenewals = filterCutoff
    ? renewals.filter((r) => new Date(r.renewal_date) >= filterCutoff)
    : activeMonthIndex
      ? renewals.filter((r) => {
          const d = new Date(r.renewal_date);
          return d.getMonth() + 1 === activeMonthIndex.month && d.getFullYear() === activeMonthIndex.year;
        })
      : renewals;

  /* card filter */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const PENDING_STATUSES = new Set(["مجدول", "جاري المتابعة", "انتظار الدفع"]);
  const filteredRenewals = statusFilter
    ? statusFilter === "pending"
      ? monthRenewals.filter((r) => PENDING_STATUSES.has(r.status))
      : monthRenewals.filter((r) => r.status === statusFilter)
    : monthRenewals;

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
        const updated = await updateRenewal(editingId, payload);
        setRenewals((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
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

      {/* ─── Renewals Table ─── */}
      <div className="cc-card rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
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
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredRenewals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {statusFilter ? "لا توجد تجديدات مطابقة" : "لا توجد تجديدات بعد. اضغط \"إضافة تجديد\" لإضافة أول تجديد."}
                </TableCell>
              </TableRow>
            ) : (
              filteredRenewals.map((renewal) => {
                const days = getDaysRemaining(renewal.renewal_date);
                const daysStyle = getDaysRemainingStyle(days);
                const badge = STATUS_BADGE[renewal.status] || STATUS_BADGE["مجدول"];

                return (
                  <TableRow key={renewal.id}>
                    <TableCell className="font-medium text-foreground">
                      {renewal.customer_name}
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
