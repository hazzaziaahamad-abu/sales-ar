"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BrainCircuit, Sun, Flame, Snowflake, ShieldAlert, CalendarCheck,
  Target, CheckSquare, Sparkles, TrendingUp, TrendingDown, Clock,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Users, Banknote, BarChart3, Phone, ArrowLeft, ArrowRight,
} from "lucide-react";
import { fetchDeals, fetchRenewals, fetchEmployees, fetchRecentFollowUpNotes, upsertSalesGuideSetting, fetchSalesGuideSettings } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { formatMoneyFull } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Deal, Renewal, Employee } from "@/types";

/* ─── Constants ─── */
const GOAL_90DAY = 70000;
const WEEKLY_TARGET = 17500;

const URGENCY_STYLE = { high: "border-red-500/30 bg-red-500/[0.06]", medium: "border-amber-500/30 bg-amber-500/[0.06]", low: "border-blue-500/30 bg-blue-500/[0.06]" } as const;
const URGENCY_TEXT = { high: "text-red-400", medium: "text-amber-400", low: "text-blue-400" } as const;
const URGENCY_LABEL = { high: "عاجل", medium: "متوسط", low: "عادي" } as const;

/* ─── Section Component (outside main to avoid re-mount on state change) ─── */
function Section({ id, title, icon, children, badge, isOpen, onToggle }: {
  id: string; title: string; icon: React.ReactNode; children: React.ReactNode;
  badge?: React.ReactNode; isOpen: boolean; onToggle: (id: string) => void;
}) {
  return (
    <div className="cc-card rounded-xl overflow-hidden">
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm font-bold text-foreground">{title}</span>
          {badge}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-border pt-4">{children}</div>}
    </div>
  );
}

/* ─── Helpers ─── */
function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}
function getDayName() {
  return new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
}

/* ─── Types ─── */
interface Priority {
  icon: string;
  title: string;
  detail: string;
  urgency: "high" | "medium" | "low";
  section: string;
}

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

interface MeetingItem {
  id: string;
  title: string;
  time: string;
  attendees: string;
  done: boolean;
}

interface QuickTask {
  id: string;
  text: string;
  done: boolean;
}

export default function SecretaryPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recentNotes, setRecentNotes] = useState<{ entity_id: string; note: string; author_name: string; created_at: string; entity_name?: string; entity_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    briefing: true, meetings: true, hotCold: true, renewalHealth: true, priorities: true,
    goal90: true, quickTasks: true, tasks: true,
  });

  const todayKey = new Date().toISOString().slice(0, 10);

  // Tasks persisted in database (syncs across devices)
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTask, setNewTask] = useState("");

  // Meetings persisted in database
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [newMeeting, setNewMeeting] = useState({ title: "", time: "", attendees: "" });

  // Quick tasks (< 15 min) persisted in database
  const [quickTasks, setQuickTasks] = useState<QuickTask[]>([]);
  const [newQuickTask, setNewQuickTask] = useState("");

  // Track if initial load from DB is done to avoid saving empty state
  const dbLoaded = useRef(false);

  // Save helpers — debounced to avoid excessive writes
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToDb = useCallback((key: string, value: unknown) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      upsertSalesGuideSetting(key, { date: todayKey, items: value }).catch(console.error);
    }, 500);
  }, [todayKey]);

  // Auto-save tasks to DB
  useEffect(() => {
    if (dbLoaded.current) saveToDb("secretary_tasks", tasks);
  }, [tasks, saveToDb]);
  useEffect(() => {
    if (dbLoaded.current) saveToDb("secretary_meetings", meetings);
  }, [meetings, saveToDb]);
  useEffect(() => {
    if (dbLoaded.current) saveToDb("secretary_quick", quickTasks);
  }, [quickTasks, saveToDb]);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDeals(), fetchRenewals(), fetchEmployees(), fetchRecentFollowUpNotes(50), fetchSalesGuideSettings()])
      .then(([d, r, e, n, settings]) => {
        setDeals(d); setRenewals(r); setEmployees(e); setRecentNotes(n);
        // Restore secretary tasks/meetings/quickTasks from database
        const loadSetting = (key: string) => {
          const row = settings.find((s: { setting_key: string }) => s.setting_key === key);
          if (!row) return [];
          const val = row.setting_value as { date?: string; items?: unknown[] };
          return val?.date === todayKey && Array.isArray(val.items) ? val.items : [];
        };
        setTasks(loadSetting("secretary_tasks") as TaskItem[]);
        setMeetings(loadSetting("secretary_meetings") as MeetingItem[]);
        setQuickTasks(loadSetting("secretary_quick") as QuickTask[]);
        dbLoaded.current = true;
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  /* ═══════════════════════════════════════
     COMPUTED DATA
  ═══════════════════════════════════════ */

  // Hot deals (close to closing)
  const hotDeals = useMemo(() =>
    deals.filter(d => d.stage === "انتظار الدفع" || (d.stage === "تفاوض" && d.deal_value >= 500))
      .sort((a, b) => b.deal_value - a.deal_value).slice(0, 5),
  [deals]);

  // Cold deals (stale > 14 days)
  const coldDeals = useMemo(() =>
    deals.filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب" && d.cycle_days > 14)
      .sort((a, b) => b.cycle_days - a.cycle_days).slice(0, 5),
  [deals]);

  // Renewal health
  const renewalHealth = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoon = renewals.filter(r => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      const rd = new Date(r.renewal_date);
      return rd <= in7Days && rd >= now;
    });
    const overdue = renewals.filter(r => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      return new Date(r.renewal_date) < now;
    });
    const noResponse = renewals.filter(r => r.status === "مافي تجاوب" || r.status === "الرقم غلط");
    const total = renewals.length;
    const completed = renewals.filter(r => r.status === "مكتمل").length;
    const cancelled = renewals.filter(r => r.status === "ملغي بسبب").length;
    const churnRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    return { dueSoon, overdue, noResponse, total, completed, cancelled, churnRate };
  }, [renewals]);

  // Priorities
  const priorities = useMemo(() => {
    const p: Priority[] = [];

    // Overdue renewals
    renewalHealth.overdue.forEach(r => {
      p.push({ icon: "🔴", title: `تجديد متأخر: ${r.customer_name}`, detail: `${r.plan_name} — ${formatMoneyFull(r.plan_price)}`, urgency: "high", section: "renewals" });
    });

    // Hot deals waiting payment
    hotDeals.filter(d => d.stage === "انتظار الدفع").forEach(d => {
      p.push({ icon: "💰", title: `بانتظار الدفع: ${d.client_name}`, detail: `${formatMoneyFull(d.deal_value)}`, urgency: "high", section: "sales" });
    });

    // Cold deals
    coldDeals.slice(0, 3).forEach(d => {
      p.push({ icon: "❄️", title: `صفقة راكدة: ${d.client_name}`, detail: `${d.cycle_days} يوم — مرحلة ${d.stage}`, urgency: "medium", section: "sales" });
    });

    // Renewals due soon
    renewalHealth.dueSoon.slice(0, 3).forEach(r => {
      p.push({ icon: "⏰", title: `تجديد قريب: ${r.customer_name}`, detail: `${r.plan_name} — ${r.renewal_date}`, urgency: "medium", section: "renewals" });
    });

    // No response renewals
    renewalHealth.noResponse.slice(0, 2).forEach(r => {
      p.push({ icon: "📵", title: `بدون تجاوب: ${r.customer_name}`, detail: r.plan_name, urgency: "low", section: "renewals" });
    });

    return p.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.urgency] - order[b.urgency];
    });
  }, [hotDeals, coldDeals, renewalHealth]);

  // 90-day goal
  const goal90 = useMemo(() => {
    const now = new Date();
    const start90 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const closed = deals.filter(d => d.stage === "مكتملة" && new Date(d.close_date || d.created_at) >= start90);
    const revenue = closed.reduce((s, d) => s + d.deal_value, 0);
    const renewalRev = renewals.filter(r => r.status === "مكتمل" && new Date(r.renewal_date) >= start90)
      .reduce((s, r) => s + r.plan_price, 0);
    const total = revenue + renewalRev;
    const pct = GOAL_90DAY > 0 ? Math.round((total / GOAL_90DAY) * 100) : 0;
    const remaining = Math.max(GOAL_90DAY - total, 0);
    const daysLeft = 90 - Math.floor((now.getTime() - start90.getTime()) / (1000 * 60 * 60 * 24));
    return { total, pct, remaining, daysLeft: Math.max(daysLeft, 0), closedDeals: closed.length };
  }, [deals, renewals]);

  // Briefing stats — filtered by selected month, split by type
  const briefingStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    // Split deals by sales_type
    const officeDeals = deals.filter(d => d.sales_type === "office" || !d.sales_type);
    const supportDeals = deals.filter(d => d.sales_type === "support");

    // ── Monthly stats (based on selected filter) ──
    const monthOffice = officeDeals.filter(d => d.month === selectedMonth && d.year === selectedYear);
    const monthSupport = supportDeals.filter(d => d.month === selectedMonth && d.year === selectedYear);
    const monthRenewals = renewals.filter(r => {
      const rd = new Date(r.renewal_date);
      return rd.getMonth() + 1 === selectedMonth && rd.getFullYear() === selectedYear;
    });

    const closedOffice = monthOffice.filter(d => d.stage === "مكتملة");
    const closedSupport = monthSupport.filter(d => d.stage === "مكتملة");
    const revenueOffice = closedOffice.reduce((s, d) => s + d.deal_value, 0);
    const revenueSupport = closedSupport.reduce((s, d) => s + d.deal_value, 0);
    const pipeline = [...monthOffice, ...monthSupport].filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب");
    const completedRenewals = monthRenewals.filter(r => r.status === "مكتمل");
    const renewalRevenue = completedRenewals.reduce((s, r) => s + r.plan_price, 0);
    const pendingRenewals = monthRenewals.filter(r => r.status !== "مكتمل" && r.status !== "ملغي بسبب").length;

    // ── Today's stats ──
    const todayOffice = officeDeals.filter(d => (d.close_date === today || d.created_at?.startsWith(today)) && d.stage === "مكتملة");
    const todaySupport = supportDeals.filter(d => (d.close_date === today || d.created_at?.startsWith(today)) && d.stage === "مكتملة");
    const todayRenewals = renewals.filter(r => r.status === "مكتمل" && r.updated_at?.startsWith(today));
    const todayNew = deals.filter(d => d.created_at?.startsWith(today)).length;

    return {
      // Monthly
      closedOffice: closedOffice.length, revenueOffice,
      closedSupport: closedSupport.length, revenueSupport,
      pipelineCount: pipeline.length,
      completedRenewals: completedRenewals.length, renewalRevenue, pendingRenewals,
      totalRevenueMonth: revenueOffice + revenueSupport + renewalRevenue,
      // Today
      todayOffice: todayOffice.length, todayOfficeRev: todayOffice.reduce((s, d) => s + d.deal_value, 0),
      todaySupport: todaySupport.length, todaySupportRev: todaySupport.reduce((s, d) => s + d.deal_value, 0),
      todayRenewals: todayRenewals.length, todayRenewalRev: todayRenewals.reduce((s, r) => s + r.plan_price, 0),
      todayNew,
      todayTotalRev: todayOffice.reduce((s, d) => s + d.deal_value, 0) + todaySupport.reduce((s, d) => s + d.deal_value, 0) + todayRenewals.reduce((s, r) => s + r.plan_price, 0),
    };
  }, [deals, renewals, selectedMonth, selectedYear]);

  // Task management
  function addTask() {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now().toString(), text: newTask.trim(), done: false }]);
    setNewTask("");
  }
  function toggleTask(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }
  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  // Meeting management
  function addMeeting() {
    if (!newMeeting.title.trim() || !newMeeting.time.trim()) return;
    setMeetings(prev => [...prev, { id: Date.now().toString(), title: newMeeting.title.trim(), time: newMeeting.time, attendees: newMeeting.attendees.trim(), done: false }]);
    setNewMeeting({ title: "", time: "", attendees: "" });
  }
  function toggleMeeting(id: string) {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m));
  }
  function removeMeeting(id: string) {
    setMeetings(prev => prev.filter(m => m.id !== id));
  }

  // Quick task management
  function addQuickTask() {
    if (!newQuickTask.trim()) return;
    setQuickTasks(prev => [...prev, { id: Date.now().toString(), text: newQuickTask.trim(), done: false }]);
    setNewQuickTask("");
  }
  function toggleQuickTask(id: string) {
    setQuickTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }
  function removeQuickTask(id: string) {
    setQuickTasks(prev => prev.filter(t => t.id !== id));
  }

  // AI Analysis
  async function runAiAnalysis() {
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const context = {
        deals_total: deals.length,
        deals_closed: deals.filter(d => d.stage === "مكتملة").length,
        deals_pipeline: deals.filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب").length,
        cold_deals: coldDeals.length,
        hot_deals: hotDeals.length,
        renewals_total: renewals.length,
        renewals_completed: renewalHealth.completed,
        renewals_cancelled: renewalHealth.cancelled,
        churn_rate: renewalHealth.churnRate,
        overdue_renewals: renewalHealth.overdue.length,
        goal_90_pct: goal90.pct,
        goal_90_remaining: goal90.remaining,
        employees_count: employees.length,
        revenue_month: briefingStats.revenueMonth,
        pipeline_value: briefingStats.pipelineValue,
      };
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `أنت السكرتير التنفيذي. حلل البيانات التالية وقدم ملخص تنفيذي مختصر مع 3-5 توصيات عملية فورية. ركز على الأولويات والمخاطر. البيانات: ${JSON.stringify(context)}`,
        }),
      });
      if (!res.ok) throw new Error("AI request failed");

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) { full += parsed.text; setAiAnalysis(full); }
          } catch { /* skip */ }
        }
      }
      if (!full) setAiAnalysis("تم تحليل البيانات. لا توجد مشاكل حرجة حالياً.");
    } catch {
      setAiAnalysis("تعذر الاتصال بالذكاء الاصطناعي. تأكد من إعدادات API.");
    }
    setAiLoading(false);
  }

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-amber-500/20 border border-violet-500/20 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">السكرتير التنفيذي</h1>
            <p className="text-xs text-muted-foreground">{getGreeting()} {user?.name || ""} — {getDayName()}</p>
          </div>
        </div>
        <Button onClick={runAiAnalysis} disabled={aiLoading || loading} className="gap-2 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0">
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          تحليل ذكي شامل
        </Button>
      </div>

      {/* ─── 1. Briefing with Month Filter ─── */}
      <Section id="briefing" title="الملخص والإحصائيات" icon={<Sun className="w-5 h-5 text-amber-400" />} isOpen={expandedSections.briefing !== false} onToggle={toggleSection}>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Today's stats split by type ── */}
            <div>
              <p className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-1.5"><Sun className="w-3.5 h-3.5" /> إحصائيات اليوم</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-emerald-400">{briefingStats.todayOffice}</p>
                  <p className="text-[10px] text-muted-foreground">مبيعات المكتب</p>
                  {briefingStats.todayOfficeRev > 0 && <p className="text-[10px] text-emerald-400/70 mt-0.5">{formatMoneyFull(briefingStats.todayOfficeRev)}</p>}
                </div>
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
                  <TrendingUp className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-orange-400">{briefingStats.todaySupport}</p>
                  <p className="text-[10px] text-muted-foreground">مبيعات الدعم</p>
                  {briefingStats.todaySupportRev > 0 && <p className="text-[10px] text-orange-400/70 mt-0.5">{formatMoneyFull(briefingStats.todaySupportRev)}</p>}
                </div>
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-center">
                  <RefreshCw className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-sky-400">{briefingStats.todayRenewals}</p>
                  <p className="text-[10px] text-muted-foreground">تجديدات مكتملة</p>
                  {briefingStats.todayRenewalRev > 0 && <p className="text-[10px] text-sky-400/70 mt-0.5">{formatMoneyFull(briefingStats.todayRenewalRev)}</p>}
                </div>
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                  <Banknote className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                  <p className="text-xl font-bold text-cyan-400">{formatMoneyFull(briefingStats.todayTotalRev)}</p>
                  <p className="text-[10px] text-muted-foreground">إجمالي إيرادات اليوم</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* ── Monthly stats with filter ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-cyan-400 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> إحصائيات الشهر</p>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-cyan-500/50"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>{new Date(2000, m - 1).toLocaleDateString("ar-SA", { month: "long" })}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-cyan-500/50"
                  >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Office Sales */}
              <p className="text-[10px] font-bold text-emerald-400 mb-1.5">مبيعات المكتب</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 text-center">
                  <p className="text-lg font-bold text-emerald-400">{briefingStats.closedOffice}</p>
                  <p className="text-[10px] text-muted-foreground">مكتملة</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 text-center">
                  <p className="text-lg font-bold text-emerald-400">{formatMoneyFull(briefingStats.revenueOffice)}</p>
                  <p className="text-[10px] text-muted-foreground">الإيرادات</p>
                </div>
                <div className="p-2.5 rounded-xl bg-violet-500/[0.06] border border-violet-500/15 text-center">
                  <p className="text-lg font-bold text-violet-400">{briefingStats.pipelineCount}</p>
                  <p className="text-[10px] text-muted-foreground">في خط الأنابيب</p>
                </div>
              </div>

              {/* Support Sales */}
              <p className="text-[10px] font-bold text-orange-400 mb-1.5">مبيعات الدعم</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-orange-500/[0.06] border border-orange-500/15 text-center">
                  <p className="text-lg font-bold text-orange-400">{briefingStats.closedSupport}</p>
                  <p className="text-[10px] text-muted-foreground">مكتملة</p>
                </div>
                <div className="p-2.5 rounded-xl bg-orange-500/[0.06] border border-orange-500/15 text-center">
                  <p className="text-lg font-bold text-orange-400">{formatMoneyFull(briefingStats.revenueSupport)}</p>
                  <p className="text-[10px] text-muted-foreground">الإيرادات</p>
                </div>
              </div>

              {/* Renewals */}
              <p className="text-[10px] font-bold text-sky-400 mb-1.5">التجديدات</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-sky-500/[0.06] border border-sky-500/15 text-center">
                  <p className="text-lg font-bold text-sky-400">{briefingStats.completedRenewals}</p>
                  <p className="text-[10px] text-muted-foreground">مكتمل</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/15 text-center">
                  <p className="text-lg font-bold text-amber-400">{briefingStats.pendingRenewals}</p>
                  <p className="text-[10px] text-muted-foreground">معلّق</p>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-500/[0.06] border border-sky-500/15 text-center">
                  <p className="text-lg font-bold text-sky-400">{formatMoneyFull(briefingStats.renewalRevenue)}</p>
                  <p className="text-[10px] text-muted-foreground">الإيرادات</p>
                </div>
              </div>

              {/* Total */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                <p className="text-xl font-bold text-cyan-400">{formatMoneyFull(briefingStats.totalRevenueMonth)}</p>
                <p className="text-[10px] text-muted-foreground">إجمالي إيرادات الشهر (مبيعات + تجديدات)</p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ─── 2. Today's Meetings ─── */}
      <Section
        id="meetings"
        title="اجتماعات اليوم"
        icon={<CalendarCheck className="w-5 h-5 text-teal-400" />}
        badge={meetings.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400">{meetings.filter(m => m.done).length}/{meetings.length}</span> : undefined}
        isOpen={expandedSections.meetings !== false} onToggle={toggleSection}
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newMeeting.title}
              onChange={e => setNewMeeting(prev => ({ ...prev, title: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addMeeting()}
              placeholder="عنوان الاجتماع..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-teal-500/50"
            />
            <input
              type="time"
              value={newMeeting.time}
              onChange={e => setNewMeeting(prev => ({ ...prev, time: e.target.value }))}
              className="w-28 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-teal-500/50"
            />
            <input
              value={newMeeting.attendees}
              onChange={e => setNewMeeting(prev => ({ ...prev, attendees: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addMeeting()}
              placeholder="الحضور (اختياري)..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-teal-500/50"
            />
            <Button size="sm" onClick={addMeeting} disabled={!newMeeting.title.trim() || !newMeeting.time.trim()} className="bg-teal-600 hover:bg-teal-500 border-0">
              إضافة
            </Button>
          </div>
          {meetings.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد اجتماعات مجدولة اليوم</p>
          ) : (
            <div className="space-y-1.5">
              {[...meetings].sort((a, b) => a.time.localeCompare(b.time)).map(m => {
                const now = new Date();
                const [h, min] = m.time.split(":").map(Number);
                const meetingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
                const diffMin = Math.round((meetingTime.getTime() - now.getTime()) / 60000);
                const isUpcoming = diffMin > 0 && diffMin <= 30;
                const isPast = diffMin < -30;
                return (
                  <div key={m.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${m.done ? "bg-emerald-500/[0.04] border-emerald-500/15" : isUpcoming ? "bg-teal-500/[0.08] border-teal-500/30 ring-1 ring-teal-500/20" : isPast ? "bg-white/[0.01] border-white/[0.04] opacity-60" : "bg-white/[0.02] border-white/[0.06]"}`}>
                    <button onClick={() => toggleMeeting(m.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${m.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30 hover:border-teal-500/50"}`}>
                      {m.done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold font-mono ${isUpcoming ? "text-teal-400" : m.done ? "text-muted-foreground" : "text-foreground"}`} dir="ltr">{m.time}</span>
                      {isUpcoming && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 animate-pulse">خلال {diffMin} د</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${m.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{m.title}</p>
                      {m.attendees && <p className="text-[10px] text-muted-foreground">{m.attendees}</p>}
                    </div>
                    <button onClick={() => removeMeeting(m.id)} className="text-muted-foreground hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>

      {/* ─── 3. Hot & Cold Deals ─── */}
      <Section
        id="hotCold"
        title="الصفقات الساخنة والباردة"
        icon={<Flame className="w-5 h-5 text-orange-400" />}
        badge={!loading ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">{hotDeals.length} ساخنة · {coldDeals.length} باردة</span> : undefined}
        isOpen={expandedSections.hotCold !== false} onToggle={toggleSection}
      >
        {loading ? <Skeleton className="h-32 rounded-xl" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hot */}
            <div>
              <p className="text-xs font-bold text-orange-400 mb-2 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> صفقات ساخنة (قريبة من الإغلاق)</p>
              {hotDeals.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد صفقات ساخنة</p> : (
                <div className="space-y-1.5">
                  {hotDeals.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-500/[0.06] border border-orange-500/15">
                      <div>
                        <p className="text-xs font-medium text-foreground">{d.client_name}</p>
                        <p className="text-[10px] text-muted-foreground">{d.stage} · {d.assigned_rep_name || "—"}</p>
                      </div>
                      <span className="text-xs font-bold text-orange-400">{formatMoneyFull(d.deal_value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Cold */}
            <div>
              <p className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1.5"><Snowflake className="w-3.5 h-3.5" /> صفقات باردة (راكدة)</p>
              {coldDeals.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد صفقات راكدة</p> : (
                <div className="space-y-1.5">
                  {coldDeals.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-500/[0.06] border border-blue-500/15">
                      <div>
                        <p className="text-xs font-medium text-foreground">{d.client_name}</p>
                        <p className="text-[10px] text-muted-foreground">{d.stage} · {d.assigned_rep_name || "—"}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-400">{d.cycle_days} يوم</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ─── 3. Renewal Health ─── */}
      <Section
        id="renewalHealth"
        title="صحة التجديدات"
        icon={<ShieldAlert className="w-5 h-5 text-sky-400" />}
        badge={!loading && renewalHealth.overdue.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{renewalHealth.overdue.length} متأخر</span> : undefined}
        isOpen={expandedSections.renewalHealth !== false} onToggle={toggleSection}
      >
        {loading ? <Skeleton className="h-32 rounded-xl" /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-xl font-bold text-emerald-400">{renewalHealth.completed}</p>
                <p className="text-[10px] text-muted-foreground">مكتمل</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-xl font-bold text-red-400">{renewalHealth.cancelled}</p>
                <p className="text-[10px] text-muted-foreground">ملغي ({renewalHealth.churnRate}%)</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-xl font-bold text-amber-400">{renewalHealth.dueSoon.length}</p>
                <p className="text-[10px] text-muted-foreground">يستحق خلال 7 أيام</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                <p className="text-xl font-bold text-rose-400">{renewalHealth.overdue.length}</p>
                <p className="text-[10px] text-muted-foreground">متأخر</p>
              </div>
            </div>
            {renewalHealth.overdue.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-400 mb-2">⚠️ تجديدات متأخرة تحتاج تواصل فوري:</p>
                <div className="space-y-1.5">
                  {renewalHealth.overdue.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/[0.06] border border-red-500/15">
                      <div>
                        <p className="text-xs font-medium text-foreground">{r.customer_name}</p>
                        <p className="text-[10px] text-muted-foreground">{r.plan_name} · {r.assigned_rep || "—"}</p>
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-red-400">{formatMoneyFull(r.plan_price)}</span>
                        {r.customer_phone && <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{r.customer_phone}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ─── 4. Today's Priorities ─── */}
      <Section
        id="priorities"
        title="أولويات اليوم"
        icon={<Target className="w-5 h-5 text-red-400" />}
        badge={!loading ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{priorities.filter(p => p.urgency === "high").length} عاجل</span> : undefined}
        isOpen={expandedSections.priorities !== false} onToggle={toggleSection}
      >
        {loading ? <Skeleton className="h-40 rounded-xl" /> : priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد أولويات عاجلة — أداء ممتاز!</p>
        ) : (
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${URGENCY_STYLE[p.urgency]}`}>
                <span className="text-base">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground">{p.detail}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${URGENCY_TEXT[p.urgency]} bg-white/5`}>{URGENCY_LABEL[p.urgency]}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── 5. 90-Day Goal Tracker ─── */}
      <Section id="goal90" title="تتبع هدف الـ 90 يوم" icon={<BarChart3 className="w-5 h-5 text-cyan-400" />} isOpen={expandedSections.goal90 !== false} onToggle={toggleSection}>
        {loading ? <Skeleton className="h-24 rounded-xl" /> : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">المحقق: {formatMoneyFull(goal90.total)} من {formatMoneyFull(GOAL_90DAY)}</span>
              <span className={`text-sm font-bold ${goal90.pct >= 100 ? "text-emerald-400" : goal90.pct >= 70 ? "text-cyan-400" : "text-amber-400"}`}>{goal90.pct}%</span>
            </div>
            <div className="h-4 bg-white/[0.04] rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-700 ${goal90.pct >= 100 ? "bg-gradient-to-l from-emerald-400 to-emerald-600" : goal90.pct >= 70 ? "bg-gradient-to-l from-cyan-400 to-cyan-600" : "bg-gradient-to-l from-amber-400 to-amber-600"}`}
                style={{ width: `${Math.min(goal90.pct, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                <p className="text-sm font-bold text-foreground">{formatMoneyFull(goal90.remaining)}</p>
                <p className="text-[10px] text-muted-foreground">المتبقي</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                <p className="text-sm font-bold text-foreground">{goal90.daysLeft}</p>
                <p className="text-[10px] text-muted-foreground">يوم متبقي</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                <p className="text-sm font-bold text-foreground">{goal90.closedDeals}</p>
                <p className="text-[10px] text-muted-foreground">صفقة مغلقة</p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ─── 7. Quick Tasks (< 15 min) ─── */}
      <Section
        id="quickTasks"
        title="مهام سريعة (أقل من 15 دقيقة)"
        icon={<Clock className="w-5 h-5 text-amber-400" />}
        badge={quickTasks.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{quickTasks.filter(t => t.done).length}/{quickTasks.length}</span> : undefined}
        isOpen={expandedSections.quickTasks !== false} onToggle={toggleSection}
      >
        <div className="space-y-3">
          <p className="text-[10px] text-amber-400/70">مهام تحتاج إجراء فوري ولا تستغرق أكثر من 15 دقيقة — أنجزها الحين!</p>
          <div className="flex gap-2">
            <input
              value={newQuickTask}
              onChange={e => setNewQuickTask(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addQuickTask()}
              placeholder="رد على إيميل، اتصال سريع، مراجعة مستند..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50"
            />
            <Button size="sm" onClick={addQuickTask} disabled={!newQuickTask.trim()} className="bg-amber-600 hover:bg-amber-500 border-0 text-black">
              إضافة
            </Button>
          </div>
          {quickTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد مهام سريعة — أضف مهام تنجزها بسرعة</p>
          ) : (
            <div className="space-y-1.5">
              {quickTasks.map(t => (
                <div key={t.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all ${t.done ? "bg-emerald-500/[0.04] border-emerald-500/15" : "bg-amber-500/[0.03] border-amber-500/10"}`}>
                  <button onClick={() => toggleQuickTask(t.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-amber-500/40 hover:border-amber-500/70"}`}>
                    {t.done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${t.done ? "text-muted-foreground" : "text-amber-400/60"}`} />
                  <span className={`flex-1 text-xs ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
                  <button onClick={() => removeQuickTask(t.id)} className="text-muted-foreground hover:text-red-400 text-xs transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
          {quickTasks.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all" style={{ width: `${Math.round((quickTasks.filter(t => t.done).length / quickTasks.length) * 100)}%` }} />
              </div>
              {quickTasks.every(t => t.done) && <span className="text-[10px] text-emerald-400 font-bold">ممتاز!</span>}
            </div>
          )}
        </div>
      </Section>

      {/* ─── 8. Interactive Tasks ─── */}
      <Section
        id="tasks"
        title="مهام اليوم"
        icon={<CheckSquare className="w-5 h-5 text-indigo-400" />}
        badge={tasks.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">{tasks.filter(t => t.done).length}/{tasks.length}</span> : undefined}
        isOpen={expandedSections.tasks !== false} onToggle={toggleSection}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTask()}
              placeholder="أضف مهمة جديدة..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
            />
            <Button size="sm" onClick={addTask} disabled={!newTask.trim()} className="bg-indigo-600 hover:bg-indigo-500 border-0">
              إضافة
            </Button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد مهام — أضف مهام يومك</p>
          ) : (
            <div className="space-y-1.5">
              {tasks.map(t => (
                <div key={t.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all ${t.done ? "bg-emerald-500/[0.04] border-emerald-500/15" : "bg-white/[0.02] border-white/[0.06]"}`}>
                  <button onClick={() => toggleTask(t.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30 hover:border-indigo-500/50"}`}>
                    {t.done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <span className={`flex-1 text-xs ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
                  <button onClick={() => removeTask(t.id)} className="text-muted-foreground hover:text-red-400 text-xs transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-l from-indigo-400 to-indigo-600 rounded-full transition-all" style={{ width: `${Math.round((tasks.filter(t => t.done).length / tasks.length) * 100)}%` }} />
            </div>
          )}
        </div>
      </Section>

      {/* ─── 7. AI Analysis Result ─── */}
      {(aiAnalysis || aiLoading) && (
        <div className="cc-card rounded-xl p-5 border border-violet-500/20 bg-gradient-to-l from-violet-500/[0.04] to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-foreground">التحليل الذكي</h3>
            {aiLoading && <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
          </div>
          <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {aiAnalysis || "جاري التحليل..."}
          </div>
        </div>
      )}
    </div>
  );
}
