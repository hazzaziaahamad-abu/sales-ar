"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Share } from "lucide-react";
import { disablePush, enablePush, pushState, refreshPushSubscription, type PushState } from "@/lib/push-client";

/**
 * تفعيل إشعارات الجوال (تذكير التخطيط المسائي، بداية الدوام، موعد الجلسة العميقة، Shutdown،
 * وانتهاء وقت التركيز) — توصل حتى لو التطبيق مقفل.
 */
export function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    pushState().then((s) => { if (alive) setState(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const run = async (fn: () => Promise<PushState>, okMsg?: string) => {
    setBusy(true);
    setMsg(null);
    try { const s = await fn(); setState(s); if (okMsg && s === "on") setMsg(okMsg); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    setMsg(res?.ok ? "انرسل إشعار تجربة ✓ — اقفل الجوال وشوفه" : (await res?.json().catch(() => ({})))?.error || "تعذّر الإرسال");
    setBusy(false);
  };

  if (!state || state === "unsupported") return null;

  if (state === "on") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground px-1">
        <span className="flex items-center gap-1 text-emerald-300 font-bold"><BellRing className="w-3.5 h-3.5" /> إشعارات الجوال مفعّلة</span>
        <button onClick={test} disabled={busy} className="font-bold hover:text-foreground">تجربة</button>
        <span>·</span>
        <button onClick={() => run(disablePush)} disabled={busy} className="font-bold hover:text-foreground">إيقاف</button>
        {msg && <span className="text-amber-300">{msg}</span>}
      </div>
    );
  }

  return (
    <section className="flex items-start gap-3 rounded-[18px] border border-cyan-400/25 bg-gradient-to-l from-cyan-500/[0.08] to-transparent p-3.5">
      <span className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-300 flex items-center justify-center shrink-0"><BellRing className="w-4 h-4" /></span>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-extrabold text-foreground">🔔 إشعارات الجوال</p>
        {state === "needs-install" ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            في الآيفون لازم تثبّت التطبيق أولاً: اضغط <Share className="w-3.5 h-3.5 inline" /> «مشاركة» ← «إضافة إلى الشاشة الرئيسية»،
            وافتحه من الأيقونة وارجع هنا وفعّل.
          </p>
        ) : state === "denied" ? (
          <p className="text-xs text-muted-foreground leading-relaxed">الإشعارات محظورة لهالموقع — فعّلها من إعدادات المتصفح/الجوال (الإشعارات) وارجع هنا.</p>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">توصلك التذكيرات حتى لو التطبيق مقفل: 🌙 اختر شرائح بكرة، ☀️ بداية الدوام، 🔥 موعد جلستك العميقة، 🔚 Shutdown، و⏰ انتهاء وقت التركيز.</p>
        )}
        {msg && <p className="text-xs text-amber-300">{msg}</p>}
      </div>
      {state === "off" && (
        <button onClick={() => run(enablePush, "تم التفعيل ✓")} disabled={busy}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-60">
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} تفعيل
        </button>
      )}
    </section>
  );
}

/** يسجّل الـService Worker ويجدد الاشتراك بصمت عند فتح التطبيق (لو الإذن ممنوح). */
export function PushRefresher() {
  useEffect(() => { refreshPushSubscription(); }, []);
  return null;
}
