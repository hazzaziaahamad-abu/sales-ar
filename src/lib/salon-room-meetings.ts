// «اجتماع الفريق»: أجندة اجتماعات فريق الصالونات وملاحظاتها وقراراتها — مشتركة بين الواجهة ومسارات الـ API.

export type MeetingKind = "weekly" | "monthly" | "urgent" | "other";
export type MeetingStatus = "planned" | "held";

export type AgendaItem = { id: string; title: string; owner: string | null; minutes: number | null; done: boolean; notes: string };
export type MeetingDecision = { id: string; body: string };
export type MeetingAction = { id: string; body: string; assignee: string | null; due_date: string | null; task_id: string | null };

export type Meeting = {
  id: string; title: string; kind: MeetingKind; meeting_date: string; start_time: string | null; status: MeetingStatus;
  facilitator: string | null; attendees: string[]; agenda: AgendaItem[]; notes: string;
  decisions: MeetingDecision[]; actions: MeetingAction[]; created_by: string | null; created_at: string; updated_at: string;
};

export const MEETING_COLS = "id, title, kind, meeting_date, start_time, status, facilitator, attendees, agenda, notes, decisions, actions, created_by, created_at, updated_at";

/** أنواع الاجتماعات — لكل نوع أجندة افتراضية (عنوان + دقائق). */
export const MEETING_KINDS: { id: MeetingKind; label: string; title: string; color: string; agenda: [string, number][] }[] = [
  {
    id: "weekly", label: "أسبوعي", title: "اجتماع الفريق الأسبوعي", color: "#581845",
    agenda: [
      ["إنجازات الأسبوع — كل مستشارة تشارك نتيجة وحدة", 3],
      ["أرقام الأسبوع مقابل الأهداف (تواصل، اجتماعات، عقود، جلسات مجانية)", 5],
      ["الصالونات بحاجة انتباه — وش العائق ووش الخطوة الجاية", 10],
      ["المهام المتأخرة والمراجعات القادمة", 5],
      ["جدول المهام: المتأخرة واللي بانتظار المراجعة", 5],
      ["القرارات وتوزيع المهام", 2],
    ],
  },
  {
    id: "monthly", label: "شهري", title: "اجتماع المراجعة الشهرية", color: "#D4AF37",
    agenda: [
      ["نتائج الشهر: عقود جديدة، إيراد، تحويل الجلسات المجانية", 10],
      ["تقدّم الصالونات على أهداف الـ٩٠ يوم", 15],
      ["أداء كل مستشارة والدعم اللي تحتاجه", 10],
      ["تقييم الأفكار الجديدة ومتابعة المنافسين", 10],
      ["خطة الشهر القادم والأهداف", 10],
    ],
  },
  {
    id: "urgent", label: "طارئ", title: "اجتماع طارئ", color: "#DC2626",
    agenda: [
      ["الموضوع وسبب الاجتماع", 5],
      ["الخيارات المتاحة", 10],
      ["القرار والمسؤولة", 5],
    ],
  },
  { id: "other", label: "أخرى", title: "اجتماع الفريق", color: "#7A6570", agenda: [] },
];
export const MEETING_KIND_IDS = MEETING_KINDS.map((k) => k.id);
export const meetingKind = (id: string) => MEETING_KINDS.find((k) => k.id === id) ?? MEETING_KINDS[MEETING_KINDS.length - 1];

const rid = () => Math.random().toString(36).slice(2, 10);
export const newId = rid;

/** قالب أجندة محفوظ من الفريق لنوع اجتماع (يحلّ محل القالب المدمج). */
export type TemplateItem = { title: string; minutes: number | null; owner: string | null };
export type MeetingTemplates = Partial<Record<MeetingKind, TemplateItem[]>>;

export const agendaFor = (kind: MeetingKind, templates?: MeetingTemplates): AgendaItem[] => {
  const custom = templates?.[kind];
  const items: TemplateItem[] = custom ?? meetingKind(kind).agenda.map(([title, minutes]) => ({ title, minutes, owner: null }));
  return items.map((t) => ({ id: rid(), title: t.title, owner: t.owner, minutes: t.minutes, done: false, notes: "" }));
};

export const agendaMinutes = (m: Pick<Meeting, "agenda">) => m.agenda.reduce((s, a) => s + (a.minutes ?? 0), 0);
