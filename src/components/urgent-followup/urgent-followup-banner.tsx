"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Siren, ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchUrgentDeals, isUrgentAdmin, URGENT_FOLLOWUP_STAGES, STALE_DAYS, type UrgentDeal } from "@/lib/urgent-followup";

const STAGE_ICON: Record<string, string> = { "انتظار الدفع": "💳", "تجريبي": "🧪", "تجهيز": "⚙️" };

/** بانر أحمر في أعلى منتصف القسم — يعرض الحالات المهمة الخاصة بهذا القسم فقط */
export function UrgentFollowupBanner({ salesType }: { salesType: "office" | "support" }) {
  const { user, activeOrgId } = useAuth();
  const [items, setItems] = useState<UrgentDeal[] | null>(null);
  const admin = isUrgentAdmin(user);
  const repName = admin ? undefined : user?.name;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () => fetchUrgentDeals({ repName, salesType }).then((r) => { if (alive) setItems(r); }).catch(() => {});
    load();
    const id = setInterval(load, 120000);
    return () => { alive = false; clearInterval(id); };
  }, [user, repName, salesType, activeOrgId]);

  if (!items || items.length === 0) return null;
  const stale = items.filter((i) => i.staleDays >= STALE_DAYS).length;

  return (
    <div className="flex justify-center">
      <Link
        href={`/urgent-followup?type=${salesType}`}
        className="group w-full max-w-3xl rounded-[14px] border-2 border-red-500/60 bg-gradient-to-l from-red-500/20 via-red-500/10 to-red-500/20 px-4 py-3 shadow-[0_0_24px_rgba(239,68,68,0.2)] transition-colors hover:bg-red-500/20"
      >
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center">
          <span className="flex items-center gap-2 font-extrabold text-red-400">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-red-500 text-white">
              <span className="absolute inset-0 rounded-lg bg-red-500 animate-ping opacity-30" />
              <Siren className="relative h-4 w-4" />
            </span>
            هام جداً للمتابعة اليومية
          </span>
          {URGENT_FOLLOWUP_STAGES.map((s) => {
            const n = items.filter((i) => i.deal.stage === s).length;
            return (
              <span key={s} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[13px] font-bold text-foreground">
                {STAGE_ICON[s]} {s}: {n}
              </span>
            );
          })}
          {stale > 0 && (
            <span className="rounded-full bg-red-600 px-2.5 py-1 text-[13px] font-extrabold text-white animate-pulse">
              ⚠️ {stale} بدون تحديث {STALE_DAYS}+ أيام
            </span>
          )}
          <span className="flex items-center text-[12px] text-muted-foreground group-hover:text-foreground">
            افتح القائمة <ChevronLeft className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </div>
  );
}
