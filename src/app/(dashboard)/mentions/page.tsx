"use client";

import { useEffect, useState } from "react";
import { AtSign } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { fetchMentionNotifications } from "@/lib/supabase/db";
import { Skeleton } from "@/components/ui/skeleton";
import { MentionAlertBanner } from "@/components/mentions/mention-alert-banner";
import type { MentionNotification } from "@/types";

/** «منشناتي» — كل المنشنات (آخر 50) في مكان واحد بدل البانر أعلى الصفحة */
export default function MentionsPage() {
  const { user, activeOrgId } = useAuth();
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.name) return;
    let alive = true;
    fetchMentionNotifications(user.name)
      .then((m) => { if (alive) setMentions(m); })
      .catch(console.error)
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.name, activeOrgId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[14px] bg-amber-500/15 text-amber-400 flex items-center justify-center">
          <AtSign className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-foreground">منشناتي</h1>
          <p className="text-xs text-muted-foreground">كل من أشار إليك في سجل المتابعة</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : mentions.length === 0 ? (
        <div className="rounded-[14px] border border-border p-8 text-center text-sm text-muted-foreground">
          ما فيه منشنات لك حالياً
        </div>
      ) : (
        <MentionAlertBanner key={mentions[0]?.id} mentions={mentions} onRefresh={() => {}} fullList />
      )}
    </div>
  );
}
