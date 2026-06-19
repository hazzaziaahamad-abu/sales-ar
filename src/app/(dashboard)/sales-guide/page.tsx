"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import type { SalesActivity, SalesTarget, RepWeeklyScore, PipPlan, Employee, PipelineStageItem, ActivityPointItem, ScoreLevelItem, SalesMessage, SalesMessageRating, Deal } from "@/types";
import {
  fetchSalesActivities,
  createSalesActivity,
  deleteSalesActivity,
  fetchSalesTargets,
  upsertSalesTarget,
  fetchRepWeeklyScores,
  createRepWeeklyScore,
  fetchPipPlans,
  createPipPlan,
  updatePipPlan,
  fetchEmployees,
  fetchSalesGuideSettings,
  upsertSalesGuideSetting,
  fetchSalesMessages,
  createSalesMessage,
  updateSalesMessage,
  deleteSalesMessage,
  addMessageRating,
  fetchMessageRatings,
  fetchDeals,
} from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import {
  ACTIVITY_TYPES,
  ACTIVITY_RESULTS,
  SCORE_LEVELS as DEFAULT_SCORE_LEVELS,
  ACTIVITY_POINTS as DEFAULT_ACTIVITY_POINTS,
  PIP_STATUSES,
  PIPELINE_STAGES_GUIDE as DEFAULT_PIPELINE_STAGES,
} from "@/lib/utils/constants";
import { formatMoneyFull, formatDate, saudiDateStr } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/stat-card";
import { ColorBadge } from "@/components/ui/color-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  Plus,
  Trash2,
  Trophy,
  Target,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Activity,
  Users,
  ArrowUpDown,
  ArrowRight,
  Pencil,
  MessageSquare,
  PhoneCall,
  Star,
  Send,
  Flame,
  Clock,
  Zap,
  Award,
  Medal,
  Shield,
  Timer,
} from "lucide-react";

/* ─── Color helpers ─── */
const LEVEL_BADGE: Record<string, { color: "green" | "cyan" | "amber" | "purple" | "red"; label: string }> = {
  excellent: { color: "green", label: "ممتاز" },
  advanced: { color: "cyan", label: "متقدم" },
  good: { color: "amber", label: "جيد" },
  needs_improvement: { color: "purple", label: "يحتاج تحسين" },
  danger: { color: "red", label: "خطر" },
};

const MSG_CATEGORIES = [
  { value: "new_client" as const, label: "عميل جديد", icon: "🆕" },
  { value: "renewal_client" as const, label: "عميل تجديد", icon: "🔄" },
  { value: "cashier_client" as const, label: "عميل نظام كاشير", icon: "💳" },
];

const RESULT_BADGE: Record<string, { color: "green" | "amber" | "blue" | "red"; label: string }> = {
  positive: { color: "green", label: "إيجابي" },
  pending: { color: "amber", label: "معلق" },
  no_answer: { color: "blue", label: "لا رد" },
  negative: { color: "red", label: "سلبي" },
};

const PIP_BADGE: Record<string, { color: "green" | "amber" | "red" | "blue"; label: string }> = {
  active: { color: "amber", label: "نشط" },
  completed: { color: "green", label: "مكتمل" },
  failed: { color: "red", label: "فشل" },
  cancelled: { color: "blue", label: "ملغي" },
};

/* ─── Empty forms ─── */
const EMPTY_ACTIVITY = {
  activity_date: saudiDateStr(),
  activity_type: "" as string,
  result: "" as string,
  employee_name: "",
  client_name: "",
  notes: "",
};

const EMPTY_PIP = {
  employee_name: "",
  start_date: saudiDateStr(),
  end_date: "",
  reason: "",
  target_percentage: 100,
  weekly_goals: ["", "", "", ""],
  improvement_actions: [] as string[],
  evaluation_criteria: [] as string[],
  followup_day: "",
  consequence: "",
};

const IMPROVEMENT_ACTIONS = [
  "تدريب مكثف على المنتج",
  "مرافقة مدير المبيعات",
  "مراجعة يومية للأداء",
  "تدريب على مهارات التفاوض",
  "تحسين إدارة الوقت",
  "ورشة عمل خدمة العملاء",
  "تدريب على الإغلاق",
  "مراجعة سكربت المكالمات",
];

const EVALUATION_CRITERIA = [
  { label: "عدد المكالمات اليومية", icon: "📞" },
  { label: "عدد الصفقات المغلقة", icon: "🤝" },
  { label: "قيمة المبيعات", icon: "💰" },
  { label: "معدل التحويل", icon: "📊" },
  { label: "عدد العملاء الجدد", icon: "👥" },
  { label: "رضا العملاء", icon: "⭐" },
  { label: "عدد التجديدات", icon: "🔄" },
  { label: "الحضور والانضباط", icon: "⏰" },
];

const FOLLOWUP_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

/* ─── PIP Motivational helpers ─── */
function getPipDaysLeft(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function getPipMotivation(progress: number, daysLeft: number, week: number) {
  if (progress >= 100) return { icon: "🏆", text: "أداء ممتاز! تجاوز الهدف", color: "text-cc-green", bg: "bg-cc-green/10 border-cc-green/30" };
  if (progress >= 80) return { icon: "🔥", text: "أداء رائع! على وشك تحقيق الهدف", color: "text-cc-green", bg: "bg-cc-green/10 border-cc-green/20" };
  if (progress >= 60) return { icon: "⚡", text: "تقدم جيد! استمر بالعمل", color: "text-cyan", bg: "bg-cyan/10 border-cyan/20" };
  if (progress >= 40) return { icon: "💪", text: "بداية جيدة، تحتاج مزيد من الجهد", color: "text-amber", bg: "bg-amber/10 border-amber/20" };
  if (daysLeft <= 7 && progress < 40) return { icon: "⏰", text: "تحذير! الوقت ينفد والتقدم بطيء", color: "text-cc-red", bg: "bg-cc-red/10 border-cc-red/20" };
  if (week >= 3 && progress < 30) return { icon: "🚨", text: "خطر! يجب تسريع الأداء فوراً", color: "text-cc-red", bg: "bg-cc-red/10 border-cc-red/30" };
  return { icon: "🎯", text: "ابدأ بقوة وحقق أهدافك", color: "text-muted-foreground", bg: "bg-white/[0.05] border-border" };
}

function getPipRank(progress: number) {
  if (progress >= 100) return { rank: "بطل", icon: Trophy, color: "text-amber", medal: "🥇" };
  if (progress >= 80) return { rank: "متميز", icon: Award, color: "text-cc-green", medal: "🥈" };
  if (progress >= 60) return { rank: "مجتهد", icon: Medal, color: "text-cyan", medal: "🥉" };
  if (progress >= 40) return { rank: "مبادر", icon: Shield, color: "text-cc-purple", medal: "" };
  return { rank: "مبتدئ", icon: Target, color: "text-muted-foreground", medal: "" };
}

const MOTIVATIONAL_MSGS = [
  "النجاح يبدأ بخطوة واحدة",
  "كل يوم فرصة جديدة للتحسن",
  "المثابرة مفتاح النجاح",
  "التحدي يصنع الأبطال",
  "اجعل هدفك أكبر من عذرك",
];

export default function SalesGuidePage() {
  const { user } = useAuth();

  /* ─── State ─── */
  const [activities, setActivities] = useState<SalesActivity[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [scores, setScores] = useState<RepWeeklyScore[]>([]);
  const [pipPlans, setPipPlans] = useState<PipPlan[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  /* Guide settings from DB */
  const [pipelineStages, setPipelineStages] = useState<PipelineStageItem[]>([...DEFAULT_PIPELINE_STAGES]);
  const [activityPoints, setActivityPoints] = useState<ActivityPointItem[]>(
    Object.entries(DEFAULT_ACTIVITY_POINTS).map(([key, points]) => {
      const t = ACTIVITY_TYPES.find((at) => at.value === key);
      return { key, label: t?.label || key, icon: t?.icon || "", points };
    })
  );
  const [scoreLevels, setScoreLevels] = useState<ScoreLevelItem[]>([...DEFAULT_SCORE_LEVELS]);

  const [activityDialog, setActivityDialog] = useState(false);
  const [activityForm, setActivityForm] = useState(EMPTY_ACTIVITY);
  const [pipDialog, setPipDialog] = useState(false);
  const [pipForm, setPipForm] = useState(EMPTY_PIP);
  const [editingPip, setEditingPip] = useState<PipPlan | null>(null);
  const [editPipForm, setEditPipForm] = useState(EMPTY_PIP);
  const [targetDialog, setTargetDialog] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SalesTarget | null>(null);
  const [targetForm, setTargetForm] = useState({ target_value: 0, min_value: 0 });

  /* Pipeline edit state */
  const [editingStageIdx, setEditingStageIdx] = useState<number | null>(null);
  const [stageForm, setStageForm] = useState({ stage: "", probability: 0 });
  const [stageDialog, setStageDialog] = useState(false);

  /* Activity points edit state */
  const [editingPointIdx, setEditingPointIdx] = useState<number | null>(null);
  const [pointForm, setPointForm] = useState({ label: "", points: 0 });
  const [pointDialog, setPointDialog] = useState(false);

  /* Score level edit state */
  const [editingLevelIdx, setEditingLevelIdx] = useState<number | null>(null);
  const [levelForm, setLevelForm] = useState({ label: "", minPoints: 0 });
  const [levelDialog, setLevelDialog] = useState(false);

  /* Sales messages & scripts state */
  const [messages, setMessages] = useState<SalesMessage[]>([]);
  const [msgDialog, setMsgDialog] = useState(false);
  const [editingMsg, setEditingMsg] = useState<SalesMessage | null>(null);
  const [msgForm, setMsgForm] = useState({ title: "", content: "", category: "new_client" as SalesMessage["category"], msg_type: "message" as SalesMessage["msg_type"] });
  const [msgCategoryFilter, setMsgCategoryFilter] = useState<string>("all");
  const [ratingDialog, setRatingDialog] = useState(false);
  const [ratingMsgId, setRatingMsgId] = useState<string | null>(null);
  const [ratingForm, setRatingForm] = useState({ rating: 5, comment: "" });
  const [viewRatings, setViewRatings] = useState<{ msgId: string; ratings: SalesMessageRating[] } | null>(null);

  const [saving, setSaving] = useState(false);

  /* ─── Load data ─── */
  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [a, t, s, p, e, gs, msgs, d] = await Promise.allSettled([
      fetchSalesActivities(),
      fetchSalesTargets(),
      fetchRepWeeklyScores(),
      fetchPipPlans(),
      fetchEmployees(),
      fetchSalesGuideSettings(),
      fetchSalesMessages(),
      fetchDeals(),
    ]);
    if (a.status === "fulfilled") setActivities(a.value);
    if (t.status === "fulfilled") setTargets(t.value);
    if (d.status === "fulfilled") setDeals(d.value);
    if (s.status === "fulfilled") setScores(s.value);
    if (p.status === "fulfilled") setPipPlans(p.value);
    if (e.status === "fulfilled") setEmployees(e.value);
    if (msgs.status === "fulfilled") setMessages(msgs.value);
    if (gs.status === "fulfilled") {
      for (const setting of gs.value) {
        if (setting.setting_key === "pipeline_stages") setPipelineStages(setting.setting_value as PipelineStageItem[]);
        if (setting.setting_key === "activity_points") setActivityPoints(setting.setting_value as ActivityPointItem[]);
        if (setting.setting_key === "score_levels") setScoreLevels(setting.setting_value as ScoreLevelItem[]);
      }
    }
    setLoading(false);
  }

  /* ─── Stats ─── */
  const todayStr = saudiDateStr();
  const todayActivities = activities.filter((a) => a.activity_date === todayStr);
  const weekActivities = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const start = saudiDateStr(startOfWeek);
    return activities.filter((a) => a.activity_date >= start);
  }, [activities]);

  /* Auto-calculate live scores per employee from activities + deals */
  const liveScores = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - weekStart.getDay());
    const weekStartStr = saudiDateStr(weekStart);
    const monthStart = saudiDateStr(new Date(now.getFullYear(), now.getMonth(), 1));

    // Get week's closed deals
    const weekClosedDeals = deals.filter((d) =>
      d.stage === "مكتملة" && (d.deal_date || d.created_at.slice(0, 10)) >= weekStartStr
    );

    // Build per-employee map
    const empMap: Record<string, {
      calls: number; demos: number; followups: number; meetings: number;
      quotes: number; whatsapp: number; deals_closed: number; revenue: number; points: number;
    }> = {};

    const getEmp = (name: string) => {
      if (!empMap[name]) empMap[name] = { calls: 0, demos: 0, followups: 0, meetings: 0, quotes: 0, whatsapp: 0, deals_closed: 0, revenue: 0, points: 0 };
      return empMap[name];
    };

    // Count activities this week
    weekActivities.forEach((a) => {
      const name = a.employee_name || "غير محدد";
      const emp = getEmp(name);
      const ap = activityPoints.find((p) => p.key === a.activity_type);
      const pts = ap?.points ?? 0;
      emp.points += pts;
      if (a.activity_type === "call") emp.calls++;
      else if (a.activity_type === "demo") emp.demos++;
      else if (a.activity_type === "followup") emp.followups++;
      else if (a.activity_type === "meeting") emp.meetings++;
      else if (a.activity_type === "quote") emp.quotes++;
      else if (a.activity_type === "whatsapp") emp.whatsapp++;
    });

    // Count closed deals this week
    weekClosedDeals.forEach((d) => {
      const name = d.assigned_rep_name || "غير محدد";
      const emp = getEmp(name);
      emp.deals_closed++;
      emp.revenue += d.deal_value;
      const dealPts = activityPoints.find((p) => p.key === "deal_closed")?.points ?? 50;
      emp.points += dealPts;
    });

    // Determine levels based on scoreLevels config
    const sortedLevels = [...scoreLevels].sort((a, b) => b.minPoints - a.minPoints);

    return Object.entries(empMap)
      .map(([name, data]) => {
        const level = sortedLevels.find((l) => data.points >= l.minPoints)?.value || "";
        return {
          id: name,
          employee_name: name,
          total_points: data.points,
          calls_count: data.calls + data.whatsapp,
          demos_count: data.demos,
          followups_count: data.followups,
          deals_closed: data.deals_closed,
          revenue: data.revenue,
          level,
        };
      })
      .sort((a, b) => b.total_points - a.total_points);
  }, [weekActivities, deals, activityPoints, scoreLevels]);

  const activePips = pipPlans.filter((p) => p.status === "active");

  /* ─── Handlers ─── */
  async function handleCreateActivity() {
    if (!activityForm.activity_type) return;
    setSaving(true);
    try {
      const created = await createSalesActivity({
        activity_date: activityForm.activity_date,
        activity_type: activityForm.activity_type as SalesActivity["activity_type"],
        result: (activityForm.result || undefined) as SalesActivity["result"],
        employee_name: activityForm.employee_name || undefined,
        client_name: activityForm.client_name || undefined,
        notes: activityForm.notes || undefined,
      });
      setActivities((prev) => [created, ...prev]);
      setActivityDialog(false);
      setActivityForm(EMPTY_ACTIVITY);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteActivity(id: string) {
    await deleteSalesActivity(id);
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleCreatePip() {
    if (!pipForm.employee_name || !pipForm.end_date) return;
    setSaving(true);
    try {
      const weeklyGoals = pipForm.weekly_goals
        .map((g, i) => ({ week: i + 1, goal: g }))
        .filter((g) => g.goal.trim());
      const created = await createPipPlan({
        employee_name: pipForm.employee_name,
        start_date: pipForm.start_date,
        end_date: pipForm.end_date,
        status: "active",
        current_week: 1,
        target_percentage: pipForm.target_percentage,
        actual_percentage: 0,
        reason: pipForm.reason || undefined,
        weekly_goals: weeklyGoals.length > 0 ? weeklyGoals : undefined,
        improvement_actions: pipForm.improvement_actions.length > 0 ? pipForm.improvement_actions : undefined,
        evaluation_criteria: pipForm.evaluation_criteria.length > 0 ? pipForm.evaluation_criteria : undefined,
        followup_day: pipForm.followup_day || undefined,
        consequence: pipForm.consequence || undefined,
      });
      setPipPlans((prev) => [created, ...prev]);
      setPipDialog(false);
      setPipForm(EMPTY_PIP);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdatePipStatus(id: string, status: PipPlan["status"]) {
    const updated = await updatePipPlan(id, { status });
    setPipPlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
  }

  function openEditPip(p: PipPlan) {
    setEditingPip(p);
    const goals = p.weekly_goals && p.weekly_goals.length > 0
      ? [0, 1, 2, 3].map((i) => p.weekly_goals?.find((g) => g.week === i + 1)?.goal || "")
      : ["", "", "", ""];
    setEditPipForm({
      employee_name: p.employee_name || "",
      start_date: p.start_date,
      end_date: p.end_date,
      reason: p.reason || "",
      target_percentage: p.target_percentage,
      weekly_goals: goals,
      improvement_actions: p.improvement_actions || [],
      evaluation_criteria: p.evaluation_criteria || [],
      followup_day: p.followup_day || "",
      consequence: p.consequence || "",
    });
  }

  async function handleEditPip() {
    if (!editingPip) return;
    setSaving(true);
    try {
      const weeklyGoals = editPipForm.weekly_goals
        .map((g, i) => ({ week: i + 1, goal: g }))
        .filter((g) => g.goal.trim());
      const updated = await updatePipPlan(editingPip.id, {
        employee_name: editPipForm.employee_name,
        start_date: editPipForm.start_date,
        end_date: editPipForm.end_date,
        target_percentage: editPipForm.target_percentage,
        reason: editPipForm.reason || undefined,
        weekly_goals: weeklyGoals.length > 0 ? weeklyGoals : [],
        improvement_actions: editPipForm.improvement_actions.length > 0 ? editPipForm.improvement_actions : [],
        evaluation_criteria: editPipForm.evaluation_criteria.length > 0 ? editPipForm.evaluation_criteria : [],
        followup_day: editPipForm.followup_day || undefined,
        consequence: editPipForm.consequence || undefined,
      });
      setPipPlans((prev) => prev.map((p) => (p.id === editingPip.id ? updated : p)));
      setEditingPip(null);
    } finally {
      setSaving(false);
    }
  }

  function openEditTarget(target: SalesTarget) {
    setEditingTarget(target);
    setTargetForm({ target_value: target.target_value, min_value: target.min_value });
    setTargetDialog(true);
  }

  async function handleUpdateTarget() {
    if (!editingTarget) return;
    setSaving(true);
    try {
      const updated = await upsertSalesTarget({
        period_type: editingTarget.period_type,
        target_key: editingTarget.target_key,
        target_value: targetForm.target_value,
        min_value: targetForm.min_value,
        label_ar: editingTarget.label_ar,
      });
      setTargets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setTargetDialog(false);
      setEditingTarget(null);
    } finally {
      setSaving(false);
    }
  }

  /* ─── Pipeline stage edit handlers ─── */
  function openEditStage(idx: number) {
    const s = pipelineStages[idx];
    setEditingStageIdx(idx);
    setStageForm({ stage: s.stage, probability: s.probability });
    setStageDialog(true);
  }

  async function handleUpdateStage() {
    if (editingStageIdx === null) return;
    setSaving(true);
    try {
      const updated = pipelineStages.map((s, i) =>
        i === editingStageIdx ? { ...s, stage: stageForm.stage, probability: stageForm.probability } : s
      );
      await upsertSalesGuideSetting("pipeline_stages", updated);
      setPipelineStages(updated);
      setStageDialog(false);
    } finally {
      setSaving(false);
    }
  }

  /* ─── Activity points edit handlers ─── */
  function openEditPoint(idx: number) {
    const p = activityPoints[idx];
    setEditingPointIdx(idx);
    setPointForm({ label: p.label, points: p.points });
    setPointDialog(true);
  }

  async function handleUpdatePoint() {
    if (editingPointIdx === null) return;
    setSaving(true);
    try {
      const updated = activityPoints.map((p, i) =>
        i === editingPointIdx ? { ...p, label: pointForm.label, points: pointForm.points } : p
      );
      await upsertSalesGuideSetting("activity_points", updated);
      setActivityPoints(updated);
      setPointDialog(false);
    } finally {
      setSaving(false);
    }
  }

  /* ─── Score level edit handlers ─── */
  function openEditLevel(idx: number) {
    const l = scoreLevels[idx];
    setEditingLevelIdx(idx);
    setLevelForm({ label: l.label, minPoints: l.minPoints });
    setLevelDialog(true);
  }

  async function handleUpdateLevel() {
    if (editingLevelIdx === null) return;
    setSaving(true);
    try {
      const updated = scoreLevels.map((l, i) =>
        i === editingLevelIdx ? { ...l, label: levelForm.label, minPoints: levelForm.minPoints } : l
      );
      await upsertSalesGuideSetting("score_levels", updated);
      setScoreLevels(updated);
      setLevelDialog(false);
    } finally {
      setSaving(false);
    }
  }

  /* ─── Sales messages handlers ─── */
  function openAddMsg(msgType: SalesMessage["msg_type"]) {
    setEditingMsg(null);
    setMsgForm({ title: "", content: "", category: "new_client", msg_type: msgType });
    setMsgDialog(true);
  }

  function openEditMsg(msg: SalesMessage) {
    setEditingMsg(msg);
    setMsgForm({ title: msg.title, content: msg.content, category: msg.category, msg_type: msg.msg_type });
    setMsgDialog(true);
  }

  async function handleSaveMsg() {
    if (!msgForm.title.trim() || !msgForm.content.trim()) return;
    setSaving(true);
    try {
      if (editingMsg) {
        const updated = await updateSalesMessage(editingMsg.id, { title: msgForm.title, content: msgForm.content, category: msgForm.category });
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await createSalesMessage({
          title: msgForm.title,
          content: msgForm.content,
          category: msgForm.category,
          msg_type: msgForm.msg_type,
          created_by: user?.name,
        });
        setMessages((prev) => [created, ...prev]);
      }
      setMsgDialog(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMsg(id: string) {
    await deleteSalesMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }

  function openRating(msgId: string) {
    setRatingMsgId(msgId);
    setRatingForm({ rating: 5, comment: "" });
    setRatingDialog(true);
  }

  async function handleSubmitRating() {
    if (!ratingMsgId) return;
    setSaving(true);
    try {
      await addMessageRating(ratingMsgId, ratingForm.rating, ratingForm.comment || undefined, user?.name);
      // Refresh messages to get updated avg
      const updated = await fetchSalesMessages();
      setMessages(updated);
      setRatingDialog(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleViewRatings(msgId: string) {
    const ratings = await fetchMessageRatings(msgId);
    setViewRatings({ msgId, ratings });
  }

  /* ─── Loading skeleton ─── */
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-dim flex items-center justify-center">
            <Trophy className="w-4 h-4 text-cc-purple" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">دليل المبيعات</h1>
            <p className="text-xs text-muted-foreground">تتبع الأداء والأنشطة ولوحة المتصدرين</p>
          </div>
        </div>
        <Link href="/sales">
          <Button variant="outline" className="gap-1.5">
            <TrendingUp className="w-4 h-4" />
            المبيعات
          </Button>
        </Link>
      </div>

      {/* ─── Top KPIs ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          value={todayActivities.length.toString()}
          label="نشاط اليوم"
          color="cyan"
          icon={<Activity className="w-5 h-5 text-cyan" />}
          subtext={`من أصل ${targets.find((t) => t.target_key === "calls")?.target_value ?? 15} مكالمة مطلوبة`}
        />
        <StatCard
          value={weekActivities.length.toString()}
          label="نشاط الأسبوع"
          color="green"
          icon={<TrendingUp className="w-5 h-5 text-cc-green" />}
        />
        <StatCard
          value={scores.length > 0 ? scores[0].total_points.toString() : "0"}
          label="أعلى نقاط أسبوعية"
          color="purple"
          icon={<Trophy className="w-5 h-5 text-cc-purple" />}
          subtext={scores.length > 0 ? scores[0].employee_name || "" : ""}
        />
        <StatCard
          value={activePips.length.toString()}
          label="خطط تحسين نشطة"
          color={activePips.length > 0 ? "amber" : "green"}
          icon={<AlertTriangle className="w-5 h-5 text-amber" />}
        />
      </div>

      {/* ─── Main Tabs ─── */}
      <Tabs defaultValue="activities" dir="rtl">
        <TabsList className="glass-surface rounded-2xl p-1.5 gap-1 flex-wrap">
          <TabsTrigger value="activities" className="rounded-[14px] text-xs px-4 py-2">سجل النشاطات</TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-[14px] text-xs px-4 py-2">لوحة المتصدرين</TabsTrigger>
          <TabsTrigger value="targets" className="rounded-[14px] text-xs px-4 py-2">الأهداف</TabsTrigger>
          <TabsTrigger value="pip" className="rounded-[14px] text-xs px-4 py-2">خطط التحسين</TabsTrigger>
          <TabsTrigger value="pipeline" className="rounded-[14px] text-xs px-4 py-2">دليل المراحل</TabsTrigger>
        </TabsList>

        {/* ── Activities Tab ── */}
        <TabsContent value="activities" className="mt-4">
          <div className="glass-surface rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">سجل النشاطات اليومية</h3>
              <Button size="sm" onClick={() => setActivityDialog(true)} className="gap-1.5">
                <Plus className="w-4 h-4" /> إضافة نشاط
              </Button>
            </div>

            {activities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد نشاطات مسجلة بعد</p>
                <p className="text-sm mt-1">ابدأ بتسجيل نشاطاتك اليومية</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الموظف</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>النتيجة</TableHead>
                      <TableHead>ملاحظات</TableHead>
                      <TableHead>النقاط</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.slice(0, 50).map((a) => {
                      const typeInfo = ACTIVITY_TYPES.find((t) => t.value === a.activity_type);
                      const resultInfo = a.result ? RESULT_BADGE[a.result] : null;
                      const ap = activityPoints.find((p) => p.key === a.activity_type);
                      const points = ap?.points ?? 0;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{formatDate(a.activity_date)}</TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {typeInfo?.icon} {typeInfo?.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{a.employee_name || "—"}</TableCell>
                          <TableCell className="text-xs">{a.client_name || "—"}</TableCell>
                          <TableCell>
                            {resultInfo ? (
                              <ColorBadge text={resultInfo.label} color={resultInfo.color} />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{a.notes || "—"}</TableCell>
                          <TableCell>
                            <span className={`text-sm font-bold ${points > 0 ? "text-cc-green" : "text-cc-red"}`}>
                              {points > 0 ? `+${points}` : points}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteActivity(a.id)}
                              className="text-muted-foreground hover:text-cc-red"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Leaderboard Tab ── */}
        <TabsContent value="leaderboard" className="mt-4">
          <div className="glass-surface rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">لوحة المتصدرين الأسبوعية</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="w-4 h-4 text-amber" />
                ترتيب حسب النقاط
              </div>
            </div>

            {liveScores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد نتائج أسبوعية بعد</p>
                <p className="text-sm mt-1">سجّل نشاطات أو أغلق صفقات لحساب النقاط تلقائياً</p>
              </div>
            ) : (
              <div className="space-y-3">
                {liveScores.map((s, idx) => {
                  const levelInfo = s.level ? LEVEL_BADGE[s.level] : null;
                  const emoji = scoreLevels.find((l) => l.value === s.level)?.emoji || "";
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-4 rounded-2xl p-4 border border-border bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="text-2xl font-extrabold text-muted-foreground w-8 text-center">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{s.employee_name || "غير محدد"}</p>
                          {levelInfo && <ColorBadge text={`${emoji} ${levelInfo.label}`} color={levelInfo.color} />}
                        </div>
                        <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                          <span>مكالمات: {s.calls_count}</span>
                          <span>عروض: {s.demos_count}</span>
                          <span>متابعات: {s.followups_count}</span>
                          <span>صفقات: {s.deals_closed}</span>
                          <span>إيراد: {formatMoneyFull(s.revenue)}</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-2xl font-extrabold text-cyan">{s.total_points}</p>
                        <p className="text-[12px] text-muted-foreground">نقطة</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Targets Tab ── */}
        <TabsContent value="targets" className="mt-4">
          <div className="glass-surface rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg font-bold mb-4">الأهداف والحد الأدنى</h3>

            {targets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لم يتم تحديد أهداف بعد</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {targets.map((t) => {
                  const periodLabels: Record<string, string> = {
                    daily: "يومي",
                    weekly: "أسبوعي",
                    monthly: "شهري",
                  };

                  // Calculate actual achieved value
                  const actual = (() => {
                    const keyToTypes: Record<string, string[]> = {
                      calls: ["call", "whatsapp"],
                      followups: ["followup"],
                      demos: ["demo"],
                      quotes: ["quote"],
                    };

                    // Period-based deal filtering
                    const now = new Date();
                    const monthStart = saudiDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
                    const weekStart = (() => { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return saudiDateStr(d); })();
                    const periodDeals = (period: string) => {
                      if (period === "daily") return deals.filter((d) => (d.deal_date || d.created_at.slice(0, 10)) === todayStr);
                      if (period === "weekly") return deals.filter((d) => (d.deal_date || d.created_at.slice(0, 10)) >= weekStart);
                      return deals.filter((d) => (d.deal_date || d.created_at.slice(0, 10)) >= monthStart);
                    };

                    // Activity-based targets
                    const types = keyToTypes[t.target_key];
                    if (types) {
                      if (t.period_type === "daily") return todayActivities.filter((a) => types.includes(a.activity_type)).length;
                      if (t.period_type === "weekly") return weekActivities.filter((a) => types.includes(a.activity_type)).length;
                      return activities.filter((a) => a.activity_date >= monthStart && types.includes(a.activity_type)).length;
                    }

                    // Deal-based targets
                    const pd = periodDeals(t.period_type);
                    const closedDeals = pd.filter((d) => d.stage === "مكتملة");

                    switch (t.target_key) {
                      case "deals_closed":
                      case "closed_deals": return closedDeals.length;
                      case "revenue": return closedDeals.reduce((s, d) => s + d.deal_value, 0);
                      case "win_rate": return pd.length > 0 ? Math.round((closedDeals.length / pd.length) * 100) : 0;
                      case "new_clients": return pd.length;
                      case "avg_cycle_days": return closedDeals.length > 0 ? Math.round(closedDeals.reduce((s, d) => s + d.cycle_days, 0) / closedDeals.length) : 0;
                      case "avg_deal_value": return closedDeals.length > 0 ? Math.round(closedDeals.reduce((s, d) => s + d.deal_value, 0) / closedDeals.length) : 0;
                      case "pipeline_value": return pd.filter((d) => d.stage !== "مكتملة" && d.stage !== "مرفوض مع سبب").reduce((s, d) => s + d.deal_value, 0);
                      case "lead_response_minutes": return 0; // requires response time tracking
                      default: return 0;
                    }
                  })();

                  const pct = t.target_value > 0 ? Math.min(Math.round((actual / t.target_value) * 100), 100) : 0;
                  const isAboveMin = actual >= t.min_value;
                  const isAboveTarget = actual >= t.target_value;

                  return (
                    <div
                      key={t.id}
                      className="rounded-2xl p-4 border border-border bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-foreground">{t.label_ar || t.target_key}</span>
                        <div className="flex items-center gap-2">
                          <ColorBadge
                            text={periodLabels[t.period_type] || t.period_type}
                            color={t.period_type === "daily" ? "cyan" : t.period_type === "weekly" ? "amber" : "purple"}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditTarget(t)}
                            className="w-7 h-7 p-0 text-muted-foreground hover:text-cyan"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Values row */}
                      <div className="flex items-end gap-4 mt-3">
                        <div>
                          <p className="text-[12px] text-muted-foreground">الهدف</p>
                          <p className="text-xl font-extrabold text-cc-green">{t.target_value.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[12px] text-muted-foreground">الحد الأدنى</p>
                          <p className="text-xl font-extrabold text-amber">{t.min_value.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[12px] text-muted-foreground">المتحقق</p>
                          <p className={`text-xl font-extrabold ${isAboveTarget ? "text-cc-green" : isAboveMin ? "text-cyan" : "text-cc-red"}`}>
                            {actual.toLocaleString()}
                          </p>
                        </div>
                        <div className="mr-auto">
                          <span className={`text-lg font-extrabold ${isAboveTarget ? "text-cc-green" : isAboveMin ? "text-cyan" : "text-cc-red"}`}>
                            {pct}%
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isAboveTarget ? "bg-cc-green" : isAboveMin ? "bg-cyan" : "bg-cc-red"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── PIP Plans Tab ── */}
        <TabsContent value="pip" className="mt-4 space-y-4">
          {/* ── Competitive Leaderboard (when multiple plans) ── */}
          {pipPlans.filter(p => p.status === "active").length > 1 && (() => {
            const activeSorted = [...pipPlans]
              .filter(p => p.status === "active")
              .sort((a, b) => {
                const pa = a.target_percentage > 0 ? (a.actual_percentage / a.target_percentage) * 100 : 0;
                const pb = b.target_percentage > 0 ? (b.actual_percentage / b.target_percentage) * 100 : 0;
                return pb - pa;
              });
            return (
              <div className="glass-surface rounded-2xl p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-amber" />
                  <h3 className="text-lg font-bold">لوحة المنافسة</h3>
                  <span className="text-xs text-muted-foreground mr-auto">
                    {MOTIVATIONAL_MSGS[Math.floor(Date.now() / 86400000) % MOTIVATIONAL_MSGS.length]}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeSorted.map((p, idx) => {
                    const prog = p.target_percentage > 0 ? Math.round((p.actual_percentage / p.target_percentage) * 100) : 0;
                    const rank = getPipRank(prog);
                    const daysLeft = getPipDaysLeft(p.end_date);
                    const RankIcon = rank.icon;
                    return (
                      <div key={p.id} className={`rounded-[14px] p-3 border transition-all ${
                        idx === 0 ? "border-amber/30 bg-amber/5" : "border-border bg-white/[0.02]"
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}</span>
                          <p className="font-bold text-sm flex-1">{p.employee_name}</p>
                          <RankIcon className={`w-4 h-4 ${rank.color}`} />
                        </div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                prog >= 80 ? "bg-cc-green" : prog >= 50 ? "bg-amber" : "bg-cc-red"
                              }`}
                              style={{ width: `${Math.min(100, prog)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold min-w-[36px] text-left">{prog}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                          <span className={rank.color}>{rank.medal} {rank.rank}</span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {daysLeft > 0 ? `${daysLeft} يوم متبقي` : "انتهت المهلة"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="glass-surface rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">خطط تحسين الأداء (PIP)</h3>
              <Button size="sm" onClick={() => setPipDialog(true)} className="gap-1.5">
                <Plus className="w-4 h-4" /> إنشاء خطة
              </Button>
            </div>

            {pipPlans.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد خطط تحسين أداء</p>
                <p className="text-sm mt-1">أنشئ خطة لمتابعة أداء الموظفين الذين يحتاجون تحسين</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pipPlans.map((p) => {
                  const statusInfo = PIP_BADGE[p.status];
                  const progress = p.target_percentage > 0
                    ? Math.round((p.actual_percentage / p.target_percentage) * 100)
                    : 0;
                  const daysLeft = getPipDaysLeft(p.end_date);
                  const motivation = getPipMotivation(progress, daysLeft, p.current_week);
                  const rank = getPipRank(progress);
                  const RankIcon = rank.icon;
                  const totalDays = Math.ceil((new Date(p.end_date).getTime() - new Date(p.start_date).getTime()) / (1000 * 60 * 60 * 24));
                  const elapsedDays = totalDays - daysLeft;
                  const timeProgress = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl p-4 border border-border bg-white/[0.02]"
                    >
                      {/* Header with rank badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            progress >= 80 ? "bg-cc-green/15" : progress >= 60 ? "bg-cyan/15" : progress >= 40 ? "bg-amber/15" : "bg-white/[0.05]"
                          }`}>
                            <RankIcon className={`w-4 h-4 ${rank.color}`} />
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{p.employee_name}</p>
                            <span className={`text-[12px] ${rank.color}`}>{rank.medal} {rank.rank}</span>
                          </div>
                          <ColorBadge text={statusInfo.label} color={statusInfo.color} />
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditPip(p)}
                            className="text-muted-foreground text-xs"
                          >
                            <Pencil className="w-3.5 h-3.5 ml-1" /> تعديل
                          </Button>
                          {p.status === "active" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdatePipStatus(p.id, "completed")}
                                className="text-cc-green text-xs"
                              >
                                اكتمل
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUpdatePipStatus(p.id, "failed")}
                                className="text-cc-red text-xs"
                              >
                                فشل
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Motivational banner for active plans */}
                      {p.status === "active" && (
                        <div className={`rounded-lg px-3 py-2 mb-3 border text-xs flex items-center gap-2 ${motivation.bg}`}>
                          <span className="text-base">{motivation.icon}</span>
                          <span className={motivation.color}>{motivation.text}</span>
                          {progress >= 80 && <Flame className="w-4 h-4 text-amber animate-pulse mr-auto" />}
                        </div>
                      )}

                      {/* Stats grid with countdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs text-muted-foreground">
                        <div>
                          <span className="block text-[12px]">تاريخ البدء</span>
                          <span className="text-foreground">{formatDate(p.start_date)}</span>
                        </div>
                        <div>
                          <span className="block text-[12px]">تاريخ الانتهاء</span>
                          <span className="text-foreground">{formatDate(p.end_date)}</span>
                        </div>
                        <div>
                          <span className="block text-[12px]">الأسبوع الحالي</span>
                          <span className="text-foreground">{p.current_week}/4</span>
                        </div>
                        <div>
                          <span className="block text-[12px]">التقدم</span>
                          <span className={`text-sm font-bold ${progress >= 80 ? "text-cc-green" : progress >= 50 ? "text-amber" : "text-cc-red"}`}>{progress}%</span>
                        </div>
                        {p.status === "active" && (
                          <div>
                            <span className="block text-[12px]">الوقت المتبقي</span>
                            <div className="flex items-center gap-1">
                              <Timer className={`w-3.5 h-3.5 ${daysLeft <= 7 ? "text-cc-red animate-pulse" : "text-cyan"}`} />
                              <span className={`font-bold ${daysLeft <= 7 ? "text-cc-red" : daysLeft <= 14 ? "text-amber" : "text-foreground"}`}>
                                {daysLeft > 0 ? `${daysLeft} يوم` : "انتهت!"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Time progress bar */}
                      {p.status === "active" && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-1">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> الوقت المنقضي</span>
                            <span>{timeProgress}%</span>
                          </div>
                          <div className="w-full h-1 bg-white/[0.05] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                timeProgress > 75 && progress < 50 ? "bg-cc-red" : "bg-white/20"
                              }`}
                              style={{ width: `${timeProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {p.reason && (
                        <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
                          السبب: {p.reason}
                        </p>
                      )}

                      {/* Performance progress bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground mb-1">
                          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> تقدم الأداء</span>
                          <span>{progress}% من {p.target_percentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress >= 80 ? "bg-cc-green" : progress >= 50 ? "bg-amber" : "bg-cc-red"
                            }`}
                            style={{ width: `${Math.min(100, progress)}%` }}
                          />
                        </div>
                      </div>

                      {/* Speed comparison: time vs performance */}
                      {p.status === "active" && timeProgress > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-[12px]">
                          {progress >= timeProgress ? (
                            <span className="flex items-center gap-1 text-cc-green">
                              <TrendingUp className="w-3 h-3" />
                              الأداء أسرع من الوقت بـ {progress - timeProgress}%
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-cc-red">
                              <AlertTriangle className="w-3 h-3" />
                              الأداء متأخر عن الوقت بـ {timeProgress - progress}%
                            </span>
                          )}
                        </div>
                      )}

                      {/* Enhanced PIP details */}
                      {(p.weekly_goals?.length || p.improvement_actions?.length || p.evaluation_criteria?.length || p.followup_day || p.consequence) && (
                        <div className="mt-3 border-t border-border pt-3 space-y-3">
                          {/* Weekly goals */}
                          {p.weekly_goals && p.weekly_goals.length > 0 && (
                            <div>
                              <p className="text-[12px] text-muted-foreground mb-1.5">الأهداف الأسبوعية</p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {p.weekly_goals.map((g) => (
                                  <div
                                    key={g.week}
                                    className={`rounded-lg p-2 text-xs border ${
                                      p.current_week === g.week
                                        ? "border-cyan/30 bg-cyan/10 text-cyan"
                                        : p.current_week > g.week
                                        ? "border-cc-green/20 bg-cc-green/5 text-cc-green"
                                        : "border-border bg-white/[0.02] text-muted-foreground"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <span className="text-[12px] opacity-70">أسبوع {g.week}</span>
                                      {p.current_week > g.week && <span className="text-cc-green">✓</span>}
                                      {p.current_week === g.week && <Flame className="w-3 h-3 text-amber" />}
                                    </div>
                                    {g.goal}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Improvement actions & criteria */}
                          <div className="flex flex-wrap gap-3">
                            {p.improvement_actions && p.improvement_actions.length > 0 && (
                              <div className="flex-1 min-w-[200px]">
                                <p className="text-[12px] text-muted-foreground mb-1.5">إجراءات التحسين</p>
                                <div className="flex flex-wrap gap-1">
                                  {p.improvement_actions.map((a) => (
                                    <span key={a} className="px-2 py-0.5 rounded-md text-[13px] bg-cc-purple/10 text-cc-purple border border-cc-purple/20">
                                      {a}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {p.evaluation_criteria && p.evaluation_criteria.length > 0 && (
                              <div className="flex-1 min-w-[200px]">
                                <p className="text-[12px] text-muted-foreground mb-1.5">معايير التقييم</p>
                                <div className="flex flex-wrap gap-1">
                                  {p.evaluation_criteria.map((c) => (
                                    <span key={c} className="px-2 py-0.5 rounded-md text-[13px] bg-cyan/10 text-cyan border border-cyan/20">
                                      {c}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Followup & consequence */}
                          <div className="flex flex-wrap gap-4 text-xs">
                            {p.followup_day && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>متابعة كل <span className="text-foreground font-medium">{p.followup_day}</span></span>
                              </div>
                            )}
                            {p.consequence && (
                              <div className="flex items-center gap-1 text-cc-red/80">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{p.consequence}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Pipeline Guide Tab ── */}
        <TabsContent value="pipeline" className="mt-4">
          <div className="glass-surface rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg font-bold mb-6">دليل مراحل البيع</h3>

            <div className="space-y-4">
              {pipelineStages.map((stage, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 rounded-2xl p-4 border border-border bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-10 h-10 rounded-2xl bg-white/[0.05] flex items-center justify-center text-lg font-bold text-muted-foreground">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground">{stage.stage}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      احتمالية الإغلاق: {stage.probability}%
                    </p>
                  </div>
                  <div className="w-24">
                    <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          stage.probability >= 70
                            ? "bg-cc-green"
                            : stage.probability >= 40
                            ? "bg-amber"
                            : "bg-cc-blue"
                        }`}
                        style={{ width: `${Math.max(5, stage.probability)}%` }}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditStage(idx)}
                    className="w-7 h-7 p-0 text-muted-foreground hover:text-cyan"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Scoring rules */}
            <div className="mt-8">
              <h4 className="text-md font-bold mb-4">نظام النقاط</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activityPoints.map((ap, idx) => (
                  <div
                    key={ap.key}
                    className="flex items-center justify-between rounded-[14px] p-3 border border-border bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="text-sm">
                      {ap.icon} {ap.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold ${
                          ap.points > 0 ? "text-cc-green" : "text-cc-red"
                        }`}
                      >
                        {ap.points > 0 ? `+${ap.points}` : ap.points}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditPoint(idx)}
                        className="w-7 h-7 p-0 text-muted-foreground hover:text-cyan"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score levels */}
            <div className="mt-8">
              <h4 className="text-md font-bold mb-4">مستويات الأداء</h4>
              <div className="flex flex-wrap gap-3">
                {scoreLevels.map((level, idx) => (
                  <div
                    key={level.value}
                    className="flex items-center gap-2 rounded-[14px] p-3 border border-border bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="text-lg">{level.emoji}</span>
                    <div>
                      <p className="text-sm font-bold">{level.label}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {level.minPoints}+ نقطة
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditLevel(idx)}
                      className="w-7 h-7 p-0 text-muted-foreground hover:text-cyan mr-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

      </Tabs>

      {/* ─── Add Activity Dialog ─── */}
      <Dialog open={activityDialog} onOpenChange={setActivityDialog}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>تسجيل نشاط جديد</DialogTitle>
            <DialogDescription>سجّل نشاطك اليومي لكسب النقاط</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>التاريخ</Label>
                <Input
                  type="date"
                  value={activityForm.activity_date}
                  onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })}
                />
              </div>
              <div>
                <Label>نوع النشاط</Label>
                <Select
                  value={activityForm.activity_type}
                  onValueChange={(v) => setActivityForm({ ...activityForm, activity_type: v ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Target vs Achieved indicator */}
            {activityForm.activity_type && (() => {
              const keyMap: Record<string, string> = { call: "calls", whatsapp: "calls", followup: "followups", demo: "demos", quote: "quotes", meeting: "followups" };
              const targetKey = keyMap[activityForm.activity_type];
              const target = targetKey ? targets.find((t) => t.target_key === targetKey && t.period_type === "daily") : null;
              const todayCount = todayActivities.filter((a) => a.activity_type === activityForm.activity_type).length;
              const targetVal = target?.target_value ?? 0;
              const minVal = target?.min_value ?? 0;
              const pct = targetVal > 0 ? Math.min(Math.round((todayCount / targetVal) * 100), 100) : 0;
              const typeInfo = ACTIVITY_TYPES.find((t) => t.value === activityForm.activity_type);

              return (
                <div className="rounded-lg border border-border/50 bg-card/50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{typeInfo?.icon} {typeInfo?.label} — اليوم</span>
                    <span className={`text-xs font-bold ${todayCount >= targetVal && targetVal > 0 ? "text-cc-green" : todayCount >= minVal && minVal > 0 ? "text-cyan" : "text-muted-foreground"}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all ${todayCount >= targetVal && targetVal > 0 ? "bg-cc-green" : todayCount >= minVal && minVal > 0 ? "bg-cyan" : "bg-amber"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-bold">المتحقق: <span className="text-cyan">{todayCount}</span></span>
                    <span className="text-muted-foreground">الحد الأدنى: {minVal}</span>
                    <span className="text-muted-foreground">المستهدف: <span className="text-amber font-bold">{targetVal}</span></span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الموظف</Label>
                <Select
                  value={activityForm.employee_name}
                  onValueChange={(v) => setActivityForm({ ...activityForm, employee_name: v ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.name}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>النتيجة</Label>
                <Select
                  value={activityForm.result}
                  onValueChange={(v) => setActivityForm({ ...activityForm, result: v ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_RESULTS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>اسم العميل</Label>
              <Input
                value={activityForm.client_name}
                onChange={(e) => setActivityForm({ ...activityForm, client_name: e.target.value })}
                placeholder="اسم العميل (اختياري)"
              />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea
                value={activityForm.notes}
                onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                placeholder="ملاحظات..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActivityDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreateActivity} disabled={saving || !activityForm.activity_type}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add PIP Dialog ─── */}
      <Dialog open={pipDialog} onOpenChange={setPipDialog}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>إنشاء خطة تحسين أداء</DialogTitle>
            <DialogDescription>خطة مدتها 4 أسابيع لتحسين أداء الموظف</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Employee & Dates */}
            <div>
              <Label>الموظف</Label>
              <Select
                value={pipForm.employee_name}
                onValueChange={(v) => setPipForm({ ...pipForm, employee_name: v ?? "" })}
              >
                <SelectTrigger><SelectValue placeholder="اختر الموظف..." /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.name}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ البدء</Label>
                <Input
                  type="date"
                  value={pipForm.start_date}
                  onChange={(e) => setPipForm({ ...pipForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>تاريخ الانتهاء</Label>
                <Input
                  type="date"
                  value={pipForm.end_date}
                  onChange={(e) => setPipForm({ ...pipForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النسبة المستهدفة %</Label>
                <Input
                  type="number"
                  value={pipForm.target_percentage}
                  onChange={(e) => setPipForm({ ...pipForm, target_percentage: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>يوم المتابعة الأسبوعي</Label>
                <Select
                  value={pipForm.followup_day}
                  onValueChange={(v) => setPipForm({ ...pipForm, followup_day: v ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر اليوم..." /></SelectTrigger>
                  <SelectContent>
                    {FOLLOWUP_DAYS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <Label>سبب الخطة</Label>
              <Textarea
                value={pipForm.reason}
                onChange={(e) => setPipForm({ ...pipForm, reason: e.target.value })}
                placeholder="سبب إنشاء خطة التحسين..."
                rows={2}
              />
            </div>

            {/* Weekly Goals */}
            <div>
              <Label className="mb-2 block">أهداف أسبوعية</Label>
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-[60px]">أسبوع {i + 1}</span>
                    <Input
                      value={pipForm.weekly_goals[i]}
                      onChange={(e) => {
                        const goals = [...pipForm.weekly_goals];
                        goals[i] = e.target.value;
                        setPipForm({ ...pipForm, weekly_goals: goals });
                      }}
                      placeholder={
                        i === 0 ? "مثال: 20 مكالمة يومياً"
                          : i === 1 ? "مثال: 5 اجتماعات أسبوعياً"
                          : i === 2 ? "مثال: إغلاق 3 صفقات"
                          : "مثال: تحقيق 100% من الهدف"
                      }
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Improvement Actions */}
            <div>
              <Label className="mb-2 block">إجراءات التحسين</Label>
              <div className="flex flex-wrap gap-2">
                {IMPROVEMENT_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      const actions = pipForm.improvement_actions.includes(action)
                        ? pipForm.improvement_actions.filter((a) => a !== action)
                        : [...pipForm.improvement_actions, action];
                      setPipForm({ ...pipForm, improvement_actions: actions });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      pipForm.improvement_actions.includes(action)
                        ? "bg-cc-purple/15 text-cc-purple border-cc-purple/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Evaluation Criteria */}
            <div>
              <Label className="mb-2 block">معايير التقييم (كيف يُقاس النجاح؟)</Label>
              <div className="flex flex-wrap gap-2">
                {EVALUATION_CRITERIA.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => {
                      const criteria = pipForm.evaluation_criteria.includes(c.label)
                        ? pipForm.evaluation_criteria.filter((x) => x !== c.label)
                        : [...pipForm.evaluation_criteria, c.label];
                      setPipForm({ ...pipForm, evaluation_criteria: criteria });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      pipForm.evaluation_criteria.includes(c.label)
                        ? "bg-cyan/15 text-cyan border-cyan/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Consequence */}
            <div>
              <Label>النتيجة في حال عدم التحسن</Label>
              <Textarea
                value={pipForm.consequence}
                onChange={(e) => setPipForm({ ...pipForm, consequence: e.target.value })}
                placeholder="مثال: إنهاء العقد، تخفيض الراتب، نقل لقسم آخر..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPipDialog(false)}>إلغاء</Button>
            <Button onClick={handleCreatePip} disabled={saving || !pipForm.employee_name || !pipForm.end_date}>
              {saving ? "جارٍ الحفظ..." : "إنشاء الخطة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit PIP Dialog ─── */}
      <Dialog open={!!editingPip} onOpenChange={(open) => { if (!open) setEditingPip(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل خطة تحسين الأداء</DialogTitle>
            <DialogDescription>تعديل بيانات خطة {editingPip?.employee_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Employee & Dates */}
            <div>
              <Label>الموظف</Label>
              <Select
                value={editPipForm.employee_name}
                onValueChange={(v) => setEditPipForm({ ...editPipForm, employee_name: v ?? "" })}
              >
                <SelectTrigger><SelectValue placeholder="اختر الموظف..." /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.name}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ البدء</Label>
                <Input
                  type="date"
                  value={editPipForm.start_date}
                  onChange={(e) => setEditPipForm({ ...editPipForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>تاريخ الانتهاء</Label>
                <Input
                  type="date"
                  value={editPipForm.end_date}
                  onChange={(e) => setEditPipForm({ ...editPipForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النسبة المستهدفة %</Label>
                <Input
                  type="number"
                  value={editPipForm.target_percentage}
                  onChange={(e) => setEditPipForm({ ...editPipForm, target_percentage: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>يوم المتابعة الأسبوعي</Label>
                <Select
                  value={editPipForm.followup_day}
                  onValueChange={(v) => setEditPipForm({ ...editPipForm, followup_day: v ?? "" })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر اليوم..." /></SelectTrigger>
                  <SelectContent>
                    {FOLLOWUP_DAYS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <Label>سبب الخطة</Label>
              <Textarea
                value={editPipForm.reason}
                onChange={(e) => setEditPipForm({ ...editPipForm, reason: e.target.value })}
                placeholder="سبب إنشاء خطة التحسين..."
                rows={2}
              />
            </div>

            {/* Weekly Goals */}
            <div>
              <Label className="mb-2 block">أهداف أسبوعية</Label>
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-[60px]">أسبوع {i + 1}</span>
                    <Input
                      value={editPipForm.weekly_goals[i]}
                      onChange={(e) => {
                        const goals = [...editPipForm.weekly_goals];
                        goals[i] = e.target.value;
                        setEditPipForm({ ...editPipForm, weekly_goals: goals });
                      }}
                      placeholder={
                        i === 0 ? "مثال: 20 مكالمة يومياً"
                          : i === 1 ? "مثال: 5 اجتماعات أسبوعياً"
                          : i === 2 ? "مثال: إغلاق 3 صفقات"
                          : "مثال: تحقيق 100% من الهدف"
                      }
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Improvement Actions */}
            <div>
              <Label className="mb-2 block">إجراءات التحسين</Label>
              <div className="flex flex-wrap gap-2">
                {IMPROVEMENT_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => {
                      const actions = editPipForm.improvement_actions.includes(action)
                        ? editPipForm.improvement_actions.filter((a) => a !== action)
                        : [...editPipForm.improvement_actions, action];
                      setEditPipForm({ ...editPipForm, improvement_actions: actions });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      editPipForm.improvement_actions.includes(action)
                        ? "bg-cc-purple/15 text-cc-purple border-cc-purple/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {/* Evaluation Criteria */}
            <div>
              <Label className="mb-2 block">معايير التقييم</Label>
              <div className="flex flex-wrap gap-2">
                {EVALUATION_CRITERIA.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => {
                      const criteria = editPipForm.evaluation_criteria.includes(c.label)
                        ? editPipForm.evaluation_criteria.filter((x) => x !== c.label)
                        : [...editPipForm.evaluation_criteria, c.label];
                      setEditPipForm({ ...editPipForm, evaluation_criteria: criteria });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      editPipForm.evaluation_criteria.includes(c.label)
                        ? "bg-cyan/15 text-cyan border-cyan/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Consequence */}
            <div>
              <Label>النتيجة في حال عدم التحسن</Label>
              <Textarea
                value={editPipForm.consequence}
                onChange={(e) => setEditPipForm({ ...editPipForm, consequence: e.target.value })}
                placeholder="مثال: إنهاء العقد، تخفيض الراتب، نقل لقسم آخر..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPip(null)}>إلغاء</Button>
            <Button onClick={handleEditPip} disabled={saving || !editPipForm.employee_name || !editPipForm.end_date}>
              {saving ? "جارٍ الحفظ..." : "حفظ التعديل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Target Dialog ─── */}
      <Dialog open={targetDialog} onOpenChange={setTargetDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>تعديل الهدف</DialogTitle>
            <DialogDescription>
              {editingTarget?.label_ar || editingTarget?.target_key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>الهدف</Label>
              <Input
                type="number"
                value={targetForm.target_value || ""}
                onChange={(e) => setTargetForm({ ...targetForm, target_value: Number(e.target.value) || 0 })}
                dir="ltr"
                className="text-right"
              />
            </div>
            <div>
              <Label>الحد الأدنى</Label>
              <Input
                type="number"
                value={targetForm.min_value || ""}
                onChange={(e) => setTargetForm({ ...targetForm, min_value: Number(e.target.value) || 0 })}
                dir="ltr"
                className="text-right"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTargetDialog(false)}>إلغاء</Button>
            <Button onClick={handleUpdateTarget} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Pipeline Stage Dialog ─── */}
      <Dialog open={stageDialog} onOpenChange={setStageDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>تعديل مرحلة البيع</DialogTitle>
            <DialogDescription>تعديل اسم المرحلة واحتمالية الإغلاق</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>اسم المرحلة</Label>
              <Input
                value={stageForm.stage}
                onChange={(e) => setStageForm({ ...stageForm, stage: e.target.value })}
              />
            </div>
            <div>
              <Label>احتمالية الإغلاق %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={stageForm.probability}
                onChange={(e) => setStageForm({ ...stageForm, probability: Number(e.target.value) || 0 })}
                dir="ltr"
                className="text-right"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStageDialog(false)}>إلغاء</Button>
            <Button onClick={handleUpdateStage} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Activity Points Dialog ─── */}
      <Dialog open={pointDialog} onOpenChange={setPointDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>تعديل النقاط</DialogTitle>
            <DialogDescription>تعديل اسم النشاط وعدد النقاط</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>اسم النشاط</Label>
              <Input
                value={pointForm.label}
                onChange={(e) => setPointForm({ ...pointForm, label: e.target.value })}
              />
            </div>
            <div>
              <Label>النقاط</Label>
              <Input
                type="number"
                value={pointForm.points}
                onChange={(e) => setPointForm({ ...pointForm, points: Number(e.target.value) })}
                dir="ltr"
                className="text-right"
              />
              <p className="text-[12px] text-muted-foreground mt-1">استخدم قيمة سالبة للخصم (مثل: -10)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPointDialog(false)}>إلغاء</Button>
            <Button onClick={handleUpdatePoint} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Score Level Dialog ─── */}
      <Dialog open={levelDialog} onOpenChange={setLevelDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>تعديل مستوى الأداء</DialogTitle>
            <DialogDescription>تعديل اسم المستوى والحد الأدنى من النقاط</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>اسم المستوى</Label>
              <Input
                value={levelForm.label}
                onChange={(e) => setLevelForm({ ...levelForm, label: e.target.value })}
              />
            </div>
            <div>
              <Label>الحد الأدنى من النقاط</Label>
              <Input
                type="number"
                min={0}
                value={levelForm.minPoints}
                onChange={(e) => setLevelForm({ ...levelForm, minPoints: Number(e.target.value) || 0 })}
                dir="ltr"
                className="text-right"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLevelDialog(false)}>إلغاء</Button>
            <Button onClick={handleUpdateLevel} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
