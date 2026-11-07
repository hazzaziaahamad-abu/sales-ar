"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, X, Loader2, Clock, RefreshCw, Undo2, Send, CheckCheck, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Followup {
  id: string;
  source: "support" | "work" | "deal" | "renewal";
  category: Category | null;
  ticket_number: number | null;
  title: string;
  assignee_name: string;
  last_activity_at: string;
  body: string;
  status: "pending" | "approved" | "sending" | "sent" | "rejected" | "skipped";
  send_at: string | null;
  sent_at: string | null;
  skip_reason: string | null;
  created_at: string;
  last_note?: { author: string | null; body: string; created_at: string } | null;
  stage?: string | null;
}

type Category = "ticket" | "work" | "office_sales" | "support_sales" | "renewal";
const CATEGORY_LABEL: Record<Category, string> = {
  ticket: "تذاكر الدعم", work: "الطلبات والتطويرات", office_sales: "مبيعات المكتب", support_sales: "مبيعات الدعم", renewal: "التجديدات",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
const catOf = (f: Followup): Category => f.category ?? (f.source === "support" ? "ticket" : f.source === "deal" ? "office_sales" : f.source);
const label = (f: Followup) => `${f.ticket_number ? `#${f.ticket_number} ` : ""}${f.title || "—"}`;
const STATUS_LABEL: Record<Followup["status"], string> = {
  pending: "بانتظار موافقتك", approved: "مجدولة", sending: "تنرسل", sent: "انرسلت", rejected: "مرفوضة", skipped: "انلغت",
};

const daysSince = (s: string) => Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000));
function ago(s: string): string {
  const m = Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 60_000));
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

/** آخر تعليق على الصفقة/التذكرة. */
function LastNote({ f, compact = false }: { f: Followup; compact?: boolean }) {
  const n = f.last_note;
  if (!n) return <p className="text-[11px] text-muted-foreground/70">ما فيه تعليقات سابقة</p>;
  return (
    <div className={`rounded-[10px] bg-white/[0.03] border border-white/[0.05] px-2.5 py-1.5 ${compact ? "" : "space-y-0.5"}`}>
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <MessageSquare className="w-3 h-3" /> آخر تعليق · {n.author || "—"} · {ago(n.created_at)}
      </p>
      <p className={`text-[12px] text-foreground/80 whitespace-pre-line ${compact ? "line-clamp-1" : "line-clamp-4"}`}>{n.body}</p>
    </div>
  );
}

/** شارة مرحلة العميل. */
function Stage({ f }: { f: Followup }) {
  if (!f.stage) return null;
  return <span className="rounded-md bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">{f.stage}</span>;
}

function fmt(s: string | null): string {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("ar", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(new Date(s));
  } catch {
    return "";
  }
}

export default function TicketFollowupsPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState<Followup[]>([]);
  const [done, setDone] = useState<Followup[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cat, setCat] = useState<Category | "all">("all");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(() =>
    fetch("/api/ticket-followups", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return;
        setOpen(j.open ?? []);
        setDone(j.done ?? []);
        setTexts((prev) => {
          const next = { ...prev };
          for (const f of (j.open ?? []) as Followup[]) if (next[f.id] === undefined) next[f.id] = f.body;
          return next;
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  const act = async (payload: object, okMsg: string) => {
    setBusy(true);
    const r = await fetch("/api/ticket-followups", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    setToast(r.ok ? { ok: true, msg: okMsg } : { ok: false, msg: j.error ?? "صار خطأ" });
    setTimeout(() => setToast(null), 3500);
    await load();
    setBusy(false);
  };

  const allPending = open.filter((f) => f.status === "pending");
  const pending = cat === "all" ? allPending : allPending.filter((f) => catOf(f) === cat);
  const counts = CATEGORIES.map((c) => [c, allPending.filter((f) => catOf(f) === c).length] as const);
  const scheduled = open.filter((f) => f.status !== "pending").sort((a, b) => (a.send_at ?? "").localeCompare(b.send_at ?? ""));
  const approveItems = (list: Followup[]) => list.map((f) => ({ id: f.id, body: texts[f.id] ?? f.body }));

  if (user && !user.isSuperAdmin) return <p className="text-center text-sm text-muted-foreground py-12">الصفحة للسوبر أدمن فقط</p>;

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20 shrink-0">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">متابعة التذاكر والصفقات</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              تذاكر وصفقات وتجديدات لها من ٤٨ ساعة إلى ١٠ أيام بدون تحديث. راجع النص ووافق، وتنرسل باسمك كتعليق عادي فيه منشن في أوقات متفرقة (السبت–الخميس): مبيعات المكتب ٩ص–٥م، مبيعات الدعم والتجديدات ١ظ–١٠م، التذاكر ٧:٤٠ص–٣م.
            </p>
          </div>
        </div>
        <button
          disabled={busy}
          onClick={() => act({ action: "prepare" }, "تم الفحص")}
          className="flex items-center gap-2 rounded-[12px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-3 py-2 text-xs font-bold text-muted-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> افحص الحين
        </button>
      </div>

      {toast && (
        <div className={`rounded-[12px] px-4 py-3 text-sm border ${toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {/* فلتر الأقسام */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([["all", allPending.length] as const, ...counts]).map(([k, n]) => (
              <button
                key={k}
                onClick={() => setCat(k)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${cat === k ? "bg-orange-500/20 text-orange-300 border-orange-500/30" : "border-white/[0.06] text-muted-foreground hover:text-foreground"}`}
              >
                {k === "all" ? "الكل" : CATEGORY_LABEL[k]} ({n})
              </button>
            ))}
          </div>

          {/* بانتظار الموافقة */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-foreground">بانتظار موافقتك ({pending.length})</h2>
              {pending.length > 1 && (
                <div className="flex items-center gap-1.5">
                <button
                  disabled={busy}
                  onClick={() => { if (confirm(`رفض ${pending.length} متابعة؟`)) act({ action: "reject", ids: pending.map((f) => f.id) }, `تم رفض ${pending.length}`); }}
                  className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /> ارفض الكل
                </button>
                <button
                  disabled={busy}
                  onClick={() => act({ action: "approve", items: approveItems(pending) }, `تمت جدولة ${pending.length} متابعة`)}
                  className="flex items-center gap-1.5 rounded-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> وافق على الكل
                </button>
                </div>
              )}
            </div>
            {pending.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                ما فيه شي ساكت يحتاج متابعة 👌
              </div>
            ) : pending.map((f) => (
              <div key={f.id} className="rounded-[14px] border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap text-[12px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{label(f)}</span>
                    <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-muted-foreground">{CATEGORY_LABEL[catOf(f)]}</span>
                    <Stage f={f} />
                  </div>
                  <span className="text-muted-foreground">
                    {f.assignee_name} · <Clock className="inline w-3 h-3" /> بدون تحديث من {daysSince(f.last_activity_at)} يوم
                  </span>
                </div>
                <LastNote f={f} />
                <textarea
                  value={texts[f.id] ?? f.body}
                  onChange={(e) => setTexts((p) => ({ ...p, [f.id]: e.target.value }))}
                  rows={2}
                  className="w-full rounded-[10px] bg-background border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    disabled={busy}
                    onClick={() => act({ action: "reject", ids: [f.id] }, "تم الرفض")}
                    className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> لا ترسل
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => act({ action: "approve", items: approveItems([f]) }, "تمت الجدولة")}
                    className="flex items-center gap-1 rounded-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20 px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> وافق
                  </button>
                </div>
              </div>
            ))}
          </section>

          {/* المجدولة */}
          {scheduled.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-extrabold text-foreground">مجدولة للإرسال ({scheduled.length})</h2>
              {scheduled.map((f) => (
                <div key={f.id} className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 flex-wrap text-[12px] text-muted-foreground">{label(f)} · {f.assignee_name} · {CATEGORY_LABEL[catOf(f)]} <Stage f={f} /></p>
                    <p className="text-sm text-foreground truncate">{f.body}</p>
                    <div className="mt-1"><LastNote f={f} compact /></div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 text-[11px] text-orange-300"><Send className="w-3 h-3" /> {fmt(f.send_at)}</span>
                    {f.status === "approved" && (
                      <button
                        disabled={busy}
                        title="رجّعها للمراجعة"
                        onClick={() => act({ action: "unschedule", ids: [f.id] }, "رجعت للمراجعة")}
                        className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-50"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* السجل */}
          {done.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-extrabold text-muted-foreground">آخر ٧ أيام</h2>
              {done.map((f) => (
                <div key={f.id} className="rounded-[12px] border border-white/[0.04] px-3 py-2 flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-muted-foreground truncate">{label(f)} · {f.assignee_name} — {f.body}</span>
                  <span className={`shrink-0 ${f.status === "sent" ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {STATUS_LABEL[f.status]}{f.status === "sent" ? ` · ${fmt(f.sent_at)}` : f.skip_reason ? ` · ${f.skip_reason}` : ""}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
