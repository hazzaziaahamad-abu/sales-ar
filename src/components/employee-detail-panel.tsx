"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ColorBadge } from "@/components/ui/color-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  X, Phone, MessageCircle, Mail, TrendingUp, Headphones, RefreshCw,
  ListTodo, GraduationCap, Award, Banknote, Clock, CheckCircle2, Briefcase,
} from "lucide-react";
import {
  fetchDeals, fetchTickets, fetchRenewals, fetchEmployeeTasks, fetchAllLearningProgress,
} from "@/lib/supabase/db";
import type { Employee, Deal, Ticket, Renewal, EmployeeTask } from "@/types";
import { formatMoney, saudiDateStr } from "@/lib/utils/format";
import { getAcademyStats } from "@/components/academy/LearningAcademy";

/* ---------- helpers (shared with team page) ---------- */

const STATUS_COLOR: Record<string, "green" | "amber" | "blue" | "red"> = {
  "نشط": "green",
  "مشغول": "amber",
  "متاح": "blue",
  "إجازة": "red",
};

const LEVELS = [
  { label: "استثنائي", color: "text-cyan", bg: "bg-cyan/10", ring: "ring-cyan/30", bar: "bg-cyan", min: 85 },
  { label: "متميّز", color: "text-cc-green", bg: "bg-cc-green/10", ring: "ring-cc-green/30", bar: "bg-cc-green", min: 70 },
  { label: "جيد", color: "text-amber", bg: "bg-amber/10", ring: "ring-amber/30", bar: "bg-amber", min: 50 },
  { label: "يحتاج تطوير", color: "text-orange-400", bg: "bg-orange-400/10", ring: "ring-orange-400/30", bar: "bg-orange-400", min: 30 },
  { label: "ضعيف", color: "text-cc-red", bg: "bg-cc-red/10", ring: "ring-cc-red/30", bar: "bg-cc-red", min: 0 },
];
const getLevel = (score: number) => LEVELS.find((l) => score >= l.min) || LEVELS[LEVELS.length - 1];

function computeScore(s: { totalDeals: number; closedDeals: number; dealsValue: number; totalTickets: number; resolvedTickets: number }): number {
  const totalTasks = s.totalDeals + s.totalTickets;
  const completedTasks = s.closedDeals + s.resolvedTickets;
  if (totalTasks === 0) return 0;
  let score = (completedTasks / totalTasks) * 40;
  score += Math.min(1, totalTasks / 20) * 30;
  if (s.dealsValue > 0) score += Math.min(1, s.dealsValue / 50000) * 20;
  if (s.totalTickets > 0) score += (s.resolvedTickets / s.totalTickets) * 10;
  return Math.min(100, Math.round(score));
}

function sanitizePhone(p?: string): string {
  if (!p) return "";
  let s = p.replace(/[^\d+]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("05") || s.startsWith("5")) s = "+966" + s.replace(/^0/, "");
  return s;
}

type Period = "day" | "week" | "month" | "all";
const PERIOD_LABEL: Record<Period, string> = { day: "اليوم", week: "الأسبوع", month: "الشهر", all: "الكل" };

function periodCutoff(period: Period): number {
  if (period === "all") return 0;
  const now = new Date();
  if (period === "day") { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }
  if (period === "week") { const d = new Date(now); d.setDate(now.getDate() - ((now.getDay() + 1) % 7)); d.setHours(0, 0, 0, 0); return d.getTime(); }
  const d = new Date(now.getFullYear(), now.getMonth(), 1); return d.getTime();
}

interface Props {
  employee: Employee | null;
  open: boolean;
  onClose: () => void;
}

interface EmpData {
  deals: Deal[];
  tickets: Ticket[];
  renewals: Renewal[];
  tasks: EmployeeTask[];
  lessons: string[];
}

/* ---------- small UI ---------- */

function StatTile({ icon, label, value, sub, tone = "text-foreground" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function EmployeeDetailPanel({ employee, open, onClose }: Props) {
  const [data, setData] = useState<EmpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("all");

  useEffect(() => {
    if (!open || !employee) return;
    setLoading(true);
    setData(null);
    const name = employee.name.trim();
    Promise.allSettled([
      fetchDeals(),
      fetchTickets(),
      fetchRenewals(),
      fetchEmployeeTasks({ assigned_to: employee.id }),
      fetchAllLearningProgress(),
    ])
      .then(([d, t, r, tk, lp]) => {
        const deals = d.status === "fulfilled" ? d.value.filter((x) => x.assigned_rep_name?.trim() === name) : [];
        const tickets = t.status === "fulfilled" ? t.value.filter((x) => x.assigned_agent_name?.trim() === name) : [];
        const renewals = r.status === "fulfilled" ? r.value.filter((x) => x.assigned_rep?.trim() === name) : [];
        const tasks = tk.status === "fulfilled" ? tk.value : [];
        const lessonsRow = lp.status === "fulfilled" ? lp.value.find((x) => x.user_id === employee.id) : undefined;
        setData({ deals, tickets, renewals, tasks, lessons: lessonsRow?.completed_lessons ?? [] });
      })
      .finally(() => setLoading(false));
  }, [open, employee]);

  const metrics = useMemo(() => {
    if (!data) return null;
    const cutoff = periodCutoff(period);
    const inPeriod = (dateStr?: string) => cutoff === 0 || (dateStr ? new Date(dateStr).getTime() >= cutoff : false);

    const deals = data.deals.filter((d) => inPeriod(d.close_date || d.created_at));
    const tickets = data.tickets.filter((t) => inPeriod(t.created_at));
    const renewals = data.renewals.filter((r) => inPeriod(r.payment_date || r.created_at));

    const closedDeals = deals.filter((d) => d.stage === "مكتملة");
    const dealsValue = closedDeals.reduce((s, d) => s + d.deal_value, 0);
    const resolvedTickets = tickets.filter((t) => t.status === "محلول");
    const completedRenewals = renewals.filter((r) => r.status === "مكتمل");
    const avgCycle = closedDeals.length > 0 ? Math.round(closedDeals.reduce((s, d) => s + (d.cycle_days || 0), 0) / closedDeals.length) : 0;
    const avgDeal = closedDeals.length > 0 ? Math.round(dealsValue / closedDeals.length) : 0;
    const resRate = tickets.length > 0 ? Math.round((resolvedTickets.length / tickets.length) * 100) : 0;
    const doneTasks = data.tasks.filter((t) => t.status === "completed").length;

    const score = computeScore({
      totalDeals: deals.length, closedDeals: closedDeals.length, dealsValue,
      totalTickets: tickets.length, resolvedTickets: resolvedTickets.length,
    });

    return { deals, tickets, renewals, closedDeals, dealsValue, resolvedTickets, completedRenewals, avgCycle, avgDeal, resRate, doneTasks, score };
  }, [data, period]);

  const academy = data ? getAcademyStats(data.lessons) : null;
  const phone = sanitizePhone(employee?.phone);
  const pendingTasks = data?.tasks.filter((t) => t.status === "pending" || t.status === "in_progress") ?? [];

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-md w-[95vw] overflow-y-auto p-0" showCloseButton={false}>
        <SheetHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 p-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-bold">ملف الموظف</SheetTitle>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </SheetHeader>

        {!employee ? null : (
          <div className="p-4 space-y-4">
            {/* Identity */}
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-full border-2 border-cyan bg-cyan-dim flex items-center justify-center text-cyan font-bold text-xl shrink-0 overflow-hidden">
                {employee.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={employee.avatar_url} alt={employee.name} className="w-full h-full object-cover" />
                ) : employee.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-foreground truncate">{employee.name}</p>
                <p className="text-xs text-muted-foreground truncate">{employee.role || "—"}</p>
                <div className="mt-1.5">
                  <ColorBadge text={employee.status} color={STATUS_COLOR[employee.status] || "blue"} />
                </div>
              </div>
            </div>

            {/* Contact */}
            {(employee.phone || employee.email) && (
              <div className="flex flex-wrap gap-2">
                {phone && (
                  <>
                    <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] px-2.5 py-1.5 text-xs text-foreground hover:bg-white/[0.06] transition-colors">
                      <Phone className="w-3.5 h-3.5 text-cyan" /> اتصال
                    </a>
                    <a href={`https://wa.me/${phone.replace("+", "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] px-2.5 py-1.5 text-xs text-foreground hover:bg-white/[0.06] transition-colors">
                      <MessageCircle className="w-3.5 h-3.5 text-cc-green" /> واتساب
                    </a>
                  </>
                )}
                {employee.email && (
                  <a href={`mailto:${employee.email}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08] px-2.5 py-1.5 text-xs text-foreground hover:bg-white/[0.06] transition-colors">
                    <Mail className="w-3.5 h-3.5 text-amber" /> {employee.email}
                  </a>
                )}
              </div>
            )}

            {/* Period filter */}
            <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] p-1 w-fit">
              {(["day", "week", "month", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${period === p ? "bg-cyan text-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>

            {loading || !metrics ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              </div>
            ) : (
              <>
                {/* Performance level */}
                {metrics.score > 0 && (() => {
                  const lvl = getLevel(metrics.score);
                  return (
                    <div className={`rounded-xl ${lvl.bg} ring-1 ${lvl.ring} p-3`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Award className={`w-4 h-4 ${lvl.color}`} />
                          <span className={`text-sm font-bold ${lvl.color}`}>{lvl.label}</span>
                        </div>
                        <span className={`text-2xl font-extrabold ${lvl.color} font-mono`}>{metrics.score}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className={`h-full ${lvl.bar} rounded-full transition-all duration-700`} style={{ width: `${metrics.score}%` }} />
                      </div>
                    </div>
                  );
                })()}

                {/* Stat tiles */}
                <div className="grid grid-cols-2 gap-2">
                  <StatTile icon={<TrendingUp className="w-3.5 h-3.5 text-cc-green" />} label="الصفقات المغلقة" value={`${metrics.closedDeals.length}`} sub={`من ${metrics.deals.length} صفقة`} tone="text-cc-green" />
                  <StatTile icon={<Banknote className="w-3.5 h-3.5 text-cyan" />} label="إجمالي الإيراد" value={formatMoney(metrics.dealsValue)} tone="text-cyan" />
                  <StatTile icon={<Briefcase className="w-3.5 h-3.5 text-cyan" />} label="متوسط قيمة الصفقة" value={metrics.avgDeal > 0 ? formatMoney(metrics.avgDeal) : "—"} />
                  <StatTile icon={<Clock className="w-3.5 h-3.5 text-amber" />} label="متوسط أيام الإغلاق" value={metrics.avgCycle > 0 ? `${metrics.avgCycle} يوم` : "—"} />
                  <StatTile icon={<Headphones className="w-3.5 h-3.5 text-cc-purple" />} label="تذاكر محلولة" value={`${metrics.resolvedTickets.length}`} sub={`من ${metrics.tickets.length} · ${metrics.resRate}% حل`} tone="text-cc-purple" />
                  <StatTile icon={<RefreshCw className="w-3.5 h-3.5 text-sky-400" />} label="تجديدات مكتملة" value={`${metrics.completedRenewals.length}`} sub={`من ${metrics.renewals.length}`} tone="text-sky-400" />
                </div>

                {/* Tasks summary */}
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <ListTodo className="w-4 h-4 text-indigo-400" />
                      <span className="text-sm font-bold text-foreground">المهام</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{metrics.doneTasks} منجزة · {pendingTasks.length} جارية</span>
                  </div>
                  {pendingTasks.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground/60">لا توجد مهام جارية</p>
                  ) : (
                    <div className="space-y-1.5">
                      {pendingTasks.slice(0, 5).map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-foreground/80 truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                            {t.title}
                          </span>
                          {t.due_date && <span className="text-muted-foreground/60 shrink-0">{t.due_date}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Academy progress */}
                {academy && (
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-foreground">تقدّم الأكاديمية</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">{academy.pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1.5">
                      <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${academy.pct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {academy.completed}/{academy.total} درس · {academy.currentStage || "لم يبدأ"}
                    </p>
                  </div>
                )}

                {/* Recent deals */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-cc-green" />
                    <span className="text-xs font-bold text-foreground">أحدث الصفقات</span>
                  </div>
                  {metrics.deals.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground/60">لا توجد صفقات في هذه الفترة</p>
                  ) : (
                    <div className="space-y-1.5">
                      {[...metrics.deals]
                        .sort((a, b) => new Date(b.close_date || b.created_at).getTime() - new Date(a.close_date || a.created_at).getTime())
                        .slice(0, 6)
                        .map((d) => (
                          <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] border border-white/[0.06] px-2.5 py-2 text-xs">
                            <div className="min-w-0">
                              <p className="text-foreground/90 truncate">{d.client_name}</p>
                              <p className="text-[11px] text-muted-foreground">{d.stage} · {saudiDateStr(new Date(d.close_date || d.created_at))}</p>
                            </div>
                            <span className={`font-bold shrink-0 ${d.stage === "مكتملة" ? "text-cc-green" : "text-muted-foreground"}`}>{formatMoney(d.deal_value)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Recent tickets */}
                {metrics.tickets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Headphones className="w-3.5 h-3.5 text-cc-purple" />
                      <span className="text-xs font-bold text-foreground">أحدث التذاكر</span>
                    </div>
                    <div className="space-y-1.5">
                      {[...metrics.tickets]
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5)
                        .map((t) => (
                          <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] border border-white/[0.06] px-2.5 py-2 text-xs">
                            <span className="text-foreground/90 truncate flex items-center gap-1.5">
                              {t.status === "محلول" ? <CheckCircle2 className="w-3 h-3 text-cc-green shrink-0" /> : <Clock className="w-3 h-3 text-amber shrink-0" />}
                              {t.client_name}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0">{t.status}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
