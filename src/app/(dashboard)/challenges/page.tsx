"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ShieldAlert,
  Loader2,
  Sparkles,
  Plus,
  X,
  Check,
  Trash2,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  EyeOff,
  User,
  MessageSquareWarning,
  ClipboardCheck,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  evaluateMeasurement,
  VERDICT_LABELS,
  VERDICT_COLORS,
  type ChallengeCategory,
  type ChallengeSeverity,
  type ChallengeStatus,
  type Measurement,
} from "@/lib/challenges";

function fmtDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" }).format(new Date(s));
  } catch { return "—"; }
}
function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(s));
  } catch { return "—"; }
}

type Challenge = {
  id: string;
  challenge_number: number;
  submitter_name: string | null;
  is_anonymous: boolean;
  category: ChallengeCategory;
  against_party: string | null;
  title: string;
  description: string;
  severity: ChallengeSeverity;
  status: ChallengeStatus;
  created_at: string;
  resolved_at: string | null;
};

type Solution = {
  id: string;
  source: "ai" | "manager";
  content: string;
  steps: string[] | null;
  expected_impact: string | null;
  is_applied: boolean;
  applied_at: string | null;
  created_at: string;
};

type ChallengeEvent = {
  id: string;
  event_type: string;
  description: string | null;
  actor_name: string | null;
  created_at: string;
};

type Detail = {
  challenge: Challenge;
  solutions: Solution[];
  measurements: Measurement[];
  events: ChallengeEvent[];
};

const STATUS_ENTRIES = Object.entries(STATUS_LABELS) as [ChallengeStatus, string][];

export default function ChallengesPage() {
  const { activeOrgId } = useAuth();
  const [list, setList] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [fCategory, setFCategory] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fSeverity, setFSeverity] = useState<string>("all");

  const loadList = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/challenges?orgId=${activeOrgId}`);
      const data = await res.json();
      setList(data.challenges ?? []);
    } catch { setList([]); }
    finally { setLoading(false); }
  }, [activeOrgId]);

  useEffect(() => { loadList(); }, [loadList]);

  const filtered = useMemo(() => {
    return list.filter((c) =>
      (fCategory === "all" || c.category === fCategory) &&
      (fStatus === "all" || c.status === fStatus) &&
      (fSeverity === "all" || c.severity === fSeverity)
    );
  }, [list, fCategory, fStatus, fSeverity]);

  const stats = useMemo(() => ({
    total: list.length,
    open: list.filter((c) => !["resolved", "closed"].includes(c.status)).length,
    resolved: list.filter((c) => c.status === "resolved").length,
    high: list.filter((c) => c.severity === "high" && !["resolved", "closed"].includes(c.status)).length,
  }), [list]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-400 ring-1 ring-red-500/20 shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">مركز معالجة التحديات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            التحديات التي يرفعها الموظفون — للمدير فقط. حلّلها، اقترح حلولاً، وقِس نجاحها.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="إجمالي التحديات" value={stats.total} color="text-foreground" />
        <StatCard label="مفتوحة" value={stats.open} color="text-amber-400" />
        <StatCard label="عالية الخطورة" value={stats.high} color="text-red-400" />
        <StatCard label="تم حلها" value={stats.resolved} color="text-emerald-400" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect value={fCategory} onChange={setFCategory} label="التصنيف"
          options={[["all", "كل التصنيفات"], ...Object.entries(CATEGORY_LABELS)]} />
        <FilterSelect value={fStatus} onChange={setFStatus} label="الحالة"
          options={[["all", "كل الحالات"], ...STATUS_ENTRIES]} />
        <FilterSelect value={fSeverity} onChange={setFSeverity} label="الشدة"
          options={[["all", "كل الدرجات"], ...Object.entries(SEVERITY_LABELS)]} />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          لا توجد تحديات مطابقة.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className="text-right rounded-[14px] glass-surface border border-border p-4 hover:border-violet-500/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">#{c.challenge_number}</span>
                  <span className="cc-badge bg-white/[0.06] text-muted-foreground">{CATEGORY_LABELS[c.category]}</span>
                </div>
                <span className={`cc-badge ring-1 ${SEVERITY_COLORS[c.severity]}`}>{SEVERITY_LABELS[c.severity]}</span>
              </div>
              <h3 className="mt-2 text-sm font-bold text-foreground line-clamp-1">{c.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className={`cc-badge ring-1 ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {c.is_anonymous ? <><EyeOff className="w-3 h-3" /> بدون اسم</> : <><User className="w-3 h-3" /> {c.submitter_name || "—"}</>}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <DetailModal id={selectedId} onClose={() => setSelectedId(null)} onChanged={loadList} />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[14px] glass-surface border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function FilterSelect({ value, onChange, label, options }: {
  value: string; onChange: (v: string) => void; label: string; options: [string, string][];
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-[10px] bg-white/[0.04] border border-border px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40">
      {options.map(([k, v]) => <option key={k} value={k} className="bg-card">{v}</option>)}
    </select>
  );
}

/* ─────────────────────────── Detail Modal ─────────────────────────── */

function DetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRootCause, setAiRootCause] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/challenges/${id}`);
      const data = await res.json();
      setDetail(data);
    } catch { setDetail(null); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const patchChallenge = async (patch: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch(`/api/challenges/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      await load(); onChanged();
    } finally { setBusy(false); }
  };

  const generateAI = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/ai/challenge-solutions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: id }),
      });
      const data = await res.json();
      if (res.ok) { setAiRootCause(data.root_cause || null); await load(); onChanged(); }
      else alert(data.error || "تعذّر توليد الحلول");
    } finally { setAiLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm p-3 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-[16px] bg-card border border-border shadow-2xl my-4" onClick={(e) => e.stopPropagation()}>
        {loading || !detail ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div>
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card/95 backdrop-blur px-5 py-4 rounded-t-[16px]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">#{detail.challenge.challenge_number}</span>
                  <span className="cc-badge bg-white/[0.06] text-muted-foreground">{CATEGORY_LABELS[detail.challenge.category]}</span>
                  <span className={`cc-badge ring-1 ${SEVERITY_COLORS[detail.challenge.severity]}`}>{SEVERITY_LABELS[detail.challenge.severity]}</span>
                </div>
                <h2 className="mt-2 text-lg font-extrabold text-foreground">{detail.challenge.title}</h2>
              </div>
              <button onClick={onClose} className="shrink-0 flex items-center justify-center w-9 h-9 rounded-[10px] bg-white/[0.06] hover:bg-white/[0.12] text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Problem */}
              <section>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{detail.challenge.description}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {detail.challenge.is_anonymous ? <><EyeOff className="w-3 h-3" /> مقدّم بدون اسم</> : <><User className="w-3 h-3" /> {detail.challenge.submitter_name || "—"}</>}
                  </span>
                  {detail.challenge.against_party && (
                    <span className="flex items-center gap-1"><MessageSquareWarning className="w-3 h-3" /> الطرف المعني: {detail.challenge.against_party}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDate(detail.challenge.created_at)}</span>
                </div>
              </section>

              {/* Status + severity controls */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">الحالة</label>
                  <select disabled={busy} value={detail.challenge.status}
                    onChange={(e) => patchChallenge({ status: e.target.value })}
                    className="w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40">
                    {STATUS_ENTRIES.map(([k, v]) => <option key={k} value={k} className="bg-card">{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">الشدة</label>
                  <select disabled={busy} value={detail.challenge.severity}
                    onChange={(e) => patchChallenge({ severity: e.target.value })}
                    className="w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40">
                    {(Object.entries(SEVERITY_LABELS) as [ChallengeSeverity, string][]).map(([k, v]) => <option key={k} value={k} className="bg-card">{v}</option>)}
                  </select>
                </div>
              </section>

              {/* Solutions */}
              <SolutionsSection detail={detail} onReload={() => { load(); onChanged(); }}
                aiLoading={aiLoading} onGenerateAI={generateAI} aiRootCause={aiRootCause} />

              {/* Measurements */}
              <MeasurementsSection detail={detail} onReload={() => { load(); onChanged(); }} />

              {/* Timeline */}
              <TimelineSection events={detail.events} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Solutions ─── */
function SolutionsSection({ detail, onReload, aiLoading, onGenerateAI, aiRootCause }: {
  detail: Detail; onReload: () => void; aiLoading: boolean; onGenerateAI: () => void; aiRootCause: string | null;
}) {
  const [newSolution, setNewSolution] = useState("");
  const [adding, setAdding] = useState(false);

  const addManual = async () => {
    if (!newSolution.trim()) return;
    setAdding(true);
    try {
      await fetch(`/api/challenges/${detail.challenge.id}/solutions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newSolution.trim() }),
      });
      setNewSolution(""); onReload();
    } finally { setAdding(false); }
  };

  const toggleApplied = async (s: Solution) => {
    await fetch(`/api/challenges/${detail.challenge.id}/solutions`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ solution_id: s.id, is_applied: !s.is_applied }),
    });
    onReload();
  };

  const remove = async (s: Solution) => {
    if (!confirm("حذف هذا الحل؟")) return;
    await fetch(`/api/challenges/${detail.challenge.id}/solutions?solutionId=${s.id}`, { method: "DELETE" });
    onReload();
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-cyan-400" /> الحلول</h3>
        <button onClick={onGenerateAI} disabled={aiLoading}
          className="flex items-center gap-2 rounded-[10px] bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-50 text-cyan-300 border border-cyan-500/20 px-3 py-1.5 text-xs font-bold transition-colors">
          {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          توليد حلول AI
        </button>
      </div>

      {aiRootCause && (
        <div className="rounded-[12px] bg-cyan-500/[0.06] border border-cyan-500/15 px-4 py-3 text-xs text-cyan-100/90">
          <span className="font-bold text-cyan-300">تحليل السبب الجذري: </span>{aiRootCause}
        </div>
      )}

      {detail.solutions.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد حلول بعد. ولّد حلول AI أو أضف حلاً يدوياً.</p>
      ) : (
        <div className="space-y-2">
          {detail.solutions.map((s) => (
            <div key={s.id} className={`rounded-[12px] border p-3 ${s.is_applied ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-border bg-white/[0.02]"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`cc-badge text-[10px] ${s.source === "ai" ? "bg-cyan-500/15 text-cyan-400" : "bg-violet-500/15 text-violet-400"}`}>
                    {s.source === "ai" ? "اقتراح AI" : "حل المدير"}
                  </span>
                  <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{s.content}</p>
                  {s.steps && s.steps.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {s.steps.map((st, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-cyan-400">•</span> {st}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleApplied(s)} title={s.is_applied ? "تراجع عن التطبيق" : "تعليم كمطبَّق"}
                    className={`flex items-center justify-center w-8 h-8 rounded-[8px] transition-colors ${s.is_applied ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-muted-foreground hover:text-emerald-400"}`}>
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(s)} title="حذف"
                    className="flex items-center justify-center w-8 h-8 rounded-[8px] bg-white/[0.06] text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {s.is_applied && s.applied_at && (
                <p className="mt-2 text-[11px] text-emerald-400">طُبّق في {fmtDate(s.applied_at)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea value={newSolution} onChange={(e) => setNewSolution(e.target.value)} rows={2}
          placeholder="أضف حلاً من عندك..."
          className="flex-1 rounded-[10px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y" />
        <button onClick={addManual} disabled={adding || !newSolution.trim()}
          className="flex items-center gap-1.5 rounded-[10px] bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-40 text-violet-200 border border-violet-500/30 px-3 py-2 text-sm font-bold transition-colors">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>
    </section>
  );
}

/* ─── Measurements ─── */
function MeasurementsSection({ detail, onReload }: { detail: Detail; onReload: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [metricName, setMetricName] = useState("");
  const [unit, setUnit] = useState("");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">("increase");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!metricName.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/challenges/${detail.challenge.id}/measurements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metric_name: metricName.trim(), unit: unit.trim(), baseline_value: baseline, target_value: target, direction }),
      });
      setMetricName(""); setUnit(""); setBaseline(""); setTarget(""); setDirection("increase"); setShowForm(false); onReload();
    } finally { setSaving(false); }
  };

  const updateCurrent = async (m: Measurement, value: string) => {
    await fetch(`/api/challenges/${detail.challenge.id}/measurements`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ measurement_id: m.id, current_value: value, measured_at: new Date().toISOString().slice(0, 10) }),
    });
    onReload();
  };

  const remove = async (m: Measurement) => {
    if (!confirm("حذف هذا المؤشر؟")) return;
    await fetch(`/api/challenges/${detail.challenge.id}/measurements?measurementId=${m.id}`, { method: "DELETE" });
    onReload();
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Target className="w-4 h-4 text-indigo-400" /> قياس النجاح</h3>
        <button onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-[10px] bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 px-3 py-1.5 text-xs font-bold transition-colors">
          <Plus className="w-3.5 h-3.5" /> مؤشر جديد
        </button>
      </div>

      {showForm && (
        <div className="rounded-[12px] border border-border bg-white/[0.02] p-3 space-y-2">
          <input value={metricName} onChange={(e) => setMetricName(e.target.value)} placeholder="اسم المؤشر (مثال: زمن رد الدعم بالساعات)"
            className="w-full rounded-[8px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/40" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input value={baseline} onChange={(e) => setBaseline(e.target.value)} type="number" placeholder="قبل"
              className="rounded-[8px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/40" />
            <input value={target} onChange={(e) => setTarget(e.target.value)} type="number" placeholder="الهدف"
              className="rounded-[8px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/40" />
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="الوحدة"
              className="rounded-[8px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/40" />
            <select value={direction} onChange={(e) => setDirection(e.target.value as "increase" | "decrease")}
              className="rounded-[8px] bg-white/[0.04] border border-border px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/40">
              <option value="increase" className="bg-card">الأفضل ارتفاعه</option>
              <option value="decrease" className="bg-card">الأفضل انخفاضه</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button onClick={create} disabled={saving || !metricName.trim()}
              className="flex items-center gap-1.5 rounded-[8px] bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 text-indigo-200 border border-indigo-500/30 px-4 py-1.5 text-sm font-bold transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} حفظ
            </button>
          </div>
        </div>
      )}

      {detail.measurements.length === 0 ? (
        <p className="text-xs text-muted-foreground">لم تُحدَّد مؤشرات قياس بعد.</p>
      ) : (
        <div className="space-y-2">
          {detail.measurements.map((m) => <MeasurementCard key={m.id} m={m} onUpdate={updateCurrent} onRemove={remove} />)}
        </div>
      )}
    </section>
  );
}

function MeasurementCard({ m, onUpdate, onRemove }: {
  m: Measurement; onUpdate: (m: Measurement, v: string) => void; onRemove: (m: Measurement) => void;
}) {
  const [val, setVal] = useState(m.current_value?.toString() ?? "");
  const { pct, verdict } = evaluateMeasurement(m);
  const pctText = pct === null ? null : `${Math.round(Math.max(0, Math.min(pct, 1.5)) * 100)}%`;

  return (
    <div className="rounded-[12px] border border-border bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
            {m.direction === "increase" ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />}
            {m.metric_name} {m.unit ? <span className="text-muted-foreground font-normal">({m.unit})</span> : null}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span>قبل: <b className="text-foreground">{m.baseline_value ?? "—"}</b></span>
            <span>الهدف: <b className="text-foreground">{m.target_value ?? "—"}</b></span>
            <span>الحالي: <b className="text-foreground">{m.current_value ?? "—"}</b></span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`cc-badge ring-1 ${VERDICT_COLORS[verdict]}`}>{VERDICT_LABELS[verdict]}{pctText ? ` · ${pctText}` : ""}</span>
          <button onClick={() => onRemove(m)} className="flex items-center justify-center w-7 h-7 rounded-[8px] bg-white/[0.06] text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* progress bar */}
      {pct !== null && (
        <div className="mt-3 h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full rounded-full ${verdict === "success" ? "bg-emerald-400" : verdict === "partial" ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${Math.max(4, Math.min(pct, 1) * 100)}%` }} />
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] text-muted-foreground mb-1">تحديث القيمة الحالية (بعد التطبيق)</label>
          <input value={val} onChange={(e) => setVal(e.target.value)} type="number"
            className="w-full rounded-[8px] bg-white/[0.04] border border-border px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/40" />
        </div>
        <button onClick={() => onUpdate(m, val)}
          className="rounded-[8px] bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 px-3 py-1.5 text-sm font-bold transition-colors">
          تسجيل
        </button>
      </div>
    </div>
  );
}

/* ─── Timeline ─── */
function TimelineSection({ events }: { events: ChallengeEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock className="w-4 h-4 text-violet-400" /> التايم لاين</h3>
      <div className="relative pr-4">
        <div className="absolute right-[6px] top-1 bottom-1 w-px bg-border" />
        <div className="space-y-4">
          {events.map((e) => (
            <div key={e.id} className="relative pr-5">
              <span className="absolute right-0 top-1 w-3 h-3 rounded-full bg-violet-500/40 ring-2 ring-card" />
              <p className="text-sm text-foreground">{e.description}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {e.actor_name ? `${e.actor_name} · ` : ""}{fmtDateTime(e.created_at)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
