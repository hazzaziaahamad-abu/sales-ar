"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, ChevronRight, ChevronLeft, Loader2, Check, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getEditableContent, saveEditableContent, getEditableContentRange } from "@/lib/supabase/db";
import { todayLocal } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TEAM, KEY_PREFIX, QUALITY, qualityAvg, qualityColor, weekStart, addDays, type QualityScores,
} from "@/components/daily-huddle/huddle-shared";

// جودة الاستهداف — تقييم أسبوعي لكل موظف (بدل التقييم اليومي السابق).
const QUALITY_PREFIX = "huddle_quality";
const HISTORY_WEEKS = 6;

interface WeeklyQuality {
  scores?: QualityScores;
  note?: string;
  updated_by?: string;
  updated_at?: string;
}

const qKey = (week: string, member: string) => `${QUALITY_PREFIX}:${week}:${member}`;
const keyPart = (key: string, i: number) => key.split(":")[i];

function weekLabel(week: string): string {
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
  return `${fmt(week)} — ${fmt(addDays(week, 6))}`;
}

export function TargetingQualityTab({ isManager }: { isManager: boolean }) {
  const { user } = useAuth();
  const myFirstName = user?.name?.trim().split(/\s+/)[0] ?? "";
  const thisWeek = weekStart(todayLocal());

  const [week, setWeek] = useState(thisWeek);
  const [weekly, setWeekly] = useState<Record<string, WeeklyQuality>>({});       // key: week:member
  const [legacy, setLegacy] = useState<Record<string, number>>({});              // key: week:member → متوسط التقييمات اليومية القديمة
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const visibleTeam = isManager ? TEAM : TEAM.filter((m) => m === myFirstName);

  const load = useCallback(async () => {
    try {
      const from = addDays(week, -7 * (HISTORY_WEEKS - 1));
      const to = addDays(week, 6);
      const [rows, daily] = await Promise.all([
        getEditableContentRange<WeeklyQuality>(`${QUALITY_PREFIX}:${from}`, `${QUALITY_PREFIX}:${week}:￿`),
        getEditableContentRange<{ quality?: QualityScores }>(`${KEY_PREFIX}:${from}`, `${KEY_PREFIX}:${to}:￿`),
      ]);
      const w: Record<string, WeeklyQuality> = {};
      for (const r of rows) w[`${keyPart(r.key, 1)}:${keyPart(r.key, 2)}`] = r.value ?? {};
      setWeekly(w);

      // التقييمات اليومية القديمة → متوسط أسبوعي (مرجع للأسابيع اللي ما لها تقييم أسبوعي)
      const acc: Record<string, number[]> = {};
      for (const r of daily) {
        const avg = qualityAvg(r.value?.quality);
        if (avg === null) continue;
        const k = `${weekStart(keyPart(r.key, 1))}:${keyPart(r.key, 2)}`;
        (acc[k] ??= []).push(avg);
      }
      setLegacy(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length])));
      setError(null);
    } catch (e) {
      console.error(e);
      setError("تعذّر تحميل التقييمات");
    } finally {
      setLoading(false);
    }
  }, [week]);

  useEffect(() => { load(); }, [load]);

  function changeWeek(delta: number) {
    const next = addDays(week, 7 * delta);
    if (next > thisWeek) return;
    setLoading(true);
    setNotes({});
    setWeek(next);
  }

  async function save(member: string, patch: Partial<WeeklyQuality>) {
    if (!isManager) return;
    setSaving(member);
    setError(null);
    try {
      const key = qKey(week, member);
      const latest = (await getEditableContent<WeeklyQuality>(key)) ?? {};
      const entry: WeeklyQuality = { ...latest, ...patch, updated_by: user?.name, updated_at: new Date().toISOString() };
      await saveEditableContent(key, entry);
      setWeekly((prev) => ({ ...prev, [`${week}:${member}`]: entry }));
      setSaved(member);
      setTimeout(() => setSaved((s) => (s === member ? null : s)), 2000);
    } catch (e) {
      console.error(e);
      setError(`تعذّر حفظ تقييم ${member}`);
    } finally {
      setSaving(null);
    }
  }

  // متوسط موظف في أسبوع: التقييم الأسبوعي، وإلا متوسط التقييمات اليومية القديمة
  const weekScore = useCallback((w: string, member: string): { v: number | null; legacy: boolean } => {
    const v = qualityAvg(weekly[`${w}:${member}`]?.scores);
    if (v !== null) return { v, legacy: false };
    const l = legacy[`${w}:${member}`];
    return l !== undefined ? { v: l, legacy: true } : { v: null, legacy: false };
  }, [weekly, legacy]);

  const historyWeeks = useMemo(
    () => Array.from({ length: HISTORY_WEEKS }, (_, i) => addDays(week, -7 * (HISTORY_WEEKS - 1 - i))),
    [week]
  );

  if (loading) return <Skeleton className="h-72 rounded-2xl" />;

  if (visibleTeam.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">تقييمات جودة الاستهداف تظهر للمدير ولأعضاء فريق قائمة الطلبات.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="cc-card rounded-2xl p-4 border border-violet-500/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-sm font-bold text-foreground">جودة الاستهداف — تقييم أسبوعي</h2>
              <p className="text-[11px] text-muted-foreground">
                {isManager ? "قيّم كل موظف مرة في الأسبوع بعد الاستماع لمكالماته (من 1 إلى 5)" : "تقييمك الأسبوعي من المدير"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => changeWeek(-1)} title="الأسبوع السابق" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground">
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-[12px] font-bold text-foreground px-2 min-w-[120px] text-center">
              {week === thisWeek ? "هذا الأسبوع" : weekLabel(week)}
            </span>
            <button onClick={() => changeWeek(1)} disabled={week >= thisWeek} title="الأسبوع التالي" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
        {week === thisWeek && <p className="text-[11px] text-muted-foreground mt-2">{weekLabel(week)}</p>}
      </div>

      {error && <div className="rounded-[14px] p-3 text-sm bg-red-500/10 text-red-400 border border-red-500/20">{error}</div>}

      {/* Member cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {visibleTeam.map((member) => {
          const entry = weekly[`${week}:${member}`] ?? {};
          const avg = qualityAvg(entry.scores);
          const prev = weekScore(addDays(week, -7), member).v;
          const legacyAvg = avg === null ? legacy[`${week}:${member}`] : undefined;
          const noteDraft = notes[member] ?? entry.note ?? "";
          const noteDirty = noteDraft !== (entry.note ?? "");
          return (
            <div key={member} className="cc-card rounded-2xl p-4 border border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{member}</span>
                  {saving === member && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                  {saved === member && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {avg !== null && prev !== null && Math.abs(avg - prev) >= 0.1 && (
                    <span className={`flex items-center gap-0.5 ${avg > prev ? "text-emerald-400" : "text-red-400"}`} title={`الأسبوع السابق ${prev.toFixed(1)}`}>
                      {avg > prev ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {(avg - prev > 0 ? "+" : "") + (avg - prev).toFixed(1)}
                    </span>
                  )}
                  {avg !== null ? (
                    <span className={`font-bold ${qualityColor(avg)}`}>{avg.toFixed(1)} / 5</span>
                  ) : (
                    <span className="text-muted-foreground">لم يُقيَّم</span>
                  )}
                </div>
              </div>

              {legacyAvg !== undefined && (
                <p className="text-[11px] text-muted-foreground mb-2">متوسط التقييمات اليومية السابقة لهذا الأسبوع: <span className={qualityColor(legacyAvg)}>{legacyAvg.toFixed(1)}</span></p>
              )}

              <div className="space-y-1.5">
                {QUALITY.map((c) => {
                  const v = entry.scores?.[c.key];
                  return (
                    <div key={c.key} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            disabled={!isManager || saving === member}
                            onClick={() => save(member, { scores: { ...entry.scores, [c.key]: v === n ? undefined : n } })}
                            className={`w-7 h-7 rounded-md text-[11px] font-bold transition-all ${
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

              {/* ملاحظة/توصية الأسبوع */}
              {isManager ? (
                <div className="mt-3 flex gap-2">
                  <input
                    value={noteDraft}
                    onChange={(e) => setNotes((p) => ({ ...p, [member]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && noteDirty && save(member, { note: noteDraft.trim() || undefined })}
                    placeholder="ملاحظة أو توصية تدريب لهذا الأسبوع (اختياري)"
                    className="flex-1 bg-transparent border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-violet-500/40"
                  />
                  {noteDirty && (
                    <button onClick={() => save(member, { note: noteDraft.trim() || undefined })} className="text-[11px] px-2.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30">حفظ</button>
                  )}
                </div>
              ) : entry.note ? (
                <p className="mt-3 text-[12px] text-muted-foreground rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5">ملاحظة المدير: {entry.note}</p>
              ) : null}

              {entry.updated_by && (
                <p className="text-[10px] text-muted-foreground/70 mt-2">آخر تقييم: {entry.updated_by}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* اتجاه آخر الأسابيع */}
      <div className="cc-card rounded-2xl p-4 border border-white/[0.06]">
        <h3 className="text-sm font-bold text-foreground mb-3">آخر {HISTORY_WEEKS} أسابيع</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-white/[0.06]">
                <th className="text-right py-2 font-medium">الموظف</th>
                {historyWeeks.map((w) => (
                  <th key={w} className="text-center py-2 font-medium whitespace-nowrap">
                    {new Date(`${w}T12:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTeam.map((member) => (
                <tr key={member} className="border-b border-white/[0.04] last:border-0">
                  <td className="py-2 font-bold text-foreground">{member}</td>
                  {historyWeeks.map((w) => {
                    const { v, legacy: isLegacy } = weekScore(w, member);
                    return (
                      <td key={w} className={`py-2 text-center font-bold ${v !== null ? qualityColor(v) : "text-muted-foreground"}`}>
                        {v !== null ? <span title={isLegacy ? "من التقييمات اليومية السابقة" : undefined}>{v.toFixed(1)}{isLegacy ? "*" : ""}</span> : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">من 5: 4+ ممتاز، أقل من 3 يحتاج تدريب. (*) متوسط التقييمات اليومية السابقة قبل التحويل للتقييم الأسبوعي.</p>
      </div>
    </div>
  );
}
