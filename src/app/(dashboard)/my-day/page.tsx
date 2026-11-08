"use client";

// «يومي» — صفحة الموظف الواحدة: نتيجة يومه مباشرة + تذاكره + طابور مهام اليوم من كل أقسامه.
// الموظف يفتح عليها مباشرة؛ المدير يُحوَّل لـ«المتابعة اليومية» لو جا من الصفحة الرئيسية.
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useHuddleManagers } from "@/lib/huddle-managers";
import { memberOf } from "@/lib/huddle-kpis";
import { DailyTasksBar } from "@/components/daily-tasks/daily-tasks-bar";
import { MyResults } from "@/components/my-day/my-results";
import { MyTickets } from "@/components/my-day/my-tickets";
import { DayRhythm } from "@/components/my-day/day-rhythm";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, ListTodo, CalendarCheck } from "lucide-react";

export default function MyDayPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
      <MyDay />
    </Suspense>
  );
}

function greeting(): string {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "numeric", hour12: false }));
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء النور";
  return "مساء الخير";
}

function MyDay() {
  const { user, activeOrgId } = useAuth();
  const { isManager, loaded } = useHuddleManagers();
  const router = useRouter();
  const fromRoot = useSearchParams().get("from") === "root";
  const [noDepts, setNoDepts] = useState(false);
  const onNotInDepartments = useCallback(() => setNoDepts(true), []);

  // المدير يفتح على «المتابعة اليومية» كالعادة
  useEffect(() => {
    if (fromRoot && loaded && isManager) router.replace("/daily-huddle");
  }, [fromRoot, loaded, isManager, router]);

  if (!user) return null;
  if (fromRoot && (!loaded || isManager)) return <Skeleton className="h-72 rounded-2xl" />;

  const firstName = user.name.trim().split(/\s+/)[0];
  const member = memberOf(user.name);
  const today = new Date().toLocaleDateString("ar-SA", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-3xl space-y-4" key={activeOrgId}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
          <Sun className="h-5 w-5 text-amber-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground">{greeting()} {firstName}</h1>
          <p className="text-xs text-muted-foreground">{today} · كل شغلك اليوم في مكان واحد</p>
        </div>
      </div>

      <DayRhythm />

      {member && <MyResults member={member} />}

      <MyTickets agentName={user.name} />

      <DailyTasksBar pinned onNotInDepartments={onNotInDepartments} />
      {noDepts && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-muted-foreground">
          ما عندك قسم في «مهام اليوم» بعد — اطلب من المدير يضيفك من «مركز مهام اليوم» عشان تطلع لك قائمة عملائك هنا.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href="/my-tasks" className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ListTodo className="h-4 w-4" /> مهام كلّفني فيها المدير
        </Link>
        <Link href="/daily-huddle" className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <CalendarCheck className="h-4 w-4" /> الفريق اليوم
        </Link>
      </div>
    </div>
  );
}
