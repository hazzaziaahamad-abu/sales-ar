"use client";

import { MessageCircle } from "lucide-react";

/* رقم واتساب المبيعات (صيغة دولية بدون + أو أصفار) */
export const WHATSAPP_NUMBER = "966591166861";

export function waLink(msg: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

// تسجيل نية الاهتمام عند الضغط (قبل الانتقال لواتساب) — بلا كسر الرابط
export function trackIntent(page: string, kind: string) {
  let ref: string | null = null;
  try { ref = new URLSearchParams(window.location.search).get("ref"); } catch { /* ignore */ }
  const payload = JSON.stringify({ type: "visit", kind, page, ref });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/offer/track", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch { /* fall through */ }
  fetch("/api/offer/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => { /* never break */ });
}

export function WhatsAppButton({
  page,
  msg,
  large = false,
  kind = "whatsapp",
}: {
  page: string;
  msg: string;
  large?: boolean;
  kind?: string;
}) {
  return (
    <a
      href={waLink(msg)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackIntent(page, kind)}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-extrabold text-white shadow-lg transition-transform hover:-translate-y-0.5 ${
        large ? "px-7 py-3.5 text-base" : "px-4 py-2 text-sm"
      }`}
      style={{ backgroundColor: "#25D366", boxShadow: "0 12px 26px -10px rgba(37,211,102,.6)" }}
    >
      <MessageCircle size={large ? 20 : 16} fill="#fff" stroke="#25D366" />
      تواصل معنا واتساب
    </a>
  );
}

export function SubscribeButton({
  page,
  msg,
  accent,
  filled = false,
}: {
  page: string;
  msg: string;
  accent: string;
  filled?: boolean;
}) {
  return (
    <a
      href={waLink(msg)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackIntent(page, "quote")}
      className="mt-5 inline-flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-extrabold text-white transition-transform hover:-translate-y-0.5"
      style={{ backgroundColor: filled ? accent : "#25D366" }}
    >
      <MessageCircle size={16} fill="#fff" stroke={filled ? accent : "#25D366"} />
      اطلب عرض · اشترك الآن
    </a>
  );
}
