"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck, Plus, Send, Loader2, ChevronDown, ChevronUp, MessageCircle, Trash2, CheckCircle2,
  AlertTriangle, Clock, Phone, RefreshCw, UserRound, X, CalendarPlus, History,
} from "lucide-react";
import { fetchEmployees, fetchUserProfiles } from "@/lib/supabase/db";
import { formatMoneyFull, todayLocal } from "@/lib/utils/format";
import {
  TEMPLATES, TEMPLATE_KEYS, usesDays, scopeOptions, scopeTitle, repLabel, REP_ALL, REP_NONE, STATUS_LABELS, NO_CONTACT, statusOptions, matchItem, summarize,
  type VerificationRequest, type VerifyTemplate, type VerifyScope, type VerifyResponse, type VerifyExtra, type MatchResult,
} from "@/lib/verifications";

const inputCls = "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-teal-500/40";

const RESULT_UI: Record<MatchResult, { label: string; cls: string }> = {
  match: { label: "مطابق ✓", cls: "bg-emerald-500/15 text-emerald-400" },
  mismatch: { label: "مختلف", cls: "bg-amber-500/15 text-amber-400" },
  no_answer: { label: "ما انرد عليه", cls: "bg-red-500/15 text-red-400" },
  no_contact: { label: "تعذّر التواصل", cls: "bg-slate-500/15 text-slate-300" },
};

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(s));
  } catch {
    return "—";
  }
}
function fmtDay(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { month: "short", day: "numeric" }).format(new Date(s.length === 10 ? `${s}T12:00:00` : s));
  } catch {
    return "—";
  }
}
function waPhone(p?: string | null): string {
  if (!p) return "";
  let s = p.replace(/[^\d]/g, "");
  if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("05")) s = "966" + s.slice(1);
  else if (s.startsWith("5") && s.length === 9) s = "966" + s;
  return s;
}
const isLate = (r: VerificationRequest) => r.status === "pending" && !!r.due_at && new Date(r.due_at).getTime() < Date.now();
const titleOf = (r: VerificationRequest) =>
  `${TEMPLATES[r.template].label}${usesDays(r.template) && r.params?.stale_days ? ` (+${r.params.stale_days} يوم)` : ""} — ${scopeTitle(r.template, r.scope)}${r.params?.rep ? ` — ${repLabel(r.params.rep)}` : ""}`;

export function VerificationsBoard({ onPendingChange }: { onPendingChange?: (n: number) => void }) {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [me, setMe] = useState<{ id: string; isManager: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "reviewed">("open");
  const [phones, setPhones] = useState<Map<string, string>>(new Map());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/verifications");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequests(data.requests ?? []);
      setMe(data.me ?? null);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchEmployees()
      .then((emps) => setPhones(new Map(emps.filter((e) => e.phone).map((e) => [e.name.trim(), e.phone as string]))))
      .catch(() => undefined);
  }, []);

  const pendingForMe = useMemo(() => {
    if (!me) return 0;
    return me.isManager
      ? requests.filter((r) => r.status === "answered").length
      : requests.filter((r) => r.status === "pending" && r.assignee_id === me.id).length;
  }, [requests, me]);
  useEffect(() => { onPendingChange?.(pendingForMe); }, [pendingForMe, onPendingChange]);

  function flash(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }
  const replace = (r: VerificationRequest) => setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...r, current: r.current ?? x.current } : x)));

  function sendWhatsApp(r: VerificationRequest, reminder = false) {
    const link = `${window.location.origin}/daily-huddle?tab=verify`;
    const lines = [
      `السلام عليكم ${r.assignee_name ?? ""}`,
      reminder ? `تذكير بطلب التحقق #${r.request_number}:` : `عندك طلب تحقق جديد #${r.request_number}:`,
      `📋 ${titleOf(r)} (${r.items.length} عميل)`,
      r.due_at ? `⏰ المطلوب قبل: ${fmtDateTime(r.due_at)}` : "",
      r.note ? `📝 ${r.note}` : "",
      "",
      "تحقق من كل عميل وحدّث حالته الفعلية من هنا:",
      link,
    ].filter((l) => l !== "");
    const phone = waPhone(phones.get((r.assignee_name ?? "").trim()));
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  }

  const visible = requests.filter((r) => (filter === "reviewed" ? r.status === "reviewed" : r.status !== "reviewed"));
  const isManager = !!me?.isManager;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/20 shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-foreground">طلبات التحقق</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {isManager
                ? "اطلب من الموظف يتحقق من قائمة عملاء، والنظام يطابق رده مع البيانات."
                : "طلبات التحقق المرسلة لك — تحقق من كل عميل واختر حالته الفعلية."}
            </p>
          </div>
        </div>
        {isManager && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-[12px] bg-teal-500/15 hover:bg-teal-500/25 text-teal-200 border border-teal-500/20 px-4 py-2.5 text-sm font-bold"
          >
            <Plus className="w-4 h-4" /> طلب تحقق جديد
          </button>
        )}
      </div>

      {toast && (
        <div className={`rounded-[12px] px-4 py-3 text-sm border ${toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
          {toast.msg}
        </div>
      )}

      {isManager && showForm && (
        <NewRequestForm
          onCancel={() => setShowForm(false)}
          onCreated={(r) => {
            setRequests((prev) => [{ ...r, current: Object.fromEntries(r.items.map((it) => [it.entity_id, it.system_status])) }, ...prev]);
            setShowForm(false);
            setExpanded(r.id);
            flash(`تم إنشاء الطلب #${r.request_number} (${r.items.length} عميل) — أرسله واتساب للموظف`);
          }}
          onError={(m) => flash(m, false)}
        />
      )}

      <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5 w-fit">
        {([["open", "الحالية"], ["reviewed", "المراجَعة"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold ${filter === k ? "bg-teal-500/20 text-teal-200" : "text-muted-foreground hover:text-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : loadError ? (
        <p className="text-sm text-red-400 text-center py-8">تعذّر تحميل الطلبات</p>
      ) : visible.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {filter === "open" ? (isManager ? "ما فيه طلبات حالية. أرسل طلب تحقق من الأعلى." : "ما عندك طلبات تحقق 👌") : "ما فيه طلبات مراجَعة."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((r) => {
            // الموظف: أول طلب مطلوب رده يكون مفتوح تلقائياً
            const isOpen = expanded === r.id || (!isManager && expanded === null && r.status === "pending" && visible[0]?.id === r.id);
            return isManager ? (
              <ManagerCard
                key={r.id}
                r={r}
                open={expanded === r.id}
                onToggle={() => setExpanded((e) => (e === r.id ? null : r.id))}
                onUpdated={replace}
                onDeleted={() => setRequests((prev) => prev.filter((x) => x.id !== r.id))}
                onWhatsApp={(reminder) => sendWhatsApp(r, reminder)}
                flash={flash}
              />
            ) : (
              <EmployeeCard
                key={r.id}
                r={r}
                open={isOpen}
                onToggle={() => setExpanded(isOpen ? "__none__" : r.id)}
                onUpdated={replace}
                flash={flash}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ إنشاء طلب (المدير) ═══ */
function NewRequestForm({ onCancel, onCreated, onError }: {
  onCancel: () => void;
  onCreated: (r: VerificationRequest) => void;
  onError: (m: string) => void;
}) {
  const [template, setTemplate] = useState<VerifyTemplate>("trial");
  const [scope, setScope] = useState<VerifyScope>("support");
  const [staleDays, setStaleDays] = useState(7);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [assignee, setAssignee] = useState("");
  const [rep, setRep] = useState<string>(REP_ALL);
  const isRenewal = TEMPLATES[template].entity === "renewal";
  const assigneeName = users.find((u) => u.id === assignee)?.name ?? "";

  // التجديدات مقسومة حسب المسؤول — نخلي القائمة على عملاء الموظف المختار تلقائياً
  function pickAssignee(id: string) {
    setAssignee(id);
    const name = users.find((u) => u.id === id)?.name ?? "";
    if (isRenewal && name) setRep(name);
  }
  const [due, setDue] = useState(`${todayLocal()}T16:00`);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchUserProfiles().then(setUsers).catch(console.error); }, []);

  async function submit() {
    if (!assignee || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template, scope, stale_days: staleDays, assignee_id: assignee, note, rep,
          due_at: due ? new Date(`${due}:00+03:00`).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر إنشاء الطلب");
      onCreated(data.request);
    } catch (e) {
      onError(e instanceof Error ? e.message : "تعذّر إنشاء الطلب");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[14px] glass-surface border border-border p-4 space-y-3">
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">نوع التقرير</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEMPLATE_KEYS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTemplate(t);
                // التجديدات: عملاء الموظف المختار؛ الصفقات: الكل
                setRep(TEMPLATES[t].entity === "renewal" && assigneeName ? assigneeName : REP_ALL);
                // القسم يتبع نوع التقرير (صفقات ↔ تجديدات)
                if (TEMPLATES[t].entity !== TEMPLATES[template].entity) setScope(TEMPLATES[t].entity === "renewal" ? "renewals" : "support");
              }}
              className={`text-right rounded-[10px] px-3 py-2 border transition-colors ${template === t ? "bg-teal-500/15 border-teal-500/30" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"}`}
            >
              <p className={`text-[13px] font-bold ${template === t ? "text-teal-200" : "text-foreground"}`}>{TEMPLATES[t].label}</p>
              <p className="text-[11px] text-muted-foreground">{TEMPLATES[t].hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">القسم</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as VerifyScope)} className={inputCls}>
            {scopeOptions(TEMPLATES[template].entity).map((o) => <option key={o.value} value={o.value} className="bg-card">{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">الموظف</label>
          <select value={assignee} onChange={(e) => pickAssignee(e.target.value)} className={inputCls}>
            <option value="" className="bg-card">— اختر —</option>
            {users.map((u) => <option key={u.id} value={u.id} className="bg-card">{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">المطلوب قبل</label>
          <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">عملاء مين؟</label>
        <select value={rep} onChange={(e) => setRep(e.target.value)} className={inputCls}>
          <option value={REP_ALL} className="bg-card">كل العملاء</option>
          {users.map((u) => <option key={u.id} value={u.name} className="bg-card">عملاء {u.name}</option>)}
          <option value={REP_NONE} className="bg-card">بدون مسؤول</option>
        </select>
        <p className="text-[11px] text-muted-foreground mt-1">
          {isRenewal ? "حسب «المسؤول» في قسم التجديدات" : "حسب «المسؤول» عن الصفقة — اتركها «كل العملاء» لو الموظف يتابع القسم كامل"}
        </p>
      </div>

      {usesDays(template) && (
        <div className="flex items-center gap-2 text-[13px] text-foreground">
          {template === "stale" ? "بدون تواصل من أكثر من" : "بدون تحديث من أكثر من"}
          <input type="number" min={1} max={90} value={staleDays} onChange={(e) => setStaleDays(Number(e.target.value) || 7)} className={`${inputCls} w-20 text-center`} />
          يوم
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">ملاحظة للموظف <span className="font-normal">(اختياري)</span></label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: تأكد من كل عميل بمكالمة، مو من الذاكرة" className={inputCls} />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-[10px] px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">إلغاء</button>
        <button
          onClick={submit}
          disabled={!assignee || saving}
          className="flex items-center gap-2 rounded-[10px] bg-teal-500/20 hover:bg-teal-500/30 disabled:opacity-40 text-teal-100 border border-teal-500/30 px-5 py-2 text-sm font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          إنشاء الطلب
        </button>
      </div>
    </div>
  );
}

/* ═══ بطاقة المدير: المطابقة ═══ */
function ManagerCard({ r, open, onToggle, onUpdated, onDeleted, onWhatsApp, flash }: {
  r: VerificationRequest;
  open: boolean;
  onToggle: () => void;
  onUpdated: (r: VerificationRequest) => void;
  onDeleted: () => void;
  onWhatsApp: (reminder: boolean) => void;
  flash: (m: string, ok?: boolean) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const s = summarize(r);
  const answered = r.status !== "pending";
  const late = isLate(r);

  async function apply(entityId: string) {
    setBusy(entityId);
    try {
      const res = await fetch(`/api/verifications/${r.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_id: entityId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر التحديث");
      onUpdated({ ...r, current: { ...r.current, [entityId]: data.current }, applied: { ...r.applied, [entityId]: data.applied } });
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر التحديث", false);
    } finally {
      setBusy(null);
    }
  }

  async function markReviewed() {
    setBusy("__review__");
    try {
      const res = await fetch(`/api/verifications/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      onUpdated({ ...data.request, current: r.current });
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر الحفظ", false);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`حذف طلب التحقق #${r.request_number}؟`)) return;
    const res = await fetch(`/api/verifications/${r.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else flash("تعذّر الحذف", false);
  }

  const rows = r.items
    .map((it) => ({ it, resp: r.responses[it.entity_id], cur: r.current?.[it.entity_id] ?? it.system_status }))
    .map((x) => ({ ...x, result: matchItem(x.it, x.resp, x.cur) }))
    .filter((x) => !onlyIssues || x.result !== "match");

  return (
    <div className={`rounded-[14px] glass-surface border ${late ? "border-red-500/30" : r.status === "answered" ? "border-teal-500/30" : "border-border"}`}>
      <button onClick={onToggle} className="w-full text-right p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">#{r.request_number}</span>
              <span className="text-[13px] font-bold text-foreground">{titleOf(r)}</span>
            </div>
            <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><UserRound className="w-3 h-3" /> {r.assignee_name}</span>
              <span>{r.items.length} عميل</span>
              {r.due_at && <span className={`flex items-center gap-1 ${late ? "text-red-400 font-bold" : ""}`}><Clock className="w-3 h-3" /> قبل {fmtDateTime(r.due_at)}{late ? " — متأخر" : ""}</span>}
              {r.responded_at && <span>ردّ {fmtDateTime(r.responded_at)}</span>}
              <span className="flex items-center gap-1"><CalendarPlus className="w-3 h-3" /> أُنشئ {fmtDateTime(r.created_at)}</span>
              {r.updated_at && <span className="flex items-center gap-1"><History className="w-3 h-3" /> آخر تحديث {fmtDateTime(r.updated_at)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {answered && (
              <span className={`text-sm font-extrabold font-mono ${s.pct >= 90 ? "text-emerald-400" : s.pct >= 70 ? "text-amber-400" : "text-red-400"}`}>{s.pct}%</span>
            )}
            <span className={`cc-badge ${r.status === "pending" ? "bg-sky-500/15 text-sky-300" : r.status === "answered" ? "bg-teal-500/15 text-teal-300" : "bg-white/[0.06] text-muted-foreground"}`}>
              {STATUS_LABELS[r.status]}
            </span>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/[0.06] p-3.5 space-y-3">
          {r.note && <p className="text-[12px] text-muted-foreground">📝 {r.note}</p>}

          {answered ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <Tile label="مطابق" value={s.match} tone="text-emerald-400" />
                <Tile label="مختلف" value={s.mismatch} tone={s.mismatch ? "text-amber-400" : "text-muted-foreground"} />
                <Tile label="ما انرد عليه" value={s.no_answer} tone={s.no_answer ? "text-red-400" : "text-muted-foreground"} />
                <Tile label="تعذّر التواصل" value={s.no_contact} tone="text-slate-300" />
                <Tile label="ناقص في النظام" value={s.extras} tone={s.extras ? "text-violet-300" : "text-muted-foreground"} />
              </div>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer w-fit">
                <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} className="accent-teal-500" />
                اعرض الاختلافات فقط
              </label>
            </>
          ) : (
            <p className="text-[12px] text-sky-300">بانتظار رد {r.assignee_name}. القائمة تحت هي اللي انرسلت له.</p>
          )}

          <div className="space-y-1.5">
            {rows.map(({ it, resp, cur, result }) => {
              const applied = r.applied?.[it.entity_id];
              return (
                <div key={it.entity_id} className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-foreground">{it.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[it.rep, it.extra, it.value ? formatMoneyFull(it.value) : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {answered && <span className={`cc-badge ${RESULT_UI[result].cls}`}>{RESULT_UI[result].label}</span>}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-[12px]">
                    <div><span className="text-muted-foreground">النظام: </span><span className="text-foreground">{cur ?? "—"}</span></div>
                    {answered && (
                      <div>
                        <span className="text-muted-foreground">الموظف: </span>
                        <span className={result === "mismatch" ? "text-amber-300 font-bold" : "text-foreground"}>
                          {!resp ? "—" : resp.status === NO_CONTACT ? "تعذّر التواصل" : resp.status}
                        </span>
                      </div>
                    )}
                  </div>
                  {resp?.note && <p className="text-[11px] text-muted-foreground mt-1">ملاحظة: {resp.note}{resp.last_contact ? ` · آخر تواصل ${fmtDay(resp.last_contact)}` : ""}</p>}
                  {!resp?.note && resp?.last_contact && <p className="text-[11px] text-muted-foreground mt-1">آخر تواصل {fmtDay(resp.last_contact)}</p>}
                  {result === "mismatch" && (
                    <button
                      onClick={() => apply(it.entity_id)}
                      disabled={busy === it.entity_id}
                      className="mt-2 flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/25 disabled:opacity-40"
                    >
                      {busy === it.entity_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      حدّث النظام إلى «{resp?.status}»
                    </button>
                  )}
                  {applied && (
                    <p className="text-[11px] text-emerald-400 mt-1">✓ تم التحديث: {applied.from} ← {applied.to} ({applied.by}، {fmtDateTime(applied.at)})</p>
                  )}
                </div>
              );
            })}
          </div>

          {r.extras.length > 0 && (
            <div className="rounded-lg bg-violet-500/[0.06] border border-violet-500/20 p-3">
              <p className="text-[12px] font-bold text-violet-300 mb-1.5">➕ عملاء ذكرهم الموظف ومو موجودين في القائمة</p>
              <ul className="space-y-1">
                {r.extras.map((x, i) => (
                  <li key={i} className="text-[12px] text-foreground">• {x.name}{x.status ? ` — ${x.status}` : ""}{x.note ? <span className="text-muted-foreground"> ({x.note})</span> : null}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={() => onWhatsApp(answered)} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
              <MessageCircle className="w-3.5 h-3.5" /> {r.status === "pending" ? "إرسال واتساب للموظف" : "واتساب للموظف"}
            </button>
            {r.status === "answered" && (
              <button onClick={markReviewed} disabled={busy === "__review__"} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-200 border border-teal-500/25 disabled:opacity-40">
                <CheckCircle2 className="w-3.5 h-3.5" /> تمت المراجعة
              </button>
            )}
            <button onClick={remove} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <Trash2 className="w-3.5 h-3.5" /> حذف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl p-2 bg-white/[0.03] border border-white/[0.06] text-center">
      <p className={`text-lg font-extrabold font-mono ${tone}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ═══ بطاقة الموظف: الرد ═══ */
function EmployeeCard({ r, open, onToggle, onUpdated, flash }: {
  r: VerificationRequest;
  open: boolean;
  onToggle: () => void;
  onUpdated: (r: VerificationRequest) => void;
  flash: (m: string, ok?: boolean) => void;
}) {
  const [responses, setResponses] = useState<Record<string, VerifyResponse>>(r.responses ?? {});
  const [extras, setExtras] = useState<VerifyExtra[]>(r.extras ?? []);
  const [saving, setSaving] = useState(false);
  const locked = r.status === "reviewed";
  const answeredCount = r.items.filter((it) => responses[it.entity_id]?.status).length;
  const late = isLate(r);

  const setResp = (id: string, patch: Partial<VerifyResponse>) =>
    setResponses((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } as VerifyResponse }));

  async function save(submit: boolean) {
    if (submit && answeredCount < r.items.length && !confirm(`باقي ${r.items.length - answeredCount} عميل بدون رد. ترسل الرد كذا؟`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/verifications/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, extras, submit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      onUpdated(data.request);
      flash(submit ? "تم إرسال ردك للمدير ✅" : "تم الحفظ — تقدر تكمل لاحقاً");
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر الحفظ", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-[14px] glass-surface border ${late ? "border-red-500/30" : r.status === "pending" ? "border-teal-500/30" : "border-border"}`}>
      <button onClick={onToggle} className="w-full text-right p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">#{r.request_number}</span>
              <span className="text-[13px] font-bold text-foreground">{titleOf(r)}</span>
            </div>
            <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
              <span>من {r.created_by_name}</span>
              <span>{answeredCount}/{r.items.length} تم التحقق</span>
              {r.due_at && <span className={`flex items-center gap-1 ${late ? "text-red-400 font-bold" : ""}`}><Clock className="w-3 h-3" /> قبل {fmtDateTime(r.due_at)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`cc-badge ${r.status === "pending" ? "bg-teal-500/15 text-teal-300" : "bg-white/[0.06] text-muted-foreground"}`}>
              {r.status === "pending" ? "مطلوب ردك" : r.status === "answered" ? "تم الإرسال" : "تمت المراجعة"}
            </span>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-white/[0.06] p-3.5 space-y-3">
          {r.note && <p className="text-[12px] text-amber-200 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">📝 {r.note}</p>}
          {!locked && <p className="text-[12px] text-muted-foreground">تحقق من كل عميل (مكالمة أو واتساب) واختر حالته <b>الفعلية</b> الحين.</p>}

          <div className="space-y-2">
            {r.items.map((it) => {
              const resp = responses[it.entity_id];
              return (
                <div key={it.entity_id} className={`rounded-lg border px-3 py-2.5 ${resp?.status ? "bg-white/[0.02] border-white/[0.06]" : "bg-teal-500/[0.03] border-teal-500/20"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-foreground">{it.name}</p>
                      <p className="text-[11px] text-muted-foreground">{[it.rep, it.extra].filter(Boolean).join(" · ")}</p>
                    </div>
                    {it.phone && (
                      <a href={`tel:${it.phone}`} className="flex items-center gap-1 text-[11px] text-sky-300 shrink-0" dir="ltr">
                        <Phone className="w-3 h-3" /> {it.phone}
                      </a>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={resp?.status ?? ""}
                      disabled={locked}
                      onChange={(e) => setResp(it.entity_id, { status: e.target.value })}
                      className={`${inputCls} py-1.5 text-[12px]`}
                    >
                      <option value="" className="bg-card">— الحالة الفعلية —</option>
                      {statusOptions(it.entity_type).map((s) => <option key={s} value={s} className="bg-card">{s}</option>)}
                      <option value={NO_CONTACT} className="bg-card">تعذّر التواصل</option>
                    </select>
                    <input
                      value={resp?.note ?? ""}
                      disabled={locked}
                      onChange={(e) => setResp(it.entity_id, { note: e.target.value })}
                      placeholder="ملاحظة (اختياري)"
                      className={`${inputCls} py-1.5 text-[12px]`}
                    />
                    <input
                      type="date"
                      value={resp?.last_contact ?? ""}
                      disabled={locked}
                      max={todayLocal()}
                      onChange={(e) => setResp(it.entity_id, { last_contact: e.target.value })}
                      title="تاريخ آخر تواصل"
                      className={`${inputCls} py-1.5 text-[12px]`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* عملاء ناقصين */}
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-2">
            <p className="text-[12px] font-bold text-muted-foreground">➕ عميل عندك ومو موجود في القائمة؟</p>
            {extras.map((x, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <input value={x.name} disabled={locked} onChange={(e) => setExtras((p) => p.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="اسم العميل" className={`${inputCls} py-1.5 text-[12px]`} />
                <input value={x.status} disabled={locked} onChange={(e) => setExtras((p) => p.map((y, j) => (j === i ? { ...y, status: e.target.value } : y)))} placeholder="حالته" className={`${inputCls} py-1.5 text-[12px]`} />
                <input value={x.note ?? ""} disabled={locked} onChange={(e) => setExtras((p) => p.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))} placeholder="ملاحظة" className={`${inputCls} py-1.5 text-[12px]`} />
                {!locked && (
                  <button onClick={() => setExtras((p) => p.filter((_, j) => j !== i))} className="px-2 text-muted-foreground hover:text-red-400"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
            {!locked && (
              <button onClick={() => setExtras((p) => [...p, { name: "", status: "" }])} className="text-[12px] text-teal-300 flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> إضافة عميل
              </button>
            )}
          </div>

          {!locked && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                {answeredCount < r.items.length && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                {answeredCount}/{r.items.length} تم التحقق
              </span>
              <div className="flex gap-2">
                <button onClick={() => save(false)} disabled={saving} className="text-[12px] font-bold px-4 py-2 rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground disabled:opacity-40">حفظ مؤقت</button>
                <button onClick={() => save(true)} disabled={saving} className="flex items-center gap-1.5 text-[12px] font-bold px-4 py-2 rounded-lg bg-teal-500/20 text-teal-100 border border-teal-500/30 disabled:opacity-40">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {r.status === "answered" ? "تحديث الرد" : "إرسال الرد للمدير"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
