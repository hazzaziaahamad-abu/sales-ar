"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchDeals,
  fetchEmployees,
  fetchRenewals,
  fetchTickets,
} from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import type { Deal, Ticket, Employee, Renewal } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Thresholds (minutes) ───────────────────────────────────────────────────
const THRESHOLDS = {
  support: { warn: 30, bad: 120 }, // دعم
  sales: { warn: 60, bad: 180 }, // مبيعات / تجديدات
} as const;

// ─── Shift config ──────────────────────────────────────────────────────────
// الدعم + مبيعات الدعم: شفتين (صباحي 9-17 / مسائي 17-1)
// مبيعات المكتب: شفت واحد (9-17)
// التجديدات: مفتوح (بدون شفت)
const SUPPORT_ROLES = ["دعم", "دعم فني", "support"];
const SUPPORT_SALES_ROLES = ["مبيعات الدعم", "مبيعات دعم", "support sales"];
const OFFICE_SALES_ROLES = ["مبيعات", "مبيعات المكتب", "sales"];
const RENEWAL_ROLES = ["تجديدات", "تجديد", "renewals"];
const INACTIVE_DEAL_STAGES = ["مكتملة", "مرفوض مع سبب", "كنسل التجربة", "استهداف خاطئ"];
const ACTIVE_TICKET_STATUSES = ["مفتوح", "قيد الحل"];
const INACTIVE_RENEWAL_STATUSES = ["مكتمل", "ملغي بسبب"];

const DAY_NAMES_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

type DeptType = "support" | "support_sales" | "office_sales" | "renewals";

function getDepartment(role: string | undefined): DeptType {
  const r = (role || "").toLowerCase().trim();
  if (SUPPORT_ROLES.some((s) => r === s.toLowerCase())) return "support";
  if (SUPPORT_SALES_ROLES.some((s) => r === s.toLowerCase())) return "support_sales";
  if (RENEWAL_ROLES.some((s) => r === s.toLowerCase())) return "renewals";
  return "office_sales";
}

function isInShift(dept: DeptType, shiftType: "morning" | "evening" | undefined, now: Date): boolean {
  if (dept === "renewals") return true; // مفتوح دائماً

  const hour = now.getHours();

  if (dept === "support" || dept === "support_sales") {
    if (shiftType === "evening") {
      // 17:00 - 01:00
      return hour >= 17 || hour < 1;
    }
    // صباحي: 9:00 - 17:00
    return hour >= 9 && hour < 17;
  }

  // مبيعات مكتب: 9:00 - 17:00
  return hour >= 9 && hour < 17;
}

function getShiftStartToday(dept: DeptType, shiftType: "morning" | "evening" | undefined): Date {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);

  if (dept === "renewals") {
    start.setHours(0);
    return start;
  }

  if ((dept === "support" || dept === "support_sales") && shiftType === "evening") {
    const hour = now.getHours();
    if (hour < 1) {
      // بعد منتصف الليل — الشفت بدأ أمس الساعة 17
      start.setDate(start.getDate() - 1);
    }
    start.setHours(17);
    return start;
  }

  // صباحي أو مكتب
  start.setHours(9);
  return start;
}

function getShiftLabel(dept: DeptType, shiftType: "morning" | "evening" | undefined): string {
  if (dept === "renewals") return "تجديدات";
  if (dept === "support") return shiftType === "evening" ? "دعم — مسائي" : "دعم — صباحي";
  if (dept === "support_sales") return shiftType === "evening" ? "مبيعات الدعم — مسائي" : "مبيعات الدعم — صباحي";
  return "مبيعات المكتب";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function minutesSince(dateStr: string): number {
  return Math.max(0, (Date.now() - new Date(dateStr).getTime()) / 60_000);
}

function formatElapsed(minutes: number): string {
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `${Math.floor(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hours < 24) {
    return mins > 0 ? `${hours} ساعة و ${mins} دقيقة` : `${hours} ساعة`;
  }
  const days = Math.floor(hours / 24);
  return `${days} يوم`;
}

function formatElapsedShort(minutes: number): string {
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `${Math.floor(minutes)} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} س`;
  return `${Math.floor(hours / 24)} يوم`;
}

function todayDateAr(): string {
  const now = new Date();
  const months = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

type GapStatus = "ok" | "warn" | "bad";

// ─── Employee shift mapping ────────────────────────────────────────────────
// الموظفين وشفتاتهم — إذا الموظف مو في القائمة، يتحدد من دوره
const EMPLOYEE_SHIFTS: Record<string, "morning" | "evening"> = {
  "روان": "morning",
  "علي": "evening",
};

function getEmployeeShift(name: string): "morning" | "evening" | undefined {
  const trimmed = name.trim();
  for (const [key, shift] of Object.entries(EMPLOYEE_SHIFTS)) {
    if (trimmed.includes(key)) return shift;
  }
  return "morning"; // الافتراضي صباحي
}

interface EmployeeGap {
  name: string;
  role: string;
  department: DeptType;
  deptLabel: string;
  lastRegistration: string | null;
  gapMinutes: number;
  status: GapStatus;
  pendingDeals: number;
  pendingTickets: number;
  pendingRenewals: number;
  totalPending: number;
  onShift: boolean;
}

interface TimelineItem {
  type: "deal" | "ticket" | "renewal";
  label: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  isPending: boolean;
  minutesSinceCreation: number;
}

// ─── Gap calculation ────────────────────────────────────────────────────────

function computeEmployeeGaps(
  employees: Employee[],
  deals: Deal[],
  tickets: Ticket[],
  renewals: Renewal[]
): EmployeeGap[] {
  const nowDate = new Date();
  const now = nowDate.getTime();

  return employees
    .filter((e) => e.status === "نشط" || e.status === "active")
    .map((emp) => {
      const department = getDepartment(emp.role);
      const shiftType = getEmployeeShift(emp.name);
      const onShift = isInShift(department, shiftType, nowDate);
      const usesSupportThreshold = department === "support" || department === "support_sales";
      const threshold = usesSupportThreshold ? THRESHOLDS.support : THRESHOLDS.sales;
      const deptLabel = getShiftLabel(department, shiftType);

      // Shift start time — only count items within current shift
      const shiftStart = getShiftStartToday(department, shiftType);
      const shiftStartMs = shiftStart.getTime();

      // Find items belonging to this employee
      const empDeals = deals.filter(
        (d) => d.assigned_rep_name?.trim() === emp.name.trim()
      );
      const empTickets = tickets.filter(
        (t) => t.assigned_agent_name?.trim() === emp.name.trim()
      );
      const empRenewals = renewals.filter(
        (r) => r.assigned_rep?.trim() === emp.name.trim()
      );

      // Last registration = most recent created_at WITHIN current shift
      const allDates = [
        ...empDeals.map((d) => d.created_at),
        ...empTickets.map((t) => t.created_at),
        ...empRenewals.map((r) => r.created_at),
      ].filter((d) => d && new Date(d).getTime() >= shiftStartMs);

      const lastRegistration =
        allDates.length > 0
          ? allDates.sort(
              (a, b) => new Date(b).getTime() - new Date(a).getTime()
            )[0]
          : null;

      // Gap = time since last registration, but capped to shift duration
      const gapMinutes = lastRegistration
        ? (now - new Date(lastRegistration).getTime()) / 60_000
        : onShift
          ? (now - shiftStartMs) / 60_000
          : 0;

      // Status — only flag if on shift
      let status: GapStatus = "ok";
      if (onShift) {
        if (gapMinutes >= threshold.bad) status = "bad";
        else if (gapMinutes >= threshold.warn) status = "warn";
      }

      // Pending = active items whose updated_at is older than warn threshold (within shift)
      const warnMs = threshold.warn * 60_000;
      const pendingDeals = empDeals.filter(
        (d) =>
          !INACTIVE_DEAL_STAGES.includes(d.stage) &&
          new Date(d.created_at).getTime() >= shiftStartMs &&
          now - new Date(d.updated_at).getTime() > warnMs
      ).length;
      const pendingTickets = empTickets.filter(
        (t) =>
          ACTIVE_TICKET_STATUSES.includes(t.status) &&
          new Date(t.created_at).getTime() >= shiftStartMs &&
          now - new Date(t.updated_at).getTime() > warnMs
      ).length;
      const pendingRenewals = empRenewals.filter(
        (r) =>
          !INACTIVE_RENEWAL_STATUSES.includes(r.status) &&
          new Date(r.created_at).getTime() >= shiftStartMs &&
          now - new Date(r.updated_at).getTime() > warnMs
      ).length;

      return {
        name: emp.name,
        role: emp.role || "",
        department,
        deptLabel,
        lastRegistration,
        gapMinutes,
        status,
        pendingDeals,
        pendingTickets,
        pendingRenewals,
        totalPending: pendingDeals + pendingTickets + pendingRenewals,
        onShift,
      };
    })
    .sort((a, b) => {
      // الموظفين في شفتهم أولاً
      if (a.onShift !== b.onShift) return a.onShift ? -1 : 1;
      const order: Record<GapStatus, number> = { bad: 0, warn: 1, ok: 2 };
      if (order[a.status] !== order[b.status])
        return order[a.status] - order[b.status];
      return b.gapMinutes - a.gapMinutes;
    });
}

// ─── Status badge config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  GapStatus,
  { label: string; text: string; bg: string; dot: string }
> = {
  ok: {
    label: "ملتزم",
    text: "text-cc-green",
    bg: "bg-cc-green/10",
    dot: "bg-cc-green",
  },
  warn: {
    label: "بداية تأخير",
    text: "text-amber",
    bg: "bg-amber/10",
    dot: "bg-amber",
  },
  bad: {
    label: "فجوة حرجة",
    text: "text-rose-400",
    bg: "bg-rose-400/10",
    dot: "bg-rose-400",
  },
};

const DEPT_COLORS: Record<DeptType, { bg: string; text: string }> = {
  support: { bg: "bg-cc-purple/10", text: "text-cc-purple" },
  support_sales: { bg: "bg-orange-400/10", text: "text-orange-400" },
  office_sales: { bg: "bg-cc-blue/10", text: "text-cc-blue" },
  renewals: { bg: "bg-sky-400/10", text: "text-sky-400" },
};

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

export default function RegistrationGapsPage() {
  const { user: authUser } = useAuth();
  const isManager =
    authUser?.isSuperAdmin ||
    authUser?.roleName === "مدير" ||
    authUser?.roleName === "admin";

  const [deals, setDeals] = useState<Deal[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [d, t, r, e] = await Promise.allSettled([
      fetchDeals(),
      fetchTickets(),
      fetchRenewals(),
      fetchEmployees(),
    ]);
    if (d.status === "fulfilled") setDeals(d.value);
    if (t.status === "fulfilled") setTickets(t.value);
    if (r.status === "fulfilled") setRenewals(r.value);
    if (e.status === "fulfilled") setEmployees(e.value);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(() => {
      void loadData();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadData]);

  if (isLoading) return <LoadingSkeleton />;

  if (isManager) {
    return (
      <ManagerView
        employees={employees}
        deals={deals}
        tickets={tickets}
        renewals={renewals}
      />
    );
  }

  return (
    <EmployeeView
      userName={authUser?.name || ""}
      employees={employees}
      deals={deals}
      tickets={tickets}
      renewals={renewals}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MANAGER VIEW
// ═════════════════════════════════════════════════════════════════════════════

function ManagerView({
  employees,
  deals,
  tickets,
  renewals,
}: {
  employees: Employee[];
  deals: Deal[];
  tickets: Ticket[];
  renewals: Renewal[];
}) {
  const gaps = useMemo(
    () => computeEmployeeGaps(employees, deals, tickets, renewals),
    [employees, deals, tickets, renewals]
  );

  const onShiftGaps = gaps.filter((g) => g.onShift);
  const badCount = onShiftGaps.filter((g) => g.status === "bad").length;
  const warnCount = onShiftGaps.filter((g) => g.status === "warn").length;
  const okCount = onShiftGaps.filter((g) => g.status === "ok").length;
  const totalPending = onShiftGaps.reduce((s, g) => s + g.totalPending, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            فجوات التسجيل اليومية
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            متابعة تسجيلات الفريق وكشف التأخيرات
          </p>
        </div>
        <span className="self-start rounded-full border border-border bg-white/[0.04] px-4 py-1.5 text-[13px] font-semibold text-muted-foreground">
          {todayDateAr()}
        </span>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          value={badCount}
          label="فجوة حرجة"
          colorText="text-rose-400"
          colorBg="bg-rose-400/10"
        />
        <SummaryCard
          value={warnCount}
          label="تأخير بسيط"
          colorText="text-amber"
          colorBg="bg-amber/10"
        />
        <SummaryCard
          value={okCount}
          label="ملتزمون"
          colorText="text-cc-green"
          colorBg="bg-cc-green/10"
        />
        <SummaryCard
          value={totalPending}
          label="عنصر معلّق إجمالي"
          colorText="text-cc-blue"
          colorBg="bg-cc-blue/10"
        />
      </div>

      {/* Employee roster */}
      <div className="space-y-3">
        {gaps.length === 0 && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            لا يوجد موظفون نشطون
          </div>
        )}
        {gaps.map((g) => (
          <EmployeeCard key={g.name} gap={g} />
        ))}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground">
        تُحدَّث الفجوة تلقائيًا كل 5 دقائق
      </p>
    </div>
  );
}

function SummaryCard({
  value,
  label,
  colorText,
  colorBg,
}: {
  value: number;
  label: string;
  colorText: string;
  colorBg: string;
}) {
  return (
    <div className="glass-surface rounded-[14px] p-4 text-center">
      <p className={`text-3xl font-black font-mono ${colorText}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      <div className={`mx-auto mt-2 h-1 w-10 rounded-full ${colorBg}`} />
    </div>
  );
}

function EmployeeCard({ gap }: { gap: EmployeeGap }) {
  const sc = STATUS_CONFIG[gap.status];
  const dc = DEPT_COLORS[gap.department];
  const initials = gap.name.trim().slice(0, 2);

  return (
    <div className={`glass-surface rounded-[14px] p-4 flex items-center gap-4 flex-wrap sm:flex-nowrap ${!gap.onShift ? "opacity-50" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-11 h-11 rounded-xl ${sc.bg} flex items-center justify-center shrink-0`}
      >
        <span className={`text-sm font-bold ${sc.text}`}>{initials}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-foreground truncate">
            {gap.name}
          </span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${dc.bg} ${dc.text}`}
          >
            {gap.deptLabel}
          </span>
          {!gap.onShift && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-muted-foreground">
              خارج الشفت
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          آخر تسجيل:{" "}
          {gap.lastRegistration
            ? `منذ ${formatElapsed(gap.gapMinutes)}`
            : gap.onShift ? "لا يوجد تسجيل في هذا الشفت" : "—"}
        </p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${sc.bg} ${sc.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
          {sc.label}
        </span>

        {/* Pending counts */}
        {gap.totalPending > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {gap.pendingDeals > 0 && (
              <span className="rounded-md bg-white/[0.06] px-2 py-1">
                {gap.pendingDeals} صفقة معلّقة
              </span>
            )}
            {gap.pendingTickets > 0 && (
              <span className="rounded-md bg-white/[0.06] px-2 py-1">
                {gap.pendingTickets} تكت معلّق
              </span>
            )}
            {gap.pendingRenewals > 0 && (
              <span className="rounded-md bg-white/[0.06] px-2 py-1">
                {gap.pendingRenewals} تجديد معلّق
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EMPLOYEE VIEW
// ═════════════════════════════════════════════════════════════════════════════

function EmployeeView({
  userName,
  employees,
  deals,
  tickets,
  renewals,
}: {
  userName: string;
  employees: Employee[];
  deals: Deal[];
  tickets: Ticket[];
  renewals: Renewal[];
}) {
  const name = userName.trim();

  // Determine department & shift from employees table
  const emp = employees.find((e) => e.name.trim() === name);
  const department = getDepartment(emp?.role);
  const shiftType = getEmployeeShift(name);
  const usesSupportThreshold = department === "support" || department === "support_sales";
  const threshold = usesSupportThreshold ? THRESHOLDS.support : THRESHOLDS.sales;
  const shiftStart = getShiftStartToday(department, shiftType);
  const shiftStartMs = shiftStart.getTime();

  // My items
  const myDeals = deals.filter((d) => d.assigned_rep_name?.trim() === name);
  const myTickets = tickets.filter(
    (t) => t.assigned_agent_name?.trim() === name
  );
  const myRenewals = renewals.filter((r) => r.assigned_rep?.trim() === name);

  // Items within current shift
  const shiftDeals = myDeals.filter((d) => new Date(d.created_at).getTime() >= shiftStartMs);
  const shiftTickets = myTickets.filter((t) => new Date(t.created_at).getTime() >= shiftStartMs);
  const shiftRenewals = myRenewals.filter((r) => new Date(r.created_at).getTime() >= shiftStartMs);

  const registeredToday =
    shiftDeals.length + shiftTickets.length + shiftRenewals.length;

  // Pending now (within shift)
  const now = Date.now();
  const warnMs = threshold.warn * 60_000;
  const pendingDeals = shiftDeals.filter(
    (d) =>
      !INACTIVE_DEAL_STAGES.includes(d.stage) &&
      now - new Date(d.updated_at).getTime() > warnMs
  ).length;
  const pendingTickets = shiftTickets.filter(
    (t) =>
      ACTIVE_TICKET_STATUSES.includes(t.status) &&
      now - new Date(t.updated_at).getTime() > warnMs
  ).length;
  const pendingRenewals = shiftRenewals.filter(
    (r) =>
      !INACTIVE_RENEWAL_STATUSES.includes(r.status) &&
      now - new Date(r.updated_at).getTime() > warnMs
  ).length;
  const pendingNow = pendingDeals + pendingTickets + pendingRenewals;

  // Compliance
  const compliance =
    registeredToday + pendingNow > 0
      ? Math.round((registeredToday / (registeredToday + pendingNow)) * 100)
      : 100;

  // Last registration (within shift)
  const allDates = [
    ...shiftDeals.map((d) => d.created_at),
    ...shiftTickets.map((t) => t.created_at),
    ...shiftRenewals.map((r) => r.created_at),
  ].filter(Boolean);
  const lastReg =
    allDates.length > 0
      ? allDates.sort(
          (a, b) => new Date(b).getTime() - new Date(a).getTime()
        )[0]
      : null;
  const lastRegMinutes = lastReg ? minutesSince(lastReg) : Infinity;

  // Ring color
  let ringColor = "text-cc-green";
  let ringTrack = "text-cc-green/20";
  let headline = "ممتاز — أنت ملتزم اليوم";
  let headlineColor = "text-cc-green";
  if (compliance < 50) {
    ringColor = "text-rose-400";
    ringTrack = "text-rose-400/20";
    headline = "تحتاج تسجيل فوري";
    headlineColor = "text-rose-400";
  } else if (compliance < 80) {
    ringColor = "text-amber";
    ringTrack = "text-amber/20";
    headline = "انتبه — عندك عناصر معلّقة";
    headlineColor = "text-amber";
  }

  // Average registration time (for shift items)
  const todayTimeline = buildTimeline(
    shiftDeals,
    shiftTickets,
    shiftRenewals,
    threshold
  );
  const doneItems = todayTimeline.filter((t) => !t.isPending);
  const avgTime =
    doneItems.length > 0
      ? Math.round(
          doneItems.reduce((s, t) => s + t.minutesSinceCreation, 0) /
            doneItems.length
        )
      : 0;

  // Weekly comparison (Sat=6 to today)
  const weeklyData = useMemo(() => {
    return computeWeeklyCompliance(
      name,
      deals,
      tickets,
      renewals,
      threshold
    );
  }, [name, deals, tickets, renewals, threshold]);

  // Motivational note
  const todayIdx = weeklyData.findIndex((d) => d.isToday);
  const worstDay = [...weeklyData]
    .filter((d) => d.total > 0)
    .sort((a, b) => a.compliance - b.compliance)[0];
  let motivational = "";
  if (todayIdx >= 0 && worstDay && !worstDay.isToday) {
    if (weeklyData[todayIdx].compliance > worstDay.compliance) {
      motivational = `أداؤك اليوم أفضل من يوم ${worstDay.dayName} بفارق ${weeklyData[todayIdx].compliance - worstDay.compliance}%`;
    } else if (weeklyData[todayIdx].compliance < worstDay.compliance) {
      motivational = `يوم ${worstDay.dayName} كان أفضل — يمكنك تحسين اليوم`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{todayDateAr()}</p>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">
            تسجيلاتي اليوم
          </h1>
        </div>
      </div>

      {/* Hero card with ring */}
      <div className="glass-surface rounded-[14px] p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
          {/* SVG ring */}
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                strokeWidth="10"
                className={`stroke-current ${ringTrack}`}
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(compliance / 100) * 314.16} 314.16`}
                className={`stroke-current ${ringColor} transition-all duration-1000`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-black font-mono ${ringColor}`}>
                {compliance}%
              </span>
            </div>
          </div>

          <div className="text-center sm:text-right flex-1">
            <h2 className={`text-lg font-bold ${headlineColor}`}>
              {headline}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              آخر تسجيل لك كان منذ{" "}
              {lastReg ? formatElapsed(lastRegMinutes) : "لا يوجد تسجيل"}
            </p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-surface rounded-[14px] p-4 text-center">
          <p className="text-2xl font-black font-mono text-cc-green">
            {registeredToday}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">مسجّل اليوم</p>
        </div>
        <div className="glass-surface rounded-[14px] p-4 text-center">
          <p className="text-2xl font-black font-mono text-rose-400">
            {pendingNow}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">معلّق الآن</p>
        </div>
        <div className="glass-surface rounded-[14px] p-4 text-center">
          <p className="text-2xl font-black font-mono text-amber">
            {avgTime > 0 ? `${avgTime} د` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            متوسط وقت التسجيل
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-surface rounded-[14px] p-5">
        <h3 className="text-base font-bold text-foreground mb-4">
          جدول اليوم
        </h3>
        {todayTimeline.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
            لا توجد تسجيلات لليوم بعد
          </div>
        ) : (
          <div className="space-y-3">
            {todayTimeline.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border bg-white/[0.04] px-4 py-3"
              >
                {/* Icon */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    item.isPending ? "bg-rose-400/10" : "bg-cc-green/10"
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${
                      item.isPending ? "text-rose-400" : "text-cc-green"
                    }`}
                  >
                    {item.isPending ? "!" : "✓"}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.label} — {item.clientName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.isPending
                      ? `منذ ${formatElapsedShort(item.minutesSinceCreation)} — بدون تسجيل`
                      : `سُجّل بعد ${formatElapsedShort(item.minutesSinceCreation)} دقائق`}
                  </p>
                </div>

                {/* Tag */}
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                    item.isPending
                      ? "bg-rose-400/10 text-rose-400"
                      : "bg-cc-green/10 text-cc-green"
                  }`}
                >
                  {item.isPending ? "معلّق" : "تم"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly comparison bar chart */}
      <div className="glass-surface rounded-[14px] p-5">
        <h3 className="text-base font-bold text-foreground mb-4">
          مقارنة أسبوعية
        </h3>
        <div className="flex items-end gap-2 h-40">
          {weeklyData.map((day, i) => {
            const barHeight = Math.max(4, (day.compliance / 100) * 100);
            let barColor = "bg-cc-green";
            if (day.compliance < 50) barColor = "bg-rose-400";
            else if (day.compliance < 80) barColor = "bg-amber";

            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className="text-[10px] text-muted-foreground font-mono">
                  {day.total > 0 ? `${day.compliance}%` : "—"}
                </span>
                <div className="w-full flex items-end justify-center h-28">
                  <div
                    className={`w-full max-w-[32px] rounded-t-md transition-all duration-500 ${barColor} ${
                      day.isToday ? "opacity-100" : "opacity-60"
                    }`}
                    style={{ height: `${barHeight}%` }}
                  />
                </div>
                <span
                  className={`text-[11px] ${
                    day.isToday
                      ? "font-bold text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {day.dayName}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Motivational note */}
      {motivational && (
        <div className="glass-surface rounded-[14px] p-4 text-center">
          <p className="text-sm text-muted-foreground">{motivational}</p>
        </div>
      )}
    </div>
  );
}

// ─── Timeline builder ───────────────────────────────────────────────────────

function buildTimeline(
  deals: Deal[],
  tickets: Ticket[],
  renewals: Renewal[],
  threshold: { warn: number; bad: number }
): TimelineItem[] {
  const now = Date.now();
  const warnMs = threshold.warn * 60_000;
  const items: TimelineItem[] = [];

  for (const d of deals) {
    const isPending =
      !INACTIVE_DEAL_STAGES.includes(d.stage) &&
      now - new Date(d.updated_at).getTime() > warnMs;
    items.push({
      type: "deal",
      label: "صفقة",
      clientName: d.client_name,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      isPending,
      minutesSinceCreation: minutesSince(d.created_at),
    });
  }

  for (const t of tickets) {
    const isPending =
      ACTIVE_TICKET_STATUSES.includes(t.status) &&
      now - new Date(t.updated_at).getTime() > warnMs;
    items.push({
      type: "ticket",
      label: "تذكرة",
      clientName: t.client_name,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      isPending,
      minutesSinceCreation: minutesSince(t.created_at),
    });
  }

  for (const r of renewals) {
    const isPending =
      !INACTIVE_RENEWAL_STATUSES.includes(r.status) &&
      now - new Date(r.updated_at).getTime() > warnMs;
    items.push({
      type: "renewal",
      label: "تجديد",
      clientName: r.customer_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      isPending,
      minutesSinceCreation: minutesSince(r.created_at),
    });
  }

  return items.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ─── Weekly compliance ──────────────────────────────────────────────────────

interface WeekDay {
  dayName: string;
  compliance: number;
  total: number;
  isToday: boolean;
}

function computeWeeklyCompliance(
  name: string,
  deals: Deal[],
  tickets: Ticket[],
  renewals: Renewal[],
  threshold: { warn: number; bad: number }
): WeekDay[] {
  const now = new Date();
  const currentDow = now.getDay(); // 0=Sun
  // Saturday = day 6 in JS. Find offset to last Saturday
  const satOffset = currentDow >= 6 ? 0 : currentDow + 1;

  const result: WeekDay[] = [];

  for (let i = satOffset; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const dayStart = day.getTime();
    const dayEndMs = dayEnd.getTime();

    const inRange = (dateStr: string) => {
      const t = new Date(dateStr).getTime();
      return t >= dayStart && t <= dayEndMs;
    };

    const dayDeals = deals.filter(
      (d) => d.assigned_rep_name?.trim() === name && inRange(d.created_at)
    );
    const dayTickets = tickets.filter(
      (t) => t.assigned_agent_name?.trim() === name && inRange(t.created_at)
    );
    const dayRenewals = renewals.filter(
      (r) => r.assigned_rep?.trim() === name && inRange(r.created_at)
    );

    const registered =
      dayDeals.length + dayTickets.length + dayRenewals.length;

    // For past days, count pending as items that were active on that day and not updated by end of day
    const warnMs = threshold.warn * 60_000;
    const checkTime = i === 0 ? Date.now() : dayEndMs;

    const pendDeals = deals.filter(
      (d) =>
        d.assigned_rep_name?.trim() === name &&
        !INACTIVE_DEAL_STAGES.includes(d.stage) &&
        new Date(d.created_at).getTime() <= dayEndMs &&
        checkTime - new Date(d.updated_at).getTime() > warnMs
    ).length;
    const pendTickets = tickets.filter(
      (t) =>
        t.assigned_agent_name?.trim() === name &&
        ACTIVE_TICKET_STATUSES.includes(t.status) &&
        new Date(t.created_at).getTime() <= dayEndMs &&
        checkTime - new Date(t.updated_at).getTime() > warnMs
    ).length;
    const pendRenewals = renewals.filter(
      (r) =>
        r.assigned_rep?.trim() === name &&
        !INACTIVE_RENEWAL_STATUSES.includes(r.status) &&
        new Date(r.created_at).getTime() <= dayEndMs &&
        checkTime - new Date(r.updated_at).getTime() > warnMs
    ).length;

    const pending = pendDeals + pendTickets + pendRenewals;
    const total = registered + pending;
    const compliance =
      total > 0 ? Math.round((registered / total) * 100) : 0;

    result.push({
      dayName: DAY_NAMES_AR[day.getDay()],
      compliance,
      total,
      isToday: i === 0,
    });
  }

  return result;
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-surface rounded-[14px] p-4">
            <Skeleton className="h-8 w-12 mx-auto" />
            <Skeleton className="h-3 w-20 mx-auto mt-2" />
          </div>
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="glass-surface rounded-[14px] p-4 flex items-center gap-4"
        >
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}
