"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { todayLocal } from "@/lib/utils/format";
import { Flame, Users, BookOpen, Calendar, FileText, Loader2, Lock } from "lucide-react";

// ─── Static Data ─────────────────────────────────────────────────────────────

const FOUNDER_TASKS = [
  {
    block: "الصباح (٨–٩ ص)",
    items: [
      { id: "f1", text: "مراجعة كل الصفقات المفتوحة المتوقفة أكثر من ٣ أيام" },
      { id: "f3", text: "٥ دقائق مراجعة سريعة مع كل مندوب عن نتيجة أمس" },
    ],
  },
  {
    block: "الظهر (١٢–١ ظ)",
    items: [
      { id: "f4", text: "الاستماع لتسجيل مكالمة واحدة عشوائية وتقييمها" },
      { id: "f5", text: "التأكد أن كل العروض المتفق عليها اليوم أُرسلت فعليًا" },
    ],
  },
  {
    block: "العصر (٤–٦ ع)",
    items: [
      { id: "f2", text: "اتصال شخصي بأهم ٣ صفقات ساخنة في القمع" },
      { id: "f6", text: "مراجعة نتائج اليوم: كم انقفل، كم تعثر، ولماذا بالضبط" },
      { id: "f7", text: "تحديث سبب التعثر لكل صفقة متعثرة (مو وصف عام)" },
      { id: "f8", text: "ملاحظة مكتوبة واحدة لكل مندوب قبل ما يسكرون" },
    ],
  },
];

const ALL_FOUNDER_IDS = FOUNDER_TASKS.flatMap((b) => b.items.map((i) => i.id));

const REP_TASKS = [
  { id: "r1", text: "كل مكالمة مسجلة بسبب نتيجة واضح، مو بس \"تم الاتصال\"" },
  { id: "r2", text: "ما فيه صفقة بدون خطوة تالية محددة بتاريخ ووقت" },
  { id: "r3", text: "العرض يرسل خلال ٣٠ دقيقة من نهاية المكالمة" },
  { id: "r4", text: "كل عرض معلق أكثر من يومين تمت متابعته بمكالمة مو رسالة" },
  { id: "r5", text: "سبب الرفض أو التأجيل مسجل بالتحديد لما يوصل" },
];

const REASONS = [
  "ما فيه خطوة تالية واضحة بتاريخ ووقت محدد — الصفقة تضيع من نفسها.",
  "المتابعة متأخرة أكثر من ٤٨ ساعة على إرسال العرض.",
  "ما تم التعامل مع الاعتراض الحقيقي — السعر مو دائمًا هو السبب الفعلي.",
  "المندوب يكلم شخص مو صاحب القرار النهائي.",
  "ما فيه سبب يخلي العميل يقرر الحين بدل ما يأجل.",
  "تسجيل ضعيف في المتابعة يخلي الصفقة تُنسى بدون قصد.",
];

const CADENCE = [
  { day: "الاثنين", text: "مراجعة كل الصفقات المتعثرة أكثر من ٥ أيام مع الفريق كامل، وتحديد سبب دقيق لكل وحدة." },
  { day: "الأربعاء", text: "مراجعة نصف الأسبوع: نسبة الإغلاق حتى الآن مقابل الهدف، وتصحيح المسار إذا لازم." },
  { day: "الخميس", text: "تحليل كل صفقة راحت مقابل كل صفقة انقفلت هالأسبوع — وش الفرق الحقيقي بينهم." },
];

const METRIC_KEYS = [
  { key: "calls", label: "مكالمات" },
  { key: "offers", label: "عروض" },
  { key: "closes", label: "إغلاقات" },
  { key: "revived", label: "متعثرة حُلّت" },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface RepState {
  tasks: Record<string, boolean>;
  metrics: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDate(): string {
  return todayLocal();
}

function yesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatDateAr(iso: string): string {
  const [y, m, day] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function getLast7Dates(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DisciplinePage() {
  const { user: authUser } = useAuth();
  const supabase = createClient();
  const today = todayDate();

  const isManager =
    authUser?.isSuperAdmin ||
    authUser?.roleName === "مدير" ||
    authUser?.roleName === "admin";

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [founderTasks, setFounderTasks] = useState<Record<string, boolean>>({});
  const [sealed, setSealed] = useState(false);
  const [notes, setNotes] = useState("");
  const [streak, setStreak] = useState(0);
  const [sealedDates, setSealedDates] = useState<Set<string>>(new Set());

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [repStates, setRepStates] = useState<Record<string, RepState>>({});

  const [reasonsOpen, setReasonsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Load data ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Load employees (sales roles)
      const { data: empData } = await supabase
        .from("employees")
        .select("id, name, role")
        .order("name");
      const emps: Employee[] = (empData || []).filter((e) =>
        e.role?.includes("مبيعات") || e.role?.includes("مندوب")
      );
      setEmployees(emps);

      // Load founder tasks
      const { data: fTasks } = await supabase
        .from("founder_daily_tasks")
        .select("task_id, done")
        .eq("user_id", user.id)
        .eq("task_date", today);
      const fMap: Record<string, boolean> = {};
      (fTasks || []).forEach((r) => { fMap[r.task_id] = r.done; });
      setFounderTasks(fMap);

      // Load today's seal & notes
      const { data: sealData } = await supabase
        .from("daily_seal")
        .select("sealed, notes")
        .eq("user_id", user.id)
        .eq("task_date", today)
        .maybeSingle();
      setSealed(sealData?.sealed ?? false);
      setNotes(sealData?.notes ?? "");

      // Load streak
      const { data: streakData } = await supabase
        .from("user_streak")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle();
      setStreak(streakData?.current_streak ?? 0);

      // Load last 7 sealed dates for beads
      const last7 = getLast7Dates();
      const { data: sealHistory } = await supabase
        .from("daily_seal")
        .select("task_date")
        .eq("user_id", user.id)
        .eq("sealed", true)
        .gte("task_date", last7[0]);
      setSealedDates(new Set((sealHistory || []).map((r) => r.task_date)));

      // Load rep states
      if (emps.length > 0) {
        const empIds = emps.map((e) => e.id);

        const { data: repTasks } = await supabase
          .from("employee_daily_checklist")
          .select("employee_id, task_id, done")
          .in("employee_id", empIds)
          .eq("task_date", today);

        const { data: repMetrics } = await supabase
          .from("employee_daily_metrics")
          .select("employee_id, calls, offers, closes, revived")
          .in("employee_id", empIds)
          .eq("task_date", today);

        const states: Record<string, RepState> = {};
        emps.forEach((e) => {
          states[e.id] = { tasks: {}, metrics: { calls: 0, offers: 0, closes: 0, revived: 0 } };
        });
        (repTasks || []).forEach((r) => {
          if (states[r.employee_id]) states[r.employee_id].tasks[r.task_id] = r.done;
        });
        (repMetrics || []).forEach((r) => {
          if (states[r.employee_id]) {
            states[r.employee_id].metrics = {
              calls: r.calls ?? 0,
              offers: r.offers ?? 0,
              closes: r.closes ?? 0,
              revived: r.revived ?? 0,
            };
          }
        });
        setRepStates(states);
      }
    } finally {
      setLoading(false);
    }
  }, [today]); // eslint-disable-line

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Toggle founder task ──
  const toggleFounderTask = async (taskId: string) => {
    if (sealed || !userId) return;
    const newVal = !founderTasks[taskId];
    setFounderTasks((prev) => ({ ...prev, [taskId]: newVal }));
    await supabase.from("founder_daily_tasks").upsert({
      user_id: userId,
      task_date: today,
      task_id: taskId,
      done: newVal,
    }, { onConflict: "user_id,task_date,task_id" });
  };

  // ── Toggle rep task ──
  const toggleRepTask = async (empId: string, taskId: string) => {
    const newVal = !repStates[empId]?.tasks[taskId];
    setRepStates((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], tasks: { ...prev[empId]?.tasks, [taskId]: newVal } },
    }));
    await supabase.from("employee_daily_checklist").upsert({
      employee_id: empId,
      task_date: today,
      task_id: taskId,
      done: newVal,
    }, { onConflict: "employee_id,task_date,task_id" });
  };

  // ── Update rep metric ──
  const updateRepMetric = async (empId: string, key: string, value: number) => {
    const current = repStates[empId]?.metrics ?? {};
    const updated = { ...current, [key]: value };
    setRepStates((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], metrics: updated },
    }));
    await supabase.from("employee_daily_metrics").upsert({
      employee_id: empId,
      task_date: today,
      ...updated,
    }, { onConflict: "employee_id,task_date" });
  };

  // ── Save notes ──
  const saveNotes = async (val: string) => {
    setNotes(val);
    if (!userId) return;
    await supabase.from("daily_seal").upsert({
      user_id: userId,
      task_date: today,
      sealed: sealed,
      notes: val,
    }, { onConflict: "user_id,task_date" });
  };

  // ── Seal day ──
  const sealDay = async () => {
    if (!userId || !allFounderDone) return;
    setSaving(true);
    try {
      // Upsert seal
      await supabase.from("daily_seal").upsert({
        user_id: userId,
        task_date: today,
        sealed: true,
        notes,
      }, { onConflict: "user_id,task_date" });

      // Compute new streak
      const { data: streakRow } = await supabase
        .from("user_streak")
        .select("current_streak, last_sealed_date")
        .eq("user_id", userId)
        .maybeSingle();

      const lastDate = streakRow?.last_sealed_date;
      const yesterday = yesterdayDate();
      let newStreak = 1;
      if (lastDate === today) {
        newStreak = streakRow?.current_streak ?? 1;
      } else if (lastDate === yesterday) {
        newStreak = (streakRow?.current_streak ?? 0) + 1;
      }

      await supabase.from("user_streak").upsert({
        user_id: userId,
        current_streak: newStreak,
        last_sealed_date: today,
      }, { onConflict: "user_id" });

      setSealed(true);
      setStreak(newStreak);
      setSealedDates((prev) => new Set([...prev, today]));
    } finally {
      setSaving(false);
    }
  };

  // ── Unseal day ──
  const unsealDay = async () => {
    if (!userId) return;
    await supabase.from("daily_seal").upsert({
      user_id: userId,
      task_date: today,
      sealed: false,
      notes,
    }, { onConflict: "user_id,task_date" });
    setSealed(false);
  };

  // ── Computed ──
  const allFounderDone = ALL_FOUNDER_IDS.every((id) => founderTasks[id]);
  const founderProgress = Math.round(
    (ALL_FOUNDER_IDS.filter((id) => founderTasks[id]).length / ALL_FOUNDER_IDS.length) * 100
  );
  const last7 = getLast7Dates();

  // ── Access guard ──
  if (!loading && !isManager) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
        <Lock className="w-12 h-12 text-purple-400 opacity-60" />
        <h2 className="text-xl font-bold" style={{ fontFamily: "Cairo, sans-serif", color: "#F0D580" }}>
          هذه الصفحة للمدير فقط
        </h2>
        <p className="text-sm" style={{ color: "#AFA0C9" }}>ليس لديك صلاحية الوصول إلى لوحة الانضباط.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#8B5CF6" }} />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen p-4 md:p-7 pb-20" style={{ fontFamily: "Tajawal, sans-serif" }}>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <header className="flex flex-wrap gap-4 justify-between items-end pb-5 border-b" style={{ borderColor: "#352A57" }}>
          <div>
            <h1 className="text-2xl font-extrabold" style={{ fontFamily: "Cairo, sans-serif", color: "#F0D580", letterSpacing: "0.3px" }}>
              لوحة انضباط إغلاق الصفقات
            </h1>
            <p className="text-sm mt-1" style={{ color: "#AFA0C9" }}>{formatDateAr(today)}</p>
          </div>
          {/* Streak beads */}
          <div>
            <div className="flex gap-1.5 items-center">
              {last7.map((date) => {
                const filled = sealedDates.has(date);
                return (
                  <div
                    key={date}
                    title={formatDateAr(date)}
                    className="w-4 h-4 rounded-full border transition-all duration-300"
                    style={{
                      background: filled
                        ? "radial-gradient(circle at 35% 30%, #F0D580, #D4AF37 70%)"
                        : "#241B3D",
                      borderColor: filled ? "#D4AF37" : "#352A57",
                      boxShadow: filled ? "0 0 10px rgba(212,175,55,.55)" : "none",
                    }}
                  />
                );
              })}
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#AFA0C9" }}>
              التزام متواصل: <b style={{ color: "#F0D580", fontFamily: "Cairo, sans-serif" }}>{streak}</b> يوم
            </p>
          </div>
        </header>

        {/* Founder Tasks */}
        <Section icon={<span className="text-base">🗝️</span>} title="مهامك اليوم (المؤسس)">
          <p className="text-xs mb-4" style={{ color: "#AFA0C9" }}>
            هذي مهامك أنت شخصيًا. الهدف: ما تخلي أي صفقة "تنسى" من غير متابعة، وتمسك جودة المندوبين أول بأول.
          </p>
          {FOUNDER_TASKS.map((block) => (
            <div key={block.block} className="mb-4">
              <p className="text-xs font-bold mb-2" style={{ color: "#8B5CF6", fontFamily: "Cairo, sans-serif" }}>
                {block.block}
              </p>
              {block.items.map((item) => {
                const done = !!founderTasks[item.id];
                return (
                  <TaskRow
                    key={item.id}
                    text={item.text}
                    done={done}
                    disabled={sealed}
                    onToggle={() => toggleFounderTask(item.id)}
                  />
                );
              })}
            </div>
          ))}
          {/* Progress bar */}
          <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ background: "#241B3D" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${founderProgress}%`,
                background: "linear-gradient(90deg, #6E37C9, #D4AF37)",
              }}
            />
          </div>
          <p className="text-xs mt-1 text-left" style={{ color: "#AFA0C9" }}>{founderProgress}%</p>
        </Section>

        {/* Rep Tasks */}
        {employees.length > 0 && (
          <Section icon={<Users className="w-4 h-4" />} title="مهام الفريق اليومية">
            <p className="text-xs mb-4" style={{ color: "#AFA0C9" }}>
              كل مندوب يعلّم على اللي أنجزه ويسجل أرقامه. أنت بس تراجع، ما تسوي المهمة بدل عنه.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {employees.map((emp) => {
                const state = repStates[emp.id] ?? { tasks: {}, metrics: { calls: 0, offers: 0, closes: 0, revived: 0 } };
                const repDoneCount = REP_TASKS.filter((t) => state.tasks[t.id]).length;
                return (
                  <div
                    key={emp.id}
                    className="rounded-2xl p-4"
                    style={{ background: "#241B3D", border: "1px solid #352A57" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-sm" style={{ fontFamily: "Cairo, sans-serif", color: "#F0D580" }}>
                          {emp.name}
                        </p>
                        <p className="text-xs" style={{ color: "#AFA0C9" }}>{emp.role}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#352A57", color: repDoneCount === REP_TASKS.length ? "#D4AF37" : "#AFA0C9" }}>
                        {repDoneCount}/{REP_TASKS.length}
                      </span>
                    </div>
                    {REP_TASKS.map((task) => (
                      <TaskRow
                        key={task.id}
                        text={task.text}
                        done={!!state.tasks[task.id]}
                        onToggle={() => toggleRepTask(emp.id, task.id)}
                        small
                      />
                    ))}
                    {/* Metrics */}
                    <div className="grid grid-cols-4 gap-1.5 mt-3">
                      {METRIC_KEYS.map(({ key, label }) => (
                        <div key={key} className="text-center">
                          <label className="block text-xs mb-1" style={{ color: "#AFA0C9", fontSize: "10px" }}>{label}</label>
                          <input
                            type="number"
                            min={0}
                            value={state.metrics[key] || ""}
                            onChange={(e) => updateRepMetric(emp.id, key, parseInt(e.target.value) || 0)}
                            className="w-full text-center rounded-lg text-sm py-1.5 px-0 font-bold outline-none focus:ring-1"
                            style={{
                              background: "#1C1530",
                              border: "1px solid #352A57",
                              color: "#F3EEF9",
                              fontFamily: "Tajawal, sans-serif",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Reasons */}
        <Section icon={<BookOpen className="w-4 h-4" />} title="ليش الصفقات ما تنقفل — مرجع سريع">
          <button
            onClick={() => setReasonsOpen((p) => !p)}
            className="text-sm font-bold mb-3"
            style={{ color: "#8B5CF6", background: "none", border: "none", cursor: "pointer" }}
          >
            {reasonsOpen ? "▾ " : "▸ "}
            {reasonsOpen ? "أخفِ الأسباب" : "افتح الأسباب الستة الشائعة"}
          </button>
          {reasonsOpen && (
            <ul className="space-y-2.5 m-0 p-0 list-none">
              {REASONS.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-sm rounded-xl p-2.5"
                  style={{
                    background: "#1C1530",
                    borderInlineStart: "3px solid #8B5CF6",
                    lineHeight: 1.6,
                    color: "#F3EEF9",
                  }}
                >
                  <b style={{ color: "#F0D580", fontFamily: "Cairo, sans-serif", minWidth: "20px" }}>{i + 1}</b>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Weekly Cadence */}
        <Section icon={<Calendar className="w-4 h-4" />} title="الإيقاع الأسبوعي">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {CADENCE.map((c) => (
              <div key={c.day} className="rounded-xl p-3 text-sm" style={{ background: "#241B3D" }}>
                <b className="block mb-1" style={{ color: "#F0D580", fontFamily: "Cairo, sans-serif" }}>{c.day}</b>
                <span style={{ color: "#AFA0C9" }}>{c.text}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Notes */}
        <Section icon={<FileText className="w-4 h-4" />} title="ملاحظات اليوم">
          <textarea
            value={notes}
            onChange={(e) => saveNotes(e.target.value)}
            placeholder="أي ملاحظة تبي تسجلها عن اليوم، صفقة معينة، أو شي تلاحظه على الفريق..."
            rows={4}
            className="w-full rounded-xl p-3 text-sm resize-y outline-none focus:ring-1"
            style={{
              background: "#241B3D",
              border: "1px solid #352A57",
              color: "#F3EEF9",
              fontFamily: "Tajawal, sans-serif",
              minHeight: "80px",
            }}
          />
        </Section>

        {/* Seal Zone */}
        <section
          className="rounded-2xl flex flex-col items-center gap-4 py-8 px-4"
          style={{ background: "#1C1530", border: "1px solid #352A57" }}
        >
          {/* Wax seal */}
          {sealed && (
            <div
              className="flex items-center justify-center rounded-full text-2xl font-extrabold"
              style={{
                width: "92px",
                height: "92px",
                background: "radial-gradient(circle at 35% 30%, #F0D580, #D4AF37 55%, #8a6c1c 100%)",
                color: "#2A1F45",
                fontFamily: "Cairo, sans-serif",
                boxShadow: "0 6px 22px rgba(212,175,55,.4), inset 0 0 0 4px rgba(255,255,255,.15)",
                transform: "rotate(-8deg)",
              }}
            >
              <Flame className="w-8 h-8" />
            </div>
          )}

          <button
            disabled={!allFounderDone || sealed || saving}
            onClick={sealDay}
            className="rounded-2xl px-8 py-3.5 font-bold text-base transition-all duration-200"
            style={{
              fontFamily: "Cairo, sans-serif",
              background: "linear-gradient(135deg, #6E37C9, #4C1D8C)",
              color: "#F0D580",
              border: "1px solid #D4AF37",
              opacity: (!allFounderDone || sealed) ? 0.4 : 1,
              cursor: (!allFounderDone || sealed) ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "جاري الختم..." : sealed ? "تم ختم اليوم ✓" : "أختم اليوم"}
          </button>

          <p className="text-xs text-center" style={{ color: "#AFA0C9" }}>
            {sealed
              ? "اليوم مختوم. يمكنك العودة للتعديل إذا احتجت."
              : allFounderDone
              ? "كل مهامك منجزة — يمكنك ختم اليوم الآن."
              : "أنجز كل مهامك أعلاه عشان تقدر تختم اليوم."}
          </p>

          {sealed && (
            <button
              onClick={unsealDay}
              className="text-xs underline bg-transparent border-none cursor-pointer"
              style={{ color: "#8B5CF6" }}
            >
              تراجع وعدّل اليوم
            </button>
          )}
        </section>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode; }) {
  return (
    <section
      className="rounded-2xl p-5"
      style={{ background: "#1C1530", border: "1px solid #352A57" }}
    >
      <h2
        className="flex items-center gap-2 text-base font-bold mb-3"
        style={{ fontFamily: "Cairo, sans-serif", color: "#F0D580" }}
      >
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function TaskRow({
  text,
  done,
  disabled = false,
  onToggle,
  small = false,
}: {
  text: string;
  done: boolean;
  disabled?: boolean;
  onToggle: () => void | Promise<void>;
  small?: boolean;
}) {
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      className="flex items-start gap-2.5 rounded-xl px-2 py-2 transition-colors duration-150"
      style={{ cursor: disabled ? "default" : "pointer" }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = "#241B3D";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {/* Custom checkbox */}
      <div
        className="flex items-center justify-center rounded-md shrink-0 mt-0.5 transition-all duration-200"
        style={{
          width: "18px",
          height: "18px",
          minWidth: "18px",
          background: done ? "#D4AF37" : "transparent",
          border: `1.5px solid ${done ? "#D4AF37" : "#8B5CF6"}`,
          borderRadius: "5px",
        }}
      >
        {done && (
          <span style={{ color: "#1C1530", fontSize: "11px", fontWeight: 900 }}>✓</span>
        )}
      </div>
      <span
        className={`${small ? "text-xs" : "text-sm"} leading-relaxed`}
        style={{ color: done ? "#AFA0C9" : "#F3EEF9", textDecoration: done ? "line-through" : "none" }}
      >
        {text}
      </span>
    </div>
  );
}
