"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TopbarProvider } from "@/components/layout/topbar-context";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { AIChatFAB } from "@/components/ai/ai-chat-fab";
import { AIAlertsBanner } from "@/components/ai/ai-alerts-banner";
import { LastSaleBanner } from "@/components/layout/last-sale-banner";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { SaleCelebration } from "@/components/layout/sale-celebration";
import { WelcomePopup } from "@/components/layout/welcome-popup";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { OrgProvider } from "@/lib/org-context";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDeals, fetchSalesTargets, fetchSalesActivities, fetchTickets, fetchRenewals, fetchEmployeeTasks, fetchMentionNotifications, markMentionNotificationsRead, markSingleMentionRead, fetchRecentFollowUpNotes, fetchDueReminders, dismissReminder } from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";
import type { Reminder } from "@/lib/supabase/db";
import type { AppNotification, MentionNotification, Deal, Ticket, Renewal, EmployeeTask } from "@/types";
import { CCThemeProvider } from "@/lib/theme-context";
import { saudiDateStr } from "@/lib/utils/format";
import { PageTracker } from "@/components/layout/page-tracker";

const PAGE_SLUG_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/sales": "sales",
  "/renewals": "renewals",
  "/satisfaction": "satisfaction",
  "/support": "support",
  "/development": "development",
  "/partnerships": "partnerships",
  "/team": "team",
  "/finance": "finance",
  "/upload": "upload",
  "/agent": "agent",
  "/users": "users",
  "/operations": "operations",
  "/weekly": "weekly",
  "/academy": "academy",
  "/secretary": "secretary",
  "/competitors": "competitors",
  "/governance": "governance",
  "/analytics": "analytics",
  "/marketing-plans": "marketing-plans",
  "/whatsapp": "whatsapp",
  "/discipline": "discipline",
};

function MentionNotifLoader({ onLoad, onMentions }: { onLoad: (n: AppNotification[]) => void; onMentions: (m: MentionNotification[]) => void }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const buildAppNotifs = useCallback((mentions: MentionNotification[]): AppNotification[] => {
    return mentions.filter((m) => !m.is_read).map((m) => ({
      id: `mention-${m.id}`,
      type: "mention" as const,
      icon: "💬",
      message: `${m.author_name} أشار إليك في "${m.entity_name}": ${m.note_text.slice(0, 70)}${m.note_text.length > 70 ? "..." : ""}`,
      section: m.entity_type === "deal" ? "sales" : m.entity_type === "ticket" ? "support" : "renewals",
      timestamp: m.created_at,
      isRead: false,
      metadata: {
        entityId: m.entity_id,
        entityType: m.entity_type,
        noteId: m.note_id,
        entityName: m.entity_name,
        mentionNotifId: m.id,
      },
    }));
  }, []);

  const loadMentions = useCallback(() => {
    if (!user?.name) return;
    fetchMentionNotifications(user.name).then((mentions) => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recent = mentions.filter((m) => new Date(m.created_at).getTime() > oneDayAgo);
      onMentions(recent);
      const notifs = buildAppNotifs(recent);
      if (notifs.length > 0) onLoad(notifs);
    }).catch(console.error);
  }, [user?.name, onLoad, onMentions, buildAppNotifs]);

  // Poll: page load, navigation, every 60s, window focus
  useEffect(() => { loadMentions(); }, [loadMentions, pathname]);
  useEffect(() => {
    const onFocus = () => loadMentions();
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => { if (!document.hidden) loadMentions(); }, 60000);
    return () => { window.removeEventListener("focus", onFocus); clearInterval(interval); };
  }, [loadMentions]);

  // Supabase Realtime — instant mention notifications
  useEffect(() => {
    if (!user?.name) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`mention-notifs-${user.name}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mention_notifications",
          filter: `mentioned_name=eq.${user.name}`,
        },
        (payload) => {
          const m = payload.new as MentionNotification;
          // Re-fetch to keep list consistent (simpler than managing prev state across closure)
          if (user?.name) fetchMentionNotifications(user.name).then(onMentions).catch(console.error);
          const notif: AppNotification = {
            id: `mention-${m.id}`,
            type: "mention",
            icon: "💬",
            message: `${m.author_name} أشار إليك في "${m.entity_name}": ${m.note_text.slice(0, 70)}${m.note_text.length > 70 ? "..." : ""}`,
            section: m.entity_type === "deal" ? "sales" : m.entity_type === "ticket" ? "support" : "renewals",
            timestamp: m.created_at,
            isRead: false,
            metadata: {
              entityId: m.entity_id,
              entityType: m.entity_type,
              noteId: m.note_id,
              entityName: m.entity_name,
              mentionNotifId: m.id,
            },
          };
          onLoad([notif]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.name, onLoad, onMentions]);

  return null;
}

const MENTION_SECTION_PATH: Record<string, string> = {
  deal: "/sales",
  ticket: "/support",
  renewal: "/renewals",
};

function buildMentionUrl(m: MentionNotification): string {
  const base = MENTION_SECTION_PATH[m.entity_type] || "/sales";
  const params = new URLSearchParams();
  if (m.entity_name) params.set("profile", m.entity_name);
  if (m.note_id) params.set("noteId", m.note_id);
  return `${base}?${params.toString()}`;
}

function MentionAlertBanner({ mentions, onRefresh }: { mentions: MentionNotification[]; onRefresh: () => void }) {
  const router = useRouter();
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());

  if (mentions.length === 0) return null;

  const unreadCount = mentions.filter((m) => !m.is_read && !markedIds.has(m.id)).length;

  const markRead = (ids: string[]) => {
    markMentionNotificationsRead(ids).catch(console.error);
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
              منشنات آخر 24 ساعة ({mentions.length})
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
      <div className="divide-y divide-border/20 max-h-[240px] overflow-y-auto">
        {mentions.slice(0, 12).map((m) => {
          const isNew = !m.is_read && !markedIds.has(m.id);
          return (
            <button
              key={m.id}
              onClick={() => {
                if (isNew) markRead([m.id]);
                router.push(buildMentionUrl(m));
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
      {mentions.length > 12 && (
        <div className="px-4 py-2 text-center border-t border-border/20">
          <span className="text-[12px] text-muted-foreground">و {mentions.length - 12} منشن آخر...</span>
        </div>
      )}
    </div>
  );
}

function BrowserNotifBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("notif-perm-dismissed")) return;
    // Small delay so it doesn't pop immediately on page load
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  const request = async () => {
    setShow(false);
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      localStorage.setItem("notif-perm-dismissed", "1");
    }
  };

  const dismiss = () => {
    localStorage.setItem("notif-perm-dismissed", "1");
    setShow(false);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-black/40 p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan/10 flex items-center justify-center shrink-0 text-lg">
            🔔
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">تفعيل إشعارات المتصفح</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              احصل على إشعارات فورية للمنشنات والمهام حتى لو كنت في تبويب آخر
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={request}
                className="flex-1 py-1.5 rounded-lg bg-cyan text-black text-xs font-bold hover:bg-cyan/90 transition-colors"
              >
                تفعيل
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs hover:bg-muted/10 transition-colors"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Redirect if user doesn't have access to current page
  useEffect(() => {
    if (!loading && user && !user.isSuperAdmin) {
      const slug = PAGE_SLUG_MAP[pathname] || pathname.split("/")[1];
      if (slug && !user.allowedPages.includes(slug)) {
        const firstAllowed = user.allowedPages[0] || "dashboard";
        router.replace(`/${firstAllowed}`);
      }
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md px-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


async function generateLiveNotifications(): Promise<AppNotification[]> {
  const now = new Date().toISOString();
  const notifications: AppNotification[] = [];

  try {
    const [deals, targets, activities, tickets, renewals] = await Promise.allSettled([
      fetchDeals(),
      fetchSalesTargets(),
      fetchSalesActivities(),
      fetchTickets(),
      fetchRenewals(),
    ]);

    // Renewals due within 7 days
    if (renewals.status === "fulfilled") {
      const todayMs = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      renewals.value
        .filter((r) => {
          if (r.status === "مكتمل" || r.status === "ملغي بسبب") return false;
          const renewalMs = new Date(r.renewal_date).getTime();
          return renewalMs >= todayMs && renewalMs <= todayMs + sevenDaysMs;
        })
        .slice(0, 8)
        .forEach((r) => {
          const daysLeft = Math.ceil((new Date(r.renewal_date).getTime() - todayMs) / (1000 * 60 * 60 * 24));
          const urgent = daysLeft <= 2;
          notifications.push({
            id: `renewal-due-${r.id}`,
            type: "urgent_ticket",
            icon: urgent ? "⚠️" : "🔄",
            message: `تجديد "${r.customer_name}" — ${r.plan_name} — بعد ${daysLeft} يوم${urgent ? " (عاجل)" : ""}`,
            section: "renewals",
            timestamp: now,
            isRead: false,
            metadata: { entityId: r.id, entityName: r.customer_name, entityType: "renewal" },
          });
        });
    }

    // Unsolved urgent tickets from DB
    if (tickets.status === "fulfilled") {
      tickets.value
        .filter((t) => t.priority === "عاجل" && t.status !== "محلول")
        .forEach((t) => {
          notifications.push({
            id: `live-ticket-${t.id}`,
            type: "urgent_ticket",
            icon: "🚨",
            message: `تذكرة عاجلة لم تُغلق: "${t.issue}" من ${t.client_name}`,
            section: "support",
            timestamp: now,
            isRead: false,
          });
        });

      // Open tickets older than 3 days
      tickets.value
        .filter((t) => {
          if (t.status === "محلول") return false;
          const created = new Date(t.created_at);
          const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
          return diffDays > 3;
        })
        .forEach((t) => {
          notifications.push({
            id: `live-old-ticket-${t.id}`,
            type: "urgent_ticket",
            icon: "⚠️",
            message: `تذكرة مفتوحة منذ أكثر من 3 أيام: "${t.issue}"`,
            section: "support",
            timestamp: now,
            isRead: false,
          });
        });
    }

    // Stale deals (stuck in pipeline > 14 days)
    if (deals.status === "fulfilled") {
      deals.value
        .filter((d) => {
          if (d.stage === "مكتملة" || d.stage === "مرفوض مع سبب") return false;
          return d.cycle_days > 14;
        })
        .slice(0, 5)
        .forEach((d) => {
          notifications.push({
            id: `live-stale-deal-${d.id}`,
            type: "urgent_ticket",
            icon: "⏳",
            message: `صفقة راكدة: "${d.client_name}" — ${d.cycle_days} يوم في مرحلة ${d.stage}`,
            section: "sales",
            timestamp: now,
            isRead: false,
          });
        });

      // High-value deals awaiting payment
      deals.value
        .filter((d) => d.stage === "انتظار الدفع" && d.deal_value >= 30000)
        .forEach((d) => {
          notifications.push({
            id: `live-payment-${d.id}`,
            type: "urgent_ticket",
            icon: "💰",
            message: `صفقة بانتظار الدفع: "${d.client_name}" — ${d.deal_value.toLocaleString()} ر.س`,
            section: "sales",
            timestamp: now,
            isRead: false,
          });
        });
    }

    // Recent follow-up notes (last 24 hours)
    try {
      const recentNotes = await fetchRecentFollowUpNotes(30);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      recentNotes
        .filter((n) => new Date(n.created_at).getTime() > oneDayAgo)
        .forEach((n) => {
          const entityLabel = n.entity_type === "deal" ? "صفقة" : n.entity_type === "ticket" ? "تذكرة" : "تجديد";
          const entityName = n.entity_name || "";
          notifications.push({
            id: `followup-${n.id}`,
            type: "crud_action",
            icon: "📝",
            message: `${n.author_name} أضاف متابعة على ${entityLabel} "${entityName}": ${n.note.slice(0, 60)}${n.note.length > 60 ? "..." : ""}`,
            section: n.entity_type === "deal" ? "sales" : n.entity_type === "ticket" ? "support" : "renewals",
            timestamp: n.created_at,
            isRead: false,
          });
        });
    } catch {
      // Silently fail
    }

    // Unmet daily targets
    if (targets.status === "fulfilled" && activities.status === "fulfilled") {
      const todayStr = saudiDateStr();
      const todayActivities = activities.value.filter((a) => a.activity_date === todayStr);

      const dailyTargets = targets.value.filter((t) => t.period_type === "daily");
      dailyTargets.forEach((t) => {
        let actual = 0;
        if (t.target_key === "calls") {
          actual = todayActivities.filter((a) => a.activity_type === "call").length;
        } else if (t.target_key === "followups") {
          actual = todayActivities.filter((a) => a.activity_type === "followup").length;
        }
        if (actual < t.min_value && t.min_value > 0) {
          notifications.push({
            id: `live-target-${t.id}`,
            type: "urgent_ticket",
            icon: "🎯",
            message: `هدف لم يتحقق: ${t.label_ar || t.target_key} — ${actual}/${t.min_value} (الحد الأدنى)`,
            section: "sales-guide",
            timestamp: now,
            isRead: false,
          });
        }
      });
    }
  } catch {
    // Silently fail — demo notifications will still show
  }

  return notifications;
}

/* ─── Live Realtime Notifications (tasks / tickets / deals) ─────────────────── */
function LiveNotifSubscriptions({ onLoad }: { onLoad: (n: AppNotification[]) => void }) {
  const { user } = useAuth();

  /* On mount: show pending tasks assigned to me */
  useEffect(() => {
    if (!user?.id) return;
    fetchEmployeeTasks({ assigned_to: user.id })
      .then((tasks) => {
        const pending = tasks.filter(
          (t) => t.status === "pending" || t.status === "in_progress"
        );
        if (pending.length === 0) return;
        const notifs: AppNotification[] = pending.slice(0, 5).map((t) => ({
          id: `task-pending-${t.id}`,
          type: "crud_action" as const,
          icon: t.priority === "urgent" || t.priority === "high" ? "🔴" : "📋",
          message: `مهمة ${t.priority === "urgent" ? "عاجلة" : t.priority === "high" ? "بأولوية عالية" : "مُسندة"}: "${t.title}"${t.due_date ? ` — الموعد: ${t.due_date}` : ""}`,
          section: "my-tasks",
          timestamp: t.created_at,
          isRead: false,
          metadata: { entityId: t.id },
        }));
        onLoad(notifs);
      })
      .catch(console.error);
  }, [user?.id, onLoad]);

  /* Realtime subscriptions */
  useEffect(() => {
    if (!user?.id || !user?.name) return;
    const supabase = createClient();

    /* 1. Task assigned to me (INSERT) */
    const taskCh = supabase
      .channel(`live-task-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "employee_tasks", filter: `assigned_to=eq.${user.id}` },
        (payload) => {
          const t = payload.new as EmployeeTask;
          onLoad([{
            id: `task-new-${t.id}`,
            type: "crud_action",
            icon: t.priority === "urgent" ? "🔴" : "📋",
            message: `${t.assigned_by_name || "مدير"} أسند إليك مهمة${t.priority === "urgent" ? " عاجلة" : ""}: "${t.title}"${t.due_date ? ` — الموعد: ${t.due_date}` : ""}`,
            section: "my-tasks",
            timestamp: t.created_at,
            isRead: false,
            metadata: { entityId: t.id },
          }]);
        }
      )
      .subscribe();

    /* 2. Ticket assigned to me (INSERT or reassignment UPDATE) */
    const ticketCh = supabase
      .channel(`live-ticket-${user.name}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets", filter: `assigned_agent_name=eq.${user.name}` },
        (payload) => {
          const t = payload.new as Ticket;
          onLoad([{
            id: `ticket-new-${t.id}`,
            type: "urgent_ticket",
            icon: t.priority === "عاجل" ? "🚨" : "🎫",
            message: `تذكرة${t.priority === "عاجل" ? " عاجلة" : ""} أُسندت إليك: "${t.issue}" — ${t.client_name}`,
            section: "support",
            timestamp: t.created_at,
            isRead: false,
            metadata: { entityId: t.id },
          }]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets", filter: `assigned_agent_name=eq.${user.name}` },
        (payload) => {
          const oldAgent = (payload.old as Partial<Ticket>)?.assigned_agent_name;
          if (oldAgent === user.name) return; // wasn't a reassignment
          const t = payload.new as Ticket;
          onLoad([{
            id: `ticket-reassigned-${t.id}-${Date.now()}`,
            type: "urgent_ticket",
            icon: "🎫",
            message: `تذكرة أُعيد إسنادها إليك: "${t.issue}" — ${t.client_name}`,
            section: "support",
            timestamp: new Date().toISOString(),
            isRead: false,
            metadata: { entityId: t.id },
          }]);
        }
      )
      .subscribe();

    /* 3. My deal changes stage (UPDATE) */
    const dealCh = supabase
      .channel(`live-deal-stage-${user.name}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "deals", filter: `assigned_rep_name=eq.${user.name}` },
        (payload) => {
          const oldStage = (payload.old as Partial<Deal>)?.stage;
          const d = payload.new as Deal;
          if (!oldStage || oldStage === d.stage) return;
          const closed = d.stage === "مكتملة";
          onLoad([{
            id: `deal-stage-${d.id}-${d.stage}`,
            type: "crud_action",
            icon: closed ? "🏆" : "📊",
            message: closed
              ? `🎉 صفقة "${d.client_name}" أُغلقت بقيمة ${d.deal_value.toLocaleString()} ر.س`
              : `صفقة "${d.client_name}" انتقلت إلى مرحلة "${d.stage}"`,
            section: d.sales_type === "support" ? "support-sales" : "sales",
            timestamp: new Date().toISOString(),
            isRead: false,
            metadata: { entityId: d.id, entityName: d.client_name },
          }]);
        }
      )
      .subscribe();

    /* 4. New deal assigned to me (INSERT) */
    const dealNewCh = supabase
      .channel(`live-deal-new-${user.name}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "deals", filter: `assigned_rep_name=eq.${user.name}` },
        (payload) => {
          const d = payload.new as Deal;
          onLoad([{
            id: `deal-new-${d.id}`,
            type: "crud_action",
            icon: "💼",
            message: `صفقة جديدة أُسندت إليك: "${d.client_name}"${d.plan ? ` — ${d.plan}` : ""}`,
            section: d.sales_type === "support" ? "support-sales" : "sales",
            timestamp: d.created_at,
            isRead: false,
            metadata: { entityId: d.id, entityName: d.client_name },
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskCh);
      supabase.removeChannel(ticketCh);
      supabase.removeChannel(dealCh);
      supabase.removeChannel(dealNewCh);
    };
  }, [user?.id, user?.name, onLoad]);

  return null;
}

function RemindersBanner({ reminders, onDismiss }: { reminders: Reminder[]; onDismiss: (id: string) => void }) {
  if (reminders.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      {reminders.map((rem) => (
        <div
          key={rem.id}
          className="flex items-center gap-3 px-4 py-3 rounded-[14px] border border-cc-purple/40 bg-gradient-to-l from-cc-purple/[0.10] to-cc-purple/[0.03] animate-in slide-in-from-top-2 duration-300"
        >
          <div className="w-8 h-8 rounded-xl bg-cc-purple/20 flex items-center justify-center shrink-0">
            <span className="text-base">🔔</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">
              تذكير: <span className="text-cc-purple">{rem.entity_name}</span>
            </p>
            {rem.note_text && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{rem.note_text}</p>
            )}
          </div>
          <button
            onClick={() => onDismiss(rem.id)}
            className="px-3 py-1.5 rounded-lg text-xs border border-cc-purple/30 text-cc-purple hover:bg-cc-purple/10 transition-colors shrink-0"
          >
            تم ✓
          </button>
        </div>
      ))}
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [recentMentions, setRecentMentions] = useState<MentionNotification[]>([]);
  const [dueReminders, setDueReminders] = useState<Reminder[]>([]);
  const shownBrowserNotifs = useRef<Set<string>>(new Set());

  // Load live notifications from DB
  useEffect(() => {
    generateLiveNotifications().then((live) => {
      if (live.length > 0) {
        setNotifications(live);
      }
    });
  }, []);

  // Poll for due reminders every 60s
  useEffect(() => {
    const check = () => {
      fetchDueReminders().then((r) => setDueReminders(r)).catch(() => {});
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  // Expose addNotifications for child components
  const addNotifications = useCallback((newNotifs: AppNotification[]) => {
    setNotifications((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const fresh = newNotifs.filter((n) => !existingIds.has(n.id));
      return [...fresh, ...prev];
    });

    // Fire browser notifications for new unread items
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      newNotifs
        .filter((n) => !n.isRead && !shownBrowserNotifs.current.has(n.id))
        .forEach((n) => {
          shownBrowserNotifs.current.add(n.id);
          try {
            const title = n.type === "mention" ? "منشن جديد 💬" : "إشعار جديد 🔔";
            new Notification(title, { body: n.message, icon: "/favicon.ico", dir: "rtl", lang: "ar" });
          } catch {
            // Browser may block — fail silently
          }
        });
    }
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const isAgentPage = pathname === "/agent";

  return (
    <CCThemeProvider>
    <OrgProvider>
    <AuthProvider>
    <TopbarProvider>
      <MentionNotifLoader onLoad={addNotifications} onMentions={setRecentMentions} />
      <LiveNotifSubscriptions onLoad={addNotifications} />
      <PageTracker />
      <SaleCelebration />
      <WelcomePopup />
      <div className="min-h-screen bg-background panel-grid">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Content area — has margin on lg+ for sidebar, full-width on mobile/tablet */}
        <div className="lg:mr-[276px] min-h-screen overflow-x-hidden">
          <ImpersonationBanner />
          <Topbar
            unreadCount={unreadCount}
            onBellClick={() => setNotifOpen((prev) => !prev)}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="px-4 sm:px-6 pb-8 pt-5">
            <AuthGate>
              <MentionAlertBanner mentions={recentMentions} onRefresh={() => {}} />
              <RemindersBanner reminders={dueReminders} onDismiss={(id) => {
                dismissReminder(id).catch(() => {});
                setDueReminders((prev) => prev.filter((r) => r.id !== id));
              }} />
              <LastSaleBanner />
              <AIAlertsBanner />
              {children}
            </AuthGate>
          </main>
        </div>

        {/* Notification Panel */}
        {notifOpen && (
          <NotificationPanel
            notifications={notifications}
            onClose={() => setNotifOpen(false)}
            onMarkAllRead={() => {
              // Mark all mention notifications as read in DB
              const mentionIds = notifications
                .filter((n) => n.type === "mention" && !n.isRead && n.metadata?.mentionNotifId)
                .map((n) => n.metadata!.mentionNotifId!);
              if (mentionIds.length > 0) markMentionNotificationsRead(mentionIds).catch(console.error);
              setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            }}
            onClearAll={() => {
              setNotifications([]);
              setNotifOpen(false);
            }}
            onMarkOneRead={(appId) =>
              setNotifications((prev) =>
                prev.map((n) => (n.id === appId ? { ...n, isRead: true } : n))
              )
            }
          />
        )}

        <BrowserNotifBanner />

        {/* AI Chat — hidden on agent page */}
        {!isAgentPage && (
          <AIChatFAB onClick={() => router.push("/agent")} />
        )}
      </div>
    </TopbarProvider>
    </AuthProvider>
    </OrgProvider>
    </CCThemeProvider>
  );
}
