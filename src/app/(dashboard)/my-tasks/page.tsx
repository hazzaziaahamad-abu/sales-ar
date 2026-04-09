"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchEmployeeTasks,
  createEmployeeTask,
  updateEmployeeTask,
  fetchMyTaskStats,
  fetchTeamTaskStats,
  fetchUserProfiles,
  submitPendingDeal,
  fetchDeals,
  fetchPendingDeals,
  getOrgId,
  generateDailyAutoTasks,
  fetchWeeklyTaskStats,
  fetchAllRepsDailyStats,
  fetchDailyTasksTemplate,
  upsertDailyTasksTemplate,
  type DailyTaskTemplate,
} from "@/lib/supabase/db";
import { SOURCES, PLANS } from "@/lib/utils/constants";
import { formatMoney } from "@/lib/utils/format";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Phone,
  Trophy,
  Flame,
  Star,
  Target,
  Zap,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Sparkles,
  Plus,
  UserPlus,
  ArrowUpRight,
  Send,
  X,
  Users,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Eye,
  Settings,
  Trash2,
  ChevronDown,
  Hourglass,
} from "lucide-react";
import type { EmployeeTask } from "@/types";

/* ─── Motivational Quotes ─── */
const MOTIVATIONAL_QUOTES = [
  { text: "النجاح ليس نهائياً والفشل ليس قاتلاً، الشجاعة للاستمرار هي ما يهم", author: "ونستون تشرشل" },
  { text: "لا تنتظر الفرصة، اصنعها بنفسك", author: "جورج برنارد شو" },
  { text: "كل إنجاز عظيم بدأ بقرار المحاولة", author: "جون كينيدي" },
  { text: "العمل الجاد يهزم الموهبة عندما لا تعمل الموهبة بجد", author: "تيم نوتكي" },
  { text: "الطريقة الوحيدة للقيام بعمل عظيم هي أن تحب ما تفعله", author: "ستيف جوبز" },
  { text: "لا تحكم على كل يوم بالحصاد الذي تجنيه بل بالبذور التي تزرعها", author: "روبرت لويس ستيفنسون" },
  { text: "النجاح يأتي من الاستعداد والعمل الجاد والتعلم من الفشل", author: "كولن باول" },
  { text: "ابدأ من حيث أنت، استخدم ما لديك، افعل ما تستطيع", author: "آرثر آش" },
  { text: "الثقة تأتي ليس من كونك دائماً على حق بل من عدم الخوف من أن تكون مخطئاً", author: "بيتر ماكنتاير" },
  { text: "كل يوم هو فرصة جديدة لتكون أفضل من الأمس", author: "حكمة" },
  { text: "لا تقارن نفسك بالآخرين، قارن نفسك بمن كنت بالأمس", author: "جوردان بيترسون" },
  { text: "الفوز ليس كل شيء، لكن الرغبة في الفوز هي كل شيء", author: "فينس لومباردي" },
  { text: "الإنتاجية ليست في إنجاز المزيد بل في إنجاز ما يهم", author: "تيم فيريس" },
  { text: "خطوة واحدة كل يوم تأخذك لأبعد مما تتخيل", author: "حكمة عربية" },
  { text: "التميز ليس عملاً بل عادة، نحن ما نفعله بشكل متكرر", author: "أرسطو" },
  { text: "كن التغيير الذي تريد أن تراه في العالم", author: "غاندي" },
  { text: "الصبر والمثابرة لهما تأثير سحري يمكنه تذليل الصعوبات", author: "جون أدامز" },
  { text: "لا يهم كم تسير ببطء ما دمت لا تتوقف", author: "كونفوشيوس" },
  { text: "إذا كنت تمر بوقت عصيب فاستمر في المشي", author: "ونستون تشرشل" },
  { text: "أنت أقوى مما تعتقد وأقدر مما تتصور", author: "حكمة" },
  { text: "العملاء الراضون هم أفضل إعلان لك", author: "فيليب كوتلر" },
  { text: "اجعل كل عميل يشعر أنه الأهم", author: "ريتز كارلتون" },
  { text: "خدمة العميل ليست قسماً بل هي مسؤولية الجميع", author: "توني هسيه" },
  { text: "اعمل بصمت ودع نجاحك يتكلم", author: "فرانك أوشن" },
  { text: "الفرق بين العادي والاستثنائي هو ذلك الجهد الإضافي الصغير", author: "جيمي جونسون" },
  { text: "ليس هناك مصعد للنجاح، عليك أن تصعد السلم درجة درجة", author: "زيغ زيغلار" },
  { text: "حوّل جراحك إلى حكمة", author: "أوبرا وينفري" },
  { text: "المستقبل ملك لمن يؤمنون بجمال أحلامهم", author: "إليانور روزفلت" },
  { text: "النجاح هو الانتقال من فشل إلى فشل دون فقدان الحماس", author: "ونستون تشرشل" },
  { text: "كل خبير كان مبتدئاً في يوم من الأيام", author: "هيلين هايز" },
  { text: "اجعل هدفك أكبر من خوفك", author: "حكمة" },
];

/* ─── Hourly Productivity Tips ─── */
const HOURLY_TIPS: Record<number, { tip: string; emoji: string }> = {
  7:  { tip: "صباح الإنجاز! ابدأ بأصعب مهمة وأنت في قمة تركيزك", emoji: "🌅" },
  8:  { tip: "الساعة الذهبية — ركّز على مهمة واحدة بدون مقاطعات", emoji: "🎯" },
  9:  { tip: "التركيز العميق يبدأ الآن. أغلق الإشعارات وانطلق", emoji: "🧠" },
  10: { tip: "أنت في ذروة الإنتاجية الصباحية. استثمر كل دقيقة", emoji: "⚡" },
  11: { tip: "قبل الظهر — أنجز المهام المعقدة قبل ما يبدأ التعب", emoji: "🔥" },
  12: { tip: "وقت الاستراحة! خذ نفس عميق وجدد طاقتك", emoji: "☕" },
  13: { tip: "بعد الغداء — ابدأ بمهمة خفيفة لاستعادة التركيز", emoji: "🌿" },
  14: { tip: "اعمل على المهام المتوسطة. المهام الصعبة خلّها للصباح", emoji: "📋" },
  15: { tip: "راجع إنجازاتك اليوم. كل مهمة أنجزتها = خطوة للأمام", emoji: "📊" },
  16: { tip: "الساعة الأخيرة — أنهِ المهام المعلقة وجهّز لبكرة", emoji: "🏁" },
  17: { tip: "رتّب مهام بكرة الآن. التخطيط المسبق = يوم منتج", emoji: "📝" },
  18: { tip: "أحسنت! استرح واشحن طاقتك ليوم إنتاجي جديد", emoji: "🌙" },
};
function getHourlyTip(): { tip: string; emoji: string } {
  const h = new Date().getHours();
  return HOURLY_TIPS[h] || (h < 7
    ? { tip: "وقت مبكر! جهّز خطتك اليومية وحدد أولوياتك", emoji: "🌙" }
    : { tip: "أحسنت على جهودك اليوم. غداً يوم جديد!", emoji: "⭐" });
}

const TIMER_PRESETS = [15, 25, 30, 45, 60, 90];

const EARLY_MESSAGES = [
  "🏆 ماشاء الله! أنجزت قبل الوقت",
  "⚡ سرعة خارقة! أداء ممتاز",
  "🔥 أنت آلة إنجاز! استمر",
  "💪 كفو! أثبتّ إنك تقدر",
  "🎯 دقيق وسريع. هذا هو التميز",
];

const TASK_TYPES: Record<string, { label: string; emoji: string }> = {
  general: { label: "عامة", emoji: "📋" },
  call: { label: "اتصال", emoji: "📞" },
  meeting: { label: "اجتماع", emoji: "🤝" },
  followup: { label: "متابعة", emoji: "🔄" },
  renewal: { label: "تجديد", emoji: "♻️" },
  support: { label: "دعم", emoji: "🎧" },
};

const PRIORITIES: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: "منخفضة", color: "text-gray-400", bg: "bg-gray-500/10" },
  medium: { label: "متوسطة", color: "text-blue-400", bg: "bg-blue-500/10" },
  high: { label: "عالية", color: "text-amber-400", bg: "bg-amber-500/10" },
  urgent: { label: "عاجلة", color: "text-red-400", bg: "bg-red-500/10" },
};

const STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "قيد الانتظار", color: "text-gray-400", bg: "bg-gray-500/10" },
  in_progress: { label: "جاري العمل", color: "text-blue-400", bg: "bg-blue-500/10" },
  completed: { label: "مكتملة", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  cancelled: { label: "ملغية", color: "text-red-400", bg: "bg-red-500/10" },
};

type ViewMode = "today" | "week" | "month" | "all";

const CLIENT_STAGES = [
  { key: "تواصل", label: "تواصل", color: "emerald" },
  { key: "تفاوض", label: "جاري التفاوض", color: "purple" },
  { key: "تجريبي", label: "يوزر تجريبي", color: "blue" },
  { key: "انتظار الدفع", label: "بانتظار الدفع", color: "amber" },
  { key: "كنسل التجربة", label: "كنسل التجربة", color: "red" },
  { key: "مكتملة", label: "مكتملة", color: "green" },
];

const STAGE_COLORS: Record<string, string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  purple: "border-purple-500/40 bg-purple-500/15 text-purple-400",
  blue: "border-blue-500/40 bg-blue-500/15 text-blue-400",
  amber: "border-amber-500/40 bg-amber-500/15 text-amber-400",
  red: "border-red-500/40 bg-red-500/15 text-red-400",
  green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
};

const EMPTY_CLIENT_FORM = {
  client_name: "",
  client_phone: "",
  deal_value: 0,
  source: "حملة اعلانية",
  plan: "",
  stage: "تواصل",
  notes: "",
  sales_type: "office" as "office" | "support",
};

type PageTab = "my-tasks" | "overview" | "settings";

function getCountdown(dueDate?: string, dueTime?: string): { label: string; urgency: "passed" | "critical" | "warning" | "normal" | "none" } {
  if (!dueDate) return { label: "", urgency: "none" };
  const target = new Date(`${dueDate}T${dueTime ? dueTime.slice(0, 5) : "23:59"}:00`);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    const pastMs = Math.abs(diffMs);
    const pastMins = Math.floor(pastMs / 60_000);
    if (pastMins < 60) return { label: `متأخر ${pastMins} د`, urgency: "passed" };
    const pastHrs = Math.floor(pastMins / 60);
    if (pastHrs < 24) return { label: `متأخر ${pastHrs} س`, urgency: "passed" };
    const pastDays = Math.floor(pastHrs / 24);
    return { label: `متأخر ${pastDays} يوم`, urgency: "passed" };
  }

  const totalMins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const days = Math.floor(hours / 24);
  const remainingHrs = hours % 24;

  if (days > 0) {
    const label = remainingHrs > 0 ? `${days} يوم ${remainingHrs} س` : `${days} يوم`;
    return { label: `متبقي ${label}`, urgency: days <= 1 ? "warning" : "normal" };
  }
  if (hours > 0) {
    const label = mins > 0 ? `${hours} س ${mins} د` : `${hours} س`;
    return { label: `متبقي ${label}`, urgency: hours <= 2 ? "critical" : "warning" };
  }
  return { label: `متبقي ${mins} د`, urgency: "critical" };
}

export default function MyTasksPage() {
  const { user } = useAuth();
  const isAdmin = user?.isSuperAdmin || user?.roleName === "admin" || user?.roleName === "مدير";
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, in_progress: 0, overdue: 0 });
  const [myRank, setMyRank] = useState<{ rank: number; total: number; rate: number }>({ rank: 0, total: 0, rate: 0 });
  const [completionNote, setCompletionNote] = useState<{ taskId: string; note: string } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  /* Page tab (admin sees more tabs) */
  const [activeTab, setActiveTab] = useState<PageTab>("my-tasks");

  /* Weekly stats for stats bar */
  const [weekStats, setWeekStats] = useState({ completed: 0, total: 0 });

  /* Admin overview */
  const [repsStats, setRepsStats] = useState<{ employee_id: string; employee_name: string; total: number; completed: number; rate: number; tasks: EmployeeTask[] }[]>([]);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);

  /* Admin settings — task templates */
  const [taskTemplates, setTaskTemplates] = useState<DailyTaskTemplate[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<DailyTaskTemplate[]>([]);
  const [templateSaving, setTemplateSaving] = useState(false);

  /* Sales performance */
  const [salesStats, setSalesStats] = useState({
    totalDeals: 0, closedDeals: 0, revenue: 0,
    pendingApproval: 0, approved: 0, rejected: 0,
    conversionRate: 0,
  });

  /* Client form */
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [clientSaving, setClientSaving] = useState(false);
  const [clientError, setClientError] = useState("");

  /* Transfer modal */
  const [transferTask, setTransferTask] = useState<EmployeeTask | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [teamUsers, setTeamUsers] = useState<{ id: string; name: string }[]>([]);

  /* Timer state */
  const [activeTimer, setActiveTimer] = useState<{ taskId: string; remaining: number; total: number; paused: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTimerPicker, setShowTimerPicker] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [earlyMessage, setEarlyMessage] = useState<string | null>(null);
  const [hourlyTip, setHourlyTip] = useState(getHourlyTip());

  /* Update hourly tip every 10 minutes */
  useEffect(() => {
    const id = setInterval(() => setHourlyTip(getHourlyTip()), 600000);
    return () => clearInterval(id);
  }, []);

  /* Timer tick */
  useEffect(() => {
    if (activeTimer && !activeTimer.paused && activeTimer.remaining > 0) {
      timerRef.current = setInterval(() => {
        setActiveTimer(prev => {
          if (!prev || prev.paused) return prev;
          if (prev.remaining <= 1) {
            clearInterval(timerRef.current!);
            return { ...prev, remaining: 0 };
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [activeTimer?.taskId, activeTimer?.paused, activeTimer?.remaining === 0 ? 0 : 1]);

  const startTimer = async (taskId: string, minutes: number) => {
    setShowTimerPicker(null);
    setActiveTimer({ taskId, remaining: minutes * 60, total: minutes * 60, paused: false });
    await updateEmployeeTask(taskId, {
      status: "in_progress",
      time_estimate: minutes,
      time_started_at: new Date().toISOString(),
    });
    loadData();
  };

  const togglePauseTimer = () => {
    setActiveTimer(prev => prev ? { ...prev, paused: !prev.paused } : null);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveTimer(null);
  };

  const completeWithTimer = async (taskId: string) => {
    if (!activeTimer || activeTimer.taskId !== taskId) return;
    const elapsedSec = activeTimer.total - activeTimer.remaining;
    const spentMinutes = Math.max(1, Math.round(elapsedSec / 60));
    const isEarly = activeTimer.remaining > 0;

    if (isEarly) {
      setEarlyMessage(EARLY_MESSAGES[Math.floor(Math.random() * EARLY_MESSAGES.length)]);
      setTimeout(() => setEarlyMessage(null), 4000);
    }

    stopTimer();
    setCompletionNote({ taskId, note: "" });
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  /* Timer performance stats */
  const timerStats = useMemo(() => {
    const timed = tasks.filter(t => t.time_estimate && t.time_spent_minutes && t.status === "completed");
    if (timed.length === 0) return { total: 0, earlyCount: 0, lateCount: 0, earlyRate: 0 };
    const earlyCount = timed.filter(t => t.time_spent_minutes! <= t.time_estimate!).length;
    return {
      total: timed.length,
      earlyCount,
      lateCount: timed.length - earlyCount,
      earlyRate: Math.round((earlyCount / timed.length) * 100),
    };
  }, [tasks]);

  const todayQuote = useMemo(() => {
    const start = new Date("2025-01-01").getTime();
    const now = Date.now();
    const dayIndex = Math.floor((now - start) / (1000 * 60 * 60 * 24)) % MOTIVATIONAL_QUOTES.length;
    return MOTIVATIONAL_QUOTES[dayIndex];
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      // Generate auto-tasks for today (idempotent — won't duplicate)
      await generateDailyAutoTasks(user.id, user.name).catch(() => {});

      const [tasksResult, statsResult, teamResult, dealsResult, pendingResult, weekResult] = await Promise.allSettled([
        fetchEmployeeTasks({ assigned_to: user.id }),
        fetchMyTaskStats(user.id),
        fetchTeamTaskStats(),
        fetchDeals(),
        fetchPendingDeals(),
        fetchWeeklyTaskStats(user.id),
      ]);

      // Weekly stats
      if (weekResult.status === "fulfilled") {
        setWeekStats(weekResult.value);
      }

      // Tasks - core data, always update
      if (tasksResult.status === "fulfilled") {
        setTasks(tasksResult.value);
      }

      // Stats
      if (statsResult.status === "fulfilled") {
        setStats(statsResult.value);
      }

      // Team ranking
      if (teamResult.status === "fulfilled") {
        const teamStats = teamResult.value;
        const myTeam = teamStats.find(s => s.employee_id === user.id);
        const rank = teamStats.findIndex(s => s.employee_id === user.id) + 1;
        setMyRank({
          rank: rank || teamStats.length + 1,
          total: teamStats.length,
          rate: myTeam?.completion_rate ?? 0,
        });
      }

      // Sales performance stats
      const allDeals = dealsResult.status === "fulfilled" ? dealsResult.value : [];
      const pendingDeals = pendingResult.status === "fulfilled" ? pendingResult.value : [];
      const myDeals = allDeals.filter(d => d.assigned_rep_name?.trim() === user.name.trim());
      const closedDeals = myDeals.filter(d => d.stage === "مكتملة");
      const myPending = pendingDeals.filter(d => d.submitter_name?.trim() === user.name.trim() || d.assigned_rep_name?.trim() === user.name.trim());
      const approved = myPending.filter(d => d.status === "approved").length;
      const rejected = myPending.filter(d => d.status === "rejected").length;
      const pending = myPending.filter(d => d.status === "pending").length;
      const totalSubmitted = approved + rejected + pending;
      setSalesStats({
        totalDeals: myDeals.length,
        closedDeals: closedDeals.length,
        revenue: closedDeals.reduce((s, d) => s + d.deal_value, 0),
        pendingApproval: pending,
        approved,
        rejected,
        conversionRate: totalSubmitted > 0 ? Math.round((approved / totalSubmitted) * 100) : 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  /* Load admin data when switching to admin tabs */
  const loadAdminData = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [repsResult, templateResult] = await Promise.allSettled([
      fetchAllRepsDailyStats(today),
      fetchDailyTasksTemplate(),
    ]);
    if (repsResult.status === "fulfilled") setRepsStats(repsResult.value);
    if (templateResult.status === "fulfilled") setTaskTemplates(templateResult.value);
  }, []);

  useEffect(() => {
    if (isAdmin && (activeTab === "overview" || activeTab === "settings")) {
      loadAdminData();
    }
  }, [isAdmin, activeTab, loadAdminData]);

  /* ─── Today's task stats for stats bar ─── */
  const todayStats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayTasks = tasks.filter(t => t.due_date === today);
    const completed = todayTasks.filter(t => t.status === "completed").length;
    const total = todayTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, rate };
  }, [tasks]);

  /* ─── Add Client Handler ─── */
  const handleAddClient = async () => {
    if (!user || !clientForm.client_name.trim()) return;
    setClientSaving(true);
    setClientError("");
    try {
      const created = await createEmployeeTask({
        title: `${clientForm.stage} — ${clientForm.client_name}`,
        description: `${clientForm.sales_type === "office" ? "مبيعات المكتب" : "مبيعات الدعم"} | المصدر: ${clientForm.source}${clientForm.plan ? ` | الباقة: ${clientForm.plan}` : ""}${clientForm.deal_value ? ` | القيمة: ${clientForm.deal_value} ر.س` : ""}`,
        task_type: "followup",
        priority: "medium",
        status: "in_progress",
        assigned_to: user.id,
        assigned_to_name: user.name,
        assigned_by: user.id,
        assigned_by_name: user.name,
        due_date: new Date().toISOString().slice(0, 10),
        client_name: clientForm.client_name.trim(),
        client_phone: clientForm.client_phone.trim() || undefined,
        notes: clientForm.notes.trim() || undefined,
      });
      // Immediately add to local state so it appears even if loadData fails
      setTasks((prev) => [created, ...prev]);
      setClientForm(EMPTY_CLIENT_FORM);
      setShowClientForm(false);
      loadData();
    } catch (e) {
      console.error(e);
      setClientError(e instanceof Error ? e.message : "حدث خطأ أثناء إضافة العميل. حاول مرة أخرى.");
    } finally {
      setClientSaving(false);
    }
  };

  /* ─── Transfer to another employee ─── */
  const openTransfer = async (task: EmployeeTask) => {
    setTransferTask(task);
    setTransferTo("");
    try {
      const users = await fetchUserProfiles();
      setTeamUsers(users.filter(u => u.id !== user?.id));
    } catch { /* ignore */ }
  };

  const handleTransfer = async () => {
    if (!transferTask || !transferTo) return;
    const target = teamUsers.find(u => u.id === transferTo);
    if (!target) return;
    await updateEmployeeTask(transferTask.id, {
      assigned_to: target.id,
      assigned_to_name: target.name,
      notes: `${transferTask.notes ? transferTask.notes + " | " : ""}محوّل من ${user?.name}`,
    });
    setTransferTask(null);
    loadData();
  };

  /* ─── Transfer to Admin (send as pending deal) ─── */
  const handleTransferToAdmin = async (task: EmployeeTask) => {
    try {
      const orgId = getOrgId();
      const desc = task.description || "";
      const isSupport = desc.includes("مبيعات الدعم");
      // Parse deal value, source, plan, stage from description
      const valueMatch = desc.match(/القيمة:\s*([\d.]+)/);
      const sourceMatch = desc.match(/المصدر:\s*([^|]+)/);
      const planMatch = desc.match(/الباقة:\s*([^|]+)/);
      const stageMatch = task.title?.match(/^(.+?)\s*—/);
      await submitPendingDeal(orgId, {
        org_id: orgId,
        sales_type: isSupport ? "support" : "office",
        client_name: task.client_name || task.title,
        client_phone: task.client_phone || undefined,
        deal_value: valueMatch ? parseFloat(valueMatch[1]) : 0,
        source: sourceMatch ? sourceMatch[1].trim() : "من الموظف",
        stage: stageMatch ? stageMatch[1].trim() : "تواصل",
        plan: planMatch ? planMatch[1].trim() : undefined,
        notes: `محوّل من ${user?.name} | ${task.notes || ""}`.trim(),
        submitter_name: user?.name,
        assigned_rep_name: user?.name,
      });
      // Mark task as completed
      await updateEmployeeTask(task.id, {
        status: "completed",
        completion_notes: "تم التحويل إلى لوحة الإدارة",
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  const getWeekRange = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  };

  const getMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  };

  const filteredTasks = useMemo(() => {
    if (viewMode === "all") return tasks;
    if (viewMode === "today") return tasks.filter(t => t.due_date === today || (!t.due_date && t.start_date === today));
    if (viewMode === "week") {
      const { start, end } = getWeekRange();
      return tasks.filter(t => {
        const d = t.due_date || t.start_date;
        return d && d >= start && d <= end;
      });
    }
    if (viewMode === "month") {
      const { start, end } = getMonthRange();
      return tasks.filter(t => {
        const d = t.due_date || t.start_date;
        return d && d >= start && d <= end;
      });
    }
    return tasks;
  }, [tasks, viewMode, today]);

  const handleStatusChange = async (task: EmployeeTask, newStatus: string) => {
    if (newStatus === "completed") {
      setCompletionNote({ taskId: task.id, note: "" });
      return;
    }
    await updateEmployeeTask(task.id, { status: newStatus as EmployeeTask["status"] });
    loadData();
  };

  const handleComplete = async () => {
    if (!completionNote) return;
    const task = tasks.find(t => t.id === completionNote.taskId);
    const updates: Partial<EmployeeTask> = {
      status: "completed",
      completion_notes: completionNote.note || undefined,
    };
    // Calculate time spent if timer was used
    if (task?.time_started_at) {
      const started = new Date(task.time_started_at).getTime();
      const spent = Math.max(1, Math.round((Date.now() - started) / 60000));
      updates.time_spent_minutes = spent;
    }
    await updateEmployeeTask(completionNote.taskId, updates);
    setCompletionNote(null);
    loadData();
  };

  // Streak: consecutive completed days
  const streak = useMemo(() => {
    const completedDates = new Set(
      tasks
        .filter(t => t.status === "completed" && t.completed_at)
        .map(t => t.completed_at!.split("T")[0])
    );
    let count = 0;
    const d = new Date();
    while (true) {
      const dateStr = d.toISOString().split("T")[0];
      if (completedDates.has(dateStr)) {
        count++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [tasks]);

  // Level based on completion rate
  const getLevel = (rate: number) => {
    if (rate >= 90) return { label: "أسطوري 🏆", color: "text-amber-400", bg: "from-amber-500/20 to-amber-600/10" };
    if (rate >= 75) return { label: "متميز ⭐", color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-600/10" };
    if (rate >= 50) return { label: "جيد 💪", color: "text-blue-400", bg: "from-blue-500/20 to-blue-600/10" };
    if (rate >= 25) return { label: "مبتدئ 🚀", color: "text-violet-400", bg: "from-violet-500/20 to-violet-600/10" };
    return { label: "بداية الطريق 🌱", color: "text-gray-400", bg: "from-gray-500/20 to-gray-600/10" };
  };

  const level = getLevel(myRank.rate);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      {/* Welcome Header */}
      <div className={`rounded-2xl p-6 bg-gradient-to-l ${level.bg} border border-white/[0.06] relative overflow-hidden`}>
        <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="absolute animate-pulse" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s` }}>
              <Sparkles className="w-4 h-4 text-white/5" />
            </div>
          ))}
        </div>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                مرحباً {user?.name} 👋
              </h1>
              <p className="text-gray-400 text-sm">جاهز لإنجاز مهامك اليوم؟ كل مهمة تكملها تقربك من القمة!</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setClientForm(EMPTY_CLIENT_FORM); setClientError(""); setShowClientForm(true); }}
                className="flex items-center gap-2 px-4 py-3 rounded-[14px] bg-cyan-500 hover:bg-cyan-600 text-white font-medium text-sm transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" /> إضافة عميل
              </button>
              <div className={`text-center px-5 py-3 rounded-[14px] bg-white/[0.10] border border-white/10`}>
                <p className="text-xs text-gray-400 mb-1">مستواك</p>
                <p className={`text-lg font-bold ${level.color}`}>{level.label}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Admin Tabs ─── */}
      {isAdmin && (
        <div className="flex items-center gap-2 bg-white/[0.05] rounded-[14px] p-1 border border-white/[0.06]">
          <button
            onClick={() => setActiveTab("my-tasks")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "my-tasks" ? "bg-cyan-500 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/[0.10]"
            }`}
          >
            <Target className="w-4 h-4" /> مهامي
          </button>
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "overview" ? "bg-cyan-500 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/[0.10]"
            }`}
          >
            <Eye className="w-4 h-4" /> نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "settings" ? "bg-cyan-500 text-white shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/[0.10]"
            }`}
          >
            <Settings className="w-4 h-4" /> إعدادات المهام
          </button>
        </div>
      )}

      {/* ─── Stats Bar ─── */}
      {activeTab === "my-tasks" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] text-center">
            <p className="text-gray-400 text-xs mb-1">نشاط اليوم</p>
            <p className="text-2xl font-bold">
              <span className={todayStats.rate >= 80 ? "text-emerald-400" : todayStats.rate >= 50 ? "text-amber-400" : "text-red-400"}>
                {todayStats.completed}
              </span>
              <span className="text-gray-500 text-sm">/{todayStats.total}</span>
            </p>
          </div>
          <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] text-center">
            <p className="text-gray-400 text-xs mb-1">نشاط الأسبوع</p>
            <p className="text-2xl font-bold">
              <span className="text-cyan-400">{weekStats.completed}</span>
              <span className="text-gray-500 text-sm">/{weekStats.total}</span>
            </p>
          </div>
          <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] text-center">
            <p className="text-gray-400 text-xs mb-1">نسبة الإنجاز</p>
            <p className={`text-2xl font-bold ${todayStats.rate >= 80 ? "text-emerald-400" : todayStats.rate >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {todayStats.rate}%
            </p>
          </div>
        </div>
      )}

      {/* ─── ADMIN: Overview Tab ─── */}
      {activeTab === "overview" && isAdmin && (
        <div className="space-y-4">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" /> أداء المندوبين اليوم
          </h2>
          {repsStats.length === 0 ? (
            <div className="text-center py-12 glass-surface rounded-2xl border border-white/[0.06]">
              <Users className="w-10 h-10 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">لا توجد بيانات لليوم بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {repsStats.map((rep) => (
                <div key={rep.employee_id}>
                  <button
                    onClick={() => setExpandedRep(expandedRep === rep.employee_id ? null : rep.employee_id)}
                    className={`w-full glass-surface rounded-2xl p-4 border transition-all ${
                      rep.rate >= 80 ? "border-emerald-500/20" : rep.rate >= 50 ? "border-amber-500/20" : "border-red-500/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center text-sm font-bold ring-1 ${
                          rep.rate >= 80 ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20" :
                          rep.rate >= 50 ? "bg-amber-500/15 text-amber-400 ring-amber-500/20" :
                          "bg-red-500/15 text-red-400 ring-red-500/20"
                        }`}>
                          {rep.employee_name?.[0] || "م"}
                        </div>
                        <div className="text-right">
                          <p className="text-white font-semibold text-sm">{rep.employee_name}</p>
                          <p className="text-gray-400 text-xs">{rep.completed}/{rep.total} مهام</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${
                          rep.rate >= 80 ? "text-emerald-400" : rep.rate >= 50 ? "text-amber-400" : "text-red-400"
                        }`}>
                          {rep.rate}%
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedRep === rep.employee_id ? "rotate-180" : ""}`} />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-white/[0.10] mt-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          rep.rate >= 80 ? "bg-emerald-500" : rep.rate >= 50 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${rep.rate}%` }}
                      />
                    </div>
                  </button>
                  {/* Expanded task details */}
                  {expandedRep === rep.employee_id && (
                    <div className="mt-1 mr-4 space-y-1.5">
                      {rep.tasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 bg-white/[0.03] rounded-xl p-3 border border-white/[0.04]">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${t.status === "completed" ? "bg-emerald-500" : "border border-white/20"}`}>
                            {t.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <span className={`text-sm flex-1 ${t.status === "completed" ? "text-gray-500 line-through" : "text-white"}`}>{t.title}</span>
                          {t.completed_at && (
                            <span className="text-[10px] text-gray-500">{new Date(t.completed_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ADMIN: Settings Tab ─── */}
      {activeTab === "settings" && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-400" /> المهام اليومية التلقائية
            </h2>
            <button
              onClick={() => {
                setTemplateDraft([...taskTemplates]);
                setShowTemplateEditor(true);
              }}
              className="px-4 py-2 rounded-[14px] bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-all flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> تعديل المهام
            </button>
          </div>

          <div className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
            <p className="text-gray-400 text-sm mb-4">هذه المهام تنزل تلقائياً لكل مندوب كل يوم عمل (الأحد - الخميس):</p>
            <div className="space-y-2">
              {taskTemplates.map((t, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                  <span className="text-base">{TASK_TYPES[t.type]?.emoji || "📋"}</span>
                  <span className="text-white text-sm font-medium flex-1">{t.title}</span>
                  <span className="text-gray-500 text-xs px-2 py-1 rounded-lg bg-white/[0.06]">{TASK_TYPES[t.type]?.label || t.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Template Editor Modal ─── */}
      {showTemplateEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" /> تعديل المهام اليومية
              </h2>
              <button onClick={() => setShowTemplateEditor(false)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3 mb-4">
              {templateDraft.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                  <input
                    value={t.title}
                    onChange={(e) => {
                      const draft = [...templateDraft];
                      draft[i] = { ...draft[i], title: e.target.value };
                      setTemplateDraft(draft);
                    }}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  />
                  <select
                    value={t.type}
                    onChange={(e) => {
                      const draft = [...templateDraft];
                      draft[i] = { ...draft[i], type: e.target.value as DailyTaskTemplate["type"] };
                      setTemplateDraft(draft);
                    }}
                    className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                  >
                    {Object.entries(TASK_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setTemplateDraft(templateDraft.filter((_, j) => j !== i))}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setTemplateDraft([...templateDraft, { title: "", type: "general" }])}
              className="w-full py-2.5 rounded-[14px] border-2 border-dashed border-white/10 text-gray-400 hover:border-cyan-500/30 hover:text-cyan-400 text-sm font-medium transition-all flex items-center justify-center gap-2 mb-4"
            >
              <Plus className="w-4 h-4" /> إضافة مهمة
            </button>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const valid = templateDraft.filter(t => t.title.trim());
                  setTemplateSaving(true);
                  try {
                    await upsertDailyTasksTemplate(valid);
                    setTaskTemplates(valid);
                    setShowTemplateEditor(false);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setTemplateSaving(false);
                  }
                }}
                disabled={templateSaving}
                className="flex-1 py-3 rounded-[14px] bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                {templateSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "حفظ التغييرات"}
              </button>
              <button
                onClick={() => setShowTemplateEditor(false)}
                className="px-5 py-3 rounded-[14px] bg-white/[0.10] hover:bg-white/10 text-gray-400 font-medium transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── My Tasks Content (only show when on my-tasks tab) ─── */}
      {activeTab !== "my-tasks" ? null : (<>

      {/* Daily Quote */}
      <div className="glass-surface rounded-2xl p-5 border border-white/[0.06] relative overflow-hidden">
        <div className="absolute top-3 left-3 text-6xl text-white/[0.03] font-serif">&ldquo;</div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-amber-500/15 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white text-sm leading-relaxed font-medium">&ldquo;{todayQuote.text}&rdquo;</p>
            <p className="text-amber-400/70 text-xs mt-2">— {todayQuote.author}</p>
          </div>
        </div>
      </div>

      {/* Hourly Productivity Tip */}
      <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] flex items-center gap-3">
        <div className="w-10 h-10 rounded-[14px] bg-indigo-500/15 flex items-center justify-center shrink-0 text-xl">
          {hourlyTip.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-indigo-400 font-medium mb-0.5">نصيحة الساعة</p>
          <p className="text-white text-sm">{hourlyTip.tip}</p>
        </div>
        {timerStats.total > 0 && (
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-emerald-400 text-sm font-bold">{timerStats.earlyRate}%</p>
              <p className="text-[10px] text-gray-400">إنجاز مبكر</p>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <p className="text-white text-sm font-bold">{timerStats.total}</p>
              <p className="text-[10px] text-gray-400">مهام بتوقيت</p>
            </div>
          </div>
        )}
      </div>

      {/* Stats + Rank Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] text-center">
          <Target className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-gray-400 text-xs mt-1">إجمالي المهام</p>
        </div>
        <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] text-center">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
          <p className="text-gray-400 text-xs mt-1">مكتملة</p>
        </div>
        <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] text-center">
          <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-amber-400">{stats.pending + stats.in_progress}</p>
          <p className="text-gray-400 text-xs mt-1">متبقية</p>
        </div>
        <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] text-center">
          <Trophy className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">
            {myRank.rank > 0 ? (
              <span>{myRank.rank}<span className="text-sm text-gray-400">/{myRank.total}</span></span>
            ) : "-"}
          </p>
          <p className="text-gray-400 text-xs mt-1">ترتيبك</p>
        </div>
        <div className="glass-surface rounded-2xl p-4 border border-white/[0.06] text-center col-span-2 md:col-span-1">
          <Flame className="w-6 h-6 text-orange-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-orange-400">{streak}</p>
          <p className="text-gray-400 text-xs mt-1">أيام متتالية</p>
        </div>
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span className="text-white font-medium text-sm">نسبة الإنجاز</span>
            </div>
            <span className={`text-lg font-bold ${
              myRank.rate >= 75 ? "text-emerald-400" :
              myRank.rate >= 50 ? "text-amber-400" : "text-red-400"
            }`}>{myRank.rate}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-white/[0.10] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                myRank.rate >= 75 ? "bg-gradient-to-l from-emerald-400 to-emerald-600" :
                myRank.rate >= 50 ? "bg-gradient-to-l from-amber-400 to-amber-600" :
                "bg-gradient-to-l from-red-400 to-red-600"
              }`}
              style={{ width: `${myRank.rate}%` }}
            />
          </div>
          {myRank.rate >= 90 && (
            <p className="text-emerald-400 text-xs mt-2 animate-pulse">🔥 أداء استثنائي! استمر على هذا المستوى</p>
          )}
          {myRank.rate >= 50 && myRank.rate < 90 && (
            <p className="text-amber-400 text-xs mt-2">💪 أداء رائع! قليل وتوصل للقمة</p>
          )}
          {myRank.rate > 0 && myRank.rate < 50 && (
            <p className="text-blue-400 text-xs mt-2">🚀 بداية قوية! كل مهمة تنجزها تقربك من هدفك</p>
          )}
        </div>
      )}

      {/* ─── Sales Performance Section ─── */}
      {(salesStats.totalDeals > 0 || salesStats.pendingApproval > 0 || salesStats.approved > 0) && (
        <div className="glass-surface rounded-2xl p-5 border border-white/[0.06]">
          <h2 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" /> أدائي في المبيعات
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white/[0.05] rounded-[14px] p-3 text-center border border-white/[0.06]">
              <p className="text-2xl font-bold text-white">{salesStats.totalDeals}</p>
              <p className="text-gray-400 text-xs mt-1">إجمالي الصفقات</p>
            </div>
            <div className="bg-white/[0.05] rounded-[14px] p-3 text-center border border-white/[0.06]">
              <p className="text-2xl font-bold text-emerald-400">{salesStats.closedDeals}</p>
              <p className="text-gray-400 text-xs mt-1">صفقات مكتملة</p>
            </div>
            <div className="bg-white/[0.05] rounded-[14px] p-3 text-center border border-white/[0.06]">
              <p className="text-2xl font-bold text-cyan-400">{formatMoney(salesStats.revenue)}</p>
              <p className="text-gray-400 text-xs mt-1">إجمالي الإيرادات</p>
            </div>
            <div className="bg-white/[0.05] rounded-[14px] p-3 text-center border border-white/[0.06]">
              <p className={`text-2xl font-bold ${salesStats.conversionRate >= 70 ? "text-emerald-400" : salesStats.conversionRate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                {salesStats.conversionRate}%
              </p>
              <p className="text-gray-400 text-xs mt-1">نسبة الاعتماد</p>
            </div>
          </div>

          {/* Submission pipeline */}
          <div className="flex items-center gap-3 flex-wrap">
            {salesStats.pendingApproval > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                ⏳ بانتظار الموافقة: {salesStats.pendingApproval}
              </span>
            )}
            {salesStats.approved > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                ✅ تم الاعتماد: {salesStats.approved}
              </span>
            )}
            {salesStats.rejected > 0 && (
              <span className="px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
                ❌ مرفوض: {salesStats.rejected}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Overdue Alert */}
      {stats.overdue > 0 && (
        <div className="rounded-2xl p-4 bg-red-500/10 border border-red-500/20 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 animate-pulse" />
          <div>
            <p className="text-red-400 font-medium text-sm">لديك {stats.overdue} مهام متأخرة!</p>
            <p className="text-red-400/60 text-xs">أنجزها الآن لتحسين ترتيبك</p>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 bg-white/[0.05] rounded-[14px] p-1 border border-white/[0.06]">
        {[
          { key: "today" as ViewMode, label: "اليوم" },
          { key: "week" as ViewMode, label: "الأسبوع" },
          { key: "month" as ViewMode, label: "الشهر" },
          { key: "all" as ViewMode, label: "الكل" },
        ].map(v => (
          <button
            key={v.key}
            onClick={() => setViewMode(v.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
              viewMode === v.key
                ? "bg-cyan-500 text-white shadow-lg"
                : "text-gray-400 hover:text-white hover:bg-white/[0.10]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16 glass-surface rounded-2xl border border-white/[0.06]">
            {viewMode === "today" ? (
              <>
                <Star className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <p className="text-white font-medium text-lg">لا توجد مهام لليوم!</p>
                <p className="text-gray-400 text-sm mt-1">استمتع بيومك أو تحقق من المهام القادمة</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-400">لا توجد مهام في هذه الفترة</p>
              </>
            )}
          </div>
        ) : (
          filteredTasks.map(task => {
            const isOverdue = task.status !== "completed" && task.status !== "cancelled" && task.due_date && task.due_date < today;
            const st = STATUSES[task.status] || STATUSES.pending;
            const pr = PRIORITIES[task.priority] || PRIORITIES.medium;
            const tt = TASK_TYPES[task.task_type] || TASK_TYPES.general;
            const isActive = task.status !== "completed" && task.status !== "cancelled";
            // eslint-disable-next-line react-hooks/exhaustive-deps
            const countdown = isActive ? getCountdown(task.due_date, task.due_time) : { label: "", urgency: "none" as const };
            void tick;

            const countdownColors: Record<string, string> = {
              passed: "text-red-400 bg-red-500/10 border-red-500/20",
              critical: "text-orange-400 bg-orange-500/10 border-orange-500/20",
              warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
              normal: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
              none: "",
            };
            const CountdownIcon = countdown.urgency === "passed" ? AlertTriangle : countdown.urgency === "critical" ? Timer : Hourglass;

            return (
              <div key={task.id} className={`glass-surface rounded-2xl p-5 border ${isOverdue ? "border-red-500/30 bg-red-500/[0.02]" : "border-white/[0.06]"} transition-all`}>
                <div className="flex items-start gap-4">
                  {/* Status toggle */}
                  <button
                    onClick={() => handleStatusChange(task, task.status === "completed" ? "pending" : "completed")}
                    className={`mt-0.5 w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                      task.status === "completed"
                        ? "bg-emerald-500 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                        : isOverdue
                          ? "border-red-400/50 hover:border-red-400"
                          : "border-white/20 hover:border-cyan-400"
                    }`}
                  >
                    {task.status === "completed" && <CheckCircle2 className="w-5 h-5 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-base">{tt.emoji}</span>
                      <h3 className={`font-semibold text-base ${task.status === "completed" ? "text-gray-500 line-through" : "text-white"}`}>
                        {task.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${pr.color} ${pr.bg}`}>{pr.label}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${st.color} ${st.bg}`}>{st.label}</span>
                      {isOverdue && (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-medium text-red-400 bg-red-500/10 animate-pulse">⚠️ متأخرة</span>
                      )}
                    </div>

                    {/* Countdown Timer */}
                    {countdown.urgency !== "none" && (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border mb-2 ${countdownColors[countdown.urgency]} ${countdown.urgency === "passed" || countdown.urgency === "critical" ? "animate-pulse" : ""}`}>
                        <CountdownIcon className="w-3.5 h-3.5" />
                        {countdown.label}
                      </div>
                    )}

                    {task.description && (
                      <p className="text-gray-400 text-sm mb-2 leading-relaxed">{task.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                      {task.due_date && (
                        <span className={`flex items-center gap-1.5 ${isOverdue ? "text-red-400" : ""}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {task.due_date}
                          {task.due_time && ` — ${task.due_time.slice(0, 5)}`}
                        </span>
                      )}
                      {task.client_name && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {task.client_name}
                          {task.client_phone && ` (${task.client_phone})`}
                        </span>
                      )}
                      {task.assigned_by_name && (
                        <span className="flex items-center gap-1.5 text-gray-600">
                          من: {task.assigned_by_name}
                        </span>
                      )}
                    </div>

                    {task.notes && (
                      <p className="text-gray-500 text-xs mt-2 bg-white/[0.02] rounded-lg px-3 py-2">📝 {task.notes}</p>
                    )}

                    {task.completion_notes && (
                      <p className="text-emerald-400/70 text-xs mt-2 bg-emerald-500/5 rounded-lg px-3 py-2">✅ {task.completion_notes}</p>
                    )}

                    {/* Timer section */}
                    {task.status !== "completed" && task.status !== "cancelled" && (
                      <div className="mt-3">
                        {activeTimer && activeTimer.taskId === task.id ? (
                          <div className="bg-gradient-to-l from-cyan-500/10 to-indigo-500/10 rounded-[14px] p-3 border border-cyan-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-cyan-400 font-medium flex items-center gap-1.5">
                                <Timer className="w-3.5 h-3.5" />
                                {activeTimer.paused ? "متوقف مؤقتاً" : "جاري العمل..."}
                              </span>
                              <span className="text-xs text-gray-400">{task.time_estimate} دقيقة</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-white/[0.10] mb-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  activeTimer.remaining === 0 ? "bg-red-500 animate-pulse"
                                    : activeTimer.remaining <= 60 ? "bg-amber-500"
                                    : "bg-gradient-to-l from-cyan-400 to-indigo-400"
                                }`}
                                style={{ width: `${Math.max(0, ((activeTimer.total - activeTimer.remaining) / activeTimer.total) * 100)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-2xl font-mono font-bold ${
                                activeTimer.remaining === 0 ? "text-red-400 animate-pulse" :
                                activeTimer.remaining <= 60 ? "text-amber-400" : "text-white"
                              }`}>
                                {formatTimer(activeTimer.remaining)}
                              </span>
                              <div className="flex items-center gap-2">
                                <button onClick={togglePauseTimer} className="w-9 h-9 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] flex items-center justify-center text-white transition-colors">
                                  {activeTimer.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                </button>
                                <button onClick={stopTimer} className="w-9 h-9 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] flex items-center justify-center text-gray-400 transition-colors">
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button onClick={() => completeWithTimer(task.id)} className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-colors flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> أنجزت
                                </button>
                              </div>
                            </div>
                            {activeTimer.remaining === 0 && (
                              <p className="text-red-400 text-xs mt-2 animate-pulse">⏰ انتهى الوقت! أكمل المهمة أو أعد ضبط المؤقت</p>
                            )}
                          </div>
                        ) : showTimerPicker === task.id ? (
                          <div className="bg-white/[0.04] rounded-[14px] p-3 border border-white/[0.06]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-400 font-medium">اختر المدة:</span>
                              <button onClick={() => setShowTimerPicker(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {TIMER_PRESETS.map(min => (
                                <button key={min} onClick={() => startTimer(task.id, min)} className="px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-medium border border-cyan-500/20 transition-colors">
                                  {min} د
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" value={customMinutes} onChange={(e) => setCustomMinutes(Math.max(1, Number(e.target.value) || 1))} className="w-20 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white text-xs text-center focus:outline-none focus:border-cyan-500/50" min={1} dir="ltr" />
                              <span className="text-xs text-gray-400">دقيقة</span>
                              <button onClick={() => startTimer(task.id, customMinutes)} className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium transition-colors flex items-center gap-1">
                                <Play className="w-3 h-3" /> ابدأ
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {!activeTimer && (
                              <button onClick={() => setShowTimerPicker(task.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-medium border border-cyan-500/20 transition-colors">
                                <Timer className="w-3.5 h-3.5" /> ابدأ بمؤقت
                              </button>
                            )}
                            {task.time_estimate && !activeTimer && (
                              <span className="text-[11px] text-gray-500">⏱ {task.time_estimate} د مقدّرة</span>
                            )}
                            {task.time_spent_minutes && (
                              <span className="text-[11px] text-gray-500">⏳ {task.time_spent_minutes} د مستغرقة</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completed task time info */}
                    {task.status === "completed" && task.time_estimate && task.time_spent_minutes && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        {task.time_spent_minutes <= task.time_estimate ? (
                          <span className="text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1">⚡ أنجزت قبل الوقت ({task.time_spent_minutes} من {task.time_estimate} د)</span>
                        ) : (
                          <span className="text-amber-400 bg-amber-500/10 rounded-full px-2.5 py-1">⏰ تجاوزت الوقت ({task.time_spent_minutes} من {task.time_estimate} د)</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick actions */}
                  {task.status !== "completed" && task.status !== "cancelled" && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {task.status === "pending" && (
                        <button
                          onClick={() => updateEmployeeTask(task.id, { status: "in_progress" }).then(loadData)}
                          className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                        >
                          ابدأ العمل
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange(task, "completed")}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                      >
                        أنجزت ✓
                      </button>
                      <button
                        onClick={() => openTransfer(task)}
                        className="px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-medium hover:bg-violet-500/20 transition-colors flex items-center gap-1"
                      >
                        <Users className="w-3 h-3" /> تحويل لموظف
                      </button>
                      <button
                        onClick={() => handleTransferToAdmin(task)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                      >
                        <ArrowUpRight className="w-3 h-3" /> تحويل للإدارة
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* End of my-tasks tab conditional */}
      </>)}

      {/* ─── Add Client Modal ─── */}
      {showClientForm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto" dir="rtl">
          <div className="min-h-full flex items-start justify-center p-4 pt-8 pb-8">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg p-6 relative">
            {/* Close button - sticky top */}
            <button
              onClick={() => setShowClientForm(false)}
              className="absolute top-4 left-4 z-10 w-9 h-9 rounded-[14px] bg-white/[0.08] hover:bg-white/[0.15] flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-5">
              <Plus className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">إضافة عميل جديد</h2>
            </div>

            <div className="space-y-4">
              {/* Sales type toggle */}
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">القسم</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setClientForm(f => ({ ...f, sales_type: "office" }))}
                    className={`flex-1 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                      clientForm.sales_type === "office"
                        ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                        : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.07]"
                    }`}
                  >
                    مبيعات المكتب
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientForm(f => ({ ...f, sales_type: "support" }))}
                    className={`flex-1 py-2.5 rounded-[14px] text-sm font-medium transition-all ${
                      clientForm.sales_type === "support"
                        ? "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30"
                        : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.07]"
                    }`}
                  >
                    مبيعات الدعم
                  </button>
                </div>
              </div>

              {/* Client name */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">اسم العميل <span className="text-red-400">*</span></label>
                <input
                  value={clientForm.client_name}
                  onChange={(e) => setClientForm(f => ({ ...f, client_name: e.target.value }))}
                  placeholder="أدخل اسم العميل"
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Phone + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">رقم الجوال</label>
                  <input
                    value={clientForm.client_phone}
                    onChange={(e) => setClientForm(f => ({ ...f, client_phone: e.target.value }))}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm text-right placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">القيمة (ر.س)</label>
                  <input
                    type="number"
                    value={clientForm.deal_value || ""}
                    onChange={(e) => setClientForm(f => ({ ...f, deal_value: Number(e.target.value) || 0 }))}
                    placeholder="0"
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm text-right placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">المصدر</label>
                <div className="flex flex-wrap gap-2">
                  {SOURCES.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setClientForm(f => ({ ...f, source: src }))}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        clientForm.source === src
                          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                          : "border-white/[0.08] text-gray-400 hover:border-white/20"
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stage */}
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">المرحلة</label>
                <div className="flex flex-wrap gap-2">
                  {CLIENT_STAGES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setClientForm(f => ({ ...f, stage: s.key }))}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        clientForm.stage === s.key
                          ? STAGE_COLORS[s.color] || "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                          : "border-white/[0.08] text-gray-400 hover:border-white/20"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan */}
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">الباقة</label>
                <div className="flex flex-wrap gap-2">
                  {PLANS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setClientForm(f => ({ ...f, plan: f.plan === p ? "" : p }))}
                      className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                        clientForm.plan === p
                          ? "border-purple-500/40 bg-purple-500/15 text-purple-400"
                          : "border-white/[0.08] text-gray-400 hover:border-white/20"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-gray-400 mb-1 block">ملاحظات</label>
                <textarea
                  value={clientForm.notes}
                  onChange={(e) => setClientForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="أي ملاحظات إضافية..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              </div>

              {clientError && (
                <div className="p-3 rounded-[14px] bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {clientError}
                </div>
              )}

              <button
                onClick={handleAddClient}
                disabled={!clientForm.client_name.trim() || clientSaving}
                className="w-full py-3 rounded-[14px] bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                {clientSaving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Plus className="w-4 h-4" /> إضافة العميل لمهامي</>
                )}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ─── Transfer to Employee Modal ─── */}
      {transferTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-400" /> تحويل لموظف آخر
              </h2>
              <button onClick={() => setTransferTask(null)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-white/[0.04] rounded-[14px] p-3 mb-5 border border-white/[0.06]">
              <p className="text-sm text-white font-medium">{transferTask.title}</p>
              {transferTask.client_name && (
                <p className="text-xs text-gray-400 mt-1">العميل: {transferTask.client_name}</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">اختر الموظف</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50"
                >
                  <option value="">اختر موظف...</option>
                  {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleTransfer}
                  disabled={!transferTo}
                  className="flex-1 py-3 rounded-[14px] bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> تحويل
                </button>
                <button
                  onClick={() => setTransferTask(null)}
                  className="px-5 py-3 rounded-[14px] bg-white/[0.10] hover:bg-white/10 text-gray-400 font-medium transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Early completion celebration */}
      {earlyMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] animate-bounce">
          <div className="bg-gradient-to-l from-emerald-500/90 to-cyan-500/90 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl shadow-emerald-500/30 text-center">
            <p className="text-lg font-bold">{earlyMessage}</p>
            <p className="text-white/80 text-xs mt-1">وقتك ثمين وأنت أثبتّ ذلك!</p>
          </div>
        </div>
      )}

      {/* Completion note modal */}
      {completionNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md p-6">
            <div className="text-center mb-5">
              <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">إنجاز المهمة 🎉</h2>
              <p className="text-gray-400 text-sm mt-1">أضف ملاحظة عن ما تم إنجازه (اختياري)</p>
            </div>
            <textarea
              value={completionNote.note}
              onChange={(e) => setCompletionNote(prev => prev ? { ...prev, note: e.target.value } : null)}
              className="w-full px-4 py-3 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none mb-4"
              rows={3}
              placeholder="مثال: تم التواصل مع العميل واتفقنا على..."
            />
            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                className="flex-1 py-3 rounded-[14px] bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-all"
              >
                تم الإنجاز ✓
              </button>
              <button
                onClick={() => setCompletionNote(null)}
                className="px-5 py-3 rounded-[14px] bg-white/[0.10] hover:bg-white/10 text-gray-400 font-medium transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
