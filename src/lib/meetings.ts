// «الاجتماعات» — جدول اجتماعات الفريق.

export type MeetingType = "daily" | "weekly" | "internal" | "client" | "partner" | "other";
export type MeetingStatus = "scheduled" | "done" | "cancelled";

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  daily: "اجتماع يومي",
  weekly: "اجتماع أسبوعي",
  internal: "داخلي",
  client: "مع عميل",
  partner: "مع شريك",
  other: "أخرى",
};
export const MEETING_TYPE_COLORS: Record<MeetingType, string> = {
  daily: "bg-violet-500/15 text-violet-300",
  weekly: "bg-indigo-500/15 text-indigo-300",
  internal: "bg-sky-500/15 text-sky-300",
  client: "bg-amber-500/15 text-amber-300",
  partner: "bg-teal-500/15 text-teal-300",
  other: "bg-white/[0.06] text-muted-foreground",
};
export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "مجدول",
  done: "تم",
  cancelled: "ملغي",
};

export const MEETING_TYPES = Object.keys(MEETING_TYPE_LABELS) as MeetingType[];
export const MEETING_STATUSES = Object.keys(MEETING_STATUS_LABELS) as MeetingStatus[];

export interface Meeting {
  id: string;
  title: string;
  meeting_type: MeetingType;
  meeting_date: string;
  start_time: string;
  duration_minutes: number;
  location: string | null;
  attendees: string[];
  agenda: string | null;
  minutes: string | null;
  status: MeetingStatus;
  created_by: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}
