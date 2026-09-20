"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldQuestion,
  Send,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  EyeOff,
  Lock,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_FLOW,
  type ChallengeCategory,
  type ChallengeSeverity,
  type ChallengeStatus,
} from "@/lib/challenges";
function fmtDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" }).format(new Date(s));
  } catch {
    return "—";
  }
}

type MyChallenge = {
  id: string;
  challenge_number: number;
  category: ChallengeCategory;
  title: string;
  severity: ChallengeSeverity;
  status: ChallengeStatus;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

const CATEGORY_ENTRIES = Object.entries(CATEGORY_LABELS) as [ChallengeCategory, string][];
const SEVERITY_ENTRIES = Object.entries(SEVERITY_LABELS) as [ChallengeSeverity, string][];

export default function MyChallengesPage() {
  const [items, setItems] = useState<MyChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [category, setCategory] = useState<ChallengeCategory>("communication");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [againstParty, setAgainstParty] = useState("");
  const [severity, setSeverity] = useState<ChallengeSeverity>("medium");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/challenges/mine");
      const data = await res.json();
      setItems(data.challenges ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setCategory("communication");
    setTitle("");
    setDescription("");
    setAgainstParty("");
    setSeverity("medium");
    setIsAnonymous(false);
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          description: description.trim(),
          against_party: againstParty.trim() || null,
          severity,
          is_anonymous: isAnonymous,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "فشل الإرسال");
      }
      resetForm();
      setShowForm(false);
      setToast("تم رفع تحديك بنجاح ✅ — سيطّلع عليه المدير ويعمل على معالجته.");
      load();
      setTimeout(() => setToast(null), 5000);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "حدث خطأ");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20 shrink-0">
            <ShieldQuestion className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">معالجة التحديات</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ارفع أي تحدٍّ يواجهك — تواصل، خطأ من زميل، أو تأخر الدعم الإداري. يصل للمدير مباشرةً.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-[12px] bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/20 px-4 py-2.5 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          رفع تحدٍّ جديد
        </button>
      </div>

      {/* Privacy note */}
      <div className="flex items-center gap-2 rounded-[12px] bg-white/[0.03] border border-border px-4 py-3 text-xs text-muted-foreground">
        <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
        خصوصية تامة: المدير وحده يطّلع على التفاصيل والحلول. هنا تتابع «حالة» تحدياتك فقط.
      </div>

      {toast && (
        <div className="rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">
          {toast}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-[14px] glass-surface border border-border p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">نوع التحدي</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ChallengeCategory)}
                className="w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              >
                {CATEGORY_ENTRIES.map(([k, v]) => (
                  <option key={k} value={k} className="bg-card">{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">درجة التأثير عليك</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as ChallengeSeverity)}
                className="w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              >
                {SEVERITY_ENTRIES.map(([k, v]) => (
                  <option key={k} value={k} className="bg-card">{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">عنوان مختصر</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تأخر ردّ الدعم الإداري على طلبات العملاء"
              className="w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">تفاصيل التحدي</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="اشرح ما حدث، متى، وكيف أثّر على عملك..."
              className="w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40 resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">
              الطرف/القسم المعني <span className="font-normal">(اختياري)</span>
            </label>
            <input
              value={againstParty}
              onChange={(e) => setAgainstParty(e.target.value)}
              placeholder="مثال: قسم الدعم الإداري"
              className="w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer rounded-[10px] bg-white/[0.02] border border-border px-3 py-3">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-4 h-4 accent-violet-500"
            />
            <EyeOff className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">رفع بدون اسم — لن يظهر اسمك للمدير</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => { setShowForm(false); resetForm(); }}
              className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={submit}
              disabled={submitting || !title.trim() || !description.trim()}
              className="flex items-center gap-2 rounded-[10px] bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-violet-200 border border-violet-500/30 px-5 py-2.5 text-sm font-bold transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال للمدير
            </button>
          </div>
        </div>
      )}

      {/* My challenges list */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground px-1">تحدياتي</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            لا توجد تحديات بعد. ابدأ برفع تحدٍّ من الأعلى.
          </div>
        ) : (
          items.map((c) => <MyChallengeCard key={c.id} c={c} />)
        )}
      </div>
    </div>
  );
}

function MyChallengeCard({ c }: { c: MyChallenge }) {
  const isResolved = c.status === "resolved" || c.status === "closed";
  const currentIdx = STATUS_FLOW.indexOf(c.status);

  return (
    <div className="rounded-[14px] glass-surface border border-border p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{c.challenge_number}</span>
            <span className="cc-badge bg-white/[0.06] text-muted-foreground">{CATEGORY_LABELS[c.category]}</span>
            {c.is_anonymous && (
              <span className="cc-badge bg-white/[0.06] text-muted-foreground flex items-center gap-1">
                <EyeOff className="w-3 h-3" /> بدون اسم
              </span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-bold text-foreground">{c.title}</h3>
        </div>
        <span className={`cc-badge ring-1 ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
      </div>

      {/* Status progress */}
      <div className="mt-4 flex items-center gap-1.5">
        {STATUS_FLOW.map((s, i) => {
          const done = isResolved || i <= currentIdx;
          return (
            <div key={s} className="flex-1 flex items-center gap-1.5">
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  done ? "bg-violet-400" : "bg-white/[0.08]"
                }`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> رُفع في {fmtDate(c.created_at)}
        </span>
        {isResolved && c.resolved_at && (
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> عولج في {fmtDate(c.resolved_at)}
          </span>
        )}
      </div>
    </div>
  );
}
