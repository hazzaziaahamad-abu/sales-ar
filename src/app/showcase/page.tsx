import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import ShowcaseView from "@/components/showcase/ShowcaseView";

// صفحة عرض مستقلة (بدون الشريط الجانبي والنوافذ المنبثقة) يشاركها الموظف مع العميل في الاتصال.
export const metadata: Metadata = {
  title: "معرض شاشات MENU",
  robots: { index: false, follow: false },
};

export default function ShowcasePage() {
  return (
    <AuthProvider>
      <ShowcaseView />
    </AuthProvider>
  );
}
