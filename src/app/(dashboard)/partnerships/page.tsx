"use client";

import { useState, useEffect } from "react";
import {
  fetchPartnerships, createPartnership, updatePartnership, deletePartnership,
} from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { PARTNERSHIP_TYPES, PARTNERSHIP_STATUSES } from "@/lib/utils/constants";
import { formatMoney } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/stat-card";
import { ColorBadge } from "@/components/ui/color-badge";
import { DonutChart } from "@/components/ui/donut-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Partnership } from "@/types";
import {
  Handshake,
  Plus,
  Activity,
  Clock,
  DollarSign,
  Trash2,
} from "lucide-react";

/* ---------- helpers ---------- */

const TYPE_COLOR: Record<string, "cyan" | "purple" | "amber" | "green"> = {
  "استراتيجية": "cyan",
  "تقنية": "purple",
  "تجارية": "amber",
  "تسويقية": "green",
};

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "blue"> = {
  "شراكة نشطة": "green",
  "قيد التفاوض": "amber",
  "شراكة مؤجلة": "red",
  "شراكة مُوقفة": "blue",
};

const TYPE_CHART_COLORS: Record<string, string> = {
  "استراتيجية": "#8B5CF6",
  "تقنية": "#00D4FF",
  "تجارية": "#EC4899",
  "تسويقية": "#F59E0B",
};

/* ---------- page ---------- */

export default function PartnershipsPage() {
  const { activeOrgId: orgId } = useAuth();
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartnership, setEditingPartnership] = useState<Partnership | null>(null);
  const [saving, setSaving] = useState(false);

  /* delete confirmation */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* form state */
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("استراتيجية");
  const [formStatus, setFormStatus] = useState<string>("شراكة نشطة");
  const [formValue, setFormValue] = useState("");
  const [formManager, setFormManager] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchPartnerships()
      .then(setPartnerships)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* card filter */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const statusFilteredPartnerships = statusFilter
    ? partnerships.filter((p) => p.status === statusFilter)
    : partnerships;
  const filteredPartnerships = clientSearch
    ? statusFilteredPartnerships.filter((p) => p.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : statusFilteredPartnerships;

  /* KPIs */
  const totalPartnerships = partnerships.length;
  const activePartnerships = partnerships.filter((p) => p.status === "شراكة نشطة").length;
  const negotiatingPartnerships = partnerships.filter((p) => p.status === "قيد التفاوض").length;
  const totalValue = partnerships.reduce((sum, p) => sum + p.value, 0);

  /* donut segments: types distribution by count */
  const typeCounts = partnerships.reduce((acc, p) => {
    const t = p.type || "أخرى";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const donutSegments = Object.entries(typeCounts).map(([label, value]) => ({
    label,
    value,
    color: TYPE_CHART_COLORS[label] || "#64748b",
  }));

  /* top partnerships by value - sorted descending */
  const topPartnerships = [...partnerships]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const maxPartnershipValue = topPartnerships.length > 0
    ? Math.max(...topPartnerships.map((p) => p.value))
    : 1;

  const openAddModal = () => {
    setEditingPartnership(null);
    setFormName("");
    setFormType("استراتيجية");
    setFormStatus("شراكة نشطة");
    setFormValue("");
    setFormManager("");
    setFormDescription("");
    setModalOpen(true);
  };

  const openEditModal = (p: Partnership) => {
    setEditingPartnership(p);
    setFormName(p.name);
    setFormType(p.type || "استراتيجية");
    setFormStatus(p.status || "شراكة نشطة");
    setFormValue(String(p.value));
    setFormManager(p.manager_name || "");
    setFormDescription(p.description || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingPartnership) {
        const updated = await updatePartnership(editingPartnership.id, {
          name: formName,
          type: formType,
          status: formStatus,
          value: parseInt(formValue) || 0,
          manager_name: formManager,
          description: formDescription,
        });
        setPartnerships((prev) =>
          prev.map((p) => (p.id === editingPartnership.id ? updated : p))
        );
      } else {
        const created = await createPartnership({
          name: formName,
          type: formType,
          status: formStatus,
          value: parseInt(formValue) || 0,
          manager_name: formManager,
          description: formDescription,
        });
        setPartnerships((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  function confirmDelete(id: string) {
    setDeleteId(id);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (deleteId) {
      try {
        await deletePartnership(deleteId);
        setPartnerships((prev) => prev.filter((p) => p.id !== deleteId));
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-dim flex items-center justify-center">
            <Handshake className="w-4 h-4 text-cc-green" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">الشراكات</h1>
            <p className="text-xs text-muted-foreground">
              إدارة ومتابعة الشراكات الاستراتيجية
            </p>
          </div>
        </div>
        <Button onClick={openAddModal} className="gap-1.5">
          <Plus className="w-4 h-4" />
          شراكة جديدة
        </Button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <PartnershipStatSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              value={String(totalPartnerships)}
              label="إجمالي الشراكات"
              color="cyan"
              icon={<Handshake className="w-4 h-4 text-cyan" />}
              onClick={() => setStatusFilter(null)}
              active={statusFilter === null}
            />
            <StatCard
              value={String(activePartnerships)}
              label="شراكات نشطة"
              color="green"
              icon={<Activity className="w-4 h-4 text-cc-green" />}
              onClick={() => setStatusFilter(statusFilter === "شراكة نشطة" ? null : "شراكة نشطة")}
              active={statusFilter === "شراكة نشطة"}
            />
            <StatCard
              value={String(negotiatingPartnerships)}
              label="قيد التفاوض"
              color="amber"
              icon={<Clock className="w-4 h-4 text-amber" />}
              onClick={() => setStatusFilter(statusFilter === "قيد التفاوض" ? null : "قيد التفاوض")}
              active={statusFilter === "قيد التفاوض"}
            />
            <StatCard
              value={formatMoney(totalValue)}
              label="القيمة الإجمالية"
              color="purple"
              icon={<DollarSign className="w-4 h-4 text-cc-purple" />}
            />
          </>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="cc-card rounded-xl p-5">
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="mx-auto h-40 w-40 rounded-full" />
            </div>
            <div className="cc-card rounded-xl p-5 space-y-3">
              <Skeleton className="h-4 w-36" />
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
          <div className="cc-card rounded-xl p-5 space-y-3">
            <Skeleton className="h-4 w-28 mb-4" />
            {Array.from({ length: 5 }).map((_, index) => (
              <PartnershipCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : (
        /* Two-column layout: charts LEFT, cards RIGHT */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* LEFT column: charts */}
          <div className="space-y-4">
            {/* Donut chart - types distribution */}
            <div className="cc-card rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">
                توزيع أنواع الشراكات
              </h3>
              <DonutChart
                segments={donutSegments}
                centerValue={String(totalPartnerships)}
                centerLabel="شراكة"
              />
            </div>

            {/* Horizontal bar chart - top partnerships by value */}
            <div className="cc-card rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">
                أعلى الشراكات قيمة
              </h3>
              <div className="space-y-3">
                {topPartnerships.map((p) => {
                  const pct = (p.value / maxPartnershipValue) * 100;
                  return (
                    <div key={p.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-foreground font-medium truncate">
                          {p.name}
                        </span>
                        <span className="text-muted-foreground shrink-0 mr-2">
                          {formatMoney(p.value)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cyan transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {topPartnerships.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد شراكات</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT column: partnership cards list */}
          <div className="cc-card rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">
              قائمة الشراكات
            </h3>
            <div className="mb-4">
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="ابحث باسم الشريك..."
                className="max-w-xs"
              />
            </div>
            <div className="space-y-3">
              {filteredPartnerships.map((p) => {
                const initial = p.name.charAt(0);
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-lg border border-border bg-background/50 space-y-2.5 cursor-pointer hover:border-cyan/40 transition-colors"
                    onClick={() => openEditModal(p)}
                  >
                    {/* Top row: avatar + name + badges */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-cyan-dim border border-cyan/30 flex items-center justify-center text-cyan font-bold text-sm shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {p.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <ColorBadge
                            text={p.type || ""}
                            color={TYPE_COLOR[p.type || ""] || "blue"}
                          />
                          <ColorBadge
                            text={p.status || ""}
                            color={STATUS_COLOR[p.status || ""] || "blue"}
                          />
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={(e) => { e.stopPropagation(); confirmDelete(p.id); }}
                        title="حذف"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Details */}
                    <div className="flex items-center justify-between text-xs pr-12">
                      <span className="text-muted-foreground">
                        القيمة: <span className="text-cyan font-bold">{formatMoney(p.value)}</span>
                      </span>
                      <span className="text-muted-foreground">
                        المدير: <span className="text-foreground">{p.manager_name}</span>
                      </span>
                    </div>

                    {p.description && (
                      <p className="text-[11px] text-muted-foreground pr-12 leading-relaxed">
                        {p.description}
                      </p>
                    )}
                  </div>
                );
              })}
              {partnerships.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">لا توجد شراكات</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذه الشراكة؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              حذف الشراكة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPartnership ? "تعديل الشراكة" : "إضافة شراكة جديدة"}
            </DialogTitle>
            <DialogDescription>
              {editingPartnership ? "قم بتحديث بيانات الشراكة" : "أدخل بيانات الشراكة الجديدة"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>اسم الشريك</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="اسم الشركة الشريكة"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>النوع</Label>
                <Select value={formType} onValueChange={(v) => v && setFormType(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNERSHIP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={formStatus} onValueChange={(v) => v && setFormStatus(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNERSHIP_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>القيمة (ريال)</Label>
              <Input
                type="number"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label>المدير المسؤول</Label>
              <Input
                value={formManager}
                onChange={(e) => setFormManager(e.target.value)}
                placeholder="اسم المدير"
              />
            </div>

            <div className="space-y-1.5">
              <Label>الوصف</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="وصف مختصر للشراكة"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingPartnership ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartnershipStatSkeleton() {
  return (
    <div className="cc-card rounded-xl p-4 border-t-2 border-t-muted">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>
    </div>
  );
}

function PartnershipCardSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-border bg-background/50 space-y-2.5">
      <div className="flex items-start gap-3">
        <Skeleton className="w-9 h-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-6 w-6 rounded-md" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
