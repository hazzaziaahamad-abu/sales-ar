"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOrgId, markMentionNotificationsRead, resolveClientProfileTarget } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { isSupportSalesMerged } from "@/lib/sales-merge";
import type { MentionNotification } from "@/types";

/** مدراء يبقى لهم البانر أعلى الصفحة مثل باقي الفريق */
const KEEP_MENTION_BANNER = ["منال"];

/** المدير يشوف منشناته من قسم «منشناتي» بالقائمة الجانبية بدل البانر أعلى الصفحة */
export function isMentionsManager(user: { name?: string; isSuperAdmin?: boolean; roleName?: string } | null | undefined): boolean {
  if (!user) return false;
  if (KEEP_MENTION_BANNER.some((n) => user.name?.includes(n))) return false;
  return !!user.isSuperAdmin || user.roleName === "مدير" || user.roleName === "admin";
}

/** يُطلق بعد تعليم منشن كمقروء عشان عدّاد القائمة الجانبية يتحدّث فوراً */
export const MENTIONS_UPDATED_EVENT = "mentions-updated";

const MENTION_SECTION_PATH: Record<string, string> = {
  deal: "/sales",
  ticket: "/support",
  renewal: "/renewals",
};

export type MentionTarget = { entityType: string; entityId?: string; entityName?: string; noteId?: string | null };

/** صلاحيات المستخدم لاختيار الصفحة — null/undefined = سوبر أدمن (كل الصفحات) */
type PageAccess = { isSuperAdmin?: boolean; allowedPages?: string[] } | null | undefined;

// يفتح ملخص العميل بجواله (من السجل نفسه) بدل الاسم — الاسم ممكن يكون عام أو رمز مثل «*».
// صفقة «مبيعات الدعم» تفتح صفحة مبيعات الدعم وتبرز الصفقة نفسها، بدل صفحة المكتب اللي ما فيها الصفقة.
export async function buildMentionUrl(t: MentionTarget, access?: PageAccess): Promise<string> {
  const type = t.entityType;
  let base = MENTION_SECTION_PATH[type] || "/sales";
  const params = new URLSearchParams();
  if (t.entityId && (type === "deal" || type === "renewal" || type === "ticket")) {
    const { query, salesType } = await resolveClientProfileTarget(type, t.entityId, t.entityName);
    if (query) params.set("profile", query);
    if (type === "deal") {
      const canOpenSupportSales = !access || access.isSuperAdmin || !!access.allowedPages?.includes("support-sales");
      if (salesType === "support" && !isSupportSalesMerged(getOrgId()) && canOpenSupportSales) base = "/support-sales";
      params.set("deal", t.entityId);
    }
  } else if (t.entityName) {
    params.set("profile", t.entityName);
  }
  if (t.noteId) params.set("noteId", t.noteId);
  // ختم وقت عشان الضغط على نفس المنشن مرة ثانية يعيد فتح الملخص (الرابط يتغيّر)
  params.set("t", String(Date.now()));
  return `${base}?${params.toString()}`;
}

export function MentionAlertBanner({ mentions, onRefresh, fullList = false }: { mentions: MentionNotification[]; onRefresh: () => void; fullList?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  if (mentions.length === 0) return null;

  const unreadCount = mentions.filter((m) => !m.is_read && !markedIds.has(m.id)).length;

  const markRead = (ids: string[]) => {
    markMentionNotificationsRead(ids)
      .then(() => window.dispatchEvent(new Event(MENTIONS_UPDATED_EVENT)))
      .catch(console.error);
    setMarkedIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
  };

  return (
    <div className="mb-4 rounded-[14px] border border-amber-500/30 bg-gradient-to-l from-amber-500/[0.08] to-amber-500/[0.02] overflow-hidden animate-in slide-in-from-top-2 duration-300">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center relative shrink-0">
            <span className="text-lg">@</span>
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
              {mentions.length}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              منشناتك ({mentions.length})
              {unreadCount > 0 && <span className="text-amber-400 mr-2">— {unreadCount} جديد</span>}
            </p>
            <p className="text-[12px] text-muted-foreground">موظفين أشاروا إليك في سجل المتابعة</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => {
              const unreadIds = mentions.filter((m) => !m.is_read && !markedIds.has(m.id)).map((m) => m.id);
              markRead(unreadIds);
              onRefresh();
            }}
            className="text-[12px] px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0"
          >
            تم القراءة ✓
          </button>
        )}
      </div>
      <div className={`divide-y divide-border/20 ${fullList ? "" : "max-h-[420px] overflow-y-auto"}`}>
        {mentions.map((m) => {
          const isNew = !m.is_read && !markedIds.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() => {
                if (isNew) markRead([m.id]);
                buildMentionUrl(
                  { entityType: m.entity_type, entityId: m.entity_id, entityName: m.entity_name, noteId: m.note_id },
                  user,
                ).then((url) => router.push(url));
              }}
              className={`w-full text-right px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors ${isNew ? "" : "opacity-50"}`}
            >
              <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${isNew ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-muted/10 border-border/30 text-muted-foreground"}`}>
                {m.author_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">
                  <span className={`font-bold ${isNew ? "text-amber-400" : "text-muted-foreground"}`}>{m.author_name}</span>
                  {" أشار إليك في "}
                  <span className="font-semibold">{m.entity_name}</span>
                </p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{m.note_text.slice(0, 80)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {isNew && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold animate-pulse">جديد</span>
                )}
                <span className="text-[11px] text-muted-foreground/60">
                  {(() => {
                    const diff = Date.now() - new Date(m.created_at).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 60) return `${mins}د`;
                    const hrs = Math.floor(mins / 60);
                    if (hrs < 24) return `${hrs}س`;
                    return `${Math.floor(hrs / 24)}ي`;
                  })()}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

