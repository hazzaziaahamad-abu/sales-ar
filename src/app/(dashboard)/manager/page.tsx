"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Deal, Ticket, Renewal } from "@/types";
import { fetchDeals, fetchTickets, fetchRenewals } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, formatMoneyFull, todayLocal } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  Briefcase,
  Headphones,
  RefreshCw,
  AlertTriangle,
  Flame,
  TrendingUp,
  CheckCircle2,
  Clock,
  Phone,
  MessageCircle,
  ArrowLeft,
  Trophy,
  Target,
  DollarSign,
  Zap,
  Sparkles,
} from "lucide-react";

/* ─── Helpers ─── */
function daysAgo(date?: string): number {
  if (!date) return 9999;
  const ms = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function daysUntil(date?: string): number {
  if (!date) return 9999;
  const ms = new Date(date).getTime() - Date.now();
  return Math.floor(ms / 86_400_000);
}

function sanitizePhone(phone?: string): string {
  if (!phone) return "";
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("05") || p.startsWith("5")) p = "+966" + p.replace(/^0/, "");
  return p;
}

const ARABIC_DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatLongDate(d: Date): string {
  return `${ARABIC_DAYS[d.getDay()]}، ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "نهارك سعيد";
  return "مساء الخير";
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function ManagerDashboardPage() {
  const { user, activeOrgId: orgId } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    Promise.all([fetchDeals(), fetchTickets(), fetchRenewals()])
      .then(([d, t, r]) => {
        setDeals(d);
        setTickets(t);
        setRenewals(r);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  /* ─── Today metrics ─── */
  const today = todayLocal();
  const startOfWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const metrics = useMemo(() => {
    const activeDeals = deals.filter(
      (d) =>
        d.stage !== "مكتملة" &&
        d.stage !== "مرفوض مع سبب" &&
        d.stage !== "استهداف خاطئ" &&
        d.stage !== "كنسل التجربة"
    );
    const closedToday = deals.filter(
      (d) => d.stage === "مكتملة" && (d.close_date || d.updated_at).slice(0, 10) === today
    );
    const revenueToday = closedToday.reduce((s, d) => s + (d.deal_value || 0), 0);
    const closedThisWeek = deals.filter(
      (d) => d.stage === "مكتملة" && new Date(d.close_date || d.updated_at) >= startOfWeek
    );
    const revenueThisWeek = closedThisWeek.reduce((s, d) => s + (d.deal_value || 0), 0);

    const openTickets = tickets.filter((t) => t.status !== "محلول");
    const urgentTickets = openTickets.filter((t) => t.priority === "عاجل");

    const renewingThisWeek = renewals.filter((r) => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      const days = daysUntil(r.renewal_date);
      return days >= 0 && days <= 7;
    });
    const overdueRenewals = renewals.filter((r) => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      return daysUntil(r.renewal_date) < 0;
    });
    const renewalsCompletedThisWeek = renewals.filter(
      (r) => r.status === "مكتمل" && new Date(r.updated_at) >= startOfWeek
    );
    const renewalRevenueThisWeek = renewalsCompletedThisWeek.reduce(
      (s, r) => s + (r.plan_price || 0),
      0
    );

    return {
      activeDeals: activeDeals.length,
      closedToday: closedToday.length,
      revenueToday,
      closedThisWeek: closedThisWeek.length,
      revenueThisWeek,
      openTickets: openTickets.length,
      urgentTickets: urgentTickets.length,
      renewingThisWeek: renewingThisWeek.length,
      overdueRenewals: overdueRenewals.length,
      renewalsCompletedThisWeek: renewalsCompletedThisWeek.length,
      renewalRevenueThisWeek,
    };
  }, [deals, tickets, renewals, today, startOfWeek]);

  /* ─── Action lists ─── */
  const officeActions = useMemo(() => {
    const officeDeals = deals.filter(
      (d) =>
        d.sales_type === "office" &&
        d.stage !== "مكتملة" &&
        d.stage !== "مرفوض مع سبب" &&
        d.stage !== "استهداف خاطئ" &&
        d.stage !== "كنسل التجربة"
    );
    const scored = officeDeals.map((d) => {
      const days = daysAgo(d.last_contact || d.updated_at || d.created_at);
      let urgency = 0;
      let reason = "";
      if (d.stage === "انتظار الدفع" && days >= 3) {
        urgency = 100 + days;
        reason = `بانتظار الدفع منذ ${days} يوم`;
      } else if ((d.deal_value || 0) >= 10000 && days >= 5) {
        urgency = 80 + days;
        reason = `صفقة قيمة بلا تواصل ${days} يوم`;
      } else if (days >= 14) {
        urgency = 60 + days;
        reason = `راكدة ${days} يوم`;
      }
      return { deal: d, urgency, reason };
    });
    return scored
      .filter((x) => x.urgency > 0)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5);
  }, [deals]);

  const supportActions = useMemo(() => {
    const open = tickets.filter((t) => t.status !== "محلول");
    const scored = open.map((t) => {
      const hrsOpen = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 3_600_000);
      let urgency = 0;
      let reason = "";
      if (t.priority === "عاجل" && hrsOpen >= 24) {
        urgency = 200 + hrsOpen;
        reason = `عاجلة منذ ${hrsOpen} ساعة`;
      } else if (hrsOpen >= 72) {
        urgency = 100 + hrsOpen / 24;
        reason = `مفتوحة منذ ${Math.floor(hrsOpen / 24)} يوم`;
      } else if (!t.assigned_agent_name && hrsOpen >= 4) {
        urgency = 80 + hrsOpen;
        reason = `بلا مسؤول منذ ${hrsOpen} ساعة`;
      }
      return { ticket: t, urgency, reason };
    });
    return scored
      .filter((x) => x.urgency > 0)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5);
  }, [tickets]);

  const renewalActions = useMemo(() => {
    const active = renewals.filter((r) => r.status !== "مكتمل" && r.status !== "ملغي بسبب");
    const scored = active.map((r) => {
      const days = daysUntil(r.renewal_date);
      let urgency = 0;
      let reason = "";
      if (days < 0) {
        urgency = 200 + Math.abs(days);
        reason = `متأخر ${Math.abs(days)} يوم`;
      } else if (r.status === "انتظار الدفع") {
        urgency = 150 + daysAgo(r.updated_at);
        reason = `بانتظار الدفع · يجدد خلال ${days} يوم`;
      } else if (days <= 7 && days >= 0) {
        urgency = 100 + (7 - days);
        reason = days === 0 ? "يجدد اليوم" : `يجدد خلال ${days} يوم`;
      } else if (r.status === "متردد" || r.status === "مافي تجاوب") {
        urgency = 60;
        reason = r.status;
      }
      return { renewal: r, urgency, reason };
    });
    return scored
      .filter((x) => x.urgency > 0)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 5);
  }, [renewals]);

  /* ─── Team snapshot ─── */
  const teamSnapshot = useMemo(() => {
    const repMap = new Map<string, { closedDeals: number; closedRevenue: number; openDeals: number }>();
    deals.forEach((d) => {
      const rep = d.assigned_rep_name?.trim();
      if (!rep) return;
      if (!repMap.has(rep)) repMap.set(rep, { closedDeals: 0, closedRevenue: 0, openDeals: 0 });
      const r = repMap.get(rep)!;
      if (d.stage === "مكتملة" && new Date(d.close_date || d.updated_at) >= startOfWeek) {
        r.closedDeals++;
        r.closedRevenue += d.deal_value || 0;
      } else if (d.stage !== "مرفوض مع سبب" && d.stage !== "استهداف خاطئ" && d.stage !== "كنسل التجربة" && d.stage !== "مكتملة") {
        r.openDeals++;
      }
    });
    return Array.from(repMap.entries())
      .map(([rep, stats]) => ({ rep, ...stats }))
      .sort((a, b) => b.closedRevenue - a.closedRevenue);
  }, [deals, startOfWeek]);

  /* ─── Manager recommendations ─── */
  const recommendations = useMemo(() => {
    const recs: { hex: string; icon: React.ReactNode; text: string }[] = [];
    if (metrics.overdueRenewals > 0) {
      recs.push({
        hex: "#EF4444",
        icon: <AlertTriangle className="w-4 h-4" />,
        text: `لديك ${metrics.overdueRenewals} تجديد متأخر — اتصل بهم اليوم قبل أي شيء آخر`,
      });
    }
    if (metrics.urgentTickets > 0) {
      recs.push({
        hex: "#F59E0B",
        icon: <Headphones className="w-4 h-4" />,
        text: `${metrics.urgentTickets} تذكرة عاجلة مفتوحة — تابع فريق الدعم`,
      });
    }
    if (officeActions.length >= 3) {
      recs.push({
        hex: "#8B5CF6",
        icon: <Briefcase className="w-4 h-4" />,
        text: `${officeActions.length} صفقة مكتب تحتاج تدخّلك — اجتماع سريع مع المسؤولين`,
      });
    }
    const reps = teamSnapshot.filter((t) => t.closedDeals === 0 && t.openDeals >= 5);
    if (reps.length > 0) {
      recs.push({
        hex: "#7da6ff",
        icon: <Target className="w-4 h-4" />,
        text: `${reps[0].rep} عنده ${reps[0].openDeals} صفقة ولم يغلق هذا الأسبوع — مراجعة فردية`,
      });
    }
    if (metrics.closedToday > 0) {
      recs.push({
        hex: "#10B981",
        icon: <CheckCircle2 className="w-4 h-4" />,
        text: `${metrics.closedToday} صفقة أُغلقت اليوم بقيمة ${formatMoney(metrics.revenueToday)} — بارك الفريق`,
      });
    }
    if (recs.length === 0) {
      recs.push({
        hex: "#10B981",
        icon: <Sparkles className="w-4 h-4" />,
        text: "كل شيء تحت السيطرة. وقت ممتاز للتركيز على التطوير والتدريب.",
      });
    }
    return recs.slice(0, 5);
  }, [metrics, officeActions, teamSnapshot]);

  const totalNeedsAttention = officeActions.length + supportActions.length + renewalActions.length;

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* ═══ HERO ═══ */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(0,212,255,0.08))",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-[13px] text-muted-foreground mb-1">
              {formatLongDate(new Date())}
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">
              {getGreeting()}{user?.name ? `، ${user.name}` : ""}
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              ملخّص يومك في ١٥ دقيقة — ابدأ من الأعلى
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="rounded-2xl px-5 py-3 flex items-center gap-3"
              style={{
                background: totalNeedsAttention > 0 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                border: `1px solid ${totalNeedsAttention > 0 ? "rgba(239,68,68,0.30)" : "rgba(16,185,129,0.30)"}`,
              }}
            >
              <Flame
                className="w-5 h-5"
                style={{ color: totalNeedsAttention > 0 ? "#EF4444" : "#10B981" }}
              />
              <div>
                <div
                  className="text-2xl font-extrabold font-mono"
                  style={{ color: totalNeedsAttention > 0 ? "#EF4444" : "#10B981" }}
                >
                  {totalNeedsAttention}
                </div>
                <div className="text-[12px] text-muted-foreground">يحتاج تدخّلك</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TODAY KPIs ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إيراد اليوم"
          value={formatMoney(metrics.revenueToday)}
          color="green"
          icon={<DollarSign className="w-5 h-5 text-cc-green" />}
          subtext={`${metrics.closedToday} صفقة مغلقة`}
          tooltip={formatMoneyFull(metrics.revenueToday)}
        />
        <StatCard
          label="إيراد الأسبوع"
          value={formatMoney(metrics.revenueThisWeek + metrics.renewalRevenueThisWeek)}
          color="cyan"
          icon={<TrendingUp className="w-5 h-5 text-cyan" />}
          subtext={`${metrics.closedThisWeek} صفقة + ${metrics.renewalsCompletedThisWeek} تجديد`}
        />
        <StatCard
          label="صفقات نشطة"
          value={metrics.activeDeals.toString()}
          color="purple"
          icon={<Briefcase className="w-5 h-5 text-cc-purple" />}
          subtext={`${officeActions.length} تحتاج تدخّل`}
        />
        <StatCard
          label="تجديدات هذا الأسبوع"
          value={metrics.renewingThisWeek.toString()}
          color={metrics.overdueRenewals > 0 ? "red" : "amber"}
          icon={<RefreshCw className="w-5 h-5 text-amber" />}
          subtext={metrics.overdueRenewals > 0 ? `+${metrics.overdueRenewals} متأخر` : "في الموعد"}
        />
      </div>

      {/* ═══ MANAGER RECOMMENDATIONS ═══ */}
      <div className="cc-card rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-dim flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber" />
          </div>
          <h2 className="text-sm font-bold text-foreground">توصياتك لهذا اليوم</h2>
        </div>
        <div className="space-y-2">
          {recommendations.map((r, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{
                background: `${r.hex}10`,
                border: `1px solid ${r.hex}33`,
                borderRightWidth: "3px",
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${r.hex}22`, color: r.hex }}
              >
                {r.icon}
              </div>
              <div className="text-[13px] text-foreground pt-1.5">{r.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ ACTION COLUMNS ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActionColumn
          title="مبيعات المكتب"
          icon={<Briefcase className="w-4 h-4 text-cc-purple" />}
          hex="#8B5CF6"
          link="/sales"
          count={officeActions.length}
          empty="كل صفقات المكتب تحت السيطرة"
        >
          {officeActions.map(({ deal, reason }) => (
            <ActionCard
              key={deal.id}
              title={deal.client_name}
              subtitle={deal.assigned_rep_name || "بلا مسؤول"}
              reason={reason}
              meta={formatMoney(deal.deal_value || 0)}
              phone={deal.client_phone}
            />
          ))}
        </ActionColumn>

        <ActionColumn
          title="الدعم"
          icon={<Headphones className="w-4 h-4 text-orange-400" />}
          hex="#F97316"
          link="/support"
          count={supportActions.length}
          empty="كل التذاكر تحت السيطرة"
        >
          {supportActions.map(({ ticket, reason }) => (
            <ActionCard
              key={ticket.id}
              title={ticket.client_name}
              subtitle={ticket.assigned_agent_name || "بلا مسؤول"}
              reason={reason}
              meta={ticket.priority || "—"}
              phone={ticket.client_phone}
            />
          ))}
        </ActionColumn>

        <ActionColumn
          title="التجديدات"
          icon={<RefreshCw className="w-4 h-4 text-amber" />}
          hex="#F59E0B"
          link="/renewals"
          count={renewalActions.length}
          empty="كل التجديدات تحت السيطرة"
        >
          {renewalActions.map(({ renewal, reason }) => (
            <ActionCard
              key={renewal.id}
              title={renewal.customer_name}
              subtitle={renewal.assigned_rep || "بلا مسؤول"}
              reason={reason}
              meta={formatMoney(renewal.plan_price || 0)}
              phone={renewal.customer_phone}
            />
          ))}
        </ActionColumn>
      </div>

      {/* ═══ TEAM SNAPSHOT ═══ */}
      <div className="cc-card rounded-2xl border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-dim flex items-center justify-center">
              <Trophy className="w-4 h-4 text-cyan" />
            </div>
            <h2 className="text-sm font-bold text-foreground">أداء الفريق هذا الأسبوع</h2>
          </div>
          <Link href="/team" className="text-[12px] text-cyan hover:underline flex items-center gap-1">
            عرض الكل <ArrowLeft className="w-3 h-3" />
          </Link>
        </div>
        {teamSnapshot.length === 0 ? (
          <div className="text-center text-[13px] text-muted-foreground py-6">
            لا توجد بيانات لهذا الأسبوع بعد
          </div>
        ) : (
          <div className="space-y-2">
            {teamSnapshot.slice(0, 6).map((m, i) => {
              const isTop = i < 3 && m.closedDeals > 0;
              const isWeak = m.closedDeals === 0 && m.openDeals >= 5;
              const hex = isTop ? "#10B981" : isWeak ? "#EF4444" : "#7da6ff";
              const badge = isTop ? `#${i + 1}` : isWeak ? "يحتاج متابعة" : "—";
              return (
                <div
                  key={m.rep}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-[13px]"
                    style={{ background: `${hex}22`, color: hex }}
                  >
                    {m.rep.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground">{m.rep}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.closedDeals} مغلقة · {m.openDeals} مفتوحة
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="text-[14px] font-bold font-mono" style={{ color: hex }}>
                      {formatMoney(m.closedRevenue)}
                    </div>
                    <div className="text-[11px]" style={{ color: hex }}>
                      {badge}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ QUICK LINKS ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "السكرتير", href: "/secretary", icon: <Sparkles className="w-4 h-4" />, hex: "#8B5CF6" },
          { label: "المبيعات", href: "/sales", icon: <Briefcase className="w-4 h-4" />, hex: "#10B981" },
          { label: "التجديدات", href: "/renewals", icon: <RefreshCw className="w-4 h-4" />, hex: "#F59E0B" },
          { label: "الدعم", href: "/support", icon: <Headphones className="w-4 h-4" />, hex: "#F97316" },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="rounded-xl p-4 flex items-center gap-3 transition hover:-translate-y-0.5"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: `${q.hex}22`, color: q.hex }}
            >
              {q.icon}
            </div>
            <div className="text-[13px] font-bold text-foreground">{q.label}</div>
            <ArrowLeft className="w-4 h-4 text-muted-foreground mr-auto" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function ActionColumn({
  title,
  icon,
  hex,
  link,
  count,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  hex: string;
  link: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cc-card rounded-2xl border border-white/[0.06] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `${hex}22` }}
          >
            {icon}
          </div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
        </div>
        <span
          className="text-[12px] font-bold font-mono px-2.5 py-1 rounded-full"
          style={{ background: count > 0 ? `${hex}22` : "var(--border)", color: count > 0 ? hex : "var(--muted-foreground)" }}
        >
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="text-center py-8 px-4">
          <CheckCircle2 className="w-8 h-8 mx-auto text-cc-green mb-2 opacity-50" />
          <p className="text-[12px] text-muted-foreground">{empty}</p>
        </div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
      <Link
        href={link}
        className="mt-4 flex items-center justify-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition py-2"
      >
        عرض كل {title}
        <ArrowLeft className="w-3 h-3" />
      </Link>
    </div>
  );
}

function ActionCard({
  title,
  subtitle,
  reason,
  meta,
  phone,
}: {
  title: string;
  subtitle: string;
  reason: string;
  meta: string;
  phone?: string;
}) {
  const cleanPhone = sanitizePhone(phone);
  return (
    <div
      className="p-3 rounded-xl"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-foreground truncate">{title}</div>
          <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
        </div>
        <div className="text-[11px] font-mono font-bold text-foreground shrink-0">{meta}</div>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-cc-red mb-2">
        <Clock className="w-3 h-3" />
        {reason}
      </div>
      {cleanPhone && (
        <div className="flex gap-1.5">
          <a
            href={`tel:${cleanPhone}`}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition"
          >
            <Phone className="w-3 h-3" /> اتصل
          </a>
          <a
            href={`https://wa.me/${cleanPhone.replace(/^\+/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition"
          >
            <MessageCircle className="w-3 h-3" /> واتساب
          </a>
        </div>
      )}
    </div>
  );
}
