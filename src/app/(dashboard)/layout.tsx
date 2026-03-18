"use client";

import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TopbarProvider } from "@/components/layout/topbar-context";
import { NotificationPanel } from "@/components/layout/notification-panel";
import { AIChatFAB } from "@/components/ai/ai-chat-fab";
import { AIAlertsBanner } from "@/components/ai/ai-alerts-banner";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_TICKETS, DEMO_PROJECTS, DEMO_PARTNERSHIPS } from "@/lib/demo-data";
import type { AppNotification } from "@/types";

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
};

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

function generateNotifications(): AppNotification[] {
  const now = new Date().toISOString();
  const notifications: AppNotification[] = [];

  // Urgent tickets
  DEMO_TICKETS.filter((t) => t.priority === "عاجل" && t.status !== "محلول").forEach((t) => {
    notifications.push({
      id: `notif-ticket-${t.id}`,
      type: "urgent_ticket",
      icon: "🚨",
      message: `تذكرة عاجلة: "${t.issue}" من ${t.client_name}`,
      section: "support",
      timestamp: now,
      isRead: false,
    });
  });

  // Overdue projects
  DEMO_PROJECTS.filter((p) => p.status_tag === "متأخر").forEach((p) => {
    notifications.push({
      id: `notif-project-${p.id}`,
      type: "overdue_project",
      icon: "⏰",
      message: `مشروع متأخر: "${p.name}" — تقدم ${p.progress}%`,
      section: "development",
      timestamp: now,
      isRead: false,
    });
  });

  // Near-complete projects (90%+)
  DEMO_PROJECTS.filter((p) => p.progress >= 85 && p.status_tag !== "متأخر").forEach((p) => {
    notifications.push({
      id: `notif-near-${p.id}`,
      type: "near_complete",
      icon: "🎯",
      message: `مشروع يقترب من الاكتمال: "${p.name}" — ${p.progress}%`,
      section: "development",
      timestamp: now,
      isRead: true,
    });
  });

  // Negotiating partnerships
  DEMO_PARTNERSHIPS.filter((p) => p.status === "قيد التفاوض").forEach((p) => {
    notifications.push({
      id: `notif-partner-${p.id}`,
      type: "negotiating",
      icon: "◇",
      message: `شراكة قيد التفاوض: ${p.name}`,
      section: "partnerships",
      timestamp: now,
      isRead: true,
    });
  });

  return notifications;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState("الكل");
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => generateNotifications());

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const isAgentPage = pathname === "/agent";

  return (
    <AuthProvider>
    <TopbarProvider>
      <div className="min-h-screen bg-background panel-grid">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Content area — has margin on lg+ for sidebar, full-width on mobile/tablet */}
        <div className="lg:mr-[260px] min-h-screen">
          <Topbar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            activeMonth={activeMonth}
            onMonthChange={setActiveMonth}
            unreadCount={unreadCount}
            onBellClick={() => setNotifOpen((prev) => !prev)}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="px-4 sm:px-6 pb-8 pt-5">
            <AuthGate>
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
            onMarkAllRead={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
            }
            onClearAll={() => {
              setNotifications([]);
              setNotifOpen(false);
            }}
          />
        )}

        {/* AI Chat — hidden on agent page */}
        {!isAgentPage && (
          <AIChatFAB onClick={() => router.push("/agent")} />
        )}
      </div>
    </TopbarProvider>
    </AuthProvider>
  );
}
