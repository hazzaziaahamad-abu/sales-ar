"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Flame, Target, CheckCircle2, Clock, Phone, MessageCircle,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw, TrendingUp,
  Briefcase, Headphones, Plus, X, Check, ArrowLeft, Trophy,
  Settings, Zap,
} from "lucide-react";
import {
  fetchDeals, fetchTickets, fetchRenewals, fetchRecentFollowUpNotes,
  upsertSalesGuideSetting, fetchSalesGuideSettings, fetchEmployees,
} from "@/lib/supabase/db";
import type { Deal, Ticket, Renewal, Employee } from "@/types";
import { EmployeeDetailPanel } from "@/components/employee-detail-panel";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, todayLocal, dateToLocal } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Helpers ─── */
function daysAgo(date?: string): number {
  if (!date) return 9999;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}
function daysUntil(date?: string): number {
  if (!date) return 9999;
  return Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000);
}
function sanitizePhone(p?: string): string {
  if (!p) return "";
  let s = p.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("05") || s.startsWith("5")) s = "+966" + s.replace(/^0/, "");
  return s;
}
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "نهارك سعيد";
  return "مساء الخير";
}
function getWeekStart(): string {
  const now = new Date();
  const diff = (now.getDay() + 1) % 7;
  const sat = new Date(now);
  sat.setDate(now.getDate() - diff);
  return dateToLocal(sat);
}
function formatArabicDate(d: Date): string {
  return d.toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" });
}

/* ─── Types ─── */
interface AttentionItem {
  id: string;
  type: "deal" | "ticket" | "renewal";
  title: string;
  subtitle: string;
  reason: string;
  urgency: number;
  phone?: string;
  waMsg?: string;
  link: string;
  badge: string;
  badgeColor: string;
}
interface OpsTask {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}
interface WeeklyReview {
  weekKey: string;
  priority1: string;
  priority2: string;
  priority3: string;
  decision: string;
}
interface StoredSetting { setting_key: string; setting_value: unknown }

/* ─── DB keys ─── */
const KEY_TASKS = "ops_tasks";
const KEY_REVIEW = "ops_weekly_review";
const KEY_GOALS = "ops_goals";

/* ═══════════════════════════════════════════════════════════════ */
export default function OperationsPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [detailEmployee, setDetailEmployee] = useState<Employee | null>(null);
  const [notes, setNotes] = useState<{ entity_id: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [weeklyGoal, setWeeklyGoal] = useState(17500);
  const [goalDraft, setGoalDraft] = useState("17500");
  const [goalEditing, setGoalEditing] = useState(false);

  const weekKey = getWeekStart();
  const [review, setReview] = useState<WeeklyReview>({ weekKey, priority1: "", priority2: "", priority3: "", decision: "" });
  const [weekExpanded, setWeekExpanded] = useState(false);

  const [tasks, setTasks] = useState<OpsTask[]>([]);
  const [newTaskText, setNewTaskText] = useState("");

  const dbLoaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToDb = useCallback((key: string, value: unknown) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      upsertSalesGuideSetting(key as Parameters<typeof upsertSalesGuideSetting>[0], value).catch(console.error);
    }, 800);
  }, []);

  /* ─── Load ─── */
  useEffect(() => {
    Promise.all([
      fetchDeals(),
      fetchTickets(),
      fetchRenewals(),
      fetchRecentFollowUpNotes(100),
      fetchSalesGuideSettings(),
      fetchEmployees().catch(() => [] as Employee[]),
    ]).then(([d, t, r, n, settings, emps]) => {
      setDeals(d);
      setTickets(t);
      setRenewals(r);
      setNotes(n as { entity_id: string; created_at: string }[]);
      setEmployees(emps as Employee[]);

      const row = (key: string) =>
        (settings as unknown as StoredSetting[]).find(s => s.setting_key === key)?.setting_value;

      // Goals
      const goalsVal = row(KEY_GOALS) as { weeklyGoal?: number } | undefined;
      if (goalsVal?.weeklyGoal) {
        setWeeklyGoal(goalsVal.weeklyGoal);
        setGoalDraft(String(goalsVal.weeklyGoal));
      }

      // Tasks — keep undone tasks from last 30 days + today's done tasks
      const tasksVal = row(KEY_TASKS);
      if (Array.isArray(tasksVal)) {
        const today = todayLocal();
        const thirtyAgo = dateToLocal(new Date(Date.now() - 30 * 86_400_000));
        setTasks(
          (tasksVal as OpsTask[]).filter(task =>
            task.done ? task.createdAt >= today : task.createdAt >= thirtyAgo
          )
        );
      }

      // Weekly review
      const reviewVal = row(KEY_REVIEW) as WeeklyReview | undefined;
      if (reviewVal?.weekKey === weekKey) setReview(reviewVal);

      dbLoaded.current = true;
    }).catch(console.error).finally(() => setLoading(false));
  }, [weekKey]);

  useEffect(() => { if (dbLoaded.current) saveToDb(KEY_TASKS, tasks); }, [tasks, saveToDb]);
  useEffect(() => { if (dbLoaded.current) saveToDb(KEY_REVIEW, review); }, [review, saveToDb]);

  /* ─── Daily Pulse ─── */
  const pulse = useMemo(() => {
    const today = todayLocal();
    const weekStart = getWeekStart();

    const closedToday = deals.filter(d =>
      d.stage === "مكتملة" && (d.close_date || d.updated_at || "").slice(0, 10) === today
    );
    const renewalsToday = renewals.filter(r =>
      r.status === "مكتمل" && (r.updated_at || "").slice(0, 10) === today
    );
    const closedWeek = deals.filter(d =>
      d.stage === "مكتملة" && (d.close_date || d.updated_at || "").slice(0, 10) >= weekStart
    );
    const renewalsWeek = renewals.filter(r =>
      r.status === "مكتمل" && (r.updated_at || "").slice(0, 10) >= weekStart
    );

    const revenueToday =
      closedToday.reduce((s, d) => s + (d.deal_value || 0), 0) +
      renewalsToday.reduce((s, r) => s + (r.plan_price || 0), 0);
    const weekTotal =
      closedWeek.reduce((s, d) => s + (d.deal_value || 0), 0) +
      renewalsWeek.reduce((s, r) => s + (r.plan_price || 0), 0);
    const weekPct = weeklyGoal > 0 ? Math.min(Math.round((weekTotal / weeklyGoal) * 100), 100) : 0;

    return {
      revenueToday,
      closedToday: closedToday.length,
      renewalsToday: renewalsToday.length,
      weekTotal,
      weekPct,
    };
  }, [deals, renewals, weeklyGoal]);

  /* ─── Attention Items ─── */
  const attentionItems = useMemo((): AttentionItem[] => {
    const items: AttentionItem[] = [];

    // Last note per deal (for activity freshness)
    const lastNoteMap = new Map<string, string>();
    for (const n of notes) {
      const prev = lastNoteMap.get(n.entity_id);
      if (!prev || n.created_at > prev) lastNoteMap.set(n.entity_id, n.created_at);
    }

    // Overdue renewals
    for (const r of renewals) {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") continue;
      const days = daysUntil(r.renewal_date);
      if (days < 0) {
        items.push({
          id: r.id, type: "renewal",
          title: r.customer_name,
          subtitle: r.plan_name,
          reason: `متأخر ${Math.abs(days)} يوم`,
          urgency: 400 + Math.abs(days),
          phone: r.customer_phone,
          waMsg: `مرحباً ${r.customer_name}، نود التذكير بتجديد اشتراككم في ${r.plan_name}.`,
          link: "/renewals",
          badge: "تجديد متأخر",
          badgeColor: "#EF4444",
        });
      } else if (days <= 3) {
        items.push({
          id: r.id, type: "renewal",
          title: r.customer_name,
          subtitle: r.plan_name,
          reason: days === 0 ? "يجدد اليوم" : `يجدد خلال ${days} يوم`,
          urgency: 300 + (3 - days),
          phone: r.customer_phone,
          waMsg: `مرحباً ${r.customer_name}، اشتراككم في ${r.plan_name} ${days === 0 ? "ينتهي اليوم" : `ينتهي خلال ${days} أيام`}.`,
          link: "/renewals",
          badge: "تجديد قريب",
          badgeColor: "#F59E0B",
        });
      }
    }

    // Deals waiting payment > 2 days
    for (const d of deals) {
      if (d.stage !== "انتظار الدفع") continue;
      const lastActivity = lastNoteMap.get(d.id) || d.updated_at || d.created_at;
      const days = daysAgo(lastActivity);
      if (days >= 2) {
        items.push({
          id: d.id, type: "deal",
          title: d.client_name,
          subtitle: d.assigned_rep_name || "بلا مسؤول",
          reason: `بانتظار الدفع منذ ${days} يوم`,
          urgency: 350 + days,
          phone: d.client_phone,
          waMsg: `مرحباً ${d.client_name}، نود التأكد من وصول تفاصيل الدفع. هل تحتاج مساعدة لإتمام العملية؟`,
          link: "/sales",
          badge: "انتظار دفع",
          badgeColor: "#8B5CF6",
        });
      }
    }

    // Urgent tickets open > 24 hours
    for (const t of tickets) {
      if (t.status === "محلول") continue;
      const hrs = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 3_600_000);
      if (t.priority === "عاجل" && hrs >= 24) {
        items.push({
          id: t.id, type: "ticket",
          title: t.client_name,
          subtitle: t.assigned_agent_name || "بلا مسؤول",
          reason: `عاجلة مفتوحة منذ ${hrs} ساعة`,
          urgency: 320 + hrs,
          phone: t.client_phone,
          link: "/support",
          badge: "تذكرة عاجلة",
          badgeColor: "#EF4444",
        });
      } else if (hrs >= 72) {
        items.push({
          id: t.id, type: "ticket",
          title: t.client_name,
          subtitle: t.assigned_agent_name || "بلا مسؤول",
          reason: `مفتوحة ${Math.floor(hrs / 24)} يوم`,
          urgency: 200 + hrs / 24,
          phone: t.client_phone,
          link: "/support",
          badge: "متأخرة",
          badgeColor: "#F97316",
        });
      }
    }

    // High-value stale deals (>= 10k, no activity 7+ days)
    for (const d of deals) {
      if (["مكتملة", "مرفوض مع سبب", "استهداف خاطئ", "كنسل التجربة", "انتظار الدفع"].includes(d.stage)) continue;
      const lastActivity = lastNoteMap.get(d.id) || d.last_contact || d.updated_at || d.created_at;
      const days = daysAgo(lastActivity);
      if ((d.deal_value || 0) >= 10000 && days >= 7) {
        items.push({
          id: d.id, type: "deal",
          title: d.client_name,
          subtitle: `${d.assigned_rep_name || "بلا مسؤول"} · ${formatMoney(d.deal_value)}`,
          reason: `قيمة عالية بلا تواصل ${days} يوم`,
          urgency: 150 + days,
          phone: d.client_phone,
          waMsg: `مرحباً ${d.client_name}، نتابع معكم بخصوص طلبكم. هل هناك ما يمكننا المساعدة به؟`,
          link: "/sales",
          badge: formatMoney(d.deal_value),
          badgeColor: "#7da6ff",
        });
      }
    }

    return items.sort((a, b) => b.urgency - a.urgency).slice(0, 12);
  }, [deals, tickets, renewals, notes]);

  /* ─── Team Snapshot ─── */
  const teamSnapshot = useMemo(() => {
    const weekStart = getWeekStart();
    const repMap = new Map<string, { closed: number; revenue: number; open: number }>();
    for (const d of deals) {
      const rep = d.assigned_rep_name?.trim();
      if (!rep) continue;
      if (!repMap.has(rep)) repMap.set(rep, { closed: 0, revenue: 0, open: 0 });
      const r = repMap.get(rep)!;
      if (d.stage === "مكتملة" && (d.close_date || d.updated_at || "").slice(0, 10) >= weekStart) {
        r.closed++;
        r.revenue += d.deal_value || 0;
      } else if (!["مكتملة", "مرفوض مع سبب", "استهداف خاطئ", "كنسل التجربة"].includes(d.stage)) {
        r.open++;
      }
    }
    return Array.from(repMap.entries())
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.revenue - a.revenue || b.closed - a.closed);
  }, [deals]);

  /* ─── Task handlers ─── */
  function addTask() {
    if (!newTaskText.trim()) return;
    setTasks(prev => [{ id: Date.now().toString(), text: newTaskText.trim(), done: false, createdAt: todayLocal() }, ...prev]);
    setNewTaskText("");
  }
  function toggleTask(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }
  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function updateReview(field: keyof Omit<WeeklyReview, "weekKey">, value: string) {
    setReview(prev => ({ ...prev, [field]: value }));
  }

  function saveGoal() {
    const g = parseInt(goalDraft.replace(/[^\d]/g, ""), 10);
    if (!isNaN(g) && g > 0) {
      setWeeklyGoal(g);
      upsertSalesGuideSetting(KEY_GOALS as Parameters<typeof upsertSalesGuideSetting>[0], { weeklyGoal: g }).catch(console.error);
    }
    setGoalEditing(false);
  }

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const today = todayLocal();
  const pendingTasks = tasks.filter(t => !t.done);
  const doneTasks = tasks.filter(t => t.done);
  const carryover = pendingTasks.filter(t => t.createdAt < today).length;

  const pulseBarColor =
    pulse.weekPct >= 100 ? "#10B981" :
    pulse.weekPct >= 70  ? "#00D4FF" :
    pulse.weekPct >= 40  ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-6 p-1" dir="rtl">

      {/* ══════════════════════════════════════
          HEADER
      ══════════════════════════════════════ */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(0,212,255,0.08))", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{formatArabicDate(new Date())}</p>
            <h1 className="text-2xl font-extrabold text-foreground">
              {getGreeting()}{user?.name ? `، ${user.name}` : ""}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">غرفة العمليات — كل ما يهمك في مكان واحد</p>
          </div>
          {attentionItems.length > 0 && (
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-2.5 shrink-0"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.30)" }}
            >
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div>
                <div className="text-2xl font-extrabold font-mono text-red-400">{attentionItems.length}</div>
                <div className="text-[11px] text-muted-foreground">يحتاج تدخّلك</div>
              </div>
            </div>
          )}
          {attentionItems.length === 0 && (
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-2.5 shrink-0"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.30)" }}
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div className="text-[13px] font-bold text-emerald-400">كل شيء تحت السيطرة</div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════
          النبضة اليومية
      ══════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-400" />
            النبضة اليومية
          </h2>
          <button
            onClick={() => setGoalEditing(g => !g)}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
          >
            <Settings className="w-3 h-3" />
            الهدف: {weeklyGoal.toLocaleString()} ريال/أسبوع
          </button>
        </div>

        {goalEditing && (
          <div className="mb-3 flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-xs text-muted-foreground whitespace-nowrap">الهدف الأسبوعي (ريال)</span>
            <input
              type="number"
              value={goalDraft}
              onChange={e => setGoalDraft(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveGoal()}
              className="flex-1 bg-transparent border border-white/[0.12] rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:border-violet-500/50 transition"
              dir="ltr"
              autoFocus
            />
            <button onClick={saveGoal} className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition border border-violet-500/20">حفظ</button>
            <button onClick={() => setGoalEditing(false)} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] text-muted-foreground hover:bg-white/[0.1] transition">إلغاء</button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            label="إيراد اليوم"
            value={formatMoney(pulse.revenueToday)}
            sub={`${pulse.closedToday} صفقة${pulse.renewalsToday > 0 ? ` + ${pulse.renewalsToday} تجديد` : ""}`}
            color="#10B981"
          />
          <KPICard
            label="إيراد الأسبوع"
            value={formatMoney(pulse.weekTotal)}
            sub={`من هدف ${weeklyGoal.toLocaleString()} ريال`}
            color="#00D4FF"
          />
          <KPICard
            label="تقدم الأسبوع"
            value={`${pulse.weekPct}%`}
            sub={pulse.weekPct >= 100 ? "تجاوزنا الهدف ✓" : `${formatMoney(weeklyGoal - pulse.weekTotal)} متبقي`}
            color={pulseBarColor}
          />
          <KPICard
            label="يحتاج تدخّل"
            value={String(attentionItems.length)}
            sub={attentionItems.length === 0 ? "كل شيء تحت السيطرة" : "راجع الأولويات أدناه"}
            color={attentionItems.length === 0 ? "#10B981" : "#EF4444"}
          />
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pulse.weekPct}%`, background: pulseBarColor }}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════
          يحتاج تدخّلك الآن
      ══════════════════════════════════════ */}
      {attentionItems.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            يحتاج تدخّلك الآن
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
              {attentionItems.length}
            </span>
          </h2>
          <div className="space-y-2">
            {attentionItems.map(item => (
              <AttentionCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          الفريق هذا الأسبوع
      ══════════════════════════════════════ */}
      {teamSnapshot.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              الفريق هذا الأسبوع
            </h2>
            <Link href="/team" className="text-[11px] text-muted-foreground hover:text-foreground transition flex items-center gap-1">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {teamSnapshot.slice(0, 6).map((m, i) => {
              const isTop = i === 0 && m.closed > 0;
              const isWeak = m.closed === 0 && m.open >= 5;
              const color = isTop ? "#10B981" : isWeak ? "#EF4444" : "#7da6ff";
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => {
                    const emp = employees.find((e) => e.name.trim() === m.name.trim())
                      ?? ({ id: "", org_id: "", name: m.name, status: "نشط", created_at: new Date().toISOString() } as Employee);
                    setDetailEmployee(emp);
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl text-right w-full hover:brightness-125 transition"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-bold shrink-0"
                    style={{ background: `${color}22`, color }}
                  >
                    {m.name.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{m.closed} مغلقة · {m.open} مفتوحة</p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-[13px] font-bold font-mono" style={{ color }}>{formatMoney(m.revenue)}</p>
                    {isTop && <p className="text-[10px] text-emerald-400">#1 الأسبوع</p>}
                    {isWeak && <p className="text-[10px] text-red-400">يحتاج متابعة</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          مراجعة الأسبوع (مطوية افتراضياً)
      ══════════════════════════════════════ */}
      <div className="cc-card rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <button
          onClick={() => setWeekExpanded(p => !p)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Target className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-foreground">مراجعة الأسبوع</span>
            {review.priority1 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">محدّث</span>
            )}
          </div>
          {weekExpanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />
          }
        </button>
        {weekExpanded && (
          <div className="px-4 pb-5 space-y-5 border-t border-border pt-4">
            {/* Priorities */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2.5">الأولويات الثلاث لهذا الأسبوع</p>
              <div className="space-y-2">
                {(["priority1", "priority2", "priority3"] as const).map((k, i) => (
                  <div key={k} className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-violet-400 w-4 shrink-0">{i + 1}</span>
                    <input
                      value={review[k]}
                      onChange={e => updateReview(k, e.target.value)}
                      placeholder={`الأولوية ${i + 1}...`}
                      className="flex-1 bg-transparent border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-violet-500/40 transition"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Key decision */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2.5">القرار الأهم هذا الأسبوع</p>
              <textarea
                value={review.decision}
                onChange={e => updateReview("decision", e.target.value)}
                placeholder="ما القرار الواحد الذي سيحرّك الأسبوع؟"
                rows={2}
                className="w-full bg-transparent border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-amber-500/40 transition resize-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/60 text-center">يُحفظ تلقائياً · يتجدد كل أسبوع</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          مهامي
      ══════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-foreground">مهامي</h2>
          {pendingTasks.length > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400">
              {pendingTasks.length}
            </span>
          )}
          {carryover > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              {carryover} منقولة من أمس
            </span>
          )}
        </div>

        {/* Add task */}
        <div className="flex gap-2 mb-3">
          <input
            value={newTaskText}
            onChange={e => setNewTaskText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTask()}
            placeholder="أضف مهمة جديدة... (Enter للإضافة)"
            className="flex-1 bg-transparent border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-cyan-500/40 transition"
          />
          <button
            onClick={addTask}
            className="px-3 py-2 rounded-xl bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 transition border border-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Pending */}
        <div className="space-y-1.5">
          {pendingTasks.map(task => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 p-2.5 rounded-xl group"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <button
                onClick={() => toggleTask(task.id)}
                className="w-5 h-5 rounded-md border border-white/[0.15] flex items-center justify-center hover:border-cyan-500/50 hover:bg-cyan-500/10 transition shrink-0"
              >
                <Check className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-60 transition" />
              </button>
              <span className="flex-1 text-sm text-foreground">{task.text}</span>
              {task.createdAt < today && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0">منقولة</span>
              )}
              <button
                onClick={() => removeTask(task.id)}
                className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-red-400 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {pendingTasks.length === 0 && (
            <div className="text-center py-8 text-[13px] text-muted-foreground">
              <Zap className="w-7 h-7 mx-auto mb-2 opacity-25" />
              قائمتك فارغة — أضف أول مهمة
            </div>
          )}
        </div>

        {/* Done tasks */}
        {doneTasks.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] text-muted-foreground px-1 mb-1.5">منجزة اليوم ({doneTasks.length})</p>
            <div className="space-y-1">
              {doneTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2.5 p-2 rounded-lg opacity-40 group">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0"
                  >
                    <Check className="w-3 h-3 text-cyan-400" />
                  </button>
                  <span className="flex-1 text-sm text-muted-foreground line-through">{task.text}</span>
                  <button
                    onClick={() => removeTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 transition text-muted-foreground hover:text-red-400 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════
          روابط سريعة
      ══════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: "مبيعات المكتب",  href: "/sales",         color: "#10B981", icon: <TrendingUp className="w-4 h-4" /> },
          { label: "التجديدات",       href: "/renewals",      color: "#F59E0B", icon: <RefreshCw className="w-4 h-4" /> },
          { label: "الدعم",           href: "/support",       color: "#F97316", icon: <Headphones className="w-4 h-4" /> },
          { label: "مبيعات الدعم",   href: "/support-sales", color: "#8B5CF6", icon: <Briefcase className="w-4 h-4" /> },
        ].map(q => (
          <Link
            key={q.href}
            href={q.href}
            className="rounded-xl p-3.5 flex items-center gap-2.5 transition hover:-translate-y-0.5"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${q.color}22`, color: q.color }}
            >
              {q.icon}
            </div>
            <span className="text-[13px] font-bold text-foreground">{q.label}</span>
            <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground mr-auto" />
          </Link>
        ))}
      </div>

      {/* Full employee profile panel */}
      <EmployeeDetailPanel
        employee={detailEmployee}
        open={!!detailEmployee}
        onClose={() => setDetailEmployee(null)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════════ */

function KPICard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)", borderTop: `2px solid ${color}` }}
    >
      <p className="text-[12px] text-muted-foreground mb-1.5">{label}</p>
      <p className="text-xl font-extrabold font-mono" style={{ color }}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const phone = sanitizePhone(item.phone);
  const typeIcon = item.type === "renewal" ? "🔄" : item.type === "ticket" ? "🎫" : "💼";

  return (
    <div
      className="p-3 rounded-xl flex items-start gap-3"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRight: `3px solid ${item.badgeColor}`,
      }}
    >
      <span className="text-base shrink-0 mt-0.5">{typeIcon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[13px] font-bold text-foreground">{item.title}</p>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
            style={{ background: `${item.badgeColor}20`, color: item.badgeColor }}
          >
            {item.badge}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{item.subtitle}</p>
        <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: item.badgeColor }}>
          <Clock className="w-3 h-3" /> {item.reason}
        </p>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
            title="اتصل"
          >
            <Phone className="w-3 h-3" />
          </a>
        )}
        {phone && item.waMsg && (
          <a
            href={`https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(item.waMsg)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition"
            title="واتساب"
          >
            <MessageCircle className="w-3 h-3" />
          </a>
        )}
        <Link
          href={item.link}
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] text-muted-foreground border border-white/[0.06] hover:bg-white/[0.08] transition"
          title="فتح"
        >
          <ArrowLeft className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
