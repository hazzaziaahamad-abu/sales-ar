"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ShieldCheck, MessageCircle, PhoneCall, RefreshCw, Brain, Phone,
  Settings2, Save, Plus, X, Clock, AlertTriangle, RotateCw,
} from "lucide-react";
import type { Deal, Renewal, EmployeeTask } from "@/types";
import {
  fetchDeals, fetchRenewals, fetchEmployeeTasks,
  fetchSupervisorTeams, saveSupervisorTeams, type SupervisorTeams,
} from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { formatMoneyFull } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── المراحل النشطة لبايبلاين الواتس (متابعة) ─── */
const ACTIVE_STAGES = [
  "قيد التواصل", "عميل جديد", "تم إرسال العرض", "تفاوض",
  "تجهيز", "انتظار الدفع", "تجريبي", "اعادة الاتصال في وقت اخر", "تاجيل",
];

type Tone = "cyan" | "blue" | "purple" | "amber" | "green" | "red" | "sky";
const STAGE_TONE: Record<string, Tone> = {
  "قيد التواصل": "cyan", "عميل جديد": "blue", "تم إرسال العرض": "purple", "تفاوض": "purple",
  "تجهيز": "cyan", "انتظار الدفع": "amber", "تجريبي": "blue",
  "اعادة الاتصال في وقت اخر": "amber", "تاجيل": "blue",
};
const TONE_HEX: Record<Tone, string> = {
  cyan: "#00D4FF", blue: "#7da6ff", purple: "#8B5CF6", amber: "#F59E0B",
  green: "#10B981", red: "#EF4444", sky: "#7da6ff",
};

function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86_400_000);
}
function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((d - Date.now()) / 86_400_000);
}
function sanitizePhone(phone?: string): string {
  if (!phone) return "";
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("05")) p = "966" + p.slice(1);
  else if (p.startsWith("5") && p.length === 9) p = "966" + p;
  return p;
}
const inTeam = (name: string | undefined, team: string[]) =>
  !!name && team.some((t) => t && (name.includes(t) || t.includes(name)));

type Tab = "wa" | "call" | "ren";

export default function AiSupervisorPage() {
  const { activeOrgId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("wa");

  const [teams, setTeams] = useState<SupervisorTeams>({ wa: [], call: [] });
  const [deals, setDeals] = useState<Deal[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [callTasks, setCallTasks] = useState<EmployeeTask[]>([]);

  const load = useCallback(async () => {
    try {
      const [t, office, support, ren, tasks] = await Promise.all([
        fetchSupervisorTeams(),
        fetchDeals("office"),
        fetchDeals("support"),
        fetchRenewals(),
        fetchEmployeeTasks(),
      ]);
      setTeams(t);
      setDeals([...office, ...support]);
      setRenewals(ren);
      setCallTasks(tasks.filter((x) => x.task_type === "call"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLoading(true); load(); }, [load, activeOrgId]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  /* ─── بايبلاين الواتس: صفقات فريق الواتس في مراحل نشطة ─── */
  const waDeals = useMemo(
    () => deals.filter((d) => ACTIVE_STAGES.includes(d.stage) && inTeam(d.assigned_rep_name, teams.wa)),
    [deals, teams.wa],
  );
  const waByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const d of waDeals) {
      const arr = map.get(d.stage) || [];
      arr.push(d);
      map.set(d.stage, arr);
    }
    return ACTIVE_STAGES.filter((s) => map.has(s)).map((s) => ({ stage: s, items: map.get(s)! }));
  }, [waDeals]);

  /* ─── بايبلاين الاتصال: مهام call لفريق الاتصال ─── */
  const callOpen = useMemo(
    () => callTasks
      .filter((t) => t.status === "pending" || t.status === "in_progress")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [callTasks],
  );
  const callClosedToday = useMemo(
    () => callTasks.filter((t) => t.status === "completed" && (daysSince(t.completed_at) ?? 99) < 1),
    [callTasks],
  );

  /* ─── التجديدات: تصنيف بالتاريخ ─── */
  const renBuckets = useMemo(() => {
    const open = renewals.filter((r) => {
      const s = (r.status || "").trim();
      return s !== "تم التجديد" && s !== "ملغي" && s !== "مجدد";
    });
    const overdue: Renewal[] = [], soon: Renewal[] = [], active: Renewal[] = [];
    for (const r of open) {
      const du = daysUntil(r.renewal_date);
      if (du === null) { active.push(r); continue; }
      if (du < 0) overdue.push(r);
      else if (du <= 7) soon.push(r);
      else active.push(r);
    }
    const sortByDate = (a: Renewal, b: Renewal) => new Date(a.renewal_date).getTime() - new Date(b.renewal_date).getTime();
    return { overdue: overdue.sort(sortByDate), soon: soon.sort(sortByDate), active: active.sort(sortByDate) };
  }, [renewals]);

  /* ─── ملخّص المشرف الذكي (قواعد بسيطة) ─── */
  const insights = useMemo(() => {
    const out: { icon: string; text: string }[] = [];
    const stalePay = waDeals.filter((d) => d.stage === "انتظار الدفع" && (daysSince(d.last_contact || d.updated_at) ?? 0) >= 3);
    if (stalePay.length) {
      const top = [...stalePay].sort((a, b) => b.deal_value - a.deal_value)[0];
      out.push({ icon: "🔴", text: `${stalePay.length} عميل في «انتظار الدفع» تجاوزوا ٣ أيام بلا تواصل — الأعلى قيمةً ${top.client_name} (${formatMoneyFull(top.deal_value)}).` });
    }
    const pending = callOpen.filter((t) => t.status === "pending");
    if (pending.length) {
      const oldest = daysSince(pending[pending.length - 1]?.created_at);
      out.push({ icon: "📞", text: `${pending.length} طلب اتصال بانتظار القبول${oldest && oldest >= 1 ? ` — أقدمها منذ ${oldest} يوم` : ""}.` });
    }
    const staleWa = waDeals.filter((d) => (daysSince(d.last_contact || d.updated_at) ?? 0) >= 2 && d.stage !== "انتظار الدفع");
    if (staleWa.length) out.push({ icon: "🟠", text: `${staleWa.length} عميل في المتابعة بلا تواصل منذ يومين أو أكثر — يحتاجون لمسة.` });
    if (renBuckets.overdue.length) {
      const val = renBuckets.overdue.reduce((s, r) => s + (r.plan_price || 0), 0);
      out.push({ icon: "🔁", text: `${renBuckets.overdue.length} تجديد متأخر بقيمة ${formatMoneyFull(val)} — راجع تحويلها لطابور الاتصال.` });
    }
    if (!out.length) out.push({ icon: "✅", text: "الأمور منتظمة — لا تنبيهات حرجة في المتابعة أو الاتصال حالياً." });
    return out;
  }, [waDeals, callOpen, renBuckets.overdue]);

  const kpis = {
    wa: waDeals.length,
    call: callOpen.length,
    stale: waDeals.filter((d) => (daysSince(d.last_contact || d.updated_at) ?? 0) >= 3).length,
    renWeek: renBuckets.overdue.length + renBuckets.soon.length,
  };

  const tabs: { key: Tab; icon: ReactNode; label: string; n: number }[] = [
    { key: "wa", icon: <MessageCircle className="w-4 h-4" />, label: "متابعة الواتس", n: kpis.wa },
    { key: "call", icon: <PhoneCall className="w-4 h-4" />, label: "مبيعات الاتصال", n: kpis.call },
    { key: "ren", icon: <RefreshCw className="w-4 h-4" />, label: "التجديدات", n: renBuckets.overdue.length + renBuckets.soon.length + renBuckets.active.length },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,rgba(0,212,255,.18),rgba(139,92,246,.16))", border: "1px solid rgba(0,212,255,.25)" }}>
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">مشرف AI</h1>
            <p className="text-xs text-muted-foreground">إشراف حيّ على المبيعات ومبيعات الدعم والتجديدات — للقراءة فقط</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">👁️ للقراءة فقط</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => load()}>
            <RotateCw className="w-3.5 h-3.5" /> تحديث
          </Button>
        </div>
      </div>

      {/* Team config */}
      <TeamConfig teams={teams} onSaved={(t) => setTeams(t)} canEdit={!!user} />

      {/* AI insight strip */}
      <div className="rounded-[14px] p-4 border"
        style={{ borderColor: "rgba(139,92,246,.28)", background: "linear-gradient(105deg,rgba(139,92,246,.12),rgba(0,212,255,.05) 60%,transparent)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-purple-400" />
          <b className="text-sm text-foreground">ملخّص المشرف الذكي</b>
          <span className="text-[10px] text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-md mr-auto">تحليل تلقائي</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {loading
            ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)
            : insights.map((it, i) => (
              <div key={i} className="flex gap-2.5 items-start text-[12.5px] leading-relaxed rounded-xl px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] text-foreground/90">
                <span className="shrink-0">{it.icon}</span><span>{it.text}</span>
              </div>
            ))}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="في متابعة الواتس" value={kpis.wa} tone="cyan" icon={<MessageCircle className="w-4 h-4" />} />
        <Kpi label="مكالمات الاتصال المفتوحة" value={kpis.call} tone="green" icon={<PhoneCall className="w-4 h-4" />} />
        <Kpi label="متأخرة +٣ أيام بلا تواصل" value={kpis.stale} tone="red" icon={<AlertTriangle className="w-4 h-4" />} />
        <Kpi label="تجديدات الأسبوع (متأخر/قريب)" value={kpis.renWeek} tone="sky" icon={<RefreshCw className="w-4 h-4" />} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-[12px] text-sm font-semibold transition-all border ${
              tab === t.key ? "bg-cyan-500/13 text-cyan-400 border-cyan-500/30" : "bg-white/[0.04] text-muted-foreground border-white/[0.07] hover:bg-white/[0.07] hover:text-foreground"}`}>
            {t.icon}{t.label}
            <span className={`text-[11px] font-mono rounded-md px-1.5 ${tab === t.key ? "bg-cyan-500/20 text-cyan-400" : "bg-white/[0.08]"}`}>{t.n}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : tab === "wa" ? (
        <WaBoard byStage={waByStage} team={teams.wa} />
      ) : tab === "call" ? (
        <CallBoard open={callOpen} closedToday={callClosedToday} team={teams.call} />
      ) : (
        <RenewalBoard buckets={renBuckets} callTasks={callTasks} />
      )}
    </div>
  );
}

/* ─── KPI tile ─── */
function Kpi({ label, value, tone, icon }: { label: string; value: number; tone: Tone; icon: ReactNode }) {
  const hex = TONE_HEX[tone];
  return (
    <div className="cc-card rounded-[14px] p-4">
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span className="w-6 h-6 rounded-lg grid place-items-center" style={{ background: `${hex}22`, color: hex }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold font-mono mt-2" style={{ color: hex }}>{value}</div>
    </div>
  );
}

/* ─── Team configuration (editable) ─── */
function TeamConfig({ teams, onSaved, canEdit }: { teams: SupervisorTeams; onSaved: (t: SupervisorTeams) => void; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [wa, setWa] = useState<string[]>(teams.wa);
  const [call, setCall] = useState<string[]>(teams.call);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setWa(teams.wa); setCall(teams.call); }, [teams.wa, teams.call]);

  async function handleSave() {
    setSaving(true);
    const next = { wa: wa.map((s) => s.trim()).filter(Boolean), call: call.map((s) => s.trim()).filter(Boolean) };
    try {
      await saveSupervisorTeams(next);
      onSaved(next);
      setOpen(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div className="cc-card rounded-[14px]">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2.5 px-4 py-3 text-right">
        <Settings2 className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-semibold text-foreground">إعداد الفرق</span>
        <span className="text-[12px] text-muted-foreground mr-auto truncate">
          واتس: {teams.wa.join("، ") || "—"} · اتصال: {teams.call.join("، ") || "—"}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 grid gap-4 sm:grid-cols-2 border-t border-border/40">
          <TeamEditor title="فريق الواتساب (متابعة)" hint="علي/مريم — دعم · عواطف — مبيعات" names={wa} setNames={setWa} tone="#00D4FF" disabled={!canEdit} />
          <TeamEditor title="فريق الاتصال (مساعدو الإغلاق)" hint="منال · تغريد" names={call} setNames={setCall} tone="#10B981" disabled={!canEdit} />
          <div className="sm:col-span-2 flex justify-end">
            <Button size="sm" className="gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white" onClick={handleSave} disabled={saving || !canEdit}>
              <Save className="w-3.5 h-3.5" /> {saving ? "جارٍ الحفظ…" : "حفظ الفرق"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamEditor({ title, hint, names, setNames, tone, disabled }: {
  title: string; hint: string; names: string[]; setNames: (n: string[]) => void; tone: string; disabled: boolean;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (v && !names.includes(v)) setNames([...names, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="text-[12.5px] font-semibold text-foreground">{title}</div>
      <div className="text-[11px] text-muted-foreground mb-2">{hint}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {names.map((n) => (
          <span key={n} className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-lg" style={{ background: `${tone}18`, color: tone, border: `1px solid ${tone}33` }}>
            {n}
            {!disabled && <button onClick={() => setNames(names.filter((x) => x !== n))}><X className="w-3 h-3" /></button>}
          </span>
        ))}
        {!names.length && <span className="text-[12px] text-muted-foreground/60">لا أحد بعد</span>}
      </div>
      {!disabled && (
        <div className="flex gap-1.5">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder="أضف اسم موظف…" className="flex-1 text-[13px] rounded-lg bg-white/[0.03] border border-white/[0.08] px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan-500/40" />
          <button onClick={add} className="px-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-muted-foreground hover:text-foreground"><Plus className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}

/* ─── WhatsApp follow-up board ─── */
function WaBoard({ byStage, team }: { byStage: { stage: string; items: Deal[] }[]; team: string[] }) {
  if (!byStage.length) {
    return <Empty text={team.length ? "لا يوجد عملاء في متابعة فريق الواتساب حالياً." : "أضف أعضاء فريق الواتساب من «إعداد الفرق» لعرض متابعاتهم."} />;
  }
  return (
    <>
      <div className="flex flex-wrap gap-2 items-center text-[12px] text-muted-foreground mb-1">
        <span>فريق الواتساب:</span>
        {team.map((n) => <span key={n} className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">{n}</span>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
        {byStage.map(({ stage, items }) => {
          const hex = TONE_HEX[STAGE_TONE[stage] || "cyan"];
          return (
            <div key={stage} className="rounded-[14px] p-3 flex flex-col gap-2.5" style={{ background: "#101828", border: "1px solid #283A52" }}>
              <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px dashed rgba(255,255,255,.08)" }}>
                <span className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground">
                  <span className="w-2 h-2 rounded-sm" style={{ background: hex }} />{stage}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground bg-white/[0.06] rounded-md px-1.5">{items.length}</span>
              </div>
              {items.map((d) => <LeadCard key={d.id} deal={d} />)}
            </div>
          );
        })}
      </div>
    </>
  );
}

function LeadCard({ deal }: { deal: Deal }) {
  const stale = daysSince(deal.last_contact || deal.updated_at);
  const phone = sanitizePhone(deal.client_phone);
  const staleTone = stale === null ? null : stale >= 4 ? "#EF4444" : stale >= 2 ? "#F59E0B" : "#6B7D94";
  return (
    <div className="rounded-[11px] p-2.5 flex flex-col gap-1.5" style={{ background: "#162032", border: "1px solid #283A52" }}>
      <div className="text-[13px] font-semibold text-foreground">{deal.client_name}</div>
      {deal.client_phone && <div className="text-[11px] text-muted-foreground font-mono" dir="ltr">{deal.client_phone}</div>}
      <div className="flex items-center gap-1.5 flex-wrap">
        {deal.assigned_rep_name && <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-white/[0.05] text-foreground/80">{deal.assigned_rep_name}</span>}
        {deal.deal_value > 0 && <span className="text-[11px] font-mono font-semibold text-emerald-400">{formatMoneyFull(deal.deal_value)}</span>}
        {staleTone && <span className="text-[10.5px] px-1.5 py-0.5 rounded-md" style={{ background: `${staleTone}1f`, color: staleTone }}>{stale === 0 ? "اليوم" : `${stale} يوم`}</span>}
      </div>
      {phone && (
        <div className="flex gap-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,.05)" }}>
          <a href={`tel:${deal.client_phone}`} className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><Phone className="w-3 h-3" /> اتصال</a>
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20"><MessageCircle className="w-3 h-3" /> واتساب</a>
        </div>
      )}
    </div>
  );
}

/* ─── Call board ─── */
function CallBoard({ open, closedToday, team }: { open: EmployeeTask[]; closedToday: EmployeeTask[]; team: string[] }) {
  const lifecycle = [
    ["١", "منشن لموظف اتصال", "#8B5CF6"], ["٢", "قبول الطلب", "#F59E0B"],
    ["٣", "تحديثات في المتابعات", "#00D4FF"], ["٤", "إغلاق بنتيجة", "#10B981"], ["↩", "ترجع لموظف الواتس", "#F97316"],
  ] as const;
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap rounded-[12px] px-3.5 py-2.5 mb-1 bg-white/[0.03] border border-white/[0.08]">
        {lifecycle.map(([n, label, hex], i) => (
          <span key={label} className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.09]">
              <b className="font-mono" style={{ color: hex }}>{n}</b>{label}
            </span>
            {i < lifecycle.length - 1 && <span className="text-dim">←</span>}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center text-[12px] text-muted-foreground mb-1">
        <span>فريق الاتصال:</span>
        {team.map((n) => <span key={n} className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08]">{n}</span>)}
        <span className="text-dim">· {open.filter((t) => t.status === "pending").length} بانتظار القبول · {closedToday.length} مغلقة اليوم</span>
      </div>

      {!open.length && !closedToday.length ? (
        <Empty text="لا توجد طلبات اتصال مفتوحة. أي «اطلب اتصال» من الفريق يظهر هنا." />
      ) : (
        <div className="space-y-2.5">
          {open.map((t) => <CallRow key={t.id} t={t} />)}
          {closedToday.map((t) => <CallRow key={t.id} t={t} closed />)}
        </div>
      )}
    </>
  );
}

function CallRow({ t, closed }: { t: EmployeeTask; closed?: boolean }) {
  const accepted = t.status === "in_progress";
  const stat = closed
    ? { label: "✅ مُغلقة", cls: "text-emerald-300 bg-emerald-500/12" }
    : accepted
      ? { label: "📞 جاري العمل", cls: "text-cyan-300 bg-cyan-500/12" }
      : { label: "⏳ بانتظار القبول", cls: "text-amber-300 bg-amber-500/12" };
  return (
    <div className={`cc-card rounded-[13px] p-3.5 flex gap-3 items-center flex-wrap ${closed ? "opacity-70" : ""}`}>
      <div className="min-w-[200px] flex-1">
        <div className="text-[14px] font-semibold text-foreground flex items-center gap-2 flex-wrap">
          {t.client_name || t.title}
          <span className="text-[10px] text-purple-300 bg-purple-500/13 border border-purple-500/22 px-2 py-0.5 rounded-md">منشن → اتصال</span>
        </div>
        <div className="text-[11.5px] text-muted-foreground mt-1 flex gap-2.5 flex-wrap items-center">
          {t.client_phone && <span className="font-mono text-foreground" dir="ltr">{t.client_phone}</span>}
          {t.assigned_by_name && <span>· صاحب الذكرة: <b className="text-orange-300">{t.assigned_by_name}</b></span>}
          {t.assigned_to_name && <span>· {accepted || closed ? "لدى" : "مُسندة لـ"}: <b className="text-cyan-300">{t.assigned_to_name}</b></span>}
        </div>
        {closed && t.completion_notes && (
          <div className="text-[11.5px] mt-1.5 rounded-md px-2.5 py-1.5 bg-emerald-500/[0.06] border border-emerald-500/15 text-foreground/85">
            النتيجة: {t.completion_notes} <span className="text-orange-300">↩ رجعت لصاحب الذكرة</span>
          </div>
        )}
      </div>
      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${stat.cls}`}>{stat.label}</span>
    </div>
  );
}

/* ─── Renewal board ─── */
function RenewalBoard({ buckets, callTasks }: { buckets: { overdue: Renewal[]; soon: Renewal[]; active: Renewal[] }; callTasks: EmployeeTask[] }) {
  const hasCall = (r: Renewal) =>
    callTasks.some((t) => (t.status === "pending" || t.status === "in_progress") &&
      ((t.entity_type === "renewal" && t.entity_id === r.id) || (t.client_name && t.client_name === r.customer_name)));
  const cols = [
    { key: "overdue", title: "متأخرة", tone: "#EF4444", items: buckets.overdue },
    { key: "soon", title: "قريبة (٧ أيام)", tone: "#F59E0B", items: buckets.soon },
    { key: "active", title: "نشطة", tone: "#10B981", items: buckets.active },
  ];
  if (!buckets.overdue.length && !buckets.soon.length && !buckets.active.length) {
    return <Empty text="لا توجد تجديدات مفتوحة حالياً." />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3 items-start">
      {cols.map((c) => (
        <div key={c.key} className="rounded-[14px] p-3 flex flex-col gap-2.5" style={{ background: "#101828", border: "1px solid #283A52" }}>
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px dashed rgba(255,255,255,.08)" }}>
            <span className="flex items-center gap-2 text-[12.5px] font-semibold text-foreground"><span className="w-2 h-2 rounded-sm" style={{ background: c.tone }} />{c.title}</span>
            <span className="text-[11px] font-mono text-muted-foreground bg-white/[0.06] rounded-md px-1.5">{c.items.length}</span>
          </div>
          {c.items.slice(0, 40).map((r) => {
            const du = daysUntil(r.renewal_date);
            const label = du === null ? "—" : du < 0 ? `فات ${Math.abs(du)} يوم` : du === 0 ? "اليوم" : `بعد ${du} يوم`;
            return (
              <div key={r.id} className="rounded-[11px] p-2.5 flex flex-col gap-1.5" style={{ background: "#162032", border: `1px solid ${c.key === "overdue" ? "rgba(239,68,68,.3)" : "#283A52"}` }}>
                <div className="text-[13px] font-semibold text-foreground">{r.customer_name}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Clock className="w-3 h-3" />{label}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {r.plan_price > 0 && <span className="text-[11px] font-mono font-semibold text-emerald-400">{formatMoneyFull(r.plan_price)}</span>}
                  {r.assigned_rep && <span className="text-[10.5px] px-2 py-0.5 rounded-md bg-white/[0.05] text-foreground/80">{r.assigned_rep}</span>}
                  {c.key !== "active" && !hasCall(r) && <span className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-red-500/12 text-red-300">بلا مهمة اتصال</span>}
                </div>
              </div>
            );
          })}
          {!c.items.length && <span className="text-[12px] text-muted-foreground/60 py-2 text-center">لا يوجد</span>}
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="cc-card rounded-2xl p-10 text-center">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-3"><ShieldCheck className="w-7 h-7 text-cyan-400/50" /></div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
