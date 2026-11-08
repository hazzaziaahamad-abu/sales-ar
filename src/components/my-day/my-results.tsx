"use client";

// «نتيجة يومي» — أرقام الموظف مباشرة طول اليوم (نفس مصدر لوحة المدير في «المتابعة اليومية»).
import { useCallback, useEffect, useState } from "react";
import { getEditableContent } from "@/lib/supabase/db";
import {
  fetchHuddleKpis, kpiStatus, targetOf, KPI_DEFS, MEMBER_ROLES, DEFAULT_KPI_TARGETS,
  type HuddleKpis, type KpiKey, type KpiTargets,
} from "@/lib/huddle-kpis";
import { KEY_PREFIX } from "@/components/daily-huddle/huddle-shared";
import { formatMoneyFull, todayLocal } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, RotateCw } from "lucide-react";

const fmt = (k: KpiKey, v: number) => (KPI_DEFS[k].money ? formatMoneyFull(v) : v.toLocaleString("en-US"));

export function MyResults({ member, onActionsCount }: { member: string; onActionsCount?: (n: number) => void }) {
  const [kpis, setKpis] = useState<HuddleKpis | null>(null);
  const [targets, setTargets] = useState<KpiTargets>(DEFAULT_KPI_TARGETS);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayLocal();
      const [k, t] = await Promise.all([
        fetchHuddleKpis(today, today),
        getEditableContent<KpiTargets>(`${KEY_PREFIX}_kpi_targets`).catch(() => null),
      ]);
      setKpis(k);
      if (t) setTargets(t);
      setError(false);
      onActionsCount?.(k.actions.filter((a) => a.member === member).length);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [member, onActionsCount]);
  useEffect(() => { load(); }, [load]);

  if (error && !kpis) return <p className="text-xs text-red-400">تعذّر تحميل نتيجة اليوم</p>;
  if (!kpis) return <Skeleton className="h-32 rounded-2xl" />;

  const role = MEMBER_ROLES[member];
  const m = kpis.members[member];
  const tgt = (k: KpiKey) => targetOf(targets, member, k);
  const followTarget = tgt("followups");
  const followPct = followTarget ? Math.min(100, Math.round((m.values.followups / followTarget) * 100)) : 100;
  const hit = m.values.followups >= followTarget;
  // الشهري بدون «المتابعات» (ظاهرة فوق) وبدون «الآن» (تظهر في القائمة تحت)
  const monthly = role.kpis.filter((k) => KPI_DEFS[k].period === "month");
  const nowKpis = role.kpis.filter((k) => KPI_DEFS[k].period === "now");

  return (
    <section className={`cc-card rounded-2xl border p-4 space-y-3 ${hit ? "border-emerald-500/30" : "border-white/[0.06]"}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Trophy className={`h-4 w-4 ${hit ? "text-emerald-400" : "text-amber-400"}`} /> نتيجة يومي
        </h2>
        <button type="button" onClick={load} disabled={loading} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
        </button>
      </div>

      {/* المتابعات — الهدف اليومي الأهم */}
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">متابعات اليوم (عملاء كتبت عنهم في السجل)</span>
          <span className={`text-lg font-extrabold tabular-nums ${hit ? "text-emerald-400" : "text-foreground"}`}>
            {m.values.followups}<span className="text-xs font-normal text-muted-foreground"> / {followTarget}</span>
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className={`h-full ${hit ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${followPct}%` }} />
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {hit ? "حققت هدف اليوم 🎯" : `باقي ${followTarget - m.values.followups} عميل للهدف`}
        </div>
      </div>

      {/* إنجاز اليوم */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/[0.03] p-2">
          <div className="text-lg font-extrabold text-emerald-400 tabular-nums">{m.closesToday}</div>
          <div className="text-[10px] text-muted-foreground">إغلاقات اليوم</div>
        </div>
        {role.kpis.includes("openTickets") ? (
          <div className="rounded-xl bg-white/[0.03] p-2">
            <div className="text-lg font-extrabold text-cyan-400 tabular-nums">{m.resolvedToday}</div>
            <div className="text-[10px] text-muted-foreground">تذاكر حلّيتها اليوم</div>
          </div>
        ) : (
          <div className="rounded-xl bg-white/[0.03] p-2">
            <div className="text-lg font-extrabold text-cyan-400 tabular-nums">{m.values.assists}</div>
            <div className="text-[10px] text-muted-foreground">مساعدات الشهر</div>
          </div>
        )}
        <div className="rounded-xl bg-white/[0.03] p-2">
          {(() => {
            const open = nowKpis.reduce((s, k) => s + m.values[k], 0);
            return (
              <>
                <div className={`text-lg font-extrabold tabular-nums ${open ? "text-red-400" : "text-emerald-400"}`}>{open || "✓"}</div>
                <div className="text-[10px] text-muted-foreground">{open ? "معلّقة تحتاجك" : "لا شيء معلّق"}</div>
              </>
            );
          })()}
        </div>
      </div>

      {/* الشهر: المحقق والمطلوب اليوم */}
      {monthly.length > 0 && (
        <div className="space-y-2">
          {monthly.map((k) => {
            const v = m.values[k];
            const t = tgt(k);
            const s = kpiStatus(KPI_DEFS[k], v, t, kpis);
            return (
              <div key={k}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                  <span className="text-muted-foreground">{KPI_DEFS[k].label}</span>
                  <span className={`font-bold tabular-nums whitespace-nowrap ${s.ok ? "text-emerald-400" : "text-amber-400"}`}>
                    {fmt(k, v)}{t > 0 && <span className="font-normal text-muted-foreground"> / {fmt(k, t)}</span>}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={`h-full ${s.ok ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${s.pct}%` }} />
                </div>
                {s.needToday ? <div className="mt-0.5 text-[10px] text-muted-foreground">المطلوب اليوم عشان توصل الهدف: {fmt(k, s.needToday)}</div> : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
