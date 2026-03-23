"use client";

import WeeklyMeetingView from "@/components/WeeklyMeetingView";

export default function WeeklyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-cyan-dim flex items-center justify-center">
          <span className="text-lg">📋</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">الاجتماع الأسبوعي</h1>
          <p className="text-xs text-muted-foreground">متابعة أداء الفريق والقرارات الأسبوعية</p>
        </div>
      </div>
      <WeeklyMeetingView />
    </div>
  );
}
