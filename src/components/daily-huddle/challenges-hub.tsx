"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, Send, Loader2, CheckCircle2, Clock, EyeOff, Lock, ShieldQuestion, UserRound, ArrowLeft, AlertTriangle,
} from "lucide-react";
import {
  CATEGORY_LABELS, SEVERITY_LABELS, STATUS_LABELS, STATUS_COLORS, STATUS_FLOW,
  KIND_LABELS, KIND_PLURAL_LABELS, KIND_COLORS, KINDS,
  type ChallengeCategory, type ChallengeSeverity, type ChallengeStatus, type ChallengeKind,
} from "@/lib/challenges";

type BoardItem = {
  id: string;
  challenge_number: number;
  kind: ChallengeKind;
  client_name: string | null;
  category: ChallengeCategory;
  title: string;
  description: string | null;
  against_party: string | null;
  severity: ChallengeSeverity;
  status: ChallengeStatus;
  is_anonymous: boolean;
  submitter_name: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  mine: boolean;
  can_update: boolean;
};

type Role = "challenge_manager" | "huddle_manager" | "employee";

const CATEGORY_ENTRIES = Object.entries(CATEGORY_LABELS) as [ChallengeCategory, string][];
const SEVERITY_ENTRIES = Object.entries(SEVERITY_LABELS) as [ChallengeSeverity, string][];
const STATUS_ENTRIES = Object.entries(STATUS_LABELS) as [ChallengeStatus, string][];
const DONE: ChallengeStatus[] = ["resolved", "closed"];
const LATE_DAYS = 7;

// نص الحقول حسب النوع
const FORM_TEXT: Record<ChallengeKind, { hint: string; title: string; titlePh: string; desc: string; descPh: string; severity: string; submit: string; ok: string }> = {
  challenge: {
    hint: "تحدٍّ يواجهك في الشغل — تواصل، خطأ من زميل، أو تأخر الدعم الإداري.",
    title: "عنوان مختصر", titlePh: "مثال: تأخر ردّ الدعم الإداري على طلبات العملاء",
    desc: "تفاصيل التحدي", descPh: "اشرح ما حدث، متى، وكيف أثّر على عملك...",
    severity: "درجة التأثير عليك", submit: "إرسال للمدير", ok: "تم رفع تحديك ✅ — سيطّلع عليه المدير ويعمل على معالجته.",
  },
  customer_request: {
    hint: "طلب من عميل يحتاج حل أو قرار — ميزة، استثناء، مشكلة ما لها حل جاهز.",
    title: "وش يطلب العميل؟", titlePh: "مثال: يبغى ربط المنيو مع نظام الكاشير",
    desc: "التفاصيل", descPh: "اشرح الطلب، ليش يحتاجه العميل، وأي موعد التزمنا فيه...",
    severity: "الأولوية", submit: "إرسال الطلب", ok: "تم رفع طلب العميل ✅ — بيتابَع لين ينحل.",
  },
  development: {
    hint: "تطوير أو تعديل على النظام يحتاج متابعة لين ينجز.",
    title: "وش التطوير المطلوب؟", titlePh: "مثال: إضافة تنبيه للتجديدات قبل انتهائها بأسبوع",
    desc: "التفاصيل", descPh: "وش المطلوب بالضبط، وش المشكلة اللي يحلها، ومين يستفيد...",
    severity: "الأولوية", submit: "إرسال طلب التطوير", ok: "تم رفع طلب التطوير ✅ — بيتابَع لين ينجز.",
  },
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" }).format(new Date(s));
  } catch {
    return "—";
  }
}
const daysOpen = (s: string) => Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000));

export function ChallengesHub() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [role, setRole] = useState<Role>("employee");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [kindFilter, setKindFilter] = useState<ChallengeKind | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Form state
  const [kind, setKind] = useState<ChallengeKind>("challenge");
  const [category, setCategory] = useState<ChallengeCategory>("communication");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [againstParty, setAgainstParty] = useState("");
  const [clientName, setClientName] = useState("");
  const [severity, setSeverity] = useState<ChallengeSeverity>("medium");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/challenges/board");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
      setRole(data.role ?? "employee");
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string, ms = 5000) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  function resetForm() {
    setCategory("communication");
    setTitle("");
    setDescription("");
    setAgainstParty("");
    setClientName("");
    setSeverity("medium");
    setIsAnonymous(false);
  }

  const canSubmit = title.trim() && description.trim() && (kind !== "customer_request" || clientName.trim());

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          category,
          title: title.trim(),
          description: description.trim(),
          against_party: kind === "challenge" ? againstParty.trim() || null : null,
          client_name: kind === "customer_request" ? clientName.trim() : null,
          severity,
          is_anonymous: kind === "challenge" && isAnonymous,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "فشل الإرسال");
      }
      resetForm();
      setShowForm(false);
      flash(FORM_TEXT[kind].ok);
      load();
    } catch (err) {
      flash(err instanceof Error ? err.message : "حدث خطأ", 4000);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(item: BoardItem, status: ChallengeStatus) {
    setUpdating(item.id);
    try {
      const res = await fetch("/api/challenges/board", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((x) => x.id === item.id
        ? { ...x, status, resolved_at: status === "resolved" ? new Date().toISOString() : x.resolved_at }
        : x));
    } catch {
      flash("تعذّر تحديث الحالة", 3000);
    } finally {
      setUpdating(null);
    }
  }

  const openCount = useMemo(() => {
    const c: Record<ChallengeKind, number> = { challenge: 0, customer_request: 0, development: 0 };
    for (const i of items) if (!DONE.includes(i.status)) c[i.kind]++;
    return c;
  }, [items]);

  const visible = useMemo(() => items
    .filter((i) => kindFilter === "all" || i.kind === kindFilter)
    .filter((i) => showDone === DONE.includes(i.status))
    .sort((a, b) => showDone
      ? (b.resolved_at || b.updated_at).localeCompare(a.resolved_at || a.updated_at)
      : a.created_at.localeCompare(b.created_at)),
  [items, kindFilter, showDone]);

  const lateCount = items.filter((i) => !DONE.includes(i.status) && daysOpen(i.created_at) > LATE_DAYS).length;
  const t = FORM_TEXT[kind];
  const inputCls = "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20 shrink-0">
            <ShieldQuestion className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-foreground">التحديات والطلبات والتطويرات</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {role === "employee"
                ? "ارفع تحدي أو طلب عميل أو تطوير، وتابع حالته لين ينجز."
                : "كل اللي يحتاج حل أو متابعة لين ينجز — الأقدم أولاً."}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-[12px] bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/20 px-4 py-2.5 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" /> إضافة جديد
        </button>
      </div>

      {toast && (
        <div className="rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-300">{toast}</div>
      )}

      {/* Form */}
      {showForm && (
        <div className="rounded-[14px] glass-surface border border-border p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-[10px] px-2 py-2.5 text-[13px] font-bold border transition-colors ${kind === k ? `ring-1 ${KIND_COLORS[k]} border-transparent` : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:text-foreground"}`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-muted-foreground">{t.hint}</p>

          {kind === "customer_request" && (
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم العميل</label>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="اسم العميل أو المطعم" className={inputCls} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {kind === "challenge" && (
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">نوع التحدي</label>
                <select value={category} onChange={(e) => setCategory(e.target.value as ChallengeCategory)} className={inputCls}>
                  {CATEGORY_ENTRIES.map(([k, v]) => <option key={k} value={k} className="bg-card">{v}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">{t.severity}</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as ChallengeSeverity)} className={inputCls}>
                {SEVERITY_ENTRIES.map(([k, v]) => <option key={k} value={k} className="bg-card">{v}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">{t.title}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePh} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1.5">{t.desc}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={t.descPh} className={`${inputCls} resize-y`} />
          </div>

          {kind === "challenge" && (
            <>
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                  الطرف/القسم المعني <span className="font-normal">(اختياري)</span>
                </label>
                <input value={againstParty} onChange={(e) => setAgainstParty(e.target.value)} placeholder="مثال: قسم الدعم الإداري" className={inputCls} />
              </div>
              <label className="flex items-center gap-3 cursor-pointer rounded-[10px] bg-white/[0.02] border border-border px-3 py-3">
                <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="w-4 h-4 accent-violet-500" />
                <EyeOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">رفع بدون اسم — لن يظهر اسمك للمدير</span>
              </label>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                تفاصيل التحديات يشوفها مدير التحديات فقط.
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              إلغاء
            </button>
            <button
              onClick={submit}
              disabled={submitting || !canSubmit}
              className="flex items-center gap-2 rounded-[10px] bg-violet-500/20 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-violet-200 border border-violet-500/30 px-5 py-2.5 text-sm font-bold transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t.submit}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")} label="الكل" count={openCount.challenge + openCount.customer_request + openCount.development} />
          {KINDS.map((k) => (
            <FilterChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)} label={KIND_PLURAL_LABELS[k]} count={openCount[k]} />
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5">
          {[false, true].map((done) => (
            <button
              key={String(done)}
              onClick={() => setShowDone(done)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${showDone === done ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:text-foreground"}`}
            >
              {done ? "منجزة" : "مفتوحة"}
            </button>
          ))}
        </div>
      </div>

      {!showDone && lateCount > 0 && (
        <div className="flex items-center gap-2 rounded-[12px] bg-red-500/10 border border-red-500/20 px-3 py-2 text-[12px] text-red-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {lateCount} مفتوحة من أكثر من {LATE_DAYS} أيام
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : loadError ? (
        <p className="text-sm text-red-400 text-center py-8">تعذّر تحميل القائمة</p>
      ) : visible.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {showDone ? "ما فيه عناصر منجزة بعد." : "ما فيه شي مفتوح 👌"}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((c) => (
            <BoardCard key={c.id} c={c} role={role} updating={updating === c.id} onStatus={(s) => updateStatus(c, s)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${active ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "text-muted-foreground border-white/[0.06] hover:text-foreground hover:bg-white/[0.04]"}`}
    >
      {label}{count > 0 && <span className="opacity-70"> ({count})</span>}
    </button>
  );
}

function BoardCard({ c, role, updating, onStatus }: { c: BoardItem; role: Role; updating: boolean; onStatus: (s: ChallengeStatus) => void }) {
  const isDone = DONE.includes(c.status);
  const currentIdx = STATUS_FLOW.indexOf(c.status);
  const age = daysOpen(c.created_at);
  const late = !isDone && age > LATE_DAYS;

  return (
    <div className={`rounded-[14px] glass-surface border p-4 ${late ? "border-red-500/25" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{c.challenge_number}</span>
            <span className={`cc-badge ring-1 ${KIND_COLORS[c.kind]}`}>{KIND_LABELS[c.kind]}</span>
            {c.kind === "challenge" && <span className="cc-badge bg-white/[0.06] text-muted-foreground">{CATEGORY_LABELS[c.category]}</span>}
            {c.severity === "high" && <span className="cc-badge bg-red-500/15 text-red-400">أولوية عالية</span>}
            {c.is_anonymous && (
              <span className="cc-badge bg-white/[0.06] text-muted-foreground flex items-center gap-1"><EyeOff className="w-3 h-3" /> بدون اسم</span>
            )}
          </div>
          <h3 className="mt-2 text-sm font-bold text-foreground">{c.title}</h3>
          {c.client_name && <p className="text-[12px] text-amber-300 mt-0.5">العميل: {c.client_name}</p>}
          {c.description && <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">{c.description}</p>}
        </div>

        {c.can_update ? (
          <div className="flex items-center gap-1.5">
            {updating && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            <select
              value={c.status}
              disabled={updating}
              onChange={(e) => onStatus(e.target.value as ChallengeStatus)}
              className={`cc-badge ring-1 ${STATUS_COLORS[c.status]} bg-transparent cursor-pointer focus:outline-none`}
            >
              {STATUS_ENTRIES.map(([k, v]) => <option key={k} value={k} className="bg-card text-foreground">{v}</option>)}
            </select>
          </div>
        ) : (
          <span className={`cc-badge ring-1 ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {STATUS_FLOW.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${isDone || i <= currentIdx ? "bg-violet-400" : "bg-white/[0.08]"}`} />
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`flex items-center gap-1 ${late ? "text-red-400 font-bold" : ""}`}>
            <Clock className="w-3 h-3" /> رُفع {fmtDate(c.created_at)}{!isDone && ` · مفتوح ${age} يوم`}
          </span>
          {role !== "employee" && !c.mine && c.submitter_name && (
            <span className="flex items-center gap-1"><UserRound className="w-3 h-3" /> {c.submitter_name}</span>
          )}
          {isDone && c.resolved_at && (
            <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3 h-3" /> أُنجز {fmtDate(c.resolved_at)}</span>
          )}
        </div>
        {role === "challenge_manager" && (
          <Link href="/challenges" className="flex items-center gap-1 text-violet-300 hover:text-violet-200">
            الحلول والقياس <ArrowLeft className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
