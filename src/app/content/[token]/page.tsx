import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import ContentPlanEditor from "@/components/content-plans/ContentPlanEditor";

// رابط عام لخطة محتوى (بدون تسجيل دخول) — عرض فقط أو تعديل حسب إعداد المشاركة.
export const metadata: Metadata = {
  title: "خطة المحتوى",
  robots: { index: false, follow: false },
};

export default async function PublicContentPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div dir="rtl" className="min-h-screen w-full px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Clapperboard className="w-4 h-4 text-violet-400" />
          خطة المحتوى
        </header>
        <ContentPlanEditor apiBase={`/api/public/content-plan/${encodeURIComponent(token)}`} />
      </div>
    </div>
  );
}
