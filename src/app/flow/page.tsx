import type { Metadata } from "next";
import ContactFlowView from "@/components/sales/ContactFlowView";

// رابط عام للموظفين (بدون تسجيل دخول) — عرض فقط.
export const metadata: Metadata = {
  title: "مسار الاتصال",
  robots: { index: false, follow: false },
};

export default function PublicContactFlowPage() {
  return <ContactFlowView publicMode />;
}
