"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { dateToLocal } from "@/lib/utils/format";
import {
  fetchTargetClients,
  createTargetClient,
  updateTargetClient,
  deleteTargetClient,
  setDailyTargets,
  clearDailyTarget,
  fetchSubscriberCandidates,
  importSubscribersToTargeting,
  fetchTargetClientLogs,
  addTargetClientLog,
  transferTargetClient,
  fetchTodayUpgrades,
} from "@/lib/supabase/db";
import {
  diffAgainstExisting,
  SOURCE_RENEWALS,
  SOURCE_SUPPORT,
  type SubscriberCandidate,
} from "@/lib/targeting-subscribers";
import { PLANS } from "@/lib/utils/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TargetClient, TargetClientLog } from "@/types";
import {
  Target,
  Plus,
  Phone,
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  PhoneOff,
  Trash2,
  Pencil,
  Users,
  PhoneCall,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Search,
  CalendarDays,
  Quote,
  Sparkles,
  ExternalLink,
  UserPlus,
  Lightbulb,
  History,
  ArrowLeftRight,
  StickyNote,
  Trophy,
  Wand2,
} from "lucide-react";

/* ---------- constants ---------- */

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const CONTACT_STATUS = {
  pending: { label: "لم يتم التواصل", color: "text-muted-foreground", bg: "bg-white/5", icon: Clock },
  contacted: { label: "تم التواصل", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  no_answer: { label: "لم يرد", color: "text-amber-400", bg: "bg-amber-500/10", icon: PhoneOff },
  postponed: { label: "مؤجل", color: "text-sky-400", bg: "bg-sky-500/10", icon: Clock },
} as const;

const SATISFACTION = {
  very_satisfied: { label: "راضي جداً", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: ThumbsUp },
  satisfied: { label: "راضي", color: "text-cyan-400", bg: "bg-cyan-500/10", icon: ThumbsUp },
  neutral: { label: "متوسط", color: "text-amber-400", bg: "bg-amber-500/10", icon: Minus },
  needs_improvement: { label: "يحتاج تطوير", color: "text-orange-400", bg: "bg-orange-500/10", icon: ThumbsDown },
  unsatisfied: { label: "غير راضي", color: "text-red-400", bg: "bg-red-500/10", icon: ThumbsDown },
} as const;

type ContactStatus = keyof typeof CONTACT_STATUS;
type SatisfactionResult = keyof typeof SATISFACTION;
type ViewFilter = "all" | "daily" | "subscribers" | "expiring" | "transferred" | "pending" | "contacted" | "no_answer" | "postponed";

const DESTINATIONS = {
  support: { label: "مبيعات الدعم", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  renewals: { label: "التجديدات", color: "text-sky-400", bg: "bg-sky-500/10" },
} as const;

const TRANSFER_PLANS = ["الكاشير + بطاقات الولاء", "الكاشير", "بطاقات الولاء", ...PLANS.filter((p) => p !== "الكاشير")];

const EMPTY_TRANSFER = {
  destination: "support" as keyof typeof DESTINATIONS,
  plan: TRANSFER_PLANS[0],
  value: "",
  assigned_rep: "",
  note: "",
};

/** Days from today until the given YYYY-MM-DD (negative = already past). */
function daysUntil(date: string, todayStr: string) {
  return Math.round((new Date(date).getTime() - new Date(todayStr).getTime()) / 86_400_000);
}

function expiryInfo(date: string, todayStr: string) {
  const days = daysUntil(date, todayStr);
  const formatted = new Date(date).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "short", year: "numeric" });
  if (days < 0) return { days, formatted, label: `منتهي منذ ${-days} يوم`, color: "text-red-400", bg: "bg-red-500/10" };
  if (days === 0) return { days, formatted, label: "ينتهي اليوم", color: "text-red-400", bg: "bg-red-500/10" };
  if (days <= 30) return { days, formatted, label: `باقي ${days} يوم`, color: "text-amber-400", bg: "bg-amber-500/10" };
  return { days, formatted, label: `باقي ${days} يوم`, color: "text-muted-foreground", bg: "bg-white/5" };
}

function formatLogTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ar-SA-u-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** الهدف اليومي: عدد الترقيات الناجحة لكل موظف. */
const DAILY_UPGRADE_GOAL = 3;
/** عدد العملاء المقترح اختيارهم يومياً لتحقيق الهدف. */
const SUGGESTED_DAILY_PICK = 10;

const PRIORITY = {
  high: { label: "أولوية عالية", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  medium: { label: "أولوية متوسطة", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  low: { label: "حل المشكلة أولاً", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
} as const;

const DAILY_QUOTES = [
  { text: "أنت لا تبيع منتجاً فقط، أنت تصنع تجربة — اجعلها تجربة لا تُنسى!", author: "توني هسيه", book: "توصيل السعادة" },
  { text: "أفضل إعلان لك هو عميل راضٍ — كل مكالمة تقوم بها اليوم قد تصنع سفيراً جديداً لك", author: "بيل غيتس", book: "الأعمال بسرعة الفكر" },
  { text: "العميل الذي يشتكي يمنحك فرصة ذهبية — اغتنمها وحوّله إلى أكبر معجبيك", author: "بيل غيتس", book: "الأعمال بسرعة الفكر" },
  { text: "اقترب من عملائك لدرجة أن تفهم احتياجاتهم قبل أن يعبّروا عنها — هذا هو التميز الحقيقي", author: "ستيف جوبز", book: "فلسفة Apple" },
  { text: "خدمة العملاء ليست مجرد وظيفة، بل هي فرصتك لتترك أثراً إيجابياً في حياة شخص آخر", author: "توني هسيه", book: "توصيل السعادة" },
  { text: "كل تواصل مع العميل هو فرصة لبناء ولاء يدوم سنوات — قدّم أفضل ما لديك!", author: "شيب هايكن", book: "كن مذهلاً" },
  { text: "الخدمة المتميزة تبدأ منك أنت — ابتسامتك وحماسك يصنعان الفرق الذي يشعر به العميل", author: "ريتشارد برانسون", book: "أسلوب فيرجن" },
  { text: "لا تقيس نجاحك بعدد المبيعات فقط، بل بعدد العملاء الذين يعودون إليك بثقة", author: "فريد رايكهيلد", book: "السؤال الحاسم" },
  { text: "التجربة التي تقدمها أهم من المنتج نفسه — أنت من يصنع هذه التجربة بلمستك الشخصية", author: "توني هسيه", book: "توصيل السعادة" },
  { text: "عندما تهتم بعملائك الحاليين من قلبك، العملاء الجدد سيأتون تلقائياً — ثق بذلك", author: "مايكل لوبوف", book: "كيف تكسب العملاء مدى الحياة" },
  { text: "الولاء لا يُشترى بالخصومات، بل يُبنى بالاهتمام الصادق — وأنت قادر على ذلك", author: "فريد رايكهيلد", book: "تأثير الولاء" },
  { text: "استمع بقلبك قبل أذنك — العميل يحتاج من يفهمه وأنت أفضل من يفعل ذلك", author: "ديل كارنيغي", book: "كيف تكسب الأصدقاء" },
  { text: "العميل الذي يعود إليك هو أعظم شهادة على تميزك — واصل ما تفعله!", author: "مايكل لوبوف", book: "كيف تكسب العملاء مدى الحياة" },
  { text: "عامل كل عميل كأنه الوحيد — لأنه في تلك اللحظة هو بالفعل أهم شخص", author: "غاري فاينرتشوك", book: "اقتصاد الشكر" },
  { text: "العملاء ينسون ما قلته، لكنهم لا ينسون أبداً كيف جعلتهم يشعرون — اجعلهم يشعرون بالتقدير", author: "مايا أنجيلو", book: "حكم الحياة" },
  { text: "الجودة الحقيقية هي أن يعود العميل إليك باختياره — وهذا يبدأ بتواصلك معه اليوم", author: "هيرمان تيتز", book: "أساسيات التجارة" },
  { text: "كل مشكلة عميل هي فرصتك لتتألق — حوّل التحدي إلى قصة نجاح!", author: "شيب هايكن", book: "ثورة الدهشة" },
  { text: "إذا لم تعتنِ بعميلك اليوم، سيفعل منافسك غداً — كن الأفضل دائماً", author: "بوب هوي", book: "استراتيجية الخدمة" },
  { text: "استثمارك في رضا العميل هو أذكى استثمار — عميل سعيد يساوي عشرة إعلانات", author: "توني هسيه", book: "توصيل السعادة" },
  { text: "العميل لا يهمه كم تعرف، حتى يعرف كم تهتم — أظهر اهتمامك في كل مكالمة", author: "ديل كارنيغي", book: "كيف تكسب الأصدقاء" },
  { text: "أنت لست مجرد موظف خدمة — أنت سفير الشركة وصانع الانطباع الأول والأخير", author: "ريتشارد برانسون", book: "أسلوب فيرجن" },
  { text: "النجاح الحقيقي هو أن يختارك العميل مرة أخرى رغم وجود خيارات — كن الخيار الأول دائماً!", author: "شيب هايكن", book: "كن مذهلاً" },
  { text: "أعظم أصول الشركة هي عملاؤها — وأنت حارس هذا الكنز ومفتاح نموّه", author: "مايكل لوبوف", book: "كيف تكسب العملاء مدى الحياة" },
  { text: "اصنع عميلاً مدى الحياة وليس مجرد صفقة — العلاقات أثمن من الأرقام", author: "كاثرين بارشيتي", book: "فن البيع" },
  { text: "حماسك مُعدٍ — عندما تتحدث بشغف عن خدمتك، العميل يشعر بذلك ويثق بك أكثر", author: "زيغ زيغلار", book: "أسرار إنهاء الصفقات" },
  { text: "لا تخف من المتابعة — العميل يقدّر من يتذكره ويسأل عنه، هذا يصنع الفرق", author: "جيفري غيتومر", book: "كتاب البيع الصغير" },
  { text: "كل يوم هو فرصة جديدة لتجعل عميلاً يبتسم — ابدأ يومك بهذه النية وسترى النتائج", author: "شيب هايكن", book: "ثورة الدهشة" },
  { text: "التميز ليس فعلاً واحداً، بل عادة يومية — قدّم أفضل خدمة في كل تواصل", author: "أرسطو", book: "فلسفة التميز" },
  { text: "العميل الراضي يخبر ثلاثة، والعميل المبهور يخبر عشرة — اسعَ دائماً للإبهار!", author: "فيليب كوتلر", book: "إدارة التسويق" },
  { text: "أنت تملك القدرة على تحويل يوم عميلك من عادي إلى استثنائي — استخدم هذه القوة!", author: "غاري فاينرتشوك", book: "اقتصاد الشكر" },
  { text: "الاحتفاظ بعميل واحد أقوى من جلب عشرة — ركّز على من يثق بك واجعله يبقى", author: "فيليب كوتلر", book: "إدارة التسويق" },
];

function getDailyQuote() {
  const start = new Date(2025, 0, 1).getTime();
  const now = new Date().getTime();
  const dayIndex = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return DAILY_QUOTES[dayIndex % DAILY_QUOTES.length];
}

const EMPTY_FORM = {
  client_name: "",
  client_phone: "",
  plan: "",
  source: "",
  assigned_rep: "",
  notes: "",
  expiry_date: "",
};

/* ---------- page ---------- */

export default function TargetingPage() {
  const { activeOrgId, user } = useAuth();
  const authorName = user?.name || "—";
  const router = useRouter();
  const today = new Date();

  /* Open a deal-linked client back in its sales table, flashing the row. */
  function openDeal(c: TargetClient) {
    if (!c.deal_id) return;
    const base = c.sales_type === "support" ? "/support-sales" : "/sales";
    router.push(`${base}?deal=${c.deal_id}`);
  }
  const todayStr = dateToLocal(today);

  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [clients, setClients] = useState<TargetClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Contact modal
  const [contactOpen, setContactOpen] = useState(false);
  const [contactClient, setContactClient] = useState<TargetClient | null>(null);
  const [contactStatus, setContactStatus] = useState<ContactStatus>("contacted");
  const [satisfactionResult, setSatisfactionResult] = useState<SatisfactionResult | "">("");
  const [contactNotes, setContactNotes] = useState("");

  // Selection for daily targets
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Import subscribers (renewals basic plan + support sales)
  const [importOpen, setImportOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [candidates, setCandidates] = useState<SubscriberCandidate[]>([]);
  const [importError, setImportError] = useState("");

  // Per-client log
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsClient, setLogsClient] = useState<TargetClient | null>(null);
  const [logs, setLogs] = useState<TargetClientLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [newLogNote, setNewLogNote] = useState("");

  // Transfer (client agreed) → مبيعات الدعم / التجديدات
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferClient, setTransferClient] = useState<TargetClient | null>(null);
  const [transferForm, setTransferForm] = useState(EMPTY_TRANSFER);
  const [transferError, setTransferError] = useState("");

  // Today's successful upgrades (all months), for the daily goal
  const [todayUpgrades, setTodayUpgrades] = useState<{ transferred_by: string | null }[]>([]);

  // Daily quote
  const quote = getDailyQuote();

  /* ---------- fetch ---------- */
  useEffect(() => {
    setLoading(true);
    fetchTargetClients(month, year)
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeOrgId, month, year]);

  useEffect(() => {
    fetchTodayUpgrades().then(setTodayUpgrades).catch(console.error);
  }, [activeOrgId]);

  /* ---------- computed ---------- */
  const filtered = useMemo(() => {
    let list = clients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.client_name.toLowerCase().includes(q) || c.client_phone?.includes(q)
      );
    }
    if (viewFilter === "daily") list = list.filter((c) => c.target_date === todayStr);
    else if (viewFilter === "subscribers") {
      const order = { high: 0, medium: 1, low: 2 } as const;
      list = list
        .filter((c) => c.recommendation)
        .sort((a, b) => order[a.recommendation_priority ?? "medium"] - order[b.recommendation_priority ?? "medium"]);
    }
    else if (viewFilter === "expiring") {
      list = list
        .filter((c) => c.expiry_date && daysUntil(c.expiry_date, todayStr) <= 30)
        .sort((a, b) => (a.expiry_date ?? "").localeCompare(b.expiry_date ?? ""));
    }
    else if (viewFilter === "transferred") list = list.filter((c) => c.transferred_to);
    else if (viewFilter === "pending") list = list.filter((c) => c.contact_status === "pending");
    else if (viewFilter === "contacted") list = list.filter((c) => c.contact_status === "contacted");
    else if (viewFilter === "no_answer") list = list.filter((c) => c.contact_status === "no_answer");
    else if (viewFilter === "postponed") list = list.filter((c) => c.contact_status === "postponed");
    return list;
  }, [clients, search, viewFilter, todayStr]);

  const totalCount = clients.length;
  const dailyCount = clients.filter((c) => c.target_date === todayStr).length;
  const contactedCount = clients.filter((c) => c.contact_status === "contacted").length;
  const pendingCount = clients.filter((c) => c.contact_status === "pending").length;

  const subscribersCount = clients.filter((c) => c.recommendation).length;
  const myUpgradesToday = todayUpgrades.filter((u) => u.transferred_by === authorName).length;
  const teamUpgradesToday = todayUpgrades.length;
  const myDaily = clients.filter((c) => c.target_date === todayStr && c.target_by === authorName);
  const myDailyContacted = myDaily.filter((c) => c.contact_status !== "pending").length;
  const goalPct = Math.min(100, Math.round((myUpgradesToday / DAILY_UPGRADE_GOAL) * 100));
  const transferredCount = clients.filter((c) => c.transferred_to).length;
  const expiringCount = clients.filter((c) => c.expiry_date && daysUntil(c.expiry_date, todayStr) <= 30).length;

  const importPreview = useMemo(() => {
    const { toInsert, toRefresh } = diffAgainstExisting(candidates, clients);
    return {
      toInsert,
      refresh: toRefresh.length,
      fromRenewals: candidates.filter((c) => c.source.includes(SOURCE_RENEWALS)).length,
      fromSupport: candidates.filter((c) => c.source.includes(SOURCE_SUPPORT)).length,
      high: candidates.filter((c) => c.recommendation_priority === "high").length,
    };
  }, [candidates, clients]);

  /* ---------- handlers ---------- */
  async function openImport() {
    setImportOpen(true);
    setImportError("");
    setImportLoading(true);
    try {
      setCandidates(await fetchSubscriberCandidates());
    } catch (err) {
      console.error(err);
      setImportError("تعذّر جلب العملاء المشتركين");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setImportError("");
    try {
      await importSubscribersToTargeting(candidates, clients, month, year);
      setClients(await fetchTargetClients(month, year));
      setImportOpen(false);
      setViewFilter("subscribers");
    } catch (err) {
      console.error(err);
      setImportError("تعذّر نقل العملاء، حاول مرة أخرى");
    } finally {
      setImporting(false);
    }
  }

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }

  function openEdit(c: TargetClient) {
    setEditingId(c.id);
    setForm({
      client_name: c.client_name,
      client_phone: c.client_phone || "",
      plan: c.plan || "",
      source: c.source || "",
      assigned_rep: c.assigned_rep || "",
      notes: c.notes || "",
      expiry_date: c.expiry_date || "",
    });
    setAddOpen(true);
  }

  async function handleSave() {
    if (!form.client_name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateTargetClient(editingId, {
          client_name: form.client_name,
          client_phone: form.client_phone || undefined,
          plan: form.plan || undefined,
          source: form.source || undefined,
          assigned_rep: form.assigned_rep || undefined,
          notes: form.notes || undefined,
          expiry_date: form.expiry_date || null,
        });
        setClients((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const created = await createTargetClient({
          client_name: form.client_name,
          client_phone: form.client_phone || undefined,
          plan: form.plan || undefined,
          source: form.source || undefined,
          month,
          year,
          contact_status: "pending",
          assigned_rep: form.assigned_rep || undefined,
          notes: form.notes || undefined,
          expiry_date: form.expiry_date || undefined,
        });
        setClients((prev) => [created, ...prev]);
      }
      setAddOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function openContact(c: TargetClient) {
    setContactClient(c);
    setContactStatus(c.contact_status === "pending" ? "contacted" : c.contact_status as ContactStatus);
    setSatisfactionResult((c.satisfaction_result as SatisfactionResult) || "");
    setContactNotes(c.notes || "");
    setContactOpen(true);
  }

  async function handleContactSave() {
    if (!contactClient) return;
    setSaving(true);
    try {
      const updated = await updateTargetClient(contactClient.id, {
        contact_status: contactStatus,
        satisfaction_result: satisfactionResult || undefined,
        notes: contactNotes || undefined,
      });
      setClients((prev) => prev.map((c) => (c.id === contactClient.id ? updated : c)));
      addTargetClientLog({
        client_id: contactClient.id,
        kind: "contact",
        contact_status: contactStatus,
        satisfaction_result: satisfactionResult || undefined,
        note: contactNotes || undefined,
        author_name: authorName,
      }).catch(console.error);
      setContactOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function openLogs(c: TargetClient) {
    setLogsClient(c);
    setLogs([]);
    setNewLogNote("");
    setLogsOpen(true);
    setLogsLoading(true);
    try {
      setLogs(await fetchTargetClientLogs(c.id));
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleAddLogNote() {
    if (!logsClient || !newLogNote.trim()) return;
    setSaving(true);
    try {
      const created = await addTargetClientLog({
        client_id: logsClient.id,
        kind: "note",
        note: newLogNote.trim(),
        author_name: authorName,
      });
      setLogs((prev) => [created, ...prev]);
      setNewLogNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function openTransfer(c: TargetClient) {
    setTransferClient(c);
    setTransferError("");
    setTransferForm({
      ...EMPTY_TRANSFER,
      // Basic-plan renewal subscribers upgrade through التجديدات; the rest through مبيعات الدعم.
      destination: c.source?.startsWith("التجديدات") ? "renewals" : "support",
      assigned_rep: c.assigned_rep || "",
    });
    setTransferOpen(true);
  }

  async function handleTransfer() {
    if (!transferClient) return;
    const value = Number(transferForm.value);
    if (!transferForm.plan || !Number.isFinite(value) || value <= 0) {
      setTransferError("اختر الباقة وأدخل القيمة");
      return;
    }
    setSaving(true);
    setTransferError("");
    try {
      const updated = await transferTargetClient(transferClient, {
        destination: transferForm.destination,
        plan: transferForm.plan,
        value,
        assignedRep: transferForm.assigned_rep.trim() || undefined,
        note: transferForm.note.trim() || undefined,
        author: authorName,
      });
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setTodayUpgrades((prev) => [...prev, { transferred_by: authorName }]);
      setTransferOpen(false);
    } catch (err) {
      console.error(err);
      setTransferError("تعذّر النقل، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  }

  function openTransferred(c: TargetClient) {
    if (c.transferred_to === "support" && c.transferred_ref) {
      router.push(`/support-sales?deal=${c.transferred_ref}`);
    } else if (c.transferred_to === "renewals") {
      router.push(`/renewals?profile=${encodeURIComponent(c.client_phone || c.client_name)}`);
    }
  }

  /** Pick the best not-yet-contacted clients from the current view. */
  function selectSuggested() {
    const order = { high: 0, medium: 1, low: 2 } as const;
    const picks = filtered
      .filter((c) => !c.transferred_to && c.contact_status === "pending" && c.target_date !== todayStr)
      .sort(
        (a, b) =>
          order[a.recommendation_priority ?? "medium"] - order[b.recommendation_priority ?? "medium"] ||
          (a.expiry_date ?? "9999").localeCompare(b.expiry_date ?? "9999")
      )
      .slice(0, SUGGESTED_DAILY_PICK);
    setSelectedIds(new Set(picks.map((c) => c.id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSetDailyTargets() {
    if (selectedIds.size === 0) return;
    try {
      await setDailyTargets(Array.from(selectedIds), todayStr, authorName);
      setClients((prev) =>
        prev.map((c) => (selectedIds.has(c.id) ? { ...c, target_date: todayStr, target_by: authorName } : c))
      );
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleClearDaily(id: string) {
    try {
      await clearDailyTarget(id);
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, target_date: undefined, target_by: null } : c))
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteTargetClient(deleteId);
      setClients((prev) => prev.filter((c) => c.id !== deleteId));
    } catch (err) {
      console.error(err);
    }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  /* ---------- render ---------- */
  const FILTERS: { key: ViewFilter; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "daily", label: "هدف اليوم" },
    { key: "subscribers", label: "المشتركين (ولاء + كاشير)" },
    { key: "expiring", label: "ينتهي خلال 30 يوم" },
    { key: "transferred", label: "وافق وتم نقله" },
    { key: "pending", label: "لم يتم التواصل" },
    { key: "contacted", label: "تم التواصل" },
    { key: "no_answer", label: "لم يرد" },
    { key: "postponed", label: "مؤجل" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-fuchsia-500/15 flex items-center justify-center">
          <Target className="w-4 h-4 text-fuchsia-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">قائمة الاستهداف الشهرية</h1>
          <p className="text-xs text-muted-foreground">
            حدد العملاء المستهدفين شهرياً وتواصل معهم يومياً لمعرفة رضاهم
          </p>
        </div>
      </div>

      {/* Daily motivational quote */}
      <div className="cc-card rounded-[14px] p-5 border border-fuchsia-500/10 bg-gradient-to-l from-fuchsia-500/[0.04] to-transparent">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-fuchsia-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-fuchsia-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed font-medium">
              &ldquo;{quote.text}&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-fuchsia-400 font-medium">{quote.author}</span>
              <span className="text-[12px] text-muted-foreground">— {quote.book}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily upgrade goal */}
      <div className="cc-card rounded-[14px] p-5 border border-emerald-500/15">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-foreground">
                هدفك اليوم: {DAILY_UPGRADE_GOAL} ترقيات ناجحة
              </p>
              <p className={`text-sm font-extrabold ${myUpgradesToday >= DAILY_UPGRADE_GOAL ? "text-emerald-400" : "text-foreground"}`}>
                {myUpgradesToday} / {DAILY_UPGRADE_GOAL}
              </p>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${myUpgradesToday >= DAILY_UPGRADE_GOAL ? "bg-emerald-500" : "bg-emerald-500/70"}`}
                style={{ width: `${goalPct}%` }}
              />
            </div>
            <p className="text-[12px] text-muted-foreground">
              {myUpgradesToday >= DAILY_UPGRADE_GOAL
                ? "🎉 حققت هدف اليوم — كل ترقية إضافية مكسب!"
                : myDaily.length === 0
                  ? `ابدأ بـ «تحديد هدف يومي» واختر ${SUGGESTED_DAILY_PICK} عملاء تقريباً للتواصل معهم`
                  : `تواصلت مع ${myDailyContacted} من ${myDaily.length} في قائمتك اليوم — باقي ${DAILY_UPGRADE_GOAL - myUpgradesToday} ترقيات`}
            </p>
          </div>
          <div className="text-center px-4 border-r border-border">
            <p className="text-xl font-extrabold text-foreground">{teamUpgradesToday}</p>
            <p className="text-[12px] text-muted-foreground">ترقيات الفريق اليوم</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cc-card rounded-[14px] p-4 text-center">
          <Users className="w-5 h-5 text-fuchsia-400 mx-auto mb-1" />
          <p className="text-2xl font-extrabold text-foreground">{totalCount}</p>
          <p className="text-[13px] text-muted-foreground">إجمالي العملاء</p>
        </div>
        <div className="cc-card rounded-[14px] p-4 text-center">
          <CalendarCheck className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-2xl font-extrabold text-foreground">{dailyCount}</p>
          <p className="text-[13px] text-muted-foreground">هدف اليوم</p>
        </div>
        <div className="cc-card rounded-[14px] p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-2xl font-extrabold text-foreground">{contactedCount}</p>
          <p className="text-[13px] text-muted-foreground">تم التواصل</p>
        </div>
        <div className="cc-card rounded-[14px] p-4 text-center">
          <Clock className="w-5 h-5 text-sky-400 mx-auto mb-1" />
          <p className="text-2xl font-extrabold text-foreground">{pendingCount}</p>
          <p className="text-[13px] text-muted-foreground">في الانتظار</p>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Month/Year selector */}
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_AR.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم العميل أو الرقم..."
            className="pr-9"
          />
        </div>

        <div className="flex items-center gap-2 mr-auto">
          {selectMode ? (
            <>
              <Button
                onClick={handleSetDailyTargets}
                disabled={selectedIds.size === 0}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700"
              >
                <CalendarCheck className="w-4 h-4" />
                تحديد كهدف اليوم ({selectedIds.size})
              </Button>
              <Button variant="outline" onClick={selectSuggested} className="gap-1.5" title="أعلى أولوية ولم يُتواصل معهم بعد، الأقرب انتهاءً أولاً">
                <Wand2 className="w-4 h-4" />
                اختيار أفضل {SUGGESTED_DAILY_PICK}
              </Button>
              <Button variant="outline" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
                إلغاء
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setSelectMode(true)} className="gap-1.5">
                <CalendarDays className="w-4 h-4" />
                تحديد هدف يومي
              </Button>
              <Button variant="outline" onClick={openImport} className="gap-1.5 border-fuchsia-500/30 text-fuchsia-400 hover:text-fuchsia-300">
                <UserPlus className="w-4 h-4" />
                نقل المشتركين
              </Button>
              <Button onClick={openAdd} className="gap-1.5">
                <Plus className="w-4 h-4" />
                إضافة عميل
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setViewFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-xs transition-colors border ${
              viewFilter === f.key
                ? "bg-white/[0.08] text-foreground border-fuchsia-500/30 font-medium"
                : "text-muted-foreground border-border hover:text-foreground hover:bg-white/[0.05]"
            }`}
          >
            {f.label}
            {f.key === "subscribers" && subscribersCount > 0 && (
              <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 text-[12px]">
                {subscribersCount}
              </span>
            )}
            {f.key === "expiring" && expiringCount > 0 && (
              <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[12px]">
                {expiringCount}
              </span>
            )}
            {f.key === "transferred" && transferredCount > 0 && (
              <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[12px]">
                {transferredCount}
              </span>
            )}
            {f.key === "daily" && dailyCount > 0 && (
              <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[12px]">
                {dailyCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Client list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="cc-card rounded-[14px] p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا يوجد عملاء في القائمة</p>
          <p className="text-xs mt-1">أضف عملاء لاستهدافهم هذا الشهر</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const status = CONTACT_STATUS[client.contact_status as ContactStatus] || CONTACT_STATUS.pending;
            const StatusIcon = status.icon;
            const sat = client.satisfaction_result
              ? SATISFACTION[client.satisfaction_result as SatisfactionResult]
              : null;
            const isDaily = client.target_date === todayStr;
            const isSelected = selectedIds.has(client.id);

            return (
              <div
                key={client.id}
                className={`cc-card rounded-[14px] p-5 space-y-3 transition-all ${
                  isDaily ? "ring-1 ring-amber-500/30 bg-amber-500/[0.03]" : ""
                } ${selectMode ? "cursor-pointer" : ""} ${
                  isSelected ? "ring-2 ring-fuchsia-500/50 bg-fuchsia-500/[0.05]" : ""
                }`}
                onClick={selectMode ? () => toggleSelect(client.id) : undefined}
              >
                {/* Header */}
                <div className="flex items-center gap-3">
                  {selectMode && (
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "bg-fuchsia-500 border-fuchsia-500"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 font-bold text-sm">
                    {client.client_name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {client.deal_id && !selectMode ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); openDeal(client); }}
                        className="text-sm font-bold text-foreground truncate hover:text-fuchsia-400 hover:underline transition-colors text-right w-full flex items-center gap-1"
                        title="فتح الصفقة في مكانها"
                      >
                        <span className="truncate">{client.client_name}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 text-fuchsia-400" />
                      </button>
                    ) : (
                      <p className="text-sm font-bold text-foreground truncate">{client.client_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      {client.client_phone && (
                        <span className="text-[13px] text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.client_phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {isDaily && (
                    <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[12px] font-medium flex items-center gap-1">
                      <CalendarCheck className="w-3 h-3" />
                      {client.target_by === authorName ? "هدفي اليوم" : client.target_by ? `هدف ${client.target_by}` : "هدف اليوم"}
                    </span>
                  )}
                </div>

                {/* Info row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium ${status.bg} ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                  {sat && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium ${sat.bg} ${sat.color}`}>
                      <sat.icon className="w-3 h-3" />
                      {sat.label}
                    </span>
                  )}
                  {client.plan && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-[12px] text-muted-foreground">
                      {client.plan}
                    </span>
                  )}
                  {client.assigned_rep && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-[12px] text-muted-foreground">
                      {client.assigned_rep}
                    </span>
                  )}
                  {client.deal_id && !client.recommendation && (
                    <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-[12px] text-fuchsia-400 font-medium">
                      من الصفقات
                    </span>
                  )}
                  {client.recommendation && client.source && (
                    <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-[12px] text-fuchsia-400 font-medium">
                      {client.source}
                    </span>
                  )}
                </div>

                {client.expiry_date && (() => {
                  const ex = expiryInfo(client.expiry_date, todayStr);
                  return (
                    <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[12px] ${ex.bg}`}>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5" />
                        تاريخ الانتهاء: <span className="text-foreground font-medium">{ex.formatted}</span>
                      </span>
                      <span className={`font-medium ${ex.color}`}>{ex.label}</span>
                    </div>
                  );
                })()}

                {client.transferred_to && (
                  <button
                    onClick={(e) => { e.stopPropagation(); openTransferred(client); }}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[12px] font-medium ${DESTINATIONS[client.transferred_to].bg} ${DESTINATIONS[client.transferred_to].color} hover:opacity-80 transition-opacity`}
                    title="فتح في القسم المنقول إليه"
                  >
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      وافق — نُقل إلى {DESTINATIONS[client.transferred_to].label}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                {client.recommendation && (() => {
                  const pr = PRIORITY[client.recommendation_priority ?? "medium"];
                  return (
                    <div className={`rounded-lg border ${pr.border} ${pr.bg} p-3 space-y-1`}>
                      <div className={`flex items-center gap-1.5 text-[12px] font-bold ${pr.color}`}>
                        <Lightbulb className="w-3.5 h-3.5" />
                        التوصية · {pr.label}
                      </div>
                      <p className="text-[13px] text-foreground/90 leading-relaxed">{client.recommendation}</p>
                    </div>
                  );
                })()}

                {client.notes && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
                    {client.notes}
                  </p>
                )}

                {/* Actions */}
                {!selectMode && (
                  <div className="flex items-center gap-1 pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1 text-xs"
                      onClick={() => openContact(client)}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      تسجيل تواصل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs"
                      onClick={() => openLogs(client)}
                      title="سجل العميل"
                    >
                      <History className="w-3.5 h-3.5" />
                    </Button>
                    {!client.transferred_to && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-emerald-400 hover:text-emerald-400"
                        onClick={() => openTransfer(client)}
                        title="وافق العميل — نقل لمبيعات الدعم أو التجديدات"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        وافق
                      </Button>
                    )}
                    {client.deal_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-400"
                        onClick={() => openDeal(client)}
                        title="فتح الصفقة في مكانها"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isDaily ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-amber-400"
                        onClick={() => handleClearDaily(client.id)}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => openEdit(client)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-red-400 hover:text-red-400"
                      onClick={() => { setDeleteId(client.id); setDeleteOpen(true); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Add / Edit Client Modal ─── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل عميل" : "إضافة عميل للاستهداف"}</DialogTitle>
            <DialogDescription>
              {editingId ? "حدّث بيانات العميل" : `إضافة عميل لقائمة ${MONTHS_AR[month - 1]} ${year}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>اسم العميل *</Label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="اسم العميل"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>رقم الجوال</Label>
                <Input
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                />
              </div>
              <div className="space-y-1.5">
                <Label>الباقة</Label>
                <Select value={form.plan} onValueChange={(v) => v && setForm({ ...form, plan: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الباقة" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>المصدر</Label>
                <Input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                  placeholder="مبيعات، تجديد، دعم..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>الموظف المسؤول</Label>
                <Input
                  value={form.assigned_rep}
                  onChange={(e) => setForm({ ...form, assigned_rep: e.target.value })}
                  placeholder="اسم الموظف"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ الانتهاء</Label>
              <Input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                rows={2}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة العميل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Contact Result Modal ─── */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>تسجيل نتيجة التواصل</DialogTitle>
            <DialogDescription>
              {contactClient?.client_name} {contactClient?.client_phone ? `— ${contactClient.client_phone}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>حالة التواصل</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(CONTACT_STATUS) as [ContactStatus, typeof CONTACT_STATUS[ContactStatus]][]).map(
                  ([key, val]) => {
                    const Icon = val.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setContactStatus(key)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                          contactStatus === key
                            ? `${val.bg} ${val.color} border-current`
                            : "border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {val.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {contactStatus === "contacted" && (
              <div className="space-y-1.5">
                <Label>نتيجة الرضا</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(SATISFACTION) as [SatisfactionResult, typeof SATISFACTION[SatisfactionResult]][]).map(
                    ([key, val]) => {
                      const Icon = val.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => setSatisfactionResult(key)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                            satisfactionResult === key
                              ? `${val.bg} ${val.color} border-current`
                              : "border-border text-muted-foreground hover:border-muted-foreground"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {val.label}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <textarea
                value={contactNotes}
                onChange={(e) => setContactNotes(e.target.value)}
                placeholder="تفاصيل المكالمة أو ملاحظات..."
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>إلغاء</Button>
            <Button onClick={handleContactSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : "حفظ النتيجة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Client Log ─── */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>سجل العميل</DialogTitle>
            <DialogDescription>{logsClient?.client_name}{logsClient?.client_phone ? ` — ${logsClient.client_phone}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex gap-2">
              <textarea
                value={newLogNote}
                onChange={(e) => setNewLogNote(e.target.value)}
                placeholder="أضف ملاحظة للسجل..."
                rows={2}
                className="flex-1 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button onClick={handleAddLogNote} disabled={saving || !newLogNote.trim()} className="self-end">
                إضافة
              </Button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pl-1">
              {logsLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              ) : logs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">لا يوجد سجل لهذا العميل بعد</p>
              ) : (
                logs.map((log) => {
                  const st = log.contact_status ? CONTACT_STATUS[log.contact_status as ContactStatus] : null;
                  const sat = log.satisfaction_result ? SATISFACTION[log.satisfaction_result as SatisfactionResult] : null;
                  const Icon = log.kind === "transfer" ? ArrowLeftRight : log.kind === "contact" ? PhoneCall : StickyNote;
                  return (
                    <div
                      key={log.id}
                      className={`rounded-lg border p-3 space-y-1.5 ${log.kind === "transfer" ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-border"}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap text-[12px]">
                        <Icon className={`w-3.5 h-3.5 ${log.kind === "transfer" ? "text-emerald-400" : "text-muted-foreground"}`} />
                        <span className="font-medium text-foreground">
                          {log.kind === "transfer" ? "نقل" : log.kind === "contact" ? "تواصل" : "ملاحظة"}
                        </span>
                        {st && <span className={`px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>{st.label}</span>}
                        {sat && <span className={`px-2 py-0.5 rounded-full ${sat.bg} ${sat.color}`}>{sat.label}</span>}
                        <span className="mr-auto text-muted-foreground">
                          {log.author_name} · {formatLogTime(log.created_at)}
                        </span>
                      </div>
                      {log.note && <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">{log.note}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Transfer (client agreed) ─── */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>وافق العميل — نقل</DialogTitle>
            <DialogDescription>
              {transferClient?.client_name} — يُنشأ له سجل «انتظار الدفع» في القسم المختار
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>النقل إلى</Label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(DESTINATIONS) as [keyof typeof DESTINATIONS, typeof DESTINATIONS[keyof typeof DESTINATIONS]][]).map(([key, d]) => (
                  <button
                    key={key}
                    onClick={() => setTransferForm({ ...transferForm, destination: key })}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      transferForm.destination === key
                        ? `${d.bg} ${d.color} border-current`
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الباقة / المنتج *</Label>
                <Select value={transferForm.plan} onValueChange={(v) => v && setTransferForm({ ...transferForm, plan: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_PLANS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>القيمة (ريال) *</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={transferForm.value}
                  onChange={(e) => setTransferForm({ ...transferForm, value: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الموظف المسؤول</Label>
              <Input
                value={transferForm.assigned_rep}
                onChange={(e) => setTransferForm({ ...transferForm, assigned_rep: e.target.value })}
                placeholder="اسم الموظف"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظة</Label>
              <textarea
                value={transferForm.note}
                onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                placeholder="تفاصيل الاتفاق..."
                rows={2}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {transferError && <p className="text-xs text-red-400">{transferError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>إلغاء</Button>
            <Button onClick={handleTransfer} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? "جاري النقل..." : `نقل إلى ${DESTINATIONS[transferForm.destination].label}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Import Subscribers ─── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>نقل العملاء المشتركين</DialogTitle>
            <DialogDescription>
              عملاء الباقة الأساسية المجدِّدين من التجديدات + العملاء المكتملين من مبيعات الدعم — لاستهدافهم ببطاقات الولاء والكاشير في قائمة {MONTHS_AR[month - 1]} {year}
            </DialogDescription>
          </DialogHeader>
          {importLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-lg font-extrabold text-foreground">{importPreview.fromRenewals}</p>
                  <p className="text-[12px] text-muted-foreground">من التجديدات (أساسية)</p>
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="text-lg font-extrabold text-foreground">{importPreview.fromSupport}</p>
                  <p className="text-[12px] text-muted-foreground">من مبيعات الدعم</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <p className="text-lg font-extrabold text-emerald-400">{importPreview.high}</p>
                  <p className="text-[12px] text-muted-foreground">أولوية عالية</p>
                </div>
                <div className="rounded-lg bg-fuchsia-500/10 p-2">
                  <p className="text-lg font-extrabold text-fuchsia-400">{importPreview.toInsert.length}</p>
                  <p className="text-[12px] text-muted-foreground">جديد سيُضاف</p>
                </div>
              </div>
              {importPreview.refresh > 0 && (
                <p className="text-xs text-muted-foreground">
                  {importPreview.refresh} عميل موجود مسبقاً في القائمة — ستُحدَّث توصيته وتاريخ انتهائه فقط دون المساس بحالة التواصل.
                </p>
              )}
              <div className="max-h-[45vh] overflow-y-auto space-y-2 pl-1">
                {importPreview.toInsert.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-6">كل العملاء المشتركين موجودون في القائمة مسبقاً</p>
                ) : (
                  importPreview.toInsert.map((c) => {
                    const pr = PRIORITY[c.recommendation_priority];
                    return (
                      <div key={c.key} className="rounded-lg border border-border p-3 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{c.client_name}</span>
                          {c.client_phone && <span className="text-[12px] text-muted-foreground">{c.client_phone}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${pr.bg} ${pr.color}`}>{pr.label}</span>
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-[11px] text-muted-foreground">{c.source}</span>
                          {c.expiry_date && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${expiryInfo(c.expiry_date, todayStr).bg} ${expiryInfo(c.expiry_date, todayStr).color}`}>
                              ينتهي {c.expiry_date}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">{c.recommendation}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {importError && <p className="text-xs text-red-400">{importError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleImport}
              disabled={importLoading || importing || (importPreview.toInsert.length === 0 && importPreview.refresh === 0)}
            >
              {importing
                ? "جاري النقل..."
                : importPreview.toInsert.length > 0
                  ? `نقل ${importPreview.toInsert.length} عميل`
                  : `تحديث ${importPreview.refresh} عميل`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا العميل من قائمة الاستهداف؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete}>حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
