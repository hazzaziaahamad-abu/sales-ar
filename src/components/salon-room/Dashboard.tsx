"use client";

// تبويب «الداشبورد»: صورة واحدة لكل العملاء وحالاتهم — قمع التحويل، المراحل، الصحة، الفريق، وجدول الحالات.

import React, { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Crosshair, Store, FileSignature, Wallet, TrendingUp, AlertTriangle, Filter, Layers, HeartPulse, Users, Table2, ArrowUpDown, Gift } from "lucide-react";
import { HEALTH, SESSION_NAME, STAGES, stageLabel, type Health, type Stage } from "@/lib/salon-room";
import { needsAttention, type RoomData } from "./SalonRoom";
import { ACTIVE_STAGES, CONTRACT_STAGES, goalsProgress, isActive, isLead, lastActivity, planProgress, ratio, weekProgress } from "./metrics";
import { Avatar, Badge, EmptyState, GOLD, SectionTitle, card, dateLabel, fmt, timeAgo, todayKey } from "./ui";
import { SessionSettingsButton, sessionMetrics } from "./FreeSession";
import type { Targets } from "@/lib/salon-room";

type SortKey = "salon" | "stage" | "health" | "plan" | "goals" | "review" | "activity";
const HEALTH_ORDER: Health[] = ["off_track", "at_risk", "on_track"];

export default function Dashboard({ data, onOpen, onSaveTargets }: { data: RoomData; onOpen: (id: string) => void; onSaveTargets: (t: Targets) => void }) {
  const today = todayKey();
  const [now] = useState(() => Date.now());
  const [stageF, setStageF] = useState<Stage | "all">("all");
  const [healthF, setHealthF] = useState<Health | "all">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "health", dir: 1 });

  const all = data.clients;
  const leads = all.filter(isLead);
  const active = all.filter(isActive);
  const contracted = all.filter((c) => c.contracted_at);
  const contractValue = contracted.reduce((s, c) => s + (c.contract_value ?? 0), 0);
  const attention = all.filter((c) => needsAttention(c, data.tasks, today) && !isLead(c));
  const everConverted = all.filter((c) => c.converted_at).length;
  const conversion = all.length ? everConverted / all.length : 0;
  const w = weekProgress(all, data.logs, now);
  const sm = sessionMetrics(all, data.targets, now);

  // قمع التحويل: كل مرحلة = اللي وصلوها أو تعدّوها
  const contactedIds = new Set(data.logs.filter((l) => l.kind === "contact").map((l) => l.client_id));
  const funnel = [
    { label: "مستهدف", value: all.length },
    { label: "تم التواصل", value: all.filter((c) => c.converted_at || c.lead_status !== "new" || contactedIds.has(c.id)).length },
    { label: "اجتماع / تحويل لعميل", value: everConverted },
    { label: "متعاقد", value: contracted.length },
    { label: "أكمل الرحلة", value: all.filter((c) => c.stage === "done").length },
  ];

  const stageRows = STAGES.filter((s) => s.id !== "lead").map((s) => ({ id: s.id, label: s.label, value: all.filter((c) => c.stage === s.id).length }));
  const maxStage = Math.max(1, ...stageRows.map((r) => r.value));
  const healthRows = HEALTH_ORDER.map((h) => ({ id: h, ...HEALTH[h], value: active.filter((c) => c.health === h).length }));

  const consultants = Array.from(new Set([...data.team.filter((m) => m.active).map((m) => m.name), ...all.map((c) => c.consultant).filter(Boolean) as string[]]));
  const teamRows = consultants.map((name) => {
    const mine = active.filter((c) => c.consultant === name);
    return {
      name,
      leads: leads.filter((c) => c.consultant === name && c.lead_status !== "not_interested").length,
      contacts: w.byMember.get(name) ?? 0,
      total: mine.length,
      byHealth: HEALTH_ORDER.map((h) => ({ h, n: mine.filter((c) => c.health === h).length })),
      value: all.filter((c) => c.consultant === name && c.contracted_at).reduce((s, c) => s + (c.contract_value ?? 0), 0),
    };
  }).sort((a, b) => b.total - a.total);
  const maxTeam = Math.max(1, ...teamRows.map((r) => r.total));

  const rows = useMemo(() => {
    const list = all.filter((c) => !isLead(c) && (stageF === "all" || c.stage === stageF) && (healthF === "all" || c.health === healthF))
      .map((c) => ({ c, plan: planProgress(c, data.tasks), goals: goalsProgress(c), activity: lastActivity(c, data.logs) }));
    const stageIdx = (s: Stage) => STAGES.findIndex((x) => x.id === s);
    const val = (r: (typeof list)[number]): string | number => {
      switch (sort.key) {
        case "salon": return r.c.salon_name;
        case "stage": return stageIdx(r.c.stage);
        case "health": return HEALTH_ORDER.indexOf(r.c.health);
        case "plan": return r.plan.pct;
        case "goals": return r.goals ?? -1;
        case "review": return r.c.next_review ?? "9999";
        case "activity": return -Date.parse(r.activity);
      }
    };
    return list.sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
    });
  }, [all, data.tasks, data.logs, stageF, healthF, sort]);

  const th = (key: SortKey, label: string) => (
    <th className="py-2 font-bold">
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))} className="inline-flex items-center gap-1 hover:text-[var(--ink)]">
        {label} <ArrowUpDown size={10} className={sort.key === key ? "text-[var(--acc)]" : ""} />
      </button>
    </th>
  );

  if (all.length === 0) return <EmptyState icon={Store} text="ما فيه بيانات بعد — ابدئي بإضافة الصالونات المستهدفة من تبويب «خطة الاستهداف»." />;

  return (
    <div className="space-y-5">
      {/* ─── الأرقام الرئيسية ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Crosshair} label="صالونات مستهدفة" value={fmt(leads.filter((c) => c.lead_status !== "not_interested").length)} sub={`${fmt(w.contacts)} تواصل هذا الأسبوع`} />
        <Kpi icon={Store} label="عملاء نشطين" value={fmt(active.length)} sub="من الاستكشاف إلى المراجعة" />
        <Kpi icon={FileSignature} label="متعاقدين" value={fmt(contracted.length)} sub={`${fmt(w.contracts)} هذا الأسبوع`} />
        <Kpi icon={Wallet} label="قيمة العقود" value={`${fmt(contractValue)} ر.س`} sub="مجموع العقود الموقّعة" />
        <Kpi icon={TrendingUp} label="نسبة التحويل" value={`${fmt(conversion * 100)}٪`} sub="من مستهدف إلى عميل" />
        <Kpi icon={AlertTriangle} label="بحاجة انتباه" value={fmt(attention.length)} sub="حالة أو مهام أو مراجعة" tone={attention.length ? "#D9A21B" : undefined} />
      </div>

      {/* ─── تحويل الجلسات المجانية ─── */}
      <div className={`${card} p-5`} style={{ borderColor: `${GOLD}66` }}>
        <SectionTitle icon={Gift} title={`تحويل الجلسات المجانية — «${SESSION_NAME}»`}
          action={<SessionSettingsButton targets={data.targets} avgContract={sm.avgContract} onSave={onSaveTargets} />} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { l: "محجوزة", v: sm.booked },
            { l: "تمّت", v: sm.held },
            { l: "تعاقدت", v: sm.contracted, tone: "#16A34A" },
            { l: "عروض متأخرة (+٤٨ س)", v: sm.overdue.length, tone: sm.overdue.length ? "#DC2626" : undefined },
          ].map((x) => (
            <div key={x.l} className="rounded-2xl border border-[var(--line)] p-3">
              <div className="text-[11px] font-bold text-[var(--muted)]">{x.l}</div>
              <div className="mt-0.5 text-xl font-black" style={{ color: x.tone ?? "var(--ink)" }}>{fmt(x.v)}</div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
            <span className="font-bold text-[var(--body)]">نسبة التحويل (من الجلسات اللي انتهت بقرار)</span>
            <span className="text-[var(--muted)]">
              <b className="text-sm text-[var(--ink)]">{sm.conversion === null ? "—" : `${fmt(sm.conversion * 100)}٪`}</b>
              {sm.breakEven !== null && <> — نقطة التعادل {fmt(sm.breakEven * 100)}٪</>}
            </span>
          </div>
          <div className="relative h-4 rounded-full bg-[var(--surface-2)]" title={sm.breakEven !== null ? `نقطة التعادل = تكلفة الجلسة ${fmt(data.targets.session_cost)} ÷ متوسط العقد ${fmt(sm.avgContract ?? 0)}` : ""}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(sm.conversion ?? 0) * 100}%`, background: sm.conversion !== null && sm.breakEven !== null && sm.conversion < sm.breakEven ? "#DC2626" : "var(--acc)" }} />
            {sm.breakEven !== null && <span className="absolute -top-1 h-6 w-0.5 rounded" style={{ insetInlineStart: `${Math.min(100, sm.breakEven * 100)}%`, background: GOLD }} />}
          </div>
          <p className="mt-2 text-xs font-bold" style={{ color: sm.conversion === null || sm.breakEven === null ? "var(--faint)" : sm.conversion >= sm.breakEven ? "#16A34A" : "#DC2626" }}>
            {sm.conversion === null
              ? "ما فيه جلسات انتهت بقرار بعد (تعاقد أو ما تعاقد)."
              : sm.breakEven === null
                ? "سجّلي قيمة العقود في بطاقات الصالونات المتعاقدة عشان تنحسب نقطة التعادل."
                : sm.conversion >= sm.breakEven
                  ? "الجلسات المجانية مجدية — التحويل فوق نقطة التعادل."
                  : "التحويل تحت نقطة التعادل — شدّدي شروط التأهيل قبل الحجز."}
          </p>
          <p className="mt-1 text-[11px] text-[var(--faint)]">
            تكلفة الجلسات اللي تمّت: {fmt(sm.spend)} ر.س — عقود جاءت منها: {fmt(sm.revenue)} ر.س
            {sm.avgContract !== null && <> — متوسط العقد {fmt(sm.avgContract)} ر.س</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ─── قمع التحويل ─── */}
        <div className={`${card} p-5`}>
          <SectionTitle icon={Filter} title="قمع التحويل" />
          <ol className="space-y-2.5">
            {funnel.map((f, i) => {
              const p = ratio(f.value, funnel[0].value);
              const prev = i > 0 ? funnel[i - 1].value : null;
              return (
                <li key={f.label} title={`${f.label}: ${fmt(f.value)} (${fmt(p * 100)}٪ من المستهدفين)`}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-bold text-[var(--body)]">{f.label}</span>
                    <span className="text-[var(--muted)]"><b className="text-sm text-[var(--ink)]">{fmt(f.value)}</b> ({fmt(p * 100)}٪)
                      {prev ? <span className="text-[var(--faint)]"> — {fmt(ratio(f.value, prev) * 100)}٪ من السابقة</span> : null}</span>
                  </div>
                  <div className="h-6 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                    <div className="h-full rounded-lg transition-all duration-700" style={{ width: `${Math.max(p * 100, f.value ? 2 : 0)}%`, background: "var(--acc)", opacity: 1 - i * 0.14 }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* ─── توزيع المراحل ─── */}
        <div className={`${card} p-5`}>
          <SectionTitle icon={Layers} title="العملاء حسب المرحلة" />
          <ul className="space-y-2">
            {stageRows.map((r) => (
              <li key={r.id} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 text-xs" title={`${r.label}: ${fmt(r.value)}`}>
                <span className="truncate font-bold text-[var(--body)]">{r.label}</span>
                <span className="h-4 overflow-hidden rounded-md bg-[var(--surface-2)]">
                  <span className="block h-full rounded-md transition-all duration-700" style={{ width: `${(r.value / maxStage) * 100}%`, background: ACTIVE_STAGES.includes(r.id) ? "var(--acc)" : "var(--line-strong)" }} />
                </span>
                <span className="text-left font-black text-[var(--ink)]">{fmt(r.value)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ─── صحة العملاء ─── */}
        <div className={`${card} p-5`}>
          <SectionTitle icon={HeartPulse} title="صحة العملاء النشطين" />
          {active.length ? (
            <>
              <div className="flex h-8 gap-0.5 overflow-hidden rounded-xl">
                {healthRows.filter((h) => h.value).map((h) => (
                  <div key={h.id} className="grid h-full place-items-center text-[11px] font-black text-white transition-all" style={{ width: `${(h.value / active.length) * 100}%`, background: h.color }} title={`${h.label}: ${fmt(h.value)}`}>
                    {fmt(h.value)}
                  </div>
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {healthRows.map((h) => (
                  <li key={h.id} className="rounded-2xl border border-[var(--line)] p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--body)]"><span className="h-2 w-2 rounded-full" style={{ background: h.color }} /> {h.label}</div>
                    <div className="mt-0.5 text-xl font-black text-[var(--ink)]">{fmt(h.value)}</div>
                    <div className="text-[10px] text-[var(--faint)]">{fmt(ratio(h.value, active.length) * 100)}٪</div>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="text-xs text-[var(--faint)]">ما فيه عملاء نشطين بعد.</p>}
        </div>

        {/* ─── الفريق ─── */}
        <div className={`${card} p-5`}>
          <SectionTitle icon={Users} title="أداء الفريق" />
          <ul className="space-y-3">
            {teamRows.map((r) => (
              <li key={r.name}>
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <Avatar name={r.name} size={22} />
                  <span className="flex-1 font-black text-[var(--ink)]">{r.name}</span>
                  <span className="text-[var(--muted)]">{fmt(r.leads)} مستهدف، {fmt(r.contacts)} تواصل، <b className="text-[var(--ink)]">{fmt(r.total)}</b> عميل، {fmt(r.value)} ر.س</span>
                </div>
                <div className="flex h-3 gap-0.5 overflow-hidden rounded-md bg-[var(--surface-2)]" style={{ width: `${Math.max(4, (r.total / maxTeam) * 100)}%` }}>
                  {r.byHealth.filter((x) => x.n).map((x) => (
                    <span key={x.h} className="h-full" style={{ width: `${(x.n / Math.max(1, r.total)) * 100}%`, background: HEALTH[x.h].color }} title={`${HEALTH[x.h].label}: ${fmt(x.n)}`} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
            {HEALTH_ORDER.slice().reverse().map((h) => <span key={h} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: HEALTH[h].color }} /> {HEALTH[h].label}</span>)}
          </div>
        </div>
      </div>

      {/* ─── جدول حالات العملاء ─── */}
      <div className={`${card} p-5`}>
        <SectionTitle icon={Table2} title="حالات العملاء" action={
          <div className="flex flex-wrap gap-1.5">
            <select value={stageF} onChange={(e) => setStageF(e.target.value as Stage | "all")} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--body)]" aria-label="المرحلة">
              <option value="all">كل المراحل</option>
              {STAGES.filter((s) => s.id !== "lead").map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={healthF} onChange={(e) => setHealthF(e.target.value as Health | "all")} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--body)]" aria-label="الحالة">
              <option value="all">كل الحالات</option>
              {HEALTH_ORDER.map((h) => <option key={h} value={h}>{HEALTH[h].label}</option>)}
            </select>
          </div>
        } />
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-right text-[11px] text-[var(--faint)]">
                {th("salon", "الصالون")}<th className="py-2 font-bold">المستشارة</th>{th("stage", "المرحلة")}{th("health", "الحالة")}
                {th("plan", "خطة التنفيذ")}{th("goals", "الأهداف")}{th("review", "المراجعة")}{th("activity", "آخر نشاط")}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, plan, goals, activity }) => (
                <tr key={c.id} onClick={() => onOpen(c.id)} className="cursor-pointer border-t border-[var(--line)] transition-colors hover:bg-[var(--hover)]">
                  <td className="py-2.5 font-black text-[var(--ink)]">{c.salon_name}<div className="text-[11px] font-normal text-[var(--faint)]">{c.city ?? ""}</div></td>
                  <td><span className="inline-flex items-center gap-1.5 text-xs text-[var(--body)]"><Avatar name={c.consultant} size={20} /> {c.consultant ?? "—"}</span></td>
                  <td className="text-xs font-bold text-[var(--body)]">{stageLabel(c.stage)}</td>
                  <td><Badge color={HEALTH[c.health].color}><span className="h-1.5 w-1.5 rounded-full" style={{ background: HEALTH[c.health].color }} />{HEALTH[c.health].label}</Badge></td>
                  <td className="w-36" title={`${fmt(plan.done)} من ${fmt(plan.total)} مهمة`}>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full" style={{ width: `${plan.pct * 100}%`, background: "var(--acc)" }} /></span>
                      <span className="w-8 text-[11px] font-bold text-[var(--muted)]">{fmt(plan.pct * 100)}٪</span>
                    </div>
                  </td>
                  <td className="text-xs font-bold" style={{ color: goals === null ? "var(--faint)" : goals >= 1 ? "#16A34A" : "var(--body)" }}>{goals === null ? "—" : `${fmt(goals * 100)}٪`}</td>
                  <td className="text-xs" style={{ color: c.next_review && c.next_review < today ? "#DC2626" : "var(--body)" }}>{dateLabel(c.next_review)}</td>
                  <td className="text-xs text-[var(--faint)]">{timeAgo(activity)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-xs text-[var(--faint)]">ما فيه عملاء بهذا الفلتر.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[var(--faint)]">«خطة التنفيذ» = نسبة المهام المنجزة · «الأهداف» = متوسط تقدّم أهداف الـ ٩٠ يوم من «قبل» إلى الهدف — {fmt(CONTRACT_STAGES.length)} مراحل بعد التوقيع.</p>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ color: tone ?? "var(--acc)", background: `color-mix(in srgb, ${tone ?? "var(--acc)"} 12%, transparent)` }}><Icon size={15} /></span>
        <span className="text-[11px] font-bold text-[var(--muted)]">{label}</span>
      </div>
      <div className="mt-2 text-xl font-black" style={{ color: tone ?? "var(--ink)" }}>{value}</div>
      <div className="text-[10px] text-[var(--faint)]">{sub}</div>
    </div>
  );
}

