// «الطلبات والتطويرات» — تذاكر تنفتح وتنقفل بعد الإنجاز أو الحل.

export type TicketKind = "customer_request" | "development";
export type TicketPriority = "normal" | "high" | "urgent";
export type TicketStatus = "open" | "in_progress" | "done" | "cancelled";

export const TICKET_KIND_LABELS: Record<TicketKind, string> = {
  customer_request: "طلب عميل",
  development: "تطوير على النظام",
};
export const TICKET_KIND_COLORS: Record<TicketKind, string> = {
  customer_request: "bg-amber-500/15 text-amber-300 ring-amber-500/20",
  development: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/20",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};
export const TICKET_PRIORITY_COLORS: Record<TicketPriority, string> = {
  normal: "bg-white/[0.06] text-muted-foreground",
  high: "bg-orange-500/15 text-orange-400",
  urgent: "bg-red-500/15 text-red-400",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "مفتوحة",
  in_progress: "قيد العمل",
  done: "منجزة",
  cancelled: "ملغاة",
};
export const TICKET_STATUS_COLORS: Record<TicketStatus, string> = {
  open: "bg-sky-500/15 text-sky-400 ring-sky-500/20",
  in_progress: "bg-amber-500/15 text-amber-400 ring-amber-500/20",
  done: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/20",
  cancelled: "bg-slate-500/15 text-slate-400 ring-slate-500/20",
};

export const TICKET_KINDS = Object.keys(TICKET_KIND_LABELS) as TicketKind[];
export const TICKET_PRIORITIES = Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[];
export const TICKET_STATUSES = Object.keys(TICKET_STATUS_LABELS) as TicketStatus[];
export const isClosedStatus = (s: TicketStatus) => s === "done" || s === "cancelled";

export interface WorkTicket {
  id: string;
  ticket_number: number;
  kind: TicketKind;
  title: string;
  description: string;
  client_name: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  created_by: string | null;
  created_by_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  resolution: string | null;
  closed_at: string | null;
  closed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkTicketEvent {
  id: string;
  event_type: "created" | "status" | "assigned" | "comment" | "edited";
  body: string | null;
  actor_name: string | null;
  created_at: string;
}
