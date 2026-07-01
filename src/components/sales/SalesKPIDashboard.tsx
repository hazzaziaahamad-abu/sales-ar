"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchDeals, fetchAllDealKpiStages, fetchDealKpiStages, upsertDealKpiStage, createDealKpiStages, updateDeal, fetchEmployees, KPI_STAGES } from "@/lib/supabase/db";
import type { Deal, DealKpiStage, Employee } from "@/types";
import { aggregateEmployeeCredits } from "@/lib/kpi-calculations";
import { todayLocal as saudiDateStr } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import {
  BarChart2, Phone, MessageCircle, Users2, X, Search,
  Trophy, Target, CreditCard, Star, CheckCircle, Calendar,
} from "lucide-react";

const STAGES = [
  { num: 1, name: "أول تواصل", weight: 10, critical: false, icon: Phone },
  { num: 2, name: "تأهيل وعرض", weight: 15, critical: false, icon: MessageCircle },
  { num: 3, name: "اختيار الباقة", weight: 30, critical: true, icon: Star },
  { num: 4, name: "الدفع", weight: 30, critical: true, icon: CreditCard },
  { num: 5, name: "تأكيد التسجيل", weight: 15, critical: true, icon: CheckCircle },
];

const STAGE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  "قيد التواصل": { label: "قيد التواصل", color: "bg-blue-500/20 text-blue-400" },
  "عميل جديد": { label: "جديد", color: "bg-blue-500/20 text-blue-400" },
  "تفاوض": { label: "تفاوض", color: "bg-amber-500/20 text-amber-400" },
  "تجهيز": { label: "تجهيز", color: "bg-cyan-500/20 text-cyan-400" },
  "انتظار الدفع": { label: "انتظار الدفع", color: "bg-amber-500/20 text-amber-400" },
  "مكتملة": { label: "مغلق", color: "bg-emerald-500/20 text-emerald-400" },
  "مرفوض مع سبب": { label: "خسرنا", color: "bg-red-500/20 text-red-400" },
  "كنسل التجربة": { label: "ملغي", color: "bg-red-500/20 text-red-400" },
};

export interface DealWithStages extends Deal {
  kpiStages: DealKpiStage[];
}

export function getTopContributor(stages: DealKpiStage[]): { name: string; totalWeight: number } | null {
  const completed = stages.filter(s => s.completed_at && s.assigned_name);
  if (completed.length === 0) return null;
  const map = new Map<string, number>();
  completed.forEach(s => {
    map.set(s.assigned_name!, (map.get(s.assigned_name!) || 0) + s.stage_weight);
  });
  let top = { name: "", totalWeight: 0 };
  map.forEach((w, name) => { if (w > top.totalWeight) top = { name, totalWeight: w }; });
  return top.name ? top : null;
}

function getDateRange(period: string): Date | null {
  const now = new Date();
  const todayStr = saudiDateStr();
  if (period === "all") return null;
  if (period === "today") return new Date(todayStr + "T00:00:00+03:00");
  if (period === "yesterday") {
    const d = new Date(todayStr + "T00:00:00+03:00");
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (period === "week") {
    const d = new Date(todayStr + "T00:00:00+03:00");
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === "month") {
    const d = new Date(todayStr + "T00:00:00+03:00");
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
}

export default function SalesKPIDashboard({ deals: externalDeals }: { deals?: Deal[] }) {
  const [deals, setDeals] = useState<DealWithStages[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"deals" | "kpi">("deals");
  const [filterStage, setFilterStage] = useState("all");
  const [timePeriod, setTimePeriod] = useState("all");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<DealWithStages | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rawDeals = externalDeals ?? await fetchDeals("support");
      const [allStages, emps] = await Promise.all([
        fetchAllDealKpiStages(rawDeals.map((d) => d.id)),
        fetchEmployees(),
      ]);

      const stageMap = new Map<string, DealKpiStage[]>();
      allStages.forEach((s) => {
        const arr = stageMap.get(s.deal_id) || [];
        arr.push(s);
        stageMap.set(s.deal_id, arr);
      });

      const dealsWithStages: DealWithStages[] = rawDeals.map((d) => ({
        ...d,
        kpiStages: stageMap.get(d.id) || [],
      }));

      setDeals(dealsWithStages);
      setEmployees(emps);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [externalDeals]);

  useEffect(() => { load(); }, [load]);

  const filteredDeals = useMemo(() => {
    let result = deals;

    // Time filter
    const cutoff = getDateRange(timePeriod);
    if (cutoff) {
      if (timePeriod === "yesterday") {
        const nextDay = new Date(cutoff);
        nextDay.setDate(nextDay.getDate() + 1);
        result = result.filter((d) => {
          const dt = new Date(d.deal_date || d.created_at);
          return dt >= cutoff && dt < nextDay;
        });
      } else {
        result = result.filter((d) => new Date(d.deal_date || d.created_at) >= cutoff);
      }
    }

    // Stage filter
    if (filterStage === "active") {
      result = result.filter((d) => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب" && d.stage !== "كنسل التجربة");
    } else if (filterStage === "won") {
      result = result.filter((d) => d.stage === "مكتملة");
    }

    // Phone search
    if (phoneSearch.trim()) {
      const q = phoneSearch.replace(/\s+/g, "").replace(/\D/g, "");
      result = result.filter((d) => {
        const phone = (d.client_phone || "").replace(/\s+/g, "").replace(/\D/g, "");
        const name = d.client_name.toLowerCase();
        return phone.includes(q) || name.includes(phoneSearch.trim().toLowerCase());
      });
    }

    return result;
  }, [deals, timePeriod, filterStage, phoneSearch]);

  const kpiData = aggregateEmployeeCredits(filteredDeals.map((d) => ({
    deal_value: d.deal_value || 0,
    stages: d.kpiStages.map((s) => ({
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
            <p className="text-xs text-muted-foreground">تتبع مراحل البيع ونسب الكريديت — مرتبط بالصفقات مباشرة</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] w-fit">
        {[
          { key: "deals" as const, label: "الصفقات والمراحل" },
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

      {/* Time Period Filter + Search */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          {[
            { key: "all", label: "الكل" },
            { key: "today", label: "اليوم" },
            { key: "yesterday", label: "أمس" },
            { key: "week", label: "الأسبوع" },
            { key: "month", label: "الشهر" },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setTimePeriod(p.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                timePeriod === p.key
                  ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                  : "bg-white/[0.04] text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            placeholder="ابحث برقم الجوال أو اسم العميل..."
            className="w-full pr-9 pl-3 py-2 text-sm rounded-lg bg-white/[0.06] border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50"
            dir="rtl"
          />
        </div>
      </div>

      {activeTab === "deals" && (
        <>
          {/* Status Filter */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: `الكل (${filteredDeals.length})` },
              { key: "active", label: `نشطة (${filteredDeals.filter((d) => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب" && d.stage !== "كنسل التجربة").length})` },
              { key: "won", label: `مغلقة (${filteredDeals.filter((d) => d.stage === "مكتملة").length})` },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setFilterStage(s.key)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border",
                  filterStage === s.key
                    ? "bg-orange-500/15 text-orange-400 border-orange-500/30"
                    : "bg-white/[0.04] text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Deals List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-[14px] bg-white/[0.04] animate-pulse" />)}
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">لا توجد صفقات</p>
              <p className="text-sm mt-1">
                {phoneSearch ? "لا توجد نتائج للبحث" : timePeriod !== "all" ? "لا توجد صفقات في هذه الفترة" : "أضف مبيعة من زر \"إضافة مبيع\" أعلاه"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDeals.map((deal) => (
                <DealKpiCard key={deal.id} deal={deal} onClick={() => setSelectedDeal(deal)} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "kpi" && (
        <div className="space-y-6">
          {kpiData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">لا توجد بيانات KPI بعد</p>
              <p className="text-sm mt-1">سجّل إنجاز المراحل في الصفقات لرؤية الإحصائيات</p>
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

      {/* Deal Stage Modal */}
      {selectedDeal && (
        <DealStageModal
          deal={selectedDeal}
          employees={employees}
          onClose={() => { setSelectedDeal(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Deal KPI Card ────────────────────────────────────────────────────────

function DealKpiCard({ deal, onClick }: { deal: DealWithStages; onClick: () => void }) {
  const completedStages = deal.kpiStages.filter((s) => s.completed_at).length;
  const st = STAGE_STATUS_MAP[deal.stage] || { label: deal.stage, color: "bg-blue-500/20 text-blue-400" };
  const topContrib = getTopContributor(deal.kpiStages);

  return (
    <div
      onClick={onClick}
      className="glass-surface rounded-[14px] border border-border p-4 cursor-pointer hover:border-orange-500/30 transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-400 text-sm font-bold">
            {deal.client_name[0]}
          </div>
          <div>
            <span className="font-bold text-foreground text-sm">{deal.client_name}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {deal.client_phone && <span>{deal.client_phone}</span>}
              {deal.plan && <span>• {deal.plan}</span>}
              {deal.assigned_rep_name && <span>• {deal.assigned_rep_name}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deal.deal_value > 0 && (
            <span className="text-sm font-bold text-amber-400">{deal.deal_value.toLocaleString()} ر.س</span>
          )}
          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", st.color)}>{st.label}</span>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="flex gap-1.5 mb-2">
        {STAGES.map((stage) => {
          const completed = deal.kpiStages.find((s) => s.stage_number === stage.num && s.completed_at);
          return (
            <div key={stage.num} className="flex-1">
              <div className={cn("h-1.5 rounded-full", completed ? (stage.critical ? "bg-amber-400" : "bg-orange-500") : "bg-white/[0.08]")} />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          {topContrib && (
            <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              {topContrib.name.split(" ")[0]} ({topContrib.totalWeight}%)
            </span>
          )}
          {STAGES.map((stage) => {
            const completed = deal.kpiStages.find((s) => s.stage_number === stage.num && s.completed_at);
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

// ─── Deal Stage Modal ───────────────────────────────────────────────────────

function DealStageModal({ deal, employees, onClose }: { deal: DealWithStages; employees: Employee[]; onClose: () => void }) {
  const [stages, setStages] = useState<DealKpiStage[]>(deal.kpiStages);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const reload = useCallback(async () => {
    const s = await fetchDealKpiStages(deal.id);
    setStages(s);
  }, [deal.id]);

  useEffect(() => {
    if (deal.kpiStages.length === 0) {
      setInitializing(true);
      createDealKpiStages(deal.id).then((s) => {
        setStages(s);
        setInitializing(false);
      }).catch(() => setInitializing(false));
    }
  }, [deal.id, deal.kpiStages.length]);

  const getStage = (num: number) => stages.find((s) => s.stage_number === num);

  const saveStage = async (stageNum: number, empId: string, empName: string) => {
    setSaving(true);
    await upsertDealKpiStage(deal.id, stageNum, empId, empName);
    await reload();

    const updatedStages = await fetchDealKpiStages(deal.id);
    const allCompleted = KPI_STAGES.every((ks) =>
      updatedStages.find((s) => s.stage_number === ks.num && s.completed_at)
    );
    if (allCompleted && deal.stage !== "مكتملة") {
      await updateDeal(deal.id, { stage: "مكتملة", close_date: new Date().toISOString() });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[14px] glass-surface border border-border p-6 m-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-foreground">{deal.client_name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {deal.client_phone && `${deal.client_phone} • `}
              {deal.plan || "—"} • {deal.deal_value.toLocaleString()} ر.س
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.1] text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {(() => {
          const top = getTopContributor(stages);
          return top ? (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-amber-400">مسجّلة باسم: {top.name} ({top.totalWeight}%)</span>
            </div>
          ) : null;
        })()}

        <p className="text-xs font-semibold text-muted-foreground mb-3">تسجيل الموظف المسؤول عن كل مرحلة:</p>

        {initializing ? (
          <div className="text-center py-8 text-muted-foreground text-sm">جاري تهيئة المراحل...</div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
