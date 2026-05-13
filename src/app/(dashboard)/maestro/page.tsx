"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Zap,
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  Timer,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Brain,
  Target,
  Users,
  Settings,
  Flame,
  Star,
  X,
  Pencil,
  AlertTriangle,
  Clock,
  Hourglass,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ─── Types ─── */
type Priority = "urgent-important" | "important" | "urgent" | "normal";
type Category = "strategic" | "team" | "operations";

interface Task {
  id: string;
  text: string;
  done: boolean;
  category: Category;
  priority: Priority;
  createdAt: number;
  completedAt?: number;
  dueDate?: string;
  dueTime?: string;
}

interface DailyWin {
  id: string;
  text: string;
  createdAt: number;
}

const CATEGORY_META: Record<Category, { label: string; icon: typeof Target; color: string; bg: string; border: string }> = {
  strategic:  { label: "مهام استراتيجية", icon: Target,   color: "text-violet-400", bg: "bg-violet-500/15", border: "border-violet-500/20" },
  team:       { label: "الفريق والمتابعة", icon: Users,    color: "text-cyan-400",   bg: "bg-cyan-500/15",   border: "border-cyan-500/20" },
  operations: { label: "التشغيل اليومي",  icon: Settings, color: "text-amber-400",  bg: "bg-amber-500/15",  border: "border-amber-500/20" },
};

const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  "urgent-important": { label: "عاجل ومهم",    color: "text-red-400",    bg: "bg-red-500/15" },
  "important":        { label: "مهم",          color: "text-amber-400",  bg: "bg-amber-500/15" },
  "urgent":           { label: "عاجل",         color: "text-orange-400", bg: "bg-orange-500/15" },
  "normal":           { label: "عادي",         color: "text-slate-400",  bg: "bg-slate-500/15" },
};

const STORAGE_KEY = "maestro_data";

function loadData(): { tasks: Task[]; wins: DailyWin[]; notes: string } {
  if (typeof window === "undefined") return { tasks: [], wins: [], notes: "" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: [], wins: [], notes: "" };
    const parsed = JSON.parse(raw);
    const today = new Date().toDateString();
    // Reset if data is from a different day
    if (parsed._day !== today) return { tasks: [], wins: [], notes: "" };
    return { tasks: parsed.tasks || [], wins: parsed.wins || [], notes: parsed.notes || "" };
  } catch { return { tasks: [], wins: [], notes: "" }; }
}

function saveData(tasks: Task[], wins: DailyWin[], notes: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, wins, notes, _day: new Date().toDateString() }));
}

function getCountdown(dueDate?: string, dueTime?: string): { label: string; urgency: "passed" | "critical" | "warning" | "normal" | "none" } {
  if (!dueDate) return { label: "", urgency: "none" };
  const target = new Date(`${dueDate}T${dueTime || "23:59"}:00`);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    const pastMins = Math.floor(Math.abs(diffMs) / 60_000);
    if (pastMins < 60) return { label: `متأخر ${pastMins} د`, urgency: "passed" };
    const pastHrs = Math.floor(pastMins / 60);
    if (pastHrs < 24) return { label: `متأخر ${pastHrs} س`, urgency: "passed" };
    return { label: `متأخر ${Math.floor(pastHrs / 24)} يوم`, urgency: "passed" };
  }
  const totalMins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const days = Math.floor(hours / 24);
  const rHrs = hours % 24;
  if (days > 0) return { label: `متبقي ${days} يوم${rHrs > 0 ? ` ${rHrs} س` : ""}`, urgency: days <= 1 ? "warning" : "normal" };
  if (hours > 0) return { label: `متبقي ${hours} س${mins > 0 ? ` ${mins} د` : ""}`, urgency: hours <= 2 ? "critical" : "warning" };
  return { label: `متبقي ${mins} د`, urgency: "critical" };
}

const COUNTDOWN_COLORS: Record<string, string> = {
  passed: "text-red-400 bg-red-500/10 border-red-500/20",
  critical: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  warning: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  normal: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  none: "",
};

/* ─── Page ─── */
export default function MaestroPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wins, setWins] = useState<DailyWin[]>([]);
  const [notes, setNotes] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    const d = loadData();
    setTasks(d.tasks);
    setWins(d.wins);
    setNotes(d.notes);
    setLoaded(true);
  }, []);

  // Auto-save
  useEffect(() => {
    if (loaded) saveData(tasks, wins, notes);
  }, [tasks, wins, notes, loaded]);

  /* ── Tick for countdown ── */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  /* ── Task CRUD ── */
  const [newTask, setNewTask] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("operations");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const addTask = () => {
    const text = newTask.trim();
    if (!text) return;
    const task: Task = { id: crypto.randomUUID(), text, done: false, category: newCategory, priority: newPriority, createdAt: Date.now() };
    if (newDueDate) task.dueDate = newDueDate;
    if (newDueTime) task.dueTime = newDueTime;
    setTasks((prev) => [...prev, task]);
    setNewTask("");
    setNewDueDate("");
    setNewDueTime("");
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: !t.done, completedAt: !t.done ? Date.now() : undefined } : t));
  };

  const deleteTask = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const startEdit = (t: Task) => { setEditingId(t.id); setEditText(t.text); };
  const saveEdit = () => {
    if (editText.trim() && editingId) {
      setTasks((prev) => prev.map((t) => t.id === editingId ? { ...t, text: editText.trim() } : t));
    }
    setEditingId(null);
    setEditText("");
  };

  /* ── Daily Wins ── */
  const [newWin, setNewWin] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  const addWin = () => {
    const text = newWin.trim();
    if (!text) return;
    setWins((prev) => [...prev, { id: crypto.randomUUID(), text, createdAt: Date.now() }]);
    setNewWin("");
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  /* ── Pomodoro ── */
  const [focusMode, setFocusMode] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (pomodoroRunning && pomodoroTime > 0) {
      intervalRef.current = setInterval(() => setPomodoroTime((t) => t - 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (pomodoroTime === 0 && pomodoroRunning) {
        setPomodoroRunning(false);
        setPomodoroTime(25 * 60);
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pomodoroRunning, pomodoroTime]);

  const pomMinutes = Math.floor(pomodoroTime / 60);
  const pomSeconds = pomodoroTime % 60;

  /* ── Analytics ── */
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;
  const energyPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const now = new Date();
  const workStart = new Date(now); workStart.setHours(9, 0, 0, 0);
  const workEnd = new Date(now); workEnd.setHours(17, 0, 0, 0);
  const hoursWorked = Math.max(0, (Math.min(now.getTime(), workEnd.getTime()) - workStart.getTime()) / 3600000);
  const hoursLeft = Math.max(0, (workEnd.getTime() - now.getTime()) / 3600000);
  const hourlyRate = hoursWorked > 0.5 ? (doneTasks / hoursWorked).toFixed(1) : "—";

  const energyColor = energyPct >= 80 ? "from-emerald-500 to-emerald-400" : energyPct >= 50 ? "from-amber-500 to-amber-400" : energyPct >= 25 ? "from-orange-500 to-orange-400" : "from-red-500 to-red-400";
  const energyLabel = energyPct >= 80 ? "طاقة ممتازة 🔥" : energyPct >= 50 ? "أداء جيد 💪" : energyPct >= 25 ? "استمر ⚡" : "ابدأ يومك 🚀";

  /* ── Priority Matrix counts ── */
  const matrixCounts = {
    "urgent-important": tasks.filter((t) => !t.done && t.priority === "urgent-important").length,
    "important": tasks.filter((t) => !t.done && t.priority === "important").length,
    "urgent": tasks.filter((t) => !t.done && t.priority === "urgent").length,
    "normal": tasks.filter((t) => !t.done && t.priority === "normal").length,
  };

  /* ── Focus Mode Overlay ── */
  if (focusMode) {
    const focusTask = tasks.find((t) => !t.done && (t.priority === "urgent-important" || t.priority === "important"));
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center space-y-8 max-w-lg mx-auto px-4">
          <div className="text-6xl font-mono font-bold text-white tracking-wider">
            {String(pomMinutes).padStart(2, "0")}:{String(pomSeconds).padStart(2, "0")}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setPomodoroRunning(!pomodoroRunning)} className="gap-1.5">
              {pomodoroRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {pomodoroRunning ? "إيقاف" : "ابدأ"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setPomodoroRunning(false); setPomodoroTime(25 * 60); }} className="gap-1.5">
              <RotateCcw className="w-4 h-4" />
              إعادة
            </Button>
          </div>
          {focusTask && (
            <div className="cc-card p-4 rounded-xl border border-violet-500/20">
              <p className="text-xs text-violet-400 mb-1">ركّز على:</p>
              <p className="text-base text-white font-medium">{focusTask.text}</p>
            </div>
          )}
          <Button variant="outline" onClick={() => setFocusMode(false)} className="gap-1.5">
            <X className="w-4 h-4" />
            خروج من وضع التركيز
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Maestro Control
          </h1>
          <p className="text-xs text-muted-foreground">لوحة التحكم اليومية — نظّم، ركّز، أنجز</p>
        </div>
        <Button onClick={() => setFocusMode(true)} variant="outline" className="gap-1.5">
          <Timer className="w-4 h-4" />
          وضع التركيز
        </Button>
      </div>

      {/* ── Top Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Energy Meter */}
        <div className="cc-card rounded-xl p-4 border border-emerald-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">مؤشر الطاقة</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{energyPct}%</div>
          <div className="w-full h-2 rounded-full bg-white/5 mt-2 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-l ${energyColor} transition-all duration-700`} style={{ width: `${energyPct}%` }} />
          </div>
          <p className="text-[12px] text-muted-foreground mt-1">{energyLabel}</p>
        </div>

        {/* Tasks Counter */}
        <div className="cc-card rounded-xl p-4 border border-violet-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">المهام</span>
            <CheckCircle className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{doneTasks}<span className="text-sm text-muted-foreground">/{totalTasks}</span></div>
          <p className="text-[12px] text-muted-foreground mt-1">مكتملة من الإجمالي</p>
        </div>

        {/* Hourly Rate */}
        <div className="cc-card rounded-xl p-4 border border-cyan-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">معدل الإنجاز</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{hourlyRate}</div>
          <p className="text-[12px] text-muted-foreground mt-1">مهمة / ساعة</p>
        </div>

        {/* Time Left */}
        <div className="cc-card rounded-xl p-4 border border-amber-500/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">الوقت المتبقي</span>
            <Timer className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">{hoursLeft.toFixed(1)}<span className="text-sm text-muted-foreground"> ساعة</span></div>
          <p className="text-[12px] text-muted-foreground mt-1">لنهاية يوم العمل</p>
        </div>
      </div>

      {/* ── Priority Matrix ── */}
      <div className="cc-card rounded-xl p-4 border border-white/5">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          مصفوفة الأولويات
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(PRIORITY_META) as [Priority, typeof PRIORITY_META[Priority]][]).map(([key, meta]) => (
            <div key={key} className={`rounded-lg p-3 ${meta.bg} border border-white/5`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                <span className={`text-lg font-bold ${meta.color}`}>{matrixCounts[key]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add Task ── */}
      <div className="cc-card rounded-xl p-4 border border-white/5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="أضف مهمة جديدة..."
              className="flex-1"
            />
            <Button onClick={addTask} size="sm" className="gap-1 shrink-0">
              <Plus className="w-4 h-4" />
              أضف
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as Category)}
              className="rounded-lg bg-white/5 border border-white/10 text-xs text-foreground px-2 py-1.5"
            >
              {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as Priority)}
              className="rounded-lg bg-white/5 border border-white/10 text-xs text-foreground px-2 py-1.5"
            >
              {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="rounded-lg bg-white/5 border border-white/10 text-xs text-foreground px-2 py-1.5"
              />
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                className="rounded-lg bg-white/5 border border-white/10 text-xs text-foreground px-2 py-1.5 w-[90px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Task Lists by Category ── */}
      {(Object.entries(CATEGORY_META) as [Category, typeof CATEGORY_META[Category]][]).map(([catKey, catMeta]) => {
        const catTasks = tasks.filter((t) => t.category === catKey);
        if (catTasks.length === 0) return null;
        const Icon = catMeta.icon;
        return (
          <div key={catKey} className={`cc-card rounded-xl p-4 border ${catMeta.border}`}>
            <h2 className={`text-sm font-semibold mb-3 flex items-center gap-2 ${catMeta.color}`}>
              <Icon className="w-4 h-4" />
              {catMeta.label}
              <span className="text-[12px] text-muted-foreground font-normal mr-auto">
                {catTasks.filter((t) => t.done).length}/{catTasks.length}
              </span>
            </h2>
            <div className="space-y-1.5">
              {catTasks.map((t) => {
                const cd = !t.done ? getCountdown(t.dueDate, t.dueTime) : { label: "", urgency: "none" as const };
                void tick;
                const CdIcon = cd.urgency === "passed" ? AlertTriangle : cd.urgency === "critical" ? Timer : Hourglass;
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg px-3 py-2 transition-all ${
                      t.done ? "bg-white/[0.02] opacity-50" : "bg-white/[0.04] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleTask(t.id)} className="shrink-0">
                        {t.done
                          ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                          : <Circle className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      {editingId === t.id ? (
                        <Input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          onBlur={saveEdit}
                          className="flex-1 h-7 text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {t.text}
                        </span>
                      )}
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${PRIORITY_META[t.priority].bg} ${PRIORITY_META[t.priority].color}`}>
                        {PRIORITY_META[t.priority].label}
                      </span>
                      {!t.done && (
                        <button onClick={() => startEdit(t)} className="text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    {cd.urgency !== "none" && (
                      <div className="mr-6 mt-1">
                        <span className={`inline-flex items-center gap-1 text-[12px] font-bold px-2 py-0.5 rounded-md border ${COUNTDOWN_COLORS[cd.urgency]} ${cd.urgency === "passed" || cd.urgency === "critical" ? "animate-pulse" : ""}`}>
                          <CdIcon className="w-3 h-3" />
                          {cd.label}
                          {t.dueDate && <span className="font-normal opacity-70 mr-1">({t.dueDate}{t.dueTime ? ` ${t.dueTime}` : ""})</span>}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Bottom Row: Notes + Daily Wins ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quick Brain Dump */}
        <div className="cc-card rounded-xl p-4 border border-cyan-500/10">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-400" />
            ملاحظات سريعة
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="اكتب أفكارك هنا..."
            className="w-full h-32 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-foreground p-3 resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
        </div>

        {/* Daily Win Wall */}
        <div className="cc-card rounded-xl p-4 border border-amber-500/10 relative overflow-hidden">
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-4xl animate-bounce z-10">
              🎉
            </div>
          )}
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            إنجازات اليوم
            {wins.length > 0 && <span className="text-[12px] text-amber-400 mr-1">{wins.length}</span>}
          </h2>
          <div className="flex gap-2 mb-3">
            <Input
              value={newWin}
              onChange={(e) => setNewWin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWin()}
              placeholder="أضف إنجازاً..."
              className="flex-1"
            />
            <Button onClick={addWin} size="sm" className="gap-1">
              <Star className="w-3 h-3" />
              أضف
            </Button>
          </div>
          <div className="space-y-1.5">
            {wins.map((w) => (
              <div key={w.id} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-amber-500/[0.06] border border-amber-500/10">
                <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-sm text-foreground flex-1">{w.text}</span>
                <button onClick={() => setWins((prev) => prev.filter((x) => x.id !== w.id))} className="text-muted-foreground hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {wins.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">أضف أول إنجاز لهذا اليوم!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
