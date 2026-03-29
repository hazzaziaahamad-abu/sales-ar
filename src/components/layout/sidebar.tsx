"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  RefreshCw,
  Heart,
  Headphones,
  Code,
  Handshake,
  Users,
  Banknote,
  X,
  Shield,
  LogOut,
  ChevronDown,
  Upload,
  ClipboardList,
  BookOpen,
  Megaphone,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { countPendingDeals } from "@/lib/supabase/db";

const NAV_ITEMS = [
  { label: "نظرة عامة", href: "/dashboard", slug: "dashboard", icon: LayoutDashboard, color: "cyan" },
  { label: "قائمة الطلبات", href: "/requests", slug: "requests", icon: Inbox, color: "violet" },
  { label: "مبيعات المكتب", href: "/sales", slug: "sales", icon: TrendingUp, color: "emerald" },
  { label: "مبيعات الدعم", href: "/support-sales", slug: "support-sales", icon: TrendingUp, color: "orange" },
  { label: "دليل المبيعات", href: "/sales-guide", slug: "sales-guide", icon: BookOpen, color: "amber" },
  { label: "الاجتماع الأسبوعي", href: "/weekly", slug: "weekly", icon: ClipboardList, color: "violet" },
  { label: "التجديدات", href: "/renewals", slug: "renewals", icon: RefreshCw, color: "sky" },
  { label: "رضا العملاء", href: "/satisfaction", slug: "satisfaction", icon: Heart, color: "rose" },
  { label: "الدعم", href: "/support", slug: "support", icon: Headphones, color: "orange" },
  { label: "التطويرات", href: "/development", slug: "development", icon: Code, color: "indigo" },
  { label: "الشراكات", href: "/partnerships", slug: "partnerships", icon: Handshake, color: "teal" },
  { label: "المسوقين", href: "/marketers", slug: "marketers", icon: Megaphone, color: "pink" },
  { label: "الفريق", href: "/team", slug: "team", icon: Users, color: "blue" },
  { label: "المالية", href: "/finance", slug: "finance", icon: Banknote, color: "lime" },
  { label: "رفع الملفات", href: "/upload", slug: "upload", icon: Upload, color: "slate" },
  { label: "إدارة المستخدمين", href: "/users", slug: "users", icon: Shield, color: "red" },
];

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; gradFrom: string; border: string; shadow: string; bar: string }> = {
  cyan:    { bg: "bg-cyan-500/15",    text: "text-cyan-400",    ring: "ring-cyan-500/20",    gradFrom: "from-cyan-500/[0.12]",    border: "border-cyan-500/[0.15]",    shadow: "shadow-[0_0_20px_rgba(0,212,255,0.08)]",   bar: "from-cyan-400 via-cyan-400 to-cyan-600" },
  emerald: { bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "ring-emerald-500/20", gradFrom: "from-emerald-500/[0.12]", border: "border-emerald-500/[0.15]", shadow: "shadow-[0_0_20px_rgba(16,185,129,0.08)]",  bar: "from-emerald-400 via-emerald-400 to-emerald-600" },
  amber:   { bg: "bg-amber-500/15",   text: "text-amber-400",   ring: "ring-amber-500/20",   gradFrom: "from-amber-500/[0.12]",   border: "border-amber-500/[0.15]",   shadow: "shadow-[0_0_20px_rgba(245,158,11,0.08)]",  bar: "from-amber-400 via-amber-400 to-amber-600" },
  violet:  { bg: "bg-violet-500/15",  text: "text-violet-400",  ring: "ring-violet-500/20",  gradFrom: "from-violet-500/[0.12]",  border: "border-violet-500/[0.15]",  shadow: "shadow-[0_0_20px_rgba(139,92,246,0.08)]",  bar: "from-violet-400 via-violet-400 to-violet-600" },
  sky:     { bg: "bg-sky-500/15",     text: "text-sky-400",     ring: "ring-sky-500/20",     gradFrom: "from-sky-500/[0.12]",     border: "border-sky-500/[0.15]",     shadow: "shadow-[0_0_20px_rgba(14,165,233,0.08)]",  bar: "from-sky-400 via-sky-400 to-sky-600" },
  rose:    { bg: "bg-rose-500/15",    text: "text-rose-400",    ring: "ring-rose-500/20",    gradFrom: "from-rose-500/[0.12]",    border: "border-rose-500/[0.15]",    shadow: "shadow-[0_0_20px_rgba(244,63,94,0.08)]",   bar: "from-rose-400 via-rose-400 to-rose-600" },
  orange:  { bg: "bg-orange-500/15",  text: "text-orange-400",  ring: "ring-orange-500/20",  gradFrom: "from-orange-500/[0.12]",  border: "border-orange-500/[0.15]",  shadow: "shadow-[0_0_20px_rgba(249,115,22,0.08)]",  bar: "from-orange-400 via-orange-400 to-orange-600" },
  indigo:  { bg: "bg-indigo-500/15",  text: "text-indigo-400",  ring: "ring-indigo-500/20",  gradFrom: "from-indigo-500/[0.12]",  border: "border-indigo-500/[0.15]",  shadow: "shadow-[0_0_20px_rgba(99,102,241,0.08)]",  bar: "from-indigo-400 via-indigo-400 to-indigo-600" },
  teal:    { bg: "bg-teal-500/15",    text: "text-teal-400",    ring: "ring-teal-500/20",    gradFrom: "from-teal-500/[0.12]",    border: "border-teal-500/[0.15]",    shadow: "shadow-[0_0_20px_rgba(20,184,166,0.08)]",  bar: "from-teal-400 via-teal-400 to-teal-600" },
  pink:    { bg: "bg-pink-500/15",    text: "text-pink-400",    ring: "ring-pink-500/20",    gradFrom: "from-pink-500/[0.12]",    border: "border-pink-500/[0.15]",    shadow: "shadow-[0_0_20px_rgba(236,72,153,0.08)]",  bar: "from-pink-400 via-pink-400 to-pink-600" },
  blue:    { bg: "bg-blue-500/15",    text: "text-blue-400",    ring: "ring-blue-500/20",    gradFrom: "from-blue-500/[0.12]",    border: "border-blue-500/[0.15]",    shadow: "shadow-[0_0_20px_rgba(59,130,246,0.08)]",  bar: "from-blue-400 via-blue-400 to-blue-600" },
  lime:    { bg: "bg-lime-500/15",    text: "text-lime-400",    ring: "ring-lime-500/20",    gradFrom: "from-lime-500/[0.12]",    border: "border-lime-500/[0.15]",    shadow: "shadow-[0_0_20px_rgba(132,204,22,0.08)]",  bar: "from-lime-400 via-lime-400 to-lime-600" },
  slate:   { bg: "bg-slate-500/15",   text: "text-slate-400",   ring: "ring-slate-500/20",   gradFrom: "from-slate-500/[0.12]",   border: "border-slate-500/[0.15]",   shadow: "shadow-[0_0_20px_rgba(100,116,139,0.08)]", bar: "from-slate-400 via-slate-400 to-slate-600" },
  red:     { bg: "bg-red-500/15",     text: "text-red-400",     ring: "ring-red-500/20",     gradFrom: "from-red-500/[0.12]",     border: "border-red-500/[0.15]",     shadow: "shadow-[0_0_20px_rgba(239,68,68,0.08)]",   bar: "from-red-400 via-red-400 to-red-600" },
};

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, loading, signOut, activeOrgId, switchOrg, orgs } = useAuth();
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    countPendingDeals().then(setPendingCount).catch(() => {});
    const id = setInterval(() => { countPendingDeals().then(setPendingCount).catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, [activeOrgId]);

  const isSuperAdmin = user?.isSuperAdmin ?? false;

  // Filter nav items by user permissions
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (isSuperAdmin) return true;
    return user?.allowedPages.includes(item.slug);
  });

  // Find active org info
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  return (
    <>
      {/* Backdrop for mobile/tablet */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-3 right-3 bottom-3 z-50 w-[244px] overflow-hidden rounded-[28px] glass-surface border-l-0 flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          open ? "translate-x-0" : "translate-x-[260px] lg:translate-x-0"
        )}
      >
        {/* Logo + close button on mobile */}
        <div className="px-5 pt-5 pb-4 border-b border-white/6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-cyan/30 to-cc-purple/30 ring-1 ring-white/10 shrink-0">
              <span className="text-sm font-extrabold tracking-[0.2em] text-cyan">CC</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-[1.05rem] font-extrabold text-foreground">لوحة التحكم</h1>
              <p className="mt-1 text-[11px] text-muted-foreground">مركز متابعة حي للمبيعات والتشغيل</p>
            </div>
            {/* Close button — only on mobile/tablet */}
            <button
              onClick={onClose}
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Org switcher — super admin only */}
          {isSuperAdmin && orgs.length > 0 ? (
            <div className="mt-3 relative">
              <button
                onClick={() => setOrgMenuOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/6 px-3 py-2 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-dim flex items-center justify-center text-cyan text-xs font-bold ring-1 ring-cyan/20 shrink-0">
                  {activeOrg?.nameAr?.[0] || "O"}
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{activeOrg?.nameAr || "المنظمة"}</p>
                  <p className="text-[10px] text-muted-foreground">{activeOrg?.name || ""}</p>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", orgMenuOpen && "rotate-180")} />
              </button>

              {orgMenuOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-[#111827] border border-white/10 shadow-lg overflow-hidden z-50">
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        switchOrg(o.id);
                        setOrgMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.06] transition-colors",
                        o.id === activeOrgId && "bg-white/[0.04]"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ring-1 shrink-0",
                        o.id === activeOrgId
                          ? "bg-cyan-dim text-cyan ring-cyan/20"
                          : "bg-white/[0.06] text-muted-foreground ring-white/10"
                      )}>
                        {o.nameAr?.[0] || "O"}
                      </div>
                      <div className="flex-1 text-right min-w-0">
                        <p className={cn("text-xs font-semibold truncate", o.id === activeOrgId ? "text-foreground" : "text-muted-foreground")}>{o.nameAr}</p>
                        <p className="text-[10px] text-muted-foreground">{o.name}</p>
                      </div>
                      {o.id === activeOrgId && (
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Static org badge for non-super-admin */
            !loading && user && (
              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.04] border border-white/6 px-3 py-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-dim flex items-center justify-center text-cyan text-xs font-bold ring-1 ring-cyan/20 shrink-0">
                  {activeOrg?.nameAr?.[0] || "O"}
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{activeOrg?.nameAr || "المنظمة"}</p>
                  <p className="text-[10px] text-muted-foreground">{activeOrg?.name || ""}</p>
                </div>
              </div>
            )
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            const c = COLOR_MAP[item.color] || COLOR_MAP.cyan;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 text-[13px] transition-all duration-200",
                  isActive
                    ? `bg-gradient-to-l ${c.gradFrom} to-transparent text-foreground font-semibold border ${c.border} ${c.shadow}`
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground border border-transparent"
                )}
              >
                {isActive && (
                  <span className={cn("absolute inset-y-2 right-0.5 w-[3px] rounded-full bg-gradient-to-b", c.bar)} />
                )}
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                    isActive ? `${c.bg} ${c.text} ring-1 ${c.ring}` : `bg-white/[0.03] ${c.text}/60 group-hover:${c.text} group-hover:bg-white/[0.06]`
                  )}
                >
                  <Icon className="w-[17px] h-[17px]" />
                </span>
                <span className="flex-1">{item.label}</span>
                {item.slug === "requests" && pendingCount > 0 && (
                  <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="m-3 mt-0 rounded-2xl border border-white/6 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">الحالة التشغيلية</span>
            <span className="rounded-full bg-green-dim px-2 py-0.5 text-cc-green">مباشر</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-cyan-dim flex items-center justify-center text-cyan text-xs font-bold ring-1 ring-cyan/20">
              {user?.name?.[0] || "م"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name || "..."}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.roleName || ""}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
