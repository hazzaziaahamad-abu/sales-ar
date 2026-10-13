"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SalesSection } from "@/components/sales/SalesSection";
import { useAuth } from "@/lib/auth-context";
import { isSupportSalesMerged } from "@/lib/sales-merge";

export default function SupportSalesPage() {
  const { activeOrgId } = useAuth();
  const merged = isSupportSalesMerged(activeOrgId);
  const router = useRouter();
  const params = useSearchParams();

  // نحجز: «مبيعات الدعم» اندمجت مع «المبيعات» — نحوّل الروابط القديمة (مع ?deal=...) للصفحة الموحدة
  useEffect(() => {
    if (!merged) return;
    const qs = params.toString();
    router.replace(`/sales${qs ? `?${qs}` : ""}`);
  }, [merged, router, params]);

  if (merged) return null;
  return <SalesSection salesType="support" />;
}
