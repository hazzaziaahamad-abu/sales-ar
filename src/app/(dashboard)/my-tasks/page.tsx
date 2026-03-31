"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchEmployeeTasks,
  updateEmployeeTask,
  fetchMyTaskStats,
  fetchTeamTaskStats,
} from "@/lib/supabase/db";
import type { EmployeeTask } from "@/types";
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
} from "lucide-react";

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

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("today");
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, in_progress: 0, overdue: 0 });
  const [myRank, setMyRank] = useState<{ rank: number; total: number; rate: number }>({ rank: 0, total: 0, rate: 0 });
  const [completionNote, setCompletionNote] = useState<{ taskId: string; note: string } | null>(null);

  const todayQuote = useMemo(() => {
    const start = new Date("2025-01-01").getTime();
    const now = Date.now();
    const dayIndex = Math.floor((now - start) / (1000 * 60 * 60 * 24)) % MOTIVATIONAL_QUOTES.length;
    return MOTIVATIONAL_QUOTES[dayIndex];
  }, []);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [myTasks, myStats, teamStats] = await Promise.all([
        fetchEmployeeTasks({ assigned_to: user.id }),
        fetchMyTaskStats(user.id),
        fetchTeamTaskStats(),
      ]);
      setTasks(myTasks);
      setStats(myStats);
      const myTeam = teamStats.find(s => s.employee_id === user.id);
      const rank = teamStats.findIndex(s => s.employee_id === user.id) + 1;
      setMyRank({
        rank: rank || teamStats.length + 1,
        total: teamStats.length,
        rate: myTeam?.completion_rate ?? 0,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

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
    await updateEmployeeTask(completionNote.taskId, {
      status: "completed",
      completion_notes: completionNote.note || undefined,
    });
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
            <div className={`text-center px-5 py-3 rounded-xl bg-white/[0.06] border border-white/10`}>
              <p className="text-xs text-gray-400 mb-1">مستواك</p>
              <p className={`text-lg font-bold ${level.color}`}>{level.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Quote */}
      <div className="glass-surface rounded-2xl p-5 border border-white/[0.06] relative overflow-hidden">
        <div className="absolute top-3 left-3 text-6xl text-white/[0.03] font-serif">&ldquo;</div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white text-sm leading-relaxed font-medium">&ldquo;{todayQuote.text}&rdquo;</p>
            <p className="text-amber-400/70 text-xs mt-2">— {todayQuote.author}</p>
          </div>
        </div>
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
          <div className="w-full h-3 rounded-full bg-white/[0.06] overflow-hidden">
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
      <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
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
                : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
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
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Completion note modal */}
      {completionNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-[#111827] rounded-2xl border border-white/10 w-full max-w-md p-6">
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
              className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none mb-4"
              rows={3}
              placeholder="مثال: تم التواصل مع العميل واتفقنا على..."
            />
            <div className="flex gap-3">
              <button
                onClick={handleComplete}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-all"
              >
                تم الإنجاز ✓
              </button>
              <button
                onClick={() => setCompletionNote(null)}
                className="px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/10 text-gray-400 font-medium transition-all"
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
