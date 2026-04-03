"use client";

import { useState, useEffect } from "react";
import { fetchProjects, createProject, updateProject } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
// PROJECT_STATUSES removed - status is now auto-computed
import { formatDate, formatPercent } from "@/lib/utils/format";
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
} from "@/components/ui/select";
import type { Project } from "@/types";
import {
  Code,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Pencil,
  Calendar,
  UsersRound,
  ListChecks,
} from "lucide-react";

/* ---------- helpers ---------- */

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "blue" | "cyan"> = {
  "في الموعد": "green",
  "متأخر": "red",
  "يكتمل قريباً": "amber",
  "موقوف": "blue",
  "مكتمل": "cyan",
};

const STATUS_BORDER: Record<string, string> = {
  "في الموعد": "border-t-cc-green",
  "متأخر": "border-t-cc-red",
  "يكتمل قريباً": "border-t-amber",
  "موقوف": "border-t-cc-blue",
  "مكتمل": "border-t-cyan",
};

function progressBarColor(pct: number): string {
  if (pct >= 80) return "bg-cc-green";
  if (pct >= 50) return "bg-cyan";
  if (pct >= 30) return "bg-amber";
  return "bg-cc-red";
}

function computeStatus(progress: number, remaining: number, startDate?: string): string {
  if (progress >= 100 || remaining <= 0) return "مكتمل";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (startDate) {
    const due = new Date(startDate);
    due.setHours(0, 0, 0, 0);
    if (due < today && progress < 100) return "متأخر";
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3 && progress < 90) return "يكتمل قريباً";
  }
  return "في الموعد";
}

/* ---------- page ---------- */

export default function DevelopmentPage() {
  const { activeOrgId: orgId } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [saving, setSaving] = useState(false);

  /* form state */
  const [formName, setFormName] = useState("");
  const [formTeam, setFormTeam] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTotalTasks, setFormTotalTasks] = useState("");
  const [formRemainingTasks, setFormRemainingTasks] = useState("");
  // status is now auto-computed

  useEffect(() => {
    setLoading(true);
    fetchProjects()
      .then((data) => {
        const updated = data.map((p) => ({
          ...p,
          status_tag: computeStatus(p.progress, p.remaining_tasks, p.start_date || undefined),
        }));
        setProjects(updated);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* status counts */
  const overdueCount = projects.filter((p) => p.status_tag === "متأخر").length;
  const onTimeCount = projects.filter((p) => p.status_tag === "في الموعد").length;
  const soonCount = projects.filter((p) => p.status_tag === "يكتمل قريباً").length;

  /* card filter */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const filteredProjects = statusFilter
    ? projects.filter((p) => p.status_tag === statusFilter)
    : projects;

  const openAddModal = () => {
    setEditingProject(null);
    setFormName("");
    setFormTeam("");
    setFormDate("");
    setFormTotalTasks("");
    setFormRemainingTasks("");
    setModalOpen(true);
  };

  const openEditModal = (proj: Project) => {
    setEditingProject(proj);
    setFormName(proj.name);
    setFormTeam(proj.team || "");
    setFormDate(proj.start_date || "");
    setFormTotalTasks(String(proj.total_tasks));
    setFormRemainingTasks(String(proj.remaining_tasks));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const total = parseInt(formTotalTasks) || 0;
      const remaining = parseInt(formRemainingTasks) || 0;
      const completed = Math.max(0, total - remaining);
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      const autoStatus = computeStatus(progress, remaining, formDate || undefined);

      if (editingProject) {
        const updated = await updateProject(editingProject.id, {
          name: formName,
          team: formTeam,
          start_date: formDate || undefined,
          total_tasks: total,
          remaining_tasks: remaining,
          progress,
          status_tag: autoStatus,
        });
        setProjects((prev) =>
          prev.map((p) => (p.id === editingProject.id ? updated : p))
        );
      } else {
        const created = await createProject({
          name: formName,
          team: formTeam,
          start_date: formDate || undefined,
          total_tasks: total,
          remaining_tasks: remaining,
          progress,
          status_tag: autoStatus,
        });
        setProjects((prev) => [...prev, created]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-dim flex items-center justify-center">
            <Code className="w-4 h-4 text-cc-purple" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">التطويرات</h1>
            <p className="text-xs text-muted-foreground">
              {projects.length} مشروع قيد المتابعة
            </p>
          </div>
        </div>
        <Button onClick={openAddModal} className="gap-1.5">
          <Plus className="w-4 h-4" />
          مشروع جديد
        </Button>
      </div>

      {/* Status count cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <ProjectStatSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              value={String(projects.length)}
              label="في الفترة"
              color="cyan"
              icon={<Code className="w-4 h-4 text-cyan" />}
              onClick={() => setStatusFilter(null)}
              active={statusFilter === null}
            />
            <StatCard
              value={String(onTimeCount)}
              label="في الموعد"
              color="green"
              icon={<CheckCircle className="w-4 h-4 text-cc-green" />}
              onClick={() => setStatusFilter(statusFilter === "في الموعد" ? null : "في الموعد")}
              active={statusFilter === "في الموعد"}
            />
            <StatCard
              value={String(overdueCount)}
              label="متأخرة"
              color="red"
              icon={<AlertTriangle className="w-4 h-4 text-cc-red" />}
              onClick={() => setStatusFilter(statusFilter === "متأخر" ? null : "متأخر")}
              active={statusFilter === "متأخر"}
            />
            <StatCard
              value={String(soonCount)}
              label="يكتمل قريباً"
              color="amber"
              icon={<Clock className="w-4 h-4 text-amber" />}
              onClick={() => setStatusFilter(statusFilter === "يكتمل قريباً" ? null : "يكتمل قريباً")}
              active={statusFilter === "يكتمل قريباً"}
            />
          </>
        )}
      </div>

      {/* Project Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProjectCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((proj) => {
            const completed = proj.total_tasks - proj.remaining_tasks;
            const statusColor = STATUS_COLOR[proj.status_tag || ""] || "blue";
            const borderColor = STATUS_BORDER[proj.status_tag || ""] || "border-t-cc-blue";

            return (
              <div
                key={proj.id}
                className={`cc-card rounded-[14px] border-t-2 ${borderColor} p-5 space-y-4`}
              >
                {/* Name + status */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-foreground leading-snug">
                    {proj.name}
                  </h3>
                  <ColorBadge
                    text={proj.status_tag || ""}
                    color={statusColor}
                  />
                </div>

                {/* Meta info */}
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <UsersRound className="w-3.5 h-3.5" />
                    <span>{proj.team}</span>
                  </div>
                  {proj.start_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDate(proj.start_date)}</span>
                    </div>
                  )}
                </div>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-muted-foreground">التقدم</span>
                    <span className="text-xs font-bold text-foreground">
                      {formatPercent(proj.progress)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progressBarColor(proj.progress)}`}
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>
                </div>

                {/* Tasks info */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ListChecks className="w-3.5 h-3.5" />
                    <span>المهام</span>
                  </div>
                  <span className="text-foreground font-medium">
                    {completed}/{proj.total_tasks}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">المتبقي</span>
                  <span className="text-foreground font-medium">
                    {proj.remaining_tasks} مهمة
                  </span>
                </div>

                {/* Edit button */}
                <div className="pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-1 text-xs"
                    onClick={() => openEditModal(proj)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    تعديل المشروع
                  </Button>
                </div>
              </div>
            );
          })}
          {projects.length === 0 && (
            <div className="col-span-3 text-center text-muted-foreground py-12">
              لا توجد مشاريع
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "تعديل المشروع" : "إضافة مشروع جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingProject ? "قم بتحديث بيانات المشروع" : "أدخل بيانات المشروع الجديد"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>اسم المشروع</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="اسم المشروع"
              />
            </div>

            <div className="space-y-1.5">
              <Label>الفريق</Label>
              <Input
                value={formTeam}
                onChange={(e) => setFormTeam(e.target.value)}
                placeholder="فريق العمل"
              />
            </div>

            <div className="space-y-1.5">
              <Label>تاريخ البداية</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>إجمالي المهام</Label>
                <Input
                  type="number"
                  value={formTotalTasks}
                  onChange={(e) => setFormTotalTasks(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>المهام المتبقية</Label>
                <Input
                  type="number"
                  value={formRemainingTasks}
                  onChange={(e) => setFormRemainingTasks(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <p className="text-sm text-muted-foreground px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10">
                يتم تحديدها تلقائياً بناءً على التقدم وتاريخ الاستحقاق
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingProject ? "حفظ التعديلات" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectStatSkeleton() {
  return (
    <div className="cc-card rounded-[14px] p-4 border-t-2 border-t-muted">
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

function ProjectCardSkeleton() {
  return (
    <div className="cc-card rounded-[14px] border-t-2 border-t-muted p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="pt-2 border-t border-border">
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    </div>
  );
}
