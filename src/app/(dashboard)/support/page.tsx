"use client";

import { useState, useEffect } from "react";
import {
  fetchTickets, createTicket, updateTicket, deleteTicket,
  fetchEmployees,
} from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { PRIORITIES, TICKET_STATUSES } from "@/lib/utils/constants";
import { PRIORITY_COLORS, TICKET_STATUS_COLORS } from "@/lib/utils/constants";
import { formatDate, formatPhone } from "@/lib/utils/format";
import type { Ticket, Employee } from "@/types";

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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types for local form state                                        */
/* ------------------------------------------------------------------ */
interface TicketForm {
  client_name: string;
  client_phone: string;
  issue: string;
  priority: string;
  status: string;
  assigned_agent_name: string;
  open_date: string;
  due_date: string;
}

const EMPTY_FORM: TicketForm = {
  client_name: "",
  client_phone: "",
  issue: "",
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
  const { activeOrgId: orgId } = useAuth();
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
  const cardFilteredTickets = cardFilter
    ? cardFilter === "عاجل"
      ? monthTickets.filter((t) => t.priority === "عاجل")
      : monthTickets.filter((t) => t.status === cardFilter)
    : monthTickets;
  const filteredTickets = clientSearch
    ? cardFilteredTickets.filter((t) => t.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
    : cardFilteredTickets;

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
  const countOpen = monthTickets.filter((t) => t.status === "مفتوح").length;
  const countInProgress = monthTickets.filter((t) => t.status === "قيد الحل").length;
  const countResolved = monthTickets.filter((t) => t.status === "محلول").length;
  const countUrgent = monthTickets.filter((t) => t.priority === "عاجل").length;

  /* ---------- helpers ---------- */
  function openCreateDialog() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(ticket: Ticket) {
    setEditingId(ticket.id);
    setForm({
      client_name: ticket.client_name,
      client_phone: ticket.client_phone || "",
      issue: ticket.issue,
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
          client_name: form.client_name,
          client_phone: form.client_phone,
          issue: form.issue,
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
          client_name: form.client_name,
          client_phone: form.client_phone,
          issue: form.issue,
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

      {/* -------- Tickets Table -------- */}
      <div className="cc-card rounded-xl overflow-x-auto">
        <div className="p-4 pb-0">
          <Input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="ابحث باسم العميل..."
            className="max-w-xs"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">#</TableHead>
              <TableHead className="text-right">العميل</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">الجوال</TableHead>
              <TableHead className="text-right">المشكلة</TableHead>
              <TableHead className="text-right">موعد التسليم</TableHead>
              <TableHead className="text-right">الأولوية</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">الوكيل</TableHead>
              <TableHead className="text-right">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-10" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-20" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="mr-auto h-4 w-24" /></TableCell>
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
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {cardFilter ? `لا توجد تذاكر "${cardFilter}"` : "لا توجد تذاكر"}
                </TableCell>
              </TableRow>
            ) : (
              filteredTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {ticket.ticket_number}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {ticket.client_name}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {ticket.open_date ? formatDate(ticket.open_date) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground" dir="ltr">
                    {ticket.client_phone ? formatPhone(ticket.client_phone) : "—"}
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

            {/* وصف المشكلة */}
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="issue">وصف المشكلة</Label>
              <Textarea
                id="issue"
                value={form.issue}
                onChange={(e) => updateField("issue", e.target.value)}
                placeholder="صف المشكلة بالتفصيل..."
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

            {/* الوكيل */}
            <div className="space-y-1.5">
              <Label>الوكيل</Label>
              <Select
                value={form.assigned_agent_name}
                onValueChange={(val) =>
                  val && updateField("assigned_agent_name", val as string)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الوكيل" />
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

            {/* تاريخ الفتح */}
            <div className="space-y-1.5">
              <Label htmlFor="open_date">تاريخ الفتح</Label>
              <Input
                id="open_date"
                type="date"
                value={form.open_date}
                onChange={(e) => updateField("open_date", e.target.value)}
                dir="ltr"
              />
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
    <div className="cc-card rounded-xl p-4 border-t-2 border-t-muted">
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
