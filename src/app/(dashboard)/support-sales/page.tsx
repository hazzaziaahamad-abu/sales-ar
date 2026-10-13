"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// «مبيعات الدعم» اندمجت مع «المبيعات» — نحوّل الروابط القديمة (مع ?deal=...) للصفحة الموحدة
export default function SupportSalesPage() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const qs = params.toString();
    router.replace(`/sales${qs ? `?${qs}` : ""}`);
  }, [router, params]);
  return null;
}
