"use client";

import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { phoneFormats } from "@/lib/daily-tasks/shared";

/** نسخ الرقم: ضغطة = الصيغة الدولية (966…)، ضغطة مطوّلة = المحلية (05…). */
export function CopyPhone({ phone, className = "" }: { phone?: string | null; className?: string }) {
  const f = phoneFormats(phone);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const long = useRef(false);
  if (!f) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* المتصفح يرفض — الرقم ظاهر للنسخ يدوياً */ }
      ta.remove();
    }
    setCopied(text);
    setTimeout(() => setCopied(null), 1400);
  };

  const down = () => {
    long.current = false;
    timer.current = setTimeout(() => { long.current = true; copy(f.local); }, 550);
  };
  const up = () => {
    if (timer.current) clearTimeout(timer.current);
    if (!long.current) copy(f.intl);
  };
  const cancel = () => { if (timer.current) clearTimeout(timer.current); };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span dir="ltr" className="font-mono text-xs text-foreground select-all">{f.intl}</span>
      <button
        type="button"
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(f.intl); } }}
        title="نسخ (ضغطة مطوّلة: 05…)"
        className="inline-flex items-center gap-1 rounded-md bg-cyan-dim px-1.5 py-0.5 text-[11px] font-semibold text-cyan select-none"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? (copied === f.local ? "نُسخ 05…" : "تم النسخ") : "نسخ"}
      </button>
    </span>
  );
}
