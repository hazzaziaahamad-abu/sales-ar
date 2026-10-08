"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  getEditableContent, saveEditableContent, getEditableContentRange, fetchClosedDealsOn,
} from "@/lib/supabase/db";
import { todayLocal, formatMoneyFull } from "@/lib/utils/format";
import type { Deal } from "@/types";
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
import { TEAM, KEY_PREFIX, weekStart, type QualityScores } from "@/components/daily-huddle/huddle-shared";
import { HuddleManagersButton } from "@/components/daily-huddle/huddle-managers-button";
import { useHuddleManagers } from "@/lib/huddle-managers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Users, Trophy, Save, Check, Settings2, Compass, HeartPulse, Activity, BadgeCheck, ShieldQuestion, Star, ClipboardCheck, Sprout } from "lucide-react";

// النموذج: اجتماع يومي قصير (Daily Huddle) + لوحة نتائج بمقاييس الأفعال (4DX).
const TARGETS_KEY = `${KEY_PREFIX}_targets`;

type Attendance = "present" | "late" | "absent";

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
  calls?: number;
  offers?: number;
  closes?: number;
  /** تقييمات يومية قديمة — صار التقييم أسبوعياً في تبويب «جودة الاستهداف». */
  quality?: QualityScores;
  updated_by?: string;
  updated_at?: string;
}

interface Targets {
  calls: number;
  offers: number;
  closes: number;
}

const DEFAULT_TARGETS: Targets = { calls: 30, offers: 5, closes: 1 };

const METRICS = [
  { key: "calls", label: "مكالمات" },
  { key: "offers", label: "عروض" },
  { key: "closes", label: "إغلاقات" },
] as const;

const entryKey = (date: string, member: string) => `${KEY_PREFIX}:${date}:${member}`;

function prevDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const keyDate = (key: string) => key.split(":")[1];
const keyMember = (key: string) => key.split(":")[2];
/** هل الصفقة تخص هذا الموظف؟ (مطابقة بالاسم الأول) */
const isRepOf = (d: Deal, member: string) => (d.assigned_rep_name ?? "").trim().split(/\s+/)[0] === member;

const rateColor = (v: number) => (v >= 80 ? "text-emerald-400" : v >= 50 ? "text-amber-400" : "text-red-400");

function pct(value: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

function TeamTodayTab({ isManager }: { isManager: boolean }) {
  const { user, activeOrgId } = useAuth();
  const myFirstName = user?.name?.trim().split(/\s+/)[0] ?? "";

  const [date, setDate] = useState(todayLocal());
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [week, setWeek] = useState<{ key: string; value: Entry }[]>([]);
  const [closedYesterday, setClosedYesterday] = useState<Deal[]>([]);
  const [targets, setTargets] = useState<Targets>(DEFAULT_TARGETS);
  const [editingTargets, setEditingTargets] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = (member: string) => isManager || myFirstName === member;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, rows, closed] = await Promise.all([
        getEditableContent<Targets>(TARGETS_KEY),
        // من بداية الأسبوع أو أمس (أيهما أسبق) — نحتاج أمس لعرض أرقامه وتقييم التزاماته.
        getEditableContentRange<Entry>(`${KEY_PREFIX}:${[weekStart(date), prevDay(date)].sort()[0]}`, `${KEY_PREFIX}:${date}:￿`),
        // الصفقات المنجزة في اليوم السابق — لا نُفشل الصفحة إن تعذّر جلبها.
        fetchClosedDealsOn(prevDay(date)).catch((e) => { console.error(e); return [] as Deal[]; }),
      ]);
      setClosedYesterday(closed);
      if (t) setTargets({ ...DEFAULT_TARGETS, ...t });
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
  }, [date]);

  useEffect(() => {
    load();
  }, [load, activeOrgId]);

  function update(member: string, patch: Partial<Entry>) {
    setEntries((prev) => ({ ...prev, [member]: { ...prev[member], ...patch } }));
  }

  // الحضور والجودة (قديمة) يسجّلهما المدير والباقي يسجّله الموظف — نقرأ آخر نسخة قبل الحفظ حتى لا يمسح أحدهما تعديل الآخر.
  async function save(member: string, patch?: Partial<Entry>, forDate = date) {
    setSaving(member);
    setError(null);
    try {
      const key = entryKey(forDate, member);
      const latest = (await getEditableContent<Entry>(key)) ?? {};
      const own: Entry = { ...entries[member] };
      delete own.attendance;
      delete own.quality;
      own.commitments = own.commitments?.filter((c) => c.text.trim());
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
      await saveEditableContent(TARGETS_KEY, targets);
      setEditingTargets(false);
    } catch (e) {
      console.error(e);
      setError("تعذّر حفظ الأهداف");
    }
  }

  // ── ملخص اليوم ──
  const teamTotals = METRICS.reduce(
    (acc, m) => ({ ...acc, [m.key]: TEAM.reduce((s, n) => s + (entries[n]?.[m.key] ?? 0), 0) }),
    {} as Record<(typeof METRICS)[number]["key"], number>
  );
  const winning = METRICS.every((m) => teamTotals[m.key] >= targets[m.key] * TEAM.length);

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
  const weekRows = TEAM.map((member) => {
    const days = week.filter((r) => keyMember(r.key) === member && keyDate(r.key) >= ws).map((r) => r.value);
    const evaluated = days.flatMap((d) => d.commitments ?? []).filter((c) => c.done !== undefined);
    const sum = (k: (typeof METRICS)[number]["key"]) => days.reduce((s, d) => s + (d[k] ?? 0), 0);
    const reported = days.filter((d) => METRICS.some((m) => (d[m.key] ?? 0) > 0)).length;
    return {
      commitRate: evaluated.length ? Math.round((evaluated.filter((c) => c.done).length / evaluated.length) * 100) : null,
      commitDone: evaluated.filter((c) => c.done).length,
      commitTotal: evaluated.length,
      member,
      reported,
      calls: sum("calls"),
      offers: sum("offers"),
      closes: sum("closes"),
    };
  }).sort((a, b) => b.closes - a.closes || b.offers - a.offers || b.calls - a.calls);

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
            <p className="text-xs text-muted-foreground">اجتماع يومي قصير + لوحة نتائج (تجربة أولية)</p>
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
          { time: "9:45 مساءً", text: "كل موظف يحدّث أرقامه هنا قبل نهاية الدوام" },
          { time: "السبت 1:30 ظهراً", text: "اجتماع الأسبوع: هل التزمنا؟ وما التزامنا القادم؟" },
        ].map((r) => (
          <div key={r.time} className="cc-card rounded-[14px] p-3 border border-white/[0.06]">
            <div className="text-xs font-bold text-violet-400">{r.time}</div>
            <div className="text-[13px] text-muted-foreground mt-0.5">{r.text}</div>
          </div>
        ))}
      </div>

      {error && <div className="rounded-[14px] p-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* Today summary */}
      <div className={`cc-card rounded-2xl p-4 border ${winning ? "border-emerald-500/25" : "border-amber-500/25"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold text-foreground">الفريق اليوم</span>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${winning ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
            {winning ? "الفريق محقق هدف اليوم 🎯" : "الفريق لم يحقق هدف اليوم بعد"}
          </span>
          {isManager && (
            <button onClick={() => setEditingTargets((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Settings2 className="w-3.5 h-3.5" /> الهدف اليومي للفرد
            </button>
          )}
        </div>

        {editingTargets && (
          <div className="flex flex-wrap items-end gap-3 mt-3">
            {METRICS.map((m) => (
              <label key={m.key} className="text-xs text-muted-foreground">
                {m.label}
                <input
                  type="number"
                  min={0}
                  value={targets[m.key]}
                  onChange={(e) => setTargets((t) => ({ ...t, [m.key]: Math.max(0, Number(e.target.value) || 0) }))}
                  className="block w-20 mt-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-foreground"
                />
              </label>
            ))}
            <Button size="sm" onClick={saveTargets}>حفظ الهدف</Button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-3">
          {METRICS.map((m) => {
            const goal = targets[m.key] * TEAM.length;
            const p = pct(teamTotals[m.key], goal);
            return (
              <div key={m.key}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{m.label}</span>
                  <span className="text-foreground font-bold">{teamTotals[m.key]}/{goal}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] mt-1 overflow-hidden">
                  <div className={`h-full ${p >= 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member cards */}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {TEAM.map((n) => <Skeleton key={n} className="h-64 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {TEAM.map((member) => {
            const e = entries[member] ?? {};
            const editable = canEdit(member);
            const metGoal = METRICS.every((m) => (e[m.key] ?? 0) >= targets[m.key]);
            return (
              <div key={member} className={`cc-card rounded-2xl p-4 border ${metGoal ? "border-emerald-500/25" : "border-white/[0.06]"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center text-sm font-bold">
                      {member[0]}
                    </div>
                    <span className="font-bold text-foreground">{member}</span>
                    {metGoal && <Trophy className="w-4 h-4 text-emerald-400" />}
                  </div>
                </div>

                {(() => {
                  const y = yesterdayEntry(member);
                  const yCommitments = y?.commitments ?? [];
                  const commitments = [...(e.commitments ?? [])];
                  while (commitments.length < 3) commitments.push({ text: "" });
                  return (
                    <div className="space-y-3 mt-3">
                      {/* أمس: أرقام تلقائية + تقييم التزامات أمس */}
                      <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                        <div className="text-xs text-muted-foreground">
                          أمس:{" "}
                          {y && METRICS.some((m) => (y[m.key] ?? 0) > 0) ? (
                            <span className="text-foreground font-medium">
                              {METRICS.map((m) => `${y[m.key] ?? 0} ${m.label}`).join(" · ")}
                            </span>
                          ) : (
                            <span>لا توجد أرقام مسجّلة</span>
                          )}
                        </div>
                        {(() => {
                          const mine = closedYesterday.filter((d) => isRepOf(d, member));
                          if (mine.length === 0) return null;
                          return (
                            <div className="text-xs text-emerald-400 mt-1">
                              صفقات منجزة أمس: <span className="font-bold">{mine.length}</span> · {formatMoneyFull(mine.reduce((s, d) => s + (d.deal_value || 0), 0))}
                              <span className="text-muted-foreground"> — {mine.map((d) => d.client_name).join("، ")}</span>
                            </div>
                          );
                        })()}
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
                  );
                })()}

                <div className="grid grid-cols-3 gap-2 mt-3">
                  {METRICS.map((m) => {
                    const v = e[m.key] ?? 0;
                    const ok = v >= targets[m.key];
                    return (
                      <label key={m.key} className="text-xs text-muted-foreground">
                        {m.label} <span className="opacity-60">/ {targets[m.key]}</span>
                        <input
                          type="number"
                          min={0}
                          value={e[m.key] ?? ""}
                          readOnly={!editable}
                          onChange={(ev) => update(member, { [m.key]: Math.max(0, Number(ev.target.value) || 0) })}
                          className={`block w-full mt-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border text-sm font-bold ${
                            ok ? "border-emerald-500/30 text-emerald-400" : "border-white/[0.08] text-foreground"
                          }`}
                        />
                      </label>
                    );
                  })}
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
                <th className="text-center py-2 font-medium">أيام التحديث</th>
                <th className="text-center py-2 font-medium">الالتزام</th>
                {METRICS.map((m) => <th key={m.key} className="text-center py-2 font-medium">{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {weekRows.map((r, i) => (
                <tr key={r.member} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-bold text-foreground">{r.member}</td>
                  <td className="py-2 text-center">{r.reported}</td>
                  <td className={`py-2 text-center font-bold ${r.commitRate !== null ? rateColor(r.commitRate) : "text-muted-foreground"}`}>
                    {r.commitRate !== null ? <span title={`${r.commitDone} من ${r.commitTotal}`}>{r.commitRate}%</span> : "—"}
                  </td>
                  {METRICS.map((m) => {
                    const ok = r.reported > 0 && r[m.key] >= targets[m.key] * r.reported;
                    return (
                      <td key={m.key} className={`py-2 text-center font-bold ${r.reported ? (ok ? "text-emerald-400" : "text-red-400") : "text-muted-foreground"}`}>
                        {r[m.key]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">الأخضر: المعدّل اليومي يحقق الهدف في الأيام التي حُدّثت فيها الأرقام. الالتزام: نسبة «أهم 3 أشياء» المنفّذة فعلاً.</p>
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
  // «البذور» و«التحديات والطلبات والتطويرات» للمدير ومنال فقط
  const tabs = TABS.filter((t) => (t.key !== "ideas" && t.key !== "challenges") || canUseIdeas(user));
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
          <p className="text-xs text-muted-foreground">الفريق · جودة الاستهداف · بوصلة اليوم · تأكيدات المبيعات · طلبات التحقق · صحة الأقسام · نشاط الفريق{canUseIdeas(user) ? " · التحديات والطلبات" : ""}</p>
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
      {tab === "compass" && <SecretaryView embedded sections={["compass", "yesterday", "priorities", "tasks", "quickTasks"]} />}
      {tab === "confirmations" && <SalesConfirmations canConfirm={isManager} />}
      {tab === "verify" && <VerificationsBoard onPendingChange={setVerifyPending} />}
      {tab === "health" && <SecretaryView embedded sections={["hotCold", "supportHealth", "renewalHealth"]} />}
      {tab === "activity" && <RecentUpdatesView embedded tabs={["updates", "log"]} />}
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
