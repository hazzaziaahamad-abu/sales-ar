"use client";

import { useState, useEffect } from "react";
import { fetchEmployees, createEmployee, updateEmployee, deleteEmployee } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { EMPLOYEE_STATUSES } from "@/lib/utils/constants";
import { StatCard } from "@/components/ui/stat-card";
import { ColorBadge } from "@/components/ui/color-badge";
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
import type { Employee } from "@/types";
import { Users, UserPlus, Pencil, Trash2 } from "lucide-react";

/* ---------- helpers ---------- */

const STATUS_COLOR: Record<string, "green" | "amber" | "blue" | "red"> = {
  "نشط": "green",
  "مشغول": "amber",
  "متاح": "blue",
  "إجازة": "red",
};

function workloadColor(pct: number): string {
  if (pct > 85) return "bg-cc-red";
  if (pct >= 70) return "bg-amber";
  return "bg-cc-green";
}

function workloadTextColor(pct: number): string {
  if (pct > 85) return "text-cc-red";
  if (pct >= 70) return "text-amber";
  return "text-cc-green";
}

/* ---------- page ---------- */

export default function TeamPage() {
  const { activeOrgId: orgId } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  /* delete confirmation */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* form state */
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formStatus, setFormStatus] = useState<string>("نشط");

  useEffect(() => {
    setLoading(true);
    fetchEmployees()
      .then(setEmployees)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormName("");
    setFormRole("");
    setFormEmail("");
    setFormPhone("");
    setFormStatus("نشط");
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormName(emp.name);
    setFormRole(emp.role || "");
    setFormEmail(emp.email || "");
    setFormPhone(emp.phone || "");
    setFormStatus(emp.status);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (editingEmployee) {
        const updated = await updateEmployee(editingEmployee.id, {
          name: formName,
          role: formRole,
          email: formEmail,
          phone: formPhone,
          status: formStatus,
        });
        setEmployees((prev) =>
          prev.map((e) => (e.id === editingEmployee.id ? updated : e))
        );
      } else {
        const created = await createEmployee({
          name: formName,
          role: formRole,
          email: formEmail,
          phone: formPhone,
          status: formStatus,
        });
        setEmployees((prev) => [...prev, created]);
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
        await deleteEmployee(deleteId);
        setEmployees((prev) => prev.filter((e) => e.id !== deleteId));
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  /* counts */
  const activeCount = employees.filter((e) => e.status === "نشط").length;
  const busyCount = employees.filter((e) => e.status === "مشغول").length;

  /* card filter */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState("");
  const statusFilteredEmployees = statusFilter
    ? employees.filter((e) => e.status === statusFilter)
    : employees;
  const filteredEmployees = nameSearch
    ? statusFilteredEmployees.filter((e) => e.name.toLowerCase().includes(nameSearch.toLowerCase()))
    : statusFilteredEmployees;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-dim flex items-center justify-center">
            <Users className="w-4 h-4 text-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {employees.length} عضو في الفريق
            </h1>
            <p className="text-xs text-muted-foreground">
              {activeCount} نشط &bull; {busyCount} مشغول
            </p>
          </div>
        </div>
        <Button onClick={openAddModal} className="gap-1.5">
          <UserPlus className="w-4 h-4" />
          إضافة عضو
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <TeamStatSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              value={String(employees.length)}
              label="إجمالي الفريق"
              color="cyan"
              icon={<Users className="w-4 h-4 text-cyan" />}
              onClick={() => setStatusFilter(null)}
              active={statusFilter === null}
            />
            <StatCard
              value={String(activeCount)}
              label="أعضاء نشطين"
              color="green"
              onClick={() => setStatusFilter(statusFilter === "نشط" ? null : "نشط")}
              active={statusFilter === "نشط"}
            />
            <StatCard
              value={String(busyCount)}
              label="مشغول"
              color="amber"
              onClick={() => setStatusFilter(statusFilter === "مشغول" ? null : "مشغول")}
              active={statusFilter === "مشغول"}
            />
            <StatCard
              value={String(employees.filter((e) => e.status === "إجازة").length)}
              label="إجازة"
              color="red"
              onClick={() => setStatusFilter(statusFilter === "إجازة" ? null : "إجازة")}
              active={statusFilter === "إجازة"}
            />
          </>
        )}
      </div>

      {/* Search */}
      <Input
        value={nameSearch}
        onChange={(e) => setNameSearch(e.target.value)}
        placeholder="ابحث باسم العضو..."
        className="max-w-xs"
      />

      {/* Team Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <TeamCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const workload = 0;
            const initial = emp.name.charAt(0);

            return (
              <div
                key={emp.id}
                className="cc-card rounded-xl p-5 space-y-4"
              >
                {/* Top: avatar + info */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full border-2 border-cyan bg-cyan-dim flex items-center justify-center text-cyan font-bold text-base shrink-0">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {emp.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {emp.role}
                    </p>
                  </div>
                  <ColorBadge
                    text={emp.status}
                    color={STATUS_COLOR[emp.status] || "blue"}
                  />
                </div>

                {/* Workload */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-muted-foreground">حمل العمل</span>
                    <span className={`text-xs font-bold ${workloadTextColor(workload)}`}>
                      {workload}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${workloadColor(workload)}`}
                      style={{ width: `${workload}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1 text-xs"
                    onClick={() => openEditModal(emp)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    تعديل
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 gap-1 text-xs"
                    onClick={() => confirmDelete(emp.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
            );
          })}
          {employees.length === 0 && (
            <div className="col-span-3 text-center text-muted-foreground py-12">
              لا يوجد أعضاء في الفريق
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا العضو؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              حذف العضو
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEmployee ? "تعديل العضو" : "إضافة عضو جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee ? "قم بتحديث بيانات العضو" : "أدخل بيانات العضو الجديد"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="اسم العضو"
              />
            </div>

            <div className="space-y-1.5">
              <Label>الدور</Label>
              <Input
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                placeholder="المسمى الوظيفي"
              />
            </div>

            <div className="space-y-1.5">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="example@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label>الجوال</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="05xxxxxxxx"
              />
            </div>

            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={formStatus} onValueChange={(v) => v && setFormStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingEmployee ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamStatSkeleton() {
  return (
    <div className="cc-card rounded-xl p-4 border-t-2 border-t-muted">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>
    </div>
  );
}

function TeamCardSkeleton() {
  return (
    <div className="cc-card rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="w-11 h-11 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
