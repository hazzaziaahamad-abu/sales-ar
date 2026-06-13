"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchMarketingPlan, updateMarketingPlan,
  fetchPlanAxes, createPlanAxis, deletePlanAxis,
  fetchPlanIdeas, createPlanIdea, deletePlanIdea, updatePlanIdea,
  convertIdeaToTask, fetchTasksByIdeaIds, fetchEmployees,
} from "@/lib/supabase/db";
import type { MarketingPlan, PlanAxis, PlanIdea, EmployeeTask, Employee } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  Megaphone, ChevronRight, Plus, Trash2, Target, Package, Calendar,
  FileText, Video, Image, MessageCircle, Gift, Layers, ArrowLeftRight,
  CheckCircle, Lightbulb, X, Compass,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-slate-500/20 text-slate-400" },
  in_progress: { label: "قيد التنفيذ", color: "bg-amber-500/20 text-amber-400" },
  done: { label: "مكتملة", color: "bg-emerald-500/20 text-emerald-400" },
  archived: { label: "مؤرشفة", color: "bg-zinc-500/20 text-zinc-400" },
};

const CONTENT_TYPE_MAP: Record<string, { label: string; icon: typeof Video; color: string }> = {
  video: { label: "فيديو", icon: Video, color: "text-red-400 bg-red-500/15" },
  story: { label: "ستوري", icon: Image, color: "text-pink-400 bg-pink-500/15" },
  post: { label: "بوست", icon: FileText, color: "text-blue-400 bg-blue-500/15" },
  whatsapp: { label: "واتساب", icon: MessageCircle, color: "text-emerald-400 bg-emerald-500/15" },
  gift_card: { label: "بطاقة هدية", icon: Gift, color: "text-amber-400 bg-amber-500/15" },
  other: { label: "أخرى", icon: Layers, color: "text-slate-400 bg-slate-500/15" },
};

const IDEA_STATUS: Record<string, { label: string; color: string }> = {
  idea: { label: "فكرة", color: "bg-cyan-500/20 text-cyan-400" },
  converted: { label: "تم التحويل", color: "bg-violet-500/20 text-violet-400" },
  done: { label: "منجزة", color: "bg-emerald-500/20 text-emerald-400" },
};

const PLAN_STATUSES = ["draft", "in_progress", "done", "archived"] as const;

export default function MarketingPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [axes, setAxes] = useState<PlanAxis[]>([]);
  const [ideas, setIdeas] = useState<PlanIdea[]>([]);
  const [relatedTasks, setRelatedTasks] = useState<EmployeeTask[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showAxisForm, setShowAxisForm] = useState(false);
  const [axisForm, setAxisForm] = useState({ title: "", description: "" });
  const [showIdeaForm, setShowIdeaForm] = useState(false);
  const [ideaForm, setIdeaForm] = useState({ title: "", description: "", content_type: "post" as string, axis_id: "" });
  const [convertModal, setConvertModal] = useState<PlanIdea | null>(null);
  const [convertForm, setConvertForm] = useState({ assigned_to: "", assigned_to_name: "", client_name: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [p, ax, id2, emps] = await Promise.all([
      fetchMarketingPlan(id),
      fetchPlanAxes(id),
      fetchPlanIdeas(id),
      fetchEmployees(),
    ]);
    setPlan(p);
    setAxes(ax);
    setIdeas(id2);
    setEmployees(emps);
    if (id2.length > 0) {
      const tasks = await fetchTasksByIdeaIds(id2.map((i) => i.id));
      setRelatedTasks(tasks);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleStatusChange = async (status: string) => {
    if (!plan) return;
    const updated = await updateMarketingPlan(plan.id, { status: status as MarketingPlan["status"] });
    setPlan(updated);
  };

  const handleAddAxis = async () => {
    if (!axisForm.title.trim()) return;
    setSaving(true);
    await createPlanAxis({ plan_id: id, ...axisForm, sort_order: axes.length });
    setAxisForm({ title: "", description: "" });
    setShowAxisForm(false);
    setSaving(false);
    const ax = await fetchPlanAxes(id);
    setAxes(ax);
  };

  const handleDeleteAxis = async (axisId: string) => {
    if (!confirm("حذف المحور؟")) return;
    await deletePlanAxis(axisId);
    const ax = await fetchPlanAxes(id);
    setAxes(ax);
  };

  const handleAddIdea = async () => {
    if (!ideaForm.title.trim()) return;
    setSaving(true);
    await createPlanIdea({
      plan_id: id,
      title: ideaForm.title,
      description: ideaForm.description,
      content_type: ideaForm.content_type as PlanIdea["content_type"],
      axis_id: ideaForm.axis_id || undefined,
    });
    setIdeaForm({ title: "", description: "", content_type: "post", axis_id: "" });
    setShowIdeaForm(false);
    setSaving(false);
    const ideas2 = await fetchPlanIdeas(id);
    setIdeas(ideas2);
  };

  const handleDeleteIdea = async (ideaId: string) => {
    if (!confirm("حذف الفكرة؟")) return;
    await deletePlanIdea(ideaId);
    const ideas2 = await fetchPlanIdeas(id);
    setIdeas(ideas2);
  };

  const handleConvert = async () => {
    if (!convertModal || !convertForm.assigned_to || !convertForm.due_date) return;
    setSaving(true);
    await convertIdeaToTask(
      convertModal,
      convertForm.assigned_to,
      convertForm.assigned_to_name,
      user?.name || "",
      convertForm.client_name,
      convertForm.due_date
    );
    setConvertModal(null);
    setConvertForm({ assigned_to: "", assigned_to_name: "", client_name: "", due_date: "" });
    setSaving(false);
    loadAll();
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-white/[0.04] animate-pulse" />
        <div className="h-40 rounded-[14px] bg-white/[0.04] animate-pulse" />
        <div className="h-60 rounded-[14px] bg-white/[0.04] animate-pulse" />
      </div>
    );
  }

  if (!plan) {
    return <p className="text-muted-foreground text-center py-20">الخطة غير موجودة</p>;
  }

  const st = STATUS_MAP[plan.status] || STATUS_MAP.draft;
  const convertedIdeas = ideas.filter((i) => i.status === "converted" || i.status === "done");

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/marketing-plans" className="hover:text-foreground transition-colors">الخطط التسويقية</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-semibold">{plan.title}</span>
      </div>

      {/* Header */}
      <div className="glass-surface rounded-[14px] border border-border p-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-violet-400" />
              {plan.title}
            </h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", st.color)}>{st.label}</span>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{plan.segment}</span>
            </div>
          </div>
          <select
            value={plan.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-lg bg-white/[0.06] border border-border px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          >
            {PLAN_STATUSES.map((s) => <option key={s} value={s}>{STATUS_MAP[s].label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {plan.related_product && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="w-4 h-4 text-violet-400" />
              <span>{plan.related_product}</span>
            </div>
          )}
          {plan.start_date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>{plan.start_date} → {plan.end_date || "—"}</span>
            </div>
          )}
          {plan.objective && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="w-4 h-4 text-amber-400" />
              <span className="line-clamp-1">{plan.objective}</span>
            </div>
          )}
        </div>
        {plan.objective && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <p className="text-xs font-semibold text-amber-400 mb-1">الهدف الاستراتيجي</p>
            <p className="text-sm text-foreground">{plan.objective}</p>
          </div>
        )}
      </div>

      {/* Market Notes */}
      {plan.market_notes && (
        <div className="glass-surface rounded-[14px] border border-border p-5">
          <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            الوضع الحالي / السوق
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{plan.market_notes}</p>
        </div>
      )}

      {/* Axes */}
      <div className="glass-surface rounded-[14px] border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-violet-400" />
            المحاور الاستراتيجية
            <span className="text-xs text-muted-foreground font-mono">({axes.length})</span>
          </h2>
          <button onClick={() => setShowAxisForm(!showAxisForm)} className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors">
            <Plus className="w-3.5 h-3.5" /> إضافة محور
          </button>
        </div>

        {showAxisForm && (
          <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-border space-y-2">
            <input value={axisForm.title} onChange={(e) => setAxisForm({ ...axisForm, title: e.target.value })} placeholder="عنوان المحور *" className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            <input value={axisForm.description} onChange={(e) => setAxisForm({ ...axisForm, description: e.target.value })} placeholder="الوصف" className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            <div className="flex gap-2">
              <button onClick={handleAddAxis} disabled={saving || !axisForm.title.trim()} className="px-4 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600 disabled:opacity-50">حفظ</button>
              <button onClick={() => setShowAxisForm(false)} className="px-4 py-1.5 rounded-lg bg-white/[0.06] text-muted-foreground text-xs font-semibold">إلغاء</button>
            </div>
          </div>
        )}

        {axes.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد محاور بعد</p>
        ) : (
          <div className="space-y-2">
            {axes.map((axis, idx) => (
              <div key={axis.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.05] transition-colors group">
                <span className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 text-xs font-bold shrink-0 mt-0.5">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{axis.title}</p>
                  {axis.description && <p className="text-xs text-muted-foreground mt-0.5">{axis.description}</p>}
                </div>
                <button onClick={() => handleDeleteAxis(axis.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ideas */}
      <div className="glass-surface rounded-[14px] border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            بنك الأفكار
            <span className="text-xs text-muted-foreground font-mono">({ideas.length})</span>
          </h2>
          <button onClick={() => setShowIdeaForm(!showIdeaForm)} className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
            <Plus className="w-3.5 h-3.5" /> إضافة فكرة
          </button>
        </div>

        {showIdeaForm && (
          <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-border space-y-2">
            <input value={ideaForm.title} onChange={(e) => setIdeaForm({ ...ideaForm, title: e.target.value })} placeholder="عنوان الفكرة *" className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50" />
            <textarea value={ideaForm.description} onChange={(e) => setIdeaForm({ ...ideaForm, description: e.target.value })} placeholder="الوصف" rows={2} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none" />
            <div className="grid grid-cols-2 gap-2">
              <select value={ideaForm.content_type} onChange={(e) => setIdeaForm({ ...ideaForm, content_type: e.target.value })} className="rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50">
                {Object.entries(CONTENT_TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={ideaForm.axis_id} onChange={(e) => setIdeaForm({ ...ideaForm, axis_id: e.target.value })} className="rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50">
                <option value="">بدون محور</option>
                {axes.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddIdea} disabled={saving || !ideaForm.title.trim()} className="px-4 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50">حفظ</button>
              <button onClick={() => setShowIdeaForm(false)} className="px-4 py-1.5 rounded-lg bg-white/[0.06] text-muted-foreground text-xs font-semibold">إلغاء</button>
            </div>
          </div>
        )}

        {ideas.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد أفكار بعد</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ideas.map((idea) => {
              const ct = CONTENT_TYPE_MAP[idea.content_type] || CONTENT_TYPE_MAP.other;
              const is = IDEA_STATUS[idea.status] || IDEA_STATUS.idea;
              const Icon = ct.icon;
              const axis = axes.find((a) => a.id === idea.axis_id);
              const task = relatedTasks.find((t) => t.source_plan_idea_id === idea.id);

              return (
                <div key={idea.id} className="p-4 rounded-[12px] bg-white/[0.03] border border-border hover:border-amber-500/20 transition-colors group relative">
                  <button onClick={() => handleDeleteIdea(idea.id)} className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center", ct.color)}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground">{ct.label}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full mr-auto", is.color)}>{is.label}</span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground mb-1">{idea.title}</h4>
                  {idea.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{idea.description}</p>}
                  {axis && (
                    <div className="text-[11px] text-violet-400 bg-violet-500/10 rounded-md px-2 py-0.5 inline-block mb-2">{axis.title}</div>
                  )}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                    {idea.status === "idea" ? (
                      <button
                        onClick={() => {
                          setConvertModal(idea);
                          setConvertForm({ assigned_to: "", assigned_to_name: "", client_name: plan.segment, due_date: "" });
                        }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <ArrowLeftRight className="w-3 h-3" /> حوّل لمهمة
                      </button>
                    ) : task ? (
                      <Link href="/tasks" className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                        <CheckCircle className="w-3 h-3" /> مهمة منشأة → {task.assigned_to_name}
                      </Link>
                    ) : (
                      <span className="text-[11px] text-violet-400 font-semibold">تم التحويل</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Conversion Log */}
      {convertedIdeas.length > 0 && (
        <div className="glass-surface rounded-[14px] border border-border p-5">
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
            سجل التحويلات
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-right pb-2 font-semibold">الفكرة</th>
                  <th className="text-right pb-2 font-semibold">المسؤول</th>
                  <th className="text-right pb-2 font-semibold">التاريخ</th>
                  <th className="text-right pb-2 font-semibold">حالة المهمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {convertedIdeas.map((idea) => {
                  const task = relatedTasks.find((t) => t.source_plan_idea_id === idea.id);
                  return (
                    <tr key={idea.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 font-medium text-foreground">{idea.title}</td>
                      <td className="py-2 text-muted-foreground">{task?.assigned_to_name || "—"}</td>
                      <td className="py-2 text-muted-foreground text-xs">{task?.created_at ? new Date(task.created_at).toLocaleDateString("ar-SA") : "—"}</td>
                      <td className="py-2">
                        {task ? (
                          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", task.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : task.status === "in_progress" ? "bg-amber-500/20 text-amber-400" : "bg-slate-500/20 text-slate-400")}>
                            {task.status === "completed" ? "مكتملة" : task.status === "in_progress" ? "قيد التنفيذ" : "معلقة"}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Convert Modal */}
      {convertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConvertModal(null)}>
          <div className="w-full max-w-md rounded-[14px] glass-surface border border-border p-6 m-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">تحويل فكرة لمهمة</h3>
              <button onClick={() => setConvertModal(null)} className="p-1 rounded-lg hover:bg-white/[0.1] text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
              <p className="text-xs text-amber-400 font-semibold mb-0.5">الفكرة</p>
              <p className="text-sm text-foreground">{convertModal.title}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">المسؤول *</label>
              <select
                value={convertForm.assigned_to}
                onChange={(e) => {
                  const emp = employees.find((em) => em.id === e.target.value);
                  setConvertForm({ ...convertForm, assigned_to: e.target.value, assigned_to_name: emp?.name || "" });
                }}
                className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              >
                <option value="">اختر المسؤول</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">العميل / المجموعة</label>
              <input value={convertForm.client_name} onChange={(e) => setConvertForm({ ...convertForm, client_name: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">تاريخ التنفيذ *</label>
              <input type="date" value={convertForm.due_date} onChange={(e) => setConvertForm({ ...convertForm, due_date: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleConvert} disabled={saving || !convertForm.assigned_to || !convertForm.due_date} className="flex-1 px-4 py-2 rounded-lg bg-violet-500 text-white font-semibold text-sm hover:bg-violet-600 disabled:opacity-50 transition-colors">
                {saving ? "جارٍ التحويل..." : "حوّل لمهمة"}
              </button>
              <button onClick={() => setConvertModal(null)} className="px-4 py-2 rounded-lg bg-white/[0.06] text-muted-foreground font-semibold text-sm">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
