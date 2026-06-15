"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchSalesLeads, createSalesLead, updateSalesLead, deleteSalesLead, fetchLeadStages, upsertLeadStage, fetchEmployees } from "@/lib/supabase/db";
import type { SalesLead, SalesLeadStage } from "@/lib/supabase/db";
import type { Employee } from "@/types";
import { aggregateEmployeeCredits } from "@/lib/kpi-calculations";
import { cn } from "@/lib/utils";
import {
  BarChart2, Plus, Trash2, Phone, MessageCircle, Users2, X,
  Trophy, Target, CreditCard, Star, CheckCircle, ChevronLeft,
} from "lucide-react";

const STAGES = [
  { num: 1, name: "أول تواصل", weight: 10, critical: false, icon: Phone },
  { num: 2, name: "تأهيل وعرض", weight: 15, critical: false, icon: MessageCircle },
  { num: 3, name: "اختيار الباقة", weight: 30, critical: true, icon: Star },
  { num: 4, name: "الدفع", weight: 30, critical: true, icon: CreditCard },
  { num: 5, name: "تأكيد التسجيل", weight: 15, critical: true, icon: CheckCircle },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "جديد", color: "bg-blue-500/20 text-blue-400" },
  in_progress: { label: "قيد المتابعة", color: "bg-amber-500/20 text-amber-400" },
  won: { label: "مغلق", color: "bg-emerald-500/20 text-emerald-400" },
  lost: { label: "خسرنا", color: "bg-red-500/20 text-red-400" },
};

export default function SalesKPIDashboard() {
  const [leads, setLeads] = useState<SalesLead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"leads" | "kpi">("leads");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLead, setSelectedLead] = useState<SalesLead | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, e] = await Promise.all([fetchSalesLeads(), fetchEmployees()]);
    setLeads(l);
    setEmployees(e);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredLeads = filterStatus === "all" ? leads : leads.filter((l) => l.status === filterStatus);
  const kpiData = aggregateEmployeeCredits(leads.map((l) => ({
    deal_value: l.deal_value || 0,
    stages: (l.stages || []).map((s) => ({
      stage_number: s.stage_number,
      stage_weight: s.stage_weight,
      assigned_to: s.assigned_to || "",
      assigned_name: s.assigned_name || "",
      completed_at: s.completed_at || null,
    })),
  })));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
            <BarChart2 className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">KPI مبيعات الدعم</h2>
            <p className="text-xs text-muted-foreground">تتبع مراحل البيع ونسب الكريديت</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/20 font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          عميل جديد
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] w-fit">
        {[
          { key: "leads" as const, label: "العملاء والمراحل" },
          { key: "kpi" as const, label: "KPI الموظفين" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
              activeTab === tab.key ? "bg-orange-500/20 text-orange-400" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "leads" && (
        <>
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "الكل" },
              { key: "new", label: "جديد" },
              { key: "in_progress", label: "قيد المتابعة" },
              { key: "won", label: "مغلق" },
              { key: "lost", label: "خسرنا" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setFilterStatus(s.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                  filterStatus === s.key
                    ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                    : "bg-white/[0.04] text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Leads List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-[14px] bg-white/[0.04] animate-pulse" />)}
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">لا يوجد عملاء</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "kpi" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          {kpiData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">لا توجد بيانات KPI بعد</p>
              <p className="text-sm mt-1">أضف عملاء وسجّل المراحل لرؤية الإحصائيات</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kpiData.map((emp, idx) => (
                <EmployeeKPICard key={emp.userId} emp={emp} rank={idx + 1} />
              ))}
            </div>
          )}

          {/* Stage Weights */}
          <div className="glass-surface rounded-[14px] border border-border p-5">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-orange-400" />
              أوزان المراحل
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {STAGES.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.num}
                    className={cn(
                      "rounded-xl p-3 text-center border",
                      s.critical
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "bg-white/[0.03] border-border"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 mx-auto mb-1", s.critical ? "text-amber-400" : "text-muted-foreground")} />
                    <p className={cn("text-xs font-semibold", s.critical ? "text-amber-400" : "text-muted-foreground")}>{s.name}</p>
                    <p className={cn("text-xl font-extrabold mt-1", s.critical ? "text-amber-400" : "text-foreground")}>{s.weight}%</p>
                    {s.critical && <span className="text-[10px] text-amber-400/70">حاسمة</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lead Stage Modal */}
      {selectedLead && (
        <LeadStageModal
          lead={selectedLead}
          employees={employees}
          onClose={() => { setSelectedLead(null); load(); }}
        />
      )}

      {/* Add Lead Modal */}
      {showAddForm && (
        <AddLeadModal
          onClose={() => { setShowAddForm(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Lead Card ──────────────────────────────────────────────────────────────

function LeadCard({ lead, onClick }: { lead: SalesLead; onClick: () => void }) {
  const completedStages = (lead.stages || []).filter((s) => s.completed_at).length;
  const st = STATUS_MAP[lead.status] || STATUS_MAP.new;

  return (
    <div
      onClick={onClick}
      className="glass-surface rounded-[14px] border border-border p-4 cursor-pointer hover:border-orange-500/30 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-400 text-sm font-bold">
            {lead.client_name[0]}
          </div>
          <div>
            <span className="font-bold text-foreground text-sm">{lead.client_name}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {lead.phone && <span>{lead.phone}</span>}
              {lead.product && <span>• {lead.product}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.deal_value > 0 && (
            <span className="text-sm font-bold text-amber-400">{lead.deal_value.toLocaleString()} ر.س</span>
          )}
          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", st.color)}>{st.label}</span>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="flex gap-1.5 mb-2">
        {STAGES.map((stage) => {
          const completed = (lead.stages || []).find((s) => s.stage_number === stage.num && s.completed_at);
          return (
            <div key={stage.num} className="flex-1">
              <div className={cn("h-1.5 rounded-full", completed ? (stage.critical ? "bg-amber-400" : "bg-orange-500") : "bg-white/[0.08]")} />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {STAGES.map((stage) => {
            const completed = (lead.stages || []).find((s) => s.stage_number === stage.num && s.completed_at);
            if (!completed) return null;
            return (
              <span key={stage.num} className="text-[10px] text-muted-foreground">
                {completed.assigned_name?.split(" ")[0]}
              </span>
            );
          })}
        </div>
        <span className="text-[11px] text-muted-foreground">{completedStages}/5 مراحل</span>
      </div>
    </div>
  );
}

// ─── Employee KPI Card ──────────────────────────────────────────────────────

function EmployeeKPICard({ emp, rank }: { emp: ReturnType<typeof aggregateEmployeeCredits>[0]; rank: number }) {
  const rankColors = ["text-amber-400 bg-amber-500/15 border-amber-500/30", "text-slate-300 bg-slate-500/15 border-slate-500/30", "text-orange-400 bg-orange-500/15 border-orange-500/30"];
  const rankClass = rankColors[rank - 1] || "text-muted-foreground bg-white/[0.06] border-border";

  return (
    <div className={cn("glass-surface rounded-[14px] border p-5", rank === 1 ? "border-amber-500/30" : "border-border")}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg border", rankClass)}>
          {rank}
        </div>
        <div>
          <p className="font-bold text-foreground text-sm">{emp.userName}</p>
          <p className="text-xs text-muted-foreground">موظف مبيعات دعم</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/[0.04] p-2.5">
          <p className="text-xs text-muted-foreground">عملاء فتحهم</p>
          <p className="text-lg font-extrabold text-foreground">{emp.leadsOpened}</p>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-2.5">
          <p className="text-xs text-muted-foreground">مراحل أنجزها</p>
          <p className="text-lg font-extrabold text-foreground">{emp.stagesCompleted}</p>
        </div>
        <div className="rounded-lg bg-white/[0.04] p-2.5">
          <p className="text-xs text-muted-foreground">صفقات مغلقة</p>
          <p className="text-lg font-extrabold text-foreground">{emp.dealsClosed}</p>
        </div>
        <div className="rounded-lg bg-amber-500/5 p-2.5 border border-amber-500/10">
          <p className="text-xs text-amber-400">نقاط الكريديت</p>
          <p className="text-lg font-extrabold text-amber-400">{emp.totalCreditPoints.toFixed(0)}</p>
        </div>
      </div>

      {emp.totalDealValue > 0 && (
        <div className="mt-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <span className="text-xs font-semibold text-emerald-400">
            قيمة الصفقات: {emp.totalDealValue.toLocaleString()} ر.س
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Lead Stage Modal ───────────────────────────────────────────────────────

function LeadStageModal({ lead, employees, onClose }: { lead: SalesLead; employees: Employee[]; onClose: () => void }) {
  const [stages, setStages] = useState<SalesLeadStage[]>(lead.stages || []);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const s = await fetchLeadStages(lead.id);
    setStages(s);
  }, [lead.id]);

  useEffect(() => { reload(); }, [reload]);

  const getStage = (num: number) => stages.find((s) => s.stage_number === num);

  const saveStage = async (stageNum: number, empId: string, empName: string) => {
    setSaving(true);
    const def = STAGES.find((s) => s.num === stageNum)!;
    await upsertLeadStage(lead.id, stageNum, def.name, def.weight, empId, empName);
    await reload();

    const updatedStages = await fetchLeadStages(lead.id);
    const hasPayment = updatedStages.find((s) => s.stage_number === 5 && s.completed_at);
    const hasProgress = updatedStages.find((s) => s.completed_at);
    if (hasPayment) {
      await updateSalesLead(lead.id, { status: "won" });
    } else if (hasProgress) {
      await updateSalesLead(lead.id, { status: "in_progress" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[14px] glass-surface border border-border p-6 m-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-foreground">{lead.client_name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{lead.phone} • {lead.product}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.1] text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs font-semibold text-muted-foreground mb-3">تسجيل الموظف المسؤول عن كل مرحلة:</p>

        <div className="space-y-3">
          {STAGES.map((stage) => {
            const completed = getStage(stage.num);
            const Icon = stage.icon;
            return (
              <div
                key={stage.num}
                className={cn(
                  "rounded-xl p-3 border",
                  completed?.completed_at ? "bg-amber-500/5 border-amber-500/15" : "bg-white/[0.03] border-border"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("w-4 h-4", completed?.completed_at ? "text-amber-400" : "text-muted-foreground")} />
                    <span className="text-sm font-semibold text-foreground">{stage.name}</span>
                    {stage.critical && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">حاسمة</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-amber-400">{stage.weight}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={completed?.assigned_to || ""}
                    onChange={(e) => {
                      const emp = employees.find((em) => em.id === e.target.value);
                      if (emp) saveStage(stage.num, emp.id, emp.name);
                    }}
                    disabled={saving}
                    className="flex-1 rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 disabled:opacity-50"
                  >
                    <option value="">— اختر الموظف —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                  {completed?.completed_at && (
                    <span className="text-[11px] text-emerald-400 font-semibold whitespace-nowrap">
                      ✓ {completed.assigned_name?.split(" ")[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={async () => { await updateSalesLead(lead.id, { status: "won" }); onClose(); }}
            className="flex-1 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/25 transition-colors"
          >
            تم الإغلاق
          </button>
          <button
            onClick={async () => { await updateSalesLead(lead.id, { status: "lost" }); onClose(); }}
            className="flex-1 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 font-semibold text-sm hover:bg-red-500/25 transition-colors"
          >
            خسرنا العميل
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Lead Modal ─────────────────────────────────────────────────────────

function AddLeadModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    client_name: "", phone: "", source: "whatsapp", product: "menu", package_name: "", deal_value: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.client_name.trim()) return;
    setSaving(true);
    await createSalesLead({
      client_name: form.client_name,
      phone: form.phone,
      source: form.source,
      product: form.product,
      package_name: form.package_name,
      deal_value: form.deal_value ? parseFloat(form.deal_value) : 0,
      status: "new",
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[14px] glass-surface border border-border p-6 m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-foreground">عميل جديد</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.1] text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">اسم العميل *</label>
            <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="مطعم / كافيه ..." className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">رقم الجوال</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">المصدر</label>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                <option value="whatsapp">واتساب</option>
                <option value="call">مكالمة</option>
                <option value="referral">إحالة</option>
                <option value="walk_in">حضور مباشر</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">المنتج</label>
              <select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50">
                <option value="menu">المنيو</option>
                <option value="cashier">الكاشير</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">الباقة</label>
            <input value={form.package_name} onChange={(e) => setForm({ ...form, package_name: e.target.value })} placeholder="باقة سنوية / شهرية ..." className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">قيمة الصفقة (ر.س)</label>
            <input type="number" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} placeholder="0" className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50" />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !form.client_name.trim()}
          className="w-full mt-5 py-2.5 rounded-lg bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ العميل"}
        </button>
      </div>
    </div>
  );
}
