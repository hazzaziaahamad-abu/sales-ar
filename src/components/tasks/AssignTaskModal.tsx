"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchUserProfiles, createEmployeeTask } from "@/lib/supabase/db";
import { X, UserPlus, CheckCircle2 } from "lucide-react";

const TASK_TYPES = [
  { value: "call", label: "📞 اتصال" },
  { value: "followup", label: "🔄 متابعة" },
  { value: "meeting", label: "🤝 اجتماع" },
  { value: "renewal", label: "♻️ تجديد" },
  { value: "support", label: "🎧 دعم" },
  { value: "general", label: "📋 عامة" },
];

const PRIORITIES = [
  { value: "low", label: "منخفضة" },
  { value: "medium", label: "متوسطة" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];

interface AssignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onAssigned?: () => void;
  clientName: string;
  clientPhone?: string;
  entityType: "deal" | "renewal" | "ticket";
  entityId: string;
  defaultTaskType?: string;
  defaultTitle?: string;
}

export function AssignTaskModal({
  open,
  onClose,
  onAssigned,
  clientName,
  clientPhone,
  entityType,
  entityId,
  defaultTaskType,
  defaultTitle,
}: AssignTaskModalProps) {
  const { user } = useAuth();
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    assigned_to: "",
    title: defaultTitle || `متابعة ${clientName}`,
    description: "",
    task_type: defaultTaskType || (entityType === "renewal" ? "renewal" : "followup"),
    priority: "medium",
    due_date: new Date().toISOString().slice(0, 10),
    due_time: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchUserProfiles().then(setUsers).catch(() => {});
      setSuccess(false);
      setForm(f => ({
        ...f,
        title: defaultTitle || `متابعة ${clientName}`,
        task_type: defaultTaskType || (entityType === "renewal" ? "renewal" : "followup"),
      }));
    }
  }, [open, clientName, defaultTitle, defaultTaskType, entityType]);

  const handleSubmit = async () => {
    if (!form.assigned_to || !form.title) return;
    const emp = users.find(u => u.id === form.assigned_to);
    if (!emp) return;

    setSaving(true);
    try {
      await createEmployeeTask({
        title: form.title,
        description: form.description || undefined,
        task_type: form.task_type as "call" | "meeting" | "followup" | "renewal" | "support" | "general",
        priority: form.priority as "low" | "medium" | "high" | "urgent",
        status: "pending",
        assigned_to: emp.id,
        assigned_to_name: emp.name,
        assigned_by: user?.id,
        assigned_by_name: user?.name,
        due_date: form.due_date || undefined,
        due_time: form.due_time || undefined,
        client_name: clientName,
        client_phone: clientPhone || undefined,
        entity_type: entityType,
        entity_id: entityId,
        notes: form.notes || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onAssigned?.();
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
      <div className="bg-[#111827] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">تم تعيين المهمة بنجاح!</h2>
            <p className="text-gray-400 text-sm">المهمة الآن في صفحة مهام الموظف</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                تعيين مهمة لموظف
              </h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            {/* Client info badge */}
            <div className="bg-white/[0.04] rounded-xl p-3 mb-5 border border-white/[0.06]">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">العميل:</span>
                <span className="text-white font-medium">{clientName}</span>
                {clientPhone && <span className="text-gray-500 text-xs">({clientPhone})</span>}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  entityType === "deal" ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400"
                }`}>
                  {entityType === "deal" ? "صفقة" : entityType === "renewal" ? "تجديد" : "تذكرة"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {/* Assign to */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">تعيين إلى *</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="">اختر الموظف</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">عنوان المهمة *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Type + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">النوع</label>
                  <select
                    value={form.task_type}
                    onChange={(e) => setForm(f => ({ ...f, task_type: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  >
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">الأولوية</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  >
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Due date + time */}
              <div className="grid grid-cols-2 gap-3">
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

              {/* Description */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">تفاصيل المهمة</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none resize-none"
                  rows={2}
                  placeholder="تفاصيل إضافية للموظف..."
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">ملاحظات</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none"
                  placeholder="ملاحظات..."
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!form.assigned_to || !form.title || saving}
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> تعيين المهمة
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
