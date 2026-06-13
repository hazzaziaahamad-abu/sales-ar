"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchPageVisits } from "@/lib/supabase/db";
import { BarChart2, Users, Eye, TrendingUp } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/sidebar";

const PAGE_LABEL: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((i) => [i.href, i.label])
);

type Visit = { page: string; user_name: string; visited_at: string };

export default function AnalyticsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    fetchPageVisits(days).then((data) => {
      setVisits(data);
      setLoading(false);
    });
  }, [days]);

  const stats = useMemo(() => {
    const pageCount: Record<string, number> = {};
    const userCount: Record<string, number> = {};
    const userPages: Record<string, Set<string>> = {};

    visits.forEach((v) => {
      pageCount[v.page] = (pageCount[v.page] || 0) + 1;
      userCount[v.user_name] = (userCount[v.user_name] || 0) + 1;
      if (!userPages[v.user_name]) userPages[v.user_name] = new Set();
      userPages[v.user_name].add(v.page);
    });

    const topPages = Object.entries(pageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topUsers = Object.entries(userCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count, pages: userPages[name].size }));

    const uniqueUsers = Object.keys(userCount).length;
    const maxPageVisits = topPages[0]?.[1] || 1;

    return { topPages, topUsers, uniqueUsers, maxPageVisits };
  }, [visits]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-cyan-400" />
            تحليلات الزيارات
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">تتبع نشاط المستخدمين على الموقع</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                days === d
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : "bg-white/[0.04] text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="glass-surface rounded-[14px] p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-muted-foreground font-semibold">إجمالي الزيارات</span>
          </div>
          <p className="text-2xl font-extrabold text-foreground">{loading ? "—" : visits.length.toLocaleString()}</p>
        </div>
        <div className="glass-surface rounded-[14px] p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-muted-foreground font-semibold">مستخدمون نشطون</span>
          </div>
          <p className="text-2xl font-extrabold text-foreground">{loading ? "—" : stats.uniqueUsers}</p>
        </div>
        <div className="glass-surface rounded-[14px] p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground font-semibold">معدل يومي</span>
          </div>
          <p className="text-2xl font-extrabold text-foreground">
            {loading ? "—" : Math.round(visits.length / days).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top pages */}
        <div className="glass-surface rounded-[14px] border border-border p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">أكثر الصفحات زيارة</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />)}</div>
          ) : stats.topPages.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-3">
              {stats.topPages.map(([page, count]) => (
                <div key={page}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-foreground">
                      {PAGE_LABEL[page] || page}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-cyan-400 to-cyan-600"
                      style={{ width: `${Math.round((count / stats.maxPageVisits) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top users */}
        <div className="glass-surface rounded-[14px] border border-border p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">أكثر المستخدمين نشاطاً</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />)}</div>
          ) : stats.topUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد بيانات بعد</p>
          ) : (
            <div className="space-y-2">
              {stats.topUsers.map(({ name, count, pages }, idx) => (
                <div key={name} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                  <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400 text-xs font-bold shrink-0">
                    {name?.[0] || "؟"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                    <p className="text-xs text-muted-foreground">{pages} صفحة مختلفة</p>
                  </div>
                  <span className="text-sm font-bold text-cyan-400">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent visits */}
      <div className="glass-surface rounded-[14px] border border-border p-5">
        <h2 className="text-sm font-bold text-foreground mb-4">آخر الزيارات</h2>
        {loading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-white/[0.04] animate-pulse" />)}</div>
        ) : visits.length === 0 ? (
          <p className="text-muted-foreground text-sm">لا توجد زيارات بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-right pb-2 font-semibold">المستخدم</th>
                  <th className="text-right pb-2 font-semibold">الصفحة</th>
                  <th className="text-right pb-2 font-semibold">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {visits.slice(0, 50).map((v, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 font-medium text-foreground">{v.user_name}</td>
                    <td className="py-2 text-muted-foreground">{PAGE_LABEL[v.page] || v.page}</td>
                    <td className="py-2 text-muted-foreground text-xs font-mono">
                      {new Date(v.visited_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
