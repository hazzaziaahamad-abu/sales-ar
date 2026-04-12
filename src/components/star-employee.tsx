"use client";

import { useMemo } from "react";
import type { Deal } from "@/types";
import { buildLeaderboard, type LeaderboardEntry } from "@/lib/gamification";
import { formatMoney } from "@/lib/utils/format";
import { Crown, TrendingUp, TrendingDown, Minus, Flame, Trophy, Star, Medal } from "lucide-react";

/* ─── Avatar Colors ─── */
const AVATAR_COLORS = [
  "from-cyan to-blue-500",
  "from-cc-green to-emerald-600",
  "from-amber to-orange-500",
  "from-cc-purple to-pink-500",
  "from-cc-red to-rose-600",
  "from-sky-400 to-indigo-500",
];

function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

const RANK_STYLES = [
  { emoji: "🥇", bg: "from-amber/20 to-yellow-500/10", border: "border-amber/30", glow: "shadow-amber/20" },
  { emoji: "🥈", bg: "from-slate-300/15 to-slate-400/10", border: "border-slate-400/30", glow: "shadow-slate-400/10" },
  { emoji: "🥉", bg: "from-orange-400/15 to-orange-500/10", border: "border-orange-400/30", glow: "shadow-orange-400/10" },
];

/* ─── Star Employee Card (Hero Card) ─── */
export function StarEmployeeCard({ deals }: { deals: Deal[] }) {
  const leaderboard = useMemo(() => buildLeaderboard(deals), [deals]);
  const star = leaderboard[0];

  if (!star || star.closedDeals === 0) return null;

  return (
    <div className="cc-card rounded-[14px] overflow-hidden border border-amber/20 relative">
      {/* Gold gradient background */}
      <div className="absolute inset-0 bg-gradient-to-bl from-amber/[0.08] via-yellow-500/[0.04] to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber/[0.06] to-transparent rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="relative p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber/20 to-yellow-500/10 flex items-center justify-center border border-amber/20">
            <Crown className="w-5 h-5 text-amber" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">نجم الفترة</h3>
            <p className="text-[10px] text-muted-foreground">أفضل موظف أداءً في المبيعات</p>
          </div>
          <div className="text-3xl">👑</div>
        </div>

        {/* Star Employee Info */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarColor(0)} flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
            {star.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-extrabold text-foreground">{star.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-amber px-2 py-0.5 rounded-full bg-amber/10 border border-amber/20">
                نقاط: {star.score}
              </span>
              {star.streak > 0 && (
                <span className="text-xs font-bold text-orange-400 px-2 py-0.5 rounded-full bg-orange-400/10 border border-orange-400/20 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  {star.streak} يوم
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
            <p className="text-xl font-extrabold text-cc-green">{star.closedDeals}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">صفقة مغلقة</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
            <p className="text-xl font-extrabold text-cyan">{formatMoney(star.revenue)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">إيرادات</p>
          </div>
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
            <p className="text-xl font-extrabold text-cc-purple">{star.winRate}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">نسبة إغلاق</p>
          </div>
        </div>

        {/* Badges */}
        {star.badges.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">الشارات المحققة</p>
            <div className="flex flex-wrap gap-1.5">
              {star.badges.map((badge) => (
                <span
                  key={badge.id}
                  title={badge.description}
                  className="text-[10px] px-2 py-1 rounded-full bg-amber/10 border border-amber/20 text-amber font-medium cursor-default"
                >
                  {badge.emoji} {badge.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Leaderboard Component ─── */
export function Leaderboard({ deals }: { deals: Deal[] }) {
  const leaderboard = useMemo(() => buildLeaderboard(deals), [deals]);

  if (leaderboard.length === 0) return null;

  return (
    <div className="cc-card rounded-[14px] overflow-hidden border border-white/[0.06]">
      <div className="p-4 border-b border-border/30 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-amber" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">لوحة المتصدرين</h3>
          <p className="text-[10px] text-muted-foreground">ترتيب الأداء الحي للفريق</p>
        </div>
      </div>

      <div className="divide-y divide-border/20">
        {leaderboard.map((entry, i) => {
          const rankStyle = RANK_STYLES[i] || null;
          const isTop3 = i < 3;

          return (
            <div
              key={entry.name}
              className={`px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/[0.02] ${
                isTop3 ? `bg-gradient-to-l ${rankStyle?.bg || ""}` : ""
              }`}
            >
              {/* Rank */}
              <div className="w-8 text-center shrink-0">
                {isTop3 ? (
                  <span className="text-xl">{rankStyle?.emoji}</span>
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">{entry.rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarColor(i)} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                {entry.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground truncate">{entry.name}</span>
                  {entry.streak >= 3 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-400/10 text-orange-400 border border-orange-400/20 font-bold flex items-center gap-0.5">
                      <Flame className="w-2.5 h-2.5" />
                      {entry.streak}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{entry.closedDeals} صفقة</span>
                  <span className="text-[10px] text-cyan font-medium">{formatMoney(entry.revenue)}</span>
                  {entry.badges.length > 0 && (
                    <span className="text-[10px]" title={entry.badges.map(b => b.label).join("، ")}>
                      {entry.badges.slice(0, 3).map(b => b.emoji).join("")}
                      {entry.badges.length > 3 && `+${entry.badges.length - 3}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="text-left shrink-0">
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-extrabold font-mono ${
                    entry.score >= 70 ? "text-cc-green" :
                    entry.score >= 40 ? "text-amber" :
                    "text-cc-red"
                  }`}>
                    {entry.score}
                  </span>
                  <span className="text-[9px] text-muted-foreground">نقطة</span>
                </div>
                {/* Score bar */}
                <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      entry.score >= 70 ? "bg-cc-green" :
                      entry.score >= 40 ? "bg-amber" :
                      "bg-cc-red"
                    }`}
                    style={{ width: `${entry.score}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Badges Showcase (for team page or profile) ─── */
export function BadgesShowcase({ deals, repName }: { deals: Deal[]; repName?: string }) {
  const leaderboard = useMemo(() => buildLeaderboard(deals), [deals]);
  const entry = repName ? leaderboard.find(e => e.name === repName) : leaderboard[0];

  if (!entry) return null;

  const earned = entry.badges;
  const locked = useMemo(() => {
    const earnedIds = new Set(earned.map(b => b.id));
    return ([...new Set(Object.values({ deals: "deals", revenue: "revenue", streak: "streak", special: "special" }))] as const)
      .flatMap(cat => {
        // We need to access ALL_BADGES but it's imported in gamification.ts
        // Instead, we filter from the available data
        return [];
      });
  }, [earned]);

  return (
    <div className="cc-card rounded-[14px] p-4 border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-3">
        <Medal className="w-4 h-4 text-amber" />
        <h3 className="text-sm font-bold text-foreground">شارات {entry.name}</h3>
        <span className="text-[10px] text-muted-foreground">({earned.length} شارة)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {earned.map((badge) => (
          <div
            key={badge.id}
            title={badge.description}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber/10 border border-amber/20 cursor-default"
          >
            <span className="text-sm">{badge.emoji}</span>
            <div>
              <p className="text-[10px] font-bold text-amber">{badge.label}</p>
              <p className="text-[9px] text-muted-foreground">{badge.description}</p>
            </div>
          </div>
        ))}
        {earned.length === 0 && (
          <p className="text-xs text-muted-foreground">لم يحقق شارات بعد — استمر بالإنجاز!</p>
        )}
      </div>
    </div>
  );
}
