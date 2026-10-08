"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Siren, CreditCard, FlaskConical, Settings, Phone, MessageCircle, RefreshCw, ExternalLink, User, Users, Hourglass, StickyNote } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, tableDateBounds } from "@/lib/utils/format";
import { FollowUpLogButton } from "@/components/follow-up-log";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchUrgentDeals,
  isUrgentAdmin,
  summarizeByRep,
  URGENT_FOLLOWUP_STAGES,
  STALE_DAYS,
  CRITICAL_DAYS,
  type UrgentDeal,
} from "@/lib/urgent-followup";

type Period = "اليوم" | "الأسبوع" | "الشهر" | "الكل";
const PERIODS: Period[] = ["اليوم", "الأسبوع", "الشهر", "الكل"];

type TypeFilter = "" | "office" | "support";
const TYPES: { key: TypeFilter; label: string }[] = [
  { key: "", label: "كل الأقسام" },
  { key: "office", label: "المبيعات" },
  { key: "support", label: "مبيعات الدعم" },
];

const STAGE_CFG: Record<string, { label: string; hint: string; icon: typeof CreditCard; text: string; bg: string; border: string }> = {
  "انتظار الدفع": { label: "انتظار الدفع", hint: "اجمع الفلوس اليوم — كل يوم تأخير يقلل فرصة الدفع", icon: CreditCard, text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40" },
  "تجريبي": { label: "تجريبي", hint: "تابع رضا العميل وحوّله لاشتراك قبل ما تنتهي التجربة", icon: FlaskConical, text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/40" },
  "تجهيز": { label: "تجهيز", hint: "أسرع في التجهيز وأبلغ العميل بالتقدم", icon: Settings, text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/40" },
};

function dealDay(i: UrgentDeal): string {
  return (i.deal.deal_date || i.deal.created_at || "").slice(0, 10);
}

function whatsappLink(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("05")) p = "966" + p.slice(1);
  return `https://wa.me/${p}`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
}

export default function UrgentFollowupPage() {
  const { user, activeOrgId } = useAuth();
  const isAdmin = isUrgentAdmin(user);
  const [items, setItems] = useState<UrgentDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("الكل");
  const [repFilter, setRepFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");

  // البانر في كل قسم يفتح الصفحة على قسمه: /urgent-followup?type=office
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    if (t === "office" || t === "support") setTypeFilter(t);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // الموظف يجيب صفقاته فقط — المدير يجيب الكل
      setItems(await fetchUrgentDeals({ repName: isAdmin ? undefined : user.name }));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => { load(); }, [load, activeOrgId]);

  const reps = useMemo(
    () => Array.from(new Set(items.map((i) => i.deal.assigned_rep_name).filter(Boolean) as string[])).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const bounds = period === "الكل" ? null : tableDateBounds(period);
    return items
      .filter((i) => !typeFilter || (i.deal.sales_type ?? "office") === typeFilter)
      .filter((i) => !repFilter || i.deal.assigned_rep_name === repFilter)
      .filter((i) => { if (!bounds) return true; const day = dealDay(i); return day >= bounds[0] && day <= bounds[1]; })
      // الأقدم بدون تحديث أولاً
      .sort((a, b) => b.staleDays - a.staleDays || b.stageDays - a.stageDays);
  }, [items, period, typeFilter, repFilter]);

  const byStage = useMemo(() => {
    const m: Record<string, UrgentDeal[]> = {};
    for (const s of URGENT_FOLLOWUP_STAGES) m[s] = [];
    for (const i of filtered) m[i.deal.stage]?.push(i);
    return m;
  }, [filtered]);

  const staleCount = filtered.filter((i) => i.staleDays >= STALE_DAYS).length;
  const repSummary = useMemo(() => (isAdmin ? summarizeByRep(filtered) : []), [isAdmin, filtered]);

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
              هذي الحالات لازم تتابع كل يوم — سجّل تعليق في سجل المتابعة بعد كل تواصل عشان تنحسب الصفقة محدّثة.
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
            ⚠️ {staleCount} صفقة بدون أي تحديث في السجل من {STALE_DAYS} أيام أو أكثر — ابدأ فيها الحين
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
        <div className="flex rounded-[12px] border border-border bg-card p-1">
          {TYPES.map((t) => (
            <button
              key={t.key || "all"}
              onClick={() => setTypeFilter(t.key)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-semibold transition-colors ${
                typeFilter === t.key ? "bg-white/[0.12] text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
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
          const value = list.reduce((sum, i) => sum + (i.deal.deal_value || 0), 0);
          const stale = list.filter((i) => i.staleDays >= STALE_DAYS).length;
          return (
            <div key={s} className={`rounded-[14px] border ${c.border} ${c.bg} p-4`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${c.text}`} />
                <span className={`font-bold ${c.text}`}>{c.label}</span>
                {stale > 0 && <span className="mr-auto rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white">{stale} متأخرة</span>}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">{loading ? "…" : list.length}</span>
                <span className="text-xs text-muted-foreground">صفقة · {formatMoney(value)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── ملخص المدير لكل موظف ─── */}
      {isAdmin && !loading && repSummary.length > 0 && (
        <section className="cc-card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Users className="h-5 w-5 text-red-400" />
            <h2 className="font-extrabold text-foreground">ملخص اليوم لكل موظف</h2>
            <span className="text-[12px] text-muted-foreground">— اضغط على الموظف لعرض صفقاته</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-[12px] text-muted-foreground">
                  <th className="px-4 py-2 text-right font-semibold">الموظف</th>
                  <th className="px-2 py-2 text-center font-semibold">💳 انتظار الدفع</th>
                  <th className="px-2 py-2 text-center font-semibold">🧪 تجريبي</th>
                  <th className="px-2 py-2 text-center font-semibold">⚙️ تجهيز</th>
                  <th className="px-2 py-2 text-center font-semibold">بدون تحديث {STALE_DAYS}+</th>
                  <th className="px-2 py-2 text-center font-semibold">{CRITICAL_DAYS}+ أيام</th>
                </tr>
              </thead>
              <tbody>
                {repSummary.map((r) => (
                  <tr
                    key={r.rep}
                    onClick={() => setRepFilter(repFilter === r.rep ? "" : r.rep)}
                    className={`cursor-pointer border-t border-border hover:bg-white/[0.04] ${repFilter === r.rep ? "bg-white/[0.06]" : ""}`}
                  >
                    <td className="px-4 py-2 font-bold text-foreground">{r.rep}</td>
                    <td className="px-2 py-2 text-center">{r.byStage["انتظار الدفع"] ?? 0}</td>
                    <td className="px-2 py-2 text-center">{r.byStage["تجريبي"] ?? 0}</td>
                    <td className="px-2 py-2 text-center">{r.byStage["تجهيز"] ?? 0}</td>
                    <td className={`px-2 py-2 text-center font-bold ${r.stale > 0 ? "text-amber-400" : "text-muted-foreground"}`}>{r.stale}</td>
                    <td className={`px-2 py-2 text-center font-bold ${r.critical > 0 ? "text-red-400" : "text-muted-foreground"}`}>{r.critical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                  list.map((i) => {
                    const d = i.deal;
                    const days = i.staleDays;
                    const salesHref = d.sales_type === "support" ? "/support-sales" : "/sales";
                    return (
                      <div
                        key={d.id}
                        className={`rounded-[12px] border p-3 ${days >= CRITICAL_DAYS ? "border-red-500/60 bg-red-500/[0.07]" : days >= STALE_DAYS ? "border-amber-500/50 bg-amber-500/[0.05]" : "border-border bg-white/[0.02]"}`}
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
                              <span>{d.sales_type === "support" ? "مبيعات الدعم" : "المبيعات"}</span>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${days >= CRITICAL_DAYS ? "bg-red-500 text-white" : days >= STALE_DAYS ? "bg-amber-500 text-white" : "bg-emerald-500/20 text-emerald-400"}`}
                            title={`آخر تحديث: ${shortDate(i.lastActivity)}`}
                          >
                            {days === 0 ? "محدّث اليوم" : `${days} يوم بدون تحديث`}
                          </span>
                        </div>

                        <p className="mt-1.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                          <Hourglass className="h-3 w-3" />
                          له <b className={i.stageDays >= CRITICAL_DAYS ? "text-red-400" : "text-foreground"}>{i.stageDays} يوم</b> في «{d.stage}» (من {shortDate(i.stageSince)})
                        </p>

                        {i.lastNote ? (
                          <p className="mt-1.5 flex items-start gap-1 rounded-lg bg-white/[0.03] px-2 py-1 text-[12px] text-muted-foreground">
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="line-clamp-2">
                              <b className="text-foreground">{i.lastNote.author_name}</b> · {shortDate(i.lastNote.created_at)}: {i.lastNote.note}
                            </span>
                          </p>
                        ) : (
                          <p className="mt-1.5 text-[12px] font-semibold text-red-400">لا يوجد أي تعليق في سجل المتابعة</p>
                        )}

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
