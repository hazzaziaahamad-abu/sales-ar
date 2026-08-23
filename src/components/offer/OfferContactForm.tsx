"use client";

import { useState, type FormEvent } from "react";
import { Check, Send, Loader2 } from "lucide-react";

export default function OfferContactForm({
  page,
  accent,
  accentDeep,
  title = "ودّك أحد يشرح لك أكثر؟",
  subtitle = "عبّي بياناتك ويتواصل معك فريقنا ويجاوب أسئلتك.",
}: {
  page: string;
  accent: string;
  accentDeep: string;
  title?: string;
  subtitle?: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() && !phone.trim()) return;
    setSaving(true);
    let ref: string | null = null;
    try {
      ref = new URLSearchParams(window.location.search).get("ref");
    } catch { /* ignore */ }
    try {
      await fetch("/api/offer/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "lead", page, ref, name, phone, businessType }),
      });
      setDone(true);
    } catch {
      setDone(true); // لا نكسر تجربة العميل
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-3xl p-6 sm:p-8" style={{ backgroundColor: "#fff", border: "1px solid #ece1d3", boxShadow: "0 18px 40px -24px rgba(64,51,43,.4)" }}>
        {done ? (
          <div className="py-6 text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ backgroundColor: "#25D366" }}>
              <Check size={28} strokeWidth={3} />
            </span>
            <h3 className="text-xl font-black" style={{ color: accentDeep }}>وصلنا طلبك ✅</h3>
            <p className="mt-2 text-sm" style={{ color: "#6f6156" }}>بنتواصل معك قريباً. شكراً لك!</p>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-black" style={{ color: accentDeep }}>{title}</h3>
            <p className="mt-1 mb-5 text-sm" style={{ color: "#8a7c70" }}>{subtitle}</p>
            <form onSubmit={submit} className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: "#fbfaf5", border: "1px solid #e6dccd", color: "#2b2620" }}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="رقم الجوال"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: "#fbfaf5", border: "1px solid #e6dccd", color: "#2b2620" }}
              />
              <input
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="نوع النشاط (مطعم، كوفي، صالون…)"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: "#fbfaf5", border: "1px solid #e6dccd", color: "#2b2620" }}
              />
              <button
                type="submit"
                disabled={saving || (!name.trim() && !phone.trim())}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
                أرسل بياناتي
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
