"use client";

import { useState } from "react";
import { Clapperboard, ImageIcon, PenTool, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PackagePostsStudio } from "@/components/designer/PackagePostsStudio";
import { ReferenceDesignStudio } from "@/components/designer/ai/ReferenceDesignStudio";

/** «صفحة المصمم» — أدوات تصميم داخل المنصة. أول قسم: استوديو بوستات الباقات. */
export default function DesignerPage() {
  const [tab, setTab] = useState<"reference" | "posts" | "videos">("reference");
  const tabs = [
    { key: "reference", label: "صمّم من مرجع (ذكاء)", icon: Sparkles },
    { key: "posts", label: "استوديو بوستات الباقات", icon: ImageIcon },
    { key: "videos", label: "الفيديوهات", icon: Clapperboard, soon: true },
  ] as const;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-16" lang="ar" dir="rtl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
          <PenTool className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">صفحة المصمم</h1>
          <p className="text-xs text-muted-foreground">ارفع تصميم أعجبك ونطلع لك أفضل منه بهويتنا، أو عدّل بوستات الباقات — وصدّر PNG بالمقاس الحقيقي.</p>
        </div>
      </div>

      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-border bg-white/[0.04] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            disabled={"soon" in t && t.soon}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              tab === t.key ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {"soon" in t && t.soon && <span className="rounded-full bg-white/10 px-1.5 text-[10px]">قريباً</span>}
          </button>
        ))}
      </div>

      {tab === "reference" && <ReferenceDesignStudio />}
      {tab === "posts" && <PackagePostsStudio />}
    </div>
  );
}
