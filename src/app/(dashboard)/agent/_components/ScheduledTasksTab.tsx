"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { describeSchedule } from "@/lib/tasks/schedule";
import type { ScheduledTask, ScheduledTaskRun } from "@/types";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-cc-green/10 text-cc-green border-cc-green/20",
  paused: "bg-amber/10 text-amber border-amber/20",
  completed: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  active: "نشطة",
  paused: "متوقفة",
  completed: "منتهية",
};

const RUN_STATUS: Record<string, { icon: typeof CheckCircle2; cls: string; label: string }> = {
  success: { icon: CheckCircle2, cls: "text-cc-green", label: "نجحت" },
  partial: { icon: AlertTriangle, cls: "text-amber", label: "جزئية" },
  failed: { icon: XCircle, cls: "text-red-500", label: "فشلت" },
  running: { icon: Loader2, cls: "text-cyan", label: "جارية" },
};

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("ar-SA-u-ca-gregory", { dateStyle: "short", timeStyle: "short" });
}

export default function ScheduledTasksTab({ orgId }: { orgId: string }) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [runs, setRuns] = useState<ScheduledTaskRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks?orgId=${encodeURIComponent(orgId)}`);
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setRuns(data.runs ?? []);
    } catch {
      // keep previous state on transient failure
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (task: ScheduledTask) => {
    setBusyId(task.id);
    const next = task.status === "active" ? "paused" : "active";
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, status: next }),
    });
    await load();
    setBusyId(null);
  };

  const runNow = async (task: ScheduledTask) => {
    setBusyId(task.id);
    await fetch(`/api/tasks/${task.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, action: "run" }),
    });
    await load();
    setBusyId(null);
  };

  const remove = async (task: ScheduledTask) => {
    if (!confirm(`حذف المهمة "${task.title}"؟`)) return;
    setBusyId(task.id);
    await fetch(`/api/tasks/${task.id}?orgId=${encodeURIComponent(orgId)}`, { method: "DELETE" });
    await load();
    setBusyId(null);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
      {/* Tasks list */}
      <div className="flex-1 cc-card rounded-xl flex flex-col overflow-hidden min-h-0">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-cyan" />
            <h3 className="text-sm font-bold text-foreground">المهام المجدولة</h3>
            <span className="text-[12px] text-muted-foreground">({tasks.length})</span>
          </div>
          <Button variant="ghost" size="sm" onClick={load} className="text-muted-foreground text-xs gap-1.5">
            <RefreshCw className="w-3 h-3" />
            تحديث
          </Button>
        </div>

        <ScrollArea className="flex-1 p-3 sm:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> جاري التحميل...
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <CalendarClock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد مهام مجدولة بعد</p>
              <p className="text-[12px] text-muted-foreground/70 mt-1">
                اطلب من المساعد الذكي إنشاء مهمة — مثل: &quot;كل أحد ذكّر الموظفين تحت الهدف&quot;
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-border bg-card/50 p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-foreground">{task.title}</h4>
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", STATUS_BADGE[task.status])}>
                          {STATUS_LABEL[task.status] ?? task.status}
                        </span>
                        {task.action_type === "notify_underperformers" && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-cc-purple/10 text-cc-purple border-cc-purple/20 flex items-center gap-1">
                            <Users className="w-3 h-3" /> الموظفون تحت الهدف
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-1">{describeSchedule(task)}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-[11px] text-muted-foreground/80">
                        <span>التشغيل القادم: {fmtDate(task.next_run_at)}</span>
                        <span>آخر تشغيل: {fmtDate(task.last_run_at)}</span>
                        <span>عدد مرات التشغيل: {task.run_count}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busyId === task.id || task.status === "completed"}
                        onClick={() => toggle(task)}
                        title={task.status === "active" ? "إيقاف مؤقت" : "تشغيل"}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        {task.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busyId === task.id}
                        onClick={() => runNow(task)}
                        title="تشغيل الآن"
                        className="h-8 w-8 text-cyan hover:text-cyan"
                      >
                        {busyId === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busyId === task.id}
                        onClick={() => remove(task)}
                        title="حذف"
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Run history */}
      <div className="md:w-[300px] flex-shrink-0 cc-card rounded-xl flex flex-col overflow-hidden min-h-0 max-h-[300px] md:max-h-none">
        <div className="px-3 sm:px-5 py-3 border-b border-border">
          <h3 className="text-sm font-bold text-foreground">سجل التشغيل</h3>
        </div>
        <ScrollArea className="flex-1 p-3">
          {runs.length === 0 ? (
            <p className="text-[12px] text-muted-foreground text-center py-8">لا يوجد سجل بعد</p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => {
                const meta = RUN_STATUS[run.status] ?? RUN_STATUS.running;
                const Icon = meta.icon;
                return (
                  <div key={run.id} className="rounded-lg border border-border bg-card/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className={cn("flex items-center gap-1.5 text-[12px] font-medium", meta.cls)}>
                        <Icon className={cn("w-3.5 h-3.5", run.status === "running" && "animate-spin")} />
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{fmtDate(run.created_at)}</span>
                    </div>
                    <p className="text-[12px] text-foreground/80 mt-1.5">{run.summary ?? "—"}</p>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
