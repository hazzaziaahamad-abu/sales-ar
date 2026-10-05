"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Check, X, ChevronRight, ChevronLeft, Loader2, AlertTriangle, Undo2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDeals, fetchRenewals, getEditableContent, saveEditableContent, getEditableContentRange,
} from "@/lib/supabase/db";
import { formatMoneyFull, saudiDateStr } from "@/lib/utils/format";
import type { Deal, Renewal } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

// تأكيدات المبيعات: كل بيع مكتمل (صفقة أو تجديد) يحتاج تحقق المدير.
// التأكيد يُخزَّن هنا فقط ولا يغيّر شيئاً في أقسام المبيعات/التجديدات.
const KEY_PREFIX = "sales_confirm";
const DAY_MS = 86_400_000;
const PENDING_LOOKBACK_DAYS = 7;

type Verdict = "confirmed" | "rejected";
interface Confirmation { status: Verdict; note?: string; by?: string; at: string }
type DayConfirmations = Record<string, Confirmation>;

interface SaleItem {
  key: string;            // deal:<id> | renewal:<id>
  day: string;
  client: string;
  rep: string;
  kind: string;
  plan?: string;
  amount: number;
  at?: string;
}

const dayKey = (day: string) => `${KEY_PREFIX}:${day}`;

function dayOf(s?: string | null): string {
  if (!s) return "";
  return s.length === 10 ? s : saudiDateStr(new Date(s));
}
function shiftDay(day: string, delta: number): string {
  return saudiDateStr(new Date(new Date(`${day}T12:00:00+03:00`).getTime() + delta * DAY_MS));
}
function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00+03:00`).toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" });
}
function timeOf(s?: string): string {
  if (!s || s.length === 10) return "";
  return new Date(s).toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" });
}

function toSales(deals: Deal[], renewals: Renewal[]): SaleItem[] {
  const items: SaleItem[] = [];
  for (const d of deals) {
    if (d.stage !== "مكتملة") continue;
    const at = d.close_date || d.updated_at;
    items.push({
      key: `deal:${d.id}`,
      day: dayOf(at),
      client: d.client_name,
      rep: d.assigned_rep_name || "بلا مسؤول",
      kind: d.sales_type === "support" ? "مبيعات الدعم" : "مبيعات المكتب",
      plan: d.plan,
      amount: d.deal_value || 0,
      at,
    });
  }
  for (const r of renewals) {
    if (r.status !== "مكتمل") continue;
    const at = r.payment_date || r.updated_at;
    items.push({
      key: `renewal:${r.id}`,
      day: dayOf(at),
      client: r.customer_name,
      rep: r.assigned_rep || "بلا مسؤول",
      kind: "تجديد",
      plan: r.plan_name,
      amount: r.plan_price || 0,
      at,
    });
  }
  return items;
}

export function SalesConfirmations() {
  const { user } = useAuth();
  const canConfirm = user?.isSuperAdmin ?? false;
  const today = saudiDateStr();

  const [day, setDay] = useState(today);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [confirmations, setConfirmations] = useState<Record<string, DayConfirmations>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ key: string; note: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [deals, renewals, rows] = await Promise.all([
        fetchDeals(),
        fetchRenewals(),
        getEditableContentRange<DayConfirmations>(dayKey("0000-00-00"), dayKey("9999-99-99")),
      ]);
      setSales(toSales(deals, renewals));
      const map: Record<string, DayConfirmations> = {};
      for (const r of rows) map[r.key.slice(KEY_PREFIX.length + 1)] = r.value ?? {};
      setConfirmations(map);
    } catch (e) {
      console.error(e);
      setError("تعذّر تحميل المبيعات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const daySales = useMemo(
    () => sales.filter(s => s.day === day).sort((a, b) => b.amount - a.amount),
    [sales, day]
  );

  // مبيعات الأيام السابقة (آخر ٧ أيام) اللي ما تأكدت للحين
  const olderPending = useMemo(() => {
    const from = shiftDay(today, -PENDING_LOOKBACK_DAYS);
    const byDay = new Map<string, number>();
    for (const s of sales) {
      if (s.day < from || s.day >= today || s.day === day) continue;
      if (confirmations[s.day]?.[s.key]) continue;
      byDay.set(s.day, (byDay.get(s.day) ?? 0) + 1);
    }
    return Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sales, confirmations, today, day]);

  const dayConf = useMemo(() => confirmations[day] ?? {}, [confirmations, day]);
  const stats = useMemo(() => {
    let confirmed = 0, rejected = 0, confirmedAmount = 0;
    for (const s of daySales) {
      const c = dayConf[s.key];
      if (c?.status === "confirmed") { confirmed++; confirmedAmount += s.amount; }
      else if (c?.status === "rejected") rejected++;
    }
    return {
      total: daySales.length,
      amount: daySales.reduce((sum, s) => sum + s.amount, 0),
      confirmed, rejected, confirmedAmount,
      pending: daySales.length - confirmed - rejected,
    };
  }, [daySales, dayConf]);

  async function setVerdict(item: SaleItem, verdict: Verdict | null, note?: string) {
    if (!canConfirm) return;
    setSavingKey(item.key);
    setError(null);
    try {
      // نقرأ آخر نسخة قبل الحفظ حتى لا نمسح تأكيداً سُجّل من جهاز آخر
      const latest = (await getEditableContent<DayConfirmations>(dayKey(item.day))) ?? {};
      const next: DayConfirmations = { ...latest };
      if (verdict) {
        next[item.key] = { status: verdict, note: note?.trim() || undefined, by: user?.name, at: new Date().toISOString() };
      } else {
        delete next[item.key];
      }
      await saveEditableContent(dayKey(item.day), next);
      setConfirmations(prev => ({ ...prev, [item.day]: next }));
      setRejecting(null);
    } catch (e) {
      console.error(e);
      setError("تعذّر حفظ التأكيد");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <Skeleton className="h-72 rounded-2xl" />;

  return (
    <div className="space-y-4">
      {/* Header + day navigation */}
      <div className="cc-card rounded-2xl p-4 border border-emerald-500/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-foreground">تأكيدات المبيعات</h2>
              <p className="text-[11px] text-muted-foreground">
                {canConfirm ? "راجع كل بيع وأكّده أو ارفضه" : "التأكيد من المدير فقط — تقدر تشوف الحالة"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setDay(d => shiftDay(d, -1))} title="اليوم السابق" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={day}
              max={today}
              onChange={e => e.target.value && setDay(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-foreground"
            />
            <button onClick={() => setDay(d => shiftDay(d, 1))} disabled={day >= today} title="اليوم التالي" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground mt-2">{dayLabel(day)}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Stat label="مبيعات اليوم" value={String(stats.total)} sub={formatMoneyFull(stats.amount)} tone="text-foreground" />
          <Stat label="بانتظار التأكيد" value={String(stats.pending)} tone={stats.pending ? "text-amber-400" : "text-muted-foreground"} />
          <Stat label="مؤكدة" value={String(stats.confirmed)} sub={formatMoneyFull(stats.confirmedAmount)} tone="text-emerald-400" />
          <Stat label="مرفوضة" value={String(stats.rejected)} tone={stats.rejected ? "text-red-400" : "text-muted-foreground"} />
        </div>
      </div>

      {error && <div className="rounded-[14px] p-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* أيام سابقة فيها مبيعات ما تأكدت */}
      {olderPending.length > 0 && (
        <div className="rounded-[14px] p-3 bg-amber-500/10 border border-amber-500/20">
          <p className="text-[12px] font-bold text-amber-400 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" /> مبيعات أيام سابقة ما تأكدت
          </p>
          <div className="flex flex-wrap gap-1.5">
            {olderPending.map(([d, count]) => (
              <button key={d} onClick={() => setDay(d)} className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition">
                {dayLabel(d)} · {count}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* قائمة المبيعات */}
      {daySales.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">ما فيه مبيعات مكتملة في هذا اليوم</p>
      ) : (
        <div className="space-y-2">
          {daySales.map(s => {
            const c = dayConf[s.key];
            const saving = savingKey === s.key;
            const border =
              c?.status === "confirmed" ? "border-emerald-500/30 bg-emerald-500/[0.04]" :
              c?.status === "rejected" ? "border-red-500/30 bg-red-500/[0.04]" :
              "border-amber-500/25 bg-white/[0.02]";
            return (
              <div key={s.key} className={`rounded-xl p-3 border ${border}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{s.client}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {s.rep} · {s.kind}{s.plan ? ` · ${s.plan}` : ""}{timeOf(s.at) ? ` · ${timeOf(s.at)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold font-mono text-foreground">{formatMoneyFull(s.amount)}</span>
                    {c ? (
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${c.status === "confirmed" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {c.status === "confirmed" ? "مؤكدة ✓" : "مرفوضة"}
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-500/15 text-amber-400">بانتظار التأكيد</span>
                    )}
                  </div>
                </div>

                {c?.note && <p className="text-[11px] text-muted-foreground mt-2">ملاحظة: {c.note}</p>}

                {canConfirm && (
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : c ? (
                      <button onClick={() => setVerdict(s, null)} className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <Undo2 className="w-3 h-3" /> تراجع
                      </button>
                    ) : rejecting?.key === s.key ? (
                      <>
                        <input
                          autoFocus
                          value={rejecting.note}
                          onChange={e => setRejecting({ key: s.key, note: e.target.value })}
                          onKeyDown={e => e.key === "Enter" && setVerdict(s, "rejected", rejecting.note)}
                          placeholder="سبب الرفض (اختياري)"
                          className="flex-1 min-w-[160px] bg-transparent border border-white/[0.12] rounded-lg px-2.5 py-1 text-[12px] text-foreground outline-none focus:border-red-500/40"
                        />
                        <button onClick={() => setVerdict(s, "rejected", rejecting.note)} className="text-[11px] px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25">تأكيد الرفض</button>
                        <button onClick={() => setRejecting(null)} className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.05] text-muted-foreground">إلغاء</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setVerdict(s, "confirmed")} className="text-[11px] px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 flex items-center gap-1">
                          <Check className="w-3 h-3" /> تأكيد
                        </button>
                        <button onClick={() => setRejecting({ key: s.key, note: "" })} className="text-[11px] px-3 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1">
                          <X className="w-3 h-3" /> رفض
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
  return (
    <div className="rounded-xl p-2.5 bg-white/[0.03] border border-white/[0.06]">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-extrabold font-mono mt-0.5 ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
    </div>
  );
}
