"use client";

// بدل شريط «مهام اليوم» داخل صفحات الأقسام: الطابور صار في «يومي» (يجمع كل أقسام الموظف + تذاكره).
import Link from "next/link";
import { useHuddleManagers } from "@/lib/huddle-managers";
import { Sun, ChevronLeft } from "lucide-react";

export function MyDayLink() {
  const { isManager, loaded } = useHuddleManagers();
  if (!loaded || isManager) return null;
  return (
    <Link
      href="/my-day"
      className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm font-bold text-foreground hover:bg-amber-500/10"
    >
      <span className="flex items-center gap-2">
        <Sun className="h-4 w-4 text-amber-400" /> مهام اليوم ونتيجتك صارت في «يومي»
      </span>
      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
