"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import type { SalesActivity, SalesTarget, RepWeeklyScore, PipPlan, Employee, PipelineStageItem, ActivityPointItem, ScoreLevelItem, SalesMessage, SalesMessageRating } from "@/types";
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
import { formatMoneyFull, formatDate } from "@/lib/utils/format";
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
  activity_date: new Date().toISOString().split("T")[0],
  activity_type: "" as string,
  result: "" as string,
  employee_name: "",
  client_name: "",
  notes: "",
};

const EMPTY_PIP = {
  employee_name: "",
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  reason: "",
  target_percentage: 100,
};

export default function SalesGuidePage() {
  const { user } = useAuth();

  /* ─── State ─── */
  const [activities, setActivities] = useState<SalesActivity[]>([]);
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
    const [a, t, s, p, e, gs, msgs] = await Promise.allSettled([
      fetchSalesActivities(),
      fetchSalesTargets(),
      fetchRepWeeklyScores(),
      fetchPipPlans(),
      fetchEmployees(),
      fetchSalesGuideSettings(),
      fetchSalesMessages(),
    ]);
    if (a.status === "fulfilled") setActivities(a.value);
    if (t.status === "fulfilled") setTargets(t.value);
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
  const todayStr = new Date().toISOString().split("T")[0];
  const todayActivities = activities.filter((a) => a.activity_date === todayStr);
  const weekActivities = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const start = startOfWeek.toISOString().split("T")[0];
    return activities.filter((a) => a.activity_date >= start);
  }, [activities]);

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
      const created = await createPipPlan({
        employee_name: pipForm.employee_name,
        start_date: pipForm.start_date,
        end_date: pipForm.end_date,
        status: "active",
        current_week: 1,
        target_percentage: pipForm.target_percentage,
        actual_percentage: 0,
        reason: pipForm.reason || undefined,
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
          <TabsTrigger value="activities" className="rounded-xl text-xs px-4 py-2">سجل النشاطات</TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-xl text-xs px-4 py-2">لوحة المتصدرين</TabsTrigger>
          <TabsTrigger value="targets" className="rounded-xl text-xs px-4 py-2">الأهداف</TabsTrigger>
          <TabsTrigger value="pip" className="rounded-xl text-xs px-4 py-2">خطط التحسين</TabsTrigger>
          <TabsTrigger value="pipeline" className="rounded-xl text-xs px-4 py-2">دليل المراحل</TabsTrigger>
          <TabsTrigger value="messages" className="rounded-xl text-xs px-4 py-2">رسائل الاستهداف</TabsTrigger>
          <TabsTrigger value="scripts" className="rounded-xl text-xs px-4 py-2">سكربت المكالمات</TabsTrigger>
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

            {scores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>لا توجد نتائج أسبوعية بعد</p>
                <p className="text-sm mt-1">سيتم حساب النقاط تلقائيا من النشاطات</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scores.map((s, idx) => {
                  const levelInfo = s.level ? LEVEL_BADGE[s.level] : null;
                  const emoji = scoreLevels.find((l) => l.value === s.level)?.emoji || "";
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-4 rounded-2xl p-4 border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
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
                        <p className="text-[10px] text-muted-foreground">نقطة</p>
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
                    const types = keyToTypes[t.target_key];
                    if (!types) return 0;

                    if (t.period_type === "daily") {
                      return todayActivities.filter((a) => types.includes(a.activity_type)).length;
                    } else if (t.period_type === "weekly") {
                      return weekActivities.filter((a) => types.includes(a.activity_type)).length;
                    } else {
                      // monthly
                      const now = new Date();
                      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
                      return activities.filter((a) => a.activity_date >= monthStart && types.includes(a.activity_type)).length;
                    }
                  })();

                  const pct = t.target_value > 0 ? Math.min(Math.round((actual / t.target_value) * 100), 100) : 0;
                  const isAboveMin = actual >= t.min_value;
                  const isAboveTarget = actual >= t.target_value;

                  return (
                    <div
                      key={t.id}
                      className="rounded-2xl p-4 border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
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
                          <p className="text-[10px] text-muted-foreground">الهدف</p>
                          <p className="text-xl font-extrabold text-cc-green">{t.target_value.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">الحد الأدنى</p>
                          <p className="text-xl font-extrabold text-amber">{t.min_value.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">المتحقق</p>
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
        <TabsContent value="pip" className="mt-4">
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
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl p-4 border border-white/6 bg-white/[0.02]"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{p.employee_name}</p>
                          <ColorBadge text={statusInfo.label} color={statusInfo.color} />
                        </div>
                        {p.status === "active" && (
                          <div className="flex gap-1.5">
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
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
                        <div>
                          <span className="block text-[10px]">تاريخ البدء</span>
                          <span className="text-foreground">{formatDate(p.start_date)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px]">تاريخ الانتهاء</span>
                          <span className="text-foreground">{formatDate(p.end_date)}</span>
                        </div>
                        <div>
                          <span className="block text-[10px]">الأسبوع الحالي</span>
                          <span className="text-foreground">{p.current_week}/4</span>
                        </div>
                        <div>
                          <span className="block text-[10px]">التقدم</span>
                          <span className="text-foreground">{progress}%</span>
                        </div>
                      </div>
                      {p.reason && (
                        <p className="mt-2 text-xs text-muted-foreground border-t border-white/6 pt-2">
                          السبب: {p.reason}
                        </p>
                      )}
                      {/* Progress bar */}
                      <div className="mt-3 w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            progress >= 80 ? "bg-cc-green" : progress >= 50 ? "bg-amber" : "bg-cc-red"
                          }`}
                          style={{ width: `${Math.min(100, progress)}%` }}
                        />
                      </div>
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
                  className="flex items-center gap-4 rounded-2xl p-4 border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
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
                    className="flex items-center justify-between rounded-xl p-3 border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
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
                    className="flex items-center gap-2 rounded-xl p-3 border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <span className="text-lg">{level.emoji}</span>
                    <div>
                      <p className="text-sm font-bold">{level.label}</p>
                      <p className="text-[10px] text-muted-foreground">
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

        {/* ── Messages & Scripts Tabs (shared renderer) ── */}
        {(["messages", "scripts"] as const).map((tabKey) => {
          const msgType = tabKey === "messages" ? "message" : "script";
          const tabLabel = tabKey === "messages" ? "رسائل الاستهداف" : "سكربت المكالمات";
          const tabIcon = tabKey === "messages" ? <MessageSquare className="w-5 h-5" /> : <PhoneCall className="w-5 h-5" />;
          const filtered = messages.filter((m) => m.msg_type === msgType && (msgCategoryFilter === "all" || m.category === msgCategoryFilter));

          return (
            <TabsContent key={tabKey} value={tabKey} className="mt-4">
              <div className="glass-surface rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {tabIcon}
                    <h3 className="text-lg font-bold">{tabLabel}</h3>
                  </div>
                  <Button size="sm" onClick={() => openAddMsg(msgType)} className="gap-1.5">
                    <Plus className="w-4 h-4" /> إضافة
                  </Button>
                </div>

                {/* Category filter */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <button
                    onClick={() => setMsgCategoryFilter("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs transition-all ${
                      msgCategoryFilter === "all"
                        ? "bg-cyan/15 text-cyan font-medium border border-cyan/30"
                        : "text-muted-foreground hover:text-foreground border border-white/6"
                    }`}
                  >
                    الكل
                  </button>
                  {MSG_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setMsgCategoryFilter(cat.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs transition-all ${
                        msgCategoryFilter === cat.value
                          ? "bg-cyan/15 text-cyan font-medium border border-cyan/30"
                          : "text-muted-foreground hover:text-foreground border border-white/6"
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Messages list */}
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {tabKey === "messages" ? <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" /> : <PhoneCall className="w-12 h-12 mx-auto mb-3 opacity-30" />}
                    <p>لا توجد {tabLabel} بعد</p>
                    <p className="text-sm mt-1">أضف أول {tabKey === "messages" ? "رسالة" : "سكربت"} لفريق المبيعات</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filtered.map((m) => {
                      const catInfo = MSG_CATEGORIES.find((c) => c.value === m.category);
                      return (
                        <div
                          key={m.id}
                          className="rounded-2xl p-4 border border-white/6 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-foreground">{m.title}</h4>
                              <ColorBadge
                                text={`${catInfo?.icon || ""} ${catInfo?.label || m.category}`}
                                color={m.category === "new_client" ? "green" : m.category === "renewal_client" ? "amber" : "purple"}
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => openEditMsg(m)} className="w-7 h-7 p-0 text-muted-foreground hover:text-cyan">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteMsg(m.id)} className="w-7 h-7 p-0 text-muted-foreground hover:text-cc-red">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Content */}
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed mb-3">{m.content}</p>

                          {/* Rating & actions */}
                          <div className="flex items-center justify-between border-t border-white/6 pt-3">
                            <div className="flex items-center gap-3">
                              {/* Stars display */}
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-4 h-4 ${s <= Math.round(m.avg_rating) ? "text-amber fill-amber" : "text-muted-foreground/30"}`}
                                  />
                                ))}
                                <span className="text-xs text-muted-foreground mr-1">
                                  {m.avg_rating > 0 ? m.avg_rating.toFixed(1) : "—"} ({m.ratings_count})
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleViewRatings(m.id)} className="text-xs text-muted-foreground gap-1">
                                <MessageSquare className="w-3.5 h-3.5" /> التعليقات
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openRating(m.id)} className="text-xs text-cyan gap-1">
                                <Star className="w-3.5 h-3.5" /> تقييم
                              </Button>
                            </div>
                          </div>

                          {/* Inline ratings view */}
                          {viewRatings?.msgId === m.id && viewRatings.ratings.length > 0 && (
                            <div className="mt-3 border-t border-white/6 pt-3 space-y-2">
                              {viewRatings.ratings.map((r) => (
                                <div key={r.id} className="flex items-start gap-2 text-xs">
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star key={s} className={`w-3 h-3 ${s <= r.rating ? "text-amber fill-amber" : "text-muted-foreground/20"}`} />
                                    ))}
                                  </div>
                                  <div className="flex-1">
                                    <span className="font-medium text-foreground">{r.rated_by || "مجهول"}</span>
                                    {r.comment && <p className="text-muted-foreground mt-0.5">{r.comment}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {viewRatings?.msgId === m.id && viewRatings.ratings.length === 0 && (
                            <p className="mt-3 border-t border-white/6 pt-3 text-xs text-muted-foreground text-center">لا توجد تعليقات بعد</p>
                          )}

                          {/* Created by */}
                          {m.created_by && (
                            <p className="text-[10px] text-muted-foreground/50 mt-2">بواسطة: {m.created_by}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          );
        })}
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
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>إنشاء خطة تحسين أداء</DialogTitle>
            <DialogDescription>خطة مدتها 4 أسابيع لتحسين أداء الموظف</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
            <div>
              <Label>النسبة المستهدفة %</Label>
              <Input
                type="number"
                value={pipForm.target_percentage}
                onChange={(e) => setPipForm({ ...pipForm, target_percentage: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>سبب الخطة</Label>
              <Textarea
                value={pipForm.reason}
                onChange={(e) => setPipForm({ ...pipForm, reason: e.target.value })}
                placeholder="سبب إنشاء خطة التحسين..."
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
              <p className="text-[10px] text-muted-foreground mt-1">استخدم قيمة سالبة للخصم (مثل: -10)</p>
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

      {/* ─── Add/Edit Message Dialog ─── */}
      <Dialog open={msgDialog} onOpenChange={setMsgDialog}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingMsg ? "تعديل" : "إضافة"} {msgForm.msg_type === "message" ? "رسالة استهداف" : "سكربت مكالمة"}</DialogTitle>
            <DialogDescription>
              {editingMsg ? "تعديل المحتوى" : "أضف محتوى جديد لفريق المبيعات"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>الفئة</Label>
              <Select
                value={msgForm.category}
                onValueChange={(v) => setMsgForm({ ...msgForm, category: v as SalesMessage["category"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MSG_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>العنوان</Label>
              <Input
                value={msgForm.title}
                onChange={(e) => setMsgForm({ ...msgForm, title: e.target.value })}
                placeholder={msgForm.msg_type === "message" ? "عنوان الرسالة..." : "عنوان السكربت..."}
              />
            </div>
            <div>
              <Label>المحتوى</Label>
              <Textarea
                value={msgForm.content}
                onChange={(e) => setMsgForm({ ...msgForm, content: e.target.value })}
                placeholder={msgForm.msg_type === "message" ? "نص الرسالة..." : "نص السكربت..."}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMsgDialog(false)}>إلغاء</Button>
            <Button onClick={handleSaveMsg} disabled={saving || !msgForm.title.trim() || !msgForm.content.trim()}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Rating Dialog ─── */}
      <Dialog open={ratingDialog} onOpenChange={setRatingDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>تقييم وتعليق</DialogTitle>
            <DialogDescription>قيّم هذا المحتوى وأضف تعليقك</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>التقييم</Label>
              <div className="flex items-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRatingForm({ ...ratingForm, rating: s })}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`w-7 h-7 ${s <= ratingForm.rating ? "text-amber fill-amber" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
                <span className="text-sm font-bold text-amber mr-2">{ratingForm.rating}/5</span>
              </div>
            </div>
            <div>
              <Label>تعليق (اختياري)</Label>
              <Textarea
                value={ratingForm.comment}
                onChange={(e) => setRatingForm({ ...ratingForm, comment: e.target.value })}
                placeholder="أضف تعليقك على هذا الأسلوب..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRatingDialog(false)}>إلغاء</Button>
            <Button onClick={handleSubmitRating} disabled={saving} className="gap-1.5">
              <Send className="w-4 h-4" />
              {saving ? "جارٍ الإرسال..." : "إرسال التقييم"}
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
