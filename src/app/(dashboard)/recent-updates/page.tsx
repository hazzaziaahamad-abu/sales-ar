"use client";

import { RecentUpdatesView } from "@/components/recent-updates/recent-updates-view";

// «التحديثات» و«سجل التتبع» انتقلا إلى تبويب «نشاط الفريق» في صفحة المتابعة اليومية.
export default function RecentUpdatesPage() {
  return (
    <RecentUpdatesView
      tabs={["academy"]}
      title="سجل الأكاديمية"
      subtitle="جلسات التدريب في الأكاديمية — التحديثات وسجل التتبع انتقلت إلى «المتابعة اليومية»"
    />
  );
}
