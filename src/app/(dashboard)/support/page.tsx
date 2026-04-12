"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  fetchTickets, createTicket, updateTicket, deleteTicket,
  fetchEmployees, fetchActivityLogs,
  fetchQuoteCommitments, addQuoteCommitment, removeQuoteCommitment,
} from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { PRIORITIES, TICKET_STATUSES, TICKET_CATEGORIES, PROBLEM_CATEGORIES, SERVICE_CATEGORIES, REQUEST_TYPES } from "@/lib/utils/constants";
import { PRIORITY_COLORS, TICKET_STATUS_COLORS } from "@/lib/utils/constants";
import { formatDate, formatPhone } from "@/lib/utils/format";
import type { Ticket, Employee, ActivityLog } from "@/types";

import { AchievementSummary } from "@/components/achievement-summary";
import { FollowUpLogButton } from "@/components/follow-up-log";
import { StatCard } from "@/components/ui/stat-card";
import { ColorBadge } from "@/components/ui/color-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  BarChart3,
  Repeat,
  Sparkles,
  ScrollText,
  ChevronDown,
  User,
  Phone,
  Search,
  ThumbsUp,
  Share2,
  Loader2,
  Download,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Daily Support Quotes                                               */
/* ------------------------------------------------------------------ */
const SUPPORT_QUOTES = [
  { text: "أقرب طريق لقلب العميل هو أن تجعله يشعر أنه مسموع — استمع أولاً ثم تصرّف", author: "توني هسيه", book: "توصيل السعادة" },
  { text: "كل شكوى عميل هي هدية مغلّفة — افتحها بعناية وستجد فرصة للتحسين", author: "جانيل بارلو", book: "الشكوى هدية" },
  { text: "الخدمة المتميزة ليست ما تفعله، بل كيف تجعل العميل يشعر وأنت تفعله", author: "شيب هايكن", book: "كن مذهلاً" },
  { text: "لا تكتفِ بحل المشكلة — اجعل العميل يخرج من التجربة وهو أسعد مما كان", author: "ريتشارد برانسون", book: "أسلوب فيرجن" },
  { text: "العميل الغاضب الذي تحوّله إلى سعيد يصبح أكثر ولاءً من العميل الذي لم يواجه مشكلة قط", author: "جانيل بارلو", book: "الشكوى هدية" },
  { text: "اجعل كل تفاعل مع العميل فرصة لتقول: نحن نهتم بك حقاً", author: "توني هسيه", book: "توصيل السعادة" },
  { text: "لا تقل للعميل أن مشكلته بسيطة — بالنسبة له هي أهم شيء في تلك اللحظة", author: "ديل كارنيغي", book: "كيف تكسب الأصدقاء" },
  { text: "سرعة الاستجابة تقول للعميل: أنت مهم. والتأخير يقول له العكس", author: "شيب هايكن", book: "ثورة الدهشة" },
  { text: "أفضل دعم فني هو الذي يمنع المشكلة قبل حدوثها — الوقاية خير من العلاج", author: "بيل غيتس", book: "الأعمال بسرعة الفكر" },
  { text: "عامل كل مشكلة وكأنها مشكلتك الشخصية — هذا الإحساس يصل للعميل فوراً", author: "غاري فاينرتشوك", book: "اقتصاد الشكر" },
  { text: "التعاطف مع العميل ليس ضعفاً، بل هو أقوى أداة في يدك لحل أي مشكلة", author: "دانيال غولمان", book: "الذكاء العاطفي" },
  { text: "الدعم الفني الممتاز يحوّل اللحظات الصعبة إلى ذكريات إيجابية يرويها العميل للجميع", author: "تشيب هيث", book: "لحظات القوة" },
  { text: "لا تنقل المشكلة من قسم لآخر — كن أنت الحل الذي يبحث عنه العميل", author: "لي كوكريل", book: "خلق السحر" },
  { text: "العميل لا يريد أن يسمع أعذاراً — يريد أن يسمع حلاً ووعداً يُنفَّذ", author: "شيب هايكن", book: "كن مذهلاً" },
  { text: "كل مكالمة دعم هي فرصة لبناء ثقة تدوم سنوات — لا تضيّعها", author: "فريد رايكهيلد", book: "تأثير الولاء" },
  { text: "أعظم ما يمكنك تقديمه للعميل ليس الحل فقط، بل الشعور بأنه في أيدٍ أمينة", author: "سيمون سينك", book: "ابدأ بلماذا" },
  { text: "اجعل المتابعة عادة — العميل الذي تتابعه بعد الحل يعلم أنك تهتم فعلاً", author: "مايكل لوبوف", book: "كيف تكسب العملاء مدى الحياة" },
  { text: "الفرق بين خدمة عادية وخدمة استثنائية هو الاهتمام بالتفاصيل الصغيرة", author: "والت ديزني", book: "فلسفة ديزني" },
  { text: "حين يشعر العميل أنك معه وليس ضده، تنتهي نصف المشكلة تلقائياً", author: "ستيفن كوفي", book: "العادات السبع" },
  { text: "لا تقيس نجاحك بعدد التذاكر المغلقة، بل بعدد العملاء الذين ابتسموا بعد الحل", author: "توني هسيه", book: "توصيل السعادة" },
  { text: "أفضل موظف دعم هو من يتعلم من كل مشكلة ويمنع تكرارها — كن ذلك الشخص", author: "بيتر دراكر", book: "الإدارة الفعّالة" },
  { text: "الصبر على العميل ليس عبئاً — إنه استثمار في علاقة طويلة الأمد", author: "ديل كارنيغي", book: "كيف تكسب الأصدقاء" },
  { text: "تواضعك أمام مشكلة العميل وشجاعتك في حلها هما سر التميز", author: "جيم كولينز", book: "من جيد إلى عظيم" },
  { text: "كل عميل يتصل بك يختبر وعد شركتك — كن أنت من يحقق هذا الوعد", author: "سيث غودين", book: "هذا هو التسويق" },
  { text: "الدعم الاستباقي أقوى من الدعم التفاعلي — لا تنتظر المشكلة بل توقّعها وامنعها", author: "بيل غيتس", book: "الأعمال بسرعة الفكر" },
  { text: "عندما تعتذر بصدق وتصلح بسرعة، العميل يزداد احتراماً لك وللشركة", author: "جانيل بارلو", book: "الشكوى هدية" },
  { text: "اجعل هدفك ليس فقط إرضاء العميل، بل إبهاره — الرضا يُنسى والإبهار يُروى", author: "شيب هايكن", book: "ثورة الدهشة" },
  { text: "أقوى فريق دعم هو الذي يشارك المعرفة — ما تتعلمه اليوم يفيد زميلك غداً", author: "بيتر سينغي", book: "الانضباط الخامس" },
  { text: "لا تجعل التقنية حاجزاً بينك وبين العميل — استخدمها لتقرّبك منه أكثر", author: "ريتشارد برانسون", book: "أسلوب فيرجن" },
  { text: "ابدأ حيث أنت، استخدم ما لديك، افعل ما تستطيع — هذا هو جوهر الدعم المتميز", author: "آرثر آش", book: "أيام النعمة" },
  { text: "العميل الذي تحل مشكلته اليوم هو السفير الذي يسوّق لك غداً", author: "فيليب كوتلر", book: "إدارة التسويق" },
];

function getDailySupportQuote() {
  const start = new Date(2025, 0, 1).getTime();
  const now = new Date().getTime();
  const dayIndex = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return SUPPORT_QUOTES[dayIndex % SUPPORT_QUOTES.length];
}

/* ------------------------------------------------------------------ */
/*  Types for local form state                                        */
/* ------------------------------------------------------------------ */
interface TicketForm {
  request_type: "problem" | "service";
  client_name: string;
  client_phone: string;
  issue: string;
  issue_category: string;
  issue_subcategory: string;
  open_time: string;
  priority: string;
  status: string;
  assigned_agent_name: string;
  open_date: string;
  due_date: string;
}

const EMPTY_FORM: TicketForm = {
  request_type: "problem",
  client_name: "",
  client_phone: "",
  issue: "",
  issue_category: "",
  issue_subcategory: "",
  open_time: new Date().toTimeString().slice(0, 5),
  priority: "عادي",
  status: "مفتوح",
  assigned_agent_name: "",
  open_date: new Date().toISOString().slice(0, 10),
  due_date: "",
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */
export default function SupportPage() {
  const { activeOrgId: orgId, user: authUser } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TicketForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Month filter
  const { activeMonthIndex, filterCutoff } = useTopbarControls();
  const monthTickets = filterCutoff
    ? tickets.filter((t) => new Date(t.open_date || t.created_at) >= filterCutoff)
    : activeMonthIndex
      ? tickets.filter((t) => t.month === activeMonthIndex.month && t.year === activeMonthIndex.year)
      : tickets;

  // Card filter: "مفتوح" | "قيد الحل" | "محلول" | "عاجل" | null
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  // Type filter: "problem" | "service" | null
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  // Category filter from analytics cards
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // Employee filter
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  // Activity log
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "today" | "week">("all");

  const loadActivityLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await fetchActivityLogs({ section: "support", limit: 100 });
      setActivityLogs(data);
    } catch {
      // silent
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (logsOpen && activityLogs.length === 0) {
      void loadActivityLogs();
    }
  }, [logsOpen, activityLogs.length, loadActivityLogs]);

  // Achievement summary
  const [achieveFilter, setAchieveFilter] = useState<string | null>(null);
  const [achieveFilterIds, setAchieveFilterIds] = useState<Set<string>>(new Set());

  // Table share
  const tableRef = useRef<HTMLDivElement>(null);
  const [isTableExporting, setIsTableExporting] = useState(false);

  const handleShareTable = useCallback(async () => {
    if (!tableRef.current || isTableExporting) return;
    setIsTableExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(tableRef.current, {
        backgroundColor: "#0c0e14",
        pixelRatio: 2,
        style: { borderRadius: "0" },
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "support-tickets.png", { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "جدول تذاكر الدعم", files: [file] });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "support-tickets.png";
        link.click();
      }
    } catch {
      // User cancelled or error
    } finally {
      setIsTableExporting(false);
    }
  }, [isTableExporting]);

  const agentFilteredTickets = agentFilter
    ? monthTickets.filter((t) => t.assigned_agent_name === agentFilter)
    : monthTickets;

  /* Achievement items — uses all tickets filtered by agent only (not month)
     because AchievementSummary has its own internal period filter */
  const agentOnlyTickets = agentFilter ? tickets.filter((t) => t.assigned_agent_name === agentFilter) : tickets;
  const achievementItems = useMemo(() => agentOnlyTickets.map(t => ({
    id: t.id,
    updated_at: t.updated_at,
    value: 0,
    isCompleted: t.status === "محلول",
    isCancelled: false,
    isContacted: t.status === "قيد الحل",
    repName: t.assigned_agent_name || undefined,
  })), [agentOnlyTickets]);
  const typeFilteredTickets = typeFilter
    ? agentFilteredTickets.filter((t) => (t.request_type || "problem") === typeFilter)
    : agentFilteredTickets;
  const categoryFilteredTickets = categoryFilter
    ? typeFilteredTickets.filter((t) => t.issue_category === categoryFilter)
    : typeFilteredTickets;
  const baseFilteredTickets = achieveFilter
    ? categoryFilteredTickets.filter(t => achieveFilterIds.has(t.id))
    : cardFilter
      ? cardFilter === "عاجل"
        ? categoryFilteredTickets.filter((t) => t.priority === "عاجل")
        : categoryFilteredTickets.filter((t) => t.status === cardFilter)
      : categoryFilteredTickets;
  const filteredTickets = clientSearch
    ? baseFilteredTickets.filter((t) => {
        const q = clientSearch.toLowerCase().trim();
        const nameMatch = t.client_name.toLowerCase().includes(q);
        const phoneMatch = t.client_phone ? t.client_phone.replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) : false;
        return nameMatch || phoneMatch;
      })
    : baseFilteredTickets;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTickets().then(setTickets),
      fetchEmployees().then(setEmployees),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* ---------- derived counts ---------- */
  const countOpen = agentFilteredTickets.filter((t) => t.status === "مفتوح").length;
  const countInProgress = agentFilteredTickets.filter((t) => t.status === "قيد الحل").length;
  const countResolved = agentFilteredTickets.filter((t) => t.status === "محلول").length;
  const countUrgent = agentFilteredTickets.filter((t) => t.priority === "عاجل").length;
  const countProblems = agentFilteredTickets.filter((t) => (t.request_type || "problem") === "problem").length;
  const countServices = agentFilteredTickets.filter((t) => t.request_type === "service").length;

  /* ---------- Issue Pattern Analytics ---------- */
  const issueAnalytics = useMemo(() => {
    const categorized = tickets.filter(t => t.issue_category);
    if (categorized.length === 0) return null;

    // Count by category
    const catCounts: Record<string, { total: number; resolved: number; urgent: number; subcats: Record<string, number>; times: Date[] }> = {};
    for (const t of categorized) {
      const cat = t.issue_category!;
      if (!catCounts[cat]) catCounts[cat] = { total: 0, resolved: 0, urgent: 0, subcats: {}, times: [] };
      catCounts[cat].total++;
      if (t.status === "محلول") catCounts[cat].resolved++;
      if (t.priority === "عاجل") catCounts[cat].urgent++;
      if (t.issue_subcategory) {
        catCounts[cat].subcats[t.issue_subcategory] = (catCounts[cat].subcats[t.issue_subcategory] || 0) + 1;
      }
      catCounts[cat].times.push(new Date(t.open_date || t.created_at));
    }

    // Sort by frequency
    const sorted = Object.entries(catCounts).sort((a, b) => b[1].total - a[1].total);

    // Detect peak hours (use open_time if available, fallback to created_at)
    const hourCounts: Record<number, number> = {};
    categorized.forEach(t => {
      const h = t.open_time ? parseInt(t.open_time.split(":")[0], 10) : new Date(t.created_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const peakHour = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    // Detect peak days of week
    const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const dayCounts: Record<number, number> = {};
    categorized.forEach(t => {
      const d = new Date(t.open_date || t.created_at).getDay();
      dayCounts[d] = (dayCounts[d] || 0) + 1;
    });
    const peakDay = Object.entries(dayCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0];

    // Generate recommendations
    const recommendations: { text: string; priority: "high" | "medium" | "low"; icon: string }[] = [];
    for (const [cat, data] of sorted) {
      const resRate = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
      if (data.total >= 3) {
        const topSub = Object.entries(data.subcats).sort((a, b) => b[1] - a[1])[0];
        recommendations.push({
          text: `مشاكل "${cat}" متكررة (${data.total} مرة)${topSub ? ` — أكثرها "${topSub[0]}" (${topSub[1]} مرة)` : ""}. يُنصح بمعالجة السبب الجذري.`,
          priority: data.total >= 5 ? "high" : "medium",
          icon: TICKET_CATEGORIES[cat]?.icon || "📋",
        });
      }
      if (resRate < 50 && data.total >= 2) {
        recommendations.push({
          text: `نسبة حل "${cat}" منخفضة (${resRate}%). يحتاج تخصيص موارد إضافية.`,
          priority: "high",
          icon: "⚠️",
        });
      }
      if (data.urgent >= 2) {
        recommendations.push({
          text: `${data.urgent} تذاكر عاجلة في "${cat}". يُنصح بإنشاء إجراء وقائي.`,
          priority: "high",
          icon: "🚨",
        });
      }
    }
    if (peakHour) {
      recommendations.push({
        text: `أكثر المشاكل تحدث في الساعة ${peakHour[0]}:00 (${peakHour[1]} مشكلة). تأكد من توفر فريق الدعم في هذا الوقت.`,
        priority: "medium",
        icon: "🕐",
      });
    }
    if (peakDay) {
      recommendations.push({
        text: `يوم ${dayNames[Number(peakDay[0])]} هو الأكثر مشاكلاً (${peakDay[1]} تذكرة). جهّز الفريق مسبقاً.`,
        priority: "low",
        icon: "📅",
      });
    }

    // Service-specific analytics
    const serviceTickets = categorized.filter(t => t.request_type === "service");
    const serviceCatCounts: Record<string, { total: number; resolved: number }> = {};
    for (const t of serviceTickets) {
      const cat = t.issue_category!;
      if (!serviceCatCounts[cat]) serviceCatCounts[cat] = { total: 0, resolved: 0 };
      serviceCatCounts[cat].total++;
      if (t.status === "محلول") serviceCatCounts[cat].resolved++;
    }
    const sortedServices = Object.entries(serviceCatCounts).sort((a, b) => b[1].total - a[1].total);

    // Problem-specific analytics
    const problemTickets = categorized.filter(t => (t.request_type || "problem") === "problem");
    const problemCatCounts: Record<string, { total: number; resolved: number }> = {};
    for (const t of problemTickets) {
      const cat = t.issue_category!;
      if (!problemCatCounts[cat]) problemCatCounts[cat] = { total: 0, resolved: 0 };
      problemCatCounts[cat].total++;
      if (t.status === "محلول") problemCatCounts[cat].resolved++;
    }
    const sortedProblems = Object.entries(problemCatCounts).sort((a, b) => b[1].total - a[1].total);

    return {
      sorted, recommendations, totalCategorized: categorized.length, peakHour,
      peakDay: peakDay ? dayNames[Number(peakDay[0])] : null,
      sortedServices, totalServices: serviceTickets.length,
      sortedProblems, totalProblems: problemTickets.length,
    };
  }, [tickets]);

  /* ---------- helpers ---------- */
  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(ticket: Ticket) {
    setEditingId(ticket.id);
    setForm({
      request_type: ticket.request_type || "problem",
      client_name: ticket.client_name,
      client_phone: ticket.client_phone || "",
      issue: ticket.issue,
      issue_category: ticket.issue_category || "",
      issue_subcategory: ticket.issue_subcategory || "",
      open_time: ticket.open_time || "",
      priority: ticket.priority,
      status: ticket.status,
      assigned_agent_name: ticket.assigned_agent_name || "",
      open_date: ticket.open_date || "",
      due_date: ticket.due_date || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.client_name.trim() || !form.issue.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateTicket(editingId, {
          request_type: form.request_type,
          client_name: form.client_name,
          client_phone: form.client_phone,
          issue: form.issue,
          issue_category: form.issue_category || undefined,
          issue_subcategory: form.issue_subcategory || undefined,
          open_time: form.open_time || undefined,
          priority: form.priority,
          status: form.status,
          assigned_agent_name: form.assigned_agent_name,
          open_date: form.open_date || undefined,
          due_date: form.due_date || undefined,
        });
        setTickets((prev) => prev.map((t) => (t.id === editingId ? updated : t)));
      } else {
        const nextNumber =
          Math.max(0, ...tickets.map((t) => t.ticket_number ?? 0)) + 1;
        const created = await createTicket({
          ticket_number: nextNumber,
          request_type: form.request_type,
          client_name: form.client_name,
          client_phone: form.client_phone,
          issue: form.issue,
          issue_category: form.issue_category || undefined,
          issue_subcategory: form.issue_subcategory || undefined,
          open_time: form.open_time || undefined,
          priority: form.priority,
          status: form.status,
          assigned_agent_name: form.assigned_agent_name,
          open_date: form.open_date || undefined,
          due_date: form.due_date || undefined,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
        });
        setTickets((prev) => [created, ...prev]);
      }
      setDialogOpen(false);
      if (logsOpen) void loadActivityLogs();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: string) {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (deletingId) {
      try {
        await deleteTicket(deletingId);
        setTickets((prev) => prev.filter((t) => t.id !== deletingId));
        if (logsOpen) void loadActivityLogs();
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteDialogOpen(false);
    setDeletingId(null);
  }

  function updateField<K extends keyof TicketForm>(key: K, value: TicketForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ---------- color helpers ---------- */
  const PRIORITY_BADGE: Record<string, "red" | "amber" | "blue"> = {
    "عاجل": "red",
    "مرتفع": "amber",
    "عادي": "blue",
  };

  const STATUS_BADGE: Record<string, "red" | "amber" | "green"> = {
    "مفتوح": "red",
    "قيد الحل": "amber",
    "محلول": "green",
    "متأخر": "red",
  };

  function priorityColor(p: string): "red" | "amber" | "blue" {
    return PRIORITY_BADGE[p] ?? "blue";
  }

  function statusColor(s: string): "red" | "amber" | "green" {
    return STATUS_BADGE[s] ?? "green";
  }

  function dueDateStatus(dueDate?: string): "overdue" | "today" | "normal" {
    if (!dueDate) return "normal";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) return "overdue";
    if (due.getTime() === today.getTime()) return "today";
    return "normal";
  }

  const DUE_DATE_STYLES = {
    overdue: "text-cc-red font-bold",
    today: "text-amber font-bold",
    normal: "text-muted-foreground",
  };

  const DUE_DATE_DOT = {
    overdue: "bg-cc-red",
    today: "bg-amber",
    normal: "hidden",
  };

  const dailyQuote = getDailySupportQuote();

  /* ─── Quote Commitment ─── */
  const todayStr = new Date().toISOString().slice(0, 10);
  const [commitments, setCommitments] = useState<{ user_name: string; created_at: string }[]>([]);
  const myName = authUser?.name || authUser?.email || "";
  const hasCommitted = commitments.some((c) => c.user_name === myName);

  useEffect(() => {
    if (orgId) {
      fetchQuoteCommitments(orgId, todayStr, "support").then(setCommitments).catch(console.error);
    }
  }, [orgId, todayStr]);

  const toggleCommitment = useCallback(async () => {
    if (!orgId || !myName) return;
    try {
      if (hasCommitted) {
        await removeQuoteCommitment(orgId, myName, todayStr, "support");
        setCommitments((prev) => prev.filter((c) => c.user_name !== myName));
      } else {
        await addQuoteCommitment(orgId, myName, todayStr, "support");
        setCommitments((prev) => [...prev, { user_name: myName, created_at: new Date().toISOString() }]);
      }
    } catch (e) { console.error(e); }
  }, [orgId, myName, todayStr, hasCommitted]);

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="space-y-6">
      {/* -------- Header -------- */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">الدعم الفني</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4" data-icon="inline-start" />
          تذكرة جديدة
        </Button>
      </div>

      {/* -------- Daily Quote -------- */}
      <div className="cc-card rounded-[14px] p-4 border border-cyan/10 bg-gradient-to-l from-cyan/[0.04] to-transparent">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan/15 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed font-medium">
              &ldquo;{dailyQuote.text}&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-cyan font-medium">{dailyQuote.author}</span>
              <span className="text-[10px] text-muted-foreground">— {dailyQuote.book}</span>
            </div>
          </div>
          <button
            onClick={toggleCommitment}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all shrink-0 ${
              hasCommitted
                ? "bg-green-500/15 text-green-600 border border-green-500/30"
                : "bg-muted/50 text-muted-foreground border border-border hover:bg-cyan/10 hover:text-cyan hover:border-cyan/30"
            }`}
          >
            <ThumbsUp className={`w-3 h-3 ${hasCommitted ? "fill-green-500" : ""}`} />
            {hasCommitted ? "ملتزم" : "ألتزم"}
            {commitments.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-cyan/20 text-cyan text-[9px] font-bold">
                {commitments.length}
              </span>
            )}
          </button>
        </div>
        {commitments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 px-12">
            {commitments.map((c) => (
              <span key={c.user_name} className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                {c.user_name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* -------- Type Filter Pills -------- */}
      {!loading && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setTypeFilter(null); setCardFilter(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!typeFilter ? "bg-foreground/10 text-foreground" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"}`}
          >
            الكل ({monthTickets.length})
          </button>
          <button
            onClick={() => { setTypeFilter(typeFilter === "problem" ? null : "problem"); setCardFilter(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${typeFilter === "problem" ? "bg-cc-red/15 text-cc-red ring-1 ring-cc-red/30" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"}`}
          >
            <span className="w-2 h-2 rounded-full bg-cc-red" />
            مشاكل ({countProblems})
          </button>
          <button
            onClick={() => { setTypeFilter(typeFilter === "service" ? null : "service"); setCardFilter(null); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${typeFilter === "service" ? "bg-cc-blue/15 text-cc-blue ring-1 ring-cc-blue/30" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"}`}
          >
            <span className="w-2 h-2 rounded-full bg-cc-blue" />
            خدمات ({countServices})
          </button>
        </div>
      )}

      {/* -------- Status Cards -------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <SupportStatSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              value={String(countOpen)}
              label="مفتوحة"
              color="red"
              icon={<Inbox className="w-4 h-4 text-cc-red" />}
              onClick={() => setCardFilter(cardFilter === "مفتوح" ? null : "مفتوح")}
              active={cardFilter === "مفتوح"}
            />
            <StatCard
              value={String(countInProgress)}
              label="قيد الحل"
              color="amber"
              icon={<Clock className="w-4 h-4 text-amber" />}
              onClick={() => setCardFilter(cardFilter === "قيد الحل" ? null : "قيد الحل")}
              active={cardFilter === "قيد الحل"}
            />
            <StatCard
              value={String(countResolved)}
              label="محلولة"
              color="green"
              icon={<CheckCircle2 className="w-4 h-4 text-cc-green" />}
              onClick={() => setCardFilter(cardFilter === "محلول" ? null : "محلول")}
              active={cardFilter === "محلول"}
            />
            <StatCard
              value={String(countUrgent)}
              label="عاجلة"
              color="blue"
              icon={<AlertTriangle className="w-4 h-4 text-cc-blue" />}
              onClick={() => setCardFilter(cardFilter === "عاجل" ? null : "عاجل")}
              active={cardFilter === "عاجل"}
            />
          </>
        )}
      </div>

      {/* -------- Employee Filter -------- */}
      {!loading && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span className="font-medium">الموظف:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setAgentFilter(null)}
              className={`px-3 py-1.5 rounded-xl text-xs transition-all border ${
                !agentFilter ? "bg-cyan/15 text-cyan font-medium border-cyan/30" : "text-muted-foreground hover:text-foreground border-border"
              }`}
            >
              الكل
            </button>
            {[...new Set(monthTickets.map(t => t.assigned_agent_name).filter(Boolean))].map((name) => (
              <button
                key={name}
                onClick={() => setAgentFilter(agentFilter === name ? null : name!)}
                className={`px-3 py-1.5 rounded-xl text-xs transition-all border ${
                  agentFilter === name ? "bg-cyan/15 text-cyan font-medium border-cyan/30" : "text-muted-foreground hover:text-foreground border-border"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* -------- Achievement Summary -------- */}
      {!loading && (
        <AchievementSummary
          items={achievementItems}
          labels={{
            completed: "تذكرة محلولة",
            contacted: "قيد الحل",
            successRate: "نسبة الحل",
            lostRevenue: "غير محلولة",
            topRep: "تذكرة",
          }}
          onFilterChange={(filter, ids) => {
            setAchieveFilter(filter);
            setAchieveFilterIds(ids);
            if (filter) setCardFilter(null);
          }}
          activeFilter={achieveFilter}
          filteredCount={filteredTickets.length}
          tableAnchorId="tickets-table"
        />
      )}

      {/* -------- Issue Pattern Analytics -------- */}
      {!loading && issueAnalytics && (
        <div className="cc-card rounded-[14px] p-5 border border-amber/10 bg-gradient-to-l from-amber/[0.03] to-transparent">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-amber" />
            <h3 className="text-sm font-bold text-foreground">تحليل المشاكل المتكررة</h3>
            <span className="text-[10px] text-muted-foreground mr-auto">{issueAnalytics.totalCategorized} تذكرة مصنّفة</span>
          </div>

          {/* Category breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {issueAnalytics.sorted.map(([cat, data]) => {
              const resRate = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setCategoryFilter(categoryFilter === cat ? null : cat);
                    setCardFilter(null);
                    setAchieveFilter(null);
                    setTimeout(() => document.getElementById("tickets-table")?.scrollIntoView({ behavior: "smooth" }), 100);
                  }}
                  className={`p-3 rounded-[14px] text-center transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? "bg-cyan/10 border-2 border-cyan/40 ring-2 ring-cyan/20"
                      : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:scale-[1.02]"
                  }`}
                >
                  <span className="text-lg">{TICKET_CATEGORIES[cat]?.icon || "📋"}</span>
                  <p className="text-xl font-bold text-foreground mt-1">{data.total}</p>
                  <p className="text-[10px] text-muted-foreground">{cat}</p>
                  <div className="mt-1.5 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${resRate >= 70 ? "bg-emerald-500" : resRate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${resRate}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5">حل {resRate}%</p>
                  {data.urgent > 0 && (
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">{data.urgent} عاجل</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Time patterns */}
          {(issueAnalytics.peakHour || issueAnalytics.peakDay) && (
            <div className="flex flex-wrap gap-3 mb-4">
              {issueAnalytics.peakHour && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <Repeat className="w-3.5 h-3.5 text-cyan" />
                  <span className="text-xs text-foreground">ذروة المشاكل: <span className="font-bold text-cyan">{issueAnalytics.peakHour[0]}:00</span></span>
                </div>
              )}
              {issueAnalytics.peakDay && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                  <Repeat className="w-3.5 h-3.5 text-amber" />
                  <span className="text-xs text-foreground">أكثر يوم: <span className="font-bold text-amber">{issueAnalytics.peakDay}</span></span>
                </div>
              )}
            </div>
          )}

          {/* Recommendations */}
          {issueAnalytics.recommendations.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-4 h-4 text-amber" />
                <span className="text-xs font-bold text-foreground">توصيات للتحسين</span>
              </div>
              {issueAnalytics.recommendations.map((rec, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${
                    rec.priority === "high" ? "bg-red-500/5 border-red-500/15 text-red-300" :
                    rec.priority === "medium" ? "bg-amber/5 border-amber/15 text-amber" :
                    "bg-white/[0.03] border-white/[0.06] text-muted-foreground"
                  }`}
                >
                  <span className="shrink-0">{rec.icon}</span>
                  <span className="leading-relaxed">{rec.text}</span>
                  {rec.priority === "high" && (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mr-auto" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------- Service & Problem Breakdown -------- */}
      {!loading && issueAnalytics && (issueAnalytics.totalServices > 0 || issueAnalytics.totalProblems > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Services breakdown */}
          {issueAnalytics.totalServices > 0 && (
            <div className="cc-card rounded-[14px] p-5 border border-cc-blue/10 bg-gradient-to-l from-cc-blue/[0.03] to-transparent">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-cc-blue" />
                <h3 className="text-sm font-bold text-foreground">الخدمات الأكثر طلباً</h3>
                <span className="text-[10px] text-muted-foreground mr-auto">{issueAnalytics.totalServices} طلب خدمة</span>
              </div>
              <div className="space-y-2.5">
                {issueAnalytics.sortedServices.map(([cat, data]) => {
                  const resRate = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
                  const pct = issueAnalytics.totalServices > 0 ? Math.round((data.total / issueAnalytics.totalServices) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span>{SERVICE_CATEGORIES[cat]?.icon || "📝"}</span>
                          <span className="text-foreground font-medium">{cat}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">{data.total} طلب</span>
                          <span className={`text-[10px] font-bold ${resRate >= 70 ? "text-cc-green" : resRate >= 40 ? "text-amber" : "text-cc-red"}`}>
                            انجاز {resRate}%
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-cc-blue/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Overall service completion rate */}
              {(() => {
                const totalSvc = issueAnalytics.sortedServices.reduce((s, [, d]) => s + d.total, 0);
                const resolvedSvc = issueAnalytics.sortedServices.reduce((s, [, d]) => s + d.resolved, 0);
                const overallRate = totalSvc > 0 ? Math.round((resolvedSvc / totalSvc) * 100) : 0;
                return (
                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">معدل الإنجاز الكلي</span>
                    <span className={`text-sm font-bold ${overallRate >= 70 ? "text-cc-green" : overallRate >= 40 ? "text-amber" : "text-cc-red"}`}>
                      {overallRate}%
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Problems breakdown */}
          {issueAnalytics.totalProblems > 0 && (
            <div className="cc-card rounded-[14px] p-5 border border-cc-red/10 bg-gradient-to-l from-cc-red/[0.03] to-transparent">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-cc-red" />
                <h3 className="text-sm font-bold text-foreground">المشاكل الأكثر تكراراً</h3>
                <span className="text-[10px] text-muted-foreground mr-auto">{issueAnalytics.totalProblems} مشكلة</span>
              </div>
              <div className="space-y-2.5">
                {issueAnalytics.sortedProblems.map(([cat, data]) => {
                  const resRate = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;
                  const pct = issueAnalytics.totalProblems > 0 ? Math.round((data.total / issueAnalytics.totalProblems) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span>{PROBLEM_CATEGORIES[cat]?.icon || TICKET_CATEGORIES[cat]?.icon || "📋"}</span>
                          <span className="text-foreground font-medium">{cat}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">{data.total} مشكلة</span>
                          <span className={`text-[10px] font-bold ${resRate >= 70 ? "text-cc-green" : resRate >= 40 ? "text-amber" : "text-cc-red"}`}>
                            حل {resRate}%
                          </span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-cc-red/60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------- Tickets Table -------- */}
      <div id="tickets-table" ref={tableRef} className="cc-card rounded-[14px] overflow-x-auto">
        <div className="p-4 pb-0 space-y-3">
          {/* Status filter pills + share button */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium ml-1">الحالة:</span>
            <button
              onClick={() => { setCardFilter(null); setAchieveFilter(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                !cardFilter && !achieveFilter
                  ? "bg-foreground/10 text-foreground border-foreground/20"
                  : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border-transparent"
              }`}
            >
              الكل <span className="font-mono mr-1 opacity-70">{agentFilteredTickets.length}</span>
            </button>
            <button
              onClick={() => { setCardFilter(cardFilter === "مفتوح" ? null : "مفتوح"); setAchieveFilter(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${
                cardFilter === "مفتوح"
                  ? "bg-cc-red/15 text-cc-red border-cc-red/30 ring-1 ring-cc-red/20"
                  : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border-transparent"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cc-red" />
              مفتوح <span className="font-mono mr-1 opacity-70">{countOpen}</span>
            </button>
            <button
              onClick={() => { setCardFilter(cardFilter === "قيد الحل" ? null : "قيد الحل"); setAchieveFilter(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${
                cardFilter === "قيد الحل"
                  ? "bg-amber/15 text-amber border-amber/30 ring-1 ring-amber/20"
                  : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border-transparent"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber" />
              قيد الحل <span className="font-mono mr-1 opacity-70">{countInProgress}</span>
            </button>
            <button
              onClick={() => { setCardFilter(cardFilter === "محلول" ? null : "محلول"); setAchieveFilter(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${
                cardFilter === "محلول"
                  ? "bg-cc-green/15 text-cc-green border-cc-green/30 ring-1 ring-cc-green/20"
                  : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border-transparent"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cc-green" />
              محلول <span className="font-mono mr-1 opacity-70">{countResolved}</span>
            </button>
            <button
              onClick={() => { setCardFilter(cardFilter === "عاجل" ? null : "عاجل"); setAchieveFilter(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${
                cardFilter === "عاجل"
                  ? "bg-orange-500/15 text-orange-400 border-orange-400/30 ring-1 ring-orange-400/20"
                  : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] border-transparent"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              عاجل <span className="font-mono mr-1 opacity-70">{countUrgent}</span>
            </button>
            {/* Share button */}
            <button
              onClick={handleShareTable}
              disabled={isTableExporting}
              className="mr-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-cyan hover:bg-cyan/10 transition-colors disabled:opacity-50 border border-transparent hover:border-cyan/20"
              title="مشاركة الجدول كصورة"
            >
              {isTableExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
              )}
              مشاركة
            </button>
          </div>
          {/* Active category filter indicator */}
          {categoryFilter && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan/10 border border-cyan/20">
              <span className="text-xs text-cyan font-medium">
                {TICKET_CATEGORIES[categoryFilter]?.icon || "📋"} تصنيف: {categoryFilter}
              </span>
              <button
                onClick={() => setCategoryFilter(null)}
                className="mr-auto text-xs text-cyan hover:text-white font-medium px-2 py-1 rounded-md hover:bg-cyan/20 transition-colors"
              >
                ✕ إلغاء
              </button>
            </div>
          )}
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="ابحث باسم العميل أو رقم الجوال..."
              className="pr-9"
            />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">#</TableHead>
              <TableHead className="text-right">النوع</TableHead>
              <TableHead className="text-right">العميل</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الجوال</TableHead>
              <TableHead className="text-right">التصنيف</TableHead>
              <TableHead className="text-right">الوصف</TableHead>
              <TableHead className="text-right">موعد التسليم</TableHead>
              <TableHead className="text-right">الأولوية</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">الموظف</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-10" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-6 w-14 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-36" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-6 w-14 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-6 w-16 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-20" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1">
                      <Skeleton className="h-7 w-7 rounded-md" />
                      <Skeleton className="h-7 w-7 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredTickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  {cardFilter ? `لا توجد تذاكر "${cardFilter}"` : "لا توجد تذاكر"}
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {ticket.ticket_number}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      (ticket.request_type || "problem") === "service"
                        ? "bg-cc-blue/10 text-cc-blue"
                        : "bg-cc-red/10 text-cc-red"
                    }`}>
                      {(ticket.request_type || "problem") === "service" ? "خدمة" : "مشكلة"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {ticket.client_name}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    <div>{ticket.open_date ? formatDate(ticket.open_date) : "—"}</div>
                    {ticket.open_time && <div className="text-[10px] text-muted-foreground/70" dir="ltr">{ticket.open_time}</div>}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground" dir="ltr">
                    {ticket.client_phone ? formatPhone(ticket.client_phone) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {ticket.issue_category ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan/10 text-cyan text-[10px] font-medium">
                        {TICKET_CATEGORIES[ticket.issue_category]?.icon} {ticket.issue_category}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                    {ticket.issue_subcategory && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{ticket.issue_subcategory}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs max-w-[200px] truncate">
                    {ticket.issue}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {ticket.due_date ? (
                      <span className={`flex items-center gap-1.5 ${DUE_DATE_STYLES[dueDateStatus(ticket.due_date)]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DUE_DATE_DOT[dueDateStatus(ticket.due_date)]}`} />
                        {formatDate(ticket.due_date)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <ColorBadge
                      text={ticket.priority}
                      color={priorityColor(ticket.priority)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <ColorBadge
                      text={ticket.status}
                      color={statusColor(ticket.status)}
                    />
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {ticket.assigned_agent_name || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1">
                      <FollowUpLogButton
                        entityType="ticket"
                        entityId={ticket.id}
                        entityName={ticket.client_name}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEditDialog(ticket)}
                        title="تعديل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => confirmDelete(ticket.id)}
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* -------- Activity Tracking Log -------- */}
      <div className="cc-card rounded-[14px] overflow-hidden">
        <button
          onClick={() => setLogsOpen(!logsOpen)}
          className="w-full flex items-center gap-3 p-4 text-right hover:bg-white/[0.02] transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center ring-1 ring-orange-500/20">
            <ScrollText className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">سجل التتبع</h3>
            <p className="text-[11px] text-muted-foreground">جميع العمليات على التذاكر (إضافة، تعديل، حذف)</p>
          </div>
          {activityLogs.length > 0 && (
            <span className="text-[10px] bg-orange-500/10 text-orange-400 rounded-full px-2.5 py-0.5 font-medium">
              {activityLogs.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${logsOpen ? "rotate-180" : ""}`} />
        </button>

        {logsOpen && (
          <div className="border-t border-border px-4 pb-4">
            {/* Time Filter */}
            <div className="flex items-center gap-2 py-3">
              {([
                { key: "all" as const, label: "الكل" },
                { key: "today" as const, label: "اليوم" },
                { key: "week" as const, label: "هذا الأسبوع" },
              ]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setLogFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    logFilter === f.key
                      ? "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20"
                      : "bg-white/[0.04] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={loadActivityLogs}
                className="mr-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                تحديث
              </button>
            </div>

            {logsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  </TableRow>
                ))}
              </div>
            ) : (() => {
              const isLogToday = (dateStr: string) => {
                const d = new Date(dateStr);
                const now = new Date();
                return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
              };
              const isLogThisWeek = (dateStr: string) => {
                const d = new Date(dateStr);
                const now = new Date();
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                return d >= startOfWeek;
              };

              const filtered = logFilter === "today"
                ? activityLogs.filter(l => isLogToday(l.created_at))
                : logFilter === "week"
                  ? activityLogs.filter(l => isLogThisWeek(l.created_at))
                  : activityLogs;

              if (filtered.length === 0) {
                return (
                  <div className="py-8 text-center">
                    <ScrollText className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">لا توجد عمليات مسجلة</p>
                  </div>
                );
              }

              const ACTION_CONFIG: Record<string, { label: string; icon: typeof Plus; bg: string; dot: string }> = {
                create: { label: "إضافة", icon: Plus, bg: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
                update: { label: "تحديث", icon: Pencil, bg: "bg-amber-500/10 text-amber-400", dot: "bg-amber-400" },
                delete: { label: "حذف", icon: Trash2, bg: "bg-red-500/10 text-red-400", dot: "bg-red-400" },
              };

              return (
                <div className="space-y-4">
                  {/* Action Summary */}
                  <div className="grid grid-cols-3 gap-2">
                    {(["create", "update", "delete"] as const).map((action) => {
                      const config = ACTION_CONFIG[action];
                      const Icon = config.icon;
                      const count = filtered.filter(l => l.action === action).length;
                      return (
                        <div key={action} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
                          <div className="flex justify-center mb-1.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.bg}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <p className="text-lg font-extrabold text-foreground font-mono">{count}</p>
                          <p className="text-[10px] text-muted-foreground">{config.label}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Table View */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">الإجراء</TableHead>
                          <TableHead className="text-right">التذكرة</TableHead>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-right">التفاصيل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.slice(0, 50).map((log) => {
                          const config = ACTION_CONFIG[log.action];
                          const ActionIcon = config.icon;
                          const logDate = new Date(log.created_at);
                          const dateStr = formatDate(logDate.toISOString().slice(0, 10));
                          const timeStr = logDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-right text-xs">
                                <div className="text-foreground">{dateStr}</div>
                                <div className="text-[10px] text-muted-foreground/70">{timeStr}</div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${config.bg}`}>
                                  <ActionIcon className="w-3 h-3" />
                                  {config.label}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-xs font-medium">
                                {log.entity_title || "تذكرة"}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {log.user_name ? (
                                  <span className="inline-flex items-center gap-1 text-cyan-400/80">
                                    <User className="w-3 h-3" />
                                    {log.user_name}
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground max-w-[250px] truncate">
                                {log.details || "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {filtered.length > 50 && (
                    <p className="text-center text-[11px] text-muted-foreground">يتم عرض آخر 50 عملية من أصل {filtered.length}</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* -------- Create / Edit Dialog -------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "تعديل التذكرة" : "تذكرة جديدة"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "قم بتعديل بيانات التذكرة ثم اضغط حفظ."
                : "أدخل بيانات التذكرة الجديدة."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-2 md:grid-cols-2">
            {/* نوع الطلب */}
            <div className="space-y-1.5 md:col-span-2">
              <Label>نوع الطلب</Label>
              <div className="flex gap-2">
                {REQUEST_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    type="button"
                    onClick={() => {
                      updateField("request_type", rt.value as "problem" | "service");
                      updateField("issue_category", "");
                      updateField("issue_subcategory", "");
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                      form.request_type === rt.value
                        ? rt.value === "problem"
                          ? "bg-cc-red/15 text-cc-red ring-1 ring-cc-red/30"
                          : "bg-cc-blue/15 text-cc-blue ring-1 ring-cc-blue/30"
                        : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
                    }`}
                  >
                    <span>{rt.icon}</span>
                    <span>{rt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* اسم العميل */}
            <div className="space-y-1.5">
              <Label htmlFor="client_name">اسم العميل</Label>
              <Input
                id="client_name"
                value={form.client_name}
                onChange={(e) => updateField("client_name", e.target.value)}
                placeholder="اسم العميل"
              />
            </div>

            {/* رقم الجوال */}
            <div className="space-y-1.5">
              <Label htmlFor="client_phone">رقم الجوال</Label>
              <Input
                id="client_phone"
                value={form.client_phone}
                onChange={(e) => updateField("client_phone", e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
            </div>

            {/* تصنيف */}
            <div className="space-y-1.5">
              <Label>{form.request_type === "service" ? "نوع الخدمة" : "تصنيف المشكلة"}</Label>
              <Select
                value={form.issue_category}
                onValueChange={(val) => { updateField("issue_category", val ?? ""); updateField("issue_subcategory", ""); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر التصنيف" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(form.request_type === "service" ? SERVICE_CATEGORIES : PROBLEM_CATEGORIES).map(([key, cat]) => (
                    <SelectItem key={key} value={key}>
                      {cat.icon} {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* التصنيف الفرعي */}
            <div className="space-y-1.5">
              <Label>التصنيف الفرعي</Label>
              <Select
                value={form.issue_subcategory}
                onValueChange={(val) => updateField("issue_subcategory", val ?? "")}
                disabled={!form.issue_category}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={form.issue_category ? "اختر التفصيل" : "اختر التصنيف أولاً"} />
                </SelectTrigger>
                <SelectContent>
                  {form.issue_category && TICKET_CATEGORIES[form.issue_category]?.subcategories.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الوصف */}
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="issue">{form.request_type === "service" ? "تفاصيل الخدمة" : "وصف المشكلة"}</Label>
              <Textarea
                id="issue"
                value={form.issue}
                onChange={(e) => updateField("issue", e.target.value)}
                placeholder={form.request_type === "service" ? "صف الخدمة المطلوبة بالتفصيل..." : "صف المشكلة بالتفصيل..."}
                rows={3}
              />
            </div>

            {/* الأولوية */}
            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select
                value={form.priority}
                onValueChange={(val) => val && updateField("priority", val as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الأولوية" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الحالة */}
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select
                value={form.status}
                onValueChange={(val) => val && updateField("status", val as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الحالة" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الموظف */}
            <div className="space-y-1.5">
              <Label>الموظف</Label>
              <Select
                value={form.assigned_agent_name}
                onValueChange={(val) =>
                  val && updateField("assigned_agent_name", val as string)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.name}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* تاريخ الفتح + الساعة */}
            <div className="space-y-1.5">
              <Label htmlFor="open_date">تاريخ الفتح</Label>
              <div className="flex gap-2">
                <Input
                  id="open_date"
                  type="date"
                  value={form.open_date}
                  onChange={(e) => updateField("open_date", e.target.value)}
                  dir="ltr"
                  className="flex-1"
                />
                <Input
                  id="open_time"
                  type="time"
                  value={form.open_time}
                  onChange={(e) => updateField("open_time", e.target.value)}
                  dir="ltr"
                  className="w-[120px]"
                />
              </div>
            </div>

            {/* موعد التسليم */}
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="due_date">موعد التسليم</Label>
              <Input
                id="due_date"
                type="date"
                value={form.due_date}
                onChange={(e) => updateField("due_date", e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إنشاء التذكرة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- Delete Confirmation Dialog -------- */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذه التذكرة؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupportStatSkeleton() {
  return (
    <div className="cc-card rounded-[14px] p-4 border-t-2 border-t-muted">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>
    </div>
  );
}
