"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  BrainCircuit, Sun, Flame, Snowflake, ShieldAlert, CalendarCheck,
  Target, CheckSquare, Sparkles, TrendingUp, TrendingDown, Clock,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Users, Banknote, BarChart3, Phone, ArrowLeft, ArrowRight,
  MessageCircle, Bell, ExternalLink, Zap, CloudSun, Thermometer,
  Headphones, UserX, Timer, Share2, LogIn, Smartphone, Monitor, Activity,
} from "lucide-react";
import { fetchDeals, fetchRenewals, fetchEmployees, fetchRecentFollowUpNotes, upsertSalesGuideSetting, fetchSalesGuideSettings, fetchTickets, fetchUserLoginLogs, fetchActivityLogs, type UserLoginLog } from "@/lib/supabase/db";
import type { ActivityLog } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { formatMoneyFull } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Deal, Renewal, Employee, Ticket } from "@/types";

/* ─── Constants ─── */
const GOAL_90DAY = 70000;
const WEEKLY_TARGET = 17500;

const URGENCY_STYLE = { high: "border-red-500/30 bg-red-500/[0.06]", medium: "border-amber-500/30 bg-amber-500/[0.06]", low: "border-blue-500/30 bg-blue-500/[0.06]" } as const;
const URGENCY_TEXT = { high: "text-red-400", medium: "text-amber-400", low: "text-blue-400" } as const;
const URGENCY_LABEL = { high: "عاجل", medium: "متوسط", low: "عادي" } as const;

/* ─── Section Component (outside main to avoid re-mount on state change) ─── */
function Section({ id, title, icon, children, badge, isOpen, onToggle }: {
  id: string; title: string; icon: React.ReactNode; children: React.ReactNode;
  badge?: React.ReactNode; isOpen: boolean; onToggle: (id: string) => void;
}) {
  return (
    <div className="cc-card rounded-xl overflow-hidden">
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm font-bold text-foreground">{title}</span>
          {badge}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && <div className="px-4 pb-4 border-t border-border pt-4">{children}</div>}
    </div>
  );
}

/* ─── Helpers ─── */
function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}
function getDayName() {
  return new Date().toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
}

function toLocalDateStr(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isToday(dateStr: string): boolean {
  return toLocalDateStr(dateStr) === toLocalDateStr(new Date().toISOString());
}

function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  return d.toLocaleDateString("ar-SA-u-ca-gregory", { month: "short", day: "numeric" });
}

function formatDateGroupSec(dateStr: string): string {
  if (isToday(dateStr)) return "اليوم";
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) return "أمس";
  return d.toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", month: "short", day: "numeric" });
}

/* ─── Deal Temperature Scoring ─── */
const STAGE_WEIGHTS: Record<string, number> = {
  "انتظار الدفع": 90,
  "تجهيز": 78,
  "تفاوض": 72,
  "تم إرسال العرض": 62,
  "تجريبي": 58,
  "عميل جديد": 52,
  "قيد التواصل": 42,
  "اعادة الاتصال في وقت اخر": 25,
  "تاجيل": 20,
  "كنسل التجربة": 10,
  "استهداف خاطئ": 5,
};

const NEXT_STEP_HINT: Record<string, string> = {
  "قيد التواصل": "متابعة المحادثة وتحديد الاحتياج",
  "عميل جديد": "تأهيل الحاجة وتحديد الخطة المناسبة",
  "تم إرسال العرض": "متابعة رد العميل على العرض",
  "تفاوض": "إغلاق السعر أو تعديل العرض",
  "انتظار الدفع": "متابعة التحويل وإرسال التذكير",
  "تجهيز": "تسليم الخدمة وتأكيد التشغيل",
  "تجريبي": "متابعة تجربة العميل خلال 48 ساعة",
  "تاجيل": "إعادة جدولة الاتصال حسب الموعد",
  "اعادة الاتصال في وقت اخر": "تحديد موعد محدد للاتصال",
};

type DealTier = "hot" | "warm" | "cold" | "stale";

interface DealIntel {
  score: number;
  tier: DealTier;
  lastActivityDate: string;
  daysSinceActivity: number;
  nextStep: string;
  hasNoNextStep: boolean;
  needsAttention: boolean;
  attentionReason?: string;
}

function computeDealIntel(d: Deal, lastNoteDate?: string): DealIntel {
  const stageWeight = STAGE_WEIGHTS[d.stage] ?? 20;
  let score = stageWeight;

  // Value weight (max +20)
  if (d.deal_value >= 30000) score += 20;
  else if (d.deal_value >= 10000) score += 15;
  else if (d.deal_value >= 5000) score += 10;
  else if (d.deal_value >= 1000) score += 5;

  // Recency
  const lastActivity = lastNoteDate || d.last_contact || d.updated_at || d.created_at;
  const daysSinceActivity = daysAgo(lastActivity);
  if (daysSinceActivity <= 2) score += 15;
  else if (daysSinceActivity <= 5) score += 8;
  else if (daysSinceActivity <= 10) score += 0;
  else if (daysSinceActivity <= 20) score -= 15;
  else score -= 30;

  // Staleness penalty (cycle days)
  if (d.cycle_days > 30) score -= 20;
  else if (d.cycle_days > 14) score -= 10;

  // Determine tier
  let tier: DealTier;
  if (d.stage === "انتظار الدفع" || score >= 90) tier = "hot";
  else if (score >= 60) tier = "warm";
  else if (daysSinceActivity > 14 || d.cycle_days > 21) tier = "stale";
  else tier = "cold";

  const nextStep = NEXT_STEP_HINT[d.stage] || "تحديد الخطوة القادمة";
  const hasNoNextStep = !d.notes || d.notes.trim().length < 5;

  // Needs owner attention?
  let needsAttention = false;
  let attentionReason: string | undefined;
  if (d.stage === "انتظار الدفع" && daysSinceActivity >= 3) {
    needsAttention = true;
    attentionReason = `بانتظار الدفع منذ ${daysSinceActivity} أيام`;
  } else if (d.deal_value >= 10000 && daysSinceActivity >= 5 && tier !== "hot") {
    needsAttention = true;
    attentionReason = `قيمة عالية بلا تفاعل ${daysSinceActivity} يوم`;
  } else if (tier === "warm" && daysSinceActivity >= 7) {
    needsAttention = true;
    attentionReason = `صفقة دافئة تُنسى — ${daysSinceActivity} يوم بلا تواصل`;
  }

  return { score, tier, lastActivityDate: lastActivity, daysSinceActivity, nextStep, hasNoNextStep, needsAttention, attentionReason };
}

function sanitizePhone(phone?: string): string {
  if (!phone) return "";
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("05") || p.startsWith("5")) p = "+966" + p.replace(/^0/, "");
  return p;
}

function whatsappLink(phone: string, msg: string): string {
  const p = sanitizePhone(phone).replace(/^\+/, "");
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

function whatsappMessageForStage(stage: string, clientName: string): string {
  switch (stage) {
    case "انتظار الدفع":
      return `مرحبًا ${clientName}، نود التأكد من استلامكم لتفاصيل الدفع. هل هناك ما يمكننا مساعدتكم به لإتمام العملية؟`;
    case "تفاوض":
      return `مرحبًا ${clientName}، نتابع معكم بخصوص عرضنا. هل لديكم أي استفسارات حتى نصل لاتفاق يناسبكم؟`;
    case "تم إرسال العرض":
      return `مرحبًا ${clientName}، تأكيد وصول العرض — هل اطلعتم عليه ولديكم ملاحظات؟`;
    default:
      return `مرحبًا ${clientName}، نتابع معكم بخصوص طلبكم مع RESTAVO. كيف يمكننا خدمتكم؟`;
  }
}

/* ─── Share helpers ─── */
const VARIANT_LABEL: Record<"hot" | "warm" | "cold" | "attention", string> = {
  hot: "🔥 ساخنة",
  warm: "🌤 دافئة",
  cold: "❄️ باردة",
  attention: "⚡ تحتاج تدخل",
};

function buildDealShareText(d: Deal, intel: DealIntel, variant: "hot" | "warm" | "cold" | "attention"): string {
  const lines: string[] = [];
  lines.push(`📌 صفقة ${VARIANT_LABEL[variant]}`);
  lines.push(`العميل: ${d.client_name}`);
  if (d.client_phone) lines.push(`الجوال: ${d.client_phone}`);
  lines.push(`المرحلة: ${d.stage}`);
  lines.push(`القيمة: ${formatMoneyFull(d.deal_value)}`);
  if (d.assigned_rep_name) lines.push(`المسؤول: ${d.assigned_rep_name}`);
  lines.push(`الدرجة: ${intel.score}`);
  const lastActivityLabel = intel.daysSinceActivity === 0
    ? "اليوم"
    : intel.daysSinceActivity === 1
    ? "أمس"
    : `قبل ${intel.daysSinceActivity} يوم`;
  lines.push(`آخر تفاعل: ${lastActivityLabel}`);
  lines.push(`عمر الصفقة: ${d.cycle_days} يوم`);
  lines.push(`الخطوة القادمة: ${intel.nextStep}`);
  if (variant === "attention" && intel.attentionReason) lines.push(`⚠ ${intel.attentionReason}`);
  return lines.join("\n");
}

function buildDealsCategoryShareText(
  items: { deal: Deal; intel: DealIntel }[],
  variant: "hot" | "warm" | "cold",
  categoryTitle: string,
): string {
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const totalValue = items.reduce((s, { deal }) => s + deal.deal_value, 0);
  const header = [
    `📊 ${categoryTitle} — ${VARIANT_LABEL[variant]}`,
    today,
    `العدد: ${items.length} صفقة — إجمالي القيمة: ${formatMoneyFull(totalValue)}`,
    "",
  ].join("\n");
  const body = items
    .map(({ deal: d, intel }, i) => {
      const last = intel.daysSinceActivity === 0 ? "اليوم" : intel.daysSinceActivity === 1 ? "أمس" : `قبل ${intel.daysSinceActivity}ي`;
      const rep = d.assigned_rep_name ? ` — ${d.assigned_rep_name}` : "";
      return `${i + 1}. ${d.client_name}${rep}\n   ${d.stage} • ${formatMoneyFull(d.deal_value)} • درجة ${intel.score} • آخر تفاعل ${last}\n   ↪ ${intel.nextStep}`;
    })
    .join("\n\n");
  return header + body;
}

async function shareText(title: string, text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch {
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    alert("تم نسخ التفاصيل! يمكنك لصقها في واتساب أو أي تطبيق.");
  } catch {
    alert("تعذرت المشاركة — يرجى المحاولة يدويًا.");
  }
}

/* ─── DealRow: compact deal card with quick actions ─── */
const VARIANT_STYLES: Record<"hot" | "warm" | "cold" | "attention", { border: string; bg: string; text: string; valueText: string }> = {
  hot: { border: "border-orange-500/25", bg: "bg-orange-500/[0.06]", text: "text-orange-300", valueText: "text-orange-400" },
  warm: { border: "border-amber-400/25", bg: "bg-amber-500/[0.05]", text: "text-amber-200", valueText: "text-amber-300" },
  cold: { border: "border-blue-500/20", bg: "bg-blue-500/[0.05]", text: "text-blue-300", valueText: "text-blue-400" },
  attention: { border: "border-red-500/30", bg: "bg-red-500/[0.06]", text: "text-red-300", valueText: "text-red-400" },
};

function DealRow({
  deal: d,
  intel,
  variant,
  onRemind,
}: {
  deal: Deal;
  intel: DealIntel;
  variant: "hot" | "warm" | "cold" | "attention";
  onRemind: (d: Deal) => void;
}) {
  const s = VARIANT_STYLES[variant];
  const phone = sanitizePhone(d.client_phone);
  const lastActivityLabel = intel.daysSinceActivity === 0
    ? "اليوم"
    : intel.daysSinceActivity === 1
    ? "أمس"
    : `قبل ${intel.daysSinceActivity} يوم`;

  const staleColor = intel.daysSinceActivity > 14 ? "text-red-400" : intel.daysSinceActivity > 7 ? "text-amber-400" : "text-muted-foreground";

  return (
    <div className={`rounded-lg ${s.bg} border ${s.border} px-3 py-2.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-foreground truncate">{d.client_name}</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-muted-foreground">{d.stage}</span>
            {variant === "attention" && intel.attentionReason && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">{intel.attentionReason}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">{d.assigned_rep_name || "بلا مسؤول"}</span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className={`text-[10px] ${staleColor} flex items-center gap-0.5`}>
              <Clock className="w-2.5 h-2.5" /> آخر تفاعل {lastActivityLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">•</span>
            <span className="text-[10px] text-muted-foreground">{d.cycle_days} يوم بالأنبوب</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            <span className="text-cyan-400/80">الخطوة القادمة:</span> {intel.nextStep}
            {intel.hasNoNextStep && <span className="ml-1 text-red-400/90">⚠ بدون ملاحظة</span>}
          </p>
        </div>
        <div className="text-left shrink-0">
          <p className={`text-sm font-bold ${s.valueText}`}>{formatMoneyFull(d.deal_value)}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">درجة {intel.score}</p>
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/[0.04]">
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
            title="اتصل"
          >
            <Phone className="w-3 h-3" /> اتصل
          </a>
        ) : (
          <span className="text-[10px] px-2 py-1 rounded-md bg-white/[0.03] text-muted-foreground/60 border border-white/[0.04]">بلا رقم</span>
        )}
        {phone && (
          <a
            href={whatsappLink(phone, whatsappMessageForStage(d.stage, d.client_name))}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 transition-colors"
            title="واتساب"
          >
            <MessageCircle className="w-3 h-3" /> واتساب
          </a>
        )}
        <button
          onClick={() => onRemind(d)}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-colors"
          title="أضف مهمة متابعة غداً"
        >
          <Bell className="w-3 h-3" /> ذكّرني
        </button>
        <button
          onClick={() => shareText(`صفقة ${d.client_name}`, buildDealShareText(d, intel, variant))}
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-colors"
          title="مشاركة الصفقة"
        >
          <Share2 className="w-3 h-3" /> مشاركة
        </button>
        <Link
          href="/sales"
          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground border border-white/[0.06] transition-colors mr-auto"
          title="افتح في المبيعات"
        >
          <ExternalLink className="w-3 h-3" /> فتح
        </Link>
      </div>
    </div>
  );
}

/* ─── PerformerCard: top/bottom per department ─── */
const ACCENT_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  emerald: { border: "border-emerald-500/20", bg: "bg-emerald-500/[0.05]", text: "text-emerald-400" },
  orange: { border: "border-orange-500/20", bg: "bg-orange-500/[0.05]", text: "text-orange-400" },
  rose: { border: "border-rose-500/20", bg: "bg-rose-500/[0.05]", text: "text-rose-400" },
  sky: { border: "border-sky-500/20", bg: "bg-sky-500/[0.05]", text: "text-sky-400" },
};

function PerformerCard({
  title,
  accent,
  unit,
  data,
}: {
  title: string;
  accent: "emerald" | "orange" | "rose" | "sky";
  unit: string;
  data: { top?: { name: string; value: number; subValue?: string }; bottom?: { name: string; value: number; subValue?: string }; total: number };
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div className={`rounded-xl ${s.bg} border ${s.border} p-3`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-[11px] font-bold ${s.text}`}>{title}</p>
        <span className="text-[9px] text-muted-foreground">{data.total} موظف</span>
      </div>
      {!data.top && !data.bottom ? (
        <p className="text-[10px] text-muted-foreground py-2 text-center">لا توجد بيانات</p>
      ) : (
        <div className="space-y-1.5">
          {data.top && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/15">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">🏆 الأفضل</p>
                <p className="text-[11px] font-bold text-foreground truncate">{data.top.name}</p>
              </div>
              <div className="text-left shrink-0">
                <p className={`text-sm font-bold ${s.text}`}>{data.top.value}</p>
                <p className="text-[9px] text-muted-foreground">{data.top.subValue || unit}</p>
              </div>
            </div>
          )}
          {data.bottom && data.bottom.name !== data.top?.name && (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-red-500/[0.06] border border-red-500/15">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-red-400 flex items-center gap-1">📉 الأقل</p>
                <p className="text-[11px] font-bold text-foreground truncate">{data.bottom.name}</p>
              </div>
              <div className="text-left shrink-0">
                <p className="text-sm font-bold text-red-400">{data.bottom.value}</p>
                <p className="text-[9px] text-muted-foreground">{data.bottom.subValue || unit}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Types ─── */
interface Priority {
  icon: string;
  title: string;
  detail: string;
  urgency: "high" | "medium" | "low";
  section: string;
}

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
}

interface MeetingItem {
  id: string;
  title: string;
  time: string;
  attendees: string;
  done: boolean;
}

interface QuickTask {
  id: string;
  text: string;
  done: boolean;
}

export default function SecretaryPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recentNotes, setRecentNotes] = useState<{ entity_id: string; note: string; author_name: string; created_at: string; entity_name?: string; entity_type: string }[]>([]);
  const [loginLogs, setLoginLogs] = useState<UserLoginLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState<"today" | "yesterday" | "week" | "month">("today");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    briefing: true, meetings: true, hotCold: true, supportHealth: true, renewalHealth: true, priorities: true,
    goal90: true, quickTasks: true, tasks: true, attendance: true,
  });

  const todayKey = new Date().toISOString().slice(0, 10);

  // Tasks persisted in database (syncs across devices)
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTask, setNewTask] = useState("");

  // Meetings persisted in database
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [newMeeting, setNewMeeting] = useState({ title: "", time: "", attendees: "" });

  // Quick tasks (< 15 min) persisted in database
  const [quickTasks, setQuickTasks] = useState<QuickTask[]>([]);
  const [newQuickTask, setNewQuickTask] = useState("");

  // Track if initial load from DB is done to avoid saving empty state
  const dbLoaded = useRef(false);

  // Save helpers — debounced to avoid excessive writes
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveToDb = useCallback((key: string, value: unknown) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      upsertSalesGuideSetting(key, { date: todayKey, items: value }).catch(console.error);
    }, 500);
  }, [todayKey]);

  // Auto-save tasks to DB
  useEffect(() => {
    if (dbLoaded.current) saveToDb("secretary_tasks", tasks);
  }, [tasks, saveToDb]);
  useEffect(() => {
    if (dbLoaded.current) saveToDb("secretary_meetings", meetings);
  }, [meetings, saveToDb]);
  useEffect(() => {
    if (dbLoaded.current) saveToDb("secretary_quick", quickTasks);
  }, [quickTasks, saveToDb]);

  // Auto-schedule a 9 PM performance review meeting for each weak department (once per session)
  const autoScheduledRef = useRef(false);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDeals(), fetchRenewals(), fetchEmployees(), fetchRecentFollowUpNotes(50), fetchSalesGuideSettings(), fetchTickets(), fetchUserLoginLogs(500), fetchActivityLogs({ limit: 200 })])
      .then(([d, r, e, n, settings, t, ll, al]) => {
        setDeals(d); setRenewals(r); setEmployees(e); setRecentNotes(n); setTickets(t); setLoginLogs(ll); setActivityLogs(al);
        // Restore secretary tasks/meetings/quickTasks from database
        const loadSetting = (key: string) => {
          const row = settings.find((s: { setting_key: string }) => s.setting_key === key);
          if (!row) return [];
          const val = row.setting_value as { date?: string; items?: unknown[] };
          return val?.date === todayKey && Array.isArray(val.items) ? val.items : [];
        };
        setTasks(loadSetting("secretary_tasks") as TaskItem[]);
        setMeetings(loadSetting("secretary_meetings") as MeetingItem[]);
        setQuickTasks(loadSetting("secretary_quick") as QuickTask[]);
        dbLoaded.current = true;
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  /* ═══════════════════════════════════════
     COMPUTED DATA
  ═══════════════════════════════════════ */

  // ── Deal Intelligence: score every active deal, classify, and enrich with last-activity/next-step ──
  const dealsWithIntel = useMemo(() => {
    // Build last-note lookup (most recent note per deal)
    const lastNoteByDeal = new Map<string, string>();
    for (const n of recentNotes) {
      if (n.entity_type !== "deal") continue;
      const prev = lastNoteByDeal.get(n.entity_id);
      if (!prev || new Date(n.created_at) > new Date(prev)) {
        lastNoteByDeal.set(n.entity_id, n.created_at);
      }
    }
    return deals
      .filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب" && d.stage !== "استهداف خاطئ" && d.stage !== "كنسل التجربة")
      .map(d => ({ deal: d, intel: computeDealIntel(d, lastNoteByDeal.get(d.id)) }));
  }, [deals, recentNotes]);

  const hotDeals = useMemo(
    () => dealsWithIntel.filter(x => x.intel.tier === "hot").sort((a, b) => b.intel.score - a.intel.score),
    [dealsWithIntel]
  );
  const warmDeals = useMemo(
    () => dealsWithIntel.filter(x => x.intel.tier === "warm").sort((a, b) => b.intel.score - a.intel.score),
    [dealsWithIntel]
  );
  const coldDeals = useMemo(
    () => dealsWithIntel
      .filter(x => x.intel.tier === "cold" || x.intel.tier === "stale")
      .sort((a, b) => b.deal.cycle_days - a.deal.cycle_days),
    [dealsWithIntel]
  );
  const ownerAttention = useMemo(
    () => dealsWithIntel
      .filter(x => x.intel.needsAttention)
      .sort((a, b) => b.deal.deal_value - a.deal.deal_value),
    [dealsWithIntel]
  );

  // Rep escalation: reps with 3+ stale/cold deals
  const repEscalation = useMemo(() => {
    const map = new Map<string, number>();
    for (const x of dealsWithIntel) {
      if (x.intel.tier === "stale" || x.intel.tier === "cold") {
        const k = x.deal.assigned_rep_name || "بلا مسؤول";
        map.set(k, (map.get(k) || 0) + 1);
      }
    }
    return Array.from(map.entries()).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  }, [dealsWithIntel]);

  // Support health (tickets)
  const supportHealth = useMemo(() => {
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);
    const isOpen = (t: Ticket) => t.status !== "محلول";
    const openTickets = tickets.filter(isOpen);
    const urgentOpen = openTickets.filter(t => t.priority === "عاجل");
    const overdue = openTickets.filter(t => {
      const created = new Date(t.created_at).getTime();
      return (now - created) / (1000 * 60 * 60 * 24) > 3;
    });
    const unassigned = openTickets.filter(t => !t.assigned_agent_name || !t.assigned_agent_name.trim());
    const newToday = tickets.filter(t => t.created_at.slice(0, 10) === todayStr);
    const resolvedToday = tickets.filter(t => t.status === "محلول" && (t.resolved_date === todayStr || (t.updated_at ?? "").slice(0, 10) === todayStr));

    // Avg response time today (minutes)
    const responded = resolvedToday.filter(t => typeof t.response_time_minutes === "number");
    const avgResponse = responded.length > 0
      ? Math.round(responded.reduce((s, t) => s + (t.response_time_minutes || 0), 0) / responded.length)
      : 0;

    // Agent workload escalation: agent with 5+ open tickets
    const agentLoad = new Map<string, number>();
    for (const t of openTickets) {
      const k = t.assigned_agent_name?.trim() || "بلا مسؤول";
      agentLoad.set(k, (agentLoad.get(k) || 0) + 1);
    }
    const overloadedAgents = Array.from(agentLoad.entries()).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]);

    // Priority attention list
    const attention: { ticket: Ticket; reason: string; severity: "high" | "medium" }[] = [];
    for (const t of urgentOpen) {
      const hoursOpen = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursOpen >= 24) attention.push({ ticket: t, reason: `عاجلة مفتوحة منذ ${Math.floor(hoursOpen)} ساعة`, severity: "high" });
    }
    for (const t of overdue) {
      if (!attention.find(a => a.ticket.id === t.id)) {
        const days = Math.floor((now - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
        attention.push({ ticket: t, reason: `متأخرة ${days} يوم`, severity: "high" });
      }
    }
    for (const t of unassigned) {
      if (!attention.find(a => a.ticket.id === t.id)) {
        const hoursOpen = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursOpen >= 2) attention.push({ ticket: t, reason: `بلا مسؤول منذ ${Math.floor(hoursOpen)} ساعة`, severity: "medium" });
      }
    }

    return {
      openCount: openTickets.length,
      urgentCount: urgentOpen.length,
      overdueCount: overdue.length,
      unassignedCount: unassigned.length,
      newToday: newToday.length,
      resolvedToday: resolvedToday.length,
      avgResponse,
      attention: attention.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1)),
      overloadedAgents,
    };
  }, [tickets]);

  // Renewal health
  const renewalHealth = useMemo(() => {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueSoon = renewals.filter(r => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      const rd = new Date(r.renewal_date);
      return rd <= in7Days && rd >= now;
    });
    const overdue = renewals.filter(r => {
      if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
      return new Date(r.renewal_date) < now;
    });
    const noResponse = renewals.filter(r => r.status === "مافي تجاوب" || r.status === "الرقم غلط");
    const total = renewals.length;
    const completed = renewals.filter(r => r.status === "مكتمل").length;
    const cancelled = renewals.filter(r => r.status === "ملغي بسبب").length;
    const churnRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    return { dueSoon, overdue, noResponse, total, completed, cancelled, churnRate };
  }, [renewals]);

  // Priorities
  const priorities = useMemo(() => {
    const p: Priority[] = [];

    // Overdue renewals
    renewalHealth.overdue.forEach(r => {
      p.push({ icon: "🔴", title: `تجديد متأخر: ${r.customer_name}`, detail: `${r.plan_name} — ${formatMoneyFull(r.plan_price)}`, urgency: "high", section: "renewals" });
    });

    // Hot deals waiting payment
    hotDeals.filter(x => x.deal.stage === "انتظار الدفع").forEach(({ deal: d }) => {
      p.push({ icon: "💰", title: `بانتظار الدفع: ${d.client_name}`, detail: `${formatMoneyFull(d.deal_value)}`, urgency: "high", section: "sales" });
    });

    // Cold deals
    coldDeals.slice(0, 3).forEach(({ deal: d }) => {
      p.push({ icon: "❄️", title: `صفقة راكدة: ${d.client_name}`, detail: `${d.cycle_days} يوم — مرحلة ${d.stage}`, urgency: "medium", section: "sales" });
    });

    // Renewals due soon
    renewalHealth.dueSoon.slice(0, 3).forEach(r => {
      p.push({ icon: "⏰", title: `تجديد قريب: ${r.customer_name}`, detail: `${r.plan_name} — ${r.renewal_date}`, urgency: "medium", section: "renewals" });
    });

    // No response renewals
    renewalHealth.noResponse.slice(0, 2).forEach(r => {
      p.push({ icon: "📵", title: `بدون تجاوب: ${r.customer_name}`, detail: r.plan_name, urgency: "low", section: "renewals" });
    });

    // Urgent support tickets needing attention
    supportHealth.attention.filter(a => a.severity === "high").slice(0, 3).forEach(({ ticket: t, reason }) => {
      p.push({ icon: "🚨", title: `تذكرة ${t.priority}: ${t.client_name}`, detail: `${t.issue.slice(0, 50)}${t.issue.length > 50 ? "..." : ""} — ${reason}`, urgency: "high", section: "support" });
    });

    // Unassigned tickets
    supportHealth.attention.filter(a => a.severity === "medium").slice(0, 2).forEach(({ ticket: t, reason }) => {
      p.push({ icon: "👤", title: `تذكرة بلا مسؤول: ${t.client_name}`, detail: `${t.issue.slice(0, 50)} — ${reason}`, urgency: "medium", section: "support" });
    });

    return p.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.urgency] - order[b.urgency];
    });
  }, [hotDeals, coldDeals, renewalHealth, supportHealth]);

  // 90-day goal
  const goal90 = useMemo(() => {
    const now = new Date();
    const start90 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const closed = deals.filter(d => d.stage === "مكتملة" && new Date(d.close_date || d.created_at) >= start90);
    const revenue = closed.reduce((s, d) => s + d.deal_value, 0);
    const renewalRev = renewals.filter(r => r.status === "مكتمل" && new Date(r.renewal_date) >= start90)
      .reduce((s, r) => s + r.plan_price, 0);
    const total = revenue + renewalRev;
    const pct = GOAL_90DAY > 0 ? Math.round((total / GOAL_90DAY) * 100) : 0;
    const remaining = Math.max(GOAL_90DAY - total, 0);
    const daysLeft = 90 - Math.floor((now.getTime() - start90.getTime()) / (1000 * 60 * 60 * 24));
    return { total, pct, remaining, daysLeft: Math.max(daysLeft, 0), closedDeals: closed.length };
  }, [deals, renewals]);

  // Briefing stats — summaries for today / yesterday / week / month
  const briefingStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Week range: last 7 days inclusive (today ... today - 6)
    const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Split deals by sales_type
    const officeDeals = deals.filter(d => d.sales_type === "office" || !d.sales_type);
    const supportDeals = deals.filter(d => d.sales_type === "support");

    // Helper: check if a YYYY-MM-DD string falls within [start, end] inclusive
    const inDayRange = (dateStr: string | undefined, start: string, end: string) =>
      !!dateStr && dateStr.slice(0, 10) >= start && dateStr.slice(0, 10) <= end;

    const inMonth = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    };

    function statsForRange(label: "today" | "yesterday" | "week" | "month", start: string, end: string) {
      const useMonth = label === "month";
      const dealMatches = (d: Deal) => {
        if (d.stage !== "مكتملة") return false;
        const key = d.close_date || d.created_at;
        return useMonth ? inMonth(key) : inDayRange(key, start, end);
      };
      const renewalMatches = (r: Renewal) =>
        r.status === "مكتمل" && (useMonth ? inMonth(r.updated_at) : inDayRange(r.updated_at, start, end));
      const ticketCreatedInRange = (t: Ticket) =>
        useMonth ? inMonth(t.created_at) : inDayRange(t.created_at, start, end);
      const ticketResolvedInRange = (t: Ticket) => {
        if (t.status !== "محلول") return false;
        const key = t.resolved_date || t.updated_at;
        return useMonth ? inMonth(key) : inDayRange(key, start, end);
      };

      const office = officeDeals.filter(dealMatches);
      const support = supportDeals.filter(dealMatches);
      const rens = renewals.filter(renewalMatches);
      const tNew = tickets.filter(ticketCreatedInRange);
      const tResolved = tickets.filter(ticketResolvedInRange);

      const officeRev = office.reduce((s, d) => s + d.deal_value, 0);
      const supportRev = support.reduce((s, d) => s + d.deal_value, 0);
      const renewalRev = rens.reduce((s, r) => s + r.plan_price, 0);

      return {
        office: office.length, officeRev,
        support: support.length, supportRev,
        renewals: rens.length, renewalRev,
        ticketsNew: tNew.length,
        ticketsResolved: tResolved.length,
        totalRev: officeRev + supportRev + renewalRev,
      };
    }

    const today = statsForRange("today", todayStr, todayStr);
    const yesterday = statsForRange("yesterday", yesterdayStr, yesterdayStr);
    const week = statsForRange("week", weekStart, todayStr);
    const month = statsForRange("month", "", ""); // args ignored when useMonth

    // Monthly richer metrics (for the existing detailed section)
    const monthOffice = officeDeals.filter(d => d.month === selectedMonth && d.year === selectedYear);
    const monthSupport = supportDeals.filter(d => d.month === selectedMonth && d.year === selectedYear);
    const monthRenewals = renewals.filter(r => {
      const rd = new Date(r.renewal_date);
      return rd.getMonth() + 1 === selectedMonth && rd.getFullYear() === selectedYear;
    });
    const pipeline = [...monthOffice, ...monthSupport].filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب");
    const pendingRenewals = monthRenewals.filter(r => r.status !== "مكتمل" && r.status !== "ملغي بسبب").length;

    return {
      periods: { today, yesterday, week, month },
      // Monthly (legacy fields — consumed by existing monthly section + AI)
      closedOffice: month.office, revenueOffice: month.officeRev,
      closedSupport: month.support, revenueSupport: month.supportRev,
      pipelineCount: pipeline.length,
      completedRenewals: month.renewals, renewalRevenue: month.renewalRev, pendingRenewals,
      totalRevenueMonth: month.totalRev,
      // Today (legacy fields kept for compatibility)
      todayOffice: today.office, todayOfficeRev: today.officeRev,
      todaySupport: today.support, todaySupportRev: today.supportRev,
      todayRenewals: today.renewals, todayRenewalRev: today.renewalRev,
      todayNew: 0,
      todayTotalRev: today.totalRev,
    };
  }, [deals, renewals, tickets, selectedMonth, selectedYear]);

  // Performers — top/bottom per department for the selected period
  const performers = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const inRange = (dateStr: string | undefined, start: string, end: string) =>
      !!dateStr && dateStr.slice(0, 10) >= start && dateStr.slice(0, 10) <= end;
    const inMonth = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    };

    let start: string, end: string;
    const useMonth = selectedPeriod === "month";
    if (selectedPeriod === "today") { start = todayStr; end = todayStr; }
    else if (selectedPeriod === "yesterday") { start = yesterdayStr; end = yesterdayStr; }
    else if (selectedPeriod === "week") { start = weekStart; end = todayStr; }
    else { start = ""; end = ""; }

    const matchDate = (dateStr: string | undefined) => useMonth ? inMonth(dateStr) : inRange(dateStr, start, end);

    // Sales reps (office + support, closed deals)
    const officeRepMap = new Map<string, { count: number; rev: number }>();
    const supportRepMap = new Map<string, { count: number; rev: number }>();
    for (const d of deals) {
      if (d.stage !== "مكتملة") continue;
      if (!matchDate(d.close_date || d.created_at)) continue;
      const name = d.assigned_rep_name?.trim() || "بلا مسؤول";
      const target = (d.sales_type === "support") ? supportRepMap : officeRepMap;
      const cur = target.get(name) || { count: 0, rev: 0 };
      cur.count += 1; cur.rev += d.deal_value;
      target.set(name, cur);
    }

    // Ticket agents — resolved count + avg response time
    const agentMap = new Map<string, { resolved: number; totalResp: number; withResp: number }>();
    for (const t of tickets) {
      if (t.status !== "محلول") continue;
      if (!matchDate(t.resolved_date || t.updated_at)) continue;
      const name = t.assigned_agent_name?.trim() || "بلا مسؤول";
      const cur = agentMap.get(name) || { resolved: 0, totalResp: 0, withResp: 0 };
      cur.resolved += 1;
      if (typeof t.response_time_minutes === "number") {
        cur.totalResp += t.response_time_minutes;
        cur.withResp += 1;
      }
      agentMap.set(name, cur);
    }

    // Renewal reps
    const renewalRepMap = new Map<string, { count: number; rev: number }>();
    for (const r of renewals) {
      if (r.status !== "مكتمل") continue;
      if (!matchDate(r.updated_at)) continue;
      const name = r.assigned_rep?.trim() || "بلا مسؤول";
      const cur = renewalRepMap.get(name) || { count: 0, rev: 0 };
      cur.count += 1; cur.rev += r.plan_price;
      renewalRepMap.set(name, cur);
    }

    type RankEntry = { name: string; value: number; subValue?: string };

    function rankByCount(map: Map<string, { count: number; rev: number }>) {
      const entries = Array.from(map.entries())
        .filter(([name]) => name !== "بلا مسؤول")
        .map(([name, v]) => ({ name, value: v.count, rev: v.rev, subValue: v.rev > 0 ? formatMoneyFull(v.rev) : undefined }));
      const sorted = [...entries].sort((a, b) => b.value - a.value || b.rev - a.rev);
      return {
        top: sorted[0],
        bottom: sorted.length > 1 ? sorted[sorted.length - 1] : undefined,
        total: entries.length,
      };
    }

    function rankAgents() {
      const entries = Array.from(agentMap.entries())
        .filter(([name]) => name !== "بلا مسؤول")
        .map(([name, v]) => {
          const avg = v.withResp > 0 ? Math.round(v.totalResp / v.withResp) : 0;
          return { name, value: v.resolved, subValue: avg > 0 ? `⏱ ${avg}د` : undefined, avg };
        });
      const sortedTop = [...entries].sort((a, b) => b.value - a.value || a.avg - b.avg);
      // Bottom = slowest agent (highest avg response) among those with response data
      const withResp = entries.filter(e => e.avg > 0);
      const sortedBottom = [...withResp].sort((a, b) => b.avg - a.avg);
      return {
        top: sortedTop[0],
        bottom: sortedBottom.length > 1 ? { ...sortedBottom[0], subValue: `⏱ ${sortedBottom[0].avg}د (أبطأ)` } : undefined,
        total: entries.length,
      };
    }

    const officeRank = rankByCount(officeRepMap);
    const supportRank = rankByCount(supportRepMap);
    const renewalRank = rankByCount(renewalRepMap);
    const ticketRank = rankAgents();

    return {
      office: officeRank as { top?: RankEntry; bottom?: RankEntry; total: number },
      support: supportRank as { top?: RankEntry; bottom?: RankEntry; total: number },
      tickets: ticketRank,
      renewals: renewalRank as { top?: RankEntry; bottom?: RankEntry; total: number },
    };
  }, [deals, renewals, tickets, selectedPeriod, selectedMonth, selectedYear]);

  // Weak departments today — used to auto-schedule a 9 PM review meeting
  const weakDepartments = useMemo(() => {
    const now = new Date();
    // Only flag departments as weak after 3 PM (end-of-day review window)
    if (now.getHours() < 15) return [];

    const todayStr = now.toISOString().slice(0, 10);
    const inToday = (s?: string) => !!s && s.slice(0, 10) === todayStr;
    const weak: { key: string; label: string; attendees: string; reason: string }[] = [];

    const officeCount = deals.filter(d =>
      (d.sales_type === "office" || !d.sales_type) &&
      d.stage === "مكتملة" &&
      inToday(d.close_date || d.created_at)
    ).length;
    if (officeCount === 0) weak.push({ key: "office", label: "مبيعات المكتب", attendees: "فريق مبيعات المكتب", reason: "لا صفقات مغلقة اليوم" });

    const supportCount = deals.filter(d =>
      d.sales_type === "support" &&
      d.stage === "مكتملة" &&
      inToday(d.close_date || d.created_at)
    ).length;
    if (supportCount === 0) weak.push({ key: "support", label: "مبيعات الدعم", attendees: "فريق مبيعات الدعم", reason: "لا صفقات مغلقة اليوم" });

    const resolvedCount = tickets.filter(t =>
      t.status === "محلول" && inToday(t.resolved_date || t.updated_at)
    ).length;
    if (resolvedCount === 0) {
      weak.push({ key: "tickets", label: "الدعم الفني", attendees: "فريق الدعم", reason: "لا تذاكر محلولة اليوم" });
    } else if (supportHealth.avgResponse > 45) {
      weak.push({ key: "tickets", label: "الدعم الفني", attendees: "فريق الدعم", reason: `متوسط استجابة ${supportHealth.avgResponse} دقيقة — بطيء` });
    }

    const renewCount = renewals.filter(r =>
      r.status === "مكتمل" && inToday(r.updated_at)
    ).length;
    if (renewCount === 0) weak.push({ key: "renewals", label: "التجديدات", attendees: "فريق التجديدات", reason: "لا تجديدات مكتملة اليوم" });

    return weak;
  }, [deals, tickets, renewals, supportHealth.avgResponse]);

  // Auto-schedule 10 PM review meeting for each weak department (once, after data loads)
  useEffect(() => {
    if (loading || !dbLoaded.current || autoScheduledRef.current) return;
    if (weakDepartments.length === 0) return;

    const toAdd: MeetingItem[] = [];
    for (const dept of weakDepartments) {
      const title = `مراجعة أداء ${dept.label} — ${dept.reason}`;
      const shortTitle = `مراجعة أداء ${dept.label}`;
      // Dedup: don't add if a meeting with this label (either short or full) already exists for today
      const exists = meetings.some(m => m.title === title || m.title === shortTitle || m.id === `auto-${dept.key}-${todayKey}`);
      if (!exists) {
        toAdd.push({
          id: `auto-${dept.key}-${todayKey}`,
          title,
          time: "22:00",
          attendees: dept.attendees,
          done: false,
        });
      }
    }
    if (toAdd.length > 0) {
      setMeetings(prev => [...prev, ...toAdd]);
      setExpandedSections(prev => ({ ...prev, meetings: true }));
    }
    autoScheduledRef.current = true;
  }, [loading, weakDepartments, meetings, todayKey]);

  // Task management
  function addTask() {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now().toString(), text: newTask.trim(), done: false }]);
    setNewTask("");
  }
  function remindTomorrow(deal: Deal) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
    const text = `📞 متابعة ${deal.client_name} (${deal.stage}) — ${tomorrow}`;
    setTasks(prev => {
      if (prev.some(t => t.text === text)) return prev;
      return [...prev, { id: `r-${deal.id}-${Date.now()}`, text, done: false }];
    });
    setExpandedSections(prev => ({ ...prev, tasks: true }));
  }
  function toggleTask(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }
  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  // Meeting management
  function addMeeting() {
    if (!newMeeting.title.trim() || !newMeeting.time.trim()) return;
    setMeetings(prev => [...prev, { id: Date.now().toString(), title: newMeeting.title.trim(), time: newMeeting.time, attendees: newMeeting.attendees.trim(), done: false }]);
    setNewMeeting({ title: "", time: "", attendees: "" });
  }
  function toggleMeeting(id: string) {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m));
  }
  function removeMeeting(id: string) {
    setMeetings(prev => prev.filter(m => m.id !== id));
  }

  // Quick task management
  function addQuickTask() {
    if (!newQuickTask.trim()) return;
    setQuickTasks(prev => [...prev, { id: Date.now().toString(), text: newQuickTask.trim(), done: false }]);
    setNewQuickTask("");
  }
  function toggleQuickTask(id: string) {
    setQuickTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }
  function removeQuickTask(id: string) {
    setQuickTasks(prev => prev.filter(t => t.id !== id));
  }

  // AI Analysis
  async function runAiAnalysis() {
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const context = {
        deals_total: deals.length,
        deals_closed: deals.filter(d => d.stage === "مكتملة").length,
        deals_pipeline: deals.filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب").length,
        cold_deals: coldDeals.length,
        hot_deals: hotDeals.length,
        warm_deals: warmDeals.length,
        needs_attention: ownerAttention.length,
        tickets_open: supportHealth.openCount,
        tickets_urgent: supportHealth.urgentCount,
        tickets_overdue: supportHealth.overdueCount,
        tickets_unassigned: supportHealth.unassignedCount,
        tickets_new_today: supportHealth.newToday,
        tickets_resolved_today: supportHealth.resolvedToday,
        avg_response_minutes: supportHealth.avgResponse,
        renewals_total: renewals.length,
        renewals_completed: renewalHealth.completed,
        renewals_cancelled: renewalHealth.cancelled,
        churn_rate: renewalHealth.churnRate,
        overdue_renewals: renewalHealth.overdue.length,
        goal_90_pct: goal90.pct,
        goal_90_remaining: goal90.remaining,
        employees_count: employees.length,
        revenue_month: briefingStats.totalRevenueMonth,
        pipeline_value: briefingStats.pipelineCount,
      };
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `أنت السكرتير التنفيذي. حلل البيانات التالية وقدم ملخص تنفيذي مختصر مع 3-5 توصيات عملية فورية. ركز على الأولويات والمخاطر. البيانات: ${JSON.stringify(context)}`,
        }),
      });
      if (!res.ok) throw new Error("AI request failed");

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) { full += parsed.text; setAiAnalysis(full); }
          } catch { /* skip */ }
        }
      }
      if (!full) setAiAnalysis("تم تحليل البيانات. لا توجد مشاكل حرجة حالياً.");
    } catch {
      setAiAnalysis("تعذر الاتصال بالذكاء الاصطناعي. تأكد من إعدادات API.");
    }
    setAiLoading(false);
  }

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-amber-500/20 border border-violet-500/20 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">السكرتير التنفيذي</h1>
            <p className="text-xs text-muted-foreground">{getGreeting()} {user?.name || ""} — {getDayName()}</p>
          </div>
        </div>
        <Button onClick={runAiAnalysis} disabled={aiLoading || loading} className="gap-2 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0">
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          تحليل ذكي شامل
        </Button>
      </div>

      {/* ─── 1. Briefing with Month Filter ─── */}
      <Section id="briefing" title="الملخص والإحصائيات" icon={<Sun className="w-5 h-5 text-amber-400" />} isOpen={expandedSections.briefing !== false} onToggle={toggleSection}>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Multi-period stats (today / yesterday / week / month) ── */}
            <div>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5"><Sun className="w-3.5 h-3.5" /> ملخص الأداء</p>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  {([
                    { key: "today", label: "اليوم" },
                    { key: "yesterday", label: "أمس" },
                    { key: "week", label: "الأسبوع" },
                    { key: "month", label: "الشهر" },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setSelectedPeriod(tab.key)}
                      className={`text-[11px] px-3 py-1 rounded-lg transition-colors ${
                        selectedPeriod === tab.key
                          ? "bg-amber-500/20 text-amber-300 font-bold"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                const s = briefingStats.periods[selectedPeriod];
                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-emerald-400">{s.office}</p>
                      <p className="text-[10px] text-muted-foreground">مبيعات المكتب</p>
                      {s.officeRev > 0 && <p className="text-[10px] text-emerald-400/70 mt-0.5">{formatMoneyFull(s.officeRev)}</p>}
                    </div>
                    <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
                      <TrendingUp className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-orange-400">{s.support}</p>
                      <p className="text-[10px] text-muted-foreground">مبيعات الدعم</p>
                      {s.supportRev > 0 && <p className="text-[10px] text-orange-400/70 mt-0.5">{formatMoneyFull(s.supportRev)}</p>}
                    </div>
                    <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-center">
                      <RefreshCw className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-sky-400">{s.renewals}</p>
                      <p className="text-[10px] text-muted-foreground">تجديدات مكتملة</p>
                      {s.renewalRev > 0 && <p className="text-[10px] text-sky-400/70 mt-0.5">{formatMoneyFull(s.renewalRev)}</p>}
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                      <Headphones className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-rose-400">{s.ticketsNew}</p>
                      <p className="text-[10px] text-muted-foreground">تذاكر جديدة</p>
                      {selectedPeriod === "today" && supportHealth.urgentCount > 0 && <p className="text-[10px] text-red-400/80 mt-0.5">🚨 {supportHealth.urgentCount} عاجلة</p>}
                    </div>
                    <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-center">
                      <CheckSquare className="w-4 h-4 text-teal-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-teal-400">{s.ticketsResolved}</p>
                      <p className="text-[10px] text-muted-foreground">تذاكر محلولة</p>
                      {selectedPeriod === "today" && supportHealth.avgResponse > 0 && <p className="text-[10px] text-teal-400/70 mt-0.5">⏱ {supportHealth.avgResponse}د</p>}
                    </div>
                    <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                      <Banknote className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                      <p className="text-xl font-bold text-cyan-400">{formatMoneyFull(s.totalRev)}</p>
                      <p className="text-[10px] text-muted-foreground">إجمالي الإيرادات</p>
                    </div>
                  </div>
                );
              })()}

              {/* ── Top/Bottom Performers per department ── */}
              <div className="mt-4">
                <p className="text-[11px] font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Users className="w-3 h-3" /> أفضل وأقل أداء ({selectedPeriod === "today" ? "اليوم" : selectedPeriod === "yesterday" ? "أمس" : selectedPeriod === "week" ? "الأسبوع" : "الشهر"})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <PerformerCard
                    title="مبيعات المكتب"
                    accent="emerald"
                    unit="صفقة"
                    data={performers.office}
                  />
                  <PerformerCard
                    title="مبيعات الدعم"
                    accent="orange"
                    unit="صفقة"
                    data={performers.support}
                  />
                  <PerformerCard
                    title="الدعم الفني"
                    accent="rose"
                    unit="تذكرة"
                    data={performers.tickets}
                  />
                  <PerformerCard
                    title="التجديدات"
                    accent="sky"
                    unit="تجديد"
                    data={performers.renewals}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* ── Monthly stats with filter ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-cyan-400 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> إحصائيات الشهر</p>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-cyan-500/50"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                      <option key={m} value={m}>{new Date(2000, m - 1).toLocaleDateString("ar-SA-u-ca-gregory", { month: "long" })}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(Number(e.target.value))}
                    className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-cyan-500/50"
                  >
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Office Sales */}
              <p className="text-[10px] font-bold text-emerald-400 mb-1.5">مبيعات المكتب</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 text-center">
                  <p className="text-lg font-bold text-emerald-400">{briefingStats.closedOffice}</p>
                  <p className="text-[10px] text-muted-foreground">مكتملة</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 text-center">
                  <p className="text-lg font-bold text-emerald-400">{formatMoneyFull(briefingStats.revenueOffice)}</p>
                  <p className="text-[10px] text-muted-foreground">الإيرادات</p>
                </div>
                <div className="p-2.5 rounded-xl bg-violet-500/[0.06] border border-violet-500/15 text-center">
                  <p className="text-lg font-bold text-violet-400">{briefingStats.pipelineCount}</p>
                  <p className="text-[10px] text-muted-foreground">في خط الأنابيب</p>
                </div>
              </div>

              {/* Support Sales */}
              <p className="text-[10px] font-bold text-orange-400 mb-1.5">مبيعات الدعم</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-orange-500/[0.06] border border-orange-500/15 text-center">
                  <p className="text-lg font-bold text-orange-400">{briefingStats.closedSupport}</p>
                  <p className="text-[10px] text-muted-foreground">مكتملة</p>
                </div>
                <div className="p-2.5 rounded-xl bg-orange-500/[0.06] border border-orange-500/15 text-center">
                  <p className="text-lg font-bold text-orange-400">{formatMoneyFull(briefingStats.revenueSupport)}</p>
                  <p className="text-[10px] text-muted-foreground">الإيرادات</p>
                </div>
              </div>

              {/* Renewals */}
              <p className="text-[10px] font-bold text-sky-400 mb-1.5">التجديدات</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-sky-500/[0.06] border border-sky-500/15 text-center">
                  <p className="text-lg font-bold text-sky-400">{briefingStats.completedRenewals}</p>
                  <p className="text-[10px] text-muted-foreground">مكتمل</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/15 text-center">
                  <p className="text-lg font-bold text-amber-400">{briefingStats.pendingRenewals}</p>
                  <p className="text-[10px] text-muted-foreground">معلّق</p>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-500/[0.06] border border-sky-500/15 text-center">
                  <p className="text-lg font-bold text-sky-400">{formatMoneyFull(briefingStats.renewalRevenue)}</p>
                  <p className="text-[10px] text-muted-foreground">الإيرادات</p>
                </div>
              </div>

              {/* Total */}
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                <p className="text-xl font-bold text-cyan-400">{formatMoneyFull(briefingStats.totalRevenueMonth)}</p>
                <p className="text-[10px] text-muted-foreground">إجمالي إيرادات الشهر (مبيعات + تجديدات)</p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ─── 2. Today's Meetings ─── */}
      <Section
        id="meetings"
        title="اجتماعات اليوم"
        icon={<CalendarCheck className="w-5 h-5 text-teal-400" />}
        badge={meetings.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-400">{meetings.filter(m => m.done).length}/{meetings.length}</span> : undefined}
        isOpen={expandedSections.meetings !== false} onToggle={toggleSection}
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newMeeting.title}
              onChange={e => setNewMeeting(prev => ({ ...prev, title: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addMeeting()}
              placeholder="عنوان الاجتماع..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-teal-500/50"
            />
            <input
              type="time"
              value={newMeeting.time}
              onChange={e => setNewMeeting(prev => ({ ...prev, time: e.target.value }))}
              className="w-28 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-teal-500/50"
            />
            <input
              value={newMeeting.attendees}
              onChange={e => setNewMeeting(prev => ({ ...prev, attendees: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && addMeeting()}
              placeholder="الحضور (اختياري)..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-teal-500/50"
            />
            <Button size="sm" onClick={addMeeting} disabled={!newMeeting.title.trim() || !newMeeting.time.trim()} className="bg-teal-600 hover:bg-teal-500 border-0">
              إضافة
            </Button>
          </div>
          {meetings.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد اجتماعات مجدولة اليوم</p>
          ) : (
            <div className="space-y-1.5">
              {[...meetings].sort((a, b) => a.time.localeCompare(b.time)).map(m => {
                const now = new Date();
                const [h, min] = m.time.split(":").map(Number);
                const meetingTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
                const diffMin = Math.round((meetingTime.getTime() - now.getTime()) / 60000);
                const isUpcoming = diffMin > 0 && diffMin <= 30;
                const isPast = diffMin < -30;
                return (
                  <div key={m.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${m.done ? "bg-emerald-500/[0.04] border-emerald-500/15" : isUpcoming ? "bg-teal-500/[0.08] border-teal-500/30 ring-1 ring-teal-500/20" : isPast ? "bg-white/[0.01] border-white/[0.04] opacity-60" : "bg-white/[0.02] border-white/[0.06]"}`}>
                    <button onClick={() => toggleMeeting(m.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${m.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30 hover:border-teal-500/50"}`}>
                      {m.done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-sm font-bold font-mono ${isUpcoming ? "text-teal-400" : m.done ? "text-muted-foreground" : "text-foreground"}`} dir="ltr">{m.time}</span>
                      {isUpcoming && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 animate-pulse">خلال {diffMin} د</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-xs font-medium ${m.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{m.title}</p>
                        {m.id.startsWith("auto-") && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 flex items-center gap-0.5" title="اجتماع مُجدول تلقائياً لأداء ضعيف">
                            <Sparkles className="w-2.5 h-2.5" /> تلقائي
                          </span>
                        )}
                      </div>
                      {m.attendees && <p className="text-[10px] text-muted-foreground">{m.attendees}</p>}
                    </div>
                    <button onClick={() => removeMeeting(m.id)} className="text-muted-foreground hover:text-red-400 text-xs transition-colors shrink-0">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>

      {/* ─── 3. Deal Temperature — Hot / Warm / Cold ─── */}
      <Section
        id="hotCold"
        title="الصفقات الساخنة والباردة"
        icon={<Thermometer className="w-5 h-5 text-orange-400" />}
        badge={!loading ? (
          <span className="flex items-center gap-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">🔥 {hotDeals.length}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">🌤 {warmDeals.length}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">❄️ {coldDeals.length}</span>
          </span>
        ) : undefined}
        isOpen={expandedSections.hotCold !== false} onToggle={toggleSection}
      >
        {loading ? <Skeleton className="h-32 rounded-xl" /> : (
          <div className="space-y-5">
            {/* Owner Attention Banner */}
            {(ownerAttention.length > 0 || repEscalation.length > 0) && (
              <div className="rounded-xl bg-gradient-to-l from-red-500/10 to-orange-500/5 border border-red-500/25 p-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <Zap className="w-4 h-4 text-red-400" />
                  <p className="text-xs font-bold text-red-400">يحتاج تدخّلك الآن</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300">{ownerAttention.length + repEscalation.length}</span>
                </div>
                <div className="space-y-1.5">
                  {ownerAttention.slice(0, 5).map(({ deal: d, intel }) => (
                    <DealRow key={`att-${d.id}`} deal={d} intel={intel} variant="attention" onRemind={remindTomorrow} />
                  ))}
                  {repEscalation.map(([rep, count]) => (
                    <div key={`esc-${rep}`} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/[0.05] border border-red-500/15">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <p className="text-[11px] text-foreground flex-1">
                        <span className="font-bold">{rep}</span> يحمل <span className="font-bold text-red-400">{count}</span> صفقات راكدة — يستحق تصعيد
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hot */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-orange-400 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> ساخنة — قريبة من الإغلاق</p>
                <div className="flex items-center gap-1.5">
                  {hotDeals.length > 0 && (
                    <button
                      onClick={() => shareText("الصفقات الساخنة", buildDealsCategoryShareText(hotDeals, "hot", "الصفقات الساخنة — قريبة من الإغلاق"))}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 transition-colors"
                      title="مشاركة القائمة كاملة"
                    >
                      <Share2 className="w-3 h-3" /> مشاركة
                    </button>
                  )}
                  <span className="text-[10px] text-muted-foreground">{hotDeals.length}</span>
                </div>
              </div>
              {hotDeals.length === 0 ? <p className="text-[11px] text-muted-foreground px-2">لا توجد صفقات ساخنة حالياً</p> : (
                <div className="space-y-1.5">
                  {hotDeals.slice(0, 5).map(({ deal: d, intel }) => (
                    <DealRow key={d.id} deal={d} intel={intel} variant="hot" onRemind={remindTomorrow} />
                  ))}
                  {hotDeals.length > 5 && <p className="text-[10px] text-muted-foreground text-center pt-1">و {hotDeals.length - 5} أخرى — <Link href="/sales" className="text-orange-400 hover:underline">عرض الكل</Link></p>}
                </div>
              )}
            </div>

            {/* Warm — the forgotten high-ROI tier */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><CloudSun className="w-3.5 h-3.5" /> دافئة — منسية وقابلة للإحياء</p>
                <div className="flex items-center gap-1.5">
                  {warmDeals.length > 0 && (
                    <button
                      onClick={() => shareText("الصفقات الدافئة", buildDealsCategoryShareText(warmDeals, "warm", "الصفقات الدافئة — قابلة للإحياء"))}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-400/20 transition-colors"
                      title="مشاركة القائمة كاملة"
                    >
                      <Share2 className="w-3 h-3" /> مشاركة
                    </button>
                  )}
                  <span className="text-[10px] text-muted-foreground">{warmDeals.length}</span>
                </div>
              </div>
              {warmDeals.length === 0 ? <p className="text-[11px] text-muted-foreground px-2">لا توجد صفقات دافئة</p> : (
                <div className="space-y-1.5">
                  {warmDeals.slice(0, 5).map(({ deal: d, intel }) => (
                    <DealRow key={d.id} deal={d} intel={intel} variant="warm" onRemind={remindTomorrow} />
                  ))}
                  {warmDeals.length > 5 && <p className="text-[10px] text-muted-foreground text-center pt-1">و {warmDeals.length - 5} أخرى — <Link href="/sales" className="text-amber-300 hover:underline">عرض الكل</Link></p>}
                </div>
              )}
            </div>

            {/* Cold / Stale */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-blue-400 flex items-center gap-1.5"><Snowflake className="w-3.5 h-3.5" /> باردة / راكدة</p>
                <div className="flex items-center gap-1.5">
                  {coldDeals.length > 0 && (
                    <button
                      onClick={() => shareText("الصفقات الباردة", buildDealsCategoryShareText(coldDeals, "cold", "الصفقات الباردة / الراكدة"))}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors"
                      title="مشاركة القائمة كاملة"
                    >
                      <Share2 className="w-3 h-3" /> مشاركة
                    </button>
                  )}
                  <span className="text-[10px] text-muted-foreground">{coldDeals.length}</span>
                </div>
              </div>
              {coldDeals.length === 0 ? <p className="text-[11px] text-muted-foreground px-2">لا توجد صفقات راكدة</p> : (
                <div className="space-y-1.5">
                  {coldDeals.slice(0, 5).map(({ deal: d, intel }) => (
                    <DealRow key={d.id} deal={d} intel={intel} variant="cold" onRemind={remindTomorrow} />
                  ))}
                  {coldDeals.length > 5 && <p className="text-[10px] text-muted-foreground text-center pt-1">و {coldDeals.length - 5} أخرى — <Link href="/sales" className="text-blue-400 hover:underline">عرض الكل</Link></p>}
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ─── 3b. Support Health (Tickets) ─── */}
      <Section
        id="supportHealth"
        title="صحة الدعم"
        icon={<Headphones className="w-5 h-5 text-orange-400" />}
        badge={!loading ? (
          <span className="flex items-center gap-1">
            {supportHealth.urgentCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">🚨 {supportHealth.urgentCount}</span>}
            {supportHealth.overdueCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">⏰ {supportHealth.overdueCount}</span>}
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">{supportHealth.openCount} مفتوحة</span>
          </span>
        ) : undefined}
        isOpen={expandedSections.supportHealth !== false} onToggle={toggleSection}
      >
        {loading ? <Skeleton className="h-32 rounded-xl" /> : (
          <div className="space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <AlertTriangle className="w-4 h-4 text-red-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-red-400">{supportHealth.urgentCount}</p>
                <p className="text-[10px] text-muted-foreground">عاجلة مفتوحة</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <Clock className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-amber-400">{supportHealth.overdueCount}</p>
                <p className="text-[10px] text-muted-foreground">متأخرة &gt; 3 أيام</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                <UserX className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-purple-400">{supportHealth.unassignedCount}</p>
                <p className="text-[10px] text-muted-foreground">بلا مسؤول</p>
              </div>
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                <Timer className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                <p className="text-xl font-bold text-cyan-400">{supportHealth.avgResponse > 0 ? `${supportHealth.avgResponse}د` : "—"}</p>
                <p className="text-[10px] text-muted-foreground">متوسط الاستجابة</p>
              </div>
            </div>

            {/* Today mini-stats */}
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground border-y border-white/[0.04] py-2">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> جديد اليوم: <span className="font-bold text-foreground">{supportHealth.newToday}</span></span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> محلول اليوم: <span className="font-bold text-foreground">{supportHealth.resolvedToday}</span></span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> إجمالي مفتوح: <span className="font-bold text-foreground">{supportHealth.openCount}</span></span>
            </div>

            {/* Overloaded agents */}
            {supportHealth.overloadedAgents.length > 0 && (
              <div className="rounded-xl bg-red-500/[0.05] border border-red-500/20 p-3">
                <p className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> وكلاء بحمل زائد</p>
                <div className="space-y-1">
                  {supportHealth.overloadedAgents.map(([agent, count]) => (
                    <div key={agent} className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/[0.02]">
                      <span className="text-[11px] text-foreground">{agent}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold">{count} تذاكر مفتوحة</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attention list */}
            <div>
              <p className="text-xs font-bold text-orange-400 mb-2 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> تذاكر تحتاج تدخّل</p>
              {supportHealth.attention.length === 0 ? (
                <p className="text-[11px] text-muted-foreground px-2 py-2">لا توجد تذاكر حرجة — الوضع ممتاز 👌</p>
              ) : (
                <div className="space-y-1.5">
                  {supportHealth.attention.slice(0, 6).map(({ ticket: t, reason, severity }) => {
                    const phone = sanitizePhone(t.client_phone);
                    const borderClr = severity === "high" ? "border-red-500/25 bg-red-500/[0.05]" : "border-amber-500/25 bg-amber-500/[0.04]";
                    const labelClr = severity === "high" ? "text-red-300" : "text-amber-300";
                    return (
                      <div key={t.id} className={`rounded-lg ${borderClr} border px-3 py-2.5`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-bold text-foreground truncate">{t.client_name}</p>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.05] ${labelClr}`}>{t.priority}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.03] text-muted-foreground">{t.status}</span>
                            </div>
                            <p className="text-[11px] text-foreground/85 mt-1 line-clamp-2">{t.issue}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">{t.assigned_agent_name || "بلا مسؤول"}</span>
                              <span className="text-[10px] text-muted-foreground">•</span>
                              <span className={`text-[10px] ${labelClr}`}>{reason}</span>
                            </div>
                          </div>
                        </div>
                        {/* Quick actions */}
                        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-white/[0.04]">
                          {phone ? (
                            <a href={`tel:${phone}`} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors">
                              <Phone className="w-3 h-3" /> اتصل
                            </a>
                          ) : (
                            <span className="text-[10px] px-2 py-1 rounded-md bg-white/[0.03] text-muted-foreground/60 border border-white/[0.04]">بلا رقم</span>
                          )}
                          {phone && (
                            <a
                              href={whatsappLink(phone, `مرحبًا ${t.client_name}، بخصوص طلبكم لدى الدعم — نتابع معكم لحلّه بأسرع وقت.`)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" /> واتساب
                            </a>
                          )}
                          <Link
                            href="/support"
                            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-muted-foreground border border-white/[0.06] transition-colors mr-auto"
                          >
                            <ExternalLink className="w-3 h-3" /> فتح
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                  {supportHealth.attention.length > 6 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                      و {supportHealth.attention.length - 6} أخرى — <Link href="/support" className="text-orange-400 hover:underline">عرض الكل</Link>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* ─── 3. Renewal Health ─── */}
      <Section
        id="renewalHealth"
        title="صحة التجديدات"
        icon={<ShieldAlert className="w-5 h-5 text-sky-400" />}
        badge={!loading && renewalHealth.overdue.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{renewalHealth.overdue.length} متأخر</span> : undefined}
        isOpen={expandedSections.renewalHealth !== false} onToggle={toggleSection}
      >
        {loading ? <Skeleton className="h-32 rounded-xl" /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-xl font-bold text-emerald-400">{renewalHealth.completed}</p>
                <p className="text-[10px] text-muted-foreground">مكتمل</p>
              </div>
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-xl font-bold text-red-400">{renewalHealth.cancelled}</p>
                <p className="text-[10px] text-muted-foreground">ملغي ({renewalHealth.churnRate}%)</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-xl font-bold text-amber-400">{renewalHealth.dueSoon.length}</p>
                <p className="text-[10px] text-muted-foreground">يستحق خلال 7 أيام</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                <p className="text-xl font-bold text-rose-400">{renewalHealth.overdue.length}</p>
                <p className="text-[10px] text-muted-foreground">متأخر</p>
              </div>
            </div>
            {renewalHealth.overdue.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-400 mb-2">⚠️ تجديدات متأخرة تحتاج تواصل فوري:</p>
                <div className="space-y-1.5">
                  {renewalHealth.overdue.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-500/[0.06] border border-red-500/15">
                      <div>
                        <p className="text-xs font-medium text-foreground">{r.customer_name}</p>
                        <p className="text-[10px] text-muted-foreground">{r.plan_name} · {r.assigned_rep || "—"}</p>
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold text-red-400">{formatMoneyFull(r.plan_price)}</span>
                        {r.customer_phone && <p className="text-[10px] text-muted-foreground font-mono" dir="ltr">{r.customer_phone}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ─── 4. Today's Priorities ─── */}
      <Section
        id="priorities"
        title="أولويات اليوم"
        icon={<Target className="w-5 h-5 text-red-400" />}
        badge={!loading ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{priorities.filter(p => p.urgency === "high").length} عاجل</span> : undefined}
        isOpen={expandedSections.priorities !== false} onToggle={toggleSection}
      >
        {loading ? <Skeleton className="h-40 rounded-xl" /> : priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد أولويات عاجلة — أداء ممتاز!</p>
        ) : (
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${URGENCY_STYLE[p.urgency]}`}>
                <span className="text-base">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground">{p.detail}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${URGENCY_TEXT[p.urgency]} bg-white/5`}>{URGENCY_LABEL[p.urgency]}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── 5. 90-Day Goal Tracker ─── */}
      <Section id="goal90" title="تتبع هدف الـ 90 يوم" icon={<BarChart3 className="w-5 h-5 text-cyan-400" />} isOpen={expandedSections.goal90 !== false} onToggle={toggleSection}>
        {loading ? <Skeleton className="h-24 rounded-xl" /> : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">المحقق: {formatMoneyFull(goal90.total)} من {formatMoneyFull(GOAL_90DAY)}</span>
              <span className={`text-sm font-bold ${goal90.pct >= 100 ? "text-emerald-400" : goal90.pct >= 70 ? "text-cyan-400" : "text-amber-400"}`}>{goal90.pct}%</span>
            </div>
            <div className="h-4 bg-white/[0.04] rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-700 ${goal90.pct >= 100 ? "bg-gradient-to-l from-emerald-400 to-emerald-600" : goal90.pct >= 70 ? "bg-gradient-to-l from-cyan-400 to-cyan-600" : "bg-gradient-to-l from-amber-400 to-amber-600"}`}
                style={{ width: `${Math.min(goal90.pct, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                <p className="text-sm font-bold text-foreground">{formatMoneyFull(goal90.remaining)}</p>
                <p className="text-[10px] text-muted-foreground">المتبقي</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                <p className="text-sm font-bold text-foreground">{goal90.daysLeft}</p>
                <p className="text-[10px] text-muted-foreground">يوم متبقي</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/[0.03]">
                <p className="text-sm font-bold text-foreground">{goal90.closedDeals}</p>
                <p className="text-[10px] text-muted-foreground">صفقة مغلقة</p>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ─── 7. Quick Tasks (< 15 min) ─── */}
      <Section
        id="quickTasks"
        title="مهام سريعة (أقل من 15 دقيقة)"
        icon={<Clock className="w-5 h-5 text-amber-400" />}
        badge={quickTasks.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{quickTasks.filter(t => t.done).length}/{quickTasks.length}</span> : undefined}
        isOpen={expandedSections.quickTasks !== false} onToggle={toggleSection}
      >
        <div className="space-y-3">
          <p className="text-[10px] text-amber-400/70">مهام تحتاج إجراء فوري ولا تستغرق أكثر من 15 دقيقة — أنجزها الحين!</p>
          <div className="flex gap-2">
            <input
              value={newQuickTask}
              onChange={e => setNewQuickTask(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addQuickTask()}
              placeholder="رد على إيميل، اتصال سريع، مراجعة مستند..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50"
            />
            <Button size="sm" onClick={addQuickTask} disabled={!newQuickTask.trim()} className="bg-amber-600 hover:bg-amber-500 border-0 text-black">
              إضافة
            </Button>
          </div>
          {quickTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد مهام سريعة — أضف مهام تنجزها بسرعة</p>
          ) : (
            <div className="space-y-1.5">
              {quickTasks.map(t => (
                <div key={t.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all ${t.done ? "bg-emerald-500/[0.04] border-emerald-500/15" : "bg-amber-500/[0.03] border-amber-500/10"}`}>
                  <button onClick={() => toggleQuickTask(t.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-amber-500/40 hover:border-amber-500/70"}`}>
                    {t.done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${t.done ? "text-muted-foreground" : "text-amber-400/60"}`} />
                  <span className={`flex-1 text-xs ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
                  <button onClick={() => removeQuickTask(t.id)} className="text-muted-foreground hover:text-red-400 text-xs transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
          {quickTasks.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-all" style={{ width: `${Math.round((quickTasks.filter(t => t.done).length / quickTasks.length) * 100)}%` }} />
              </div>
              {quickTasks.every(t => t.done) && <span className="text-[10px] text-emerald-400 font-bold">ممتاز!</span>}
            </div>
          )}
        </div>
      </Section>

      {/* ─── 8. Interactive Tasks ─── */}
      <Section
        id="tasks"
        title="مهام اليوم"
        icon={<CheckSquare className="w-5 h-5 text-indigo-400" />}
        badge={tasks.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">{tasks.filter(t => t.done).length}/{tasks.length}</span> : undefined}
        isOpen={expandedSections.tasks !== false} onToggle={toggleSection}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTask()}
              placeholder="أضف مهمة جديدة..."
              className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
            />
            <Button size="sm" onClick={addTask} disabled={!newTask.trim()} className="bg-indigo-600 hover:bg-indigo-500 border-0">
              إضافة
            </Button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد مهام — أضف مهام يومك</p>
          ) : (
            <div className="space-y-1.5">
              {tasks.map(t => (
                <div key={t.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all ${t.done ? "bg-emerald-500/[0.04] border-emerald-500/15" : "bg-white/[0.02] border-white/[0.06]"}`}>
                  <button onClick={() => toggleTask(t.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/30 hover:border-indigo-500/50"}`}>
                    {t.done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                  <span className={`flex-1 text-xs ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.text}</span>
                  <button onClick={() => removeTask(t.id)} className="text-muted-foreground hover:text-red-400 text-xs transition-colors">✕</button>
                </div>
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-l from-indigo-400 to-indigo-600 rounded-full transition-all" style={{ width: `${Math.round((tasks.filter(t => t.done).length / tasks.length) * 100)}%` }} />
            </div>
          )}
        </div>
      </Section>

      {/* ─── 9. Employee Attendance ─── */}
      <Section
        id="attendance"
        title="سجل الموظفين"
        icon={<LogIn className="w-5 h-5 text-violet-400" />}
        badge={loginLogs.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{loginLogs.filter(l => isToday(l.login_at)).length} اليوم</span> : undefined}
        isOpen={expandedSections.attendance !== false} onToggle={toggleSection}
      >
        {(() => {
          const activeEmps = employees.filter(e => e.status === "نشط");
          const empSummary = activeEmps.map(emp => {
            const lastLogin = loginLogs.find(l => l.user_name === emp.name);
            const lastAction = activityLogs.find(l => l.user_name === emp.name);
            return { emp, lastLogin, lastAction };
          }).sort((a, b) => {
            const aTime = a.lastLogin?.login_at || "0";
            const bTime = b.lastLogin?.login_at || "0";
            return bTime.localeCompare(aTime);
          });

          const todayLogins = loginLogs.filter(l => isToday(l.login_at));

          const loginGroups: { date: string; logins: UserLoginLog[] }[] = [];
          const loginMap = new Map<string, UserLoginLog[]>();
          for (const l of loginLogs.slice(0, 200)) {
            const key = toLocalDateStr(l.login_at);
            if (!loginMap.has(key)) loginMap.set(key, []);
            loginMap.get(key)!.push(l);
          }
          for (const [date, logins] of loginMap) {
            loginGroups.push({ date, logins });
          }

          const isMobile = (ua?: string) => ua && /mobile|android|iphone/i.test(ua);

          return (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-violet-500/[0.06] border border-violet-500/15 p-3 text-center">
                  <p className="text-xl font-bold text-foreground">{todayLogins.length}</p>
                  <p className="text-[10px] text-muted-foreground">دخول اليوم</p>
                </div>
                <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 p-3 text-center">
                  <p className="text-xl font-bold text-emerald-400">{empSummary.filter(e => e.lastLogin && (Date.now() - new Date(e.lastLogin.login_at).getTime()) < 24 * 60 * 60 * 1000).length}</p>
                  <p className="text-[10px] text-muted-foreground">نشط آخر 24 ساعة</p>
                </div>
                <div className="rounded-lg bg-red-500/[0.06] border border-red-500/15 p-3 text-center">
                  <p className="text-xl font-bold text-red-400">{empSummary.filter(e => !e.lastLogin || (Date.now() - new Date(e.lastLogin.login_at).getTime()) >= 24 * 60 * 60 * 1000).length}</p>
                  <p className="text-[10px] text-muted-foreground">غير نشط</p>
                </div>
              </div>

              {/* Employee Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {empSummary.map(({ emp, lastLogin, lastAction }) => {
                  const hasLogin = !!lastLogin;
                  const loginDiff = hasLogin ? (Date.now() - new Date(lastLogin.login_at).getTime()) / (1000 * 60 * 60) : Infinity;
                  const statusColor = loginDiff < 1 ? "bg-emerald-400" : loginDiff < 24 ? "bg-amber-400" : "bg-red-400";

                  return (
                    <div key={emp.id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3.5 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm">
                            {emp.name.charAt(0)}
                          </div>
                          <span className={`absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-background ${statusColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{emp.name}</p>
                          {emp.role && <p className="text-[10px] text-muted-foreground">{emp.role}</p>}
                        </div>
                        {lastLogin && isMobile(lastLogin.user_agent) ? (
                          <Smartphone className="w-3.5 h-3.5 text-muted-foreground/50" />
                        ) : lastLogin ? (
                          <Monitor className="w-3.5 h-3.5 text-muted-foreground/50" />
                        ) : null}
                      </div>

                      <div className="space-y-1 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <LogIn className="w-3 h-3 text-violet-400" />
                          <span className="text-muted-foreground">آخر دخول:</span>
                          <span className={`font-medium ${hasLogin ? "text-foreground" : "text-red-400"}`}>
                            {hasLogin ? formatTimeAgo(lastLogin.login_at) : "لم يسجل دخول"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3 h-3 text-amber-400" />
                          <span className="text-muted-foreground">آخر إجراء:</span>
                          {lastAction ? (
                            <span className="text-foreground font-medium truncate">
                              {lastAction.section_label} — {lastAction.entity_title || lastAction.details?.slice(0, 30)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">لا يوجد</span>
                          )}
                        </div>
                        {lastAction && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-muted-foreground/50" />
                            <span className="text-muted-foreground">{formatTimeAgo(lastAction.created_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Login Timeline */}
              {loginGroups.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <LogIn className="w-3.5 h-3.5 text-violet-400" />
                    سجل الدخول
                  </h4>
                  {loginGroups.map(({ date, logins }) => (
                    <div key={date} className="space-y-1.5">
                      <p className="text-[11px] font-bold text-muted-foreground">{formatDateGroupSec(date)}</p>
                      {logins.map(l => (
                        <div key={l.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                          <div className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                          <div className="w-7 h-7 rounded-full bg-violet-500/10 border border-violet-500/15 flex items-center justify-center text-violet-400 text-[10px] font-bold shrink-0">
                            {l.user_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground">{l.user_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {isMobile(l.user_agent) ? (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Smartphone className="w-2.5 h-2.5" /> جوال</span>
                              ) : (
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><Monitor className="w-2.5 h-2.5" /> كمبيوتر</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatTimeAgo(l.login_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {loginLogs.length === 0 && (
                <div className="text-center py-6">
                  <LogIn className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">لا توجد سجلات دخول</p>
                </div>
              )}
            </div>
          );
        })()}
      </Section>

      {/* ─── 7. AI Analysis Result ─── */}
      {(aiAnalysis || aiLoading) && (
        <div className="cc-card rounded-xl p-5 border border-violet-500/20 bg-gradient-to-l from-violet-500/[0.04] to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-foreground">التحليل الذكي</h3>
            {aiLoading && <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
          </div>
          <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {aiAnalysis || "جاري التحليل..."}
          </div>
        </div>
      )}
    </div>
  );
}
