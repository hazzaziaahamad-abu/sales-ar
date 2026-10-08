"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Siren, CreditCard, FlaskConical, Settings, Phone, MessageCircle, RefreshCw, ExternalLink, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchDeals, URGENT_FOLLOWUP_STAGES } from "@/lib/supabase/db";
import { formatMoney, tableDateBounds } from "@/lib/utils/format";
import { FollowUpLogButton } from "@/components/follow-up-log";
import { Skeleton } from "@/components/ui/skeleton";
import type { Deal } from "@/types";

type Period = "اليوم" | "الأسبوع" | "الشهر" | "الكل";
const PERIODS: Period[] = ["اليوم", "الأسبوع", "الشهر", "الكل"];

const STAGE_CFG: Record<string, { label: string; hint: string; icon: typeof CreditCard; text: string; bg: string; border: string }> = {
  "انتظار الدفع": { label: "انتظار الدفع", hint: "اجمع الفلوس اليوم — كل يوم تأخير يقلل فرصة الدفع", icon: CreditCard, text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40" },
  "تجريبي": { label: "تجريبي", hint: "تابع رضا العميل وحوّله لاشتراك قبل ما تنتهي التجربة", icon: FlaskConical, text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/40" },
  "تجهيز": { label: "تجهيز", hint: "أسرع في التجهيز وأبلغ العميل بالتقدم", icon: Settings, text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/40" },
};

const DAY_MS = 86400000;

/** أيام بدون أي تحديث على الصفقة */
function staleDays(d: Deal): number {
  const ref = d.updated_at || d.created_at;
  return ref ? Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / DAY_MS)) : 0;
}

function dealDay(d: Deal): string {
  return (d.deal_date || d.created_at || "").slice(0, 10);
}

function whatsappLink(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("05")) p = "966" + p.slice(1);
  return `https://wa.me/${p}`;
}

export default function UrgentFollowupPage() {
  const { user, activeOrgId } = useAuth();
  const isAdmin = user?.isSuperAdmin || user?.roleName === "مدير" || user?.roleName === "admin";
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("الكل");
  const [repFilter, setRepFilter] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchDeals();
      setDeals(all.filter((d) => (URGENT_FOLLOWUP_STAGES as readonly string[]).includes(d.stage)));
    } catch {
      setDeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, activeOrgId]);

  // الموظف يشوف صفقاته فقط — المدير يشوف الكل ويقدر يفلتر بالموظف
  const scoped = useMemo(() => {
    if (!user) return [];
    if (!isAdmin) return deals.filter((d) => d.assigned_rep_name?.trim() === user.name.trim());
    return repFilter ? deals.filter((d) => d.assigned_rep_name === repFilter) : deals;
  }, [deals, user, isAdmin, repFilter]);

  const reps = useMemo(
    () => Array.from(new Set(deals.map((d) => d.assigned_rep_name).filter(Boolean) as string[])).sort(),
    [deals],
  );

  const filtered = useMemo(() => {
    const bounds = period === "الكل" ? null : tableDateBounds(period);
    const list = bounds ? scoped.filter((d) => { const day = dealDay(d); return day >= bounds[0] && day <= bounds[1]; }) : scoped;
    // الأقدم بدون تحديث أولاً
    return [...list].sort((a, b) => staleDays(b) - staleDays(a));
  }, [scoped, period]);

  const byStage = useMemo(() => {
    const m: Record<string, Deal[]> = {};
    for (const s of URGENT_FOLLOWUP_STAGES) m[s] = [];
    for (const d of filtered) m[d.stage]?.push(d);
    return m;
  }, [filtered]);

  const staleCount = filtered.filter((d) => staleDays(d) >= 3).length;

  return (
    <div className="space-y-5" dir="rtl">
      {/* ─── Header ─── */}
      <div className="rounded-[14px] border-2 border-red-500/50 bg-gradient-to-l from-red-500/20 via-red-500/10 to-transparent p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-500 text-white ring-4 ring-red-500/30">
            <span className="absolute inset-0 rounded-2xl bg-red-500 animate-ping opacity-30" />
            <Siren className="relative h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-red-400">هام جداً للمتابعة اليومية</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              هذي الحالات لازم تتابع كل يوم — لا تخلّي عميل يطوف بدون تحديث.
              {!isAdmin && " (تظهر لك صفقاتك أنت فقط)"}
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-[12px] border border-border bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>

        {!loading && staleCount > 0 && (
          <div className="mt-4 rounded-[12px] bg-red-600 px-4 py-2.5 text-sm font-bold text-white">
            ⚠️ عندك {staleCount} صفقة بدون أي تحديث من 3 أيام أو أكثر — ابدأ فيها الحين
          </div>
        )}
      </div>

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-[12px] border border-border bg-card p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-[10px] px-4 py-1.5 text-sm font-semibold transition-colors ${
                period === p ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {isAdmin && reps.length > 0 && (
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="rounded-[12px] border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="">كل الموظفين</option>
            {reps.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <span className="text-xs text-muted-foreground">الفترة حسب تاريخ الصفقة</span>
      </div>

      {/* ─── Summary ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {URGENT_FOLLOWUP_STAGES.map((s) => {
          const c = STAGE_CFG[s];
          const Icon = c.icon;
          const list = byStage[s] || [];
          const value = list.reduce((sum, d) => sum + (d.deal_value || 0), 0);
          return (
            <div key={s} className={`rounded-[14px] border ${c.border} ${c.bg} p-4`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${c.text}`} />
                <span className={`font-bold ${c.text}`}>{c.label}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">{loading ? "…" : list.length}</span>
                <span className="text-xs text-muted-foreground">صفقة · {formatMoney(value)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Lists per stage ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {URGENT_FOLLOWUP_STAGES.map((s) => {
          const c = STAGE_CFG[s];
          const Icon = c.icon;
          const list = byStage[s] || [];
          return (
            <section key={s} className="cc-card overflow-hidden">
              <header className={`border-b ${c.border} ${c.bg} px-4 py-3`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-5 w-5 ${c.text}`} />
                  <h2 className={`font-extrabold ${c.text}`}>{c.label}</h2>
                  <span className="mr-auto rounded-full bg-white/[0.08] px-2 py-0.5 text-xs font-bold text-foreground">{list.length}</span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">{c.hint}</p>
              </header>

              <div className="max-h-[65vh] space-y-2 overflow-y-auto p-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                ) : list.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">لا توجد صفقات ✅</p>
                ) : (
                  list.map((d) => {
                    const days = staleDays(d);
                    const salesHref = d.sales_type === "support" ? "/support-sales" : "/sales";
                    return (
                      <div
                        key={d.id}
                        className={`rounded-[12px] border p-3 ${days >= 7 ? "border-red-500/60 bg-red-500/[0.07]" : days >= 3 ? "border-amber-500/50 bg-amber-500/[0.05]" : "border-border bg-white/[0.02]"}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-foreground">{d.client_name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                              {d.assigned_rep_name && (
                                <span className="flex items-center gap-1"><User className="h-3 w-3" />{d.assigned_rep_name}</span>
                              )}
                              {d.deal_value > 0 && <span>{formatMoney(d.deal_value)}</span>}
                              {d.plan && <span>{d.plan}</span>}
                              <span>{d.sales_type === "support" ? "مبيعات الدعم" : "المكتب"}</span>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${days >= 7 ? "bg-red-500 text-white" : days >= 3 ? "bg-amber-500 text-white" : "bg-emerald-500/20 text-emerald-400"}`}
                            title="أيام بدون تحديث"
                          >
                            {days === 0 ? "محدّث اليوم" : `${days} يوم بدون تحديث`}
                          </span>
                        </div>

                        {d.notes && <p className="mt-2 line-clamp-2 text-[12px] text-muted-foreground">{d.notes}</p>}

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {d.client_phone && (
                            <>
                              <a href={`tel:${d.client_phone}`} className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[12px] text-foreground hover:bg-white/[0.12]">
                                <Phone className="h-3 w-3" /> اتصال
                              </a>
                              <a href={whatsappLink(d.client_phone)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[12px] text-emerald-400 hover:bg-emerald-500/25">
                                <MessageCircle className="h-3 w-3" /> واتساب
                              </a>
                            </>
                          )}
                          <FollowUpLogButton entityType="deal" entityId={d.id} entityName={d.client_name} />
                          <Link href={salesHref} className="mr-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground">
                            <ExternalLink className="h-3 w-3" /> تحديث الحالة
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
