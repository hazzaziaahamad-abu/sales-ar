"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, FolderOpen, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import ContentDesk from "@/components/content-desk/ContentDesk";
import ContentBank from "@/components/content-desk/ContentBank";
import Competitors from "@/components/content-desk/Competitors";

const TABS = [
  { key: "plan", label: "خطة النشر", icon: CalendarDays },
  { key: "bank", label: "بنك المحتوى", icon: FolderOpen },
  { key: "competitors", label: "المنافسين", icon: Users },
] as const;
type Tab = (typeof TABS)[number]["key"];

/**
 * «مكتب المحتوى» — ثلاث صفحات بتبويبات فوق:
 *  خطة النشر (شهر/أسبوع/يوم + الواتساب + الأهداف) · بنك المحتوى (ملفات + نتائجها) · المنافسين (سحب يومي).
 */
function DeskTabs() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = sp.get("tab");
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : "plan";

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-16" dir="rtl">
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1" aria-label="أقسام مكتب المحتوى">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} aria-current={tab === key ? "page" : undefined}
            onClick={() => router.replace(key === "plan" ? pathname : `${pathname}?tab=${key}`, { scroll: false })}
            className={cn("flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-colors",
              tab === key ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground")}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>
      {tab === "plan" && <ContentDesk />}
      {tab === "bank" && <ContentBank />}
      {tab === "competitors" && <Competitors />}
    </div>
  );
}

export default function ContentDeskPage() {
  return <Suspense><DeskTabs /></Suspense>;
}
