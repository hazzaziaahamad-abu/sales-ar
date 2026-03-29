"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchTargetClients,
  createTargetClient,
  updateTargetClient,
  deleteTargetClient,
  setDailyTargets,
  clearDailyTarget,
} from "@/lib/supabase/db";
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
import type { TargetClient } from "@/types";
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
type ViewFilter = "all" | "daily" | "pending" | "contacted" | "no_answer" | "postponed";

const EMPTY_FORM = {
  client_name: "",
  client_phone: "",
  plan: "",
  source: "",
  assigned_rep: "",
  notes: "",
};

/* ---------- page ---------- */

export default function TargetingPage() {
  const { activeOrgId } = useAuth();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

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

  /* ---------- fetch ---------- */
  useEffect(() => {
    setLoading(true);
    fetchTargetClients(month, year)
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeOrgId, month, year]);

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

  /* ---------- handlers ---------- */
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
      setContactOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
      await setDailyTargets(Array.from(selectedIds), todayStr);
      setClients((prev) =>
        prev.map((c) => (selectedIds.has(c.id) ? { ...c, target_date: todayStr } : c))
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
        prev.map((c) => (c.id === id ? { ...c, target_date: undefined } : c))
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

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="cc-card rounded-xl p-4 text-center">
          <Users className="w-5 h-5 text-fuchsia-400 mx-auto mb-1" />
          <p className="text-2xl font-extrabold text-foreground">{totalCount}</p>
          <p className="text-[11px] text-muted-foreground">إجمالي العملاء</p>
        </div>
        <div className="cc-card rounded-xl p-4 text-center">
          <CalendarCheck className="w-5 h-5 text-amber-400 mx-auto mb-1" />
          <p className="text-2xl font-extrabold text-foreground">{dailyCount}</p>
          <p className="text-[11px] text-muted-foreground">هدف اليوم</p>
        </div>
        <div className="cc-card rounded-xl p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-2xl font-extrabold text-foreground">{contactedCount}</p>
          <p className="text-[11px] text-muted-foreground">تم التواصل</p>
        </div>
        <div className="cc-card rounded-xl p-4 text-center">
          <Clock className="w-5 h-5 text-sky-400 mx-auto mb-1" />
          <p className="text-2xl font-extrabold text-foreground">{pendingCount}</p>
          <p className="text-[11px] text-muted-foreground">في الانتظار</p>
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
                : "text-muted-foreground border-border hover:text-foreground hover:bg-white/[0.03]"
            }`}
          >
            {f.label}
            {f.key === "daily" && dailyCount > 0 && (
              <span className="mr-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
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
            <div key={i} className="cc-card rounded-xl p-5 space-y-3">
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
                className={`cc-card rounded-xl p-5 space-y-3 transition-all ${
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
                    <p className="text-sm font-bold text-foreground truncate">{client.client_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {client.client_phone && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.client_phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {isDaily && (
                    <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-medium flex items-center gap-1">
                      <CalendarCheck className="w-3 h-3" />
                      هدف اليوم
                    </span>
                  )}
                </div>

                {/* Info row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.bg} ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                  {sat && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${sat.bg} ${sat.color}`}>
                      <sat.icon className="w-3 h-3" />
                      {sat.label}
                    </span>
                  )}
                  {client.plan && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-muted-foreground">
                      {client.plan}
                    </span>
                  )}
                  {client.assigned_rep && (
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-muted-foreground">
                      {client.assigned_rep}
                    </span>
                  )}
                </div>

                {client.notes && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
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
