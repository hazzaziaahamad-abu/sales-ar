"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teamStats, setTeamStats] = useState<{ employee_name: string; employee_id: string; total: number; completed: number; pending: number; completion_rate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<EmployeeTask | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

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
        await createEmployeeTask({
          title: form.title,
          description: form.description || undefined,
          task_type: form.task_type as EmployeeTask["task_type"],
          priority: form.priority as EmployeeTask["priority"],
          status: "pending",
          assigned_to: form.assigned_to,
          assigned_to_name: form.assigned_to_name,
          assigned_by: user?.id,
          assigned_by_name: user?.name,
          due_date: form.due_date || undefined,
          due_time: form.due_time || undefined,
          client_name: form.client_name || undefined,
          client_phone: form.client_phone || undefined,
          entity_type: (form.entity_type || undefined) as EmployeeTask["entity_type"],
          notes: form.notes || undefined,
        });
      }
      resetForm();
      loadData();
    } catch (e) {
      console.error(e);
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
            <span className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Target className="w-5 h-5 text-indigo-400" />
            </span>
            إدارة المهام
          </h1>
          <p className="text-gray-400 text-sm mt-1">إنشاء وتوزيع المهام على الفريق ومتابعة الإنجاز</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-all"
        >
          <Plus className="w-5 h-5" /> مهمة جديدة
        </button>
      </div>

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
              <div className={`w-9 h-9 rounded-xl bg-${s.color}-500/15 flex items-center justify-center`}>
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
              <div key={s.employee_id} className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
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
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
        >
          <option value="all">كل الحالات</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select
          value={filterEmployee}
          onChange={(e) => setFilterEmployee(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
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

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-[#111827] rounded-2xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
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
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                  placeholder="مثال: متابعة عميل أحمد بخصوص التجديد"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">وصف المهمة</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50 resize-none"
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
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  >
                    {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">الأولوية</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
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
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
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
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">الوقت</label>
                  <input
                    type="time"
                    value={form.due_time}
                    onChange={(e) => setForm(f => ({ ...f, due_time: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
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
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">رقم الهاتف</label>
                    <input
                      type="text"
                      value={form.client_phone}
                      onChange={(e) => setForm(f => ({ ...f, client_phone: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-sm text-gray-400 mb-1 block">نوع الربط</label>
                  <select
                    value={form.entity_type}
                    onChange={(e) => setForm(f => ({ ...f, entity_type: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
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
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!form.title || !form.assigned_to}
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-medium transition-all"
              >
                {editingTask ? "حفظ التعديلات" : "إنشاء المهمة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
