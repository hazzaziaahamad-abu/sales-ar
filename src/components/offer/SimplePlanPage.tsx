"use client";

// صفحة «الخطة المبسطة للصالونات» المستقلة — قائمة عميلات، ولكل عميلة خطتها (الجلسة، التوصيات، الخطة الشهرية).
// للسوبر أدمن ومن صفحتها مفعّلة في دوره (يتحقق منها /api/salon-simple).

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight, Car, Check, Cloud, Home, Loader2, Moon, Plus, Search, ShieldX, Store, Sun, Trash2, Users, X, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import SimplePlan from "@/components/offer/SimplePlan";
import BackToPlatform from "@/components/offer/BackToPlatform";
import { GOALS, modelOf, monthLabel, type BizModel, type Simple } from "@/lib/salon-simple";
import { THEMES, type ThemeKey } from "@/components/salon-room/ui";

type Mode = "loading" | "live" | "login" | "denied" | "error";
type ClientSummary = {
  id: string; name: string; model: BizModel | null; goal: string | null; updated_at: string;
  session_date: string | null; session_done: boolean; months: number; month: string | null; month_done: number; month_total: number;
};

const accGrad = { background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" };
const card = "rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]";
const input = "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)]";
const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
const MODEL_ICON: Record<BizModel, LucideIcon> = { salon: Store, home_visit: Car, home_studio: Home };
const noop = () => () => {};

export default function SimplePlanPage() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <div className="min-h-screen bg-[#FAF5EF]" />;
  return <Inner />;
}

function Inner() {
  const [theme, setTheme] = useState<ThemeKey>(() => {
    try { return localStorage.getItem("sg-theme") === "night" ? "night" : "brand"; } catch { return "brand"; }
  });
  const [mode, setMode] = useState<Mode>("loading");
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("c"));
  const [s, setS] = useState<Simple | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ id: string; value: Simple } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 3500 : 2200);
  }, []);

  const fail = (status: number) => setMode(status === 401 ? "login" : status === 403 ? "denied" : "error");

  const loadList = useCallback(() =>
    fetch("/api/salon-simple", { cache: "no-store" }).then(async (res) => {
      if (!res.ok) return fail(res.status);
      setClients((await res.json()).clients);
      setMode((m) => (m === "loading" ? "live" : m));
    }).catch(() => setMode("error")), []);

  const loadClient = useCallback((id: string) =>
    fetch(`/api/salon-simple?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (res) => {
      if (res.status === 404) { setCurrentId(null); setS(null); return; }
      if (!res.ok) return fail(res.status);
      setS((await res.json()).simple);
    }).catch(() => setMode("error")), []);

  useEffect(() => {
    loadList().then(() => { if (currentId) loadClient(currentId); });
    // التحميل الأول فقط — بعده التنقّل يتحكم فيه open/back
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** يحفظ أي تعديل معلّق فوراً (قبل التنقّل بين العميلات). */
  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    setSaving(true);
    const res = await fetch(`/api/salon-simple?id=${encodeURIComponent(p.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: p.value }) }).catch(() => null);
    setSaving(false);
    if (!res?.ok) notify("تعذّر الحفظ — تأكد من الاتصال", true);
  }, [notify]);

  const set = (v: Simple) => {
    if (!currentId) return;
    setS(v);
    pending.current = { id: currentId, value: v };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  const setUrl = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", id); else url.searchParams.delete("c");
    window.history.replaceState(null, "", url.toString());
  };

  const open = async (id: string) => {
    await flush();
    setS(null);
    setCurrentId(id);
    setUrl(id);
    window.scrollTo({ top: 0 });
    loadClient(id);
  };
  const back = async () => {
    await flush();
    setCurrentId(null);
    setS(null);
    setUrl(null);
    loadList();
  };
  const create = async (name: string) => {
    const res = await fetch("/api/salon-simple", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    if (!res?.ok) { notify((await res?.json().catch(() => null))?.error ?? "تعذّر الإضافة", true); return; }
    const { id, simple } = await res.json();
    setCurrentId(id);
    setS(simple);
    setUrl(id);
    window.scrollTo({ top: 0 });
  };
  const remove = async (c: ClientSummary) => {
    if (!confirm(`حذف «${c.name || "عميلة بدون اسم"}» وكل خطتها؟ ما ينفع التراجع.`)) return;
    const res = await fetch(`/api/salon-simple?id=${encodeURIComponent(c.id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { notify("تعذّر الحذف", true); return; }
    setClients((l) => l.filter((x) => x.id !== c.id));
    notify("حُذفت العميلة");
  };

  const copy = async (text: string, msg = "تم النسخ") => {
    try { await navigator.clipboard.writeText(text); notify(msg); } catch { notify("تعذّر النسخ", true); }
  };
  const toggleTheme = () => {
    const next = theme === "brand" ? "night" : "brand";
    setTheme(next);
    try { localStorage.setItem("sg-theme", next); } catch { /* ignore */ }
  };

  const inClient = mode === "live" && currentId;

  return (
    <div dir="rtl" className="min-h-screen w-full overflow-x-hidden bg-[var(--bg)] text-[var(--body)]"
      style={{ ...THEMES[theme], colorScheme: theme === "night" ? "dark" : "light", fontFamily: "var(--font-tajawal), system-ui, sans-serif" } as React.CSSProperties}>
      <style>{`@keyframes sp-in { from { opacity: 0; } to { opacity: 1; } } .sp-in { animation: sp-in .3s ease-out; }`}</style>
      <header className="sticky inset-x-0 top-0 z-40 border-b border-[var(--line)] bg-[var(--glass)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          {inClient ? (
            <button onClick={back} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-xs font-bold text-[var(--body)] hover:bg-[var(--hover)]">
              <ArrowRight size={15} /> <span className="hidden sm:inline">كل العميلات</span>
            </button>
          ) : <BackToPlatform compact />}
          <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--on-acc)] sm:grid" style={accGrad}><Zap size={18} /></span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-black text-[var(--ink)]">{inClient && s?.name ? s.name : "الخطة المبسطة للصالونات"}</div>
            <div className="hidden text-[11px] text-[var(--faint)] sm:block">{inClient ? "الخطة المبسطة للصالونات" : "الصالونات والخدمات المنزلية"}</div>
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            {inClient && (
              <span className="flex items-center gap-1 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--muted)]">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} className="text-emerald-600" />} {saving ? "يحفظ" : "محفوظة"}
              </span>
            )}
            <button onClick={toggleTheme} title="المظهر" aria-label="المظهر" className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--hover)]">
              {theme === "brand" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>
      </header>

      {mode === "loading" || (inClient && !s) ? (
        <div className="grid min-h-[60vh] place-items-center text-[var(--muted)]"><Loader2 className="animate-spin" size={28} /></div>
      ) : mode !== "live" ? (
        <div className="grid min-h-[60vh] place-items-center px-4">
          <div className="max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center">
            <ShieldX size={30} className="mx-auto text-[var(--faint)]" />
            <div className="mt-3 text-lg font-black text-[var(--ink)]">
              {mode === "login" ? "سجّل دخولك للمنصة أولاً" : mode === "denied" ? "الصفحة خاصة" : "تعذّر التحميل"}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {mode === "login" ? "افتح المنصة وسجّل الدخول، وبعدها ارجع للصفحة." : mode === "denied" ? "هذي الصفحة غير متاحة لحسابك." : "تأكد من الاتصال وحدّث الصفحة."}
            </p>
          </div>
        </div>
      ) : inClient && s ? (
        <main className="sp-in mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
          <SimplePlan key={currentId} s={s} set={set} salonName={s.name} setSalonName={(v) => set({ ...s, name: v })} copy={copy} />
        </main>
      ) : (
        <ClientList clients={clients} onOpen={open} onCreate={create} onRemove={remove} />
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-bold shadow-2xl ${toast.error ? "bg-red-600 text-white" : "text-[var(--on-acc)]"}`} style={toast.error ? {} : accGrad}>
          {toast.error ? <X size={14} className="me-1 inline" /> : <Check size={14} className="me-1 inline" />} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── قائمة العميلات ──────────────────────────── */

function ClientList({ clients, onOpen, onCreate, onRemove }: {
  clients: ClientSummary[]; onOpen: (id: string) => void; onCreate: (name: string) => Promise<void>; onRemove: (c: ClientSummary) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const list = clients.filter((c) => !q.trim() || c.name.includes(q.trim()));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); await onCreate(name.trim()); setBusy(false);
  };
  return (
    <main className="sp-in mx-auto max-w-5xl px-4 pb-24 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-black text-[var(--ink)]"><Users size={22} className="text-[var(--acc)]" /> العميلات</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">لكل عميلة جلستها وتوصياتها وخطتها الشهرية — {fmt(clients.length)} عميلة.</p>
        </div>
        {clients.length > 3 && (
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم" className={`${input} ps-8`} />
          </div>
        )}
      </div>

      <form onSubmit={submit} className={`${card} mt-4 flex flex-col gap-2 p-4 sm:flex-row`}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميلة أو الصالون الجديد" className={input} aria-label="اسم العميلة الجديدة" maxLength={60} />
        <button disabled={busy || !name.trim()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-[var(--on-acc)] disabled:opacity-40" style={accGrad}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} عميلة جديدة
        </button>
      </form>

      {clients.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-dashed border-[var(--line-strong)] p-8 text-center text-sm text-[var(--muted)]">ما فيه عميلات بعد — أضيفي أول عميلة وابدئي جلستها.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((c) => {
            const m = modelOf(c.model);
            const Icon = c.model ? MODEL_ICON[c.model] : Users;
            const goal = GOALS.find((g) => g.id === c.goal)?.label;
            const pct = c.month_total ? c.month_done / c.month_total : 0;
            return (
              <li key={c.id} className={`${card} relative p-4`}>
                <button onClick={() => onOpen(c.id)} className="flex w-full items-start gap-3 text-right">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><Icon size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-black text-[var(--ink)]">{c.name || "عميلة بدون اسم"}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">{[m?.label, goal ? `الهدف: ${goal}` : null].filter(Boolean).join(" · ") || "ما بدأت الجلسة"}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      {c.session_done
                        ? <span className="rounded-full px-2 py-0.5" style={{ color: "#16A34A", background: "color-mix(in srgb, #16A34A 10%, transparent)" }}>الجلسة تمّت</span>
                        : <span className="rounded-full px-2 py-0.5" style={{ color: "#D9A21B", background: "color-mix(in srgb, #D9A21B 12%, transparent)" }}>الجلسة ما اكتملت</span>}
                      {c.month && <span className="text-[var(--muted)]">{monthLabel(c.month)} · {fmt(c.month_done)}/{fmt(c.month_total)}</span>}
                    </span>
                    {c.month_total > 0 && <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: "#16A34A" }} /></span>}
                  </span>
                </button>
                <button onClick={() => onRemove(c)} className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[var(--faint)] hover:bg-[var(--hover)] hover:text-red-600" aria-label={`حذف ${c.name}`} title="حذف">
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
