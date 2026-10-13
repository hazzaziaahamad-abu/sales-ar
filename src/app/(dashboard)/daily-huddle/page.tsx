"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getEditableContent, saveEditableContent, getEditableContentRange } from "@/lib/supabase/db";
import {
  fetchHuddleKpis, kpiStatus, memberOf, targetOf, KPI_DEFS, MEMBER_ROLES, DEFAULT_KPI_TARGETS,
  type HuddleKpis, type KpiKey, type KpiTargets,
} from "@/lib/huddle-kpis";
import { todayLocal, formatMoneyFull } from "@/lib/utils/format";
import { SecretaryView } from "@/components/secretary/secretary-view";
import { RecentUpdatesView } from "@/components/recent-updates/recent-updates-view";
import { SalesConfirmations } from "@/components/daily-huddle/sales-confirmations";
import { ChallengesHub } from "@/components/daily-huddle/challenges-hub";
import { WorkTicketsBoard } from "@/components/work-tickets/work-tickets-board";
import { MeetingsBoard } from "@/components/meetings/meetings-board";
import { AchievementsBoard } from "@/components/achievements/achievements-board";
import { VerificationsBoard } from "@/components/verifications/verifications-board";
import { TargetingQualityTab } from "@/components/daily-huddle/targeting-quality";
import { IdeasGarden } from "@/components/ideas/ideas-garden";
import { canUseIdeas } from "@/lib/ideas";
import { TEAM, KEY_PREFIX, weekStart, addDays, type QualityScores } from "@/components/daily-huddle/huddle-shared";
import { HuddleManagersButton } from "@/components/daily-huddle/huddle-managers-button";
import { useHuddleManagers } from "@/lib/huddle-managers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Users, Trophy, Save, Check, Settings2, Compass, HeartPulse, Activity, BadgeCheck, ShieldQuestion, Star, ClipboardCheck, Sprout } from "lucide-react";

// النموذج: اجتماع يومي قصير (Daily Huddle) + لوحة نتائج بمقاييس الأفعال (4DX).
// مؤشرات كل موظف تُقرأ تلقائياً من اللوحة (سجل المتابعة، الصفقات، التذاكر، التجديدات) — راجع lib/huddle-kpis.
// الموظف يكتب هنا فقط: أهم 3 أشياء اليوم + العائق.
const KPI_TARGETS_KEY = `${KEY_PREFIX}_kpi_targets`;

/** التزام اليوم — يُقيَّم في اليوم التالي: نُفّذ (true) أو لم يُنفَّذ (false). */
interface Commitment {
  text: string;
  done?: boolean;
}

interface Entry {
  /** قديم — أُلغي تسجيل الحضور من الواجهة. */
  attendance?: Attendance;
  commitments?: Commitment[];
  blocker?: string;
  /** قديم — كانت تُدخل يدوياً، صارت تُقرأ من اللوحة. */
  calls?: number;
  offers?: number;
  closes?: number;
  /** تقييمات يومية قديمة — صار التقييم أسبوعياً في تبويب «جودة الاستهداف». */
  quality?: QualityScores;
  updated_by?: string;
  updated_at?: string;
}

type Attendance = "present" | "late" | "absent";

const entryKey = (date: string, member: string) => `${KEY_PREFIX}:${date}:${member}`;

function prevDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const keyDate = (key: string) => key.split(":")[1];
const keyMember = (key: string) => key.split(":")[2];

const rateColor = (v: number) => (v >= 80 ? "text-emerald-400" : v >= 50 ? "text-amber-400" : "text-red-400");

const fmtKpi = (key: KpiKey, v: number) => (KPI_DEFS[key].money ? formatMoneyFull(v) : String(v));

function KpiRow({ k, value, target, kpis }: { k: KpiKey; value: number; target: number; kpis: HuddleKpis }) {
  const def = KPI_DEFS[k];
  const s = kpiStatus(def, value, target, kpis);
  const color = s.ok ? "text-emerald-400" : def.period === "now" ? "text-red-400" : "text-amber-400";
  return (
    <div title={def.hint}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {def.label}
          {def.period === "month" && s.needToday ? <span className="opacity-70"> · المطلوب اليوم {fmtKpi(k, s.needToday)}</span> : null}
        </span>
        <span className={`font-bold ${color}`}>
          {fmtKpi(k, value)}
          <span className="text-muted-foreground font-normal"> / {def.period === "now" ? `الهدف ${target}` : fmtKpi(k, target)}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] mt-1 overflow-hidden">
        <div className={`h-full ${s.ok ? "bg-emerald-500" : def.period === "now" ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${s.pct}%` }} />
      </div>
    </div>
  );
}

function TeamTodayTab({ isManager }: { isManager: boolean }) {
  const { user, activeOrgId } = useAuth();
  const myFirstName = user?.name?.trim().split(/\s+/)[0] ?? "";

  const [date, setDate] = useState(todayLocal());
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [week, setWeek] = useState<{ key: string; value: Entry }[]>([]);
  const [kpis, setKpis] = useState<HuddleKpis | null>(null);
  const [targets, setTargets] = useState<KpiTargets>(DEFAULT_KPI_TARGETS);
  const [editingTargets, setEditingTargets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // منال تُسجَّل بالإنجليزي أحياناً (Manal) — نطابق بالكرت لا بالنص.
  const canEdit = (member: string) => isManager || memberOf(myFirstName) === member;
  const fromDay = [weekStart(date), prevDay(date)].sort()[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, rows, k] = await Promise.all([
        getEditableContent<KpiTargets>(KPI_TARGETS_KEY),
        // من بداية الأسبوع أو أمس (أيهما أسبق) — نحتاج أمس لتقييم التزاماته.
        getEditableContentRange<Entry>(`${KEY_PREFIX}:${fromDay}`, `${KEY_PREFIX}:${date}:￿`),
        fetchHuddleKpis(date, fromDay),
      ]);
      if (t) setTargets(t);
      setKpis(k);
      setWeek(rows);
      const today: Record<string, Entry> = {};
      for (const r of rows) {
        const member = keyMember(r.key);
        if (keyDate(r.key) === date && TEAM.includes(member)) today[member] = r.value;
      }
      setEntries(today);
    } catch (e) {
      console.error(e);
      setError("تعذّر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [date, fromDay]);

  useEffect(() => {
    load();
  }, [load, activeOrgId]);

  function update(member: string, patch: Partial<Entry>) {
    setEntries((prev) => ({ ...prev, [member]: { ...prev[member], ...patch } }));
  }

  // نقرأ آخر نسخة قبل الحفظ حتى لا يمسح المدير والموظف تعديل بعض.
  async function save(member: string, patch?: Partial<Entry>, forDate = date) {
    setSaving(member);
    setError(null);
    try {
      const key = entryKey(forDate, member);
      const latest = (await getEditableContent<Entry>(key)) ?? {};
      const own: Entry = { commitments: entries[member]?.commitments?.filter((c) => c.text.trim()), blocker: entries[member]?.blocker };
      const entry: Entry = {
        ...latest,
        ...(patch ?? own),
        updated_by: user?.name,
        updated_at: new Date().toISOString(),
      };
      await saveEditableContent(key, entry);
      if (forDate === date) setEntries((prev) => ({ ...prev, [member]: entry }));
      setWeek((prev) => [...prev.filter((r) => r.key !== key), { key, value: entry }]);
      setSaved(member);
      setTimeout(() => setSaved((s) => (s === member ? null : s)), 2000);
    } catch (e) {
      console.error(e);
      setError(`تعذّر حفظ بيانات ${member}`);
    } finally {
      setSaving(null);
    }
  }

  async function saveTargets() {
    try {
      await saveEditableContent(KPI_TARGETS_KEY, targets);
      setEditingTargets(false);
    } catch (e) {
      console.error(e);
      setError("تعذّر حفظ الأهداف");
    }
  }

  const tgt = (member: string, k: KpiKey) => targetOf(targets, member, k);
  const mk = (member: string) => kpis?.members[member];

  // ── ملخص الفريق ──
  const teamFollowups = TEAM.reduce((s, n) => s + (mk(n)?.values.followups ?? 0), 0);
  const teamFollowupsGoal = TEAM.reduce((s, n) => s + tgt(n, "followups"), 0);
  const followupsHit = TEAM.filter((n) => (mk(n)?.values.followups ?? 0) >= tgt(n, "followups")).length;
  // الإغلاقات تنحسب لصاحب الصفقة فقط (المساعدة لا تتكرر)
  const teamCloses = TEAM.reduce((s, n) => s + (mk(n)?.values.closes ?? 0), 0);
  const teamClosesGoal = TEAM.reduce((s, n) => s + tgt(n, "closes"), 0);
  const teamRevenue = TEAM.reduce((s, n) => s + (mk(n)?.values.closesValue ?? 0) + (mk(n)?.values.renewalsValue ?? 0), 0);
  const teamRevenueGoal = TEAM.reduce((s, n) => s + tgt(n, "closesValue") + tgt(n, "renewalsValue"), 0);
  const teamAlerts = TEAM.reduce((s, n) => s + (mk(n)?.values.staleDeals ?? 0) + (mk(n)?.values.overdueRenewals ?? 0) + (mk(n)?.values.openTickets ?? 0), 0);
  const winning = followupsHit === TEAM.length;

  const yesterday = prevDay(date);
  const yesterdayEntry = (member: string) => week.find((r) => keyDate(r.key) === yesterday && keyMember(r.key) === member)?.value;

  function setCommitmentText(member: string, i: number, text: string) {
    const list = [...(entries[member]?.commitments ?? [])];
    while (list.length < 3) list.push({ text: "" });
    list[i] = { ...list[i], text };
    update(member, { commitments: list });
  }

  function markCommitment(member: string, i: number, done: boolean) {
    const list = [...(yesterdayEntry(member)?.commitments ?? [])];
    list[i] = { ...list[i], done: list[i].done === done ? undefined : done };
    save(member, { commitments: list }, yesterday);
  }

  // ── لوحة الأسبوع ──
  const ws = weekStart(date);
  const weekDays: string[] = [];
  for (let d = ws; d <= date; d = addDays(d, 1)) weekDays.push(d);
  const weekRows = TEAM.map((member) => {
    const days = week.filter((r) => keyMember(r.key) === member && keyDate(r.key) >= ws).map((r) => r.value);
    const evaluated = days.flatMap((d) => d.commitments ?? []).filter((c) => c.done !== undefined);
    const byDay = mk(member)?.followupsByDay ?? {};
    // الجمعة إجازة — ما تنحسب في أيام الأسبوع إلا لو فيها متابعات
    const workDays = weekDays.filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 5 || (byDay[d] ?? 0) > 0);
    return {
      member,
      commitRate: evaluated.length ? Math.round((evaluated.filter((c) => c.done).length / evaluated.length) * 100) : null,
      commitDone: evaluated.filter((c) => c.done).length,
      commitTotal: evaluated.length,
      hitDays: workDays.filter((d) => (byDay[d] ?? 0) >= tgt(member, "followups")).length,
      workDays: workDays.length,
      followups: weekDays.reduce((s, d) => s + (byDay[d] ?? 0), 0),
      closes: (mk(member)?.values.closes ?? 0) + (mk(member)?.values.assists ?? 0) + (mk(member)?.values.renewalsPaid ?? 0),
    };
  }).sort((a, b) => b.hitDays - a.hitDays || b.followups - a.followups);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
            <CalendarClock className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">الفريق اليوم — قائمة الطلبات</h2>
            <p className="text-xs text-muted-foreground">الأرقام تُقرأ تلقائياً من اللوحة — ما تحتاج تكتب أي رقم</p>
          </div>
        </div>
        <input
          type="date"
          value={date}
          max={todayLocal()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="px-3 py-2 rounded-[14px] bg-white/[0.04] border border-white/[0.08] text-sm text-foreground"
        />
      </div>

      {/* Rhythm */}
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          { time: "12:40 ظهراً", text: "الاجتماع اليومي — 10 دقائق" },
          { time: "طول اليوم", text: "كل تواصل مع عميل = ملاحظة في «سجل المتابعة» داخل الصفقة أو التجديد أو التذكرة" },
          { time: "السبت 1:30 ظهراً", text: "اجتماع الأسبوع: هل التزمنا؟ وما التزامنا القادم؟" },
        ].map((r) => (
          <div key={r.time} className="cc-card rounded-[14px] p-3 border border-white/[0.06]">
            <div className="text-xs font-bold text-violet-400">{r.time}</div>
            <div className="text-[13px] text-muted-foreground mt-0.5">{r.text}</div>
          </div>
        ))}
      </div>

      {error && <div className="rounded-[14px] p-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* Team summary */}
      <div className={`cc-card rounded-2xl p-4 border ${winning ? "border-emerald-500/25" : "border-amber-500/25"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-foreground">الفريق اليوم</span>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${winning ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
            {winning ? "الكل حقق هدف المتابعة اليوم 🎯" : `${followupsHit} من ${TEAM.length} حققوا هدف المتابعة`}
          </span>
          {isManager && (
            <button onClick={() => setEditingTargets((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Settings2 className="w-3.5 h-3.5" /> أهداف الفريق
            </button>
          )}
        </div>

        {editingTargets && (
          <div className="mt-3 space-y-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
            <p className="text-[11px] text-muted-foreground">المتابعات هدف يومي · الإغلاقات والمبالغ والتجديدات هدف شهري · المؤشرات الحمراء (تذاكر مفتوحة، بلا متابعة) الهدف أقصى عدد مقبول.</p>
            {TEAM.map((member) => (
              <div key={member}>
                <div className="text-xs font-bold text-foreground mb-1">{member}</div>
                <div className="flex flex-wrap gap-2">
                  {MEMBER_ROLES[member].kpis.map((k) => (
                    <label key={k} className="text-[11px] text-muted-foreground">
                      {KPI_DEFS[k].label}
                      <input
                        type="number"
                        min={0}
                        value={tgt(member, k)}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          setTargets((t) => ({ ...t, [member]: { ...DEFAULT_KPI_TARGETS[member], ...t[member], [k]: v } }));
                        }}
                        className="block w-24 mt-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-foreground"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <Button size="sm" onClick={saveTargets}>حفظ الأهداف</Button>
          </div>
        )}

        {kpis && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {[
              { label: "متابعات اليوم", value: String(teamFollowups), goal: String(teamFollowupsGoal), p: teamFollowupsGoal ? (teamFollowups / teamFollowupsGoal) * 100 : 100 },
              { label: "إغلاقات الشهر", value: String(teamCloses), goal: String(teamClosesGoal), p: teamClosesGoal ? (teamCloses / teamClosesGoal) * 100 : 100 },
              { label: "مبيعات + تجديدات الشهر", value: formatMoneyFull(teamRevenue), goal: formatMoneyFull(teamRevenueGoal), p: teamRevenueGoal ? (teamRevenue / teamRevenueGoal) * 100 : 100 },
            ].map((x) => (
              <div key={x.label}>
                <div className="flex justify-between gap-1 text-xs text-muted-foreground">
                  <span>{x.label}</span>
                  <span className="text-foreground font-bold">{x.value}<span className="text-muted-foreground font-normal">/{x.goal}</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] mt-1 overflow-hidden">
                  <div className={`h-full ${x.p >= 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, x.p)}%` }} />
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground">
              تحتاج انتباه الآن
              <div className={`text-lg font-bold ${teamAlerts ? "text-red-400" : "text-emerald-400"}`}>{teamAlerts}</div>
            </div>
          </div>
        )}
      </div>

      {/* Member cards */}
      {loading || !kpis ? (
        <div className="grid gap-3 md:grid-cols-2">
          {TEAM.map((n) => <Skeleton key={n} className="h-64 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {TEAM.map((member) => {
            const e = entries[member] ?? {};
            const editable = canEdit(member);
            const k = kpis.members[member];
            const role = MEMBER_ROLES[member];
            const metGoal = k.values.followups >= tgt(member, "followups");
            const y = yesterdayEntry(member);
            const yCommitments = y?.commitments ?? [];
            const yFollowups = k.followupsByDay[yesterday] ?? 0;
            const closedYesterday = kpis.closedDeals.filter((d) => d.day === yesterday && d.owner === member);
            const helpedYesterday = kpis.closedDeals.filter((d) => d.day === yesterday && d.helpers.includes(member));
            const commitments = [...(e.commitments ?? [])];
            while (commitments.length < 3) commitments.push({ text: "" });
            const helpedBy = Object.entries(k.helpedBy);
            return (
              <div key={member} className={`cc-card rounded-2xl p-4 border ${metGoal ? "border-emerald-500/25" : "border-white/[0.06]"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center text-sm font-bold">
                    {member[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground">{member}</span>
                      {metGoal && <Trophy className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{role.title}</div>
                  </div>
                </div>

                {/* المؤشرات التلقائية */}
                <div className="space-y-2.5 mt-3">
                  {role.kpis.map((key) => (
                    <KpiRow key={key} k={key} value={k.values[key]} target={tgt(member, key)} kpis={kpis} />
                  ))}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {k.closesToday > 0 && <span className="text-emerald-400">إغلاقات اليوم: {k.closesToday}</span>}
                    {role.kpis.includes("openTickets") && <span>تذاكر حُلّت اليوم: {k.resolvedToday}</span>}
                    {helpedBy.length > 0 && (
                      <span className="text-cyan-400">تحويل ناجح: {helpedBy.map(([h, c]) => `${c} بمساعدة ${h}`).join("، ")}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3 mt-3">
                  {/* أمس: أرقام تلقائية + تقييم التزامات أمس */}
                  <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                    <div className="text-xs text-muted-foreground">
                      أمس: <span className={`font-medium ${yFollowups >= tgt(member, "followups") ? "text-emerald-400" : "text-foreground"}`}>{yFollowups} متابعة</span>
                      <span className="opacity-60"> / {tgt(member, "followups")}</span>
                    </div>
                    {closedYesterday.length > 0 && (
                      <div className="text-xs text-emerald-400 mt-1">
                        صفقات منجزة أمس: <span className="font-bold">{closedYesterday.length}</span> · {formatMoneyFull(closedYesterday.reduce((s, d) => s + d.deal_value, 0))}
                        <span className="text-muted-foreground"> — {closedYesterday.map((d) => d.client_name + (d.helpers.length ? ` (بمساعدة ${d.helpers.join("، ")})` : "")).join("، ")}</span>
                      </div>
                    )}
                    {helpedYesterday.length > 0 && (
                      <div className="text-xs text-cyan-400 mt-1">
                        ساعدت في إغلاق أمس: {helpedYesterday.map((d) => `${d.client_name}${d.owner ? ` (${d.owner})` : ""}`).join("، ")}
                      </div>
                    )}
                    {yCommitments.length > 0 && (
                      <div className="space-y-1 mt-2">
                        <div className="text-[11px] text-muted-foreground">التزامات أمس — هل نُفّذت؟</div>
                        {yCommitments.map((c, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className={`text-sm ${c.done === true ? "text-emerald-400" : c.done === false ? "text-red-400 line-through" : "text-foreground"}`}>
                              {c.text}
                            </span>
                            <div className="flex gap-1 shrink-0">
                              {([true, false] as const).map((d) => (
                                <button
                                  key={String(d)}
                                  disabled={!editable || saving === member}
                                  onClick={() => markCommitment(member, i, d)}
                                  className={`w-7 h-6 rounded-md text-xs transition-all ${
                                    c.done === d ? (d ? "bg-emerald-500/20 ring-1 ring-emerald-500/40" : "bg-red-500/20 ring-1 ring-red-500/40") : "bg-white/[0.04] opacity-60"
                                  } ${editable ? "hover:opacity-100" : "cursor-default"}`}
                                >
                                  {d ? "✅" : "❌"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    أهم 3 أشياء اليوم
                    <div className="space-y-1.5 mt-1">
                      {commitments.slice(0, 3).map((c, i) => (
                        <input
                          key={i}
                          value={c.text}
                          readOnly={!editable}
                          placeholder={editable ? `${i + 1}. مثال: إغلاق عميل / متابعة 5 عروض` : ""}
                          onChange={(ev) => setCommitmentText(member, i, ev.target.value)}
                          className="block w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-foreground"
                        />
                      ))}
                    </div>
                  </div>

                  <label className="block text-xs text-muted-foreground">
                    عائق تحتاج فيه مساعدة (اختياري)
                    <input
                      value={e.blocker ?? ""}
                      readOnly={!editable}
                      onChange={(ev) => update(member, { blocker: ev.target.value })}
                      className={`block w-full mt-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border text-sm text-foreground ${
                        e.blocker?.trim() ? "border-red-500/40 text-red-300" : "border-white/[0.08]"
                      }`}
                    />
                  </label>
                </div>

                {editable && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] text-muted-foreground">
                      {e.updated_at ? `آخر تحديث: ${new Date(e.updated_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </span>
                    <Button size="sm" className="gap-1.5" disabled={saving === member} onClick={() => save(member)}>
                      {saved === member ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                      {saved === member ? "تم الحفظ" : "حفظ"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly scoreboard */}
      <div className="cc-card rounded-2xl p-4 border border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-foreground">لوحة الأسبوع (من الأحد حتى {date})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-white/[0.06]">
                <th className="text-right py-2 font-medium">#</th>
                <th className="text-right py-2 font-medium">الموظف</th>
                <th className="text-center py-2 font-medium">أيام تحقيق المتابعة</th>
                <th className="text-center py-2 font-medium">متابعات الأسبوع</th>
                <th className="text-center py-2 font-medium">الالتزام</th>
                <th className="text-center py-2 font-medium">إنجازات الشهر</th>
              </tr>
            </thead>
            <tbody>
              {weekRows.map((r, i) => (
                <tr key={r.member} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-bold text-foreground">{r.member}</td>
                  <td className={`py-2 text-center font-bold ${r.workDays ? rateColor((r.hitDays / r.workDays) * 100) : "text-muted-foreground"}`}>
                    {r.hitDays}/{r.workDays}
                  </td>
                  <td className="py-2 text-center">{r.followups}</td>
                  <td className={`py-2 text-center font-bold ${r.commitRate !== null ? rateColor(r.commitRate) : "text-muted-foreground"}`}>
                    {r.commitRate !== null ? <span title={`${r.commitDone} من ${r.commitTotal}`}>{r.commitRate}%</span> : "—"}
                  </td>
                  <td className="py-2 text-center">{r.closes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">أيام تحقيق المتابعة: الأيام اللي وصل فيها الموظف لهدف المتابعات (الجمعة مستثناة). إنجازات الشهر: إغلاقات + مساعدات + تجديدات محصّلة. الالتزام: نسبة «أهم 3 أشياء» المنفّذة فعلاً.</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   الصفحة: تبويبات المتابعة اليومية
   تجمع الاجتماع اليومي مع أقسام منقولة من «السكرتير التنفيذي» و«التحديثات الأخيرة».
═══════════════════════════════════════════════════════════════ */
const TABS = [
  { key: "team", label: "الفريق اليوم", icon: Users },
  { key: "quality", label: "جودة الاستهداف", icon: Star },
  { key: "compass", label: "بوصلة اليوم", icon: Compass },
  { key: "confirmations", label: "تأكيدات المبيعات", icon: BadgeCheck },
  { key: "verify", label: "طلبات التحقق", icon: ClipboardCheck },
  { key: "health", label: "صحة الأقسام", icon: HeartPulse },
  { key: "activity", label: "نشاط الفريق", icon: Activity },
  { key: "challenges", label: "التحديات والطلبات والتطويرات", icon: ShieldQuestion },
  { key: "ideas", label: "البذور", icon: Sprout },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const MANAL_ONLY_TABS: TabKey[] = ["compass", "confirmations", "health", "activity", "challenges", "ideas"];

export default function DailyHuddlePage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
      <DailyHuddleTabs />
    </Suspense>
  );
}

function DailyHuddleTabs() {
  // ?tab=verify — رابط مباشر لتبويب (مثلاً من رسالة واتساب لطلب تحقق)
  const searchParams = useSearchParams();
  const { user, isImpersonating } = useAuth();
  // «البذور» و«بوصلة اليوم» و«تأكيدات المبيعات» و«صحة الأقسام» و«نشاط الفريق» و«التحديات والطلبات والتطويرات» للمدير ومنال فقط
  const tabs = TABS.filter((t) => !MANAL_ONLY_TABS.includes(t.key) || canUseIdeas(user));
  const initialTab = tabs.find((t) => t.key === searchParams.get("tab"))?.key ?? "team";
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [verifyPending, setVerifyPending] = useState(0);
  const huddleManagers = useHuddleManagers();
  const { isManager } = huddleManagers;

  // عدّاد على تبويب «طلبات التحقق»: للموظف = طلبات تنتظر رده، للمدير = ردود تنتظر المطابقة
  useEffect(() => {
    fetch("/api/verifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.me) return;
        const list = (d.requests ?? []) as { status: string; assignee_id: string }[];
        // «الدخول كموظف»: نحسب على الموظف المعروض لا على جلسة الأدمن
        const me = isImpersonating && user ? { id: user.id, isManager } : d.me;
        setVerifyPending(me.isManager
          ? list.filter((x) => x.status === "answered").length
          : list.filter((x) => x.status === "pending" && x.assignee_id === me.id).length);
      })
      .catch(() => undefined);
  }, [isImpersonating, user, isManager]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">المتابعة اليومية</h1>
          <p className="text-xs text-muted-foreground">الفريق · جودة الاستهداف · طلبات التحقق{canUseIdeas(user) ? " · تأكيدات المبيعات · بوصلة اليوم · صحة الأقسام · نشاط الفريق · التحديات والطلبات" : ""}</p>
        </div>
        {huddleManagers.isOwner && (
          <div className="mr-auto">
            <HuddleManagersButton managers={huddleManagers.managers} onSave={huddleManagers.save} />
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 shrink-0 rounded-[14px] px-4 py-2.5 text-sm font-bold transition-all border ${
              tab === key
                ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                : "bg-white/[0.03] text-muted-foreground hover:text-foreground border-white/[0.06]"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === "verify" && verifyPending > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">{verifyPending}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "team" && <TeamTodayTab isManager={isManager} />}
      {tab === "quality" && <TargetingQualityTab isManager={isManager} />}
      {tab === "compass" && canUseIdeas(user) && <SecretaryView embedded sections={["compass", "yesterday", "priorities", "tasks", "quickTasks"]} />}
      {tab === "confirmations" && canUseIdeas(user) && <SalesConfirmations canConfirm={isManager} />}
      {tab === "verify" && <VerificationsBoard onPendingChange={setVerifyPending} />}
      {tab === "health" && canUseIdeas(user) && <SecretaryView embedded sections={["hotCold", "supportHealth", "renewalHealth"]} />}
      {tab === "activity" && canUseIdeas(user) && <RecentUpdatesView embedded tabs={["updates", "log"]} />}
      {tab === "challenges" && canUseIdeas(user) && <ChallengesTab />}
      {tab === "ideas" && canUseIdeas(user) && <IdeasGarden />}
    </div>
  );
}

/** تبويب «التحديات والطلبات والتطويرات»: الطلبات والتطويرات + الاجتماعات + الإنجازات + التحديات (كل واحد في قسم). */
function ChallengesTab() {
  const [view, setView] = useState<"tickets" | "meetings" | "achievements" | "challenges">("tickets");
  return (
    <div className="space-y-4">
      <div className="flex gap-0.5 rounded-xl bg-white/[0.04] border border-white/[0.06] p-1 w-fit max-w-full overflow-x-auto">
        {([["tickets", "الطلبات والتطويرات"], ["meetings", "الاجتماعات"], ["achievements", "الإنجازات"], ["challenges", "التحديات"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`px-4 py-1.5 rounded-lg text-[13px] font-bold whitespace-nowrap transition-colors ${view === k ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:text-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {view === "tickets" && <WorkTicketsBoard embedded />}
      {view === "meetings" && <MeetingsBoard embedded />}
      {view === "achievements" && <AchievementsBoard embedded />}
      {view === "challenges" && <ChallengesHub />}
    </div>
  );
}
