"use client";

import { useRouter } from "next/navigation";
import type { AppNotification } from "@/types";
import { Button } from "@/components/ui/button";
import { X, CheckCheck } from "lucide-react";
import { markSingleMentionRead } from "@/lib/supabase/db";

interface NotificationPanelProps {
  notifications: AppNotification[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onMarkOneRead?: (id: string) => void;
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

const SECTION_PATH: Record<string, string> = {
  support: "/support",
  "support-sales": "/support-sales",
  development: "/development",
  team: "/team",
  sales: "/sales",
  "sales-guide": "/sales-guide",
  partnerships: "/partnerships",
  renewals: "/renewals",
  satisfaction: "/satisfaction",
  "my-tasks": "/my-tasks",
};

export function NotificationPanel({
  notifications,
  onClose,
  onMarkAllRead,
  onClearAll,
  onMarkOneRead,
}: NotificationPanelProps) {
  const router = useRouter();
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function handleNotifClick(n: AppNotification) {
    // Mark as read in UI
    onMarkOneRead?.(n.id);

    // If it's a mention, mark in DB + navigate with noteId
    if (n.type === "mention" && n.metadata?.mentionNotifId) {
      markSingleMentionRead(n.metadata.mentionNotifId).catch(console.error);
      const base = SECTION_PATH[n.section] || "/sales";
      const params = new URLSearchParams();
      if (n.metadata.entityName) params.set("profile", n.metadata.entityName);
      if (n.metadata.noteId) params.set("noteId", n.metadata.noteId);
      router.push(`${base}?${params.toString()}`);
    } else {
      const path = SECTION_PATH[n.section];
      if (path) router.push(path);
    }
    onClose();
  }

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 z-40 sm:hidden"
        onClick={onClose}
      />

      <div className="fixed z-50 top-16 left-3 right-3 sm:left-auto sm:right-auto sm:start-6 w-auto sm:w-96 max-h-[70vh] bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-in slide-in-from-top-2 fade-in-0 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">الإشعارات</h3>
            {unreadCount > 0 && (
              <span className="bg-cc-red text-white text-[12px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground" onClick={onMarkAllRead}>
              <CheckCheck className="w-3.5 h-3.5" />
              قراء الكل
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              لا توجد إشعارات
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotifClick(n)}
                className={`w-full text-right px-4 py-3 border-b border-border/50 hover:bg-white/[0.05] transition-colors ${
                  !n.isRead ? (n.type === "mention" ? "bg-amber-500/[0.04]" : "bg-cyan/[0.03]") : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5 shrink-0">{n.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${n.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                      {n.message}
                    </p>
                    <p className="text-[12px] text-muted-foreground/70 mt-1">
                      {timeAgo(n.timestamp)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.type === "mention" ? "bg-amber-400" : "bg-cyan"}`} />
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={onClearAll}>
              مسح الكل
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
