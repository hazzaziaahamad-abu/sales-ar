"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Trophy, Clock } from "lucide-react";
import { fetchDeals, fetchRenewals } from "@/lib/supabase/db";

type SaleType = "office" | "support" | "renewal";

interface LastSaleInfo {
  clientName: string;
  value: number;
  type: SaleType;
  date: string;
}

const ALL_TYPES: SaleType[] = ["office", "support", "renewal"];

type BannerMode = SaleType[] | "hidden" | null;

function sectionsFromPath(pathname: string): BannerMode {
  if (pathname.startsWith("/support-sales")) return ["support"];
  if (pathname.startsWith("/sales")) return ["office"];
  if (pathname.startsWith("/renewals")) return ["renewal"];
  if (pathname.startsWith("/secretary")) return ALL_TYPES;
  if (pathname.startsWith("/support")) return "hidden";
  return null;
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

const TYPE_LABEL: Record<SaleType, string> = {
  office: "مبيعات المكتب",
  support: "مبيعات الدعم",
  renewal: "التجديدات",
};

function SaleRow({ sale }: { sale: LastSaleInfo }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(sale.date));

  useEffect(() => {
    setElapsed(formatElapsed(sale.date));
    const timer = setInterval(() => setElapsed(formatElapsed(sale.date)), 60000);
    return () => clearInterval(timer);
  }, [sale.date]);

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
    <div className={`rounded-xl bg-gradient-to-l ${urgencyColor} border px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap`}>
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

export function LastSaleBanner() {
  const pathname = usePathname();
  const sections = sectionsFromPath(pathname);
  const [sales, setSales] = useState<LastSaleInfo[]>([]);

  useEffect(() => {
    setSales([]);

    if (sections === "hidden") return;

    const requested = sections ?? ALL_TYPES;
    const needDeals = requested.includes("office") || requested.includes("support");
    const needRenewals = requested.includes("renewal");

    Promise.all([
      needDeals ? fetchDeals() : Promise.resolve([]),
      needRenewals ? fetchRenewals() : Promise.resolve([]),
    ])
      .then(([deals, renewals]) => {
        const latestByType: Partial<Record<SaleType, LastSaleInfo>> = {};
        const latestTimeByType: Partial<Record<SaleType, number>> = {};

        for (const d of deals) {
          if (d.stage !== "مكتملة") continue;
          const dealType: SaleType = d.sales_type === "support" ? "support" : "office";
          if (!requested.includes(dealType)) continue;
          const t = new Date(d.close_date || d.updated_at || d.created_at).getTime();
          if (t > (latestTimeByType[dealType] ?? 0)) {
            latestTimeByType[dealType] = t;
            latestByType[dealType] = {
              clientName: d.client_name,
              value: d.deal_value,
              type: dealType,
              date: d.close_date || d.updated_at || d.created_at,
            };
          }
        }

        if (requested.includes("renewal")) {
          for (const r of renewals) {
            if (r.status !== "مكتمل") continue;
            const t = new Date(r.updated_at || r.created_at).getTime();
            if (t > (latestTimeByType.renewal ?? 0)) {
              latestTimeByType.renewal = t;
              latestByType.renewal = {
                clientName: r.customer_name,
                value: r.plan_price,
                type: "renewal",
                date: r.updated_at || r.created_at,
              };
            }
          }
        }

        if (sections && sections.length > 1) {
          const ordered = requested
            .map((t) => latestByType[t])
            .filter((s): s is LastSaleInfo => Boolean(s));
          setSales(ordered);
        } else {
          const newest = Object.values(latestByType)
            .filter((s): s is LastSaleInfo => Boolean(s))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          setSales(newest ? [newest] : []);
        }
      })
      .catch(() => {});
  }, [pathname]);

  if (sales.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-4">
      {sales.map((s) => (
        <SaleRow key={s.type} sale={s} />
      ))}
    </div>
  );
}
