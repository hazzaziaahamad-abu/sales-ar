"use client";

import { DEMO_FINANCE } from "@/lib/demo-data";
import { formatMoney, formatPercent } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/stat-card";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarChart } from "@/components/ui/bar-chart";
import {
  Banknote,
  TrendingUp,
  Percent,
  Flame,
} from "lucide-react";

export default function FinancePage() {
  const { arr, mrr, profitMargin, burnRate, costs, monthly } = DEMO_FINANCE;

  const barData = monthly.map((m) => ({
    label: m.month.slice(0, 3),
    values: [
      { value: m.revenue / 1_000_000, color: "#00D4FF", label: "الإيرادات" },
      { value: m.expenses / 1_000_000, color: "#EF4444", label: "المصروفات" },
    ],
  }));

  const donutSegments = costs.map((c) => ({
    label: c.label,
    value: c.value,
    color: c.color,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-green-dim flex items-center justify-center">
          <Banknote className="w-4 h-4 text-cc-green" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">المالية</h1>
          <p className="text-xs text-muted-foreground">
            مراقبة المؤشرات المالية الرئيسية
          </p>
        </div>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          value={formatMoney(arr)}
          label="ARR السنوي"
          color="cyan"
          icon={<Banknote className="w-4 h-4 text-cyan" />}
        />
        <StatCard
          value={formatMoney(mrr)}
          label="MRR الشهري"
          color="green"
          icon={<TrendingUp className="w-4 h-4 text-cc-green" />}
        />
        <StatCard
          value={formatPercent(profitMargin)}
          label="هامش الربح"
          color="purple"
          progress={profitMargin}
          icon={<Percent className="w-4 h-4 text-cc-purple" />}
        />
        <StatCard
          value={formatMoney(burnRate)}
          label="Burn Rate"
          color="red"
          icon={<Flame className="w-4 h-4 text-cc-red" />}
        />
      </div>

      {/* Two charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue vs Expenses bar chart */}
        <div className="cc-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">
            الإيرادات والمصروفات (مليون ر.س)
          </h3>
          <BarChart data={barData} height={280} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-cyan-dim/30 text-center">
              <p className="text-lg font-bold text-cyan">
                {formatMoney(monthly.reduce((s, m) => s + m.revenue, 0))}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                إجمالي الإيرادات
              </p>
            </div>
            <div className="p-3 rounded-lg bg-red-dim/30 text-center">
              <p className="text-lg font-bold text-cc-red">
                {formatMoney(monthly.reduce((s, m) => s + m.expenses, 0))}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                إجمالي المصروفات
              </p>
            </div>
          </div>
        </div>

        {/* Cost distribution donut */}
        <div className="cc-card rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">
            توزيع التكاليف
          </h3>
          <DonutChart
            segments={donutSegments}
            centerValue={formatPercent(100)}
            centerLabel="إجمالي"
          />
          <div className="mt-4 space-y-2">
            {costs.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="text-muted-foreground">{c.label}</span>
                </div>
                <span className="text-foreground font-medium">
                  {c.value}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
