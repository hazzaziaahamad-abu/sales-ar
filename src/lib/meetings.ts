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
  client_brief: ClientBrief | null;
  /** صفقة العميل المربوطة، ورابط «خطة الاجتماع» حقها. */
  deal_id?: string | null;
  client_meeting_id?: string | null;
  plan?: { token: string; open_count: number } | null;
  created_by: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── اجتماع العميل (Google Meet) ─── */

/** محاور اجتماع العميل — بالترتيب. */
export const CLIENT_SCRIPT = [
  {
    key: "welcome",
    title: "الترحيب",
    hint: "رحّب بالعميل بالاسم، عرّف بنفسك، واشكره على وقته. وضّح مدة الاجتماع ومحاوره.",
    questions: [] as string[],
  },
  {
    key: "discovery",
    title: "سؤال العميل",
    hint: "خلّ العميل يتكلم أكثر منك — اسمع واكتب كلامه بالنص.",
    questions: [
      "إيش تعرف عنّا؟",
      "إيش متوقع النظام يساعدك فيه؟",
      "إيش المشاكل اللي تبي النظام يحلها لك؟",
    ],
  },
  {
    key: "pitch",
    title: "ملخص سريع عن المنصة + الرد على كلام العميل",
    hint: "ملخص سريع عن المنصة، ثم اربط كل ميزة بمشكلة أو توقع ذكره العميل. اعرض جميع المميزات.",
    questions: [] as string[],
  },
  {
    key: "competitors",
    title: "المنافسين",
    hint: "لو تكلم العميل عن منافس: اسأله عن المميزات والعيوب من وجهة نظره — بدون ما تهاجم المنافس.",
    questions: [
      "إيش اللي عجبك في المنافس؟",
      "إيش اللي ما عجبك أو ناقصه؟",
    ],
  },
] as const;

export type ClientScriptKey = (typeof CLIENT_SCRIPT)[number]["key"];
export const CLIENT_SCRIPT_KEYS = CLIENT_SCRIPT.map((s) => s.key) as ClientScriptKey[];

/** أهداف اجتماع العميل. */
export const CLIENT_MEETING_GOALS = [
  "استقطاب عملاء جدد",
  "ترقية العملاء الحاليين",
  "إلمام العميل بجميع مزايا المنصة",
  "بناء علاقة أفضل مع العميل",
];

/** هدف اجتماع العميل: عميل جديد نستقطبه، أو عميل حالي نرقّيه. */
export type ClientPurpose = "new" | "upgrade";
export const CLIENT_PURPOSE_LABELS: Record<ClientPurpose, string> = {
  new: "استقطاب عميل جديد",
  upgrade: "ترقية عميل حالي",
};
export const CLIENT_PURPOSES = Object.keys(CLIENT_PURPOSE_LABELS) as ClientPurpose[];

export interface ClientBrief {
  client_name: string;
  client_phone: string;
  purpose: ClientPurpose;
  notes: Partial<Record<ClientScriptKey, string>>;
  done: ClientScriptKey[];
}

export const emptyClientBrief = (): ClientBrief => ({ client_name: "", client_phone: "", purpose: "new", notes: {}, done: [] });

/** يحوّل محاور الاجتماع لنص يصلح لوصف موعد Google Calendar. */
export function clientScriptText(brief?: ClientBrief | null): string {
  const lines: string[] = [
    ...(brief?.purpose ? [`هدف الاجتماع: ${CLIENT_PURPOSE_LABELS[brief.purpose]}`, ""] : []),
    "أهداف الاجتماع:", ...CLIENT_MEETING_GOALS.map((g) => `• ${g}`), "", "محاور الاجتماع:"];
  CLIENT_SCRIPT.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.title}`);
    s.questions.forEach((q) => lines.push(`   - ${q}`));
    const note = brief?.notes?.[s.key]?.trim();
    if (note) lines.push(`   ملاحظة: ${note}`);
  });
  return lines.join("\n");
}

/** رابط «إضافة إلى Google Calendar» بتوقيت السعودية. */
export function googleCalendarUrl(m: {
  title: string; meeting_date: string; start_time: string; duration_minutes: number;
  location?: string | null; details?: string;
}): string {
  const [h, min] = m.start_time.split(":").map(Number);
  const start = new Date(Date.UTC(+m.meeting_date.slice(0, 4), +m.meeting_date.slice(5, 7) - 1, +m.meeting_date.slice(8, 10), h, min));
  const end = new Date(start.getTime() + m.duration_minutes * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: m.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    ctz: "Asia/Riyadh",
    details: m.details ?? "",
  });
  if (m.location) p.set("location", m.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
