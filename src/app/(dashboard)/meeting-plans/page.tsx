"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Presentation, Eye, CheckCircle2, ExternalLink, Copy, Check, CalendarDays, UserPlus, TrendingUp,
  ListChecks, AlertTriangle, Loader2,
} from "lucide-react";
import { ColorBadge } from "@/components/ui/color-badge";
import { todayLocal } from "@/lib/utils/format";
import { PRODUCT_LABEL, type ReportRow, type ReportOutcome } from "@/lib/client-meetings";
import { CLIENT_SCRIPT } from "@/lib/meetings";

type PeriodKey = "month" | "last" | "90" | "all";
const PERIODS: [PeriodKey, string][] = [
  ["month", "هذا الشهر"],
  ["last", "الشهر الماضي"],
  ["90", "آخر ٩٠ يوم"],
  ["all", "الكل"],
];

const OUTCOME: Record<ReportOutcome, { text: string; color: "green" | "purple" | "red" | "amber" | "blue" }> = {
  converted: { text: "تحوّل لموافق", color: "green" },
  upgraded: { text: "ترقّى", color: "purple" },
  lost: { text: "رفض", color: "red" },
  open: { text: "قيد المتابعة", color: "amber" },
  unlinked: { text: "بدون صفقة", color: "blue" },
};

const SCRIPT_TOTAL = CLIENT_SCRIPT.length;
const n = (v: number) => v.toLocaleString("ar-SA");
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });

function addDays(date: string, delta: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function periodRange(p: PeriodKey, today: string): { from: string | null; to: string | null } {
  const monthStart = `${today.slice(0, 7)}-01`;
  if (p === "month") return { from: monthStart, to: addDays(`${addDays(monthStart, 32).slice(0, 7)}-01`, -1) };
  if (p === "last") {
    const prevEnd = addDays(monthStart, -1);
    return { from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd };
  }
  if (p === "90") return { from: addDays(today, -89), to: today };
  return { from: null, to: null };
}

type Employee = { id: string; name: string; org_id: string; product: string };
type RepStats = {
  id: string; name: string; done: number; scheduled: number; plansOnly: number;
  newCount: number; converted: number; upgradeCount: number; upgraded: number; scriptPct: number;
};

export default function MeetingPlansPage() {
  const [today] = useState(todayLocal);
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<"all" | "menu" | "nahjez">("all");
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async (p: PeriodKey) => {
    const { from, to } = periodRange(p, today);
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    try {
      const r = await fetch(`/api/meetings/report?${qs}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "تعذّر التحميل");
      setRows(j.rows ?? []);
      setEmployees(j.employees ?? []);
      setIsManager(!!j.me?.isManager);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحميل");
      setRows([]);
    }
  }, [today]);

  useEffect(() => { load(period); }, [load, period]);

  const filtered = useMemo(
    () => (rows ?? []).filter((m) => product === "all" || m.product === product),
    [rows, product],
  );

  const stats = useMemo(() => {
    const cal = filtered.filter((m) => m.kind === "calendar");
    const done = cal.filter((m) => m.status === "done");
    const withPlan = filtered.filter((m) => m.token);
    const newRows = filtered.filter((m) => m.purpose === "new");
    const upRows = filtered.filter((m) => m.purpose === "upgrade");
    return {
      done: done.length,
      scheduled: cal.filter((m) => m.status === "scheduled").length,
      plansOnly: filtered.filter((m) => m.kind === "plan").length,
      withPlan: withPlan.length,
      opened: withPlan.filter((m) => m.open_count > 0).length,
      newCount: newRows.length,
      converted: newRows.filter((m) => m.outcome === "converted").length,
      upgradeCount: upRows.length,
      upgraded: upRows.filter((m) => m.outcome === "upgraded").length,
      scriptPct: done.length ? Math.round((done.reduce((a, m) => a + m.script_done, 0) / (done.length * SCRIPT_TOTAL)) * 100) : 0,
    };
  }, [filtered]);

  /** كل الموظفين (حتى اللي ما عندهم اجتماعات) — مرتبين من الأقل اجتماعات للأكثر عشان يبان المقصّر. */
  const byRep = useMemo(() => {
    const map = new Map<string, RepStats & { scriptSum: number }>();
    const blank = (id: string, name: string) => ({
      id, name, done: 0, scheduled: 0, plansOnly: 0, newCount: 0, converted: 0, upgradeCount: 0, upgraded: 0, scriptPct: 0, scriptSum: 0,
    });
    for (const e of employees) {
      if (product !== "all" && e.product !== product) continue;
      map.set(e.id, blank(e.id, e.name));
    }
    for (const m of filtered) {
      const key = m.rep_id ?? m.rep_name ?? "—";
      const r = map.get(key) ?? blank(key, m.rep_name || "—");
      if (m.kind === "plan") r.plansOnly += 1;
      else if (m.status === "done") { r.done += 1; r.scriptSum += m.script_done; }
      else r.scheduled += 1;
      if (m.purpose === "new") { r.newCount += 1; if (m.outcome === "converted") r.converted += 1; }
      else { r.upgradeCount += 1; if (m.outcome === "upgraded") r.upgraded += 1; }
      map.set(key, r);
    }
    return [...map.values()]
      .map(({ scriptSum, ...r }) => ({ ...r, scriptPct: r.done ? Math.round((scriptSum / (r.done * SCRIPT_TOTAL)) * 100) : 0 }))
      .sort((a, b) => (a.done + a.scheduled) - (b.done + b.scheduled) || a.name.localeCompare(b.name, "ar"));
  }, [filtered, employees, product]);

  const noMeetingCount = byRep.filter((r) => r.done + r.scheduled === 0).length;

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/offer/meeting?m=${token}`);
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  const loading = rows === null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-black text-foreground">
              <Presentation className="h-6 w-6 text-cc-purple" /> اجتماعات العملاء
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
              مواعيد Google Meet من «الاجتماعات» مع نتيجة كل اجتماع حسب هدفه: عميل جديد يتحوّل لموافق، أو عميل حالي يترقّى.
              {!isManager && " تشوف اجتماعاتك أنت فقط."}
            </p>
          </div>
          <Link href="/meetings" className="flex items-center gap-1.5 rounded-xl border border-indigo-500/25 bg-indigo-500/15 px-3.5 py-2 text-[13px] font-bold text-indigo-200 hover:bg-indigo-500/25">
            <CalendarDays className="h-4 w-4" /> التقويم وموعد جديد
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented value={period} onChange={(p) => { setRows(null); setPeriod(p); }} options={PERIODS} />
          <Segmented value={product} onChange={setProduct} options={[["all", "كل المنتجات"], ["menu", PRODUCT_LABEL.menu], ["nahjez", PRODUCT_LABEL.nahjez]]} />
        </div>
      </div>

      {error && <div className="rounded-xl border border-cc-red/30 bg-red-dim p-4 text-sm text-cc-red">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Stat icon={<CheckCircle2 className="h-4 w-4" />} tone="text-cc-green" label="اجتماعات تمّت" value={n(stats.done)}
          sub={stats.scheduled ? `+ ${n(stats.scheduled)} مجدول` : stats.plansOnly ? `+ ${n(stats.plansOnly)} رابط بدون موعد` : undefined} />
        <Stat icon={<UserPlus className="h-4 w-4" />} tone="text-emerald-300" label="عملاء جدد تحوّلوا" value={`${n(stats.converted)} / ${n(stats.newCount)}`}
          progress={pct(stats.converted, stats.newCount)} sub={`${n(pct(stats.converted, stats.newCount))}٪ تحويل`} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} tone="text-cc-purple" label="ترقيات تمّت" value={`${n(stats.upgraded)} / ${n(stats.upgradeCount)}`}
          progress={pct(stats.upgraded, stats.upgradeCount)} sub={`${n(pct(stats.upgraded, stats.upgradeCount))}٪ ترقية`} />
        <Stat icon={<ListChecks className="h-4 w-4" />} tone="text-amber" label="إكمال المحاور" value={`${n(stats.scriptPct)}٪`}
          progress={stats.scriptPct} sub="في الاجتماعات اللي تمّت" />
        <Stat icon={<Eye className="h-4 w-4" />} tone="text-cc-blue" label="فتح خطة الاجتماع" value={`${n(stats.opened)} / ${n(stats.withPlan)}`}
          progress={pct(stats.opened, stats.withPlan)} className="col-span-2 lg:col-span-1" />
      </div>

      {/* Per employee */}
      {isManager && (
        <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-black text-foreground">حسب الموظف</h2>
            {noMeetingCount > 0 && !loading && (
              <span className="flex items-center gap-1 rounded-lg bg-amber-dim px-2 py-1 text-[11px] font-bold text-amber">
                <AlertTriangle className="h-3.5 w-3.5" /> {n(noMeetingCount)} بدون أي اجتماع
              </span>
            )}
          </div>
          {loading ? <Spinner /> : byRep.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ما فيه موظفين.</p>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-right text-xs text-muted-foreground">
                      <th className="py-2 pl-3 font-medium whitespace-nowrap">الموظف</th>
                      <th className="py-2 px-2 font-medium whitespace-nowrap">تمّت</th>
                      <th className="py-2 px-2 font-medium whitespace-nowrap">مجدولة</th>
                      <th className="py-2 px-2 font-medium whitespace-nowrap">جدد ← تحوّل</th>
                      <th className="py-2 px-2 font-medium whitespace-nowrap">ترقية ← تمّت</th>
                      <th className="w-[26%] py-2 px-2 font-medium whitespace-nowrap">إكمال المحاور</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byRep.map((r) => {
                      const none = r.done + r.scheduled === 0;
                      return (
                        <tr key={r.id} className={`border-b border-border/50 last:border-0 ${none ? "bg-amber-500/[0.04]" : ""}`}>
                          <td className="py-2.5 pl-3 font-bold text-foreground whitespace-nowrap">
                            {r.name}
                            {none && <span className="mr-2 text-[11px] font-bold text-amber">ما سوّى اجتماع</span>}
                          </td>
                          <td className="py-2.5 px-2 tabular-nums font-bold">{n(r.done)}</td>
                          <td className="py-2.5 px-2 tabular-nums text-muted-foreground">{n(r.scheduled)}</td>
                          <td className="py-2.5 px-2 tabular-nums"><b className="text-cc-green">{n(r.converted)}</b> <span className="text-muted-foreground">/ {n(r.newCount)}</span></td>
                          <td className="py-2.5 px-2 tabular-nums"><b className="text-cc-purple">{n(r.upgraded)}</b> <span className="text-muted-foreground">/ {n(r.upgradeCount)}</span></td>
                          <td className="py-2.5 px-2"><Bar value={r.scriptPct} empty={!r.done} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {byRep.map((r) => {
                  const none = r.done + r.scheduled === 0;
                  return (
                    <div key={r.id} className={`rounded-xl border p-3 ${none ? "border-amber-500/25 bg-amber-500/[0.05]" : "border-border/60 bg-white/[0.02]"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <b className="text-[14px] text-foreground truncate">{r.name}</b>
                        {none
                          ? <span className="text-[11px] font-bold text-amber shrink-0">ما سوّى اجتماع</span>
                          : <span className="text-[12px] text-muted-foreground shrink-0">تمّت <b className="text-foreground">{n(r.done)}</b>{r.scheduled > 0 && ` · مجدولة ${n(r.scheduled)}`}</span>}
                      </div>
                      {!none && (
                        <>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                            <span className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-muted-foreground">جدد تحوّلوا: <b className="text-cc-green">{n(r.converted)}</b> / {n(r.newCount)}</span>
                            <span className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-muted-foreground">ترقيات: <b className="text-cc-purple">{n(r.upgraded)}</b> / {n(r.upgradeCount)}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="shrink-0">المحاور</span><Bar value={r.scriptPct} empty={!r.done} />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* Meetings */}
      <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <h2 className="mb-3 text-sm font-black text-foreground">الاجتماعات</h2>
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ما فيه اجتماعات في هذي الفترة. أنشئ موعد مع عميل من{" "}
            <Link href="/meetings" className="text-indigo-300 underline">التقويم</Link>.
          </p>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted-foreground">
                    <th className="py-2 pl-3 font-medium">العميل</th>
                    <th className="py-2 px-2 font-medium">الهدف</th>
                    {isManager && <th className="py-2 px-2 font-medium">الموظف</th>}
                    <th className="py-2 px-2 font-medium">الموعد</th>
                    <th className="py-2 px-2 font-medium">المحاور</th>
                    <th className="py-2 px-2 font-medium">الصفقة</th>
                    <th className="py-2 px-2 font-medium">النتيجة</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.key} className="border-b border-border/50 last:border-0 align-top">
                      <td className="py-2.5 pl-3">
                        <div className="font-bold text-foreground">{m.client_name || "—"}</div>
                        {m.client_phone && <div className="text-[11px] text-muted-foreground" dir="ltr">{m.client_phone}</div>}
                        {product === "all" && m.product && <div className="text-[11px] text-muted-foreground">{PRODUCT_LABEL[m.product] ?? m.product}</div>}
                      </td>
                      <td className="py-2.5 px-2"><PurposeBadge m={m} /></td>
                      {isManager && <td className="py-2.5 px-2 text-xs whitespace-nowrap">{m.rep_name || "—"}</td>}
                      <td className="py-2.5 px-2 text-xs whitespace-nowrap"><When m={m} /></td>
                      <td className="py-2.5 px-2 text-xs whitespace-nowrap"><Script m={m} /></td>
                      <td className="py-2.5 px-2 text-xs text-muted-foreground">
                        {m.deal_stage || "—"}
                        {m.tier_name && <div className="text-[11px]">الباقة: {m.tier_name}</div>}
                      </td>
                      <td className="py-2.5 px-2"><ColorBadge text={OUTCOME[m.outcome].text} color={OUTCOME[m.outcome].color} /></td>
                      <td className="py-2.5"><PlanActions m={m} copied={copied} onCopy={copyLink} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {filtered.map((m) => (
                <div key={m.key} className="rounded-xl border border-border/60 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b className="block text-[14px] text-foreground truncate">{m.client_name || "—"}</b>
                      <span className="text-[11px] text-muted-foreground">
                        {isManager && m.rep_name ? `${m.rep_name} · ` : ""}<When m={m} inline />
                      </span>
                    </div>
                    <ColorBadge text={OUTCOME[m.outcome].text} color={OUTCOME[m.outcome].color} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                    <PurposeBadge m={m} />
                    <Script m={m} />
                    {m.deal_stage && <span>الصفقة: {m.deal_stage}</span>}
                    <span className="mr-auto"><PlanActions m={m} copied={copied} onCopy={copyLink} /></span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/* ─── أجزاء صغيرة ─── */

function Stat({ icon, tone, label, value, sub, progress, className = "" }: {
  icon: React.ReactNode; tone: string; label: string; value: string; sub?: string; progress?: number; className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-muted-foreground">{label}</span>
        <span className={tone}>{icon}</span>
      </div>
      <p className={`mt-1 text-xl font-black tabular-nums ${tone}`}>{value}</p>
      {progress !== undefined && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full bg-current opacity-70 ${tone}`} style={{ width: `${progress}%` }} />
        </div>
      )}
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Bar({ value, empty }: { value: number; empty?: boolean }) {
  if (empty) return <span className="text-[11px] text-muted-foreground">—</span>;
  const color = value >= 75 ? "bg-cc-green" : value >= 50 ? "bg-amber" : "bg-cc-red";
  return (
    <div className="flex flex-1 items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 text-left text-xs font-bold tabular-nums">{n(value)}٪</span>
    </div>
  );
}

function PurposeBadge({ m }: { m: ReportRow }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap ${m.purpose === "upgrade" ? "bg-sky-500/15 text-sky-300" : "bg-emerald-500/15 text-emerald-300"}`}>
      {m.purpose === "upgrade" ? <TrendingUp className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
      {m.purpose === "upgrade" ? "ترقية" : "عميل جديد"}
    </span>
  );
}

function When({ m, inline }: { m: ReportRow; inline?: boolean }) {
  const status = m.kind === "plan" ? "رابط بدون موعد" : m.status === "done" ? "تم" : "مجدول";
  const tone = m.kind === "plan" ? "text-muted-foreground" : m.status === "done" ? "text-cc-green" : "text-amber";
  if (inline) return <>{fmtDate(m.date)}{m.time ? ` ${m.time}` : ""} · <span className={tone}>{status}</span></>;
  return (
    <>
      <div className="text-foreground">{fmtDate(m.date)}{m.time && <span className="text-muted-foreground font-mono"> {m.time}</span>}</div>
      <div className={`text-[11px] ${tone}`}>{status}</div>
    </>
  );
}

function Script({ m }: { m: ReportRow }) {
  if (m.kind === "plan") return <span className="text-muted-foreground">—</span>;
  const full = m.script_done >= SCRIPT_TOTAL;
  return (
    <span className={`inline-flex items-center gap-1 ${full ? "text-cc-green" : m.status === "done" ? "text-amber" : "text-muted-foreground"}`}>
      <ListChecks className="h-3 w-3" /> المحاور {n(m.script_done)}/{n(SCRIPT_TOTAL)}
    </span>
  );
}

function PlanActions({ m, copied, onCopy }: { m: ReportRow; copied: string | null; onCopy: (t: string) => void }) {
  if (!m.token) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{m.open_count > 0 ? `فُتحت ${n(m.open_count)}` : "لم تُفتح"}</span>
      <a href={`/offer/meeting?m=${m.token}`} target="_blank" rel="noopener noreferrer" title="فتح خطة الاجتماع"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <button type="button" onClick={() => onCopy(m.token!)} title="نسخ الرابط"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
        {copied === m.token ? <Check className="h-3.5 w-3.5 text-cc-green" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

function Spinner() {
  return <div className="flex justify-center py-8 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex max-w-full overflow-x-auto rounded-lg border border-border bg-card p-0.5 text-xs font-bold scrollbar-hide">
      {options.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${value === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
