"use client";

// زر «رجوع للمنصة» للصفحات المستقلة (بدون القائمة الجانبية).
// المنصة مثبّتة كتطبيق (PWA بدون شريط متصفح) والروابط تفتح في نفس النافذة — بدون هالزر ما فيه طريق للرجوع.

import { ArrowRight } from "lucide-react";

export function leavePage(fallback = "/") {
  // نافذة/تبويب فُتح من المنصة → نقفله؛ وإلا نرجع للصفحة السابقة؛ وإلا للرئيسية
  if (window.opener && !window.opener.closed) {
    window.close();
    return;
  }
  if (window.history.length > 1 && document.referrer && new URL(document.referrer).origin === window.location.origin) {
    window.history.back();
    return;
  }
  window.location.href = fallback;
}

export default function BackToPlatform({ label = "رجوع للمنصة", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <button
      onClick={() => leavePage()}
      title={label}
      aria-label={label}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] text-xs font-bold text-[var(--body)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] ${compact ? "h-9 w-9 justify-center" : "h-9 px-3"}`}
    >
      <ArrowRight size={16} />
      {!compact && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
