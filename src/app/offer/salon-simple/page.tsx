import type { Metadata } from "next";
import SimplePlanPage from "@/components/offer/SimplePlanPage";

export const metadata: Metadata = {
  title: "الخطة المبسطة للصالونات",
  description: "خطة مبسطة للصالونات والخدمات المنزلية: نموذج العمل، التشخيص، التسعير من التكلفة، خطة ٩٠ يوم، والمؤشرات.",
  robots: { index: false, follow: false },
};

export default function SalonSimplePage() {
  return <SimplePlanPage />;
}
