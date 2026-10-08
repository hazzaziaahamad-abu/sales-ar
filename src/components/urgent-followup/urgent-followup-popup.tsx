"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Siren } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { todayLocal } from "@/lib/utils/format";
import {
  fetchUrgentDeals,
  isUrgentAdmin,
  summarizeByRep,
  STALE_DAYS,
  CRITICAL_DAYS,
  type UrgentDeal,
} from "@/lib/urgent-followup";

function storageKey(userName: string) {
  return `urgent_followup_ack_${userName}_${todayLocal()}`;
}

/**
 * نافذة تطلع أول ما يفتح الموظف النظام لو عنده صفقات بدون تحديث من 3 أيام أو أكثر.
 * ما تقفل إلا بزر «راح أتابعها» (مرة يومياً). للمدير: ملخص اليوم لكل موظف.
 */
export function UrgentFollowupPopup() {
  const { user, activeOrgId } = useAuth();
  const pathname = usePathname();
  const [items, setItems] = useState<UrgentDeal[]>([]);
  const [show, setShow] = useState(false);
  const admin = isUrgentAdmin(user);

  useEffect(() => {
    if (!user?.name) return;
    try {
      if (localStorage.getItem(storageKey(user.name))) return;
    } catch { /* storage غير متاح — نعرض النافذة عادي */ }
    let alive = true;
    fetchUrgentDeals({ repName: admin ? undefined : user.name })
      .then((all) => {
        if (!alive) return;
        const stale = all.filter((i) => i.staleDays >= STALE_DAYS);
        if (stale.length === 0) return;
        setItems(stale.sort((a, b) => b.staleDays - a.staleDays));
        // بعد نافذة الترحيب
        setTimeout(() => { if (alive) setShow(true); }, 1500);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.name, admin, activeOrgId]);

  // ما نزعج الموظف وهو داخل الصفحة نفسها
  if (!show || !user || pathname.startsWith("/urgent-followup")) return null;

  const ack = () => {
    try { localStorage.setItem(storageKey(user.name), "1"); } catch { /* ignore */ }
    setShow(false);
  };

  const critical = items.filter((i) => i.staleDays >= CRITICAL_DAYS).length;
  const repRows = admin ? summarizeByRep(items) : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-lg overflow-hidden rounded-[18px] border-2 border-red-500/70 bg-card shadow-[0_0_60px_rgba(239,68,68,0.35)]">
        <div className="bg-gradient-to-l from-red-600 to-red-500 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
              <span className="absolute inset-0 rounded-xl bg-white/30 animate-ping opacity-40" />
              <Siren className="relative h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold">{admin ? "ملخص المتابعة اليومية" : "هام جداً — متابعة اليوم"}</h2>
              <p className="text-[13px] text-white/90">
                {items.length} صفقة بدون تحديث في السجل من {STALE_DAYS} أيام أو أكثر
                {critical > 0 && ` · منها ${critical} من ${CRITICAL_DAYS}+ أيام`}
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-4">
          {admin ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[12px] text-muted-foreground">
                  <th className="pb-2 text-right font-semibold">الموظف</th>
                  <th className="pb-2 text-center font-semibold">💳 دفع</th>
                  <th className="pb-2 text-center font-semibold">🧪 تجريبي</th>
                  <th className="pb-2 text-center font-semibold">⚙️ تجهيز</th>
                  <th className="pb-2 text-center font-semibold">{CRITICAL_DAYS}+ أيام</th>
                </tr>
              </thead>
              <tbody>
                {repRows.map((r) => (
                  <tr key={r.rep} className="border-t border-border">
                    <td className="py-2 font-bold text-foreground">{r.rep}</td>
                    <td className="py-2 text-center">{r.byStage["انتظار الدفع"] ?? 0}</td>
                    <td className="py-2 text-center">{r.byStage["تجريبي"] ?? 0}</td>
                    <td className="py-2 text-center">{r.byStage["تجهيز"] ?? 0}</td>
                    <td className={`py-2 text-center font-bold ${r.critical > 0 ? "text-red-400" : "text-muted-foreground"}`}>{r.critical}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <ul className="space-y-2">
              {items.slice(0, 12).map((i) => (
                <li
                  key={i.deal.id}
                  className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 ${i.staleDays >= CRITICAL_DAYS ? "border-red-500/60 bg-red-500/10" : "border-amber-500/50 bg-amber-500/5"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-foreground">{i.deal.client_name}</p>
                    <p className="text-[12px] text-muted-foreground">{i.deal.stage} · له {i.stageDays} يوم في الحالة</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${i.staleDays >= CRITICAL_DAYS ? "bg-red-500" : "bg-amber-500"}`}>
                    {i.staleDays} يوم بدون تحديث
                  </span>
                </li>
              ))}
              {items.length > 12 && <li className="text-center text-[12px] text-muted-foreground">و {items.length - 12} صفقة ثانية…</li>}
            </ul>
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-4">
          <Link
            href="/urgent-followup"
            onClick={ack}
            className="flex-1 rounded-[12px] bg-red-500 py-2.5 text-center font-extrabold text-white hover:bg-red-600"
          >
            {admin ? "افتح التفاصيل" : "راح أتابعها الحين"}
          </Link>
          <button onClick={ack} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            {admin ? "تم الاطلاع" : "راح أتابعها"}
          </button>
        </div>
      </div>
    </div>
  );
}
