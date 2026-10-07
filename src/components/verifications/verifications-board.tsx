"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck, Plus, Send, Loader2, MessageCircle, Trash2, CheckCircle2,
  AlertTriangle, Clock, UserRound, CalendarPlus, ExternalLink,
} from "lucide-react";
import { fetchEmployees, fetchUserProfiles } from "@/lib/supabase/db";
import { formatMoneyFull, todayLocal } from "@/lib/utils/format";
import {
  TEMPLATES, TEMPLATE_KEYS, usesDays, scopeOptions, scopeTitle, repLabel, REP_ALL, REP_NONE, STATUS_LABELS, progressOf, updatePageOf,
  type VerificationRequest, type VerifyTemplate, type VerifyScope,
} from "@/lib/verifications";

const inputCls = "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-teal-500/40";

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(s));
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
  `${TEMPLATES[r.template].label}${r.params?.stale_days ? ` (+${r.params.stale_days} يوم)` : ""} — ${scopeTitle(r.template, r.scope)}${r.params?.rep ? ` — ${repLabel(r.params.rep)}` : ""}`;

export function VerificationsBoard({ onPendingChange }: { onPendingChange?: (n: number) => void }) {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [me, setMe] = useState<{ id: string; isManager: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showForm, setShowForm] = useState(false);
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
  // ردود الـ PATCH ما فيها التقدّم — نحتفظ بالمحسوب
  const replace = (r: VerificationRequest) => setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...r, updated_ids: r.updated_ids ?? x.updated_ids } : x)));

  function sendWhatsApp(r: VerificationRequest, reminder = false) {
    const page = updatePageOf(r.template, r.scope);
    const p = progressOf(r);
    const lines = [
      `السلام عليكم ${r.assignee_name ?? ""}`,
      reminder ? `تذكير بطلب التحقق #${r.request_number}:` : `عندك طلب تحقق جديد #${r.request_number}:`,
      `📋 ${titleOf(r)}`,
      reminder && p.done ? `🔢 باقي ${p.left} من ${p.total} عميل يحتاجون تحديث` : `🔢 العدد: ${p.total} عميل يحتاجون تحديث`,
      ...(r.due_at ? [`⏰ المطلوب قبل: ${fmtDateTime(r.due_at)}`] : []),
      ...(r.note ? [`📝 ${r.note}`] : []),
      "",
      `حدّث حالة كل عميل من قسم «${page.label}»:`,
      `${window.location.origin}${page.href}`,
      "",
      "ولما تخلص اضغط «خلّصت التحديث» من هنا:",
      `${window.location.origin}/daily-huddle?tab=verify`,
    ];
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
                ? "أرسل للموظف عدد العملاء اللي يحتاجون تحديث، وهو يحدّثهم في النظام — والتقدّم يتحسب تلقائياً."
                : "حدّث العملاء المطلوبين في النظام، ولما تخلص اضغط «خلّصت التحديث»."}
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
            setRequests((prev) => [{ ...r, updated_ids: [] }, ...prev]);
            setShowForm(false);
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
          {visible.map((r) => (
            <RequestCard
              key={r.id}
              r={r}
              isManager={isManager}
              onUpdated={replace}
              onDeleted={() => setRequests((prev) => prev.filter((x) => x.id !== r.id))}
              onWhatsApp={(reminder) => sendWhatsApp(r, reminder)}
              flash={flash}
            />
          ))}
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
  // فاضي = بدون شرط مدة (للقوالب اللي المدة فيها اختيارية)
  const [staleDays, setStaleDays] = useState("");
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

  // العدد الحالي اللي ينطبق عليه التقرير — يتحدّث مع كل تغيير في الإعدادات
  const [preview, setPreview] = useState<{ count: number; value: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setPreviewing(true);
    const qs = new URLSearchParams({ preview: "1", template, scope, rep, stale_days: staleDays });
    const t = setTimeout(() => {
      fetch(`/api/verifications?${qs}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => { if (!cancelled) setPreview(d ? { count: d.count ?? 0, value: d.value ?? 0 } : null); })
        .catch(() => { if (!cancelled) setPreview(null); })
        .finally(() => { if (!cancelled) setPreviewing(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [template, scope, rep, staleDays]);

  async function submit() {
    if (!assignee || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template, scope, stale_days: Number(staleDays) || null, assignee_id: assignee, note, rep,
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
                // قوالب «بدون تواصل/تحديث» تحتاج عدد أيام — افتراضي 7
                if (usesDays(t) && !staleDays) setStaleDays("7");
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

      <div>
        <div className="flex items-center gap-2 text-[13px] text-foreground flex-wrap">
          آخر تعليق في سجل العميل أقدم من
          <input
            type="number" min={1} max={365} value={staleDays}
            placeholder={usesDays(template) ? "7" : "الكل"}
            onChange={(e) => setStaleDays(e.target.value.replace(/\D/g, ""))}
            className={`${inputCls} w-20 text-center`}
          />
          يوم
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          العميل اللي ما عليه ولا تعليق ينحسب من تاريخ إضافته.{!usesDays(template) && " اتركها فاضية عشان يجيك الكل بدون شرط مدة."}
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">ملاحظة للموظف <span className="font-normal">(اختياري)</span></label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: تأكد من كل عميل بمكالمة، مو من الذاكرة" className={inputCls} />
      </div>

      <div className="rounded-[12px] bg-teal-500/[0.06] border border-teal-500/20 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[12px] text-muted-foreground">{TEMPLATES[template].label}</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {previewing && !preview ? "جاري الحساب…" : preview ? (preview.count ? <>العدد <span className="font-mono text-teal-300 text-lg">{preview.count}</span> عميل — تحتاج تحديث</> : "ما فيه عملاء ينطبق عليهم هالتقرير حالياً") : "تعذّر حساب العدد"}
          </p>
        </div>
        {!!preview?.value && <span className="text-[12px] text-muted-foreground">القيمة {formatMoneyFull(preview.value)}</span>}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-[10px] px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">إلغاء</button>
        <button
          onClick={submit}
          disabled={!assignee || saving || preview?.count === 0}
          className="flex items-center gap-2 rounded-[10px] bg-teal-500/20 hover:bg-teal-500/30 disabled:opacity-40 text-teal-100 border border-teal-500/30 px-5 py-2 text-sm font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          إرسال الطلب
        </button>
      </div>
    </div>
  );
}

/* ═══ بطاقة الطلب: عدد إجمالي + تقدّم التحديث (بدون تفاصيل العملاء) ═══ */
function RequestCard({ r, isManager, onUpdated, onDeleted, onWhatsApp, flash }: {
  r: VerificationRequest;
  isManager: boolean;
  onUpdated: (r: VerificationRequest) => void;
  onDeleted: () => void;
  onWhatsApp: (reminder: boolean) => void;
  flash: (m: string, ok?: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const p = progressOf(r);
  const page = updatePageOf(r.template, r.scope);
  const late = isLate(r);

  async function patch(body: Record<string, unknown>, okMsg?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/verifications/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      onUpdated(data.request);
      if (okMsg) flash(okMsg);
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر الحفظ", false);
    } finally {
      setBusy(false);
    }
  }

  function markDone() {
    if (p.left > 0 && !confirm(`النظام يقول باقي ${p.left} عميل ما تحدّثوا. متأكد إنك خلّصت؟`)) return;
    patch({ submit: true }, "تم — وصل للمدير ✅");
  }

  async function remove() {
    if (!confirm(`حذف طلب التحقق #${r.request_number}؟`)) return;
    const res = await fetch(`/api/verifications/${r.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
    else flash("تعذّر الحذف", false);
  }

  const badge = isManager
    ? STATUS_LABELS[r.status]
    : r.status === "pending" ? "مطلوب منك" : r.status === "answered" ? "تم الإرسال" : "تمت المراجعة";
  const barTone = p.pct >= 90 ? "bg-emerald-500" : p.pct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className={`rounded-[14px] glass-surface border p-3.5 space-y-3 ${late ? "border-red-500/30" : r.status === (isManager ? "answered" : "pending") ? "border-teal-500/30" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{r.request_number}</span>
            <span className="text-[13px] font-bold text-foreground">{titleOf(r)}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
            {isManager ? <span className="flex items-center gap-1"><UserRound className="w-3 h-3" /> {r.assignee_name}</span> : <span>من {r.created_by_name}</span>}
            {r.due_at && <span className={`flex items-center gap-1 ${late ? "text-red-400 font-bold" : ""}`}><Clock className="w-3 h-3" /> قبل {fmtDateTime(r.due_at)}{late ? " — متأخر" : ""}</span>}
            {r.responded_at && <span>خلّص {fmtDateTime(r.responded_at)}</span>}
            <span className="flex items-center gap-1"><CalendarPlus className="w-3 h-3" /> أُرسل {fmtDateTime(r.created_at)}</span>
          </div>
        </div>
        <span className={`cc-badge shrink-0 ${r.status === "pending" ? (isManager ? "bg-sky-500/15 text-sky-300" : "bg-teal-500/15 text-teal-300") : r.status === "answered" ? "bg-teal-500/15 text-teal-300" : "bg-white/[0.06] text-muted-foreground"}`}>
          {badge}
        </span>
      </div>

      {r.note && <p className={`text-[12px] ${isManager ? "text-muted-foreground" : "text-amber-200 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2"}`}>📝 {r.note}</p>}

      {/* العدد والتقدّم */}
      <div className="rounded-[12px] bg-white/[0.02] border border-white/[0.06] p-3 space-y-2">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <p className="text-sm text-foreground">
            العدد <span className="font-mono font-extrabold text-lg">{p.total}</span> عميل — تحتاج تحديث
          </p>
          <p className="text-[12px] text-muted-foreground">
            تحدّث <span className="font-mono font-bold text-foreground">{p.done}</span> · باقي <span className={`font-mono font-bold ${p.left ? "text-amber-300" : "text-emerald-400"}`}>{p.left}</span>
          </p>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barTone}`} style={{ width: `${p.pct}%` }} />
        </div>
        {r.status === "answered" && isManager && p.left > 0 && (
          <p className="text-[11px] text-amber-300 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> الموظف قال خلّص، بس النظام يقول باقي {p.left} ما تحدّثوا</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!isManager && r.status !== "reviewed" && (
          <>
            <Link href={page.href} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-200 border border-sky-500/25">
              <ExternalLink className="w-3.5 h-3.5" /> افتح «{page.label}» وحدّث
            </Link>
            {r.status === "pending" && (
              <button onClick={markDone} disabled={busy} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-100 border border-teal-500/30 disabled:opacity-40">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} خلّصت التحديث
              </button>
            )}
          </>
        )}
        {isManager && (
          <>
            {r.status !== "reviewed" && (
              <button onClick={() => onWhatsApp(r.status !== "pending" || p.done > 0)} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                <MessageCircle className="w-3.5 h-3.5" /> {p.done > 0 ? "تذكير واتساب" : "إرسال واتساب للموظف"}
              </button>
            )}
            {r.status !== "reviewed" && (
              <button onClick={() => patch({ reviewed: true })} disabled={busy} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-200 border border-teal-500/25 disabled:opacity-40">
                <CheckCircle2 className="w-3.5 h-3.5" /> تمت المراجعة
              </button>
            )}
            <button onClick={remove} className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <Trash2 className="w-3.5 h-3.5" /> حذف
            </button>
          </>
        )}
      </div>
    </div>
  );
}
