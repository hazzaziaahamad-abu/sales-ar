import type { Deal } from "@/types";

/* ─── Badge Definitions ─── */

export interface Badge {
  id: string;
  label: string;
  emoji: string;
  description: string;
  category: "deals" | "revenue" | "streak" | "special";
  /** Check function — returns true if the rep earned this badge */
  check: (stats: RepStats) => boolean;
}

export interface RepStats {
  name: string;
  totalDeals: number;
  closedDeals: number;
  revenue: number;
  winRate: number;
  avgCycleDays: number;
  biggestDeal: number;
  dealsToday: number;
  streak: number; // consecutive days with a closed deal
  fullPriceCount: number;
}

export interface StarEmployee {
  name: string;
  score: number;
  closedDeals: number;
  revenue: number;
  winRate: number;
  badges: Badge[];
  rank: number;
  trend: "up" | "down" | "same";
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  closedDeals: number;
  revenue: number;
  winRate: number;
  badges: Badge[];
  rank: number;
  prevRank: number | null;
  trend: "up" | "down" | "same";
  streak: number;
}

/* ─── All Available Badges ─── */

export const ALL_BADGES: Badge[] = [
  // Deal count badges
  {
    id: "deal_starter",
    label: "أول صفقة",
    emoji: "🌟",
    description: "أغلق أول صفقة",
    category: "deals",
    check: (s) => s.closedDeals >= 1,
  },
  {
    id: "deal_maker_5",
    label: "صانع صفقات",
    emoji: "⚡",
    description: "5 صفقات مغلقة",
    category: "deals",
    check: (s) => s.closedDeals >= 5,
  },
  {
    id: "deal_master_10",
    label: "محترف المبيعات",
    emoji: "🔥",
    description: "10 صفقات مغلقة",
    category: "deals",
    check: (s) => s.closedDeals >= 10,
  },
  {
    id: "deal_legend_20",
    label: "أسطورة المبيعات",
    emoji: "👑",
    description: "20 صفقة مغلقة",
    category: "deals",
    check: (s) => s.closedDeals >= 20,
  },
  // Revenue badges
  {
    id: "rev_5k",
    label: "نادي الخمسة",
    emoji: "💰",
    description: "إيرادات تجاوزت 5,000 ر.س",
    category: "revenue",
    check: (s) => s.revenue >= 5000,
  },
  {
    id: "rev_10k",
    label: "عشرة آلاف",
    emoji: "💎",
    description: "إيرادات تجاوزت 10,000 ر.س",
    category: "revenue",
    check: (s) => s.revenue >= 10000,
  },
  {
    id: "rev_50k",
    label: "الخمسين ألف",
    emoji: "🏆",
    description: "إيرادات تجاوزت 50,000 ر.س",
    category: "revenue",
    check: (s) => s.revenue >= 50000,
  },
  // Special badges
  {
    id: "big_fish",
    label: "صائد الكبار",
    emoji: "🐋",
    description: "صفقة واحدة فوق 1,000 ر.س",
    category: "special",
    check: (s) => s.biggestDeal >= 1000,
  },
  {
    id: "machine",
    label: "الماكينة",
    emoji: "🤖",
    description: "3 صفقات مغلقة بيوم واحد",
    category: "special",
    check: (s) => s.dealsToday >= 3,
  },
  {
    id: "sniper",
    label: "القناص",
    emoji: "🎯",
    description: "نسبة إغلاق أعلى من 70%",
    category: "special",
    check: (s) => s.winRate >= 70 && s.totalDeals >= 3,
  },
  {
    id: "full_price_hero",
    label: "بطل السعر الكامل",
    emoji: "💪",
    description: "5 صفقات بالسعر الأصلي بدون خصم",
    category: "special",
    check: (s) => s.fullPriceCount >= 5,
  },
  // Streak badges
  {
    id: "streak_3",
    label: "ثلاثية النار",
    emoji: "🔥",
    description: "3 أيام متتالية بإنجاز",
    category: "streak",
    check: (s) => s.streak >= 3,
  },
  {
    id: "streak_5",
    label: "خماسية لا تُوقف",
    emoji: "⭐",
    description: "5 أيام متتالية بإنجاز",
    category: "streak",
    check: (s) => s.streak >= 5,
  },
  {
    id: "streak_10",
    label: "عشرة مستحيلة",
    emoji: "🌟",
    description: "10 أيام متتالية بإنجاز",
    category: "streak",
    check: (s) => s.streak >= 10,
  },
];

/* ─── Scoring Engine ─── */

function computeRepScore(stats: RepStats): number {
  let score = 0;
  // Closed deals (max 35 pts)
  score += Math.min(35, stats.closedDeals * 5);
  // Revenue (max 25 pts)
  score += Math.min(25, (stats.revenue / 10000) * 25);
  // Win rate (max 20 pts)
  score += stats.totalDeals >= 2 ? (stats.winRate / 100) * 20 : 0;
  // Speed (max 10 pts) — faster = more points
  if (stats.avgCycleDays > 0 && stats.closedDeals > 0) {
    score += Math.max(0, 10 - stats.avgCycleDays * 0.5);
  }
  // Streak bonus (max 10 pts)
  score += Math.min(10, stats.streak * 2);
  return Math.min(100, Math.round(score));
}

/* ─── Streak Calculator ─── */

function calculateStreak(deals: Deal[], repName: string): number {
  const closedDeals = deals
    .filter((d) => d.assigned_rep_name?.trim() === repName && d.stage === "مكتملة" && d.updated_at)
    .map((d) => {
      const date = new Date(d.updated_at);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    });

  const uniqueDays = [...new Set(closedDeals)].sort().reverse();
  if (uniqueDays.length === 0) return 0;

  let streak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDay = new Date(uniqueDays[0]);
  lastDay.setHours(0, 0, 0, 0);

  // If last closed deal was more than 1 day ago, streak is broken
  const diffFromToday = Math.floor((today.getTime() - lastDay.getTime()) / 86400000);
  if (diffFromToday > 1) return 0;

  for (let i = 1; i < uniqueDays.length; i++) {
    const curr = new Date(uniqueDays[i - 1]);
    const prev = new Date(uniqueDays[i]);
    const diff = Math.floor((curr.getTime() - prev.getTime()) / 86400000);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/* ─── Build Full Leaderboard ─── */

export function buildLeaderboard(
  deals: Deal[],
  packages?: { name: string; original_price: number }[]
): LeaderboardEntry[] {
  const repMap: Record<string, {
    totalDeals: number;
    closedDeals: number;
    revenue: number;
    cycleDays: number;
    biggestDeal: number;
    dealsToday: number;
    fullPriceCount: number;
  }> = {};

  const today = new Date().toISOString().slice(0, 10);
  const pkgPriceMap = new Map<string, number>();
  packages?.forEach((p) => pkgPriceMap.set(p.name.toLowerCase().trim(), p.original_price));

  for (const deal of deals) {
    const rep = deal.assigned_rep_name?.trim();
    if (!rep) continue;

    if (!repMap[rep]) {
      repMap[rep] = { totalDeals: 0, closedDeals: 0, revenue: 0, cycleDays: 0, biggestDeal: 0, dealsToday: 0, fullPriceCount: 0 };
    }
    const r = repMap[rep];
    r.totalDeals++;
    r.cycleDays += deal.cycle_days || 0;

    if (deal.stage === "مكتملة") {
      r.closedDeals++;
      r.revenue += deal.deal_value;
      if (deal.deal_value > r.biggestDeal) r.biggestDeal = deal.deal_value;

      // Check if closed today
      const updatedDate = deal.updated_at?.slice(0, 10);
      if (updatedDate === today) r.dealsToday++;

      // Check full price
      if (deal.plan) {
        const origPrice = pkgPriceMap.get(deal.plan.toLowerCase().trim());
        if (origPrice && deal.deal_value >= origPrice) r.fullPriceCount++;
      }
    }
  }

  const entries: LeaderboardEntry[] = Object.entries(repMap).map(([name, r]) => {
    const streak = calculateStreak(deals, name);
    const stats: RepStats = {
      name,
      totalDeals: r.totalDeals,
      closedDeals: r.closedDeals,
      revenue: r.revenue,
      winRate: r.totalDeals > 0 ? Math.round((r.closedDeals / r.totalDeals) * 100) : 0,
      avgCycleDays: r.closedDeals > 0 ? Math.round(r.cycleDays / r.totalDeals) : 0,
      biggestDeal: r.biggestDeal,
      dealsToday: r.dealsToday,
      streak,
      fullPriceCount: r.fullPriceCount,
    };

    const score = computeRepScore(stats);
    const badges = ALL_BADGES.filter((b) => b.check(stats));

    return {
      name,
      score,
      closedDeals: r.closedDeals,
      revenue: r.revenue,
      winRate: stats.winRate,
      badges,
      rank: 0,
      prevRank: null,
      trend: "same" as const,
      streak,
    };
  });

  // Sort by score descending
  entries.sort((a, b) => b.score - a.score || b.revenue - a.revenue);

  // Assign ranks
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

  return entries;
}

/**
 * Get the Star Employee (top performer).
 */
export function getStarEmployee(deals: Deal[]): StarEmployee | null {
  const leaderboard = buildLeaderboard(deals);
  if (leaderboard.length === 0) return null;
  const top = leaderboard[0];
  if (top.closedDeals === 0) return null;
  return {
    name: top.name,
    score: top.score,
    closedDeals: top.closedDeals,
    revenue: top.revenue,
    winRate: top.winRate,
    badges: top.badges,
    rank: 1,
    trend: top.trend,
  };
}
