"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { formatMoneyFull } from "@/lib/utils/format";
import {
  DEPARTMENTS, DEPT_LABEL, suggestFromHistory, suggestFromPipeline,
  type DailyPlan, type DailySettings, type Department, type DeptBaseline, type DeptMember, type DeptTargetRow, type TargetMethod,
} from "@/lib/daily-tasks/shared";
import { DailyReportView } from "./daily-report";

interface SettingsData {
  period: string;
  date: string;
  settings: DailySettings;
  baselines: Record<Department, DeptBaseline>;
  targets: (DeptTargetRow & { approved_by_name: string | null; approved_at: string | null })[];
  users: { id: string; name: string }[];
  plans: DailyPlan[];
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const monthName = (p: string) => MONTHS[Number(p.slice(5, 7)) - 1] ?? p;
const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const inputCls = "w-24 rounded-lg border border-border bg-muted px-2 py-1 text-center font-mono text-sm";

async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "تعذّر الاتصال");
  return data as T;
}

export function DailySettingsCenter() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"reports" | "goals" | "daily" | "team">("reports");
  const [dept, setDept] = useState<Department>("office");
  const [date, setDate] = useState<string>("");

  const load = useCallback(async (d?: string) => {
    try {
      setData(await api<SettingsData>(`/api/daily-tasks/settings${d ? `?date=${d}` : ""}`));
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : "تعذّر التحميل"); }
  }, []);
  useEffect(() => {
    let alive = true;
    api<SettingsData>("/api/daily-tasks/settings")
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "تعذّر التحميل"); });
    return () => { alive = false; };
  }, []);

  const save = async (body: unknown, okMsg: string) => {
    setMsg(null);
    try { await api("/api/daily-tasks/settings", body); setMsg(okMsg); await load(date || undefined); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذّر الحفظ"); }
  };

  if (error && !data) return <p className="text-sm text-red-400">{error}</p>;
  if (!data) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> تحميل…</div>;

  const tabs: [typeof tab, string][] = [["reports", "تقارير اليوم"], ["goals", "الأهداف"], ["daily", "النشاط اليومي"], ["team", "الفريق وأيام العمل"]];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-dim"><Settings2 className="h-4 w-4 text-cyan" /></div>
        <div><h1 className="text-lg font-extrabold">مركز مهام اليوم</h1>
          <p className="text-xs text-muted-foreground">تقارير الفريق، أهداف {monthName(data.period)}، والإعدادات. كل رقم هنا يُحفظ بدون تعديل كود.</p></div>
      </div>
      <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold ${tab === k ? "bg-card" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {msg && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{msg}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {tab === "reports" && <Reports data={data} date={date || data.date} onDate={(d) => { setDate(d); load(d); }} />}
      {tab === "goals" && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {DEPARTMENTS.map((d) => (
              <button key={d} type="button" onClick={() => setDept(d)} className={`rounded-full border px-4 py-1 text-sm font-bold ${dept === d ? "border-cyan bg-cyan text-[#07090F]" : "border-border text-muted-foreground"}`}>{DEPT_LABEL[d]}</button>
            ))}
          </div>
          <Goals key={dept} data={data} dept={dept} onSave={save} />
        </>
      )}
      {tab === "daily" && <DailyTargets data={data} onSave={save} />}
      {tab === "team" && <Team data={data} onSave={save} />}
    </div>
  );
}

// ─── تقارير اليوم ────────────────────────────────────────────────────────
function Reports({ data, date, onDate }: { data: SettingsData; date: string; onDate: (d: string) => void }) {
  const members = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of DEPARTMENTS) for (const x of data.settings.members[d] ?? []) m.set(x.user_id, x.name);
    return [...m.entries()];
  }, [data.settings.members]);
  const byUser = new Map(data.plans.map((p) => [p.user_id, p]));
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-muted-foreground">اليوم
        <input type="date" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} className="rounded-lg border border-border bg-muted px-2 py-1 text-sm text-foreground" />
      </label>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-muted text-xs text-muted-foreground"><tr>
            <th className="px-3 py-2 text-right">الموظف</th><th className="px-3 py-2">الحالة</th><th className="px-3 py-2">البدء</th><th className="px-3 py-2">الطابور</th><th className="px-3 py-2">الأولويات</th><th className="px-3 py-2">عائق</th>
          </tr></thead>
          <tbody>
            {members.map(([id, name]) => {
              const p = byUser.get(id);
              const r = p?.report;
              return (
                <tr key={id} className="border-t border-border text-center">
                  <td className="px-3 py-2 text-right font-bold">{name}</td>
                  <td className={`px-3 py-2 ${!p ? "text-red-400" : p.finished_at ? "text-emerald-400" : "text-cyan"}`}>{!p ? "لم يبدأ" : p.finished_at ? "أنهى" : "يعمل"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p ? new Date(p.started_at).toLocaleTimeString("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r ? `${n(r.queue_done)}/${n(r.queue_total)}` : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p ? `${r ? n(r.priorities_done) + "/" : ""}${n(p.priorities.length)}` : "—"}</td>
                  <td className="px-3 py-2 text-xs text-amber-400">{p?.blocker_note ? "✓" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.plans.filter((p) => p.report).map((p) => <DailyReportView key={p.id} plan={p} showName />)}
      </div>
      {data.plans.filter((p) => p.report).length === 0 && <p className="text-sm text-muted-foreground">لا تقارير منتهية لهذا اليوم بعد.</p>}
    </div>
  );
}

// ─── الأهداف ─────────────────────────────────────────────────────────────
function Goals({ data, dept, onSave }: { data: SettingsData; dept: Department; onSave: (b: unknown, m: string) => Promise<void> }) {
  const b = data.baselines[dept];
  const existing = data.targets.find((t) => t.department === dept && t.user_id === null);
  const members = data.settings.members[dept] ?? [];
  const [method, setMethod] = useState<TargetMethod>(existing?.method ?? "history");
  const [growth, setGrowth] = useState(10);
  const [rates, setRates] = useState<number[]>(b.pipeline.map((r) => r[2]));
  // اليدوي يبدأ من المعتمد، وإلا من مقترح الأداء السابق — لا يبدأ من صفر
  const [manual, setManual] = useState(() => {
    if (existing) return { min: existing.min_value ?? 0, target: existing.target_value, stretch: existing.stretch_value ?? existing.target_value };
    const h = suggestFromHistory(b, 10);
    return { min: h.min, target: h.target, stretch: h.stretch };
  });
  const [shares, setShares] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    const saved = data.targets.filter((t) => t.department === dept && t.user_id);
    if (saved.length) for (const t of saved) out[t.user_id!] = Number(t.share_pct) || 0;
    else {
      // افتراضياً بالتساوي — المدير يعدّل النسب
      members.forEach((m) => { out[m.user_id] = Math.floor(100 / Math.max(1, members.length)); });
      const diff = 100 - Object.values(out).reduce((a, c) => a + c, 0);
      if (members[0]) out[members[0].user_id] += diff;
    }
    return out;
  });

  const hist = suggestFromHistory(b, growth);
  const pipe = suggestFromPipeline(b, rates);
  const s = method === "history" ? hist : method === "pipeline" ? pipe : manual;
  const ratio = hist.avg ? pipe.target / hist.avg : 0;
  /** ينتقل لليدوي ويبدأ من الأرقام الظاهرة الآن */
  const editManually = () => {
    if (method !== "manual") setManual({ min: s.min, target: s.target, stretch: s.stretch });
    setMethod("manual");
  };
  const totalShare = Object.values(shares).reduce((a, c) => a + (Number(c) || 0), 0);

  const approve = () => onSave({
    target: {
      department: dept, method, min: s.min, target: s.target, stretch: s.stretch,
      basis: method === "history" ? { growth, history: b.history } : method === "pipeline" ? { rates, pipeline: b.pipeline, avgValue: b.avgValue } : null,
      shares: members.map((m) => ({ user_id: m.user_id, share_pct: shares[m.user_id] ?? 0 })),
    },
  }, `اعتُمد هدف ${DEPT_LABEL[dept]} لشهر ${monthName(data.period)} · يظهر الآن في مهام اليوم للفريق`);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <b>هدف {monthName(data.period)} · {DEPT_LABEL[dept]}</b>
          <span className={`rounded px-2 text-xs font-bold ${existing ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
            {existing ? `معتمد${existing.approved_by_name ? ` · ${existing.approved_by_name}` : ""}` : "مسودة"}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {([["history", "من الأداء السابق"], ["pipeline", "من أرقام القائمة"], ["manual", "يدوي"]] as [TargetMethod, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => (k === "manual" ? editManually() : setMethod(k))} className={`rounded-lg border py-2 text-xs font-bold ${method === k ? "border-cyan bg-cyan-dim text-cyan" : "border-border text-muted-foreground"}`}>{l}</button>
          ))}
        </div>

        {method === "history" && (
          <div className="space-y-2 text-sm">
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              {b.history.map(([p, v]) => <span key={p} className="ml-3">{monthName(p)} <b className="text-foreground">{formatMoneyFull(v)}</b></span>)}
              <div>المتوسط <b className="text-foreground">{formatMoneyFull(Math.round(hist.avg))}</b></div>
            </div>
            <label className="flex items-center justify-between gap-2 text-muted-foreground">نسبة النمو على المتوسط
              <select value={growth} onChange={(e) => setGrowth(Number(e.target.value))} className={inputCls}>
                {[0, 5, 10, 15, 20, 30].map((g) => <option key={g} value={g}>{g}%</option>)}
              </select>
            </label>
          </div>
        )}
        {method === "pipeline" && (
          <div className="space-y-2 text-sm">
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              عدد القائمة الآن × نسبة التحويل × متوسط القيمة المكتملة <b className="text-foreground">{formatMoneyFull(b.avgValue)}</b>
            </div>
            {b.pipeline.map((row, i) => (
              <label key={row[0]} className="flex items-center justify-between gap-2 text-muted-foreground">
                <span>{row[0]} <b className="text-foreground">({n(row[1])})</b> · تحويل %</span>
                <input type="number" min={0} max={100} value={rates[i] ?? row[2]} onChange={(e) => setRates((r) => r.map((x, j) => (j === i ? Number(e.target.value) || 0 : x)))} className={inputCls} />
              </label>
            ))}
            {ratio > 1.5 && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                القائمة تعطي {ratio.toFixed(1)}× متوسط ما أُغلق فعلاً ({formatMoneyFull(Math.round(hist.avg))}). غالباً فيها صفقات قديمة، أو نسب التحويل أعلى من الواقع.
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 text-center">
          {([["min", "الحد الأدنى"], ["target", "الهدف"], ["stretch", "الطموح"]] as const).map(([k, l], i) => (
            <label key={k} className={`rounded-lg border bg-muted px-1 py-2 ${i === 1 ? "border-cyan" : "border-border"}`}>
              <div className="text-[11px] text-muted-foreground">{l}</div>
              {method === "manual" ? (
                <input type="number" min={0} step={100} inputMode="numeric" value={manual[k]}
                  onChange={(e) => setManual((m) => ({ ...m, [k]: Number(e.target.value) || 0 }))}
                  className="w-full bg-transparent text-center font-mono text-sm font-bold outline-none" aria-label={l} />
              ) : (
                <b className="font-mono text-sm">{formatMoneyFull(s[k])}</b>
              )}
            </label>
          ))}
        </div>
        {method !== "manual"
          ? <button type="button" onClick={editManually} className="w-full rounded-lg border border-border py-1.5 text-xs font-bold text-cyan">✎ تعديل الأرقام يدوياً</button>
          : <p className="text-[11px] text-muted-foreground">اكتب الأرقام مباشرة في المربعات أعلاه (بالريال). الحد الأدنى ≤ الهدف ≤ الطموح.</p>}
        <p className="text-xs text-muted-foreground">المحقق حتى الآن: <b className="text-foreground">{formatMoneyFull(b.mtd)}</b></p>
        <button type="button" onClick={approve} disabled={!s.target || Math.round(totalShare) !== 100 && members.length > 0}
          className="w-full rounded-xl bg-cyan py-2.5 text-sm font-extrabold text-[#07090F] disabled:opacity-40">اعتماد هدف {DEPT_LABEL[dept]}</button>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        <b>التوزيع على الموظفين</b>
        <p className="text-xs text-muted-foreground">اكتب نسبة كل موظف من هدف القسم في المربع (٪). المبلغ بجانب الاسم يُحسب تلقائياً.</p>
        {members.length === 0 && <p className="text-xs text-muted-foreground">لا موظفين في هذا القسم. أضفهم من تبويب «الفريق وأيام العمل».</p>}
        {members.map((m) => (
          <label key={m.user_id} className="flex items-center justify-between gap-2 text-muted-foreground">
            <span>{m.name} · <b className="text-foreground">{formatMoneyFull(Math.round(s.target * (shares[m.user_id] ?? 0) / 100))}</b>
              <span className="mr-2 text-[11px]">محقق {formatMoneyFull(Math.round(b.mtdByRep[m.name] ?? 0))}</span></span>
            <span className="flex items-center gap-1"><input type="number" min={0} max={100} value={shares[m.user_id] ?? 0}
              onChange={(e) => setShares((x) => ({ ...x, [m.user_id]: Number(e.target.value) || 0 }))} className={`${inputCls} w-16`} />%</span>
          </label>
        ))}
        {members.length > 0 && (
          <p className={`text-xs ${Math.round(totalShare) === 100 ? "text-muted-foreground" : "text-amber-400"}`}>مجموع النسب {n(totalShare)}%{Math.round(totalShare) === 100 ? "" : " · يجب أن يساوي ١٠٠٪"}</p>
        )}
      </div>
    </div>
  );
}

// ─── النشاط اليومي ───────────────────────────────────────────────────────
function DailyTargets({ data, onSave }: { data: SettingsData; onSave: (b: unknown, m: string) => Promise<void> }) {
  const [act, setAct] = useState(data.settings.activity);
  const [cap, setCap] = useState(data.settings.queueCap);
  const [speed, setSpeed] = useState(data.settings.speed);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
        <b>أهداف النشاط اليومية</b>
        {DEPARTMENTS.map((d) => (
          <div key={d} className="space-y-1.5 rounded-lg bg-muted/50 p-2.5">
            <div className="font-bold">{DEPT_LABEL[d]}</div>
            <label className="flex items-center justify-between gap-2 text-muted-foreground">محاولات استهداف يومياً
              <input type="number" min={0} value={act[d].prospect} onChange={(e) => setAct((a) => ({ ...a, [d]: { ...a[d], prospect: Number(e.target.value) || 0 } }))} className={inputCls} />
            </label>
            {d !== "renewals" && (
              <p className={`text-[11px] ${act[d].prospect > data.baselines[d].newPerDay * 3 && act[d].prospect > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                المتوسط الفعلي آخر ٣٠ يوماً: {data.baselines[d].newPerDay} صفقة جديدة يومياً للقسم كله
              </p>
            )}
            <label className="flex items-center justify-between gap-2 text-muted-foreground">اجتماعات منفذة يومياً
              <input type="number" min={0} value={act[d].meetings} onChange={(e) => setAct((a) => ({ ...a, [d]: { ...a[d], meetings: Number(e.target.value) || 0 } }))} className={inputCls} />
            </label>
          </div>
        ))}
        <button type="button" onClick={() => onSave({ settings: { activity: act } }, "حُفظت أهداف النشاط اليومية")} className="w-full rounded-xl bg-cyan py-2 text-sm font-bold text-[#07090F]">حفظ</button>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
        <b>الطابور وشارة المدة</b>
        <label className="flex items-center justify-between gap-2 text-muted-foreground">أقصى عدد في الطابور
          <input type="number" min={5} value={cap} onChange={(e) => setCap(Number(e.target.value) || 5)} className={inputCls} />
        </label>
        <p className="text-[11px] text-muted-foreground">الباقي يظهر كرقم «في الانتظار».</p>
        {([["fast", "سريعة حتى (يوم)"], ["normal", "طبيعية حتى (يوم)"], ["slow", "بطيئة حتى (يوم)"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-2 text-muted-foreground">{l}
            <input type="number" min={0} value={speed[k]} onChange={(e) => setSpeed((s) => ({ ...s, [k]: Number(e.target.value) || 0 }))} className={inputCls} />
          </label>
        ))}
        <p className="text-[11px] text-muted-foreground">أكثر من حد «بطيئة» = متعثرة. المدة من تاريخ إنشاء الصفقة.</p>
        <button type="button" onClick={() => onSave({ settings: { queueCap: cap, speed } }, "حُفظت إعدادات الطابور")} className="w-full rounded-xl bg-cyan py-2 text-sm font-bold text-[#07090F]">حفظ</button>
      </div>
    </div>
  );
}

// ─── الفريق وأيام العمل ──────────────────────────────────────────────────
function Team({ data, onSave }: { data: SettingsData; onSave: (b: unknown, m: string) => Promise<void> }) {
  const [members, setMembers] = useState(data.settings.members);
  const [days, setDays] = useState<number[]>(data.settings.workDays);
  const has = (d: Department, id: string) => (members[d] ?? []).some((m) => m.user_id === id);
  const toggle = (d: Department, u: { id: string; name: string }) => setMembers((cur) => {
    const list = cur[d] ?? [];
    return { ...cur, [d]: has(d, u.id) ? list.filter((m) => m.user_id !== u.id) : [...list, { user_id: u.id, name: u.name, ...(d === "renewals" ? { sales_type: "support" as const } : {}) }] };
  });
  const setRenewType = (id: string, t: "office" | "support") =>
    setMembers((cur) => ({ ...cur, renewals: (cur.renewals ?? []).map((m: DeptMember) => (m.user_id === id ? { ...m, sales_type: t } : m)) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
        <b>توزيع الفريق على الأقسام</b>
        <p className="text-xs text-muted-foreground">يظهر شريط «مهام اليوم» لمن في التوزيع فقط. الطابور يتبع الموظف المسند في الصفقة أو التجديد.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1.5 text-right">الموظف</th>{DEPARTMENTS.map((d) => <th key={d} className="py-1.5">{DEPT_LABEL[d]}</th>)}</tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-1.5">{u.name}</td>
                  {DEPARTMENTS.map((d) => (
                    <td key={d} className="py-1.5 text-center">
                      <input type="checkbox" checked={has(d, u.id)} onChange={() => toggle(d, u)} aria-label={`${u.name} · ${DEPT_LABEL[d]}`} />
                      {d === "renewals" && has(d, u.id) && (
                        <select value={(members.renewals ?? []).find((m) => m.user_id === u.id)?.sales_type ?? "support"}
                          onChange={(e) => setRenewType(u.id, e.target.value as "office" | "support")}
                          className="mr-1 rounded border border-border bg-muted px-1 text-[11px]">
                          <option value="support">دعم</option><option value="office">مكتب</option>
                        </select>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={() => onSave({ settings: { members } }, "حُفظ توزيع الفريق")} className="w-full rounded-xl bg-cyan py-2 text-sm font-bold text-[#07090F]">حفظ التوزيع</button>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
        <b>أيام العمل</b>
        <p className="text-xs text-muted-foreground">تدخل في حساب «المطلوب اليوم» من هدف الشهر.</p>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((l, i) => (
            <button key={l} type="button" onClick={() => setDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
              className={`rounded-lg border px-3 py-1 text-xs font-bold ${days.includes(i) ? "border-cyan bg-cyan-dim text-cyan" : "border-border text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={() => onSave({ settings: { workDays: days } }, "حُفظت أيام العمل")} className="w-full rounded-xl bg-cyan py-2 text-sm font-bold text-[#07090F]">حفظ</button>
      </div>
    </div>
  );
}
