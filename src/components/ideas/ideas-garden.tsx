"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sprout, Loader2, Sparkles, Trash2, X, Plus, RotateCcw, Droplets, Check, ChevronDown } from "lucide-react";
import {
  IDEA_STAGES, STAGE_META, ideaWarmth, warmthLabel,
  type Idea, type IdeaStage, type PlanStep,
} from "@/lib/ideas";

const inputCls = "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/40";
/** فكرة ما رجعت لها من كم يوم تطلع لك في «تذكّر». */
const REMIND_AFTER_DAYS = 3;

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 30) return `قبل ${days} يوم`;
  return `قبل ${Math.floor(days / 30)} شهر`;
}

export function IdeasGarden() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState("");
  const [planting, setPlanting] = useState(false);
  const [justPlanted, setJustPlanted] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showWilted, setShowWilted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean; undoId?: string } | null>(null);
  const [remindId, setRemindId] = useState<string | null>(null);
  const skipped = useRef(new Set<string>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ideas");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIdeas(data.ideas ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string, ok = true, undoId?: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok, undoId });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  const replace = (idea: Idea) => setIdeas((prev) => prev.map((x) => (x.id === idea.id ? idea : x)));

  async function patch(id: string, body: Record<string, unknown>): Promise<Idea | null> {
    try {
      const res = await fetch(`/api/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      replace(data.idea);
      return data.idea;
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر الحفظ", false);
      return null;
    }
  }

  async function plant() {
    const text = draft.trim();
    if (!text || planting) return;
    setPlanting(true);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      setIdeas((prev) => [data.idea, ...prev]);
      setDraft("");
      setJustPlanted(data.idea.id);
      setTimeout(() => setJustPlanted(null), 1800);
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر الحفظ", false);
    } finally {
      setPlanting(false);
    }
  }

  async function wilt(idea: Idea) {
    if (openId === idea.id) setOpenId(null);
    const ok = await patch(idea.id, { wilted: true });
    if (ok) flash(`🍂 ذبلت «${idea.text.slice(0, 40)}»`, true, idea.id);
  }

  async function revive(id: string) {
    const ok = await patch(id, { wilted: false, touch: true });
    if (ok) flash("🌱 رجعت الفكرة للحياة");
  }

  async function removeForever(idea: Idea) {
    if (!confirm(`حذف «${idea.text.slice(0, 60)}» نهائياً؟ ما تقدر ترجعها بعدها.`)) return;
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setIdeas((prev) => prev.filter((x) => x.id !== idea.id));
    } catch {
      flash("تعذّر الحذف", false);
    }
  }

  const alive = useMemo(() => ideas.filter((i) => !i.wilted_at), [ideas]);
  const wilted = useMemo(() => ideas.filter((i) => i.wilted_at), [ideas]);
  const byStage = useMemo(() => {
    const now = Date.now();
    const m = Object.fromEntries(IDEA_STAGES.map((s) => [s, [] as Idea[]])) as Record<IdeaStage, Idea[]>;
    for (const i of alive) m[i.stage].push(i);
    for (const s of IDEA_STAGES) {
      // الثمار بالأحدث، والباقي بالأحر أولاً
      m[s].sort((a, b) => (s === "fruit" ? b.last_touched_at.localeCompare(a.last_touched_at) : ideaWarmth(b, now) - ideaWarmth(a, now)));
    }
    return m;
  }, [alive]);

  // «تذكّر»: فكرة منسية عشوائية تسألك عنها
  const pickReminder = useCallback((list: Idea[]) => {
    const cutoff = Date.now() - REMIND_AFTER_DAYS * 86_400_000;
    const candidates = list.filter((i) => !i.wilted_at && i.stage !== "fruit"
      && new Date(i.last_touched_at).getTime() < cutoff && !skipped.current.has(i.id));
    setRemindId(candidates.length ? candidates[Math.floor(Math.random() * candidates.length)].id : null);
  }, []);
  const reminderPicked = useRef(false);
  useEffect(() => {
    if (loading || reminderPicked.current) return;
    reminderPicked.current = true;
    pickReminder(ideas);
  }, [loading, ideas, pickReminder]);
  const reminder = remindId ? ideas.find((i) => i.id === remindId && !i.wilted_at) ?? null : null;

  function nextReminder() {
    if (remindId) skipped.current.add(remindId);
    pickReminder(ideas);
  }

  const open = openId ? ideas.find((i) => i.id === openId) ?? null : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20 shrink-0">
          <Sprout className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-foreground">البذور</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">ارمِ أي فكرة تجيك، وارجع لها وقت ما تبي — تكبر من بذرة إلى شجرة لها خطة، ثم ثمرة. أفكارك خاصة فيك.</p>
        </div>
      </div>

      {/* Quick capture */}
      <div className="rounded-[16px] border border-emerald-500/20 bg-gradient-to-l from-emerald-500/[0.07] to-transparent p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); plant(); }
            }}
            rows={1}
            placeholder="وش في بالك؟ ارمها هنا واضغط Enter 🌰"
            className={`${inputCls} resize-none min-h-[44px] max-h-40 field-sizing-content`}
          />
          <button
            onClick={plant}
            disabled={!draft.trim() || planting}
            className="flex items-center gap-1.5 shrink-0 h-[44px] rounded-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-100 border border-emerald-500/30 px-4 text-sm font-bold"
          >
            {planting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            ازرعها
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-1.5">بدون ترتيب ولا تصنيف — الأهم إنها ما تطير. (Shift+Enter لسطر جديد)</p>
      </div>

      {toast && (
        <div className={`flex items-center justify-between gap-3 rounded-[12px] px-4 py-3 text-sm border ${toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
          <span>{toast.msg}</span>
          {toast.undoId && (
            <button onClick={() => { revive(toast.undoId!); }} className="flex items-center gap-1 text-[12px] font-bold underline underline-offset-4">
              <RotateCcw className="w-3.5 h-3.5" /> تراجع
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : loadError ? (
        <p className="text-sm text-red-400 text-center py-8">تعذّر تحميل البذور</p>
      ) : (
        <>
          {/* تذكّر */}
          {reminder && (
            <div className="rounded-[16px] border border-sky-500/25 bg-sky-500/[0.06] p-4">
              <p className="text-[12px] font-bold text-sky-300 mb-1.5">💭 تذكّر — زرعتها {ageLabel(reminder.created_at)} وما رجعت لها من {ageLabel(reminder.last_touched_at).replace("قبل ", "")}</p>
              <p className="text-[15px] font-bold text-foreground whitespace-pre-line">{STAGE_META[reminder.stage].icon} {reminder.text}</p>
              <p className="text-[12px] text-muted-foreground mt-1">لسه تهمك؟</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={async () => { if (await patch(reminder.id, { touch: true })) { flash("💧 سقيتها — صارت أدفى"); nextReminder(); } }}
                  className="flex items-center gap-1.5 rounded-[10px] bg-sky-500/20 hover:bg-sky-500/30 text-sky-100 border border-sky-500/30 px-3 py-2 text-[13px] font-bold"
                >
                  <Droplets className="w-4 h-4" /> اسقِها
                </button>
                <button onClick={() => setOpenId(reminder.id)} className="rounded-[10px] bg-white/[0.04] border border-white/[0.08] text-foreground px-3 py-2 text-[13px] font-bold">
                  افتحها وطوّرها
                </button>
                <button onClick={() => { wilt(reminder); nextReminder(); }} className="rounded-[10px] bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground px-3 py-2 text-[13px] font-bold">
                  🍂 خلها تذبل
                </button>
                <button onClick={nextReminder} className="rounded-[10px] px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground">
                  مو الحين ←
                </button>
              </div>
            </div>
          )}

          {/* الحديقة */}
          {alive.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              الحديقة فاضية 🌾 — ازرع أول فكرة من فوق.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {IDEA_STAGES.map((s) => (
                <div key={s} className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-2.5 min-h-[120px]">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <p className={`text-[13px] font-extrabold ${STAGE_META[s].tone}`}>{STAGE_META[s].icon} {STAGE_META[s].label}</p>
                    <span className="text-[11px] text-muted-foreground font-mono">{byStage[s].length}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 px-1 -mt-1.5 mb-2">{STAGE_META[s].hint}</p>
                  <div className="space-y-1.5">
                    {byStage[s].map((i) => (
                      <IdeaCard key={i.id} idea={i} fresh={justPlanted === i.id} onOpen={() => setOpenId(i.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* الذابلة */}
          {wilted.length > 0 && (
            <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.015]">
              <button onClick={() => setShowWilted((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-[13px] font-bold text-muted-foreground hover:text-foreground">
                <span>🍂 ذبلت ({wilted.length})</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showWilted ? "rotate-180" : ""}`} />
              </button>
              {showWilted && (
                <div className="px-3 pb-3 space-y-1.5">
                  {wilted.map((i) => (
                    <div key={i.id} className="flex items-center gap-2 rounded-xl px-3 py-2 border border-white/[0.05] bg-white/[0.02]">
                      <p className="flex-1 min-w-0 text-[13px] text-muted-foreground line-through decoration-white/20 truncate">{i.text}</p>
                      <button onClick={() => revive(i.id)} title="أحيِها" className="flex items-center gap-1 text-[12px] font-bold text-emerald-300 hover:text-emerald-200">
                        <RotateCcw className="w-3.5 h-3.5" /> أحيِها
                      </button>
                      <button onClick={() => removeForever(i)} title="حذف نهائي" className="text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {open && (
        <IdeaDetail
          key={open.id}
          idea={open}
          onClose={() => setOpenId(null)}
          onPatch={(body) => patch(open.id, body)}
          onWilt={() => wilt(open)}
          onError={(m) => flash(m, false)}
        />
      )}
    </div>
  );
}

function IdeaCard({ idea, fresh, onOpen }: { idea: Idea; fresh: boolean; onOpen: () => void }) {
  const w = ideaWarmth(idea);
  const wl = warmthLabel(w);
  const done = idea.plan.filter((p) => p.done).length;
  return (
    <button
      onClick={onOpen}
      // الفكرة الباردة تبهت شوي — تشوف بعينك وش اللي شاغل بالك فعلاً
      style={{ opacity: idea.stage === "fruit" ? 1 : 0.55 + (w / 100) * 0.45 }}
      className={`w-full text-right rounded-xl px-3 py-2.5 border transition-all hover:-translate-y-0.5 hover:opacity-100 ${STAGE_META[idea.stage].ring} ${fresh ? "animate-in zoom-in-90 fade-in duration-500 ring-2 ring-emerald-400/50" : ""}`}
    >
      <p className="text-[13px] font-bold text-foreground line-clamp-3 whitespace-pre-line">{idea.text}</p>
      {idea.plan.length > 0 && (
        <div className="mt-2">
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-emerald-400/70 rounded-full" style={{ width: `${(done / idea.plan.length) * 100}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">الخطة: {done} من {idea.plan.length}</p>
        </div>
      )}
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground/80">
        <span>{ageLabel(idea.created_at)}</span>
        {idea.stage !== "fruit" && <span className={wl.tone} title={`حرارة الفكرة ${w}%`}>{wl.icon} {wl.label}</span>}
      </div>
    </button>
  );
}

function IdeaDetail({ idea, onClose, onPatch, onWilt, onError }: {
  idea: Idea;
  onClose: () => void;
  onPatch: (body: Record<string, unknown>) => Promise<Idea | null>;
  onWilt: () => void;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState(idea.text);
  const [notes, setNotes] = useState(idea.notes ?? "");
  const [newStep, setNewStep] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState<PlanStep[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** حفظ الخطة — وأول ما يصير لها خطة تكبر لشجرة. */
  function savePlan(plan: PlanStep[]) {
    const body: Record<string, unknown> = { plan };
    if (plan.length > 0 && (idea.stage === "seed" || idea.stage === "sprout")) body.stage = "tree";
    return onPatch(body);
  }

  function saveText() {
    const t = text.trim();
    if (!t) { setText(idea.text); return; }
    if (t !== idea.text) onPatch({ text: t });
  }
  function saveNotes() {
    const n = notes.trim();
    if (n === (idea.notes ?? "")) return;
    // أول ما تفكر فيها وتكتب عنها تصير برعم
    onPatch(idea.stage === "seed" && n ? { notes: n, stage: "sprout" } : { notes: n });
  }

  async function suggest() {
    setSuggesting(true);
    try {
      const res = await fetch(`/api/ideas/${idea.id}/plan`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر اقتراح خطة");
      setSuggested(data.steps);
    } catch (e) {
      onError(e instanceof Error ? e.message : "تعذّر اقتراح خطة");
    } finally {
      setSuggesting(false);
    }
  }

  const allDone = idea.plan.length > 0 && idea.plan.every((p) => p.done);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-[20px] sm:rounded-[20px] bg-card border border-border p-4 sm:p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-2">
          <p className={`text-[12px] font-bold ${STAGE_META[idea.stage].tone}`}>{STAGE_META[idea.stage].icon} {STAGE_META[idea.stage].label} · زرعتها {ageLabel(idea.created_at)}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={saveText}
          rows={2}
          className="w-full bg-transparent text-[17px] font-extrabold text-foreground resize-none focus:outline-none field-sizing-content"
        />

        {/* المرحلة */}
        <div className="grid grid-cols-4 gap-1.5">
          {IDEA_STAGES.map((s) => (
            <button
              key={s}
              onClick={() => s !== idea.stage && onPatch({ stage: s })}
              className={`rounded-[10px] px-2 py-2 text-[12px] font-bold border transition-colors ${idea.stage === s ? `${STAGE_META[s].ring} ${STAGE_META[s].tone}` : "border-white/[0.06] text-muted-foreground hover:text-foreground"}`}
            >
              {STAGE_META[s].icon} {STAGE_META[s].label}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">ليش تهمني؟ وش في بالي عنها؟</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={3}
            placeholder="اكتب أي شي — السبب، الأثر المتوقع، مين يساعد..."
            className={`${inputCls} resize-y`}
          />
        </div>

        {/* خطة التنفيذ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground">🗺️ خطة التنفيذ</p>
            <button
              onClick={suggest}
              disabled={suggesting}
              className="flex items-center gap-1.5 rounded-[10px] bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 border border-violet-500/25 px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
            >
              {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {idea.plan.length ? "اقترح خطة جديدة" : "حوّلها لخطة"}
            </button>
          </div>

          {suggested && (
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-3 space-y-2">
              <p className="text-[12px] font-bold text-violet-300">✨ خطة مقترحة — عدّلها بعد ما تعتمدها</p>
              <ol className="space-y-1 list-decimal pr-5 text-[13px] text-foreground">
                {suggested.map((s, i) => <li key={i}>{s.text}</li>)}
              </ol>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={async () => { if (await savePlan(suggested)) setSuggested(null); }}
                  className="rounded-[10px] bg-violet-500/25 hover:bg-violet-500/35 text-violet-100 border border-violet-500/30 px-3 py-1.5 text-[12px] font-bold"
                >
                  {idea.plan.length ? "استبدل خطتي" : "اعتمدها"}
                </button>
                {idea.plan.length > 0 && (
                  <button
                    onClick={async () => { if (await savePlan([...idea.plan, ...suggested])) setSuggested(null); }}
                    className="rounded-[10px] bg-white/[0.04] border border-white/[0.08] text-foreground px-3 py-1.5 text-[12px] font-bold"
                  >
                    أضفها لخطتي
                  </button>
                )}
                <button onClick={() => setSuggested(null)} className="rounded-[10px] px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">تجاهل</button>
              </div>
            </div>
          )}

          {idea.plan.length === 0 && !suggested && (
            <p className="text-[12px] text-muted-foreground/70">ما لها خطة بعد — أضف خطوة بنفسك أو خلّ الذكاء الاصطناعي يقترح.</p>
          )}

          <div className="space-y-1">
            {idea.plan.map((step, i) => (
              <div key={i} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                <button
                  onClick={() => savePlan(idea.plan.map((p, j) => (j === i ? { ...p, done: !p.done } : p)))}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${step.done ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-200" : "border-white/20"}`}
                >
                  {step.done && <Check className="w-3.5 h-3.5" />}
                </button>
                <span className={`flex-1 text-[13px] ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>{step.text}</span>
                <button
                  onClick={() => savePlan(idea.plan.filter((_, j) => j !== i))}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
                  title="حذف الخطوة"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const t = newStep.trim();
              if (!t) return;
              if (await savePlan([...idea.plan, { text: t, done: false }])) setNewStep("");
            }}
            className="flex gap-2"
          >
            <input value={newStep} onChange={(e) => setNewStep(e.target.value)} placeholder="+ خطوة جديدة" className={inputCls} />
          </form>

          {allDone && idea.stage !== "fruit" && (
            <button
              onClick={() => onPatch({ stage: "fruit" })}
              className="w-full rounded-[12px] bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/25 px-4 py-2.5 text-sm font-bold"
            >
              🍎 كل الخطوات خلصت — اقطف الثمرة
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
          <button onClick={onWilt} className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground hover:text-red-300">
            🍂 خلها تذبل (حذف)
          </button>
          <span className="text-[11px] text-muted-foreground/70">{warmthLabel(ideaWarmth(idea)).icon} رجعت لها {idea.touches} مرة</span>
        </div>
      </div>
    </div>
  );
}
