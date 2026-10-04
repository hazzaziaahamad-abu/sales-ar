"use client";

import React, { useState } from "react";
import { Sparkles, Phone, MessageCircle, Copy, Check, Lightbulb, Loader2, RotateCcw } from "lucide-react";

/* ---------- brand tokens (مطابقة لمسار الاتصال) ---------- */
const INK = "#40332b";
const PURPLE = "#6D28D9";
const PURPLE_DEEP = "#5B21B6";

type Draft = { summary: string; call: string; wa: string; tip: string };

type Product = "menu" | "nahjez";

const EXAMPLES: Record<Product, string[]> = {
  menu: [
    "العميل عنده كوفي وحاب يعرف الفرق بين الذهبية و VIP",
    "يقول السعر غالي وعنده عرض من شركة ثانية",
    "يبي كاشير بس عنده أجهزة قديمة، يسأل إذا تشتغل",
  ],
  nahjez: [
    "صاحبة صالون تسأل وش الفرق بين الأساسية ونمو الأعمال",
    "تقول عميلاتي متعوّدات يحجزون بالواتساب",
    "تسأل كيف تشتغل بطاقات الهدايا وهل تستفيد منها",
  ],
};

const PLACEHOLDER: Record<Product, string> = {
  menu: "مثال: العميل عنده مطعمين ويبي منيو رقمي مع طلبات توصيل، ويسأل عن السعر…",
  nahjez: "مثال: صالون عنده ٤ موظفات ويعاني من غياب العميلات عن المواعيد، ويسأل عن العربون…",
};

/* ---------- مساعد الصياغة: الموظف يكتب طلب العميل والذكاء الاصطناعي يصيغ الرد ---------- */
export default function ContactAssistPanel({ id, product = "menu" }: { id?: string; product?: Product }) {
  const [request, setRequest] = useState("");
  const [rep, setRep] = useState("");
  const [client, setClient] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    if (request.trim().length < 3 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/contact-flow/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request, rep, client, product }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "تعذّرت الصياغة");
      setDraft(json as Draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت الصياغة");
    } finally {
      setLoading(false);
    }
  }

  function copy(key: string, text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const inputStyle = { backgroundColor: "#fff", border: "1px solid #e2d3c3", color: INK };

  return (
    <section
      id={id}
      dir="rtl"
      className="mx-auto mt-8 max-w-3xl scroll-mt-4 rounded-3xl p-5"
      style={{ backgroundColor: "#fffdf7", border: "1.5px solid #ead9c9", boxShadow: "0 12px 26px -16px rgba(64,51,43,.5)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: PURPLE }}>
          <Sparkles size={17} strokeWidth={2.3} />
        </span>
        <div>
          <h3 className="text-base font-black" style={{ color: PURPLE_DEEP }}>
            مساعد الصياغة — اكتب طلب العميل
          </h3>
          <p className="text-xs font-semibold" style={{ color: "#8a7c70" }}>
            {product === "nahjez"
              ? "اكتب وش طلبت العميلة أو وش قالت عن الحجوزات أو بطاقات الهدايا والولاء، ويصيغ لك سكربت المكالمة ورسالة الواتساب حسب مسار نحجز وباقاته."
              : "اكتب وش طلب العميل أو وش قال، ويصيغ لك سكربت المكالمة ورسالة الواتساب حسب المسار والأسعار المعتمدة."}
          </p>
        </div>
      </div>

      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate();
        }}
        rows={3}
        maxLength={2000}
        dir="rtl"
        placeholder={PLACEHOLDER[product]}
        className="mt-2 w-full rounded-xl px-3 py-2 text-right text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
        style={{ ...inputStyle, resize: "vertical" }}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES[product].map((ex) => (
          <button
            key={ex}
            onClick={() => setRequest(ex)}
            className="rounded-full px-2.5 py-1 text-[11px] font-bold outline-none transition hover:opacity-80"
            style={{ backgroundColor: "#EDE9FE", color: PURPLE_DEEP }}
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={rep}
          onChange={(e) => setRep(e.target.value)}
          maxLength={60}
          placeholder="اسمك (اختياري)"
          className="rounded-lg px-2.5 py-1.5 text-right text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
          style={inputStyle}
        />
        <input
          value={client}
          onChange={(e) => setClient(e.target.value)}
          maxLength={60}
          placeholder="اسم العميل (اختياري)"
          className="rounded-lg px-2.5 py-1.5 text-right text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
          style={inputStyle}
        />
        <button
          onClick={generate}
          disabled={loading || request.trim().length < 3}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-bold text-white outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-violet-300 disabled:opacity-50"
          style={{ backgroundColor: PURPLE }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : draft ? <RotateCcw size={15} /> : <Sparkles size={15} />}
          {loading ? "جارٍ الصياغة…" : draft ? "صياغة جديدة" : "صِغ الرد"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg px-3 py-1.5 text-right text-xs font-bold" style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
          {error}
        </div>
      )}

      {draft && (
        <div className="mt-4 space-y-3">
          {draft.summary && (
            <p className="rounded-xl px-3 py-2 text-right text-sm font-bold" style={{ backgroundColor: "#faf4ee", color: INK }}>
              🎯 {draft.summary}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { k: "call", t: "في المكالمة", icon: <Phone size={14} strokeWidth={2.4} />, text: draft.call },
              { k: "wa", t: "رسالة واتساب", icon: <MessageCircle size={14} strokeWidth={2.4} />, text: draft.wa },
            ].map((b) => (
              <div key={b.k} className="rounded-2xl p-3" style={{ backgroundColor: "#fff", border: "1px solid #efe2d5" }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-black" style={{ color: PURPLE_DEEP }}>
                    {b.icon} {b.t}
                  </span>
                  <button
                    onClick={() => copy(b.k, b.text)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold outline-none transition hover:opacity-80"
                    style={{ backgroundColor: copied === b.k ? "#DCFCE7" : "rgba(64,51,43,.08)", color: copied === b.k ? "#065F46" : INK }}
                  >
                    {copied === b.k ? <Check size={12} /> : <Copy size={12} />} {copied === b.k ? "تم النسخ" : "نسخ"}
                  </button>
                </div>
                <p className="whitespace-pre-line text-right text-sm font-semibold leading-relaxed" style={{ color: INK }}>
                  {b.text}
                </p>
              </div>
            ))}
          </div>
          {draft.tip && (
            <p className="flex items-start gap-1.5 rounded-xl px-3 py-2 text-right text-xs font-bold" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
              <Lightbulb size={14} className="mt-0.5 shrink-0" /> {draft.tip}
            </p>
          )}
          <p className="text-right text-[11px] font-semibold" style={{ color: "#a8998c" }}>
            راجع الرد قبل إرساله — المساعد يعتمد على محتوى المسار والأسئلة المعتمدة.
          </p>
        </div>
      )}
    </section>
  );
}
