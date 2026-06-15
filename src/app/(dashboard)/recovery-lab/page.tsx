"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Renewal } from "@/types";
import { fetchRenewals } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { formatMoney, formatMoneyFull, formatPhone } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FlaskConical,
  TestTube,
  Microscope,
  Atom,
  Beaker,
  Activity,
  Sparkles,
  Phone,
  Gift,
  Percent,
  GraduationCap,
  MessageSquare,
  CalendarClock,
  RefreshCw,
  Lightbulb,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Filter,
  Flame,
  Target,
  Users,
  DollarSign,
  Clock,
  Star,
  Wand2,
  ChevronDown,
  Trophy,
  Crown,
  Award,
  Medal,
  Zap,
  Rocket,
  Shield,
  Search,
} from "lucide-react";

const CLOSED_FOREVER_REASONS = new Set([
  "اغلاق المحل",
  "مو حاب يجدد بدون سبب",
  "الادارة رفضت",
]);

const REASON_RECOVERABILITY: Record<string, number> = {
  "ارتفاع السعر": 0.85,
  "قلة الاستخدام": 0.9,
  "التحوّل لمنافس": 0.6,
  "نقص ميزات": 0.7,
  "مشكلات تقنية": 0.95,
  "اغلاق المحل": 0.05,
  "مو حاب يجدد بدون سبب": 0.5,
  "الادارة رفضت": 0.55,
  "أخرى": 0.5,
};

type ExperimentKey =
  | "discount"
  | "free_month"
  | "manager_call"
  | "training"
  | "gift"
  | "feature_demo"
  | "payment_plan"
  | "exit_interview";

const EXPERIMENTS: Record<
  ExperimentKey,
  {
    label: string;
    icon: React.ReactNode;
    hex: string;
    desc: string;
    script: string;
  }
> = {
  discount: {
    label: "خصم استعادة",
    icon: <Percent className="w-4 h-4" />,
    hex: "#F59E0B",
    desc: "خصم محدود المدة (15-25%) لإغراء العميل بالعودة",
    script:
      "نقدّر شراكتنا السابقة معكم. لدينا عرض خاص لاستعادتكم: خصم [النسبة]% على التجديد لمدة 48 ساعة فقط. هل نقدر نرتب التفاصيل؟",
  },
  free_month: {
    label: "شهر مجاني",
    icon: <Gift className="w-4 h-4" />,
    hex: "#10B981",
    desc: "شهر تجريبي مجاني بدون التزام لإثبات القيمة",
    script:
      "نحب نمنحكم شهر مجاني عشان تجربون التحسينات الجديدة. بدون التزام، وإذا ما أضافت لكم قيمة نوقّف بدون أسئلة.",
  },
  manager_call: {
    label: "مكالمة المدير",
    icon: <Phone className="w-4 h-4" />,
    hex: "#8B5CF6",
    desc: "اتصال شخصي من المدير لإعادة بناء الثقة",
    script:
      "أنا [اسم المدير]، حبيت أتواصل معكم شخصياً. عملاؤنا المميزون مهمون لنا، ونحب نفهم كيف نقدر نخدمكم بشكل أفضل.",
  },
  training: {
    label: "جلسة تدريب",
    icon: <GraduationCap className="w-4 h-4" />,
    hex: "#7da6ff",
    desc: "تدريب مجاني لفريق العميل لرفع الاستفادة",
    script:
      "نرتب لكم جلسة تدريب مجانية لفريقكم — في ميزات تقدر تساعدكم وتنعكس مباشرة على الإنتاجية.",
  },
  gift: {
    label: "هدية عودة",
    icon: <Sparkles className="w-4 h-4" />,
    hex: "#EC4899",
    desc: "هدية ترحيب رمزية تقديراً للشراكة",
    script:
      "إذا قررتوا تعودون، عندنا هدية ترحيب خاصة لكم تقدير لشراكتنا السابقة.",
  },
  feature_demo: {
    label: "عرض ميزات جديدة",
    icon: <Lightbulb className="w-4 h-4" />,
    hex: "#00D4FF",
    desc: "استعراض ميزات أُضيفت بعد المغادرة",
    script:
      "أضفنا ميزات جديدة بعد ما فارقتونا — نحب نريكم إياها في عرض سريع، أكيد بتغيّر تجربتكم.",
  },
  payment_plan: {
    label: "خطة دفع مرنة",
    icon: <CalendarClock className="w-4 h-4" />,
    hex: "#7da6ff",
    desc: "تقسيط مريح للمبلغ السنوي",
    script:
      "نقدر نوفّر لكم تقسيط مريح بدلاً من الدفعة الكاملة. هل هذا الخيار يناسبكم؟",
  },
  exit_interview: {
    label: "مقابلة خروج",
    icon: <MessageSquare className="w-4 h-4" />,
    hex: "#8B5CF6",
    desc: "فهم أعمق لسبب المغادرة وإبقاء الباب مفتوحاً",
    script:
      "هل عندكم 5 دقائق نسمع منكم؟ ملاحظاتكم بتساعدنا نتحسّن، وبابنا مفتوح لكم متى ما حبيتوا ترجعون.",
  },
};

const REASON_TO_EXPERIMENTS: Record<string, ExperimentKey[]> = {
  "ارتفاع السعر": ["discount", "payment_plan", "free_month"],
  "قلة الاستخدام": ["training", "feature_demo", "free_month"],
  "التحوّل لمنافس": ["discount", "feature_demo", "manager_call"],
  "نقص ميزات": ["feature_demo", "manager_call", "exit_interview"],
  "مشكلات تقنية": ["manager_call", "free_month", "discount"],
  "اغلاق المحل": ["exit_interview", "gift"],
  "مو حاب يجدد بدون سبب": ["manager_call", "exit_interview", "gift"],
  "الادارة رفضت": ["manager_call", "discount", "exit_interview"],
  "أخرى": ["exit_interview", "manager_call", "discount"],
};

type LabStage =
  | "cooling"
  | "diagnosis"
  | "experiment"
  | "followup"
  | "recovered"
  | "lost";

const STAGE_ORDER: LabStage[] = [
  "cooling",
  "diagnosis",
  "experiment",
  "followup",
  "recovered",
  "lost",
];

const STAGE_META: Record<
  LabStage,
  { label: string; hex: string; desc: string; icon: React.ReactNode }
> = {
  cooling: {
    label: "خانة التبريد",
    hex: "#7da6ff",
    desc: "إلغاء حديث (آخر 7 أيام)",
    icon: <Clock className="w-4 h-4" />,
  },
  diagnosis: {
    label: "التشخيص",
    hex: "#F59E0B",
    desc: "جاهز للتحليل واختيار التجربة",
    icon: <Microscope className="w-4 h-4" />,
  },
  experiment: {
    label: "التجربة",
    hex: "#8B5CF6",
    desc: "تجربة قيد التشغيل",
    icon: <FlaskConical className="w-4 h-4" />,
  },
  followup: {
    label: "المتابعة",
    hex: "#00D4FF",
    desc: "بانتظار رد العميل",
    icon: <RefreshCw className="w-4 h-4" />,
  },
  recovered: {
    label: "تم الاستعادة",
    hex: "#10B981",
    desc: "العميل عاد",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  lost: {
    label: "مفقود نهائياً",
    hex: "#EF4444",
    desc: "لا يوجد فرصة حالياً",
    icon: <XCircle className="w-4 h-4" />,
  },
};

type LabRecord = {
  stage: LabStage;
  experiment?: ExperimentKey;
  note?: string;
  outcome?: "pending" | "recovered" | "lost";
  updatedAt: string;
};

const LAB_STORE_KEY = "recovery-lab:v1";

function loadLab(): Record<string, LabRecord> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LAB_STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLab(state: Record<string, LabRecord>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAB_STORE_KEY, JSON.stringify(state));
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function daysSince(date: string): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(
    0,
    Math.ceil((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  );
}

function recoverabilityForReason(reason?: string): number {
  if (!reason) return REASON_RECOVERABILITY["أخرى"];
  return REASON_RECOVERABILITY[reason] ?? REASON_RECOVERABILITY["أخرى"];
}

function recencyMultiplier(days: number): number {
  if (days <= 14) return 1.0;
  if (days <= 30) return 0.92;
  if (days <= 60) return 0.8;
  if (days <= 90) return 0.65;
  if (days <= 180) return 0.45;
  return 0.25;
}

function valueMultiplier(price: number, maxPrice: number): number {
  if (maxPrice <= 0) return 0.7;
  return 0.65 + (price / maxPrice) * 0.35;
}

function recoveryScore(r: Renewal, maxPrice: number): number {
  const reasonM = recoverabilityForReason(r.cancel_reason);
  const recencyM = recencyMultiplier(daysSince(r.renewal_date));
  const valueM = valueMultiplier(r.plan_price || 0, maxPrice);
  return Math.round(clamp(100 * reasonM * recencyM * valueM, 0, 100));
}

function autoStage(r: Renewal): LabStage {
  if (CLOSED_FOREVER_REASONS.has(r.cancel_reason || "")) return "lost";
  if (daysSince(r.renewal_date) <= 7) return "cooling";
  return "diagnosis";
}

function recommendedExperiment(reason?: string): ExperimentKey {
  const list = REASON_TO_EXPERIMENTS[reason || "أخرى"] ?? [
    "exit_interview",
    "manager_call",
  ];
  return list[0];
}

/* ─── TestTube visual ─── */
function TubeViz({
  fill,
  hex,
  size = 64,
}: {
  fill: number;
  hex: string;
  size?: number;
}) {
  const pct = clamp(fill, 0, 1);
  const fillH = pct * 60;
  return (
    <svg width={size * 0.55} height={size} viewBox="0 0 36 64">
      <defs>
        <linearGradient id={`tt-${hex.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={hex} stopOpacity="0.95" />
          <stop offset="100%" stopColor={hex} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d="M11 2 v44 a7 7 0 0 0 14 0 v-44"
        stroke="var(--border)"
        strokeWidth="1.5"
        fill="rgba(255,255,255,0.02)"
      />
      <clipPath id={`tt-clip-${hex.replace("#", "")}`}>
        <path d="M11 2 v44 a7 7 0 0 0 14 0 v-44" />
      </clipPath>
      <rect
        x="11"
        y={62 - fillH}
        width="14"
        height={fillH}
        clipPath={`url(#tt-clip-${hex.replace("#", "")})`}
        fill={`url(#tt-${hex.replace("#", "")})`}
      >
        <animate
          attributeName="height"
          from="0"
          to={fillH}
          dur="0.9s"
          fill="freeze"
        />
      </rect>
      <line x1="9" y1="2" x2="27" y2="2" stroke={hex} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── DNA-style score bar ─── */
function ScoreBar({ score, hex }: { score: number; hex: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${clamp(score, 0, 100)}%`,
            background: `linear-gradient(90deg, ${hex}, ${hex}cc)`,
          }}
        />
      </div>
      <span className="font-mono text-[13px] font-bold w-8 text-left" style={{ color: hex }}>
        {score}
      </span>
    </div>
  );
}

function scoreHex(score: number): string {
  if (score >= 70) return "#10B981";
  if (score >= 40) return "#F59E0B";
  return "#EF4444";
}

/* ═══════════════════════════════════════════════════════════════════════════
 * GAMIFICATION ENGINE — XP, Levels, Ranks, Streak, Achievements, Activity
 * ═══════════════════════════════════════════════════════════════════════════ */

const XP_REWARDS = {
  APPLY: 25,
  FOLLOWUP: 15,
  RECOVER_BASE: 250,
  RECOVER_HOT: 500,
  RECOVER_LEGENDARY: 750,
  DAILY_MISSION: 100,
  STRETCH_GOAL: 50,
} as const;

const RANKS: { minLevel: number; name: string; hex: string; icon: React.ReactNode }[] = [
  { minLevel: 1, name: "مبتدئ", hex: "#7da6ff", icon: <Shield className="w-4 h-4" /> },
  { minLevel: 3, name: "محقق", hex: "#00D4FF", icon: <Microscope className="w-4 h-4" /> },
  { minLevel: 5, name: "خبير الاستعادة", hex: "#8B5CF6", icon: <FlaskConical className="w-4 h-4" /> },
  { minLevel: 8, name: "قائد المعمل", hex: "#F59E0B", icon: <Crown className="w-4 h-4" /> },
  { minLevel: 12, name: "أسطورة الاستعادة", hex: "#EF4444", icon: <Trophy className="w-4 h-4" /> },
];

function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (250 * (level - 1) * level) / 2;
}

function levelFromXp(xp: number): number {
  let lvl = 1;
  while (totalXpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

function rankForLevel(level: number) {
  let r = RANKS[0];
  for (const candidate of RANKS) {
    if (level >= candidate.minLevel) r = candidate;
  }
  return r;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00").getTime();
  const db = new Date(b + "T00:00:00").getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

type Activity = {
  ts: number;
  type: "apply" | "followup" | "recovered" | "lost" | "mission" | "achievement" | "streak";
  text: string;
  xp: number;
  hex: string;
};

type DailyStats = {
  date: string;
  applied: number;
  recovered: number;
  missionAwarded: boolean;
  stretchAwarded: boolean;
};

type EmployeeProgress = {
  xp: number;
  totalApplied: number;
  totalRecovered: number;
  totalSaved: number;
  streakDays: number;
  longestStreak: number;
  lastActivityDate: string;
  recentOutcomes: ("recovered" | "lost" | "pending")[];
  experimentCounts: Record<ExperimentKey, number>;
  unlockedAchievements: string[];
  activity: Activity[];
  daily: DailyStats;
};

const EMPLOYEE_STORE_KEY = "recovery-lab:employee:v1";
const LAB_REWARDS_KEY = "recovery-lab:rewards:v1";

function emptyEmployee(): EmployeeProgress {
  return {
    xp: 0,
    totalApplied: 0,
    totalRecovered: 0,
    totalSaved: 0,
    streakDays: 0,
    longestStreak: 0,
    lastActivityDate: "",
    recentOutcomes: [],
    experimentCounts: {
      discount: 0,
      free_month: 0,
      manager_call: 0,
      training: 0,
      gift: 0,
      feature_demo: 0,
      payment_plan: 0,
      exit_interview: 0,
    },
    unlockedAchievements: [],
    activity: [],
    daily: { date: todayStr(), applied: 0, recovered: 0, missionAwarded: false, stretchAwarded: false },
  };
}

function loadEmployee(): EmployeeProgress {
  if (typeof window === "undefined") return emptyEmployee();
  try {
    const raw = localStorage.getItem(EMPLOYEE_STORE_KEY);
    if (!raw) return emptyEmployee();
    const parsed = JSON.parse(raw) as EmployeeProgress;
    return { ...emptyEmployee(), ...parsed, experimentCounts: { ...emptyEmployee().experimentCounts, ...(parsed.experimentCounts || {}) }, daily: parsed.daily || emptyEmployee().daily };
  } catch {
    return emptyEmployee();
  }
}

function saveEmployee(e: EmployeeProgress) {
  if (typeof window === "undefined") return;
  localStorage.setItem(EMPLOYEE_STORE_KEY, JSON.stringify(e));
}

function loadRewardsLog(): Record<string, { applyAwarded?: boolean; recoverAwarded?: boolean }> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LAB_REWARDS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveRewardsLog(state: Record<string, { applyAwarded?: boolean; recoverAwarded?: boolean }>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAB_REWARDS_KEY, JSON.stringify(state));
}

/* ─── Daily mission target (scales with level) ─── */
function dailyMissionTarget(level: number): { mission: number; stretch: number } {
  if (level <= 2) return { mission: 1, stretch: 3 };
  if (level <= 5) return { mission: 2, stretch: 5 };
  if (level <= 9) return { mission: 3, stretch: 7 };
  return { mission: 4, stretch: 10 };
}

/* ─── Achievements ─── */
type Achievement = {
  id: string;
  name: string;
  desc: string;
  hex: string;
  icon: React.ReactNode;
  check: (e: EmployeeProgress) => boolean;
};

const ACHIEVEMENTS: Achievement[] = [
  { id: "first_experiment", name: "أول تجربة", desc: "طبّقت أول تجربة في المعمل", hex: "#7da6ff", icon: <FlaskConical className="w-4 h-4" />, check: (e) => e.totalApplied >= 1 },
  { id: "first_recovery", name: "أول استعادة", desc: "أعدت أول عميل", hex: "#10B981", icon: <Sparkles className="w-4 h-4" />, check: (e) => e.totalRecovered >= 1 },
  { id: "golden_hunter", name: "صياد ذهبي", desc: "5 استعادات", hex: "#F59E0B", icon: <Star className="w-4 h-4" />, check: (e) => e.totalRecovered >= 5 },
  { id: "legendary_hunter", name: "صياد أسطوري", desc: "20 استعادة", hex: "#EF4444", icon: <Crown className="w-4 h-4" />, check: (e) => e.totalRecovered >= 20 },
  { id: "discount_master", name: "بطل الخصومات", desc: "10 تجارب خصم", hex: "#F59E0B", icon: <Percent className="w-4 h-4" />, check: (e) => e.experimentCounts.discount >= 10 },
  { id: "diplomat", name: "دبلوماسي", desc: "5 مكالمات مدير", hex: "#8B5CF6", icon: <Phone className="w-4 h-4" />, check: (e) => e.experimentCounts.manager_call >= 5 },
  { id: "diverse", name: "متعدد المواهب", desc: "استخدمت 5 تجارب مختلفة", hex: "#00D4FF", icon: <Atom className="w-4 h-4" />, check: (e) => Object.values(e.experimentCounts).filter((c) => c > 0).length >= 5 },
  { id: "streak_3", name: "ستريك 3 أيام", desc: "نشاط 3 أيام متتالية", hex: "#F59E0B", icon: <Flame className="w-4 h-4" />, check: (e) => e.longestStreak >= 3 },
  { id: "streak_7", name: "ستريك أسبوعي", desc: "نشاط 7 أيام متتالية", hex: "#EF4444", icon: <Flame className="w-4 h-4" />, check: (e) => e.longestStreak >= 7 },
  { id: "streak_30", name: "ستريك أسطوري", desc: "نشاط 30 يوم متتالي", hex: "#EC4899", icon: <Flame className="w-4 h-4" />, check: (e) => e.longestStreak >= 30 },
  { id: "saved_10k", name: "أنقذت 10,000", desc: "استعدت إيرادات 10K+", hex: "#10B981", icon: <DollarSign className="w-4 h-4" />, check: (e) => e.totalSaved >= 10000 },
  { id: "saved_100k", name: "أنقذت 100,000", desc: "استعدت إيرادات 100K+", hex: "#10B981", icon: <Trophy className="w-4 h-4" />, check: (e) => e.totalSaved >= 100000 },
  { id: "machine", name: "آلة الإنتاج", desc: "10 تجارب في يوم واحد", hex: "#F59E0B", icon: <Zap className="w-4 h-4" />, check: (e) => e.daily.applied >= 10 },
  { id: "level_5", name: "خبير", desc: "وصلت للمستوى 5", hex: "#8B5CF6", icon: <Award className="w-4 h-4" />, check: (e) => levelFromXp(e.xp) >= 5 },
  { id: "level_10", name: "نخبة", desc: "وصلت للمستوى 10", hex: "#EF4444", icon: <Medal className="w-4 h-4" />, check: (e) => levelFromXp(e.xp) >= 10 },
];

/* ─── On-fire detection (3+ recovered in a row) ─── */
function isOnFire(recent: ("recovered" | "lost" | "pending")[]): boolean {
  if (recent.length < 3) return false;
  return recent.slice(0, 3).every((o) => o === "recovered");
}

/* ─── Animated Counter ─── */
function AnimatedNumber({
  value,
  duration = 700,
  format,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = (typeof window !== "undefined" ? (window as unknown as { __anRef?: Map<string, number> }) : null);
  void prevRef;

  useEffect(() => {
    const start = display;
    const end = value;
    if (start === end) return;
    const startTime = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{format ? format(display) : display.toLocaleString()}</>;
}

/* ─── Confetti burst ─── */
function ConfettiBurst({ trigger }: { trigger: number }) {
  if (trigger === 0) return null;
  const colors = ["#10B981", "#F59E0B", "#7da6ff", "#EC4899", "#8B5CF6", "#00D4FF"];
  const pieces = Array.from({ length: 60 }).map((_, i) => {
    const c = colors[i % colors.length];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.4;
    const duration = 1.6 + Math.random() * 1.2;
    const size = 6 + Math.random() * 8;
    const rotate = Math.random() * 360;
    return (
      <span
        key={`${trigger}-${i}`}
        className="rl-confetti"
        style={{
          left: `${left}%`,
          background: c,
          width: size,
          height: size * 0.4,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          transform: `rotate(${rotate}deg)`,
        }}
      />
    );
  });
  return (
    <div key={trigger} className="rl-confetti-overlay" aria-hidden>
      {pieces}
    </div>
  );
}

/* ─── On-fire badge ─── */
function OnFireBadge() {
  return (
    <span className="rl-on-fire inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-extrabold">
      <Flame className="w-3.5 h-3.5 rl-flame" />
      على النار — 3 استعادات متتالية
    </span>
  );
}

/* ─── Hero Card ─── */
function HeroCard({
  employee,
  name,
  onFire,
}: {
  employee: EmployeeProgress;
  name: string;
  onFire: boolean;
}) {
  const level = levelFromXp(employee.xp);
  const rank = rankForLevel(level);
  const xpForCurrent = totalXpForLevel(level);
  const xpForNext = totalXpForLevel(level + 1);
  const xpInLevel = employee.xp - xpForCurrent;
  const xpNeeded = xpForNext - xpForCurrent;
  const pct = Math.min(100, (xpInLevel / xpNeeded) * 100);
  const target = dailyMissionTarget(level);
  const dailyApplied = employee.daily.date === todayStr() ? employee.daily.applied : 0;
  const dailyRecovered = employee.daily.date === todayStr() ? employee.daily.recovered : 0;

  return (
    <div className="cc-card rounded-[14px] p-5 relative overflow-hidden" style={{ border: `1px solid ${rank.hex}33` }}>
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at 20% 0%, ${rank.hex}22 0%, transparent 50%), radial-gradient(circle at 80% 100%, #8B5CF622 0%, transparent 50%)`,
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="rl-avatar w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold font-mono text-2xl shrink-0"
              style={{
                background: `linear-gradient(135deg, ${rank.hex}33, ${rank.hex}11)`,
                border: `2px solid ${rank.hex}`,
                boxShadow: `0 0 24px ${rank.hex}44`,
                color: rank.hex,
              }}
            >
              {level}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold text-foreground">
                  {name || "بطل المعمل"}
                </h2>
                {onFire && <OnFireBadge />}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[13px] font-bold" style={{ color: rank.hex }}>
                {rank.icon}
                <span>{rank.name}</span>
                <span className="text-muted-foreground font-normal">· المستوى {level}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <HeroStat icon={<Flame className="w-3.5 h-3.5" />} label="ستريك" value={`${employee.streakDays} يوم`} hex="#F59E0B" />
            <HeroStat icon={<Sparkles className="w-3.5 h-3.5" />} label="استعادات" value={employee.totalRecovered.toString()} hex="#10B981" />
            <HeroStat
              icon={<DollarSign className="w-3.5 h-3.5" />}
              label="أُنقذ"
              valueNode={
                <AnimatedNumber value={employee.totalSaved} format={(n) => formatMoney(n)} />
              }
              hex="#7da6ff"
            />
          </div>
        </div>

        {/* XP bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[12px] font-bold mb-1.5">
            <span className="text-muted-foreground">
              تجربة (XP) — <AnimatedNumber value={employee.xp} /> /
              {" "}
              {xpForNext.toLocaleString()}
            </span>
            <span style={{ color: rank.hex }}>
              {Math.round(xpInLevel)}/{xpNeeded} للمستوى {level + 1}
            </span>
          </div>
          <div className="rl-xp-track relative h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="rl-xp-fill absolute inset-y-0 right-0 rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${rank.hex}, ${rank.hex}cc)`,
                boxShadow: `0 0 12px ${rank.hex}88`,
              }}
            />
          </div>
        </div>

        {/* Daily mission */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <MissionTile
            label="مهمة اليوم"
            current={dailyRecovered}
            target={target.mission}
            unit="استعادة"
            xp={XP_REWARDS.DAILY_MISSION}
            hex="#10B981"
            icon={<Target className="w-4 h-4" />}
          />
          <MissionTile
            label="هدف إضافي"
            current={dailyApplied}
            target={target.stretch}
            unit="تجربة"
            xp={XP_REWARDS.STRETCH_GOAL}
            hex="#F59E0B"
            icon={<Rocket className="w-4 h-4" />}
          />
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
  valueNode,
  hex,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
  hex: string;
}) {
  return (
    <div className="flex flex-col items-center min-w-[70px]">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold">
        <span style={{ color: hex }}>{icon}</span>
        {label}
      </div>
      <div className="text-sm font-extrabold font-mono mt-0.5" style={{ color: hex }}>
        {valueNode ?? value}
      </div>
    </div>
  );
}

function MissionTile({
  label,
  current,
  target,
  unit,
  xp,
  hex,
  icon,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  xp: number;
  hex: string;
  icon: React.ReactNode;
}) {
  const pct = Math.min(100, (current / target) * 100);
  const done = current >= target;
  return (
    <div
      className="rounded-xl p-3 relative overflow-hidden"
      style={{
        background: done ? `${hex}22` : "var(--card)",
        border: `1px solid ${done ? hex : "var(--border)"}`,
      }}
    >
      {done && (
        <div className="absolute -top-1 -left-1 text-[11px] font-extrabold px-1.5 py-0.5 rounded" style={{ background: hex, color: "#0a0e1a" }}>
          ✓ +{xp} XP
        </div>
      )}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: hex }}>
          {icon}
          {label}
        </div>
        <div className="text-[13px] font-mono font-extrabold" style={{ color: hex }}>
          {current}/{target} {unit}
        </div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: hex, boxShadow: done ? `0 0 8px ${hex}` : undefined }}
        />
      </div>
    </div>
  );
}

/* ─── Activity Feed ─── */
function ActivityFeed({ items }: { items: Activity[] }) {
  return (
    <div className="cc-card rounded-[14px] border border-white/[0.06] p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-cyan-dim flex items-center justify-center">
          <Activity className="w-4 h-4 text-cyan" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">سجل البطولة</h2>
          <p className="text-[12px] text-muted-foreground">آخر أنشطتك في المعمل</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-[13px] text-muted-foreground">
            لم تبدأ بعد!
            <br />
            افتح أول عميل وابدأ مغامرتك
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[320px] pr-1">
          {items.slice(0, 20).map((a, i) => (
            <ActivityItem key={`${a.ts}-${i}`} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityItem({ a }: { a: Activity }) {
  const icons: Record<Activity["type"], React.ReactNode> = {
    apply: <FlaskConical className="w-3.5 h-3.5" />,
    followup: <RefreshCw className="w-3.5 h-3.5" />,
    recovered: <Sparkles className="w-3.5 h-3.5" />,
    lost: <XCircle className="w-3.5 h-3.5" />,
    mission: <Target className="w-3.5 h-3.5" />,
    achievement: <Trophy className="w-3.5 h-3.5" />,
    streak: <Flame className="w-3.5 h-3.5" />,
  };
  const ago = relativeTime(a.ts);
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${a.hex}22`, color: a.hex }}
      >
        {icons[a.type]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-foreground truncate">{a.text}</div>
        <div className="text-[11px] text-muted-foreground">{ago}</div>
      </div>
      {a.xp > 0 && (
        <div className="text-[12px] font-extrabold font-mono shrink-0" style={{ color: a.hex }}>
          +{a.xp}
        </div>
      )}
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "الآن";
  const min = Math.floor(sec / 60);
  if (min < 60) return `قبل ${min} د`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr} س`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `قبل ${day} يوم`;
  return new Date(ts).toLocaleDateString();
}

/* ─── Achievement toast ─── */
function AchievementToast({ ach, onDone }: { ach: Achievement; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="rl-toast" style={{ borderColor: ach.hex, boxShadow: `0 0 24px ${ach.hex}66` }}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${ach.hex}33`, color: ach.hex }}
      >
        <Trophy className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[12px] text-muted-foreground font-bold">إنجاز جديد فُتح!</div>
        <div className="text-sm font-extrabold" style={{ color: ach.hex }}>
          {ach.name}
        </div>
        <div className="text-[12px] text-muted-foreground">{ach.desc}</div>
      </div>
      <div className="flex items-center gap-1 text-[12px] font-extrabold shrink-0" style={{ color: ach.hex }}>
        <Sparkles className="w-3 h-3" />
        +50 XP
      </div>
    </div>
  );
}

/* ─── Inline keyframes / styles ─── */
function RecoveryLabStyles() {
  return (
    <style>{`
      @keyframes rl-confetti-fall {
        0% { transform: translateY(-20vh) rotate(0deg); opacity: 1; }
        100% { transform: translateY(120vh) rotate(720deg); opacity: 0; }
      }
      .rl-confetti-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 60;
        overflow: hidden;
      }
      .rl-confetti {
        position: absolute;
        top: -5vh;
        border-radius: 2px;
        animation-name: rl-confetti-fall;
        animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
        animation-fill-mode: forwards;
      }
      @keyframes rl-flame-pulse {
        0%, 100% { transform: scale(1); filter: drop-shadow(0 0 4px #F59E0B); }
        50% { transform: scale(1.2); filter: drop-shadow(0 0 10px #EF4444); }
      }
      .rl-flame {
        animation: rl-flame-pulse 0.9s ease-in-out infinite;
        color: #F59E0B;
      }
      @keyframes rl-on-fire-bg {
        0%, 100% { background: linear-gradient(90deg, #F59E0B33, #EF444433); }
        50% { background: linear-gradient(90deg, #EF444444, #F59E0B44); }
      }
      .rl-on-fire {
        animation: rl-on-fire-bg 1.2s ease-in-out infinite;
        color: #EF4444;
        border: 1px solid #EF444466;
      }
      @keyframes rl-float-xp {
        0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
        15% { transform: translate(-50%, -10px) scale(1.1); opacity: 1; }
        70% { transform: translate(-50%, -60px) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -110px) scale(0.9); opacity: 0; }
      }
      .rl-floating-xp {
        position: fixed;
        top: 25%;
        left: 50%;
        font-size: 32px;
        font-weight: 900;
        font-family: ui-monospace, monospace;
        text-shadow: 0 0 24px currentColor;
        z-index: 70;
        pointer-events: none;
        animation: rl-float-xp 1.8s ease-out forwards;
      }
      @keyframes rl-avatar-glow {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.15); }
      }
      .rl-avatar { animation: rl-avatar-glow 2.5s ease-in-out infinite; }
      @keyframes rl-xp-shine {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .rl-xp-fill::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%);
        background-size: 200% 100%;
        animation: rl-xp-shine 2.5s linear infinite;
      }
      @keyframes rl-toast-in {
        0% { transform: translateX(-120%); opacity: 0; }
        15% { transform: translateX(8%); opacity: 1; }
        25% { transform: translateX(0); opacity: 1; }
        85% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(-120%); opacity: 0; }
      }
      .rl-toast {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--card);
        border-radius: 12px;
        border: 2px solid;
        max-width: 360px;
        animation: rl-toast-in 4s ease-in-out forwards;
        pointer-events: auto;
      }
    `}</style>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function RecoveryLabPage() {
  const { activeOrgId: orgId, user } = useAuth();
  const { activeMonthIndex, filterCutoff } = useTopbarControls();

  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lab, setLab] = useState<Record<string, LabRecord>>({});

  const [stageFilter, setStageFilter] = useState<LabStage | "all">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [scoreBand, setScoreBand] = useState<"all" | "hot" | "warm" | "cold">(
    "all"
  );
  const [sortKey, setSortKey] = useState<"score" | "value" | "recent">("score");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeRenewal, setActiveRenewal] = useState<Renewal | null>(null);
  const [draftExperiment, setDraftExperiment] = useState<ExperimentKey | "">("");
  const [draftNote, setDraftNote] = useState("");
  const [draftOutcome, setDraftOutcome] =
    useState<"pending" | "recovered" | "lost">("pending");

  /* Gamification state */
  const [employee, setEmployee] = useState<EmployeeProgress>(emptyEmployee());
  const [confettiKey, setConfettiKey] = useState(0);
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; id: number; hex: string } | null>(null);

  useEffect(() => {
    setLab(loadLab());
    setEmployee(loadEmployee());
  }, []);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetchRenewals()
      .then((r) => setRenewals(r))
      .finally(() => setLoading(false));
  }, [orgId]);

  const monthRenewals = useMemo(() => {
    if (filterCutoff)
      return renewals.filter((r) => new Date(r.renewal_date) >= filterCutoff);
    if (activeMonthIndex)
      return renewals.filter(
        (r) => new Date(r.renewal_date).getMonth() + 1 === activeMonthIndex.month
      );
    return renewals;
  }, [renewals, filterCutoff, activeMonthIndex]);

  /* Lost customers = the lab's input pool */
  const lostPool = useMemo(
    () => monthRenewals.filter((r) => r.status === "ملغي بسبب"),
    [monthRenewals]
  );

  const maxPrice = useMemo(
    () => lostPool.reduce((m, r) => Math.max(m, r.plan_price || 0), 0),
    [lostPool]
  );

  type Enriched = Renewal & {
    score: number;
    stage: LabStage;
    suggested: ExperimentKey;
    days: number;
    record?: LabRecord;
  };

  const enriched: Enriched[] = useMemo(() => {
    return lostPool.map((r) => {
      const rec = lab[r.id];
      const stage: LabStage = rec?.stage ?? autoStage(r);
      return {
        ...r,
        score: recoveryScore(r, maxPrice),
        stage,
        suggested: recommendedExperiment(r.cancel_reason),
        days: daysSince(r.renewal_date),
        record: rec,
      };
    });
  }, [lostPool, maxPrice, lab]);

  const stageCounts = useMemo(() => {
    const c: Record<LabStage, number> = {
      cooling: 0,
      diagnosis: 0,
      experiment: 0,
      followup: 0,
      recovered: 0,
      lost: 0,
    };
    enriched.forEach((e) => {
      c[e.stage]++;
    });
    return c;
  }, [enriched]);

  const reasonsBreakdown = useMemo(() => {
    const map: Record<string, { count: number; revenue: number }> = {};
    lostPool.forEach((r) => {
      const k = r.cancel_reason || "أخرى";
      if (!map[k]) map[k] = { count: 0, revenue: 0 };
      map[k].count++;
      map[k].revenue += r.plan_price || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [lostPool]);

  const experimentUsage = useMemo(() => {
    const u: Record<ExperimentKey, { applied: number; recovered: number }> = {
      discount: { applied: 0, recovered: 0 },
      free_month: { applied: 0, recovered: 0 },
      manager_call: { applied: 0, recovered: 0 },
      training: { applied: 0, recovered: 0 },
      gift: { applied: 0, recovered: 0 },
      feature_demo: { applied: 0, recovered: 0 },
      payment_plan: { applied: 0, recovered: 0 },
      exit_interview: { applied: 0, recovered: 0 },
    };
    Object.values(lab).forEach((r) => {
      if (r.experiment) {
        u[r.experiment].applied++;
        if (r.outcome === "recovered") u[r.experiment].recovered++;
      }
    });
    return Object.entries(u)
      .map(([k, v]) => ({
        key: k as ExperimentKey,
        applied: v.applied,
        recovered: v.recovered,
        rate: v.applied > 0 ? (v.recovered / v.applied) * 100 : 0,
      }))
      .sort((a, b) => b.applied - a.applied);
  }, [lab]);

  /* Hero metrics */
  const metrics = useMemo(() => {
    const lostCount = enriched.length;
    const recoverable = enriched.filter(
      (e) => !CLOSED_FOREVER_REASONS.has(e.cancel_reason || "")
    );
    const recoverableRevenue = recoverable.reduce(
      (s, e) => s + (e.plan_price || 0),
      0
    );
    const recoveredCount = enriched.filter(
      (e) => e.stage === "recovered"
    ).length;
    const recoveryRate = lostCount > 0 ? (recoveredCount / lostCount) * 100 : 0;
    const golden = recoverable.filter((e) => e.score >= 70).length;
    return {
      lostCount,
      recoverableRevenue,
      recoveryRate,
      golden,
      recoverableCount: recoverable.length,
    };
  }, [enriched]);

  /* Filtering + sorting for the table */
  const filtered = useMemo(() => {
    let list = enriched.slice();
    if (stageFilter !== "all") list = list.filter((e) => e.stage === stageFilter);
    if (reasonFilter !== "all")
      list = list.filter((e) => (e.cancel_reason || "أخرى") === reasonFilter);
    if (scoreBand === "hot") list = list.filter((e) => e.score >= 70);
    else if (scoreBand === "warm")
      list = list.filter((e) => e.score >= 40 && e.score < 70);
    else if (scoreBand === "cold") list = list.filter((e) => e.score < 40);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((e) => e.customer_name.toLowerCase().includes(q) || (e.customer_phone && e.customer_phone.replace(/\s+/g, "").includes(q.replace(/\s+/g, ""))));
    }

    if (sortKey === "score") list.sort((a, b) => b.score - a.score);
    else if (sortKey === "value")
      list.sort((a, b) => (b.plan_price || 0) - (a.plan_price || 0));
    else list.sort((a, b) => a.days - b.days);
    return list;
  }, [enriched, stageFilter, reasonFilter, scoreBand, sortKey, searchQuery]);

  const goldenList = useMemo(
    () =>
      enriched
        .filter(
          (e) =>
            !CLOSED_FOREVER_REASONS.has(e.cancel_reason || "") && e.score >= 70
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [enriched]
  );

  /* ─── Modal handlers ─── */
  const openLab = useCallback(
    (r: Enriched) => {
      setActiveRenewal(r);
      const rec = lab[r.id];
      setDraftExperiment(rec?.experiment ?? r.suggested);
      setDraftNote(rec?.note ?? "");
      setDraftOutcome(rec?.outcome ?? "pending");
    },
    [lab]
  );

  const closeLab = () => {
    setActiveRenewal(null);
    setDraftExperiment("");
    setDraftNote("");
    setDraftOutcome("pending");
  };

  /* ─── Reward / progress engine ─── */
  function awardProgress(opts: {
    renewal: Renewal;
    experiment: ExperimentKey;
    outcome: "pending" | "recovered" | "lost";
    isFollowup?: boolean;
    score: number;
  }): { gained: number; hex: string } {
    const rewards = loadRewardsLog();
    const renewalRewards = rewards[opts.renewal.id] ?? {};
    let gained = 0;
    const today = todayStr();

    const e: EmployeeProgress = {
      ...employee,
      experimentCounts: { ...employee.experimentCounts },
      activity: [...employee.activity],
      recentOutcomes: [...employee.recentOutcomes],
      daily:
        employee.daily.date === today
          ? { ...employee.daily }
          : { date: today, applied: 0, recovered: 0, missionAwarded: false, stretchAwarded: false },
    };

    /* Streak logic */
    if (e.lastActivityDate !== today) {
      const gap = e.lastActivityDate ? diffDays(e.lastActivityDate, today) : 999;
      if (gap === 1) {
        e.streakDays = e.streakDays + 1;
      } else {
        e.streakDays = 1;
      }
      e.longestStreak = Math.max(e.longestStreak, e.streakDays);
      e.lastActivityDate = today;
      if (e.streakDays >= 2) {
        e.activity.unshift({
          ts: Date.now(),
          type: "streak",
          text: `أكملت ستريك ${e.streakDays} أيام`,
          xp: 0,
          hex: "#F59E0B",
        });
      }
    }

    /* Apply XP (one-time per renewal) */
    if (!renewalRewards.applyAwarded) {
      const xpAmt = opts.isFollowup ? XP_REWARDS.FOLLOWUP : XP_REWARDS.APPLY;
      gained += xpAmt;
      e.totalApplied += 1;
      e.daily.applied += 1;
      e.experimentCounts[opts.experiment] = (e.experimentCounts[opts.experiment] ?? 0) + 1;
      e.activity.unshift({
        ts: Date.now(),
        type: opts.isFollowup ? "followup" : "apply",
        text: `${opts.isFollowup ? "نقلت إلى المتابعة" : "طبّقت تجربة"} · ${opts.renewal.customer_name}`,
        xp: xpAmt,
        hex: "#7da6ff",
      });
      renewalRewards.applyAwarded = true;
    }

    /* Recovery XP (one-time per renewal) */
    if (opts.outcome === "recovered" && !renewalRewards.recoverAwarded) {
      const xpAmt =
        opts.score >= 85
          ? XP_REWARDS.RECOVER_LEGENDARY
          : opts.score >= 70
            ? XP_REWARDS.RECOVER_HOT
            : XP_REWARDS.RECOVER_BASE;
      gained += xpAmt;
      e.totalRecovered += 1;
      e.daily.recovered += 1;
      e.totalSaved += opts.renewal.plan_price || 0;
      e.recentOutcomes = ["recovered" as const, ...e.recentOutcomes].slice(0, 5);
      e.activity.unshift({
        ts: Date.now(),
        type: "recovered",
        text: `استعدت ${opts.renewal.customer_name}!`,
        xp: xpAmt,
        hex: "#10B981",
      });
      renewalRewards.recoverAwarded = true;
    } else if (opts.outcome === "lost") {
      e.recentOutcomes = ["lost" as const, ...e.recentOutcomes].slice(0, 5);
    } else if (opts.outcome === "pending") {
      e.recentOutcomes = ["pending" as const, ...e.recentOutcomes].slice(0, 5);
    }

    /* Daily mission completion */
    const target = dailyMissionTarget(levelFromXp(e.xp + gained));
    if (!e.daily.missionAwarded && e.daily.recovered >= target.mission) {
      gained += XP_REWARDS.DAILY_MISSION;
      e.daily.missionAwarded = true;
      e.activity.unshift({
        ts: Date.now(),
        type: "mission",
        text: `أنجزت مهمة اليوم (${target.mission} استعادات)`,
        xp: XP_REWARDS.DAILY_MISSION,
        hex: "#10B981",
      });
    }
    if (!e.daily.stretchAwarded && e.daily.applied >= target.stretch) {
      gained += XP_REWARDS.STRETCH_GOAL;
      e.daily.stretchAwarded = true;
      e.activity.unshift({
        ts: Date.now(),
        type: "mission",
        text: `أنجزت الهدف الإضافي (${target.stretch} تجارب)`,
        xp: XP_REWARDS.STRETCH_GOAL,
        hex: "#F59E0B",
      });
    }

    e.xp += gained;
    e.activity = e.activity.slice(0, 50);

    /* Achievement detection */
    const newAch: Achievement[] = [];
    for (const a of ACHIEVEMENTS) {
      if (!e.unlockedAchievements.includes(a.id) && a.check(e)) {
        e.unlockedAchievements.push(a.id);
        e.xp += 50;
        e.activity.unshift({
          ts: Date.now(),
          type: "achievement",
          text: `إنجاز جديد: ${a.name}`,
          xp: 50,
          hex: a.hex,
        });
        newAch.push(a);
      }
    }
    e.activity = e.activity.slice(0, 50);

    rewards[opts.renewal.id] = renewalRewards;
    saveRewardsLog(rewards);
    setEmployee(e);
    saveEmployee(e);

    if (newAch.length > 0) {
      setAchievementQueue((q) => [...q, ...newAch]);
    }

    return {
      gained,
      hex: opts.outcome === "recovered" ? "#10B981" : "#7da6ff",
    };
  }

  const applyExperiment = () => {
    if (!activeRenewal || !draftExperiment) return;
    const stage: LabStage =
      draftOutcome === "recovered"
        ? "recovered"
        : draftOutcome === "lost"
          ? "lost"
          : "experiment";
    const next: Record<string, LabRecord> = {
      ...lab,
      [activeRenewal.id]: {
        stage,
        experiment: draftExperiment as ExperimentKey,
        note: draftNote.trim() || undefined,
        outcome: draftOutcome,
        updatedAt: new Date().toISOString(),
      },
    };
    setLab(next);
    saveLab(next);

    const score = recoveryScore(activeRenewal, maxPrice);
    const reward = awardProgress({
      renewal: activeRenewal,
      experiment: draftExperiment as ExperimentKey,
      outcome: draftOutcome,
      score,
    });

    if (draftOutcome === "recovered") {
      setConfettiKey((k) => k + 1);
    }
    if (reward.gained > 0) {
      setFloatingXp({ amount: reward.gained, id: Date.now(), hex: reward.hex });
      setTimeout(() => setFloatingXp(null), 1800);
    }
    closeLab();
  };

  const moveToFollowup = () => {
    if (!activeRenewal) return;
    const next: Record<string, LabRecord> = {
      ...lab,
      [activeRenewal.id]: {
        ...(lab[activeRenewal.id] ?? {}),
        stage: "followup",
        experiment: (draftExperiment || activeRenewal.cancel_reason) as ExperimentKey,
        note: draftNote.trim() || undefined,
        outcome: "pending",
        updatedAt: new Date().toISOString(),
      },
    };
    setLab(next);
    saveLab(next);

    if (draftExperiment) {
      const score = recoveryScore(activeRenewal, maxPrice);
      const reward = awardProgress({
        renewal: activeRenewal,
        experiment: draftExperiment as ExperimentKey,
        outcome: "pending",
        score,
        isFollowup: true,
      });
      if (reward.gained > 0) {
        setFloatingXp({ amount: reward.gained, id: Date.now(), hex: reward.hex });
        setTimeout(() => setFloatingXp(null), 1800);
      }
    }
    closeLab();
  };

  const resetExperiment = () => {
    if (!activeRenewal) return;
    const next = { ...lab };
    delete next[activeRenewal.id];
    setLab(next);
    saveLab(next);
    closeLab();
  };

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-80 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[14px]" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-[14px]" />
        <Skeleton className="h-96 rounded-[14px]" />
      </div>
    );
  }

  const onFire = isOnFire(employee.recentOutcomes);
  const unlockedSet = new Set(employee.unlockedAchievements);

  return (
    <div className="space-y-6 p-1 relative">
      <RecoveryLabStyles />
      <ConfettiBurst trigger={confettiKey} />

      {/* Achievement toasts */}
      <div className="fixed top-20 left-4 z-50 space-y-2 pointer-events-none">
        {achievementQueue.slice(0, 3).map((ach) => (
          <AchievementToast
            key={ach.id}
            ach={ach}
            onDone={() => setAchievementQueue((q) => q.filter((x) => x.id !== ach.id))}
          />
        ))}
      </div>

      {/* Floating XP gain */}
      {floatingXp && (
        <div className="rl-floating-xp" style={{ color: floatingXp.hex }}>
          +{floatingXp.amount} XP
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-purple-dim flex items-center justify-center ring-1 ring-white/8 relative overflow-hidden">
          <FlaskConical className="w-5 h-5 text-cc-purple relative z-10" />
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-transparent" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            معمل استعادة العملاء
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-purple-dim text-cc-purple">
              LAB
            </span>
          </h1>
          <p className="text-[13px] text-muted-foreground">
            معمل تفاعلي لتحويل العملاء اللي ما جدّدوا إلى عملاء عائدين عبر تجارب مدروسة
          </p>
        </div>
      </div>

      {/* ═══ HERO ROW (Card + Activity Feed) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <HeroCard employee={employee} name={user?.name ?? ""} onFire={onFire} />
        </div>
        <div className="lg:col-span-4">
          <ActivityFeed items={employee.activity} />
        </div>
      </div>

      {/* Achievements ribbon */}
      <div className="cc-card rounded-[14px] border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-amber-dim flex items-center justify-center">
            <Trophy className="w-4 h-4 text-amber" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-foreground">الإنجازات</h2>
            <p className="text-[12px] text-muted-foreground">
              فُتح {employee.unlockedAchievements.length} من {ACHIEVEMENTS.length}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedSet.has(a.id);
            return (
              <div
                key={a.id}
                className="rounded-xl p-2.5 flex flex-col items-center gap-1.5 text-center transition-all"
                style={{
                  background: "var(--card)",
                  border: `1px solid ${unlocked ? a.hex : "var(--border)"}`,
                  opacity: unlocked ? 1 : 0.45,
                  boxShadow: unlocked ? `0 0 12px ${a.hex}33` : "none",
                }}
                title={a.desc}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{
                    background: unlocked ? `${a.hex}22` : "var(--border)",
                    color: unlocked ? a.hex : "var(--muted-foreground)",
                  }}
                >
                  {unlocked ? a.icon : <Shield className="w-4 h-4" />}
                </div>
                <div className="text-[11px] font-bold text-foreground leading-tight line-clamp-2">
                  {a.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ HERO STATS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="عملاء لم يجدّدوا"
          value={metrics.lostCount.toString()}
          color="red"
          icon={<Users className="w-5 h-5 text-cc-red" />}
          subtext={`${metrics.recoverableCount} قابل للاستعادة`}
        />
        <StatCard
          label="إيرادات قابلة للاستعادة"
          value={formatMoney(metrics.recoverableRevenue)}
          color="amber"
          icon={<DollarSign className="w-5 h-5 text-amber" />}
          subtext={formatMoneyFull(metrics.recoverableRevenue)}
        />
        <StatCard
          label="فرص ذهبية"
          value={metrics.golden.toString()}
          color="green"
          icon={<Star className="w-5 h-5 text-cc-green" />}
          subtext="درجة استعادة 70+"
          tooltip="عملاء ذو فرصة عودة عالية بناءً على السبب والمدة والقيمة"
        />
        <StatCard
          label="معدل الاستعادة"
          value={`${metrics.recoveryRate.toFixed(0)}%`}
          color={metrics.recoveryRate >= 25 ? "green" : metrics.recoveryRate >= 10 ? "amber" : "red"}
          icon={<RefreshCw className="w-5 h-5 text-cc-blue" />}
          progress={metrics.recoveryRate}
          subtext="من إجمالي العملاء المفقودين"
        />
      </div>

      {/* ═══ THE REACTOR (Pipeline) ═══ */}
      <div className="cc-card rounded-[14px] border border-white/[0.06] p-5 relative overflow-hidden">
        <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-purple-dim opacity-40 blur-3xl" />
        <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-blue-dim opacity-30 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-purple-dim flex items-center justify-center">
              <Atom className="w-4 h-4 text-cc-purple" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">مفاعل الاستعادة</h2>
              <p className="text-[12px] text-muted-foreground">
                مراحل تدفق العملاء داخل المعمل — من التبريد إلى الاستعادة
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STAGE_ORDER.map((s, i) => {
              const meta = STAGE_META[s];
              const count = stageCounts[s];
              const total = enriched.length;
              const fill = total > 0 ? count / total : 0;
              const active = stageFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStageFilter(active ? "all" : s)}
                  className="group relative rounded-xl p-3 transition-all duration-200 flex flex-col items-center gap-1.5"
                  style={{
                    backgroundColor: "var(--card)",
                    border: `1px solid ${active ? meta.hex : "var(--border)"}`,
                    boxShadow: active ? `0 0 24px ${meta.hex}33` : "none",
                  }}
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-bold w-full justify-center" style={{ color: meta.hex }}>
                    {meta.icon}
                    <span>{meta.label}</span>
                  </div>
                  <TubeViz fill={fill} hex={meta.hex} size={56} />
                  <div className="text-center">
                    <div className="text-lg font-extrabold font-mono" style={{ color: meta.hex }}>
                      {count}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-tight">
                      {meta.desc}
                    </div>
                  </div>
                  {i < STAGE_ORDER.length - 1 && (
                    <div className="hidden sm:block absolute top-1/2 -left-2 -translate-y-1/2 z-10">
                      <ArrowLeft className="w-3 h-3 text-muted-foreground/40" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {stageFilter !== "all" && (
            <div className="mt-3 flex items-center gap-2 text-[13px]">
              <span className="text-muted-foreground">تصفية نشطة:</span>
              <span
                className="px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: `${STAGE_META[stageFilter].hex}22`,
                  color: STAGE_META[stageFilter].hex,
                }}
              >
                {STAGE_META[stageFilter].label}
              </span>
              <button
                onClick={() => setStageFilter("all")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══ GOLDEN OPPORTUNITIES STRIP ═══ */}
      {goldenList.length > 0 && (
        <div className="cc-card rounded-[14px] border border-cc-green/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-green-dim flex items-center justify-center">
              <Flame className="w-4 h-4 text-cc-green" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">الفرص الذهبية</h2>
              <p className="text-[12px] text-muted-foreground">
                أعلى 5 عملاء فرصة عودتهم عالية — ابدأ من هنا
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {goldenList.map((g) => {
              const exp = EXPERIMENTS[g.suggested];
              return (
                <button
                  key={g.id}
                  onClick={() => openLab(g)}
                  className="group relative rounded-xl p-3 text-right transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = scoreHex(g.score);
                    e.currentTarget.style.boxShadow = `0 0 18px ${scoreHex(g.score)}22`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="text-xs font-bold text-foreground line-clamp-1">
                      {g.customer_name}
                    </div>
                    <span
                      className="text-[12px] font-extrabold font-mono px-1.5 rounded"
                      style={{
                        color: scoreHex(g.score),
                        background: `${scoreHex(g.score)}22`,
                      }}
                    >
                      {g.score}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted-foreground mb-2">
                    {g.cancel_reason || "—"} · {g.days} يوم · {formatMoney(g.plan_price)}
                  </div>
                  <ScoreBar score={g.score} hex={scoreHex(g.score)} />
                  <div
                    className="mt-2 flex items-center gap-1 text-[12px] font-semibold"
                    style={{ color: exp.hex }}
                  >
                    {exp.icon}
                    <span>{exp.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ DIAGNOSIS ARENA + EXPERIMENT LEADERBOARD ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 cc-card rounded-[14px] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-amber-dim flex items-center justify-center">
              <Microscope className="w-4 h-4 text-amber" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">حلبة التشخيص</h2>
              <p className="text-[12px] text-muted-foreground">
                توزيع أسباب عدم التجديد + التجربة الموصى بها لكل سبب
              </p>
            </div>
          </div>
          {reasonsBreakdown.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8">
              لا يوجد عملاء غير مجدّدين في هذه الفترة
            </div>
          ) : (
            <div className="space-y-2.5">
              {reasonsBreakdown.map(([reason, info]) => {
                const tactics = REASON_TO_EXPERIMENTS[reason] ?? [
                  "exit_interview",
                ];
                const total = lostPool.length;
                const pct = total > 0 ? (info.count / total) * 100 : 0;
                const recover = recoverabilityForReason(reason);
                const active = reasonFilter === reason;
                return (
                  <button
                    key={reason}
                    onClick={() =>
                      setReasonFilter(active ? "all" : reason)
                    }
                    className="w-full text-right rounded-xl p-3 transition-all duration-200"
                    style={{
                      background: "var(--card)",
                      border: `1px solid ${active ? "#F59E0B" : "var(--border)"}`,
                      boxShadow: active ? "0 0 18px rgba(245,158,11,0.18)" : "none",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {reason}
                        </span>
                        <span
                          className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: `${
                              recover >= 0.8
                                ? "#10B981"
                                : recover >= 0.5
                                  ? "#F59E0B"
                                  : "#EF4444"
                            }22`,
                            color:
                              recover >= 0.8
                                ? "#10B981"
                                : recover >= 0.5
                                  ? "#F59E0B"
                                  : "#EF4444",
                          }}
                        >
                          قابلية {(recover * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px]">
                        <span className="text-muted-foreground">
                          {formatMoney(info.revenue)}
                        </span>
                        <span className="font-mono font-bold text-foreground">
                          {info.count}
                        </span>
                      </div>
                    </div>
                    <div
                      className="w-full h-1 rounded-full overflow-hidden mb-2"
                      style={{ background: "var(--border)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: "#F59E0B" }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tactics.map((t) => {
                        const exp = EXPERIMENTS[t];
                        return (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              background: `${exp.hex}1f`,
                              color: exp.hex,
                              border: `1px solid ${exp.hex}33`,
                            }}
                          >
                            {exp.icon}
                            {exp.label}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 cc-card rounded-[14px] border border-white/[0.06] p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-blue-dim flex items-center justify-center">
              <Beaker className="w-4 h-4 text-cc-blue" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">حقيبة التجارب</h2>
              <p className="text-[12px] text-muted-foreground">
                تتبع التجارب المُطبَّقة ومعدل نجاح كل واحدة
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {experimentUsage.map((u) => {
              const exp = EXPERIMENTS[u.key];
              return (
                <div
                  key={u.key}
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${exp.hex}1f`, color: exp.hex }}
                  >
                    {exp.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground">
                      {exp.label}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>طُبّقت: {u.applied}</span>
                      <span>·</span>
                      <span className="text-cc-green">
                        استعيد: {u.recovered}
                      </span>
                      {u.applied > 0 && (
                        <>
                          <span>·</span>
                          <span className="font-mono font-bold" style={{ color: scoreHex(u.rate) }}>
                            {u.rate.toFixed(0)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className="w-16 h-1.5 rounded-full overflow-hidden"
                    style={{ background: "var(--border)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${u.applied > 0 ? clamp((u.applied / Math.max(...experimentUsage.map((x) => x.applied), 1)) * 100, 0, 100) : 0}%`,
                        background: exp.hex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground flex items-start gap-1">
            <Activity className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              التجارب تُحفظ محلياً على هذا الجهاز (localStorage). لربطها بقاعدة البيانات يحتاج جدول جديد.
            </span>
          </div>
        </div>
      </div>

      {/* ═══ RECOVERY ALGORITHM TABLE ═══ */}
      <div className="cc-card rounded-[14px] border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-cyan-dim flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-cyan" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-foreground">
              خوارزمية الاستعادة
            </h2>
            <p className="text-[12px] text-muted-foreground">
              قائمة كاملة بالعملاء المفقودين مرتبة حسب فرصة العودة — اضغط على أي عميل لفتح المعمل
            </p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          {(["all", "hot", "warm", "cold"] as const).map((b) => {
            const active = scoreBand === b;
            const labels: Record<typeof b, string> = {
              all: "الكل",
              hot: "ساخن (70+)",
              warm: "متوسط (40-69)",
              cold: "بارد (<40)",
            };
            const colors: Record<typeof b, string> = {
              all: "#7da6ff",
              hot: "#10B981",
              warm: "#F59E0B",
              cold: "#EF4444",
            };
            return (
              <button
                key={b}
                onClick={() => setScoreBand(b)}
                className="text-[12px] font-bold px-2.5 py-1 rounded-full transition-all"
                style={{
                  background: active ? `${colors[b]}33` : "var(--card)",
                  color: active ? colors[b] : "var(--foreground)",
                  border: `1px solid ${active ? colors[b] : "var(--border)"}`,
                }}
              >
                {labels[b]}
              </button>
            );
          })}
          <div className="flex-1" />
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم العميل أو الجوال..."
              className="h-7 text-[13px] w-44 rounded-lg bg-white/[0.06] border border-border pr-8 pl-2.5 py-1 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan/50"
            />
          </div>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
            <SelectTrigger className="h-7 text-[13px] w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">ترتيب: الدرجة</SelectItem>
              <SelectItem value="value">ترتيب: قيمة الباقة</SelectItem>
              <SelectItem value="recent">ترتيب: الأحدث</SelectItem>
            </SelectContent>
          </Select>
          {reasonFilter !== "all" && (
            <button
              onClick={() => setReasonFilter("all")}
              className="text-[12px] font-bold px-2.5 py-1 rounded-full bg-amber-dim text-amber border border-amber/30 flex items-center gap-1"
            >
              {reasonFilter}
              <XCircle className="w-3 h-3" />
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-10">
            لا يوجد عملاء يطابقون التصفية الحالية
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((e) => {
              const exp = EXPERIMENTS[e.suggested];
              const stageMeta = STAGE_META[e.stage];
              const hex = scoreHex(e.score);
              return (
                <button
                  key={e.id}
                  onClick={() => openLab(e)}
                  className="w-full grid grid-cols-12 items-center gap-2 p-2.5 rounded-xl transition-all duration-200 text-right"
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                  onMouseEnter={(ev) => {
                    ev.currentTarget.style.borderColor = hex;
                    ev.currentTarget.style.transform = "translateX(-2px)";
                  }}
                  onMouseLeave={(ev) => {
                    ev.currentTarget.style.borderColor = "var(--border)";
                    ev.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono font-extrabold text-[13px]"
                      style={{ background: `${hex}1f`, color: hex }}
                    >
                      {e.score}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-foreground truncate">
                        {e.customer_name}
                      </div>
                      <div className="text-[12px] text-muted-foreground truncate">
                        {e.customer_phone ? formatPhone(e.customer_phone) : e.client_code}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2 text-[12px]">
                    <div className="text-muted-foreground">السبب</div>
                    <div className="font-semibold text-foreground truncate">
                      {e.cancel_reason || "—"}
                    </div>
                  </div>

                  <div className="col-span-3 sm:col-span-2 text-[12px]">
                    <div className="text-muted-foreground">المدة</div>
                    <div className="font-mono font-bold text-foreground">
                      {e.days} يوم
                    </div>
                  </div>

                  <div className="col-span-3 sm:col-span-2 text-[12px]">
                    <div className="text-muted-foreground">القيمة</div>
                    <div className="font-mono font-bold text-foreground">
                      {formatMoney(e.plan_price)}
                    </div>
                  </div>

                  <div className="col-span-8 sm:col-span-2 flex items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1 text-[12px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        background: `${stageMeta.hex}1f`,
                        color: stageMeta.hex,
                      }}
                    >
                      {stageMeta.icon}
                      {stageMeta.label}
                    </span>
                  </div>

                  <div className="col-span-4 sm:col-span-1 flex items-center justify-end gap-1">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
                      style={{ background: `${exp.hex}1f`, color: exp.hex }}
                      title={exp.label}
                    >
                      {exp.icon}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ EXPERIMENT MODAL ═══ */}
      <Dialog open={!!activeRenewal} onOpenChange={(o) => !o && closeLab()}>
        <DialogContent className="max-w-2xl">
          {activeRenewal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-cc-purple" />
                  معمل العميل · {activeRenewal.customer_name}
                </DialogTitle>
                <DialogDescription className="text-[13px]">
                  اختر تجربة استعادة وحدّد النتيجة. ستظهر كحالة في المفاعل أعلاه.
                </DialogDescription>
              </DialogHeader>

              {/* Customer info strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-2">
                <InfoChip
                  label="الدرجة"
                  value={recoveryScore(activeRenewal, maxPrice).toString()}
                  hex={scoreHex(recoveryScore(activeRenewal, maxPrice))}
                />
                <InfoChip
                  label="السبب"
                  value={activeRenewal.cancel_reason || "—"}
                  hex="#F59E0B"
                />
                <InfoChip
                  label="المدة"
                  value={`${daysSince(activeRenewal.renewal_date)} يوم`}
                  hex="#7da6ff"
                />
                <InfoChip
                  label="القيمة"
                  value={formatMoney(activeRenewal.plan_price)}
                  hex="#10B981"
                />
              </div>

              {/* Experiment picker */}
              <div className="space-y-2">
                <div className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                  <TestTube className="w-3.5 h-3.5 text-cc-purple" />
                  اختر التجربة
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(Object.keys(EXPERIMENTS) as ExperimentKey[]).map((k) => {
                    const exp = EXPERIMENTS[k];
                    const active = draftExperiment === k;
                    const recommended =
                      (REASON_TO_EXPERIMENTS[activeRenewal.cancel_reason || "أخرى"] ?? []).includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setDraftExperiment(k)}
                        className="relative p-2 rounded-lg transition-all text-right"
                        style={{
                          background: active ? `${exp.hex}22` : "var(--card)",
                          border: `1px solid ${active ? exp.hex : "var(--border)"}`,
                        }}
                      >
                        {recommended && (
                          <span
                            className="absolute top-1 left-1 text-[10px] font-bold px-1 rounded"
                            style={{ background: "#10B98122", color: "#10B981" }}
                          >
                            موصى
                          </span>
                        )}
                        <div
                          className="flex items-center gap-1.5 mb-0.5 font-bold text-[13px]"
                          style={{ color: exp.hex }}
                        >
                          {exp.icon}
                          {exp.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-snug">
                          {exp.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Script preview */}
              {draftExperiment && (
                <div
                  className="rounded-lg p-3 mt-2"
                  style={{
                    background: `${EXPERIMENTS[draftExperiment as ExperimentKey].hex}11`,
                    border: `1px solid ${EXPERIMENTS[draftExperiment as ExperimentKey].hex}44`,
                  }}
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-bold mb-1" style={{ color: EXPERIMENTS[draftExperiment as ExperimentKey].hex }}>
                    <MessageSquare className="w-3 h-3" />
                    سكربت مقترح
                  </div>
                  <p className="text-[13px] text-foreground leading-relaxed">
                    {EXPERIMENTS[draftExperiment as ExperimentKey].script}
                  </p>
                </div>
              )}

              {/* Lab note */}
              <div className="mt-2 space-y-1">
                <div className="text-[13px] font-bold text-foreground">
                  ملاحظة المعمل
                </div>
                <Textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="اكتب ملاحظات حول التجربة، تواريخ المتابعة، رد العميل..."
                  className="text-[13px] min-h-[70px]"
                />
              </div>

              {/* Outcome */}
              <div className="mt-2 space-y-1">
                <div className="text-[13px] font-bold text-foreground">النتيجة</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["pending", "recovered", "lost"] as const).map((o) => {
                    const meta = {
                      pending: { label: "بانتظار الرد", hex: "#7da6ff", icon: <Clock className="w-3.5 h-3.5" /> },
                      recovered: { label: "تم الاستعادة", hex: "#10B981", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                      lost: { label: "مفقود نهائياً", hex: "#EF4444", icon: <XCircle className="w-3.5 h-3.5" /> },
                    }[o];
                    const active = draftOutcome === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setDraftOutcome(o)}
                        className="flex items-center justify-center gap-1.5 p-2 rounded-lg text-[13px] font-bold transition-all"
                        style={{
                          background: active ? `${meta.hex}22` : "var(--card)",
                          color: active ? meta.hex : "var(--foreground)",
                          border: `1px solid ${active ? meta.hex : "var(--border)"}`,
                        }}
                      >
                        {meta.icon}
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="gap-2 flex-wrap mt-2">
                {lab[activeRenewal.id] && (
                  <Button
                    variant="ghost"
                    onClick={resetExperiment}
                    className="text-cc-red hover:bg-red-dim text-[13px]"
                  >
                    إلغاء التجربة
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={moveToFollowup}
                  disabled={!draftExperiment}
                  className="text-[13px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  نقل إلى المتابعة
                </Button>
                <Button
                  onClick={applyExperiment}
                  disabled={!draftExperiment}
                  className="text-[13px]"
                >
                  <Target className="w-3.5 h-3.5" />
                  تطبيق التجربة
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoChip({
  label,
  value,
  hex,
}: {
  label: string;
  value: string;
  hex: string;
}) {
  return (
    <div
      className="rounded-lg p-2"
      style={{ background: `${hex}11`, border: `1px solid ${hex}33` }}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-xs font-bold font-mono truncate" style={{ color: hex }}>
        {value}
      </div>
    </div>
  );
}
