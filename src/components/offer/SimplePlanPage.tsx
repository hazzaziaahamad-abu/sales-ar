"use client";

// صفحة «الخطة المبسطة للصالونات» المستقلة — للسوبر أدمن فقط (يتحقق منها /api/salon-simple).

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Cloud, Loader2, Moon, ShieldX, Sun, X, Zap } from "lucide-react";
import SimplePlan from "@/components/offer/SimplePlan";
import BackToPlatform from "@/components/offer/BackToPlatform";
import { DEFAULT_SIMPLE, type Simple } from "@/lib/salon-simple";
import { THEMES, type ThemeKey } from "@/components/salon-room/ui";

type Mode = "loading" | "live" | "login" | "denied" | "error";
const accGrad = { background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" };
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
  const [s, setS] = useState<Simple>(DEFAULT_SIMPLE);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 3500 : 2200);
  }, []);

  useEffect(() => {
    fetch("/api/salon-simple", { cache: "no-store" }).then(async (res) => {
      if (res.status === 401) return setMode("login");
      if (res.status === 403) return setMode("denied");
      if (!res.ok) return setMode("error");
      const json = await res.json();
      setS(json.simple);
      setMode("live");
    }).catch(() => setMode("error"));
  }, []);

  const set = (v: Simple) => {
    setS(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      const res = await fetch("/api/salon-simple", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: v }) }).catch(() => null);
      setSaving(false);
      if (!res?.ok) notify("تعذّر الحفظ — تأكد من الاتصال", true);
    }, 600);
  };

  const copy = async (text: string, msg = "تم النسخ") => {
    try { await navigator.clipboard.writeText(text); notify(msg); } catch { notify("تعذّر النسخ", true); }
  };
  const toggleTheme = () => {
    const next = theme === "brand" ? "night" : "brand";
    setTheme(next);
    try { localStorage.setItem("sg-theme", next); } catch { /* ignore */ }
  };

  return (
    <div dir="rtl" className="min-h-screen w-full overflow-x-hidden bg-[var(--bg)] text-[var(--body)]"
      style={{ ...THEMES[theme], colorScheme: theme === "night" ? "dark" : "light", fontFamily: "var(--font-tajawal), system-ui, sans-serif" } as React.CSSProperties}>
      <style>{`@keyframes sp-in { from { opacity: 0; } to { opacity: 1; } } .sp-in { animation: sp-in .3s ease-out; }`}</style>
      <header className="sticky inset-x-0 top-0 z-40 border-b border-[var(--line)] bg-[var(--glass)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <BackToPlatform compact />
          <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--on-acc)] sm:grid" style={accGrad}><Zap size={18} /></span>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-black text-[var(--ink)]">الخطة المبسطة للصالونات</div>
            <div className="hidden text-[11px] text-[var(--faint)] sm:block">الصالونات والخدمات المنزلية</div>
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            {mode === "live" && (
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

      {mode === "loading" ? (
        <div className="grid min-h-[60vh] place-items-center text-[var(--muted)]"><Loader2 className="animate-spin" size={28} /></div>
      ) : mode !== "live" ? (
        <div className="grid min-h-[60vh] place-items-center px-4">
          <div className="max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center">
            <ShieldX size={30} className="mx-auto text-[var(--faint)]" />
            <div className="mt-3 text-lg font-black text-[var(--ink)]">
              {mode === "login" ? "سجّل دخولك للمنصة أولاً" : mode === "denied" ? "الصفحة خاصة" : "تعذّر التحميل"}
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {mode === "login" ? "افتح المنصة وسجّل الدخول، وبعدها ارجع للصفحة." : mode === "denied" ? "هذي الصفحة متاحة لمدير النظام فقط." : "تأكد من الاتصال وحدّث الصفحة."}
            </p>
          </div>
        </div>
      ) : (
        <main className="sp-in mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
          <SimplePlan s={s} set={set} salonName={s.name} setSalonName={(v) => set({ ...s, name: v })} copy={copy} />
        </main>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-bold shadow-2xl ${toast.error ? "bg-red-600 text-white" : "text-[var(--on-acc)]"}`} style={toast.error ? {} : accGrad}>
          {toast.error ? <X size={14} className="me-1 inline" /> : <Check size={14} className="me-1 inline" />} {toast.msg}
        </div>
      )}
    </div>
  );
}
