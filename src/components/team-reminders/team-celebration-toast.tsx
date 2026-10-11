"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PartyPopper, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/supabase/db";
import { saudiDateStr } from "@/lib/utils/format";
import {
  fetchTodayCelebrations,
  pickPhrase,
  PRAISE_FOR_TEAM,
  SLOT_LABEL,
  type CelebrationRow,
} from "@/lib/team-reminders";
import { Confetti } from "./confetti";

const SHOW_MS = 7000;
/** عند الدخول نعرض احتفالات آخر ٣ ساعات اللي فاتت الموظف */
const CATCH_UP_MS = 3 * 3600000;

const seenKey = (uid: string) => `team_celebrations_seen_${uid}_${saudiDateStr()}`;

function loadSeen(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) || "[]")); } catch { return new Set(); }
}
function saveSeen(uid: string, seen: Set<string>) {
  try { localStorage.setItem(seenKey(uid), JSON.stringify([...seen].slice(-50))); } catch { /* ignore */ }
}

/**
 * إعلان للفريق كله: لما موظف يخلّص كل تذكيراته، يطلع للباقين احتفال باسمه.
 * مباشر للمتصلين (Realtime)، ومن كان غايب يشوفه أول ما يفتح النظام.
 */
export function TeamCelebrationToast() {
  const { user, activeOrgId } = useAuth();
  const [queue, setQueue] = useState<CelebrationRow[]>([]);
  const current = queue[0] ?? null;
  const seen = useRef<Set<string>>(new Set());

  const enqueue = useCallback((rows: CelebrationRow[]) => {
    if (!user) return;
    const fresh = rows.filter((r) => r.user_id !== user.id && !seen.current.has(r.id));
    if (fresh.length === 0) return;
    fresh.forEach((r) => seen.current.add(r.id));
    saveSeen(user.id, seen.current);
    setQueue((q) => [...q, ...fresh]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    seen.current = loadSeen(user.id);
    let alive = true;

    fetchTodayCelebrations()
      .then((rows) => {
        if (!alive) return;
        const recent = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < CATCH_UP_MS);
        enqueue(recent.reverse().slice(-3));
      })
      .catch(() => {});

    const orgId = activeOrgId || getOrgId();
    const supabase = createClient();
    const channel = supabase
      .channel(`team-celebrations-${orgId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_celebrations", filter: `org_id=eq.${orgId}` },
        (payload) => enqueue([payload.new as CelebrationRow])
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [user, activeOrgId, enqueue]);

  // كل احتفال يبقى ٧ ثواني ثم اللي بعده
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), SHOW_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current || !user) return null;

  const firstName = current.user_name.split(" ")[0];
  const teamLine = pickPhrase(PRAISE_FOR_TEAM, current.id).replace("{name}", firstName);

  return (
    <>
      <Confetti count={40} />
      <div className="fixed left-1/2 top-4 z-[115] w-[92vw] max-w-md -translate-x-1/2" dir="rtl">
        <div className="flex items-start gap-3 rounded-[16px] border-2 border-yellow-400/50 bg-card/95 p-4 shadow-[0_10px_50px_rgba(250,204,21,0.25)] backdrop-blur-md">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow-400/20">
            <PartyPopper className="h-6 w-6 text-yellow-400" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold text-yellow-400">إنجاز في الفريق 🎉</p>
            <p className="mt-0.5 font-black text-foreground">{current.user_name} 🏆</p>
            <p className="text-[13px] font-semibold text-foreground/80">إنجاز كامل لكل تذكيرات {SLOT_LABEL[current.slot] ?? "اليوم"}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{teamLine}</p>
          </div>
          <button
            onClick={() => setQueue((q) => q.slice(1))}
            aria-label="إغلاق"
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
