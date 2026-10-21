import type { Metadata } from "next";
import { Suspense } from "react";
import MeetingPlan from "@/components/offer/MeetingPlan";

export const metadata: Metadata = {
  title: "خطة الانطلاق — اجتماع العميل",
  description: "عرض تفاعلي لاجتماع العميل: النظام والأسعار، خطوات التفعيل، تجهيز الموقع والولاء والهدايا، تدريب الفريق، المتابعة، والنتائج المتوقعة.",
  robots: { index: false, follow: false },
};

export default function MeetingPage() {
  return (
    <Suspense>
      <MeetingPlan />
    </Suspense>
  );
}
