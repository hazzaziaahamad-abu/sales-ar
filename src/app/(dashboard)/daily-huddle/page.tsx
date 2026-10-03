"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { getEditableContent, saveEditableContent, getEditableContentRange } from "@/lib/supabase/db";
import { todayLocal } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Users, Trophy, Save, Check, Settings2 } from "lucide-react";

// تجربة أولية: فريق «قائمة الطلبات» فقط.
// النموذج: اجتماع يومي قصير (Daily Huddle) + لوحة نتائج بمقاييس الأفعال (4DX).
const TEAM = ["علي", "مريم", "تغريد", "منال", "عواطف"];
const KEY_PREFIX = "huddle_menu";
const TARGETS_KEY = `${KEY_PREFIX}_targets`;

type Attendance = "present" | "late" | "absent";

interface Entry {
  attendance?: Attendance;
  yesterday?: string;
  today?: string;
  blocker?: string;
  calls?: number;
  offers?: number;
  closes?: number;
  quality?: Partial<Record<QualityKey, number>>;
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

// جودة الاستهداف — يقيّمها المدير من 1 إلى 5 بعد الاستماع لمكالمة للموظف.
const QUALITY = [
  { key: "clarity", label: "وضوح العرض" },
  { key: "response", label: "الرد المثالي" },
  { key: "technique", label: "تطبيق أساليب المبيعات" },
  { key: "knowledge", label: "الإلمام" },
] as const;
type QualityKey = (typeof QUALITY)[number]["key"];

/** متوسط التقييمات المُدخلة (من 5)، أو null إن لم يُقيَّم شيء. */
function qualityAvg(q?: Entry["quality"]): number | null {
  const vals = QUALITY.map((c) => q?.[c.key]).filter((v): v is number => !!v);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

const qualityColor = (v: number) => (v >= 4 ? "text-emerald-400" : v >= 3 ? "text-amber-400" : "text-red-400");

const ATTENDANCE: { key: Attendance; label: string; cls: string }[] = [
  { key: "present", label: "حاضر", cls: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30" },
  { key: "late", label: "متأخر", cls: "bg-amber-500/15 text-amber-400 ring-amber-500/30" },
  { key: "absent", label: "غائب", cls: "bg-red-500/15 text-red-400 ring-red-500/30" },
];

const entryKey = (date: string, member: string) => `${KEY_PREFIX}:${date}:${member}`;

/** أول يوم (الأحد) من أسبوع التاريخ المعطى. */
function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function pct(value: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}

export default function DailyHuddlePage() {
  const { user, activeOrgId } = useAuth();
  const isManager = user?.isSuperAdmin ?? false;
  const myFirstName = user?.name?.trim().split(/\s+/)[0] ?? "";

  const [date, setDate] = useState(todayLocal());
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [week, setWeek] = useState<{ key: string; value: Entry }[]>([]);
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
      const [t, rows] = await Promise.all([
        getEditableContent<Targets>(TARGETS_KEY),
        getEditableContentRange<Entry>(`${KEY_PREFIX}:${weekStart(date)}`, `${KEY_PREFIX}:${date}:￿`),
      ]);
      if (t) setTargets({ ...DEFAULT_TARGETS, ...t });
      setWeek(rows);
      const today: Record<string, Entry> = {};
      for (const r of rows) {
        const member = r.key.split(":")[2];
        if (r.key.startsWith(`${KEY_PREFIX}:${date}:`) && TEAM.includes(member)) today[member] = r.value;
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

  // الحضور والجودة يسجّلهما المدير والباقي يسجّله الموظف — نقرأ آخر نسخة قبل الحفظ حتى لا يمسح أحدهما تعديل الآخر.
  async function save(member: string, patch?: Partial<Entry>) {
    setSaving(member);
    setError(null);
    try {
      const latest = (await getEditableContent<Entry>(entryKey(date, member))) ?? {};
      const own: Entry = { ...entries[member] };
      delete own.attendance;
      delete own.quality;
      const entry: Entry = {
        ...latest,
        ...(patch ?? own),
        updated_by: user?.name,
        updated_at: new Date().toISOString(),
      };
      await saveEditableContent(entryKey(date, member), entry);
      setEntries((prev) => ({ ...prev, [member]: entry }));
      setWeek((prev) => [...prev.filter((r) => r.key !== entryKey(date, member)), { key: entryKey(date, member), value: entry }]);
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
  const attendedCount = TEAM.filter((n) => entries[n]?.attendance === "present" || entries[n]?.attendance === "late").length;
  const winning = METRICS.every((m) => teamTotals[m.key] >= targets[m.key] * TEAM.length);

  // ── لوحة الأسبوع ──
  const weekRows = TEAM.map((member) => {
    const days = week.filter((r) => r.key.split(":")[2] === member).map((r) => r.value);
    const sum = (k: (typeof METRICS)[number]["key"]) => days.reduce((s, d) => s + (d[k] ?? 0), 0);
    const reported = days.filter((d) => METRICS.some((m) => (d[m.key] ?? 0) > 0)).length;
    const qualityDays = days.map((d) => qualityAvg(d.quality)).filter((v): v is number => v !== null);
    return {
      quality: qualityDays.length ? qualityDays.reduce((a, b) => a + b, 0) / qualityDays.length : null,
      member,
      attended: days.filter((d) => d.attendance === "present" || d.attendance === "late").length,
      late: days.filter((d) => d.attendance === "late").length,
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
            <h1 className="text-lg font-bold text-foreground">الإيقاع اليومي — قائمة الطلبات</h1>
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
          { time: "12:40 ظهراً", text: "الاجتماع اليومي — 10 دقائق، الكاميرا مفتوحة" },
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
            <span className="text-sm font-bold text-foreground">حضور الاجتماع: {attendedCount}/{TEAM.length}</span>
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
                  <div className="flex gap-1">
                    {ATTENDANCE.map((a) => (
                      <button
                        key={a.key}
                        disabled={!isManager || saving === member}
                        onClick={() => save(member, { attendance: e.attendance === a.key ? undefined : a.key })}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          e.attendance === a.key ? `${a.cls} ring-1` : "bg-white/[0.04] text-muted-foreground"
                        } ${isManager ? "hover:bg-white/[0.08]" : "cursor-default"}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 mt-3">
                  {([
                    { key: "yesterday", label: "ماذا أنجزت أمس؟" },
                    { key: "today", label: "أهم 3 أشياء اليوم" },
                    { key: "blocker", label: "عائق تحتاج فيه مساعدة" },
                  ] as const).map((f) => (
                    <label key={f.key} className="block text-xs text-muted-foreground">
                      {f.label}
                      <textarea
                        rows={2}
                        value={e[f.key] ?? ""}
                        readOnly={!editable}
                        onChange={(ev) => update(member, { [f.key]: ev.target.value })}
                        className={`block w-full mt-1 px-3 py-2 rounded-lg bg-white/[0.04] border text-sm text-foreground resize-none ${
                          f.key === "blocker" && e.blocker?.trim() ? "border-red-500/30" : "border-white/[0.08]"
                        }`}
                      />
                    </label>
                  ))}
                </div>

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

                {/* تقييم الجودة خاص: يظهر للمدير وللموظف نفسه فقط */}
                {editable && (
                <div className="mt-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-foreground">جودة الاستهداف</span>
                    {qualityAvg(e.quality) !== null ? (
                      <span className={`font-bold ${qualityColor(qualityAvg(e.quality)!)}`}>{qualityAvg(e.quality)!.toFixed(1)} / 5</span>
                    ) : (
                      <span className="text-muted-foreground">لم يُقيَّم</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {QUALITY.map((c) => {
                      const v = e.quality?.[c.key];
                      return (
                        <div key={c.key} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">{c.label}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                disabled={!isManager || saving === member}
                                onClick={() => save(member, { quality: { ...e.quality, [c.key]: v === n ? undefined : n } })}
                                className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all ${
                                  v && n <= v ? `bg-violet-500/20 ${qualityColor(v)}` : "bg-white/[0.04] text-muted-foreground"
                                } ${isManager ? "hover:bg-white/[0.1]" : "cursor-default"}`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

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
                <th className="text-center py-2 font-medium">حضور</th>
                <th className="text-center py-2 font-medium">تأخير</th>
                <th className="text-center py-2 font-medium">أيام التحديث</th>
                {isManager && <th className="text-center py-2 font-medium">الجودة</th>}
                {METRICS.map((m) => <th key={m.key} className="text-center py-2 font-medium">{m.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {weekRows.map((r, i) => (
                <tr key={r.member} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-2 font-bold text-foreground">{r.member}</td>
                  <td className="py-2 text-center">{r.attended}</td>
                  <td className={`py-2 text-center ${r.late ? "text-amber-400" : ""}`}>{r.late}</td>
                  <td className="py-2 text-center">{r.reported}</td>
                  {isManager && (
                    <td className={`py-2 text-center font-bold ${r.quality !== null ? qualityColor(r.quality) : "text-muted-foreground"}`}>
                      {r.quality !== null ? r.quality.toFixed(1) : "—"}
                    </td>
                  )}
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
        <p className="text-[11px] text-muted-foreground mt-2">الأخضر: المعدّل اليومي يحقق الهدف في الأيام التي حُدّثت فيها الأرقام.{isManager && " الجودة: متوسط تقييم المدير من 5 (4+ ممتاز، أقل من 3 يحتاج تدريب) — تظهر لك فقط."}</p>
      </div>
    </div>
  );
}
