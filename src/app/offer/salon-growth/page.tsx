import type { Metadata } from "next";
import { Suspense } from "react";
import SalonGrowth from "@/components/offer/SalonGrowth";

export const metadata: Metadata = {
  title: "لوحة نمو الصالون — المبيعات والاحتفاظ",
  description: "لوحة تفاعلية لمالكات ومديرات الصالونات: مفاتيح النمو، جدول المواعيد والبيع الإضافي، رسائل واتساب الآلية، وتقارير الأداء.",
  robots: { index: false, follow: false },
};

export default function SalonGrowthPage() {
  return (
    <Suspense>
      <SalonGrowth />
    </Suspense>
  );
}
