"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import ContentPlanEditor from "@/components/content-plans/ContentPlanEditor";

export default function ContentPlanPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/marketing-plans" className="hover:text-foreground transition-colors">الخطط التسويقية</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link href="/marketing-plans/content" className="hover:text-foreground transition-colors">التسويق بالمحتوى</Link>
      </div>
      <ContentPlanEditor apiBase={`/api/content-plans/${id}`} />
    </div>
  );
}
