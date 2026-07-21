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

/**
 * يختار تاريخ الإتمام الفعلي: أول مرشّح صالح وغير مستقبلي (بهامش دقيقة للانحراف الزمني).
 * يحمي البانر من تواريخ مُدخلة بالغلط في المستقبل (مثل payment_date خاطئ) فلا تظهر «مضى الآن»
 * ولا تتصدّر كأحدث صفقة.
 */
function pickCompletedDate(...candidates: (string | null | undefined)[]): string {
  const nowMs = Date.now() + 60000; // تسامح دقيقة واحدة
  const valid = candidates.filter((c): c is string => Boolean(c));
  const past = valid.find((c) => {
    const t = new Date(c).getTime();
    return !Number.isNaN(t) && t <= nowMs;
  });
  return past ?? valid[valid.length - 1] ?? new Date().toISOString();
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
    <div className={`rounded-xl bg-gradient-to-l ${urgencyColor} border px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 sm:gap-3 overflow-hidden`}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Trophy className={`w-4 h-4 ${iconColor} shrink-0`} />
        <div className="flex items-center gap-1.5 flex-wrap text-xs min-w-0">
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-muted-foreground shrink-0 font-medium">{TYPE_LABEL[sale.type]}</span>
          <span className="font-bold text-foreground truncate max-w-[80px] sm:max-w-none">{sale.clientName}</span>
          <span className={`font-bold ${textColor} shrink-0`}>{formatMoney(sale.value)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Clock className={`w-3.5 h-3.5 ${iconColor}`} />
        <span className={`text-[11px] sm:text-xs font-bold ${textColor} whitespace-nowrap`}>مضى {elapsed}</span>
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
          const saleDate = pickCompletedDate(d.close_date, d.updated_at, d.created_at);
          const t = new Date(saleDate).getTime();
          if (t > (latestTimeByType[dealType] ?? 0)) {
            latestTimeByType[dealType] = t;
            latestByType[dealType] = {
              clientName: d.client_name,
              value: d.deal_value,
              type: dealType,
              date: saleDate,
            };
          }
        }

        if (requested.includes("renewal")) {
          for (const r of renewals) {
            if (r.status !== "مكتمل") continue;
            const saleDate = pickCompletedDate(r.payment_date, r.updated_at, r.created_at);
            const t = new Date(saleDate).getTime();
            if (t > (latestTimeByType.renewal ?? 0)) {
              latestTimeByType.renewal = t;
              latestByType.renewal = {
                clientName: r.customer_name,
                value: r.plan_price,
                type: "renewal",
                date: saleDate,
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
