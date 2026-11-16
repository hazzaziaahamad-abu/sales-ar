"use client";

// «تدرّب» — أكاديمية دليل الموظف: مسار تعلّم بمستويات ونقاط.
// ١ القاموس ← ٢ بطاقات المزايا ← ٣ تحدّي «العميل قال…» ← ٤ شهادة الجاهزية.
// كل الأسئلة والبطاقات تتولّد من محتوى الدليل نفسه — أي تعديل على الدليل ينعكس هنا تلقائياً.

import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen, Layers, Swords, Award, Check, X, RotateCcw, Search, ChevronLeft, Flame, Star,
  MessageSquareQuote, Sparkles, Trophy, Lightbulb, Shuffle,
} from "lucide-react";
import { GLOSSARY, type StaffProduct, type Feature, type ProductKey } from "@/lib/sales/meeting-staff-content";

const GOLD = "#FFCC00";
const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (n: number) => Math.round(n).toLocaleString(LOCALE);
const shuffle = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };

const LEVELS = [
  { min: 0, name: "مبتدئ", emoji: "🌱" },
  { min: 150, name: "متدرّب", emoji: "📘" },
  { min: 400, name: "محترف", emoji: "🚀" },
  { min: 800, name: "خبير الباقات", emoji: "🏆" },
];
const XP = { term: 5, card: 10, correct: 20 };
const PASS = 8; // من ١٠

type Progress = { terms: string[]; known: string[]; best: number; xp: number; name: string };
const EMPTY: Progress = { terms: [], known: [], best: 0, xp: 0, name: "" };
const storeKey = (pk: ProductKey) => `msg-train-${pk}`;

function load(pk: ProductKey): Progress {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(storeKey(pk)) ?? "{}") }; } catch { return EMPTY; }
}

type Station = "glossary" | "cards" | "quiz" | "cert";

export default function MeetingStaffTraining({ product: P, onGuide }: { product: StaffProduct; onGuide: () => void }) {
  const [prog, setProg] = useState<Progress>(() => load(P.key));
  useEffect(() => { try { localStorage.setItem(storeKey(P.key), JSON.stringify(prog)); } catch { /* ignore */ } }, [prog, P.key]);

  const terms = useMemo(() => GLOSSARY.filter((t) => t.product === "both" || t.product === P.key), [P.key]);
  const cards = useMemo(() => P.tiers.flatMap((t, ti) => t.groups.flatMap((g) => g.features.map((f) => ({ f, ti, id: `${ti}:${f.title}` })))), [P]);

  const done = {
    glossary: terms.every((t) => prog.terms.includes(t.term)),
    cards: cards.filter((c) => prog.known.includes(c.id)).length >= Math.ceil(cards.length * 0.8),
    quiz: prog.best >= PASS,
  };
  const allDone = done.glossary && done.cards && done.quiz;
  const firstOpen: Station = !done.glossary ? "glossary" : !done.cards ? "cards" : !done.quiz ? "quiz" : "cert";
  const [station, setStationRaw] = useState<Station>(firstOpen);
  const setStation = (st: Station) => {
    setStationRaw(st);
    requestAnimationFrame(() => document.getElementById("academy-main")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const level = [...LEVELS].reverse().find((l) => prog.xp >= l.min)!;
  const nextLevel = LEVELS.find((l) => l.min > prog.xp);
  const lvlPct = nextLevel ? ((prog.xp - level.min) / (nextLevel.min - level.min)) * 100 : 100;

  const addXp = (n: number) => setProg((p) => ({ ...p, xp: p.xp + n }));

  const STATIONS: { id: Station; n: number; icon: typeof BookOpen; title: string; sub: string; ok: boolean }[] = [
    { id: "glossary", n: 1, icon: BookOpen, title: "افهم الكلمات", sub: `${fmt(prog.terms.filter((t) => terms.some((x) => x.term === t)).length)}/${fmt(terms.length)} مصطلح`, ok: done.glossary },
    { id: "cards", n: 2, icon: Layers, title: "احفظ المزايا", sub: `${fmt(cards.filter((c) => prog.known.includes(c.id)).length)}/${fmt(cards.length)} بطاقة`, ok: done.cards },
    { id: "quiz", n: 3, icon: Swords, title: "تحدّي العميل", sub: prog.best ? `أفضل نتيجة ${fmt(prog.best)}/١٠` : `النجاح ${fmt(PASS)}/١٠`, ok: done.quiz },
    { id: "cert", n: 4, icon: Award, title: "شهادة الجاهزية", sub: allDone ? "جاهز للاجتماع ✓" : "أكمل المحطات", ok: allDone },
  ];

  return (
    <div>
      {/* ─── غلاف الأكاديمية ─── */}
      <section className="relative overflow-hidden px-4 pb-12 pt-28 text-white sm:px-8 sm:pt-32"
        style={{ background: `linear-gradient(140deg, #0E1030 0%, ${P.deep} 55%, ${P.accent} 100%)` }}>
        <div className="ms-dots pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-end gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold backdrop-blur">
                <Sparkles size={13} style={{ color: GOLD }} /> أكاديمية {P.brand} — للموظف الجديد والقديم
              </div>
              <h1 className="mt-5 text-4xl font-black leading-[1.15] sm:text-5xl">
                من «وش يعني باركود؟»<br /><span style={{ color: GOLD }}>إلى خبير الباقات</span>
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">
                ٤ محطات قصيرة: تفهم الكلمات، تحفظ المزايا ببطاقات تقلبها، تتحدّى نفسك بمواقف عملاء حقيقية، وتطلع بشهادة جاهزية. كل خطوة تكسبك نقاط وترفع مستواك.
              </p>
            </div>
            {/* بطاقة المستوى */}
            <div className="rounded-3xl border border-white/15 bg-white/[.08] p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="grid h-14 w-14 place-items-center rounded-2xl text-3xl" style={{ background: `${GOLD}26` }}>{level.emoji}</span>
                <div className="flex-1">
                  <div className="text-xs text-white/60">مستواك الحالي</div>
                  <div className="text-2xl font-black">{level.name}</div>
                </div>
                <div className="text-left">
                  <div className="text-3xl font-black" style={{ color: GOLD }}>{fmt(prog.xp)}</div>
                  <div className="text-[11px] text-white/60">نقطة</div>
                </div>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${lvlPct}%`, background: `linear-gradient(90deg, ${GOLD}, #FFE680)` }} />
              </div>
              <div className="mt-1.5 text-[11px] text-white/60">
                {nextLevel ? `باقي ${fmt(nextLevel.min - prog.xp)} نقطة على «${nextLevel.name}» ${nextLevel.emoji}` : "وصلت أعلى مستوى 👑"}
              </div>
            </div>
          </div>

          {/* خريطة المسار */}
          <div className="relative mt-10">
            <div className="absolute inset-x-8 top-7 hidden h-0.5 bg-white/15 md:block" />
            <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4">
              {STATIONS.map((s) => {
                const on = s.id === station;
                return (
                  <button key={s.id} onClick={() => setStation(s.id)}
                    className="group flex flex-col items-center rounded-3xl p-3 text-center transition-all"
                    style={on ? { background: "rgba(255,255,255,.12)", boxShadow: `inset 0 0 0 1.5px ${GOLD}` } : {}}>
                    <span className="relative grid h-14 w-14 place-items-center rounded-full text-lg font-black transition-transform group-hover:scale-105"
                      style={s.ok ? { background: GOLD, color: "#1a1306" } : on ? { background: "#fff", color: P.deep } : { background: "rgba(255,255,255,.12)", color: "#fff", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.3)" }}>
                      {s.ok ? <Check size={24} /> : <s.icon size={22} />}
                      <span className="absolute -top-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-[#0E1030] text-[10px] font-black text-white">{fmt(s.n)}</span>
                    </span>
                    <span className="mt-2 text-sm font-black">{s.title}</span>
                    <span className="text-[11px] text-white/60">{s.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <main id="academy-main" className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-24 pt-10 sm:px-8">
        {station === "glossary" && (
          <Glossary terms={terms} seen={prog.terms} onSee={(t) => { if (!prog.terms.includes(t)) { setProg((p) => ({ ...p, terms: [...p.terms, t] })); addXp(XP.term); } }}
            onNext={() => setStation("cards")} done={done.glossary} />
        )}
        {station === "cards" && (
          <Flashcards key={P.key} product={P} cards={cards} known={prog.known}
            onKnow={(id) => { if (!prog.known.includes(id)) { setProg((p) => ({ ...p, known: [...p.known, id] })); addXp(XP.card); } }}
            onForget={(id) => setProg((p) => ({ ...p, known: p.known.filter((k) => k !== id) }))}
            onNext={() => setStation("quiz")} done={done.cards} />
        )}
        {station === "quiz" && (
          <Quiz key={P.key} product={P} onCorrect={() => addXp(XP.correct)}
            onFinish={(score) => setProg((p) => ({ ...p, best: Math.max(p.best, score) }))}
            onNext={() => setStation("cert")} />
        )}
        {station === "cert" && (
          <Certificate product={P} prog={prog} allDone={allDone} level={level} stations={STATIONS} onGo={setStation}
            setName={(name) => setProg((p) => ({ ...p, name }))} onGuide={onGuide}
            onReset={() => { if (window.confirm("تصفير تقدّمك في الأكاديمية لهذا المنتج؟")) setProg(EMPTY); }} />
        )}
      </main>
    </div>
  );
}

/* ──────────────────────────── ١. القاموس ──────────────────────────── */

function Glossary({ terms, seen, onSee, onNext, done }: { terms: typeof GLOSSARY; seen: string[]; onSee: (t: string) => void; onNext: () => void; done: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const list = terms.filter((t) => !q || t.term.includes(q) || t.simple.includes(q));
  return (
    <div>
      <StationHead n={1} title="افهم الكلمات قبل ما تقولها" lead="اضغط على كل مصطلح: تعريف بسيط + جملة جاهزة للعميل. الموظف اللي يفهم الكلمة يشرحها بثقة." />
      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5">
        <Search size={16} className="text-[var(--faint)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مصطلح…" className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => {
          const isOpen = open === t.term;
          const isSeen = seen.includes(t.term);
          return (
            <button key={t.term} onClick={() => { setOpen(isOpen ? null : t.term); onSee(t.term); }}
              className="ms-card ms-feat relative flex flex-col p-4 text-right"
              style={isOpen ? { borderColor: "var(--acc)" } : {}}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--surface-2)] text-2xl">{t.emoji}</span>
                <span className="flex-1 font-black text-[var(--ink)]">{t.term}</span>
                {isSeen && <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white"><Check size={13} /></span>}
              </div>
              {isOpen ? (
                <div className="mt-3 space-y-2 text-[13.5px] leading-relaxed">
                  <p className="text-[var(--body)]">{t.simple}</p>
                  <p className="flex items-start gap-1.5 rounded-xl p-2.5 font-bold" style={{ background: "color-mix(in srgb, var(--acc) 8%, transparent)", color: "var(--deep)" }}>
                    <MessageSquareQuote size={14} className="mt-0.5 shrink-0" style={{ color: "var(--acc)" }} /> {t.say}
                  </p>
                </div>
              ) : (
                <span className="mt-2 text-[11px] font-bold text-[var(--faint)]">اضغط للشرح {isSeen ? "" : `· +${fmt(XP.term)} نقاط`}</span>
              )}
            </button>
          );
        })}
      </div>
      <NextBar done={done} label="انتقل لبطاقات المزايا" hint="افتح كل المصطلحات عشان تكمل المحطة" onNext={onNext} />
    </div>
  );
}

/* ──────────────────────────── ٢. بطاقات المزايا ──────────────────────────── */

type CardItem = { f: Feature; ti: number; id: string };

function Flashcards({ product: P, cards, known, onKnow, onForget, onNext, done }: {
  product: StaffProduct; cards: CardItem[]; known: string[]; onKnow: (id: string) => void; onForget: (id: string) => void; onNext: () => void; done: boolean;
}) {
  const [deckTier, setDeckTier] = useState<number | "star" | "all">("all");
  const [onlyNew, setOnlyNew] = useState(true);
  const deckOf = (t: typeof deckTier) => cards.filter((c) => (t === "all" ? true : t === "star" ? c.f.star : c.ti === t));
  const deck = deckOf(deckTier);
  const [flip, setFlip] = useState(false);
  const queueOf = (t: typeof deckTier, fresh: boolean) => deckOf(t).filter((c) => !fresh || !known.includes(c.id)).map((c) => c.id);
  const [queue, setQueue] = useState<string[]>(() => queueOf("all", true));
  const pickDeck = (t: typeof deckTier) => { setDeckTier(t); setQueue(queueOf(t, onlyNew)); setFlip(false); };
  const pickNew = (fresh: boolean) => { setOnlyNew(fresh); setQueue(queueOf(deckTier, fresh)); setFlip(false); };
  const cur = cards.find((c) => c.id === queue[0]);
  const knownInDeck = deck.filter((c) => known.includes(c.id)).length;

  const answer = (ok: boolean) => {
    if (!cur) return;
    if (ok) { onKnow(cur.id); setQueue((q) => q.slice(1)); }
    else { onForget(cur.id); setQueue((q) => [...q.slice(1), q[0]]); }
    setFlip(false);
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === " ") { e.preventDefault(); setFlip((f) => !f); }
      if (flip && e.key === "ArrowLeft") answer(true);
      if (flip && e.key === "ArrowRight") answer(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div>
      <StationHead n={2} title="بطاقات تقلبها — وتحفظ" lead="الوجه الأول: اسم الميزة. فكّر: وش يكسب العميل منها؟ بعدين اقلب البطاقة وقارن جوابك. «عرفتها» تطلّعها من الكومة، و«راجعها» ترجّعها لآخر الكومة." />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <Pill on={deckTier === "all"} onClick={() => pickDeck("all")}>كل المزايا</Pill>
        <Pill on={deckTier === "star"} onClick={() => pickDeck("star")}>⭐ النجمية</Pill>
        {P.tiers.map((t, i) => <Pill key={t.name} on={deckTier === i} onClick={() => pickDeck(i)}>{t.name}</Pill>)}
        <label className="mr-auto flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[var(--muted)]">
          <input type="checkbox" checked={onlyNew} onChange={(e) => pickNew(e.target.checked)} /> اللي ما عرفتها بس
        </label>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div className="h-full rounded-full transition-all" style={{ width: `${deck.length ? (knownInDeck / deck.length) * 100 : 0}%`, background: "linear-gradient(90deg, var(--acc), #16A34A)" }} />
        </div>
        <span className="text-xs font-black text-[var(--muted)]">{fmt(knownInDeck)}/{fmt(deck.length)}</span>
      </div>

      {cur ? (
        <div className="mx-auto max-w-xl">
          <div className="relative h-[400px] [perspective:1400px]">
            {/* بطاقات خلفية للإحساس بالكومة */}
            {queue.length > 2 && <div className="absolute inset-x-6 top-4 h-full rounded-[28px] bg-[var(--surface)] opacity-50 shadow" />}
            {queue.length > 1 && <div className="absolute inset-x-3 top-2 h-full rounded-[28px] bg-[var(--surface)] opacity-80 shadow" />}
            <button onClick={() => setFlip((f) => !f)} className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
              style={{ transform: flip ? "rotateY(180deg)" : "none" }}>
              {/* الوجه */}
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[28px] p-8 text-center text-white [backface-visibility:hidden]"
                style={{ background: cur.f.star ? `linear-gradient(145deg, ${P.deep}, ${P.accent} 70%, ${GOLD})` : `linear-gradient(145deg, #0E1030, ${P.deep}, ${P.accent})`, boxShadow: `0 40px 80px -40px ${P.accent}` }}>
                <span className="absolute right-5 top-5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">باقة {P.tiers[cur.ti].name}</span>
                {cur.f.star && <span className="absolute left-5 top-5 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black text-[#1a1306]" style={{ background: GOLD }}><Star size={11} fill="currentColor" /> نجمية</span>}
                <span className="grid h-20 w-20 place-items-center rounded-3xl bg-white/15"><cur.f.icon size={38} /></span>
                <div className="mt-5 text-3xl font-black leading-snug">{cur.f.title}</div>
                <div className="mt-4 flex items-center gap-1.5 rounded-full bg-black/20 px-4 py-2 text-sm font-bold"><Lightbulb size={15} style={{ color: GOLD }} /> وش يكسب العميل منها؟ فكّر… ثم اقلب</div>
              </div>
              {/* الظهر */}
              <div className="absolute inset-0 flex flex-col rounded-[28px] border-2 bg-[var(--surface)] p-6 text-right [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-7"
                style={{ borderColor: "var(--acc)" }}>
                <div className="flex items-center gap-2">
                  <cur.f.icon size={20} style={{ color: "var(--acc)" }} />
                  <span className="text-lg font-black text-[var(--ink)]">{cur.f.title}</span>
                </div>
                <div className="mt-4 text-xs font-black text-[var(--faint)]">وش هي</div>
                <p className="text-[14px] leading-relaxed text-[var(--body)]">{cur.f.what}</p>
                <div className="mt-3 text-xs font-black text-emerald-600">وش يكسب</div>
                <p className="text-[15px] font-bold leading-relaxed text-[var(--ink)]">{cur.f.why}</p>
                <p className="mt-auto flex items-start gap-2 rounded-2xl p-3 text-[13.5px] font-bold leading-relaxed" style={{ background: "color-mix(in srgb, var(--acc) 8%, transparent)", color: "var(--deep)" }}>
                  <MessageSquareQuote size={15} className="mt-0.5 shrink-0" style={{ color: "var(--acc)" }} /> {cur.f.say}
                </p>
              </div>
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={() => (flip ? answer(false) : setFlip(true))} className="flex items-center justify-center gap-2 rounded-2xl border-2 border-[var(--line-strong)] bg-[var(--surface)] py-3.5 font-black text-[var(--body)]">
              <RotateCcw size={17} /> {flip ? "راجعها" : "اقلب البطاقة"}
            </button>
            <button onClick={() => (flip ? answer(true) : setFlip(true))} disabled={!flip}
              className="flex items-center justify-center gap-2 rounded-2xl py-3.5 font-black text-white disabled:opacity-40" style={{ background: "#16A34A" }}>
              <Check size={18} /> عرفتها +{fmt(XP.card)}
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-[var(--faint)]">مسافة = اقلب · ← عرفتها · → راجعها · باقي {fmt(queue.length)} بطاقة</p>
        </div>
      ) : (
        <div className="ms-card mx-auto max-w-xl p-10 text-center">
          <Trophy size={44} className="mx-auto" style={{ color: GOLD }} />
          <div className="mt-3 text-2xl font-black text-[var(--ink)]">خلّصت الكومة! 🎉</div>
          <p className="mt-1 text-sm text-[var(--muted)]">غيّر الكومة فوق، أو شيل «اللي ما عرفتها بس» عشان تراجع الكل.</p>
        </div>
      )}
      <NextBar done={done} label="انتقل لتحدّي العميل" hint="اعرف ٨٠٪ من البطاقات عشان تكمل المحطة" onNext={onNext} />
    </div>
  );
}

/* ──────────────────────────── ٣. تحدّي العميل ──────────────────────────── */

type Q = { kind: string; emoji: string; prompt: string; ask: string; options: string[]; answer: string; why: string };

function buildQuiz(P: StaffProduct): Q[] {
  const tierNames = P.tiers.map((t) => t.name);
  const feats = P.tiers.flatMap((t, ti) => t.groups.flatMap((g) => g.features.map((f) => ({ f, ti }))));
  const objs = P.tiers.flatMap((t) => t.objections);
  const pool: Q[] = [];
  const opts = (answer: string, others: string[], n = 3) => shuffle([answer, ...shuffle(others.filter((o) => o !== answer)).slice(0, n)]);

  P.tiers.forEach((t) => {
    t.upgrade?.signals.forEach((s) => pool.push({
      kind: "مين الباقة؟", emoji: "🗣️", prompt: `«${s.replace(/^يقول:\s*/, "").replace(/^«|»$/g, "")}»`, ask: "العميل عنده هالموقف… وش الباقة اللي ترشّحها؟",
      options: tierNames, answer: t.upgrade!.to, why: `هذي إشارة واضحة إن العميل تجاوز «${t.name}» ويحتاج «${t.upgrade!.to}».`,
    }));
    t.forWho.forEach((w) => pool.push({
      kind: "مين الباقة؟", emoji: "🧑‍🍳", prompt: w, ask: "عميل بهالوصف… أنسب باقة له؟", options: tierNames, answer: t.name, why: `«${t.name}»: ${t.tagline}.`,
    }));
    pool.push({ kind: "سؤال الاحتياج", emoji: "❓", prompt: `«${t.question}»`, ask: "لو العميل جاوب «إيه» على هالسؤال… وش الباقة؟", options: tierNames, answer: t.name, why: `هذا سؤال الاحتياج اللي يفتح باقة «${t.name}».` });
    pool.push({ kind: "الأسعار", emoji: "💰", prompt: `باقة «${t.name}»`, ask: "كم سعرها بالسنة؟", options: shuffle(P.tiers.map((x) => `${fmt(x.price)} ريال`)), answer: `${fmt(t.price)} ريال`, why: `${fmt(t.price)} ${t.period} ≈ ${fmt(t.price / 12)} ريال بالشهر.` });
  });
  feats.forEach(({ f, ti }) => {
    pool.push({ kind: "مين الميزة؟", emoji: "🧩", prompt: `«${f.why}»`, ask: "أي ميزة تحقق هالشي للعميل؟", options: opts(f.title, feats.map((x) => x.f.title)), answer: f.title, why: f.say });
    if (ti > 0 || P.tiers.length > 1) pool.push({ kind: "وين الميزة؟", emoji: "📦", prompt: `ميزة «${f.title}»`, ask: "من أي باقة تبدأ؟", options: tierNames, answer: P.tiers[ti].name, why: `تبدأ من «${P.tiers[ti].name}»${ti < P.tiers.length - 1 && P.tiers[ti + 1].inherits ? " وتنتقل للباقات اللي فوقها" : ""}.` });
  });
  objs.forEach((o) => pool.push({ kind: "رد الاعتراض", emoji: "🛡️", prompt: `«${o.q}»`, ask: "العميل اعترض… وش أقوى رد؟", options: opts(o.a, objs.map((x) => x.a), 2), answer: o.a, why: "الرد القوي يرجّع الكلام لمصلحة العميل بأرقام أو مثال." }));

  // توزيع متنوّع: نخلط ونحاول ما نكرر نفس النوع ورا بعض
  const byKind = new Map<string, Q[]>();
  shuffle(pool).forEach((q) => byKind.set(q.kind, [...(byKind.get(q.kind) ?? []), q]));
  const out: Q[] = [];
  while (out.length < 10 && [...byKind.values()].some((a) => a.length)) {
    for (const a of shuffle([...byKind.values()])) { const q = a.shift(); if (q && out.length < 10) out.push(q); }
  }
  return out;
}

function Quiz({ product: P, onCorrect, onFinish, onNext }: { product: StaffProduct; onCorrect: () => void; onFinish: (s: number) => void; onNext: () => void }) {
  const [qs, setQs] = useState<Q[]>(() => buildQuiz(P));
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [wrong, setWrong] = useState<Q[]>([]);
  const [started, setStarted] = useState(false);
  const finished = i >= qs.length;
  const q = qs[i];

  const choose = (o: string) => {
    if (pick) return;
    setPick(o);
    if (o === q.answer) { setScore((s) => s + 1); setStreak((s) => s + 1); onCorrect(); }
    else { setStreak(0); setWrong((w) => [...w, q]); }
  };
  const next = () => {
    const n = i + 1;
    setI(n); setPick(null);
    if (n >= qs.length) onFinish(score);
  };
  const restart = () => { setQs(buildQuiz(P)); setI(0); setPick(null); setScore(0); setStreak(0); setWrong([]); setStarted(true); };

  if (!started) {
    return (
      <div>
        <StationHead n={3} title="تحدّي «العميل قال…»" lead="١٠ مواقف سريعة من الواقع: عميل يقول شي، وأنت تختار الباقة أو الميزة أو الرد الصح. كل جواب صح = ٢٠ نقطة، والنجاح من ٨." />
        <div className="ms-card mx-auto max-w-xl overflow-hidden text-center">
          <div className="p-8" style={{ background: `linear-gradient(145deg, #0E1030, ${P.deep}, ${P.accent})` }}>
            <div className="text-6xl">🎯</div>
            <div className="mt-3 text-2xl font-black text-white">جاهز تقابل العميل؟</div>
            <div className="mt-1 text-sm text-white/70">كل جولة أسئلة جديدة ومخلوطة</div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[var(--line)] border-b border-[var(--line)] text-center text-xs">
            {[["🗣️", "مين الباقة؟"], ["🧩", "مين الميزة؟"], ["🛡️", "رد الاعتراض"]].map(([e, l]) => <div key={l} className="p-3 font-bold text-[var(--muted)]"><div className="text-xl">{e}</div>{l}</div>)}
          </div>
          <button onClick={() => setStarted(true)} className="m-6 inline-flex items-center gap-2 rounded-full px-8 py-3.5 font-black text-white" style={{ background: "var(--acc)" }}>
            ابدأ التحدي <ChevronLeft size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const pass = score >= PASS;
    return (
      <div>
        <StationHead n={3} title="نتيجتك" lead="" />
        <div className="ms-card mx-auto max-w-xl p-8 text-center">
          <div className="text-6xl">{score === 10 ? "🏆" : pass ? "🎉" : "💪"}</div>
          <div className="mt-3 text-5xl font-black" style={{ color: pass ? "#16A34A" : "var(--acc)" }}>{fmt(score)}<span className="text-2xl text-[var(--faint)]">/١٠</span></div>
          <div className="mt-2 flex justify-center gap-1">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={22} fill={k < Math.round(score / 2) ? GOLD : "transparent"} stroke={GOLD} />)}</div>
          <p className="mt-3 font-bold text-[var(--ink)]">{score === 10 ? "مثالي! أنت جاهز تقفل أي صفقة." : pass ? "ممتاز — عديت المحطة!" : `قريب! تحتاج ${fmt(PASS)} عشان تعدّي. راجع الأخطاء تحت وجرّب مرة ثانية.`}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button onClick={restart} className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--line-strong)] px-6 py-3 font-black text-[var(--body)]"><Shuffle size={16} /> جولة جديدة</button>
            {pass && <button onClick={onNext} className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-black text-[#1a1306]" style={{ background: GOLD }}><Award size={16} /> شهادتك</button>}
          </div>
        </div>
        {wrong.length > 0 && (
          <div className="mx-auto mt-8 max-w-xl space-y-3">
            <div className="text-sm font-black text-[var(--ink)]">راجع اللي فاتك:</div>
            {wrong.map((w, k) => (
              <div key={k} className="ms-card p-4 text-sm">
                <div className="text-[var(--muted)]">{w.emoji} {w.prompt}</div>
                <div className="mt-1.5 font-black text-emerald-700">✓ {w.answer}</div>
                <div className="mt-1 text-xs text-[var(--faint)]">{w.why}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const correct = pick === q.answer;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex flex-1 gap-1">
          {qs.map((_, k) => <span key={k} className="h-2 flex-1 rounded-full transition-colors" style={{ background: k < i ? "var(--acc)" : k === i ? GOLD : "var(--line)" }} />)}
        </div>
        <span className="text-xs font-black text-[var(--muted)]">{fmt(i + 1)}/{fmt(qs.length)}</span>
        {streak >= 2 && <span className="flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-black text-orange-600"><Flame size={13} /> {fmt(streak)}</span>}
      </div>

      <div className="ms-card overflow-hidden">
        <div className="p-6 sm:p-8" style={{ background: "color-mix(in srgb, var(--acc) 7%, var(--surface))" }}>
          <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-[11px] font-black" style={{ color: "var(--acc)" }}>{q.emoji} {q.kind}</span>
          {/* فقاعة العميل */}
          <div className="mt-4 flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-xl shadow">{P.key === "menu" ? "🧔" : "👩"}</span>
            <div className="relative rounded-2xl rounded-tr-sm bg-[var(--surface)] px-4 py-3 text-lg font-black leading-snug text-[var(--ink)] shadow-sm">{q.prompt}</div>
          </div>
          <div className="mt-4 text-sm font-bold text-[var(--muted)]">{q.ask}</div>
        </div>
        <div className="grid gap-2.5 p-5 sm:p-6">
          {q.options.map((o) => {
            const isAns = o === q.answer;
            const isPick = o === pick;
            const style: React.CSSProperties = !pick ? {} : isAns ? { background: "#16A34A14", borderColor: "#16A34A", color: "#15803D" } : isPick ? { background: "#E11D4812", borderColor: "#E11D48", color: "#BE123C" } : { opacity: 0.45 };
            return (
              <button key={o} onClick={() => choose(o)} disabled={!!pick}
                className="flex items-center gap-3 rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] px-4 py-3.5 text-right text-[14.5px] font-bold text-[var(--ink)] transition-all hover:border-[var(--acc)] disabled:hover:border-[var(--line)]"
                style={style}>
                <span className="flex-1 leading-relaxed">{o}</span>
                {pick && isAns && <Check size={18} />}
                {pick && isPick && !isAns && <X size={18} />}
              </button>
            );
          })}
        </div>
        {pick && (
          <div className="border-t border-[var(--line)] p-5 sm:p-6" style={{ background: correct ? "#16A34A0d" : "#E11D480a" }}>
            <div className="text-base font-black" style={{ color: correct ? "#15803D" : "#BE123C" }}>{correct ? `صح! +${fmt(XP.correct)} نقطة` : "قريبة… الجواب الصح باللون الأخضر"}</div>
            <p className="mt-1 flex items-start gap-1.5 text-sm leading-relaxed text-[var(--body)]"><Lightbulb size={15} className="mt-0.5 shrink-0" style={{ color: "#D97706" }} /> {q.why}</p>
            <button onClick={next} className="mt-4 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-black text-white" style={{ background: "var(--ink)" }}>
              {i + 1 < qs.length ? "التالي" : "شوف النتيجة"} <ChevronLeft size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────── ٤. الشهادة ──────────────────────────── */

function Certificate({ product: P, prog, allDone, level, stations, onGo, setName, onGuide, onReset }: {
  product: StaffProduct; prog: Progress; allDone: boolean; level: (typeof LEVELS)[number];
  stations: { id: Station; title: string; ok: boolean; n: number }[]; onGo: (s: Station) => void; setName: (s: string) => void; onGuide: () => void; onReset: () => void;
}) {
  if (!allDone) {
    return (
      <div>
        <StationHead n={4} title="شهادة الجاهزية" lead="الشهادة تنفتح لما تخلّص المحطات الثلاث. باقي لك:" />
        <div className="mx-auto grid max-w-xl gap-3">
          {stations.filter((s) => s.id !== "cert").map((s) => (
            <button key={s.id} onClick={() => onGo(s.id)} className="ms-card flex items-center gap-3 p-4 text-right">
              <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-black" style={s.ok ? { background: "#16A34A", color: "#fff" } : { background: "var(--surface-2)", color: "var(--muted)" }}>{s.ok ? <Check size={16} /> : fmt(s.n)}</span>
              <span className="flex-1 font-black text-[var(--ink)]">{s.title}</span>
              {!s.ok && <ChevronLeft size={18} className="text-[var(--faint)]" />}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const date = new Date().toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
  return (
    <div>
      <StationHead n={4} title="مبروك! أنت جاهز للاجتماع 🎉" lead="اكتب اسمك، وصوّر الشهادة أو اطبعها." />
      <div className="mx-auto max-w-3xl">
        <div className="relative overflow-hidden rounded-[32px] p-2" style={{ background: `linear-gradient(135deg, ${GOLD}, #FFE680, ${GOLD})` }}>
          <div className="relative overflow-hidden rounded-[26px] bg-[#FFFDF6] px-6 py-10 text-center sm:px-12">
            <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full" style={{ background: `${P.accent}14` }} />
            <div className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full" style={{ background: `${GOLD}30` }} />
            <Award size={48} className="relative mx-auto" style={{ color: P.accent }} />
            <div className="relative mt-3 text-xs font-black tracking-wide" style={{ color: P.accent }}>شهادة جاهزية · {P.brand}</div>
            <div className="relative mt-4 text-sm text-[#6b6458]">نشهد أن</div>
            <input value={prog.name} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك هنا"
              className="relative mx-auto mt-1 block w-full max-w-md border-b-2 border-dashed bg-transparent text-center text-4xl font-black text-[#1d1b16] outline-none placeholder:text-[#c9c1ae]"
              style={{ borderColor: `${P.accent}55` }} />
            <p className="relative mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#3b362c]">
              أتمّ مسار أكاديمية <b>{P.brand}</b>: فهم المصطلحات، وحفظ مزايا الباقات {P.tiers.map((t) => `«${t.name}»`).join(" و")}، واجتاز تحدّي العميل بنتيجة <b>{fmt(prog.best)}/١٠</b> — وهو جاهز يعرضها على العميل بثقة.
            </p>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-6 text-sm">
              <span className="flex items-center gap-1.5 font-black text-[#1d1b16]">{level.emoji} {level.name}</span>
              <span className="font-black" style={{ color: P.accent }}>{fmt(prog.xp)} نقطة</span>
              <span className="text-[#6b6458]">{date}</span>
            </div>
          </div>
        </div>
        <div className="ms-noprint mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => window.print()} className="rounded-full border-2 border-[var(--line-strong)] px-6 py-3 font-black text-[var(--body)]">اطبع الشهادة</button>
          <button onClick={onGuide} className="rounded-full px-6 py-3 font-black text-white" style={{ background: "var(--acc)" }}>افتح الدليل للاجتماع</button>
          <button onClick={onReset} className="rounded-full px-4 py-3 text-xs font-bold text-[var(--faint)] hover:text-[var(--ink)]"><RotateCcw size={13} className="inline" /> ابدأ من جديد</button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── أدوات ──────────────────────────── */

function StationHead({ n, title, lead }: { n: number; title: string; lead: string }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-black" style={{ color: "var(--acc)" }}>المحطة {fmt(n)} من ٤</div>
      <h2 className="mt-1 text-3xl font-black text-[var(--ink)] sm:text-4xl">{title}</h2>
      {lead && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">{lead}</p>}
    </div>
  );
}

function NextBar({ done, label, hint, onNext }: { done: boolean; label: string; hint: string; onNext: () => void }) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-dashed border-[var(--line-strong)] p-4">
      <span className="flex items-center gap-2 text-sm font-bold" style={{ color: done ? "#15803D" : "var(--muted)" }}>
        {done ? <><Check size={16} /> خلّصت المحطة!</> : hint}
      </span>
      <button onClick={onNext} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black"
        style={done ? { background: GOLD, color: "#1a1306" } : { background: "var(--surface-2)", color: "var(--body)" }}>
        {label} <ChevronLeft size={16} />
      </button>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-full border px-3.5 py-1.5 text-xs font-black transition-colors"
      style={on ? { background: "var(--acc)", borderColor: "var(--acc)", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--muted)" }}>
      {children}
    </button>
  );
}
