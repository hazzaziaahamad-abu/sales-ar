"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BrainCircuit, Sun, Flame, Snowflake, ShieldAlert, CalendarCheck,
  Target, CheckSquare, Sparkles, TrendingUp, TrendingDown, Clock,
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Users, Banknote, BarChart3, Phone, ArrowLeft, ArrowRight,
  MessageCircle, Bell, Share2, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { fetchDeals, fetchRenewals, fetchEmployees, fetchRecentFollowUpNotes } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { formatMoneyFull } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Deal, Renewal, Employee } from "@/types";

/* ─── Constants ─── */
const GOAL_90DAY = 70000;
const WEEKLY_TARGET = 17500;

/* ─── Helpers ─── */
function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}
function getDayName() {
  return new Date().toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء الخير";
  return "مساء النور";
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

export default function SecretaryPage() {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recentNotes, setRecentNotes] = useState<{ entity_id: string; note: string; author_name: string; created_at: string; entity_name?: string; entity_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    briefing: true, hotCold: true, renewalHealth: true, priorities: true,
    goal90: true, tasks: true,
  });

  // Tasks persisted in localStorage
  const taskKey = `secretary_tasks_${new Date().toISOString().slice(0, 10)}`;
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(taskKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    if (tasks.length > 0) localStorage.setItem(taskKey, JSON.stringify(tasks));
  }, [tasks, taskKey]);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDeals(), fetchRenewals(), fetchEmployees(), fetchRecentFollowUpNotes(50)])
      .then(([d, r, e, n]) => { setDeals(d); setRenewals(r); setEmployees(e); setRecentNotes(n); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  /* ═══════════════════════════════════════
     COMPUTED DATA
  ═══════════════════════════════════════ */

  // Hot deals (close to closing)
  const hotDeals = useMemo(() =>
    deals.filter(d => d.stage === "انتظار الدفع" || (d.stage === "تفاوض" && d.deal_value >= 500))
      .sort((a, b) => b.deal_value - a.deal_value).slice(0, 5),
  [deals]);

  // Cold deals (stale > 14 days)
  const coldDeals = useMemo(() =>
    deals.filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب" && d.cycle_days > 14)
      .sort((a, b) => b.cycle_days - a.cycle_days).slice(0, 5),
  [deals]);

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
    hotDeals.filter(d => d.stage === "انتظار الدفع").forEach(d => {
      p.push({ icon: "💰", title: `بانتظار الدفع: ${d.client_name}`, detail: `${formatMoneyFull(d.deal_value)}`, urgency: "high", section: "sales" });
    });

    // Cold deals
    coldDeals.slice(0, 3).forEach(d => {
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

    return p.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.urgency] - order[b.urgency];
    });
  }, [hotDeals, coldDeals, renewalHealth]);

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

  // Daily briefing stats
  const briefingStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const thisMonth = new Date().getMonth() + 1;
    const thisYear = new Date().getFullYear();
    const monthDeals = deals.filter(d => d.month === thisMonth && d.year === thisYear);
    const closedMonth = monthDeals.filter(d => d.stage === "مكتملة");
    const revenueMonth = closedMonth.reduce((s, d) => s + d.deal_value, 0);
    const pipeline = monthDeals.filter(d => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب");
    const pipelineValue = pipeline.reduce((s, d) => s + d.deal_value, 0);
    const pendingRenewals = renewals.filter(r => r.status !== "مكتمل" && r.status !== "ملغي بسبب").length;
    return { closedMonth: closedMonth.length, revenueMonth, pipelineCount: pipeline.length, pipelineValue, pendingRenewals };
  }, [deals, renewals]);

  // Task management
  function addTask() {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now().toString(), text: newTask.trim(), done: false }]);
    setNewTask("");
  }
  function toggleTask(id: string) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }
  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
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
        renewals_total: renewals.length,
        renewals_completed: renewalHealth.completed,
        renewals_cancelled: renewalHealth.cancelled,
        churn_rate: renewalHealth.churnRate,
        overdue_renewals: renewalHealth.overdue.length,
        goal_90_pct: goal90.pct,
        goal_90_remaining: goal90.remaining,
        employees_count: employees.length,
        revenue_month: briefingStats.revenueMonth,
        pipeline_value: briefingStats.pipelineValue,
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
     SECTION COMPONENT
  ═══════════════════════════════════════ */
  function Section({ id, title, icon, children, badge }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode; badge?: React.ReactNode }) {
    const isOpen = expandedSections[id] !== false;
    return (
      <div className="cc-card rounded-xl overflow-hidden">
        <button onClick={() => toggleSection(id)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
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

  const urgencyStyle = { high: "border-red-500/30 bg-red-500/[0.06]", medium: "border-amber-500/30 bg-amber-500/[0.06]", low: "border-blue-500/30 bg-blue-500/[0.06]" };
  const urgencyText = { high: "text-red-400", medium: "text-amber-400", low: "text-blue-400" };
  const urgencyLabel = { high: "عاجل", medium: "متوسط", low: "عادي" };

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

      {/* ─── 1. Daily Briefing ─── */}
      <Section id="briefing" title="الملخص اليومي" icon={<Sun className="w-5 h-5 text-amber-400" />}>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-emerald-400">{briefingStats.closedMonth}</p>
              <p className="text-[10px] text-muted-foreground">صفقة مكتملة</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
              <Banknote className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-cyan-400">{formatMoneyFull(briefingStats.revenueMonth)}</p>
              <p className="text-[10px] text-muted-foreground">إيرادات الشهر</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-center">
              <BarChart3 className="w-4 h-4 text-violet-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-violet-400">{briefingStats.pipelineCount}</p>
              <p className="text-[10px] text-muted-foreground">في خط الأنابيب</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <RefreshCw className="w-4 h-4 text-amber-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-amber-400">{briefingStats.pendingRenewals}</p>
              <p className="text-[10px] text-muted-foreground">تجديد معلّق</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
              <Users className="w-4 h-4 text-rose-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-rose-400">{employees.length}</p>
              <p className="text-[10px] text-muted-foreground">فريق العمل</p>
            </div>
          </div>
        )}
      </Section>

      {/* ─── 2. Hot & Cold Deals ─── */}
      <Section
        id="hotCold"
        title="الصفقات الساخنة والباردة"
        icon={<Flame className="w-5 h-5 text-orange-400" />}
        badge={!loading ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">{hotDeals.length} ساخنة · {coldDeals.length} باردة</span> : undefined}
      >
        {loading ? <Skeleton className="h-32 rounded-xl" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hot */}
            <div>
              <p className="text-xs font-bold text-orange-400 mb-2 flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> صفقات ساخنة (قريبة من الإغلاق)</p>
              {hotDeals.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد صفقات ساخنة</p> : (
                <div className="space-y-1.5">
                  {hotDeals.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-500/[0.06] border border-orange-500/15">
                      <div>
                        <p className="text-xs font-medium text-foreground">{d.client_name}</p>
                        <p className="text-[10px] text-muted-foreground">{d.stage} · {d.assigned_rep_name || "—"}</p>
                      </div>
                      <span className="text-xs font-bold text-orange-400">{formatMoneyFull(d.deal_value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Cold */}
            <div>
              <p className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1.5"><Snowflake className="w-3.5 h-3.5" /> صفقات باردة (راكدة)</p>
              {coldDeals.length === 0 ? <p className="text-xs text-muted-foreground">لا توجد صفقات راكدة</p> : (
                <div className="space-y-1.5">
                  {coldDeals.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-blue-500/[0.06] border border-blue-500/15">
                      <div>
                        <p className="text-xs font-medium text-foreground">{d.client_name}</p>
                        <p className="text-[10px] text-muted-foreground">{d.stage} · {d.assigned_rep_name || "—"}</p>
                      </div>
                      <span className="text-xs font-bold text-blue-400">{d.cycle_days} يوم</span>
                    </div>
                  ))}
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
      >
        {loading ? <Skeleton className="h-40 rounded-xl" /> : priorities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد أولويات عاجلة — أداء ممتاز!</p>
        ) : (
          <div className="space-y-2">
            {priorities.map((p, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${urgencyStyle[p.urgency]}`}>
                <span className="text-base">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground">{p.detail}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${urgencyText[p.urgency]} bg-white/5`}>{urgencyLabel[p.urgency]}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── 5. 90-Day Goal Tracker ─── */}
      <Section id="goal90" title="تتبع هدف الـ 90 يوم" icon={<BarChart3 className="w-5 h-5 text-cyan-400" />}>
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

      {/* ─── 6. Interactive Tasks ─── */}
      <Section
        id="tasks"
        title="مهام اليوم"
        icon={<CheckSquare className="w-5 h-5 text-indigo-400" />}
        badge={tasks.length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">{tasks.filter(t => t.done).length}/{tasks.length}</span> : undefined}
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
