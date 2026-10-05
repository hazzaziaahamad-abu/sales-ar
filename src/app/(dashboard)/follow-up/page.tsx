"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BarChart2, AlertTriangle, Users, Wrench, ArrowLeft, CheckCircle2, RefreshCw,
} from "lucide-react";
import {
  fetchDeals, fetchTickets, fetchRenewals, fetchEmployeeTasks, fetchProjects,
  fetchSalesGuideSettings, fetchRecentFollowUpNotes,
} from "@/lib/supabase/db";
import type { Deal, Ticket, Renewal, EmployeeTask, Project } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, todayLocal, dateToLocal } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Helpers ─── */
const CLOSED_DEAL_STAGES = ["مكتملة", "مرفوض مع سبب", "استهداف خاطئ", "كنسل التجربة"];
const INACTIVE_RENEWAL_STATUSES = ["مكتمل", "ملغي بسبب"];
const DONE_CHALLENGE_STATUSES = ["resolved", "closed"];

function daysAgo(date?: string): number {
  if (!date) return 9999;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000));
}
function daysUntil(date?: string): number {
  if (!date) return 9999;
  return Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000);
}
function hoursAgo(date?: string): number {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3_600_000));
}
/** بداية الأسبوع (السبت) وعدد الأيام المنقضية منه، بما فيها اليوم. */
function weekInfo(): { start: string; elapsedDays: number } {
  const now = new Date();
  const diff = (now.getDay() + 1) % 7;
  const sat = new Date(now);
  sat.setDate(now.getDate() - diff);
  return { start: dateToLocal(sat), elapsedDays: diff + 1 };
}

/* ─── Types ─── */
type Health = "good" | "warn" | "bad";

interface PillarItem {
  key: string;
  title: string;
  detail: string;
  tone: Health;
}

interface Challenge {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  status: string;
  created_at: string;
}

interface StoredSetting { setting_key: string; setting_value: unknown }

const HEALTH_STYLE: Record<Health, { color: string; label: string }> = {
  good: { color: "#10B981", label: "سليم" },
  warn: { color: "#F59E0B", label: "يحتاج انتباه" },
  bad:  { color: "#EF4444", label: "يحتاج تدخّل" },
};

function healthFromCount(count: number, badAt: number): Health {
  if (count === 0) return "good";
  return count >= badAt ? "bad" : "warn";
}

/* ═══════════════════════════════════════════════════════════════ */
export default function FollowUpPage() {
  const { user, activeOrgId } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [notes, setNotes] = useState<{ entity_id: string; created_at: string }[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState(17500);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  function reload() {
    setLoading(true);
    setFailed(false);
    setReloadKey(k => k + 1);
  }

  /* ─── Load ─── */
  useEffect(() => {
    Promise.all([
      fetchDeals(),
      fetchTickets(),
      fetchRenewals(),
      fetchEmployeeTasks().catch(() => [] as EmployeeTask[]),
      fetchProjects().catch(() => [] as Project[]),
      fetchSalesGuideSettings().catch(() => []),
      fetchRecentFollowUpNotes(200).catch(() => []),
    ]).then(([d, t, r, tk, p, settings, n]) => {
      setDeals(d);
      setTickets(t);
      setRenewals(r);
      setTasks(tk);
      setProjects(p);
      setNotes(n as { entity_id: string; created_at: string }[]);
      // نفس الهدف الأسبوعي المحفوظ في غرفة العمليات
      const goals = (settings as unknown as StoredSetting[])
        .find(s => s.setting_key === "ops_goals")?.setting_value as { weeklyGoal?: number } | undefined;
      if (goals?.weeklyGoal) setWeeklyGoal(goals.weeklyGoal);
      setLoadedAt(new Date());
    }).catch(err => {
      console.error(err);
      setFailed(true);
    }).finally(() => setLoading(false));

    // التحديات متاحة فقط لمن يملك صلاحية إدارتها — نتجاهل الفشل ونخفي الرقم
    if (activeOrgId) {
      fetch(`/api/challenges?orgId=${activeOrgId}`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => setChallenges(data?.challenges ?? null))
        .catch(() => setChallenges(null));
    }
  }, [activeOrgId, reloadKey]);

  /* ─── 1) الأداء ─── */
  const performance = useMemo(() => {
    const today = todayLocal();
    const { start, elapsedDays } = weekInfo();
    const closeDay = (d: Deal) => (d.close_date || d.updated_at || "").slice(0, 10);

    const closedWeek = deals.filter(d => d.stage === "مكتملة" && closeDay(d) >= start);
    const renewedWeek = renewals.filter(r => r.status === "مكتمل" && (r.updated_at || "").slice(0, 10) >= start);
    const weekTotal =
      closedWeek.reduce((s, d) => s + (d.deal_value || 0), 0) +
      renewedWeek.reduce((s, r) => s + (r.plan_price || 0), 0);
    const weekPct = weeklyGoal > 0 ? Math.round((weekTotal / weeklyGoal) * 100) : 0;
    const expectedPct = Math.round((elapsedDays / 7) * 100);
    const closedToday = deals.filter(d => d.stage === "مكتملة" && closeDay(d) === today).length;

    // موظفين بلا إغلاق هذا الأسبوع ولديهم صفقات مفتوحة كثيرة
    const reps = new Map<string, { closed: number; open: number }>();
    for (const d of deals) {
      const rep = d.assigned_rep_name?.trim();
      if (!rep) continue;
      const r = reps.get(rep) ?? { closed: 0, open: 0 };
      if (d.stage === "مكتملة" && closeDay(d) >= start) r.closed++;
      else if (!CLOSED_DEAL_STAGES.includes(d.stage)) r.open++;
      reps.set(rep, r);
    }
    const weakReps = Array.from(reps.entries())
      .filter(([, r]) => r.closed === 0 && r.open >= 5)
      .sort((a, b) => b[1].open - a[1].open);

    const health: Health =
      weekPct >= expectedPct ? "good" :
      weekPct >= expectedPct / 2 ? "warn" : "bad";

    const items: PillarItem[] = weakReps.slice(0, 5).map(([name, r]) => ({
      key: name,
      title: name,
      detail: `بلا إغلاق هذا الأسبوع · ${r.open} صفقة مفتوحة`,
      tone: "warn",
    }));

    return { weekTotal, weekPct, expectedPct, closedToday, weakCount: weakReps.length, health, items };
  }, [deals, renewals, weeklyGoal]);

  /* ─── 2) الأعطال ─── */
  const stuck = useMemo(() => {
    const lastNote = new Map<string, string>();
    for (const n of notes) {
      const prev = lastNote.get(n.entity_id);
      if (!prev || n.created_at > prev) lastNote.set(n.entity_id, n.created_at);
    }
    const items: (PillarItem & { urgency: number })[] = [];

    for (const r of renewals) {
      if (INACTIVE_RENEWAL_STATUSES.includes(r.status)) continue;
      const days = daysUntil(r.renewal_date);
      if (days < 0) {
        items.push({
          key: `r-${r.id}`, title: r.customer_name, tone: "bad", urgency: 400 + Math.abs(days),
          detail: `تجديد متأخر ${Math.abs(days)} يوم · ${r.assigned_rep || "بلا مسؤول"}`,
        });
      }
    }
    for (const d of deals) {
      if (CLOSED_DEAL_STAGES.includes(d.stage)) continue;
      const days = daysAgo(lastNote.get(d.id) || d.last_contact || d.updated_at || d.created_at);
      if (d.stage === "انتظار الدفع" && days >= 2) {
        items.push({
          key: `d-${d.id}`, title: d.client_name, tone: "bad", urgency: 350 + days,
          detail: `بانتظار الدفع منذ ${days} يوم · ${d.assigned_rep_name || "بلا مسؤول"}`,
        });
      } else if (!d.assigned_rep_name?.trim()) {
        items.push({
          key: `d-${d.id}`, title: d.client_name, tone: "warn", urgency: 250,
          detail: "صفقة مفتوحة بدون مسؤول",
        });
      } else if (days >= 7) {
        items.push({
          key: `d-${d.id}`, title: d.client_name, tone: "warn", urgency: 100 + days,
          detail: `بلا تواصل ${days} يوم · ${d.assigned_rep_name}`,
        });
      }
    }
    for (const t of tickets) {
      if (t.status === "محلول") continue;
      if (!t.assigned_agent_name?.trim()) {
        items.push({
          key: `t-${t.id}`, title: t.client_name, tone: "warn", urgency: 260,
          detail: "تذكرة مفتوحة بدون مسؤول",
        });
      }
    }

    items.sort((a, b) => b.urgency - a.urgency);
    const badCount = items.filter(i => i.tone === "bad").length;
    const health: Health = badCount > 0 ? "bad" : items.length > 0 ? "warn" : "good";
    return {
      total: items.length,
      overdueRenewals: items.filter(i => i.key.startsWith("r-")).length,
      unassigned: items.filter(i => i.detail.includes("بدون مسؤول")).length,
      health,
      items: items.slice(0, 6),
    };
  }, [deals, tickets, renewals, notes]);

  /* ─── 3) الفريق ─── */
  const team = useMemo(() => {
    const today = todayLocal();
    const active = tasks.filter(t => t.status === "pending" || t.status === "in_progress");
    const overdue = active.filter(t => t.due_date && t.due_date < today);
    const dueToday = active.filter(t => t.due_date === today);
    const doneToday = tasks.filter(t => t.status === "completed" && (t.completed_at || "").slice(0, 10) === today);

    const byEmployee = new Map<string, number>();
    for (const t of overdue) {
      const name = t.assigned_to_name?.trim() || "غير محدد";
      byEmployee.set(name, (byEmployee.get(name) ?? 0) + 1);
    }
    const items: PillarItem[] = Array.from(byEmployee.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        key: name, title: name, detail: `${count} مهمة متأخرة`, tone: count >= 3 ? "bad" : "warn",
      }));

    return {
      overdue: overdue.length,
      dueToday: dueToday.length,
      doneToday: doneToday.length,
      health: healthFromCount(overdue.length, 5),
      items,
    };
  }, [tasks]);

  /* ─── 4) التقنية ─── */
  const tech = useMemo(() => {
    const today = todayLocal();
    const open = tickets.filter(t => t.status !== "محلول");
    const urgent = open.filter(t => t.priority === "عاجل");
    const lateProjects = projects.filter(p => p.due_date && p.due_date < today && (p.progress ?? 0) < 100);
    const openChallenges = (challenges ?? []).filter(c => !DONE_CHALLENGE_STATUSES.includes(c.status));
    const highChallenges = openChallenges.filter(c => c.severity === "high");

    const items: (PillarItem & { urgency: number })[] = [
      ...urgent.map(t => {
        const hrs = hoursAgo(t.created_at);
        return {
          key: `t-${t.id}`, title: t.client_name, tone: "bad" as Health, urgency: 300 + hrs,
          detail: `تذكرة عاجلة مفتوحة منذ ${hrs} ساعة${t.issue ? ` · ${t.issue}` : ""}`,
        };
      }),
      ...highChallenges.map(c => ({
        key: `c-${c.id}`, title: c.title, tone: "bad" as Health, urgency: 250,
        detail: "تحدي بخطورة عالية لم يُحل",
      })),
      ...lateProjects.map(p => ({
        key: `p-${p.id}`, title: p.name, tone: "warn" as Health, urgency: 100 + daysAgo(p.due_date),
        detail: `تطوير متأخر ${daysAgo(p.due_date)} يوم · الإنجاز ${p.progress ?? 0}%`,
      })),
    ].sort((a, b) => b.urgency - a.urgency);

    const health: Health =
      urgent.length > 0 || highChallenges.length > 0 ? "bad" :
      open.length > 10 || lateProjects.length > 0 ? "warn" : "good";

    return {
      open: open.length,
      urgent: urgent.length,
      openChallenges: challenges ? openChallenges.length : null,
      lateProjects: lateProjects.length,
      health,
      items: items.slice(0, 6),
    };
  }, [tickets, projects, challenges]);

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="p-8 text-center space-y-3" dir="rtl">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
        <p className="text-sm text-foreground">تعذّر تحميل بيانات المتابعة</p>
        <button
          onClick={reload}
          className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const pillars = [performance.health, stuck.health, team.health, tech.health];
  const needAction = pillars.filter(h => h === "bad").length;

  return (
    <div className="space-y-6 p-1" dir="rtl">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(0,212,255,0.08))", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">
              لوحة المتابعة{user?.name ? ` — ${user.name}` : ""}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              الأداء · الأعطال · الفريق · التقنية — ابدئي من الخانة الحمراء
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="rounded-xl px-4 py-2.5 flex items-center gap-2"
              style={{
                background: needAction ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                border: `1px solid ${needAction ? "rgba(239,68,68,0.30)" : "rgba(16,185,129,0.30)"}`,
              }}
            >
              {needAction
                ? <AlertTriangle className="w-5 h-5 text-red-400" />
                : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              <span className={`text-[13px] font-bold ${needAction ? "text-red-400" : "text-emerald-400"}`}>
                {needAction ? `${needAction} من 4 تحتاج تدخّل` : "كل شيء تحت السيطرة"}
              </span>
            </div>
            <button
              onClick={reload}
              title={loadedAt ? `آخر تحديث ${loadedAt.toLocaleTimeString("ar-SA")}` : "تحديث"}
              className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-muted-foreground hover:text-foreground transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Pillar
          icon={<BarChart2 className="w-4 h-4" />}
          title="الأداء"
          health={performance.health}
          stats={[
            { label: "تحقيق هدف الأسبوع", value: `${performance.weekPct}%`, sub: `المتوقع حتى اليوم ${performance.expectedPct}%` },
            { label: "إيراد الأسبوع", value: formatMoney(performance.weekTotal), sub: `من ${formatMoney(weeklyGoal)}` },
            { label: "إغلاقات اليوم", value: String(performance.closedToday) },
          ]}
          itemsTitle="موظفين يحتاجون متابعة"
          items={performance.items}
          emptyText="كل الموظفين عندهم إغلاقات هذا الأسبوع"
          links={[
            { href: "/registration-gaps", label: "تقرير الأداء" },
            { href: "/daily-huddle", label: "المتابعة اليومية" },
            { href: "/operations", label: "غرفة العمليات" },
          ]}
        />

        <Pillar
          icon={<AlertTriangle className="w-4 h-4" />}
          title="الأعطال — شي واقف؟"
          health={stuck.health}
          stats={[
            { label: "عناصر عالقة", value: String(stuck.total) },
            { label: "تجديدات متأخرة", value: String(stuck.overdueRenewals) },
            { label: "بدون مسؤول", value: String(stuck.unassigned) },
          ]}
          itemsTitle="الأهم أولاً"
          items={stuck.items}
          emptyText="ما في شي عالق"
          links={[
            { href: "/ai-supervisor", label: "مشرف AI" },
            { href: "/renewals", label: "التجديدات" },
            { href: "/sales", label: "المبيعات" },
          ]}
        />

        <Pillar
          icon={<Users className="w-4 h-4" />}
          title="تحريك الفريق"
          health={team.health}
          stats={[
            { label: "مهام متأخرة", value: String(team.overdue) },
            { label: "مستحقة اليوم", value: String(team.dueToday) },
            { label: "أُنجزت اليوم", value: String(team.doneToday) },
          ]}
          itemsTitle="مين عنده مهام متأخرة"
          items={team.items}
          emptyText="ما في مهام متأخرة"
          links={[
            { href: "/tasks", label: "إدارة المهام" },
            { href: "/secretary", label: "السكرتير التنفيذي" },
          ]}
        />

        <Pillar
          icon={<Wrench className="w-4 h-4" />}
          title="المشاكل التقنية"
          health={tech.health}
          stats={[
            { label: "تذاكر مفتوحة", value: String(tech.open) },
            { label: "عاجلة", value: String(tech.urgent) },
            tech.openChallenges !== null
              ? { label: "تحديات مفتوحة", value: String(tech.openChallenges) }
              : { label: "تطويرات متأخرة", value: String(tech.lateProjects) },
          ]}
          itemsTitle="يحتاج حل"
          items={tech.items}
          emptyText="ما في مشاكل تقنية عاجلة"
          links={[
            { href: "/support", label: "الدعم" },
            { href: "/challenges", label: "معالجة التحديات" },
            { href: "/development", label: "التطويرات" },
          ]}
        />
      </div>
    </div>
  );
}

/* ─── Pillar card ─── */
function Pillar({
  icon, title, health, stats, itemsTitle, items, emptyText, links,
}: {
  icon: ReactNode;
  title: string;
  health: Health;
  stats: { label: string; value: string; sub?: string }[];
  itemsTitle: string;
  items: PillarItem[];
  emptyText: string;
  links: { href: string; label: string }[];
}) {
  const hs = HEALTH_STYLE[health];
  return (
    <section
      className="rounded-2xl p-4 flex flex-col gap-4"
      style={{ background: "var(--card)", border: "1px solid var(--border)", borderTop: `3px solid ${hs.color}` }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <span style={{ color: hs.color }}>{icon}</span>
          {title}
        </h2>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${hs.color}22`, color: hs.color }}
        >
          {hs.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl p-2.5 bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className="text-lg font-extrabold font-mono text-foreground mt-0.5">{s.value}</p>
            {s.sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="flex-1">
        <p className="text-[11px] font-medium text-muted-foreground mb-2">{itemsTitle}</p>
        {items.length === 0 ? (
          <p className="text-[12px] text-emerald-400 flex items-center gap-1.5 py-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {emptyText}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map(it => (
              <li
                key={it.key}
                className="flex items-start gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: HEALTH_STYLE[it.tone].color }}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate">{it.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{it.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-white/[0.06]">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition flex items-center gap-1"
          >
            {l.label} <ArrowLeft className="w-3 h-3" />
          </Link>
        ))}
      </div>
    </section>
  );
}
