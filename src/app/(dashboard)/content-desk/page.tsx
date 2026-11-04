"use client";

import ContentDesk from "@/components/content-desk/ContentDesk";

/** «مكتب المحتوى» — خطة نشر أخصائي المحتوى (شهر/أسبوع/يوم) + حالة الواتساب اليومية + أهداف الشهر. */
export default function ContentDeskPage() {
  return (
    <div className="mx-auto max-w-6xl pb-16">
      <ContentDesk />
    </div>
  );
}
