"use client";

import { useState, useEffect } from "react";
import type { Deal, Marketer } from "@/types";
import {
  fetchMarketers,
  createMarketer,
  updateMarketer,
  deleteMarketer,
  fetchDeals,
} from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { formatMoney } from "@/lib/utils/format";

import { StatCard } from "@/components/ui/stat-card";
import { ColorBadge } from "@/components/ui/color-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  DollarSign,
  TrendingUp,
  Percent,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Form state                                                         */
/* ------------------------------------------------------------------ */
interface MarketerForm {
  name: string;
  phone: string;
  commission_rate: number;
  notes: string;
}

const EMPTY_FORM: MarketerForm = {
  name: "",
  phone: "",
  commission_rate: 0,
  notes: "",
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */
export default function MarketersPage() {
  const { activeOrgId: orgId } = useAuth();
  const { activeMonthIndex } = useTopbarControls();
  const [marketers, setMarketers] = useState<Marketer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MarketerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Selected marketer for detail view
  const [selectedMarketer, setSelectedMarketer] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchMarketers().then(setMarketers),
      fetchDeals().then(setDeals),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* ---------- month filtered commission deals ---------- */
  const commissionDeals = deals.filter((d) => d.source === "تسويق بالعمولة" && d.marketer_name);
  const monthFilteredDeals = activeMonthIndex
    ? commissionDeals.filter(
        (d) => d.month === activeMonthIndex.month && d.year === activeMonthIndex.year
      )
    : commissionDeals;

  /* ---------- per-marketer stats ---------- */
  function getMarketerStats(marketerName: string) {
    const mDeals = monthFilteredDeals.filter((d) => d.marketer_name === marketerName);
    const marketer = marketers.find((m) => m.name === marketerName);
    const rate = marketer?.commission_rate || 0;
    const totalValue = mDeals.reduce((s, d) => s + d.deal_value, 0);
    const closedDeals = mDeals.filter((d) => d.stage === "مكتملة");
    const closedValue = closedDeals.reduce((s, d) => s + d.deal_value, 0);
    const commission = Math.round(closedValue * (rate / 100));
    return {
      totalDeals: mDeals.length,
      closedDeals: closedDeals.length,
      totalValue,
      closedValue,
      commission,
      rate,
    };
  }

  /* ---------- totals ---------- */
  const totalCommission = marketers.reduce((s, m) => {
    return s + getMarketerStats(m.name).commission;
  }, 0);
  const totalClosedValue = marketers.reduce((s, m) => {
    return s + getMarketerStats(m.name).closedValue;
  }, 0);
  const activeMarketersCount = marketers.filter((m) => m.is_active).length;

  /* ---------- selected marketer deals ---------- */
  const selectedDeals = selectedMarketer
    ? monthFilteredDeals.filter((d) => d.marketer_name === selectedMarketer)
    : [];

  /* ---------- handlers ---------- */
  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(marketer: Marketer) {
    setEditingId(marketer.id);
    setForm({
      name: marketer.name,
      phone: marketer.phone || "",
      commission_rate: marketer.commission_rate,
      notes: marketer.notes || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateMarketer(editingId, {
          name: form.name,
          phone: form.phone || undefined,
          commission_rate: form.commission_rate,
          notes: form.notes || undefined,
        });
        setMarketers((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
      } else {
        const created = await createMarketer({
          name: form.name,
          phone: form.phone || undefined,
          commission_rate: form.commission_rate,
          is_active: true,
          notes: form.notes || undefined,
        });
        setMarketers((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (deletingId) {
      try {
        await deleteMarketer(deletingId);
        setMarketers((prev) => prev.filter((m) => m.id !== deletingId));
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  }

  async function toggleActive(marketer: Marketer) {
    try {
      const updated = await updateMarketer(marketer.id, {
        is_active: !marketer.is_active,
      });
      setMarketers((prev) => prev.map((m) => (m.id === marketer.id ? updated : m)));
    } catch (err) {
      console.error(err);
    }
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="space-y-6">
      {/* -------- Header -------- */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">المسوقين بالعمولة</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4" data-icon="inline-start" />
          إضافة مسوّق
        </Button>
      </div>

      {/* -------- Summary Cards -------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              value={String(activeMarketersCount)}
              label="مسوقين نشطين"
              color="blue"
              icon={<Users className="w-4 h-4 text-cc-blue" />}
            />
            <StatCard
              value={formatMoney(totalClosedValue)}
              label="إجمالي المبيعات"
              color="green"
              icon={<TrendingUp className="w-4 h-4 text-cc-green" />}
            />
            <StatCard
              value={formatMoney(totalCommission)}
              label="إجمالي العمولات"
              color="purple"
              icon={<DollarSign className="w-4 h-4 text-cc-purple" />}
            />
            <StatCard
              value={
                totalClosedValue > 0
                  ? `${Math.round((totalCommission / totalClosedValue) * 100)}%`
                  : "0%"
              }
              label="متوسط نسبة العمولة"
              color="amber"
              icon={<Percent className="w-4 h-4 text-amber" />}
            />
          </>
        )}
      </div>

      {/* -------- Marketers Table -------- */}
      <div className="cc-card rounded-xl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">المسوّق</TableHead>
              <TableHead className="text-right">الجوال</TableHead>
              <TableHead className="text-right">نسبة العمولة</TableHead>
              <TableHead className="text-right">الصفقات</TableHead>
              <TableHead className="text-right">المبيعات المغلقة</TableHead>
              <TableHead className="text-right">العمولة المستحقة</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j} className="text-right">
                      <Skeleton className="mr-auto h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : marketers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  لا يوجد مسوقين. أضف مسوّق جديد للبدء.
                </TableCell>
              </TableRow>
            ) : (
              marketers.map((marketer) => {
                const stats = getMarketerStats(marketer.name);
                return (
                  <TableRow
                    key={marketer.id}
                    className={`cursor-pointer transition-colors ${
                      selectedMarketer === marketer.name
                        ? "bg-cyan/[0.06]"
                        : "hover:bg-muted/30"
                    }`}
                    onClick={() =>
                      setSelectedMarketer(
                        selectedMarketer === marketer.name ? null : marketer.name
                      )
                    }
                  >
                    <TableCell className="text-right text-xs font-medium">
                      {marketer.name}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground" dir="ltr">
                      {marketer.phone || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-cyan">
                      {marketer.commission_rate}%
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <span className="text-muted-foreground">{stats.totalDeals}</span>
                      {stats.closedDeals > 0 && (
                        <span className="text-cc-green mr-1">({stats.closedDeals} مغلقة)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium text-cc-green">
                      {formatMoney(stats.closedValue)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-bold text-cc-purple">
                      {formatMoney(stats.commission)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(marketer);
                        }}
                      >
                        <ColorBadge
                          text={marketer.is_active ? "نشط" : "متوقف"}
                          color={marketer.is_active ? "green" : "red"}
                        />
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => openEditDialog(marketer)}
                          title="تعديل"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-xs"
                          onClick={() => confirmDelete(marketer.id)}
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

      {/* -------- Selected Marketer Deals Detail -------- */}
      {selectedMarketer && selectedDeals.length > 0 && (
        <div className="cc-card rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">
              صفقات {selectedMarketer}
            </h2>
            <span className="text-xs text-muted-foreground">
              {selectedDeals.length} صفقة
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">القيمة</TableHead>
                  <TableHead className="text-right">المرحلة</TableHead>
                  <TableHead className="text-right">العمولة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDeals.map((deal) => {
                  const marketer = marketers.find((m) => m.name === selectedMarketer);
                  const rate = marketer?.commission_rate || 0;
                  const dealCommission =
                    deal.stage === "مكتملة"
                      ? Math.round(deal.deal_value * (rate / 100))
                      : 0;
                  return (
                    <TableRow key={deal.id}>
                      <TableCell className="text-right text-xs font-medium">
                        {deal.client_name}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatMoney(deal.deal_value)}
                      </TableCell>
                      <TableCell className="text-right">
                        <ColorBadge
                          text={deal.stage}
                          color={
                            deal.stage === "مكتملة"
                              ? "green"
                              : deal.stage === "تفاوض"
                              ? "purple"
                              : deal.stage === "انتظار الدفع"
                              ? "amber"
                              : "blue"
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold">
                        {deal.stage === "مكتملة" ? (
                          <span className="text-cc-purple">{formatMoney(dealCommission)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* -------- Commission Breakdown per Marketer -------- */}
      {!loading && marketers.length > 0 && (
        <div className="cc-card rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-foreground">ملخص العمولات</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {marketers
              .map((m) => ({ ...m, stats: getMarketerStats(m.name) }))
              .filter((m) => m.stats.totalDeals > 0 || m.is_active)
              .sort((a, b) => b.stats.commission - a.stats.commission)
              .map((m) => {
                const maxCommission = Math.max(
                  ...marketers.map((mk) => getMarketerStats(mk.name).commission),
                  1
                );
                const barWidth = Math.round((m.stats.commission / maxCommission) * 100);
                return (
                  <div
                    key={m.id}
                    className="relative overflow-hidden rounded-lg border border-border/50 bg-card/30 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{m.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cc-purple/15 text-cc-purple font-bold">
                        {m.commission_rate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {m.stats.closedDeals} صفقة مغلقة
                      </span>
                      <span className="font-bold text-cc-purple">
                        {formatMoney(m.stats.commission)}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-l from-cc-purple to-cc-purple/60 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>مبيعات: {formatMoney(m.stats.closedValue)}</span>
                      <span>{m.stats.totalDeals} صفقة</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* -------- Create / Edit Dialog -------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "تعديل مسوّق" : "إضافة مسوّق جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "قم بتعديل بيانات المسوّق ثم اضغط حفظ."
                : "أدخل بيانات المسوّق الجديد."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-2">
            {/* اسم المسوق */}
            <div className="space-y-1.5">
              <Label htmlFor="marketer_name">اسم المسوّق</Label>
              <Input
                id="marketer_name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="اسم المسوّق"
              />
            </div>

            {/* الجوال + النسبة */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="marketer_phone">رقم الجوال</Label>
                <Input
                  id="marketer_phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="commission_rate">نسبة العمولة (%)</Label>
                <Input
                  id="commission_rate"
                  type="number"
                  min={0}
                  max={100}
                  value={form.commission_rate || ""}
                  onChange={(e) =>
                    setForm({ ...form, commission_rate: Number(e.target.value) || 0 })
                  }
                  placeholder="0"
                  dir="ltr"
                />
              </div>
            </div>

            {/* ملاحظات */}
            <div className="space-y-1.5">
              <Label htmlFor="marketer_notes">ملاحظات</Label>
              <Input
                id="marketer_notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ملاحظات إضافية (اختياري)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المسوّق"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- Delete Confirmation Dialog -------- */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا المسوّق؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="cc-card rounded-xl p-4 border-t-2 border-t-muted">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>
    </div>
  );
}
