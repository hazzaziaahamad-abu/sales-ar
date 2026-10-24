"use client";

import { useState } from "react";
import { Presentation, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * زر «خطة اجتماع» على الصفقة: ينشئ (أو يرجّع) رابط عرض مربوط بالصفقة والموظف،
 * يفتحه في تبويب جديد وينسخه — وبعدها نقيس التحويل من مرحلة الصفقة.
 */
export default function MeetingPlanButton({ dealId }: { dealId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const open = async () => {
    // نفتح التبويب فوراً (قبل await) عشان ما يحجبه المتصفح
    const win = window.open("about:blank", "_blank");
    setState("loading");
    try {
      const r = await fetch("/api/client-meetings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deal_id: dealId }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) throw new Error(j.error || "تعذّر إنشاء الرابط");
      const full = `${window.location.origin}${j.url}`;
      if (win) win.location.href = full;
      else window.open(full, "_blank");
      try { await navigator.clipboard.writeText(full); } catch { /* ignore */ }
      setState("done");
      setTimeout(() => setState("idle"), 2000);
    } catch (e) {
      win?.close();
      setState("idle");
      alert(e instanceof Error ? e.message : "تعذّر إنشاء الرابط");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={open}
      disabled={state === "loading"}
      title="خطة اجتماع العميل (يفتح العرض وينسخ الرابط)"
      className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10"
    >
      {state === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : state === "done" ? <Check className="w-3.5 h-3.5" /> : <Presentation className="w-3.5 h-3.5" />}
    </Button>
  );
}
