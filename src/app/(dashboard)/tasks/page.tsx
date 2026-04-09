"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchEmployeeTasks,
  createEmployeeTask,
  updateEmployeeTask,
  deleteEmployeeTask,
  fetchEmployees,
  fetchTeamTaskStats,
} from "@/lib/supabase/db";
import type { EmployeeTask, Employee } from "@/types";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  Filter,
  X,
  Phone,
  Calendar,
  User,
  ChevronDown,
  Trophy,
  Target,
  TrendingUp,
  Zap,
  Share2,
  Mail,
  MessageCircle,
  Timer,
  Hourglass,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Video,
  FileText,
  MapPin,
} from "lucide-react";

const TASK_TYPES: Record<string, { label: string; emoji: string }> = {
  general: { label: "عامة", emoji: "📋" },
  call: { label: "اتصال", emoji: "📞" },
  meeting: { label: "اجتماع", emoji: "🤝" },
  followup: { label: "متابعة", emoji: "🔄" },
  renewal: { label: "تجديد", emoji: "♻️" },
  support: { label: "دعم", emoji: "🎧" },
};

const PRIORITIES: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "منخفضة", color: "text-gray-400", bg: "bg-gray-500/10" },
  medium: { label: "متوسطة", color: "text-blue-400", bg: "bg-blue-500/10" },
  high: { label: "عالية", color: "text-amber-400", bg: "bg-amber-500/10" },
  urgent: { label: "عاجلة", color: "text-red-400", bg: "bg-red-500/10" },
};

const STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "قيد الانتظار", color: "text-gray-400", bg: "bg-gray-500/10" },
  in_progress: { label: "جاري العمل", color: "text-blue-400", bg: "bg-blue-500/10" },
  completed: { label: "مكتملة", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  cancelled: { label: "ملغية", color: "text-red-400", bg: "bg-red-500/10" },
};

function getCountdown(dueDate?: string, dueTime?: string): { label: string; urgency: "passed" | "critical" | "warning" | "normal" | "none" } {
  if (!dueDate) return { label: "", urgency: "none" };
  const target = new Date(`${dueDate}T${dueTime ? dueTime.slice(0, 5) : "23:59"}:00`);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    const pastMs = Math.abs(diffMs);
    const pastMins = Math.floor(pastMs / 60_000);
    if (pastMins < 60) return { label: `متأخر ${pastMins} د`, urgency: "passed" };
    const pastHrs = Math.floor(pastMins / 60);
    if (pastHrs < 24) return { label: `متأخر ${pastHrs} س`, urgency: "passed" };
    const pastDays = Math.floor(pastHrs / 24);
    return { label: `متأخر ${pastDays} يوم`, urgency: "passed" };
  }

  const totalMins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const days = Math.floor(hours / 24);
  const remainingHrs = hours % 24;

  if (days > 0) {
    const label = remainingHrs > 0 ? `${days} يوم ${remainingHrs} س` : `${days} يوم`;
    return { label: `متبقي ${label}`, urgency: days <= 1 ? "warning" : "normal" };
  }
  if (hours > 0) {
    const label = mins > 0 ? `${hours} س ${mins} د` : `${hours} س`;
    return { label: `متبقي ${label}`, urgency: hours <= 2 ? "critical" : "warning" };
  }
  return { label: `متبقي ${mins} د`, urgency: "critical" };
}

type PageTab = "tasks" | "meetings";
type CalendarView = "day" | "week";

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate);
  const day = d.getDay();
  const sun = new Date(d);
  sun.setDate(d.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sun);
    dd.setDate(sun.getDate() + i);
    return dd;
  });
}

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm

export default function TasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<PageTab>("tasks");
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teamStats, setTeamStats] = useState<{ employee_name: string; employee_id: string; total: number; completed: number; pending: number; completion_rate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Meetings state
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: "", description: "", assigned_to: "", assigned_to_name: "",
    due_date: "", due_time: "", priority: "medium", notes: "",
    location: "", agenda: "",
  });
  const [editingMeeting, setEditingMeeting] = useState<EmployeeTask | null>(null);

  // Tick every 30 seconds to update countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const [form, setForm] = useState({
    title: "",
    description: "",
    task_type: "general",
    priority: "medium",
    assigned_to: "",
    assigned_to_name: "",
    due_date: "",
    due_time: "",
    client_name: "",
    client_phone: "",
    entity_type: "",
    notes: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [tasksData, empsData, stats] = await Promise.all([
        fetchEmployeeTasks(),
        fetchEmployees(),
        fetchTeamTaskStats(),
      ]);
      setTasks(tasksData);
      setEmployees(empsData.filter(e => e.status === "نشط"));
      setTeamStats(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setForm({ title: "", description: "", task_type: "general", priority: "medium", assigned_to: "", assigned_to_name: "", due_date: "", due_time: "", client_name: "", client_phone: "", entity_type: "", notes: "" });
    setEditingTask(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.assigned_to) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (editingTask) {
        await updateEmployeeTask(editingTask.id, {
          title: form.title,
          description: form.description || undefined,
          task_type: form.task_type as EmployeeTask["task_type"],
          priority: form.priority as EmployeeTask["priority"],
          assigned_to: form.assigned_to,
          assigned_to_name: form.assigned_to_name,
          due_date: form.due_date || undefined,
          due_time: form.due_time || undefined,
          client_name: form.client_name || undefined,
          client_phone: form.client_phone || undefined,
          entity_type: (form.entity_type || undefined) as EmployeeTask["entity_type"],
          notes: form.notes || undefined,
        });
      } else {
        const taskData: Record<string, unknown> = {
          title: form.title,
          task_type: form.task_type,
          priority: form.priority,
          status: "pending",
          assigned_to: form.assigned_to,
          assigned_to_name: form.assigned_to_name,
          org_id: (await import("@/lib/supabase/db")).getOrgId(),
        };
        if (form.description) taskData.description = form.description;
        if (user?.id) taskData.assigned_by = user.id;
        if (user?.name) taskData.assigned_by_name = user.name;
        if (form.due_date) taskData.due_date = form.due_date;
        if (form.due_time) taskData.due_time = form.due_time;
        if (form.client_name) taskData.client_name = form.client_name;
        if (form.client_phone) taskData.client_phone = form.client_phone;
        if (form.entity_type) taskData.entity_type = form.entity_type;
        if (form.notes) taskData.notes = form.notes;

        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { error } = await supabase.from("employee_tasks").insert(taskData).select().single();
        if (error) throw error;
      }
      resetForm();
      loadData();
    } catch (e: unknown) {
      const err = e as { message?: string; details?: string; code?: string };
      const msg = err?.message || "حدث خطأ أثناء حفظ المهمة";
      setSubmitError(msg);
      console.error("Task submit error:", JSON.stringify(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (task: EmployeeTask, status: string) => {
    await updateEmployeeTask(task.id, { status: status as EmployeeTask["status"] });
    loadData();
  };

  const openEdit = (task: EmployeeTask) => {
    setForm({
      title: task.title,
      description: task.description || "",
      task_type: task.task_type,
      priority: task.priority,
      assigned_to: task.assigned_to,
      assigned_to_name: task.assigned_to_name,
      due_date: task.due_date || "",
      due_time: task.due_time || "",
      client_name: task.client_name || "",
      client_phone: task.client_phone || "",
      entity_type: task.entity_type || "",
      notes: task.notes || "",
    });
    setEditingTask(task);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    await deleteEmployeeTask(id);
    loadData();
  };

  // ── Meeting handlers ──
  const meetings = useMemo(() => tasks.filter(t => t.task_type === "meeting"), [tasks]);

  const resetMeetingForm = () => {
    setMeetingForm({ title: "", description: "", assigned_to: "", assigned_to_name: "", due_date: "", due_time: "", priority: "medium", notes: "", location: "", agenda: "" });
    setEditingMeeting(null);
    setShowMeetingForm(false);
  };

  const openNewMeeting = (date?: string, time?: string) => {
    resetMeetingForm();
    setMeetingForm(f => ({ ...f, due_date: date || today, due_time: time || "09:00" }));
    setShowMeetingForm(true);
  };

  const openEditMeeting = (task: EmployeeTask) => {
    setMeetingForm({
      title: task.title,
      description: task.description || "",
      assigned_to: task.assigned_to,
      assigned_to_name: task.assigned_to_name,
      due_date: task.due_date || "",
      due_time: task.due_time || "",
      priority: task.priority,
      notes: task.notes || "",
      location: task.client_name || "",
      agenda: task.completion_notes || "",
    });
    setEditingMeeting(task);
    setShowMeetingForm(true);
  };

  const handleMeetingSubmit = async () => {
    if (!meetingForm.title || !meetingForm.due_date) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (editingMeeting) {
        await updateEmployeeTask(editingMeeting.id, {
          title: meetingForm.title,
          description: meetingForm.description || undefined,
          assigned_to: meetingForm.assigned_to || undefined,
          assigned_to_name: meetingForm.assigned_to_name || undefined,
          due_date: meetingForm.due_date || undefined,
          due_time: meetingForm.due_time || undefined,
          priority: meetingForm.priority as EmployeeTask["priority"],
          notes: meetingForm.notes || undefined,
          client_name: meetingForm.location || undefined,
          completion_notes: meetingForm.agenda || undefined,
        });
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const taskData: Record<string, unknown> = {
          title: meetingForm.title,
          task_type: "meeting",
          priority: meetingForm.priority,
          status: "pending",
          assigned_to: meetingForm.assigned_to || user?.id,
          assigned_to_name: meetingForm.assigned_to_name || user?.name || "",
          org_id: (await import("@/lib/supabase/db")).getOrgId(),
          due_date: meetingForm.due_date,
        };
        if (meetingForm.description) taskData.description = meetingForm.description;
        if (meetingForm.due_time) taskData.due_time = meetingForm.due_time;
        if (meetingForm.notes) taskData.notes = meetingForm.notes;
        if (meetingForm.location) taskData.client_name = meetingForm.location;
        if (meetingForm.agenda) taskData.completion_notes = meetingForm.agenda;
        if (user?.id) taskData.assigned_by = user.id;
        if (user?.name) taskData.assigned_by_name = user.name;
        const { error } = await supabase.from("employee_tasks").insert(taskData).select().single();
        if (error) throw error;
      }
      resetMeetingForm();
      loadData();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setSubmitError(err?.message || "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  };

  const calendarDateStr = calendarDate.toISOString().slice(0, 10);
  const weekDays = useMemo(() => getWeekDays(calendarDate), [calendarDate]);

  const getMeetingsForDate = useCallback((dateStr: string) => {
    return meetings.filter(m => m.due_date === dateStr).sort((a, b) => (a.due_time || "00:00").localeCompare(b.due_time || "00:00"));
  }, [meetings]);

  const navigateCalendar = (dir: number) => {
    const d = new Date(calendarDate);
    d.setDate(d.getDate() + (calendarView === "week" ? dir * 7 : dir));
    setCalendarDate(d);
  };

  const goToday = () => setCalendarDate(new Date());

  const buildShareText = (task: EmployeeTask) => {
    const tt = TASK_TYPES[task.task_type] || TASK_TYPES.general;
    const pr = PRIORITIES[task.priority] || PRIORITIES.medium;
    const st = STATUSES[task.status] || STATUSES.pending;
    let text = `📋 *مهمة: ${task.title}*\n`;
    text += `📌 النوع: ${tt.emoji} ${tt.label}\n`;
    text += `⚡ الأولوية: ${pr.label}\n`;
    text += `📊 الحالة: ${st.label}\n`;
    text += `👤 مسند إلى: ${task.assigned_to_name}\n`;
    if (task.due_date) text += `📅 تاريخ الاستحقاق: ${task.due_date}${task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}\n`;
    if (task.client_name) text += `🏢 العميل: ${task.client_name}\n`;
    if (task.client_phone) text += `📞 الهاتف: ${task.client_phone}\n`;
    if (task.description) text += `\n📝 الوصف:\n${task.description}\n`;
    if (task.notes) text += `\n🗒️ ملاحظات:\n${task.notes}\n`;
    return text;
  };

  const shareWhatsApp = (task: EmployeeTask) => {
    const text = buildShareText(task);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setShareMenuId(null);
  };

  const shareEmail = (task: EmployeeTask) => {
    const text = buildShareText(task).replace(/\*/g, "");
    const subject = `مهمة: ${task.title}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, "_blank");
    setShareMenuId(null);
  };

  const today = new Date().toISOString().split("T")[0];

  const filtered = tasks.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterEmployee !== "all" && t.assigned_to !== filterEmployee) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.assigned_to_name.toLowerCase().includes(q) && !(t.client_name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const pendingTasks = tasks.filter(t => t.status === "pending").length;
  const overdueTasks = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-[14px] bg-indigo-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-indigo-400" />
            </span>
            إدارة المهام
          </h1>
          <p className="text-gray-400 text-sm mt-1">إنشاء وتوزيع المهام على الفريق ومتابعة الإنجاز</p>
        </div>
        <button
          onClick={() => activeTab === "meetings" ? openNewMeeting() : (() => { resetForm(); setShowForm(true); })()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-all"
        >
          <Plus className="w-5 h-5" /> {activeTab === "meetings" ? "اجتماع جديد" : "مهمة جديدة"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex items-center gap-2 rounded-[14px] px-5 py-2.5 text-sm font-bold transition-all ${
            activeTab === "tasks" ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20" : "glass-surface text-gray-400 hover:text-white border border-transparent"
          }`}
        >
          <Target className="w-4 h-4" />
          المهام
          <span className="text-[10px] bg-white/[0.06] rounded-full px-2 py-0.5">{tasks.filter(t => t.task_type !== "meeting").length}</span>
        </button>
        <button
          onClick={() => setActiveTab("meetings")}
          className={`flex items-center gap-2 rounded-[14px] px-5 py-2.5 text-sm font-bold transition-all ${
            activeTab === "meetings" ? "bg-violet-500/15 text-violet-400 border border-violet-500/20" : "glass-surface text-gray-400 hover:text-white border border-transparent"
          }`}
        >
          <Video className="w-4 h-4" />
          الاجتماعات
          <span className="text-[10px] bg-white/[0.06] rounded-full px-2 py-0.5">{meetings.length}</span>
        </button>
      </div>

      {/* ═══════ TASKS TAB ═══════ */}
      {activeTab === "tasks" && (<>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المهام", value: totalTasks, icon: Target, color: "indigo" },
          { label: "مكتملة", value: completedTasks, icon: CheckCircle2, color: "emerald" },
          { label: "قيد الانتظار", value: pendingTasks, icon: Clock, color: "amber" },
          { label: "متأخرة", value: overdueTasks, icon: AlertTriangle, color: "red" },
        ].map((s) => (
          <div key={s.label} className="glass-surface rounded-2xl p-4 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-[14px] bg-${s.color}-500/15 flex items-center justify-center`}>
                <s.icon className={`w-4.5 h-4.5 text-${s.color}-400`} />
              </div>
              <span className="text-gray-400 text-xs">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Team Leaderboard */}
      {teamStats.length > 0 && (
        <div className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> ترتيب الفريق حسب الإنجاز
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {teamStats.map((s, i) => (
              <div key={s.employee_id} className="flex items-center gap-3 bg-white/[0.05] rounded-[14px] p-3 border border-white/[0.06]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  i === 0 ? "bg-amber-500/20 text-amber-400" :
                  i === 1 ? "bg-gray-400/20 text-gray-300" :
                  i === 2 ? "bg-orange-500/20 text-orange-400" :
                  "bg-white/10 text-gray-400"
                }`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.employee_name}</p>
                  <p className="text-xs text-gray-400">{s.completed}/{s.total} مهمة</p>
                </div>
                <div className="text-left">
                  <div className={`text-lg font-bold ${
                    s.completion_rate >= 80 ? "text-emerald-400" :
                    s.completion_rate >= 50 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {s.completion_rate}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالعنوان أو الموظف أو العميل..."
            className="w-full pr-10 pl-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
        >
          <option value="all">كل الحالات</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value)}
          className="px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
        >
          <option value="all">كل الموظفين</option>
          {teamStats.map(s => <option key={s.employee_id} value={s.employee_id}>{s.employee_name}</option>)}
        </select>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 glass-surface rounded-2xl border border-white/[0.06]">
            <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">لا توجد مهام</p>
          </div>
        ) : (
          filtered.map(task => {
            const isOverdue = task.status !== "completed" && task.status !== "cancelled" && task.due_date && task.due_date < today;
            const st = STATUSES[task.status] || STATUSES.pending;
            const pr = PRIORITIES[task.priority] || PRIORITIES.medium;
            const tt = TASK_TYPES[task.task_type] || TASK_TYPES.general;
            const isActive = task.status !== "completed" && task.status !== "cancelled";
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const countdown = isActive ? getCountdown(task.due_date, task.due_time) : { label: "", urgency: "none" as const };
            void tick; // ensure re-render on tick

            const countdownColors = {
              passed: "text-red-400 bg-red-500/10 border-red-500/20",
              critical: "text-orange-400 bg-orange-500/10 border-orange-500/20",
              warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
              normal: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
              none: "",
            };
            const countdownIcon = countdown.urgency === "passed" ? AlertTriangle : countdown.urgency === "critical" ? Timer : Hourglass;
            const CountdownIcon = countdownIcon;

            return (
              <div key={task.id} className={`glass-surface rounded-2xl p-4 border ${isOverdue ? "border-red-500/30" : "border-white/[0.06]"} hover:border-white/[0.12] transition-all`}>
                <div className="flex items-start gap-3">
                  {/* Status checkbox */}
                  <button
                    onClick={() => handleStatusChange(task, task.status === "completed" ? "pending" : "completed")}
                    className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                      task.status === "completed"
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-white/20 hover:border-indigo-400"
                    }`}
                  >
                    {task.status === "completed" && <CheckCircle2 className="w-4 h-4 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs">{tt.emoji}</span>
                      <h3 className={`font-medium ${task.status === "completed" ? "text-gray-500 line-through" : "text-white"}`}>
                        {task.title}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${pr.color} ${pr.bg}`}>{pr.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color} ${st.bg}`}>{st.label}</span>
                      {isOverdue && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-red-400 bg-red-500/10 animate-pulse">متأخرة</span>
                      )}
                    </div>

                    {/* Countdown Timer */}
                    {countdown.urgency !== "none" && (
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border mb-2 ${countdownColors[countdown.urgency]} ${countdown.urgency === "passed" || countdown.urgency === "critical" ? "animate-pulse" : ""}`}>
                        <CountdownIcon className="w-3.5 h-3.5" />
                        {countdown.label}
                      </div>
                    )}

                    {task.description && (
                      <p className="text-gray-400 text-sm mb-2">{task.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {task.assigned_to_name}
                      </span>
                      {task.due_date && (
                        <span className={`flex items-center gap-1 ${isOverdue ? "text-red-400" : ""}`}>
                          <Calendar className="w-3 h-3" /> {task.due_date}
                          {task.due_time && ` ${task.due_time.slice(0, 5)}`}
                        </span>
                      )}
                      {task.client_name && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {task.client_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task, e.target.value)}
                      className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-white text-xs focus:outline-none"
                    >
                      {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <div className="relative">
                      <button
                        onClick={() => setShareMenuId(shareMenuId === task.id ? null : task.id)}
                        className="p-2 rounded-lg hover:bg-indigo-500/10 text-gray-400 hover:text-indigo-400 transition-colors"
                        title="مشاركة"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      {shareMenuId === task.id && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[160px]">
                          <button
                            onClick={() => shareWhatsApp(task)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-400" />
                            واتساب
                          </button>
                          <button
                            onClick={() => shareEmail(task)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-colors"
                          >
                            <Mail className="w-4 h-4 text-blue-400" />
                            بريد إلكتروني
                          </button>
                        </div>
                      )}
                    </div>
                    <button onClick={() => openEdit(task)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(task.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      </>)}

      {/* ═══════ MEETINGS TAB ═══════ */}
      {activeTab === "meetings" && (
        <>
          {/* Calendar Navigation */}
          <div className="glass-surface rounded-2xl p-4 border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button onClick={() => navigateCalendar(-1)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button onClick={goToday} className="px-3 py-1.5 rounded-lg bg-indigo-500/15 text-indigo-400 text-xs font-bold hover:bg-indigo-500/25 transition-colors">اليوم</button>
                <button onClick={() => navigateCalendar(1)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-bold text-white">
                  {calendarView === "day"
                    ? calendarDate.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
                    : `${weekDays[0].toLocaleDateString("ar-SA", { month: "short", day: "numeric" })} — ${weekDays[6].toLocaleDateString("ar-SA", { month: "short", day: "numeric", year: "numeric" })}`
                  }
                </h2>
              </div>
              <div className="flex gap-1 bg-white/[0.04] rounded-lg p-1">
                <button onClick={() => setCalendarView("day")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${calendarView === "day" ? "bg-indigo-500/20 text-indigo-400" : "text-gray-400 hover:text-white"}`}>
                  يومي
                </button>
                <button onClick={() => setCalendarView("week")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${calendarView === "week" ? "bg-indigo-500/20 text-indigo-400" : "text-gray-400 hover:text-white"}`}>
                  أسبوعي
                </button>
              </div>
            </div>

            {/* ── Weekly View ── */}
            {calendarView === "week" && (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dateStr = day.toISOString().slice(0, 10);
                  const dayMeetings = getMeetingsForDate(dateStr);
                  const isToday = dateStr === today;
                  return (
                    <div key={dateStr} className={`rounded-xl p-3 min-h-[160px] border transition-all ${isToday ? "bg-indigo-500/[0.08] border-indigo-500/30" : "bg-white/[0.02] border-white/[0.04]"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className={`text-[10px] font-medium ${isToday ? "text-indigo-400" : "text-gray-500"}`}>{DAY_NAMES[day.getDay()]}</p>
                          <p className={`text-sm font-bold ${isToday ? "text-indigo-400" : "text-white"}`}>{day.getDate()}</p>
                        </div>
                        <button onClick={() => openNewMeeting(dateStr)} className="p-1 rounded-md hover:bg-white/10 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {dayMeetings.map((m) => {
                          const cd = m.status !== "completed" ? getCountdown(m.due_date, m.due_time) : { urgency: "none" as const };
                          return (
                            <button key={m.id} onClick={() => openEditMeeting(m)} className={`w-full text-right rounded-lg p-2 transition-all hover:ring-1 hover:ring-white/20 ${
                              m.status === "completed" ? "bg-emerald-500/10 opacity-60" : cd.urgency === "passed" ? "bg-red-500/10" : "bg-violet-500/10"
                            }`}>
                              <p className="text-[11px] font-bold text-white truncate">{m.title}</p>
                              {m.due_time && <p className="text-[10px] text-gray-400 mt-0.5">{m.due_time.slice(0, 5)}</p>}
                              {m.assigned_to_name && <p className="text-[9px] text-gray-500 truncate">{m.assigned_to_name}</p>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Daily View ── */}
            {calendarView === "day" && (
              <div className="space-y-0">
                {HOURS.map((hour) => {
                  const hourMeetings = getMeetingsForDate(calendarDateStr).filter((m) => {
                    const h = parseInt(m.due_time?.slice(0, 2) || "0", 10);
                    return h === hour;
                  });
                  return (
                    <div key={hour} className="flex border-t border-white/[0.04] min-h-[60px]">
                      <div className="w-16 py-2 text-xs text-gray-500 text-left shrink-0 font-mono">
                        {hour.toString().padStart(2, "0")}:00
                      </div>
                      <div className="flex-1 py-1 pr-2">
                        {hourMeetings.length > 0 ? (
                          <div className="space-y-1">
                            {hourMeetings.map((m) => {
                              const cd = m.status !== "completed" ? getCountdown(m.due_date, m.due_time) : { label: "", urgency: "none" as const };
                              const CdIcon = cd.urgency === "passed" ? AlertTriangle : cd.urgency === "critical" ? Timer : Hourglass;
                              return (
                                <button key={m.id} onClick={() => openEditMeeting(m)} className={`w-full text-right rounded-xl p-3 transition-all hover:ring-1 hover:ring-white/20 ${
                                  m.status === "completed" ? "bg-emerald-500/10" : "bg-violet-500/10 border border-violet-500/20"
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <Video className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                    <span className="text-sm font-bold text-white flex-1 truncate">{m.title}</span>
                                    {m.due_time && <span className="text-[11px] text-gray-400">{m.due_time.slice(0, 5)}</span>}
                                    {m.status === "completed" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {m.assigned_to_name && (
                                      <span className="text-[11px] text-gray-400 flex items-center gap-1"><User className="w-3 h-3" />{m.assigned_to_name}</span>
                                    )}
                                    {m.client_name && (
                                      <span className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{m.client_name}</span>
                                    )}
                                    {cd.urgency !== "none" && (
                                      <span className={`text-[10px] font-bold flex items-center gap-1 ${cd.urgency === "passed" ? "text-red-400" : cd.urgency === "critical" ? "text-orange-400" : cd.urgency === "warning" ? "text-amber-400" : "text-emerald-400"}`}>
                                        <CdIcon className="w-3 h-3" />{cd.label}
                                      </span>
                                    )}
                                  </div>
                                  {m.completion_notes && (
                                    <div className="mt-2 pt-2 border-t border-white/[0.06]">
                                      <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1"><FileText className="w-3 h-3" />الأجندة</p>
                                      <p className="text-[11px] text-gray-400 whitespace-pre-wrap leading-relaxed">{m.completion_notes}</p>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <button onClick={() => openNewMeeting(calendarDateStr, `${hour.toString().padStart(2, "0")}:00`)} className="w-full h-full min-h-[44px] rounded-lg hover:bg-white/[0.03] transition-all" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Meetings List */}
          <div className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-violet-400" />
              الاجتماعات القادمة
              <span className="text-xs text-gray-500 font-normal">({meetings.filter(m => m.status !== "completed" && m.status !== "cancelled").length})</span>
            </h2>
            <div className="space-y-2">
              {meetings.filter(m => m.status !== "completed" && m.status !== "cancelled" && m.due_date && m.due_date >= today).length === 0 ? (
                <div className="text-center py-8">
                  <Video className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">لا توجد اجتماعات قادمة</p>
                </div>
              ) : (
                meetings
                  .filter(m => m.status !== "completed" && m.status !== "cancelled" && m.due_date && m.due_date >= today)
                  .sort((a, b) => `${a.due_date}${a.due_time || ""}`.localeCompare(`${b.due_date}${b.due_time || ""}`))
                  .map((m) => {
                    const cd = getCountdown(m.due_date, m.due_time);
                    void tick;
                    return (
                      <div key={m.id} className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.06] hover:border-violet-500/20 transition-all">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
                            <Video className="w-5 h-5 text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white">{m.title}</h3>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{m.due_date}{m.due_time && ` — ${m.due_time.slice(0, 5)}`}</span>
                              {m.assigned_to_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{m.assigned_to_name}</span>}
                              {m.client_name && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.client_name}</span>}
                            </div>
                            {cd.urgency !== "none" && (
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border mt-2 ${
                                cd.urgency === "passed" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                                cd.urgency === "critical" ? "text-orange-400 bg-orange-500/10 border-orange-500/20 animate-pulse" :
                                cd.urgency === "warning" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
                                "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              }`}>
                                <Timer className="w-3.5 h-3.5" />{cd.label}
                              </div>
                            )}
                            {m.description && <p className="text-sm text-gray-400 mt-2">{m.description}</p>}
                            {m.completion_notes && (
                              <div className="mt-2 p-3 bg-white/[0.03] rounded-lg border border-white/[0.04]">
                                <p className="text-[11px] text-violet-400 font-bold flex items-center gap-1 mb-1"><FileText className="w-3 h-3" />الأجندة</p>
                                <p className="text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">{m.completion_notes}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <select
                              value={m.status}
                              onChange={(e) => handleStatusChange(m, e.target.value)}
                              className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-white text-xs focus:outline-none"
                            >
                              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <button onClick={() => openEditMeeting(m)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(m.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ Meeting Form Modal ═══ */}
      {showMeetingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Video className="w-5 h-5 text-violet-400" />{editingMeeting ? "تعديل الاجتماع" : "اجتماع جديد"}</h2>
              <button onClick={resetMeetingForm} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">عنوان الاجتماع *</label>
                <input type="text" value={meetingForm.title} onChange={(e) => setMeetingForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  placeholder="مثال: اجتماع مراجعة الأداء الأسبوعي" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">التاريخ *</label>
                  <input type="date" value={meetingForm.due_date} onChange={(e) => setMeetingForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">الوقت</label>
                  <input type="time" value={meetingForm.due_time} onChange={(e) => setMeetingForm(f => ({ ...f, due_time: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">المسؤول</label>
                  <select value={meetingForm.assigned_to} onChange={(e) => {
                    const emp = employees.find(em => em.id === e.target.value);
                    setMeetingForm(f => ({ ...f, assigned_to: e.target.value, assigned_to_name: emp?.name || "" }));
                  }} className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none">
                    <option value="">اختر الموظف</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">الأولوية</label>
                  <select value={meetingForm.priority} onChange={(e) => setMeetingForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none">
                    {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />المكان</label>
                <input type="text" value={meetingForm.location} onChange={(e) => setMeetingForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  placeholder="مثال: قاعة الاجتماعات / رابط Zoom" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">وصف الاجتماع</label>
                <textarea value={meetingForm.description} onChange={(e) => setMeetingForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none resize-none" rows={2}
                  placeholder="ملخص قصير عن الهدف من الاجتماع..." />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-violet-400" />الأجندة</label>
                <textarea value={meetingForm.agenda} onChange={(e) => setMeetingForm(f => ({ ...f, agenda: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-violet-500/20 text-white text-sm focus:outline-none focus:border-violet-500/50 resize-none" rows={5}
                  placeholder={"1. مراجعة إنجازات الأسبوع\n2. مناقشة التحديات\n3. توزيع المهام الجديدة\n4. موعد الاجتماع القادم"} dir="rtl" />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">ملاحظات</label>
                <textarea value={meetingForm.notes} onChange={(e) => setMeetingForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none resize-none" rows={2} />
              </div>
              {submitError && (
                <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{submitError}</div>
              )}
              <button onClick={handleMeetingSubmit} disabled={!meetingForm.title || !meetingForm.due_date || submitting}
                className="w-full py-3 rounded-[14px] bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-medium transition-all">
                {submitting ? "جاري الحفظ..." : editingMeeting ? "حفظ التعديلات" : "إنشاء الاجتماع"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editingTask ? "تعديل المهمة" : "مهمة جديدة"}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">عنوان المهمة *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  placeholder="مثال: متابعة عميل أحمد بخصوص التجديد"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">وصف المهمة</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50 resize-none"
                  rows={3}
                  placeholder="تفاصيل المهمة..."
                />
              </div>

              {/* Row: Type + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">نوع المهمة</label>
                  <select
                    value={form.task_type}
                    onChange={(e) => setForm(f => ({ ...f, task_type: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  >
                    {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">الأولوية</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  >
                    {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Assign to */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">تعيين إلى *</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => {
                    const emp = employees.find(em => em.id === e.target.value);
                    setForm(f => ({ ...f, assigned_to: e.target.value, assigned_to_name: emp?.name || "" }));
                  }}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                >
                  <option value="">اختر الموظف</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
                </select>
              </div>

              {/* Due date + time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">تاريخ الاستحقاق</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">الوقت</label>
                  <input
                    type="time"
                    value={form.due_time}
                    onChange={(e) => setForm(f => ({ ...f, due_time: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  />
                </div>
              </div>

              {/* Client info */}
              <div className="border-t border-white/10 pt-4">
                <p className="text-sm font-medium text-gray-300 mb-3">ربط بعميل (اختياري)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">اسم العميل</label>
                    <input
                      type="text"
                      value={form.client_name}
                      onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">رقم الهاتف</label>
                    <input
                      type="text"
                      value={form.client_phone}
                      onChange={(e) => setForm(f => ({ ...f, client_phone: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-sm text-gray-400 mb-1 block">نوع الربط</label>
                  <select
                    value={form.entity_type}
                    onChange={(e) => setForm(f => ({ ...f, entity_type: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  >
                    <option value="">بدون ربط</option>
                    <option value="deal">صفقة</option>
                    <option value="renewal">تجديد</option>
                    <option value="ticket">تذكرة دعم</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">ملاحظات</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              {submitError && (
                <div className="rounded-[10px] border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                  {submitError}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!form.title || !form.assigned_to || submitting}
                className="w-full py-3 rounded-[14px] bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-medium transition-all"
              >
                {submitting ? "جاري الحفظ..." : editingTask ? "حفظ التعديلات" : "إنشاء المهمة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
