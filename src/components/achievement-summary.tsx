"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { formatMoneyFull } from "@/lib/utils/format";
import {
  Award,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  Calendar,
  Share2,
  Download,
  Loader2,
} from "lucide-react";

type SummaryPeriod = "today" | "week" | "month" | "quarter" | "custom";

interface AchievementItem {
  updated_at: string;
  value: number;
  isCompleted: boolean;
  isCancelled: boolean;
  isContacted: boolean;
  repName?: string;
  planName?: string;
  id: string;
}

interface AchievementSummaryProps {
  items: AchievementItem[];
  allPlans?: string[];
  labels?: {
    completed?: string;
    revenue?: string;
    contacted?: string;
    successRate?: string;
    lostRevenue?: string;
    topRep?: string;
  };
  onFilterChange?: (filter: string | null, ids: Set<string>) => void;
  activeFilter?: string | null;
  filteredCount?: number;
  tableAnchorId?: string;
}

export function AchievementSummary({
  items,
  allPlans,
  labels,
  onFilterChange,
  activeFilter,
  filteredCount,
  tableAnchorId,
}: AchievementSummaryProps) {
  const [period, setPeriod] = useState<SummaryPeriod>("month");
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = useCallback(async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#0c0e14",
        pixelRatio: 2,
        style: { borderRadius: "0" },
      });

      // Convert data URL to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "achievement-summary.png", { type: "image/png" });

      // Try Web Share API first (works on mobile, supports WhatsApp)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "ملخص الإنجازات",
          files: [file],
        });
      } else {
        // Fallback: download the image
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "achievement-summary.png";
        link.click();
      }
    } catch {
      // User cancelled share or error
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  const summary = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    if (period === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "quarter") {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), qMonth, 1);
    } else {
      startDate = customRange.from ? new Date(customRange.from) : new Date(now.getFullYear(), now.getMonth(), 1);
      if (customRange.to) endDate = new Date(customRange.to + "T23:59:59");
    }

    const periodItems = items.filter(i => {
      const updated = new Date(i.updated_at);
      return updated >= startDate && updated <= endDate;
    });

    const completed = periodItems.filter(i => i.isCompleted);
    const cancelled = periodItems.filter(i => i.isCancelled);
    const contacted = periodItems.filter(i => i.isContacted);
    const completedRevenue = completed.reduce((s, i) => s + i.value, 0);
    const lostRevenue = cancelled.reduce((s, i) => s + i.value, 0);
    const avgValue = completed.length > 0 ? Math.round(completedRevenue / completed.length) : 0;
    const successRate = periodItems.length > 0 ? Math.round((completed.length / periodItems.length) * 100) : 0;

    const repMap: Record<string, number> = {};
    completed.forEach(i => { if (i.repName) repMap[i.repName] = (repMap[i.repName] || 0) + 1; });
    const topRep = Object.entries(repMap).sort((a, b) => b[1] - a[1])[0];

    // Plan/package breakdown for completed items
    const planMap: Record<string, { count: number; revenue: number }> = {};
    completed.forEach(i => {
      const plan = i.planName || "بدون باقة";
      if (!planMap[plan]) planMap[plan] = { count: 0, revenue: 0 };
      planMap[plan].count += 1;
      planMap[plan].revenue += i.value;
    });
    const planBreakdown = Object.entries(planMap)
      .map(([plan, data]) => ({ plan, ...data }))
      .sort((a, b) => b.count - a.count);

    // Generate recommendations
    const recommendations: string[] = [];
    if (allPlans && allPlans.length > 0 && completed.length > 0) {
      const completedPlanNames = new Set(Object.keys(planMap));
      const missingPlans = allPlans.filter(p => !completedPlanNames.has(p));
      if (missingPlans.length > 0) {
        recommendations.push(`💡 لم يتحقق أي إنجاز في: ${missingPlans.join("، ")} — ركّز على عرضها للعملاء`);
      }
      const maxCount = Math.max(...planBreakdown.map(p => p.count));
      const weakPlans = planBreakdown.filter(p => p.count > 0 && p.count <= maxCount * 0.3);
      if (weakPlans.length > 0 && missingPlans.length === 0) {
        recommendations.push(`📊 باقات تحتاج تركيز أكثر: ${weakPlans.map(p => p.plan).join("، ")}`);
      }
    } else if (allPlans && allPlans.length > 0 && completed.length === 0 && periodItems.length > 0) {
      recommendations.push(`⚠️ لا يوجد إنجاز في هذه الفترة — حاول إغلاق صفقة واحدة على الأقل`);
    }

    return {
      total: periodItems.length,
      completed: completed.length,
      cancelled: cancelled.length,
      contacted: contacted.length,
      completedRevenue,
      lostRevenue,
      avgValue,
      successRate,
      topRep: topRep ? { name: topRep[0], count: topRep[1] } : null,
      planBreakdown,
      recommendations,
      completedIds: new Set(completed.map(i => i.id)),
      cancelledIds: new Set(cancelled.map(i => i.id)),
      contactedIds: new Set(contacted.map(i => i.id)),
      allIds: new Set(periodItems.map(i => i.id)),
    };
  }, [items, period, customRange]);

  const l = {
    completed: labels?.completed || "مكتمل",
    revenue: labels?.revenue || "إيرادات محققة",
    contacted: labels?.contacted || "تم التواصل",
    successRate: labels?.successRate || "نسبة النجاح",
    lostRevenue: labels?.lostRevenue || "إيرادات مفقودة",
    topRep: labels?.topRep || "صفقة",
  };

  function handleFilter(key: string) {
    if (!onFilterChange) return;
    if (activeFilter === key) {
      onFilterChange(null, new Set());
    } else {
      const ids = key === "completed" || key === "revenue" || key === "success"
        ? summary.completedIds
        : key === "lost" ? summary.cancelledIds
        : key === "contacted" ? summary.contactedIds
        : summary.allIds;
      onFilterChange(key, ids);
      if (tableAnchorId) {
        document.getElementById(tableAnchorId)?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }

  return (
    <div ref={cardRef} className="cc-card rounded-[14px] p-5 border border-cyan/10 bg-gradient-to-l from-cyan/[0.03] to-transparent">
      {/* Header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-cyan" />
          <h3 className="text-sm font-bold text-foreground">ملخص الإنجازات</h3>
          <button
            onClick={handleShare}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-cyan hover:bg-cyan/10 transition-colors disabled:opacity-50"
            title="مشاركة كصورة"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            مشاركة
          </button>
        </div>
        <div className="flex items-center gap-1.5 bg-white/[0.05] rounded-lg p-1 border border-white/[0.06]">
          {([
            { key: "today" as SummaryPeriod, label: "اليوم" },
            { key: "week" as SummaryPeriod, label: "الأسبوع" },
            { key: "month" as SummaryPeriod, label: "الشهر" },
            { key: "quarter" as SummaryPeriod, label: "الربع" },
            { key: "custom" as SummaryPeriod, label: "مخصص" },
          ]).map(p => (
            <button
              key={p.key}
              onClick={() => { setPeriod(p.key); onFilterChange?.(null, new Set()); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                period === p.key
                  ? "bg-cyan text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.10]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/[0.05] border border-white/[0.06]">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 flex-1">
            <input
              type="date"
              value={customRange.from}
              onChange={e => setCustomRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-foreground text-xs focus:outline-none focus:border-cyan/50"
              dir="ltr"
            />
            <span className="text-xs text-muted-foreground">إلى</span>
            <input
              type="date"
              value={customRange.to}
              onChange={e => setCustomRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-foreground text-xs focus:outline-none focus:border-cyan/50"
              dir="ltr"
            />
          </div>
        </div>
      )}

      {/* Active filter indicator */}
      {activeFilter && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-cyan/10 border border-cyan/20">
          <span className="text-xs text-cyan font-medium">🔍 عرض: {
            activeFilter === "completed" ? l.completed :
            activeFilter === "revenue" ? l.revenue :
            activeFilter === "contacted" ? l.contacted :
            activeFilter === "success" ? l.successRate :
            l.lostRevenue
          } {filteredCount !== undefined ? `(${filteredCount} عميل)` : ""}</span>
          <button
            onClick={() => onFilterChange?.(null, new Set())}
            className="mr-auto text-xs text-cyan hover:text-white font-medium px-2 py-1 rounded-md hover:bg-cyan/20 transition-colors"
          >
            ✕ إلغاء الفلتر
          </button>
        </div>
      )}

      {/* Achievement cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
        <button
          onClick={() => handleFilter("completed")}
          className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
            activeFilter === "completed" ? "bg-cc-green/20 border-2 border-cc-green/50 ring-2 ring-cc-green/20" : "bg-cc-green/10 border border-cc-green/20 hover:bg-cc-green/15 hover:scale-[1.02]"
          }`}
        >
          <CheckCircle2 className="w-5 h-5 text-cc-green mx-auto mb-1" />
          <p className="text-2xl font-bold text-cc-green">{summary.completed}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{l.completed}</p>
        </button>
        <button
          onClick={() => handleFilter("revenue")}
          className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
            activeFilter === "revenue" ? "bg-cyan/20 border-2 border-cyan/50 ring-2 ring-cyan/20" : "bg-cyan/10 border border-cyan/20 hover:bg-cyan/15 hover:scale-[1.02]"
          }`}
        >
          <TrendingUp className="w-5 h-5 text-cyan mx-auto mb-1" />
          <p className="text-2xl font-bold text-cyan">{formatMoneyFull(summary.completedRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{l.revenue}</p>
        </button>
        <button
          onClick={() => handleFilter("contacted")}
          className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
            activeFilter === "contacted" ? "bg-cc-purple/20 border-2 border-cc-purple/50 ring-2 ring-cc-purple/20" : "bg-cc-purple/10 border border-cc-purple/20 hover:bg-cc-purple/15 hover:scale-[1.02]"
          }`}
        >
          <Users className="w-5 h-5 text-cc-purple mx-auto mb-1" />
          <p className="text-2xl font-bold text-cc-purple">{summary.contacted}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{l.contacted}</p>
        </button>
        <button
          onClick={() => handleFilter("success")}
          className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
            activeFilter === "success" ? "bg-amber/20 border-2 border-amber/50 ring-2 ring-amber/20" : "bg-amber/10 border border-amber/20 hover:bg-amber/15 hover:scale-[1.02]"
          }`}
        >
          <Zap className="w-5 h-5 text-amber mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber">{summary.successRate}%</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{l.successRate}</p>
        </button>
        <button
          onClick={() => handleFilter("lost")}
          className={`p-3 rounded-[14px] text-center transition-all cursor-pointer col-span-2 md:col-span-1 ${
            activeFilter === "lost" ? "bg-cc-red/20 border-2 border-cc-red/50 ring-2 ring-cc-red/20" : "bg-cc-red/10 border border-cc-red/20 hover:bg-cc-red/15 hover:scale-[1.02]"
          }`}
        >
          <TrendingDown className="w-5 h-5 text-cc-red mx-auto mb-1" />
          <p className="text-2xl font-bold text-cc-red">{formatMoneyFull(summary.lostRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{l.lostRevenue}</p>
        </button>
      </div>

      {/* Progress bar + extra info */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground">معدل الإنجاز</span>
            <span className={`text-xs font-bold ${
              summary.successRate >= 70 ? "text-cc-green" :
              summary.successRate >= 40 ? "text-amber" : "text-cc-red"
            }`}>{summary.successRate}%</span>
          </div>
          <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                summary.successRate >= 70 ? "bg-gradient-to-l from-emerald-400 to-emerald-600" :
                summary.successRate >= 40 ? "bg-gradient-to-l from-amber-400 to-amber-600" :
                "bg-gradient-to-l from-red-400 to-red-600"
              }`}
              style={{ width: `${summary.successRate}%` }}
            />
          </div>
        </div>

        {summary.avgValue > 0 && (
          <div className="text-center px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.06]">
            <p className="text-xs font-bold text-foreground">{formatMoneyFull(summary.avgValue)}</p>
            <p className="text-[10px] text-muted-foreground">متوسط القيمة</p>
          </div>
        )}

        {summary.topRep && (
          <div className="text-center px-3 py-1.5 rounded-lg bg-amber/10 border border-amber/20">
            <p className="text-xs font-bold text-amber">🏆 {summary.topRep.name}</p>
            <p className="text-[10px] text-muted-foreground">{summary.topRep.count} {l.topRep}</p>
          </div>
        )}
      </div>

      {/* Plan/Package breakdown */}
      {summary.planBreakdown.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <p className="text-[11px] text-muted-foreground mb-2.5 font-medium">📦 توزيع الباقات المنجزة</p>
          <div className="flex flex-wrap gap-2">
            {summary.planBreakdown.map(p => (
              <div key={p.plan} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-xs font-bold text-cc-green">{p.count}</span>
                <span className="text-xs text-foreground">{p.plan}</span>
                <span className="text-[10px] text-muted-foreground">({formatMoneyFull(p.revenue)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {summary.recommendations.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {summary.recommendations.map((rec, i) => (
            <div key={i} className="px-3 py-2 rounded-lg bg-amber/[0.06] border border-amber/15 text-xs text-amber">
              {rec}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
