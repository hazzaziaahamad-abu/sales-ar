"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BellRing, Check, Trophy, X } from "lucide-react";
import { Confetti } from "./confetti";
import { useAuth } from "@/lib/auth-context";
import { isUrgentAdmin } from "@/lib/urgent-followup";
import { saudiDateStr } from "@/lib/utils/format";
import {
  buildReminderItems,
  fetchMyAcks,
  saveAck,
  saudiMinutesNow,
  MID_SHIFT_MINUTES,
  SHIFT_END_HOUR,
  START_DELAY_MIN,
  MIN_GAP_MIN,
  SLOT_LABEL,
  PRAISE_FOR_ACHIEVER,
  TEAM_SAW_LINE,
  broadcastCelebration,
  pickPhrase,
  type ReminderItem,
  type ReminderSlot,
} from "@/lib/team-reminders";

const MIN_MS = 60000;
const CHECK_EVERY_MS = MIN_MS;

const k = (uid: string, date: string, what: string) => `team_rem_${what}_${uid}_${date}`;

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, val: string) {
  try { localStorage.setItem(key, val); } catch { /* ignore */ }
}

/**
 * تذكيرات الفريق — تطلع مرتين يومياً: بعد ٥ دقائق من أول استخدام، ونص الدوام (٥:٣٠ م).
 * كل تذكير له زر «تم» يسجّل الإنجاز، والإغلاق يسجّل «اطّلع وقفل» — والمدير يتابع من صفحة «تذكيرات الفريق».
 */
export function TeamRemindersPopup() {
  const { user, isImpersonating, activeOrgId } = useAuth();
  const [slot, setSlot] = useState<ReminderSlot | null>(null);
  const [items, setItems] = useState<ReminderItem[]>([]);
  const [handled, setHandled] = useState<Record<string, "done" | "dismissed">>({});
  const [celebration, setCelebration] = useState<string | null>(null);
  const busy = useRef(false);

  const eligible = !!user && !isImpersonating && !isUrgentAdmin(user);

  const markSlotHandled = useCallback((s: ReminderSlot) => {
    if (!user) return;
    const date = saudiDateStr();
    lsSet(k(user.id, date, `slot_${s}`), String(Date.now()));
  }, [user]);

  const check = useCallback(async () => {
    if (!eligible || !user || busy.current || slot) return;
    busy.current = true;
    try {
      const date = saudiDateStr();
      const firstKey = k(user.id, date, "first");
      let first = Number(lsGet(firstKey));
      if (!first) {
        first = Date.now();
        lsSet(firstKey, String(first));
      }
      const now = Date.now();
      const startAt = Number(lsGet(k(user.id, date, "slot_start"))) || 0;
      const midAt = Number(lsGet(k(user.id, date, "slot_mid"))) || 0;

      let due: ReminderSlot | null = null;
      if (!startAt && now - first >= START_DELAY_MIN * MIN_MS) due = "start";
      else if (
        !midAt &&
        saudiMinutesNow() >= MID_SHIFT_MINUTES &&
        saudiMinutesNow() < SHIFT_END_HOUR * 60 &&
        now - (startAt || first) >= MIN_GAP_MIN * MIN_MS
      ) due = "mid";
      if (!due) return;

      // لو تفاعل معه من جهاز ثاني اليوم، ما نكرر
      const acks = await fetchMyAcks(user.id, date);
      if (acks.some((a) => a.slot === due)) {
        markSlotHandled(due);
        return;
      }
      const built = await buildReminderItems(user, due);
      if (built.length === 0) {
        markSlotHandled(due);
        return;
      }
      setHandled({});
      setCelebration(null);
      setItems(built);
      setSlot(due);
    } catch {
      /* نحاول في الدورة الجاية */
    } finally {
      busy.current = false;
    }
  }, [eligible, user, slot, markSlotHandled]);

  useEffect(() => {
    if (!eligible) return;
    const first = setTimeout(check, 3000);
    const iv = setInterval(check, CHECK_EVERY_MS);
    return () => { clearTimeout(first); clearInterval(iv); };
  }, [eligible, check, activeOrgId]);

  // الإغلاق يسجّل الباقي «اطّلع وقفل». doneKey = تذكير فتح الموظف رابطه (يُحسب منجز).
  const close = useCallback((doneKey?: string) => {
    if (!user || !slot) return;
    items.forEach((it) => {
      if (handled[it.key]) return;
      void saveAck(user, slot, it, it.key === doneKey ? "done" : "dismissed");
    });
    markSlotHandled(slot);
    setSlot(null);
    setItems([]);
  }, [user, slot, items, handled, markSlotHandled]);

  const act = (it: ReminderItem) => {
    if (!user || !slot || handled[it.key]) return;
    const status = "done" as const;
    setHandled((h) => ({ ...h, [it.key]: status }));
    void saveAck(user, slot, it, status);
  };

  // خلّص كل التذكيرات بـ«تم» ⇒ احتفال له + إعلان لكل الفريق
  const taskItems = items.filter((it) => it.key !== "cheer");
  const allTasksDone = taskItems.length > 0 && taskItems.every((it) => handled[it.key] === "done");
  useEffect(() => {
    if (!allTasksDone || !slot || !user || celebration) return;
    const cheerItem = items.find((it) => it.key === "cheer");
    if (cheerItem && !handled[cheerItem.key]) {
      setHandled((h) => ({ ...h, [cheerItem.key]: "done" }));
      void saveAck(user, slot, cheerItem, "done");
    }
    const phrase = pickPhrase(PRAISE_FOR_ACHIEVER, `${user.id}-${saudiDateStr()}-${slot}`);
    setCelebration(phrase);
    void broadcastCelebration(user, slot, phrase);
  }, [allTasksDone, slot, user, celebration, items, handled]);

  const finish = useCallback(() => {
    if (slot) markSlotHandled(slot);
    setSlot(null);
    setItems([]);
    setCelebration(null);
  }, [slot, markSlotHandled]);

  if (!slot || !user || items.length === 0) return null;

  if (celebration) {
    return (
      <>
        <Confetti count={70} />
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-sm overflow-hidden rounded-[22px] border-2 border-yellow-400/50 bg-gradient-to-b from-yellow-400/15 via-card to-card p-6 text-center shadow-[0_0_70px_rgba(250,204,21,0.3)]">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-400/20">
              <Trophy className="h-9 w-9 text-yellow-400" />
            </div>
            <p className="text-sm font-bold text-yellow-400">أنجزت كل تذكيرات {SLOT_LABEL[slot]} 🎉</p>
            <h2 className="mt-1 text-2xl font-black text-foreground">ما شاء الله يا {user.name.split(" ")[0]}!</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-foreground/90">{celebration}</p>
            <p className="mt-3 rounded-[12px] bg-violet-500/10 px-3 py-2 text-[13px] font-bold text-violet-300">{TEAM_SAW_LINE}</p>
            <button onClick={finish} className="mt-5 w-full rounded-[12px] bg-yellow-400 py-2.5 font-extrabold text-black hover:bg-yellow-300">
              يا سلام 💜
            </button>
          </div>
        </div>
      </>
    );
  }

  const tasks = items.filter((i) => i.key !== "cheer");
  const cheer = items.find((i) => i.key === "cheer");
  const doneCount = tasks.filter((t) => handled[t.key]).length;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-md overflow-hidden rounded-[18px] border border-violet-500/40 bg-card shadow-[0_0_50px_rgba(139,92,246,0.25)]">
        <div className="flex items-center gap-3 bg-gradient-to-l from-violet-600 to-indigo-500 px-5 py-4 text-white">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <BellRing className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold">تذكير {SLOT_LABEL[slot]}</h2>
            <p className="text-[13px] text-white/85">
              {tasks.length > 0 ? `أنجزت ${doneCount} من ${tasks.length}` : "رسالة لك"}
            </p>
          </div>
          <button onClick={() => close()} aria-label="إغلاق" className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
          {tasks.map((it) => {
            const done = !!handled[it.key];
            return (
              <div
                key={it.key}
                className={`rounded-[12px] border p-3 transition-colors ${done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-background/40"}`}
              >
                <p className={`font-bold ${done ? "text-emerald-400" : "text-foreground"}`}>{it.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{it.body}</p>
                {it.list && it.list.length > 0 && !done && (
                  <ul className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
                    {it.list.map((l) => <li key={l} className="truncate">• {l}</li>)}
                    {(it.metric ?? 0) > it.list.length && <li>و {(it.metric ?? 0) - it.list.length} غيرها…</li>}
                  </ul>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => act(it)}
                    disabled={done}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-sm font-bold ${done ? "bg-emerald-500/15 text-emerald-400" : "bg-violet-600 text-white hover:bg-violet-700"}`}
                  >
                    {done ? <><Check className="h-4 w-4" /> تم</> : it.doneLabel}
                  </button>
                  {it.link && !done && (
                    <Link
                      href={it.link.href}
                      onClick={() => close(it.key)}
                      className="rounded-[10px] border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {it.link.label}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {cheer && (
            <div className="rounded-[12px] border border-amber-400/30 bg-amber-400/5 p-3">
              <p className="font-bold text-amber-300">{cheer.title} 🌟</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{cheer.body}</p>
              {!handled[cheer.key] && (
                <button onClick={() => act(cheer)} className="mt-2 text-sm font-bold text-amber-300 hover:text-amber-200">
                  {cheer.doneLabel}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
