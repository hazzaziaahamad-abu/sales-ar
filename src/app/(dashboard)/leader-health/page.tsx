"use client";

import { useState, useEffect, useMemo } from "react";

/**
 * صحة القائد — تحدي ٩٠ يوم
 * Leader's Health — 90-Day Challenge for weight loss + discipline.
 * Persists to localStorage on this device.
 */

const STORAGE_KEY = "wl_challenge_v1";

type DailyLog = {
  weight?: number;
  breakfast?: boolean;
  lunch?: boolean;
  snacks?: boolean;
  sugar?: "kept" | "broken" | null;
  soda?: "kept" | "broken" | null;
  bread?: "kept" | "broken" | null;
  water?: number;
  steps?: number;
  sleep?: number;
};

type ChallengeState = {
  startDate: string | null;
  startWeight: number | null;
  targetWeight: number | null;
  dailyLogs: Record<string, DailyLog>;
};

type Meal = { emoji: string; name: string; desc: string; tags: string[]; cal: string };
type MealCategory = "breakfast" | "lunch" | "snacks";

const MEALS_DB: Record<MealCategory, Meal[]> = {
  breakfast: [
    { emoji: "🍳", name: "بيض مسلوق + جبنة قريش", desc: "٢ بيضة مسلوقة مع ٤ ملاعق جبنة قريش وخيار وطماطم", tags: ["عالي بروتين"], cal: "٢٨٠" },
    { emoji: "🫘", name: "فول مدمس صحي", desc: "كوب فول مع ملعقة زيت زيتون وليمون، بدون خبز — مع خضار طازجة", tags: ["ألياف"], cal: "٣٢٠" },
    { emoji: "🥣", name: "شوفان بالحليب والقرفة", desc: "نصف كوب شوفان مع حليب خالي الدسم وقرفة وحفنة لوز", tags: ["طاقة"], cal: "٣٥٠" },
    { emoji: "🥚", name: "عجة بالخضار", desc: "بيضتان مع طماطم وفلفل وبصل وقليل من زيت الزيتون", tags: ["سريعة"], cal: "٢٦٠" },
    { emoji: "🥗", name: "مسبحة (حمص) خفيفة", desc: "حمص بليمون وزيت زيتون مع بقدونس — بدون خبز، مع خيار", tags: ["نباتي"], cal: "٣٠٠" },
    { emoji: "🥛", name: "زبادي يوناني بالمكسرات", desc: "علبة زبادي يوناني خالي الدسم مع لوز وجوز وقرفة", tags: ["بروتين"], cal: "٢٤٠" },
    { emoji: "🧀", name: "شكشوكة بالبيض", desc: "بيضتان مطبوختان في صلصة طماطم وفلفل وبصل، بدون خبز", tags: ["سعودي"], cal: "٢٩٠" },
    { emoji: "🥒", name: "لبنة بزيت الزيتون والخضار", desc: "لبنة قليلة الدسم مع زيتون وخيار وطماطم وزعتر", tags: ["تقليدي"], cal: "٢٧٠" },
  ],
  lunch: [
    { emoji: "🍗", name: "دجاج مشوي + سلطة", desc: "صدر دجاج مشوي ٢٠٠غ مع سلطة خضراء كبيرة وزيت زيتون وليمون", tags: ["الأقوى"], cal: "٤٢٠" },
    { emoji: "🐟", name: "سمك مشوي بالخضار", desc: "هامور أو سلمون مشوي مع خضار سوتيه (كوسا، فلفل، بروكلي)", tags: ["أوميغا ٣"], cal: "٤٥٠" },
    { emoji: "🥩", name: "مشاوي لحم ليّن", desc: "١٥٠غ لحم بقر مشوي مع تبولة (بقدونس، طماطم، ليمون، بدون برغل أو قليل جداً)", tags: ["حديد"], cal: "٤٨٠" },
    { emoji: "🍲", name: "شوربة عدس + سلطة", desc: "شوربة عدس بدون خبز مع سلطة فتوش (بدون خبز محمّص)", tags: ["ألياف"], cal: "٣٨٠" },
    { emoji: "🍗", name: "كبسة دايت — بدون أرز", desc: "دجاج مطبوخ ببهارات الكبسة مع كرنب وجزر بديلاً عن الأرز", tags: ["سعودي"], cal: "٤٤٠" },
    { emoji: "🥘", name: "مرقة لحم بالخضار", desc: "قطع لحم مع كوسا وباذنجان وطماطم وبهارات — بدون أرز أو خبز", tags: ["دسم"], cal: "٤٦٠" },
    { emoji: "🦐", name: "روبيان مشوي بالليمون", desc: "روبيان مشوي مع ثوم وليمون وسلطة جانبية كبيرة", tags: ["خفيف"], cal: "٣٩٠" },
    { emoji: "🥗", name: "سلطة سيزر بالدجاج", desc: "خس روماني، صدر دجاج مشوي، صلصة سيزر خفيفة، جبنة قليلة", tags: ["سريعة"], cal: "٤١٠" },
  ],
  snacks: [
    { emoji: "🥒", name: "خضار مع حمص", desc: "خيار وجزر وفلفل مع ٣ ملاعق حمص محضّر منزلياً", tags: ["ألياف"], cal: "١٥٠" },
    { emoji: "🥜", name: "حفنة مكسرات نيّئة", desc: "١٥ حبة لوز أو ١٠ حبات جوز — غير محمّصة وبدون ملح", tags: ["دهون صحية"], cal: "١٨٠" },
    { emoji: "🍎", name: "تفاحة + زبدة لوز", desc: "تفاحة متوسطة مع ملعقة زبدة لوز طبيعية", tags: ["سكر طبيعي"], cal: "٢٠٠" },
    { emoji: "🥛", name: "زبادي يوناني سادة", desc: "علبة زبادي يوناني خالي الدسم — بدون إضافات سكرية", tags: ["بروتين"], cal: "١٢٠" },
    { emoji: "🥚", name: "بيضة مسلوقة", desc: "بيضة مسلوقة مع رشة فلفل وخيار", tags: ["سريع"], cal: "٨٠" },
    { emoji: "🧀", name: "جبنة قريش بالخضار", desc: "كوب صغير جبنة قريش مع طماطم كرزية وخيار", tags: ["خفيف"], cal: "١٣٠" },
    { emoji: "🍓", name: "فراولة + جوز", desc: "كوب فراولة طازجة مع ٥ حبات جوز", tags: ["أكسدة"], cal: "١٤٠" },
    { emoji: "🥑", name: "نصف أفوكادو بالليمون", desc: "نصف ثمرة أفوكادو مع ليمون وفلفل أسود", tags: ["دهون جيدة"], cal: "١٧٠" },
  ],
};

const MILESTONES = [
  { tag: "الشهر الأول", period: "يوم ١ — ٣٠", target: "−٤ كجم", focus: "مرحلة التكيف. التركيز على بناء العادة وتجاوز الجوع المفاجئ. الجسم يتخلص من الماء الزائد أولاً." },
  { tag: "الشهر الثاني", period: "يوم ٣١ — ٦٠", target: "−٥ كجم", focus: "مرحلة الذروة. الانضباط الآن طبيعي. ستلاحظ تغير ملابسك أكثر من الميزان. لا تستسلم لاستقرار الوزن." },
  { tag: "الشهر الثالث", period: "يوم ٦١ — ٩٠", target: "−٤ كجم", focus: "مرحلة الاستقرار والتثبيت. تبني نمط حياة دائم — ليس مجرد حمية مؤقتة. النتيجة الحقيقية تظهر هنا." },
];

const todayISO = () => new Date().toISOString().split("T")[0];
const dateISO = (d: Date) => d.toISOString().split("T")[0];

function arabicNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const map = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(n).replace(/[0-9]/g, (d) => map[+d]);
}

function formatArabicDate(d: Date): string {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return `${days[d.getDay()]} · ${arabicNum(d.getDate())} ${months[d.getMonth()]}`;
}

function emptyState(): ChallengeState {
  return { startDate: null, startWeight: null, targetWeight: null, dailyLogs: {} };
}

function loadState(): ChallengeState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...(JSON.parse(raw) as Partial<ChallengeState>) };
  } catch {
    return emptyState();
  }
}

function saveState(s: ChallengeState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const isDayCompleted = (log: DailyLog): boolean =>
  !!(log.breakfast && log.lunch && log.snacks && log.sugar === "kept" && log.soda === "kept" && log.bread === "kept");

const isDayPartial = (log: DailyLog): boolean =>
  !!(log.breakfast || log.lunch || log.snacks || log.sugar || log.soda || log.bread || log.weight || log.water || log.steps);

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function LeaderHealthPage() {
  const [state, setState] = useState<ChallengeState>(emptyState());
  const [loaded, setLoaded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [mealCategory, setMealCategory] = useState<MealCategory>("breakfast");
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);

  useEffect(() => {
    setState(loadState());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveState(state);
  }, [state, loaded]);

  useEffect(() => {
    if (loaded && (!state.startWeight || !state.startDate)) {
      setSetupOpen(true);
    }
  }, [loaded, state.startWeight, state.startDate]);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 2200);
  };

  const today = todayISO();
  const todayLog: DailyLog = useMemo(() => state.dailyLogs[today] || {}, [state.dailyLogs, today]);

  const currentDay = useMemo(() => {
    if (!state.startDate) return 0;
    const start = new Date(state.startDate);
    const now = new Date(today);
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, Math.min(diff, 90));
  }, [state.startDate, today]);

  const currentWeight = useMemo(() => {
    const dates = Object.keys(state.dailyLogs).sort();
    for (let i = dates.length - 1; i >= 0; i--) {
      const w = state.dailyLogs[dates[i]].weight;
      if (w) return w;
    }
    return state.startWeight;
  }, [state.dailyLogs, state.startWeight]);

  const updateTodayLog = (changes: Partial<DailyLog>) => {
    setState((prev) => ({
      ...prev,
      dailyLogs: { ...prev.dailyLogs, [today]: { ...(prev.dailyLogs[today] || {}), ...changes } },
    }));
  };

  const toggleMeal = (meal: "breakfast" | "lunch" | "snacks") =>
    updateTodayLog({ [meal]: !todayLog[meal] } as Partial<DailyLog>);

  const cycleProhibition = (key: "sugar" | "soda" | "bread") => {
    const cur = todayLog[key];
    const next: "kept" | "broken" | null = cur === "kept" ? "broken" : cur === "broken" ? null : "kept";
    updateTodayLog({ [key]: next } as Partial<DailyLog>);
  };

  const adjustValue = (key: "steps" | "sleep", delta: number, min = 0, max = 999999) => {
    const cur = todayLog[key] || 0;
    updateTodayLog({ [key]: Math.max(min, Math.min(max, cur + delta)) } as Partial<DailyLog>);
  };

  const setWater = (glasses: number) => updateTodayLog({ water: glasses });

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#0a0d14] text-white flex items-center justify-center">
        <div className="text-[#8a92a3]">جاري التحميل…</div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0d14] text-[#ecedf0] -m-6 -mt-6"
      style={{ backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(201,169,97,0.08), transparent 60%)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-20">
        {/* HEADER */}
        <header className="flex justify-between items-center pb-8 mb-8 border-b border-[#2a3242]">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#c9a961] to-[#8a7340] grid place-items-center text-2xl font-bold text-[#1a1410] shadow-lg shadow-[#c9a961]/20">
              ٩٠
            </div>
            <div>
              <h1 className="text-xl font-semibold">صحة القائد · تحدي ٩٠ يوم</h1>
              <p className="text-xs text-[#8a92a3] mt-0.5 tracking-wider">{formatArabicDate(new Date())}</p>
            </div>
          </div>
          <button
            onClick={() => setSetupOpen(true)}
            className="w-10 h-10 rounded-lg bg-[#141926] border border-[#2a3242] text-[#8a92a3] hover:text-[#c9a961] hover:border-[#4a3f1f] transition grid place-items-center"
            aria-label="الإعدادات"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </header>

        {/* HERO */}
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-6 mb-8">
          <HeroCard currentDay={currentDay} />
          <WeightCard
            startW={state.startWeight}
            currentW={currentWeight}
            targetW={state.targetWeight}
            onEdit={() => setSetupOpen(true)}
          />
        </section>

        {/* TODAY */}
        <SectionTitle num="١" title="اليوم" meta={formatArabicDate(new Date())} />
        <section className="grid lg:grid-cols-[1.2fr_1fr] gap-5">
          <div className="bg-[#141926] border border-[#2a3242] rounded-2xl p-6">
            <MealsSection todayLog={todayLog} onToggle={toggleMeal} />
            <ProhibitionsSection todayLog={todayLog} onCycle={cycleProhibition} />
          </div>
          <TrackersCard
            todayLog={todayLog}
            onAdjust={adjustValue}
            onSetWater={setWater}
            onLogWeight={() => setWeightModalOpen(true)}
          />
        </section>

        {/* MILESTONES */}
        <SectionTitle num="٢" title="المراحل الشهرية" />
        <section className="grid md:grid-cols-3 gap-4">
          {MILESTONES.map((m, i) => {
            const startDay = i * 30 + 1;
            const endDay = (i + 1) * 30;
            let status: "" | "active" | "completed" = "";
            if (currentDay > endDay) status = "completed";
            else if (currentDay >= startDay && currentDay <= endDay) status = "active";
            return <MilestoneCard key={i} milestone={m} status={status} />;
          })}
        </section>

        {/* CALENDAR */}
        <SectionTitle num="٣" title="تقويم الـ ٩٠ يوم" />
        <Calendar state={state} />

        {/* CHART */}
        <SectionTitle num="٤" title="منحنى الوزن" />
        <WeightChart state={state} />

        {/* MEALS LIBRARY */}
        <SectionTitle num="٥" title="دليل الوجبات السعودية" />
        <div className="flex gap-2 mb-4">
          {([
            { id: "breakfast", label: "إفطار" },
            { id: "lunch", label: "غداء" },
            { id: "snacks", label: "سناكات" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMealCategory(tab.id)}
              className={`px-4 py-2.5 rounded-lg border text-sm transition ${
                mealCategory === tab.id
                  ? "bg-[#c9a961] border-[#c9a961] text-[#1a1410] font-medium"
                  : "bg-[#141926] border-[#2a3242] text-[#8a92a3] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MEALS_DB[mealCategory].map((meal, i) => (
            <MealCard key={i} meal={meal} />
          ))}
        </div>

        {/* QUOTE */}
        <div className="mt-9 px-7 py-6 bg-[#141926] border border-[#2a3242] border-r-[3px] border-r-[#c9a961] rounded-xl">
          <p className="text-lg leading-loose">
            «الانضباط هو الجسر بين الأهداف والإنجاز. كل يوم تلتزم فيه هو لبنة في النسخة التي تطمح إليها من نفسك.»
          </p>
          <p className="text-sm text-[#c9a961] mt-2">— تذكير يومي</p>
        </div>
      </div>

      {/* MODALS */}
      {setupOpen && (
        <SetupModal
          state={state}
          onSave={(data) => {
            setState((prev) => ({ ...prev, ...data }));
            setSetupOpen(false);
            showToast("تم الحفظ — بدأ التحدي");
          }}
          onClose={() => state.startWeight && setSetupOpen(false)}
          onReset={() => {
            if (typeof window !== "undefined" && window.confirm("هل أنت متأكد؟ سيتم حذف جميع البيانات.")) {
              setState(emptyState());
              showToast("تم حذف البيانات");
            }
          }}
          onError={(msg) => showToast(msg, true)}
        />
      )}

      {weightModalOpen && (
        <WeightModal
          initial={todayLog.weight}
          onSave={(w) => {
            updateTodayLog({ weight: w });
            setWeightModalOpen(false);
            showToast("تم تسجيل الوزن");
          }}
          onClose={() => setWeightModalOpen(false)}
          onError={(msg) => showToast(msg, true)}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 bg-[#141926] border ${
            toast.isError ? "border-[#e15d5d]" : "border-[#4a3f1f]"
          } rounded-lg text-sm z-50`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Sub-components
 * ═══════════════════════════════════════════════════════════════════════════ */

function SectionTitle({ num, title, meta }: { num: string; title: string; meta?: string }) {
  return (
    <div className="flex items-center gap-3 mt-9 mb-5">
      <div className="text-sm text-[#c9a961] w-7 h-7 border border-[#8a7340] rounded-lg grid place-items-center">{num}</div>
      <h2 className="font-semibold text-xl">{title}</h2>
      <div className="flex-1 h-px bg-gradient-to-l from-[#2a3242] to-transparent" />
      {meta && <span className="text-xs text-[#8a92a3]">{meta}</span>}
    </div>
  );
}

function HeroCard({ currentDay }: { currentDay: number }) {
  const pct = Math.round((currentDay / 90) * 100);
  return (
    <div className="bg-gradient-to-br from-[#141926] to-[#0f131c] border border-[#2a3242] rounded-2xl p-8 relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,169,97,0.12), transparent 70%)" }}
      />
      <div className="relative">
        <div className="text-[11px] tracking-[3px] text-[#c9a961] mb-3.5 font-medium">DAY · COUNTER</div>
        <h2 className="font-bold text-3xl leading-tight mb-2">الانضباط أقوى من العزيمة</h2>
        <p className="text-[#8a92a3] text-sm mb-7">رحلتك نحو نسخة أفضل من نفسك تبدأ بقرار يومي</p>
        <div className="flex items-baseline gap-3 mb-6">
          <span className="text-7xl sm:text-8xl leading-[0.9] bg-gradient-to-b from-[#e6c577] to-[#8a7340] bg-clip-text text-transparent font-extrabold">
            {arabicNum(currentDay)}
          </span>
          <span className="text-xl text-[#8a92a3]">
            من <strong className="text-white font-semibold">٩٠</strong> يوم
          </span>
        </div>
        <div>
          <div className="h-1.5 bg-[#1b2230] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-[#8a7340] to-[#e6c577] rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(201,169,97,0.5)]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2.5 text-xs text-[#8a92a3]">
            <span>{arabicNum(pct)}٪ مكتمل</span>
            <span>{arabicNum(Math.max(0, 90 - currentDay))} يوم متبقي</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeightCard({
  startW,
  currentW,
  targetW,
  onEdit,
}: {
  startW: number | null;
  currentW: number | null;
  targetW: number | null;
  onEdit: () => void;
}) {
  const lost = startW && currentW ? (startW - currentW).toFixed(1) : null;
  const remaining = currentW && targetW ? (currentW - targetW).toFixed(1) : null;
  return (
    <div className="bg-[#141926] border border-[#2a3242] rounded-2xl p-7 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-base">قياسات الوزن</h3>
        <button onClick={onEdit} className="text-xs text-[#c9a961] hover:underline">
          تعديل
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "البداية", val: startW },
          { label: "الحالي", val: currentW },
          { label: "الهدف", val: targetW },
        ].map((s, i) => (
          <div key={i} className="text-center py-3.5 px-2 bg-[#0f131c] border border-[#2a3242] rounded-xl">
            <div className="text-[11px] text-[#8a92a3] mb-1.5 tracking-wide">{s.label}</div>
            <div className="font-semibold text-xl">
              {s.val ? arabicNum(s.val) : "—"}
              <span className="text-xs text-[#8a92a3] mr-1">كجم</span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-sm py-3 px-4 rounded-lg border-r-[3px] border-r-[#4ec77a] bg-gradient-to-l from-[#4ec77a]/10 to-transparent">
        {lost && parseFloat(lost) > 0 ? (
          <>
            <strong className="text-[#4ec77a] font-semibold">−{arabicNum(lost)} كجم</strong>{" "}
            <span>أنت على الطريق الصحيح. تبقّى {arabicNum(remaining)} كجم للهدف.</span>
          </>
        ) : (
          <span>سجّل وزنك اليوم لتبدأ التتبّع</span>
        )}
      </div>
    </div>
  );
}

function MealsSection({
  todayLog,
  onToggle,
}: {
  todayLog: DailyLog;
  onToggle: (m: "breakfast" | "lunch" | "snacks") => void;
}) {
  const meals = [
    { id: "breakfast" as const, icon: "🌅", name: "الإفطار", time: "٧:٠٠ — ٩:٠٠ صباحاً" },
    { id: "lunch" as const, icon: "☀️", name: "الغداء", time: "١٢:٣٠ — ٢:٣٠ ظهراً" },
    { id: "snacks" as const, icon: "🥗", name: "سناكات صحية", time: "عند الحاجة فقط" },
  ];
  const count = meals.filter((m) => todayLog[m.id]).length;
  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-base">الوجبات</h3>
        <span className="text-xs text-[#8a92a3]">{arabicNum(count)}/٣</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {meals.map((m) => {
          const checked = !!todayLog[m.id];
          return (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition text-right ${
                checked
                  ? "bg-gradient-to-l from-[#c9a961]/10 to-[#0f131c] border-[#8a7340]"
                  : "bg-[#0f131c] border-[#2a3242] hover:border-[#8a7340]"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg border-2 grid place-items-center flex-shrink-0 transition ${
                  checked ? "bg-[#c9a961] border-[#c9a961]" : "border-[#2a3242]"
                }`}
              >
                {checked && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a1410" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div className="text-2xl">{m.icon}</div>
              <div className="flex-1">
                <div className="font-medium text-[15px]">{m.name}</div>
                <div className="text-xs text-[#8a92a3] mt-0.5">{m.time}</div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ProhibitionsSection({
  todayLog,
  onCycle,
}: {
  todayLog: DailyLog;
  onCycle: (k: "sugar" | "soda" | "bread") => void;
}) {
  const items = [
    { id: "sugar" as const, icon: "🍬", name: "السكريات" },
    { id: "soda" as const, icon: "🥤", name: "الغازيات" },
    { id: "bread" as const, icon: "🍞", name: "الخبز" },
  ];
  return (
    <>
      <div className="flex justify-between items-center mt-6 mb-4">
        <h3 className="font-semibold text-base">المحظورات</h3>
        <span className="text-xs text-[#8a92a3]">اضغط للتسجيل</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {items.map((p) => {
          const status = todayLog[p.id];
          return (
            <button
              key={p.id}
              onClick={() => onCycle(p.id)}
              className={`text-center p-4 rounded-xl border transition ${
                status === "kept"
                  ? "border-[#4ec77a] bg-gradient-to-b from-[#4ec77a]/10 to-[#0f131c]"
                  : status === "broken"
                    ? "border-[#e15d5d] bg-gradient-to-b from-[#e15d5d]/10 to-[#0f131c]"
                    : "border-[#2a3242] bg-[#0f131c] hover:border-[#8a7340]"
              }`}
            >
              <div className="text-3xl mb-1.5 opacity-85">{p.icon}</div>
              <div className="text-[13px] font-medium mb-1">{p.name}</div>
              <div
                className={`text-[11px] ${
                  status === "kept" ? "text-[#4ec77a]" : status === "broken" ? "text-[#e15d5d]" : "text-[#8a92a3]"
                }`}
              >
                {status === "kept" ? "✓ التزمت" : status === "broken" ? "× تناولت" : "— لم يسجّل"}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function TrackersCard({
  todayLog,
  onAdjust,
  onSetWater,
  onLogWeight,
}: {
  todayLog: DailyLog;
  onAdjust: (key: "steps" | "sleep", delta: number, min?: number, max?: number) => void;
  onSetWater: (g: number) => void;
  onLogWeight: () => void;
}) {
  return (
    <div className="bg-[#141926] border border-[#2a3242] rounded-2xl p-6">
      <h3 className="font-semibold text-base mb-5">المتابعة اليومية</h3>
      <div className="flex flex-col gap-4">
        <TrackerRow icon="⚖️" label="الوزن اليوم" value={todayLog.weight ? arabicNum(todayLog.weight) : "—"} target="كجم">
          <button
            onClick={onLogWeight}
            className="px-3.5 h-8 rounded-lg bg-[#0f131c] border border-[#2a3242] text-white hover:border-[#c9a961] hover:text-[#c9a961] transition text-sm"
          >
            تسجيل
          </button>
        </TrackerRow>

        <div className="flex items-start gap-3.5">
          <div className="w-[42px] h-[42px] rounded-lg bg-[#0f131c] border border-[#2a3242] grid place-items-center text-xl flex-shrink-0">
            💧
          </div>
          <div className="flex-1">
            <div className="text-xs text-[#8a92a3] mb-1">الماء</div>
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-lg">{arabicNum(todayLog.water || 0)}</span>
              <span className="text-xs text-[#8a92a3]">/ ٨ كاسات</span>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {Array.from({ length: 8 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const cur = todayLog.water || 0;
                    onSetWater(i + 1 === cur ? i : i + 1);
                  }}
                  aria-label={`كاس ${i + 1}`}
                  className={`w-[22px] h-[30px] border-2 rounded-t-sm rounded-b-lg transition ${
                    i < (todayLog.water || 0) ? "border-[#4a90e2]" : "border-[#2a3242] bg-transparent"
                  }`}
                  style={
                    i < (todayLog.water || 0)
                      ? { background: "linear-gradient(180deg, transparent 30%, #4a90e2 30%, #2c5fa3 100%)" }
                      : {}
                  }
                />
              ))}
            </div>
          </div>
        </div>

        <TrackerRow icon="👟" label="الخطوات" value={arabicNum(todayLog.steps || 0)} target="/ ٨٠٠٠">
          <div className="flex gap-1.5">
            <button
              onClick={() => onAdjust("steps", -500)}
              className="w-8 h-8 rounded-lg bg-[#0f131c] border border-[#2a3242] hover:border-[#c9a961] hover:text-[#c9a961] transition"
            >
              −
            </button>
            <button
              onClick={() => onAdjust("steps", 500)}
              className="w-8 h-8 rounded-lg bg-[#0f131c] border border-[#2a3242] hover:border-[#c9a961] hover:text-[#c9a961] transition"
            >
              ＋
            </button>
          </div>
        </TrackerRow>

        <TrackerRow icon="🌙" label="ساعات النوم" value={arabicNum(todayLog.sleep || 0)} target="/ ٧ ساعات">
          <div className="flex gap-1.5">
            <button
              onClick={() => onAdjust("sleep", -1, 0, 12)}
              className="w-8 h-8 rounded-lg bg-[#0f131c] border border-[#2a3242] hover:border-[#c9a961] hover:text-[#c9a961] transition"
            >
              −
            </button>
            <button
              onClick={() => onAdjust("sleep", 1, 0, 12)}
              className="w-8 h-8 rounded-lg bg-[#0f131c] border border-[#2a3242] hover:border-[#c9a961] hover:text-[#c9a961] transition"
            >
              ＋
            </button>
          </div>
        </TrackerRow>
      </div>
    </div>
  );
}

function TrackerRow({
  icon,
  label,
  value,
  target,
  children,
}: {
  icon: string;
  label: string;
  value: string;
  target: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5">
      <div className="w-[42px] h-[42px] rounded-lg bg-[#0f131c] border border-[#2a3242] grid place-items-center text-xl flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-xs text-[#8a92a3] mb-1">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-lg">{value}</span>
          <span className="text-xs text-[#8a92a3]">{target}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function MilestoneCard({
  milestone,
  status,
}: {
  milestone: typeof MILESTONES[number];
  status: "" | "active" | "completed";
}) {
  const cls =
    status === "completed"
      ? "border-[#4ec77a]"
      : status === "active"
        ? "border-[#c9a961] bg-gradient-to-br from-[#141926] to-[#c9a961]/[0.04]"
        : "border-[#2a3242]";
  const tagColor =
    status === "completed" ? "text-[#4ec77a]" : status === "active" ? "text-[#c9a961]" : "text-[#8a92a3]";
  return (
    <div className={`bg-[#141926] border ${cls} rounded-2xl p-6 relative overflow-hidden`}>
      {status === "active" && (
        <div
          className="absolute top-0 inset-x-0 h-[3px]"
          style={{ background: "linear-gradient(90deg, transparent, #c9a961, transparent)" }}
        />
      )}
      <div className={`text-[11px] tracking-wider mb-2 ${tagColor}`}>{milestone.tag.toUpperCase()}</div>
      <div className="font-semibold text-lg mb-1">{milestone.tag}</div>
      <div className="text-sm text-[#8a92a3] mb-4">{milestone.period}</div>
      <div className="text-4xl leading-none bg-gradient-to-b from-[#e6c577] to-[#8a7340] bg-clip-text text-transparent font-extrabold">
        {milestone.target}
      </div>
      <div className="text-xs text-[#8a92a3] mt-1">هدف هذا الشهر</div>
      <div className="mt-3.5 pt-3.5 border-t border-[#2a3242] text-[13px] text-[#8a92a3] leading-relaxed">
        {milestone.focus}
      </div>
    </div>
  );
}

function Calendar({ state }: { state: ChallengeState }) {
  const data = useMemo(() => {
    if (!state.startDate) return { days: [] as { num: number; cls: string; isToday: boolean; label: string }[], streak: 0 };
    const start = new Date(state.startDate);
    const today = new Date(todayISO());
    const arr: { num: number; cls: string; isToday: boolean; label: string }[] = [];
    let curStreak = 0;
    let maxStreak = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = dateISO(d);
      const log = state.dailyLogs[iso] || {};
      let cls = "";
      if (d > today) cls = "future";
      else if (isDayCompleted(log)) {
        cls = "completed";
        curStreak++;
        maxStreak = Math.max(maxStreak, curStreak);
      } else if (isDayPartial(log)) {
        cls = "partial";
        curStreak = 0;
      } else {
        curStreak = 0;
      }
      const isToday = iso === todayISO();
      arr.push({ num: i + 1, cls, isToday, label: formatArabicDate(d) });
    }
    return { days: arr, streak: maxStreak };
  }, [state]);

  return (
    <div className="bg-[#141926] border border-[#2a3242] rounded-2xl p-6">
      <div className="flex justify-between items-center mb-4 font-semibold text-base">
        <span>كل مربع = يوم. اللون الذهبي = يوم مكتمل</span>
        <span className="text-xs text-[#8a92a3] font-normal">
          {arabicNum(data.streak || 0)} يوم سلسلة متتالية
        </span>
      </div>
      {!state.startDate ? (
        <div className="text-center text-[#8a92a3] py-6">ابدأ التحدي لرؤية التقويم</div>
      ) : (
        <>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
            {data.days.map((d, i) => {
              const baseStyle = "aspect-square rounded-md grid place-items-center text-[11px] cursor-pointer transition hover:scale-110";
              let cls = `${baseStyle} bg-[#0f131c] border border-[#2a3242] text-[#5a6273]`;
              if (d.cls === "completed") cls = `${baseStyle} text-[#1a1410] font-semibold border border-[#c9a961]`;
              else if (d.cls === "partial") cls = `${baseStyle} border border-[#8a7340] text-[#e6c577] bg-[#c9a961]/20`;
              else if (d.cls === "future") cls += " opacity-40";
              const style: React.CSSProperties =
                d.cls === "completed" ? { background: "linear-gradient(135deg, #8a7340, #c9a961)" } : {};
              return (
                <div
                  key={i}
                  className={cls + (d.isToday ? " ring-2 ring-[#e6c577] ring-offset-2 ring-offset-[#141926]" : "")}
                  style={style}
                  title={d.label}
                >
                  {arabicNum(d.num)}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-[#8a92a3]">
            <LegendItem color="bg-gradient-to-br from-[#8a7340] to-[#c9a961]" label="مكتمل" />
            <LegendItem color="bg-[#c9a961]/20 border border-[#8a7340]" label="جزئي" />
            <LegendItem color="bg-[#0f131c] border border-[#2a3242]" label="لم يسجّل" />
            <LegendItem color="border-2 border-[#e6c577]" label="اليوم" />
          </div>
        </>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded ${color}`} />
      {label}
    </div>
  );
}

function WeightChart({ state }: { state: ChallengeState }) {
  const points = useMemo(() => {
    const pts: { date: string; weight: number }[] = [];
    if (state.startDate && state.startWeight) pts.push({ date: state.startDate, weight: state.startWeight });
    Object.keys(state.dailyLogs)
      .sort()
      .forEach((d) => {
        const w = state.dailyLogs[d].weight;
        if (w) pts.push({ date: d, weight: w });
      });
    return pts;
  }, [state]);

  if (points.length < 1 || !state.startWeight || !state.targetWeight) {
    return (
      <div className="bg-[#141926] border border-[#2a3242] rounded-2xl p-7">
        <div className="text-center text-[#8a92a3] py-12">سجّل وزنك لرؤية المنحنى</div>
      </div>
    );
  }

  const w = 700;
  const h = 240;
  const pad = { top: 20, right: 20, bottom: 30, left: 50 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;
  const weights = points.map((p) => p.weight);
  const minW = Math.min(...weights, state.targetWeight) - 1;
  const maxW = Math.max(...weights, state.startWeight) + 1;
  const xStep = points.length > 1 ? cw / (points.length - 1) : 0;
  const yScale = ch / (maxW - minW);
  const pathPts = points.map((p, i) => [pad.left + i * xStep, pad.top + (maxW - p.weight) * yScale]);
  const linePath = pathPts.map((pt, i) => (i === 0 ? "M" : "L") + pt[0] + "," + pt[1]).join(" ");
  const areaPath =
    linePath +
    ` L${pad.left + (points.length - 1) * xStep},${pad.top + ch} L${pad.left},${pad.top + ch} Z`;
  const targetY = pad.top + (maxW - state.targetWeight) * yScale;
  const startY = pad.top + (maxW - state.startWeight) * yScale;

  return (
    <div className="bg-[#141926] border border-[#2a3242] rounded-2xl p-7">
      <div className="flex justify-between items-center mb-5 font-semibold text-base">
        <span>تطوّر الوزن خلال التحدي</span>
        <span className="text-xs text-[#8a92a3] font-normal">{arabicNum(points.length)} قراءة مسجّلة</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-60">
        <defs>
          <linearGradient id="lh-areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a961" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#c9a961" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad.left} y1={targetY} x2={w - pad.right} y2={targetY} stroke="#4ec77a" strokeDasharray="4,4" strokeWidth="1" opacity="0.6" />
        <text x={w - pad.right} y={targetY - 6} textAnchor="end" fill="#4ec77a" fontSize="11">
          الهدف {arabicNum(state.targetWeight)}
        </text>
        <line x1={pad.left} y1={startY} x2={w - pad.right} y2={startY} stroke="#8a92a3" strokeDasharray="2,3" strokeWidth="1" opacity="0.4" />
        <path d={areaPath} fill="url(#lh-areaGrad)" />
        <path d={linePath} stroke="#c9a961" strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {pathPts.map((pt, i) => (
          <circle key={i} cx={pt[0]} cy={pt[1]} r="4" fill="#0a0d14" stroke="#e6c577" strokeWidth="2" />
        ))}
        <text x={pad.left - 10} y={pad.top + 4} textAnchor="end" fill="#8a92a3" fontSize="11">
          {arabicNum(maxW.toFixed(0))}
        </text>
        <text x={pad.left - 10} y={pad.top + ch + 4} textAnchor="end" fill="#8a92a3" fontSize="11">
          {arabicNum(minW.toFixed(0))}
        </text>
      </svg>
    </div>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  return (
    <div className="bg-[#141926] border border-[#2a3242] rounded-xl p-4 transition hover:border-[#8a7340] hover:-translate-y-0.5">
      <div className="text-3xl mb-2.5">{meal.emoji}</div>
      <div className="font-semibold text-[15px] mb-1">{meal.name}</div>
      <div className="text-xs text-[#8a92a3] leading-relaxed mb-3">{meal.desc}</div>
      <div className="flex gap-1.5 flex-wrap">
        <span className="text-[10px] px-2 py-1 rounded-md text-[#c9a961] border border-[#8a7340] bg-[#0f131c]">
          {meal.cal} سعرة
        </span>
        {meal.tags.map((t, i) => (
          <span key={i} className="text-[10px] px-2 py-1 rounded-md text-[#8a92a3] border border-[#2a3242] bg-[#0f131c]">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Modals
 * ═══════════════════════════════════════════════════════════════════════════ */

function SetupModal({
  state,
  onSave,
  onClose,
  onReset,
  onError,
}: {
  state: ChallengeState;
  onSave: (data: { startWeight: number; targetWeight: number; startDate: string }) => void;
  onClose: () => void;
  onReset: () => void;
  onError: (msg: string) => void;
}) {
  const [sw, setSw] = useState<string>(state.startWeight ? String(state.startWeight) : "");
  const [tw, setTw] = useState<string>(state.targetWeight ? String(state.targetWeight) : "");
  const [sd, setSd] = useState<string>(state.startDate || todayISO());

  const handleSave = () => {
    const swNum = parseFloat(sw);
    const twNum = parseFloat(tw);
    if (!swNum || !twNum || !sd) {
      onError("الرجاء تعبئة جميع الحقول");
      return;
    }
    if (twNum >= swNum) {
      onError("الوزن المستهدف يجب أن يكون أقل من الحالي");
      return;
    }
    onSave({ startWeight: swNum, targetWeight: twNum, startDate: sd });
  };

  return (
    <ModalShell onClose={onClose}>
      <h2 className="font-semibold text-2xl mb-2">{state.startWeight ? "الإعدادات" : "مرحباً بك في التحدي"}</h2>
      <p className="text-[#8a92a3] text-sm mb-6">دقيقة واحدة لإعداد رحلتك. يمكنك تعديل هذه القيم لاحقاً.</p>
      <FormGroup label="الوزن الحالي (كجم)">
        <input
          type="number"
          value={sw}
          onChange={(e) => setSw(e.target.value)}
          placeholder="مثلاً: ٩٥"
          step="0.1"
          className="w-full bg-[#0f131c] border border-[#2a3242] rounded-xl px-3.5 py-3 text-white focus:outline-none focus:border-[#c9a961]"
        />
      </FormGroup>
      <FormGroup label="الوزن المستهدف (كجم)">
        <input
          type="number"
          value={tw}
          onChange={(e) => setTw(e.target.value)}
          placeholder="مثلاً: ٨٢"
          step="0.1"
          className="w-full bg-[#0f131c] border border-[#2a3242] rounded-xl px-3.5 py-3 text-white focus:outline-none focus:border-[#c9a961]"
        />
      </FormGroup>
      <FormGroup label="تاريخ بدء التحدي">
        <input
          type="date"
          value={sd}
          onChange={(e) => setSd(e.target.value)}
          className="w-full bg-[#0f131c] border border-[#2a3242] rounded-xl px-3.5 py-3 text-white focus:outline-none focus:border-[#c9a961]"
        />
      </FormGroup>
      <button
        onClick={handleSave}
        className="w-full py-3.5 bg-gradient-to-br from-[#c9a961] to-[#8a7340] text-[#1a1410] rounded-xl font-semibold text-base mt-2 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#c9a961]/30 transition"
      >
        {state.startWeight ? "حفظ التغييرات" : "ابدأ التحدي"}
      </button>
      {state.startWeight && (
        <button
          onClick={onReset}
          className="w-full py-3 mt-2.5 text-[#8a92a3] border border-[#2a3242] rounded-xl text-sm hover:text-[#e15d5d] hover:border-[#e15d5d] transition"
        >
          حذف كل البيانات
        </button>
      )}
    </ModalShell>
  );
}

function WeightModal({
  initial,
  onSave,
  onClose,
  onError,
}: {
  initial?: number;
  onSave: (w: number) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const [val, setVal] = useState<string>(initial ? String(initial) : "");

  const handleSave = () => {
    const v = parseFloat(val);
    if (!v || v < 30 || v > 300) {
      onError("قيمة غير صحيحة");
      return;
    }
    onSave(v);
  };

  return (
    <ModalShell onClose={onClose}>
      <h2 className="font-semibold text-2xl mb-2">تسجيل وزن اليوم</h2>
      <p className="text-[#8a92a3] text-sm mb-6">سجّل وزنك صباحاً قبل الإفطار للحصول على قراءة دقيقة.</p>
      <FormGroup label="الوزن اليوم (كجم)">
        <input
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          step="0.1"
          autoFocus
          className="w-full bg-[#0f131c] border border-[#2a3242] rounded-xl px-3.5 py-3 text-white focus:outline-none focus:border-[#c9a961]"
        />
      </FormGroup>
      <button
        onClick={handleSave}
        className="w-full py-3.5 bg-gradient-to-br from-[#c9a961] to-[#8a7340] text-[#1a1410] rounded-xl font-semibold text-base mt-2 hover:-translate-y-0.5 transition"
      >
        حفظ
      </button>
      <button
        onClick={onClose}
        className="w-full py-3 mt-2.5 text-[#8a92a3] border border-[#2a3242] rounded-xl text-sm hover:text-white transition"
      >
        إلغاء
      </button>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-5">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#141926] border border-[#4a3f1f] rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        {children}
      </div>
    </div>
  );
}

function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-[13px] text-[#8a92a3] mb-2">{label}</label>
      {children}
    </div>
  );
}
