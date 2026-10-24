"use client";

import { useEffect, useMemo, useState } from "react";
import { Presentation, Eye, CheckCircle2, Percent, ExternalLink, Copy, Check } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { ColorBadge } from "@/components/ui/color-badge";
import { PRODUCT_LABEL, type ClientMeetingRow } from "@/lib/client-meetings";

const PERIODS = [
  { key: "30", label: "آخر ٣٠ يوم", days: 30 },
  { key: "90", label: "آخر ٩٠ يوم", days: 90 },
  { key: "all", label: "الكل", days: 0 },
] as const;

const OUTCOME = {
  converted: { text: "وافق", color: "green" },
  lost: { text: "رفض", color: "red" },
  open: { text: "قيد المتابعة", color: "amber" },
} as const;

const fmtDate = (s: string) => new Date(s).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function MeetingPlansPage() {
  const [rows, setRows] = useState<ClientMeetingRow[] | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<"all" | "menu" | "nahjez">("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["key"]>("30");
  const [copied, setCopied] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/client-meetings", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "تعذّر التحميل");
        setRows(j.meetings ?? []);
        setIsManager(!!j.me?.isManager);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "تعذّر التحميل"));
  }, []);

  const filtered = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? 0;
    const since = days ? now - days * 86400000 : 0;
    return (rows ?? []).filter((m) => (product === "all" || m.product === product) && new Date(m.created_at).getTime() >= since);
  }, [rows, product, period, now]);

  const total = filtered.length;
  const opened = filtered.filter((m) => m.open_count > 0).length;
  const converted = filtered.filter((m) => m.outcome === "converted").length;

  const byRep = useMemo(() => {
    const map = new Map<string, { name: string; total: number; opened: number; converted: number; lost: number }>();
    for (const m of filtered) {
      const key = m.rep_id ?? m.rep_name ?? "—";
      const r = map.get(key) ?? { name: m.rep_name || "—", total: 0, opened: 0, converted: 0, lost: 0 };
      r.total += 1;
      if (m.open_count > 0) r.opened += 1;
      if (m.outcome === "converted") r.converted += 1;
      if (m.outcome === "lost") r.lost += 1;
      map.set(key, r);
    }
    return [...map.values()].sort((a, b) => b.converted - a.converted || b.total - a.total);
  }, [filtered]);

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/offer/meeting?m=${token}`);
      setCopied(token);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-foreground">
            <Presentation className="h-6 w-6 text-cc-purple" /> اجتماعات العملاء
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كل رابط «خطة اجتماع» يُنشأ من صفقة العميل، والتحويل يُحسب تلقائياً لما تصير الصفقة مكتملة أو انتظار الدفع بعد الاجتماع.
            {!isManager && " — تشوف اجتماعاتك أنت فقط."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented value={product} onChange={setProduct} options={[["all", "الكل"], ["menu", PRODUCT_LABEL.menu], ["nahjez", PRODUCT_LABEL.nahjez]]} />
          <Segmented value={period} onChange={setPeriod} options={PERIODS.map((p) => [p.key, p.label] as [typeof p.key, string])} />
        </div>
      </div>

      {error && <div className="rounded-xl border border-cc-red/30 bg-red-dim p-4 text-sm text-cc-red">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={total.toLocaleString("ar-SA")} label="اجتماعات" color="purple" icon={<Presentation className="h-4 w-4" />} />
        <StatCard value={opened.toLocaleString("ar-SA")} label="تم فتح العرض" color="blue" icon={<Eye className="h-4 w-4" />} progress={pct(opened, total)} />
        <StatCard value={converted.toLocaleString("ar-SA")} label="تحوّل لموافق" color="green" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard value={`${pct(converted, total).toLocaleString("ar-SA")}٪`} label="نسبة التحويل" color="amber" icon={<Percent className="h-4 w-4" />} progress={pct(converted, total)} />
      </div>

      {isManager && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-black text-foreground">حسب الموظف</h2>
          {byRep.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ما فيه اجتماعات في هذي الفترة.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted-foreground">
                    <th className="py-2 font-medium">الموظف</th>
                    <th className="py-2 font-medium">اجتماعات</th>
                    <th className="py-2 font-medium">فتح العرض</th>
                    <th className="py-2 font-medium">وافق</th>
                    <th className="py-2 font-medium">رفض</th>
                    <th className="w-[32%] py-2 font-medium">نسبة التحويل</th>
                  </tr>
                </thead>
                <tbody>
                  {byRep.map((r) => (
                    <tr key={r.name} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-bold text-foreground">{r.name}</td>
                      <td className="py-2.5 tabular-nums">{r.total.toLocaleString("ar-SA")}</td>
                      <td className="py-2.5 tabular-nums">{r.opened.toLocaleString("ar-SA")}</td>
                      <td className="py-2.5 font-bold tabular-nums text-cc-green">{r.converted.toLocaleString("ar-SA")}</td>
                      <td className="py-2.5 tabular-nums text-cc-red">{r.lost.toLocaleString("ar-SA")}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-cc-green" style={{ width: `${pct(r.converted, r.total)}%` }} />
                          </div>
                          <span className="w-10 text-left text-xs font-bold tabular-nums">{pct(r.converted, r.total).toLocaleString("ar-SA")}٪</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-black text-foreground">الاجتماعات</h2>
        {rows === null && !error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ما فيه اجتماعات بعد. افتح صفقة العميل في «المبيعات» واضغط زر خطة الاجتماع.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted-foreground">
                  <th className="py-2 font-medium">العميل</th>
                  <th className="py-2 font-medium">المنتج</th>
                  {isManager && <th className="py-2 font-medium">الموظف</th>}
                  <th className="py-2 font-medium">التاريخ</th>
                  <th className="py-2 font-medium">الباقة المختارة</th>
                  <th className="py-2 font-medium">مرحلة الصفقة</th>
                  <th className="py-2 font-medium">النتيجة</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const o = OUTCOME[m.outcome ?? "open"];
                  return (
                    <tr key={m.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5">
                        <div className="font-bold text-foreground">{m.client_name || "—"}</div>
                        {m.client_phone && <div className="text-[11px] text-muted-foreground" dir="ltr">{m.client_phone}</div>}
                      </td>
                      <td className="py-2.5 text-xs">{PRODUCT_LABEL[m.product] ?? m.product}</td>
                      {isManager && <td className="py-2.5 text-xs">{m.rep_name || "—"}</td>}
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {fmtDate(m.created_at)}
                        <div className="text-[11px]">{m.open_count > 0 ? `فُتح ${m.open_count.toLocaleString("ar-SA")} مرة` : "لم يُفتح"}</div>
                      </td>
                      <td className="py-2.5 text-xs">{m.tier_name || "—"}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{m.current_stage || "—"}</td>
                      <td className="py-2.5"><ColorBadge text={o.text} color={o.color} /></td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <a href={`/offer/meeting?m=${m.token}`} target="_blank" rel="noopener noreferrer" title="فتح العرض"
                            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <button type="button" onClick={() => copyLink(m.token)} title="نسخ الرابط"
                            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                            {copied === m.token ? <Check className="h-3.5 w-3.5 text-cc-green" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-lg border border-border bg-card p-0.5 text-xs font-bold">
      {options.map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`rounded-md px-3 py-1.5 transition-colors ${value === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
