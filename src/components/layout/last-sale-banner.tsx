"use client";

import { useState, useEffect } from "react";
import { Trophy, Clock } from "lucide-react";
import { fetchDeals, fetchRenewals } from "@/lib/supabase/db";

interface LastSaleInfo {
  clientName: string;
  value: number;
  type: "office" | "support" | "renewal";
  date: string;
}

function formatElapsed(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "الآن";

  const totalMinutes = Math.floor(diff / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days} يوم و ${hours} ساعة` : `${days} يوم`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} ساعة و ${minutes} دقيقة` : `${hours} ساعة`;
  }
  return `${minutes} دقيقة`;
}

function formatMoney(n: number): string {
  return n.toLocaleString("ar-SA-u-ca-gregory") + " ر.س";
}

const TYPE_LABEL: Record<string, string> = {
  office: "مبيعات المكتب",
  support: "مبيعات الدعم",
  renewal: "التجديدات",
};

export function LastSaleBanner() {
  const [sale, setSale] = useState<LastSaleInfo | null>(null);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    Promise.all([fetchDeals(), fetchRenewals()])
      .then(([deals, renewals]) => {
        let latest: LastSaleInfo | null = null;
        let latestTime = 0;

        // Closed deals
        for (const d of deals) {
          if (d.stage !== "مكتملة") continue;
          const t = new Date(d.close_date || d.updated_at || d.created_at).getTime();
          if (t > latestTime) {
            latestTime = t;
            latest = {
              clientName: d.client_name,
              value: d.deal_value,
              type: d.sales_type === "support" ? "support" : "office",
              date: d.close_date || d.updated_at || d.created_at,
            };
          }
        }

        // Completed renewals
        for (const r of renewals) {
          if (r.status !== "مكتمل") continue;
          const t = new Date(r.updated_at || r.created_at).getTime();
          if (t > latestTime) {
            latestTime = t;
            latest = {
              clientName: r.customer_name,
              value: r.plan_price,
              type: "renewal",
              date: r.updated_at || r.created_at,
            };
          }
        }

        if (latest) {
          setSale(latest);
          setElapsed(formatElapsed(latest.date));
        }
      })
      .catch(() => {});
  }, []);

  // Live tick every minute
  useEffect(() => {
    if (!sale) return;
    const timer = setInterval(() => {
      setElapsed(formatElapsed(sale.date));
    }, 60000);
    return () => clearInterval(timer);
  }, [sale]);

  if (!sale) return null;

  const diff = Date.now() - new Date(sale.date).getTime();
  const hours = diff / (1000 * 60 * 60);
  const urgencyColor = hours < 12
    ? "from-emerald-500/15 to-emerald-500/5 border-emerald-500/25"
    : hours < 24
    ? "from-amber-500/15 to-amber-500/5 border-amber-500/25"
    : "from-red-500/15 to-red-500/5 border-red-500/25";
  const textColor = hours < 12 ? "text-emerald-400" : hours < 24 ? "text-amber-400" : "text-red-400";
  const iconColor = hours < 12 ? "text-emerald-400" : hours < 24 ? "text-amber-400" : "text-red-400";

  return (
    <div className={`rounded-xl bg-gradient-to-l ${urgencyColor} border px-4 py-2.5 mb-4 flex items-center justify-between gap-3 flex-wrap`}>
      <div className="flex items-center gap-2.5">
        <Trophy className={`w-4 h-4 ${iconColor} shrink-0`} />
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-muted-foreground">آخر مبيعة:</span>
          <span className="font-bold text-foreground">{sale.clientName}</span>
          <span className="text-muted-foreground">—</span>
          <span className={`font-bold ${textColor}`}>{formatMoney(sale.value)}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground">{TYPE_LABEL[sale.type]}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className={`w-3.5 h-3.5 ${iconColor}`} />
        <span className={`text-xs font-bold ${textColor}`}>مضى {elapsed}</span>
      </div>
    </div>
  );
}
