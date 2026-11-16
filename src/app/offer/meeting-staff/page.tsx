import type { Metadata } from "next";
import { Suspense } from "react";
import MeetingStaffGuide from "@/components/offer/MeetingStaffGuide";

export const metadata: Metadata = {
  title: "دليل الموظف — اجتماع العميل",
  description: "نسخة الموظف من خطة اجتماع العميل: كل باقة بمزاياها بالتفصيل — وش هي، وش يكسب العميل، وكيف تقولها — مع إشارات الترقية والاعتراضات.",
  robots: { index: false, follow: false },
};

export default function MeetingStaffPage() {
  return (
    <Suspense>
      <MeetingStaffGuide />
    </Suspense>
  );
}
