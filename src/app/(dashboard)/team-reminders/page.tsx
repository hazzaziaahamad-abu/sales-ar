"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { saudiDateStr } from "@/lib/utils/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAcksForDate,
  ITEM_LABEL,
  SLOT_LABEL,
  type AckRow,
  type ReminderItemKey,
  type ReminderSlot,
} from "@/lib/team-reminders";

const SLOTS: ReminderSlot[] = ["start", "mid"];
const TASK_KEYS: ReminderItemKey[] = ["open_deals", "follow_up_log", "tickets"];
const DAY_MS = 86400000;

interface Member { id: string; name: string }

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" });
}

export default function TeamRemindersPage() {
  const { activeOrgId } = useAuth();
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => saudiDateStr(new Date(Date.now() - i * DAY_MS))),
    []
  );
  const [date, setDate] = useState(days[0]);
  const [acks, setAcks] = useState<AckRow[]>([]);
  const [champs, setChamps] = useState<Map<string, number>>(new Map());
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const supabase = createClient();
    const orgId = activeOrgId || (typeof window !== "undefined" ? localStorage.getItem("cc_org_id") : "") || "";
    Promise.all([
      fetchAcksForDate(date),
      supabase
        .from("user_profiles")
        .select("id, name, org_id, extra_org_ids, is_super_admin, is_active")
        .then(({ data }) =>
          (data ?? [])
            .filter((p) => p.is_active !== false && !p.is_super_admin)
            .filter((p) => p.org_id === orgId || ((p.extra_org_ids as string[] | null) ?? []).includes(orgId))
            .map((p) => ({ id: p.id as string, name: p.name as string }))
        ),
    ])
      .then(([a, m]) => {
        if (!alive) return;
        setAcks(a);
        // الاحتفالات = الفترات اللي خلّص فيها الموظف كل تذكيراته بـ«تم»
        supabase
          .from("team_celebrations")
          .select("user_id")
          .eq("org_id", orgId)
          .eq("celebration_date", date)
          .then(({ data }) => {
            if (!alive) return;
            const c = new Map<string, number>();
            ((data ?? []) as { user_id: string }[]).forEach((r) => c.set(r.user_id, (c.get(r.user_id) ?? 0) + 1));
            setChamps(c);
          });
        setMembers(m.sort((x, y) => x.name.localeCompare(y.name, "ar")));
      })
      .catch(console.error)
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [date, activeOrgId, tick]);

  const byUser = useMemo(() => {
    const m = new Map<string, AckRow[]>();
    acks.forEach((a) => m.set(a.user_id, [...(m.get(a.user_id) ?? []), a]));
    return m;
  }, [acks]);

  // موظف عنده تفاعل لكن مو في القائمة (مثلاً من مؤسسة ثانية) — نضيفه
  const rows: Member[] = useMemo(() => {
    const known = new Set(members.map((m) => m.id));
    const extra = acks.filter((a) => !known.has(a.user_id)).map((a) => ({ id: a.user_id, name: a.user_name }));
    const uniq = new Map<string, Member>([...members, ...extra].map((m) => [m.id, m] as [string, Member]));
    return [...uniq.values()];
  }, [members, acks]);

  const totals = useMemo(() => {
    const tasks = acks.filter((a) => a.item_key !== "cheer");
    return {
      done: tasks.filter((a) => a.status === "done").length,
      dismissed: tasks.filter((a) => a.status === "dismissed").length,
      people: new Set(acks.map((a) => a.user_id)).size,
    };
  }, [acks]);

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15">
            <BellRing className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">تذكيرات الفريق</h1>
            <p className="text-xs text-muted-foreground">
              تطلع مرتين يومياً: بعد ٥ دقائق من أول استخدام، ونص الدوام (٥:٣٠ م) — للصفقات المفتوحة خلال آخر شهر
            </p>
          </div>
        </div>
        <button
          onClick={() => setTick((t) => t + 1)}
          className="flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-4 w-4" /> تحديث
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {days.map((d, i) => (
          <button
            key={d}
            onClick={() => setDate(d)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${d === date ? "border-violet-500/50 bg-violet-500/15 text-violet-300" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {i === 0 ? "اليوم" : i === 1 ? "أمس" : d.slice(5)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="cc-card rounded-[14px] p-3 text-center">
          <p className="text-2xl font-extrabold text-emerald-400">{totals.done}</p>
          <p className="text-[12px] text-muted-foreground">تذكير أُنجز</p>
        </div>
        <div className="cc-card rounded-[14px] p-3 text-center">
          <p className="text-2xl font-extrabold text-amber-400">{totals.dismissed}</p>
          <p className="text-[12px] text-muted-foreground">اطّلع وقفل</p>
        </div>
        <div className="cc-card rounded-[14px] p-3 text-center">
          <p className="text-2xl font-extrabold text-foreground">{totals.people}</p>
          <p className="text-[12px] text-muted-foreground">موظف تفاعل</p>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="cc-card overflow-x-auto rounded-[14px]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-[12px] text-muted-foreground">
                <th className="p-3 text-right font-semibold">الموظف</th>
                {SLOTS.map((s) => (
                  <th key={s} className="p-3 text-right font-semibold">{SLOT_LABEL[s]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const list = byUser.get(m.id) ?? [];
                return (
                  <tr key={m.id} className="border-b border-border/60 last:border-0 align-top">
                    <td className="p-3 font-bold text-foreground">{m.name}{(champs.get(m.id) ?? 0) > 0 && <span className="mr-1.5" title="خلّص كل تذكيرات الفترة">{"🏆".repeat(champs.get(m.id) ?? 0)}</span>}</td>
                    {SLOTS.map((s) => {
                      const slotAcks = list.filter((a) => a.slot === s);
                      if (slotAcks.length === 0) {
                        return <td key={s} className="p-3 text-[12px] text-muted-foreground">— ما ظهر له / ما تفاعل</td>;
                      }
                      return (
                        <td key={s} className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {TASK_KEYS.map((key) => {
                              const a = slotAcks.find((x) => x.item_key === key);
                              if (!a) return null;
                              const done = a.status === "done";
                              return (
                                <span
                                  key={key}
                                  title={`${timeOf(a.created_at)}${a.metric != null ? ` · العدد وقتها: ${a.metric}` : ""}`}
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${done ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}
                                >
                                  {done ? "✓" : "✗"} {ITEM_LABEL[key]}
                                  {a.metric != null ? ` (${a.metric})` : ""}
                                </span>
                              );
                            })}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{timeOf(slotAcks[0].created_at)}</p>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">ما فيه موظفين في هذه المؤسسة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] text-muted-foreground">
        🏆 = خلّص كل تذكيرات الفترة واحتفل معه الفريق · ✓ = ضغط «تم» أو فتح الرابط · ✗ = اطّلع وقفل بدون إنجاز · الرقم بين القوسين = العدد اللي ظهر له وقت التذكير. التذكير ما يطلع إذا ما عنده شي يحتاج متابعة.
      </p>
    </div>
  );
}
