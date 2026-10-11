/**
 * «تذكيرات الفريق» — رسائل تطلع للموظف مرتين يومياً:
 *   ١) بعد ٥ دقائق من أول استخدام للوحة في اليوم
 *   ٢) نص الدوام (الدوام ١ الظهر – ١٠ م بتوقيت السعودية ⇒ ٥:٣٠ م)
 * كل تذكير مربوط ببيانات الموظف الفعلية ولا يطلع إلا إذا كان له معنى.
 * الصفقات الأقدم من شهر مستثناة (لها طريقة متابعة أخرى).
 */
import { createClient } from "@/lib/supabase/client";
import { getOrgId } from "@/lib/supabase/db";
import { saudiDateStr } from "@/lib/utils/format";

export type ReminderSlot = "start" | "mid";
export type ReminderItemKey = "open_deals" | "follow_up_log" | "tickets" | "cheer";
export type AckStatus = "done" | "dismissed";

export const SHIFT_START_HOUR = 13; // ١ الظهر
export const SHIFT_END_HOUR = 22; // ١٠ م
export const MID_SHIFT_MINUTES = ((SHIFT_START_HOUR + SHIFT_END_HOUR) / 2) * 60; // ٥:٣٠ م
export const START_DELAY_MIN = 5;
/** أقل فرق بين التذكيرين — لو دخل الموظف متأخر ما يطلع له التذكيران ورا بعض */
export const MIN_GAP_MIN = 60;
export const MAX_DEAL_AGE_DAYS = 30;

export const SLOT_LABEL: Record<ReminderSlot, string> = { start: "بداية الاستخدام", mid: "نص الدوام" };
export const ITEM_LABEL: Record<ReminderItemKey, string> = {
  open_deals: "مراجعة الصفقات",
  follow_up_log: "سجل المتابعة",
  tickets: "إضافة التذاكر",
  cheer: "رسالة تشجيع",
};

/** المراحل المقفلة — ما تحتاج متابعة */
export const CLOSED_STAGES = ["مكتملة", "مرفوض مع سبب", "كنسل التجربة", "استهداف خاطئ"];
/** المراحل المتقدمة — الأولوية في المتابعة */
export const HOT_STAGES = ["تفاوض", "تم إرسال العرض", "انتظار الدفع", "تجريبي", "تجهيز"];

const DAY_MS = 86400000;

interface DealRow {
  id: string;
  client_name: string;
  stage: string;
  sales_type: string | null;
}

/** الدقائق منذ منتصف الليل بتوقيت السعودية */
export function saudiMinutesNow(now = new Date()): number {
  const s = new Date(now.getTime() + 3 * 3600000);
  return s.getUTCHours() * 60 + s.getUTCMinutes();
}

export interface ReminderItem {
  key: ReminderItemKey;
  title: string;
  body: string;
  /** الرقم اللي اتعرض للموظف (للمتابعة في صفحة المدير) */
  metric?: number;
  /** أسماء مختصرة تعرض تحت التذكير */
  list?: string[];
  link?: { href: string; label: string };
  doneLabel: string;
}

interface RepUser {
  id: string;
  name: string;
  allowedPages: string[];
}

const CHEERS_GENERIC = [
  "كل محادثة اليوم فرصة — خلّك أول واحد يرد وآخر واحد يستسلم 💪",
  "العميل يتذكر اللي تابعه باهتمام، مو اللي عرض أرخص سعر 🌟",
  "خطوة صغيرة كل يوم تصنع فرق كبير آخر الشهر — كمّل 👏",
  "ترتيبك لسجلك اليوم = قرار أسهل بكرة. شغلك يفرق معنا 🙌",
  "أنت واجهة الشركة عند العميل — والصورة اللي تصنعها اليوم تبقى 💜",
];

function pickGeneric(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return CHEERS_GENERIC[Math.abs(h) % CHEERS_GENERIC.length];
}

/** يبني تذكيرات الموظف من بياناته الفعلية */
export async function buildReminderItems(user: RepUser, slot: ReminderSlot): Promise<ReminderItem[]> {
  const supabase = createClient();
  const orgId = getOrgId();
  const today = saudiDateStr();
  const since = saudiDateStr(new Date(Date.now() - MAX_DEAL_AGE_DAYS * DAY_MS));
  const weekAgoIso = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const todayStartIso = new Date(`${today}T00:00:00+03:00`).toISOString();
  const items: ReminderItem[] = [];

  // ── الصفقات المفتوحة (شهر وأقل) ──
  // العدد الكلي يُحسب بدون جلب الصفوف (بعض الموظفين عندهم مئات صفقات «إعادة الاتصال»)،
  // والتركيز على الصفقات المتقدمة + الصفقات اللي اتعدّلت اليوم.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openFilter = (q: any) =>
    q
      .eq("org_id", orgId)
      .eq("assigned_rep_name", user.name)
      .not("stage", "in", `(${CLOSED_STAGES.map((s) => `"${s}"`).join(",")})`)
      .gte("deal_date", since);

  const [{ count: openCount }, { data: hotRows }, { data: touchedRows }] = await Promise.all([
    openFilter(supabase.from("deals").select("id", { count: "exact", head: true })),
    openFilter(supabase.from("deals").select("id, client_name, stage, sales_type"))
      .in("stage", HOT_STAGES)
      .order("deal_date", { ascending: false })
      .limit(200),
    openFilter(supabase.from("deals").select("id, client_name, stage, sales_type"))
      .gte("updated_at", todayStartIso)
      .limit(200),
  ]);
  const total = openCount ?? 0;
  const hot = (hotRows ?? []) as DealRow[];
  const touched = (touchedRows ?? []) as DealRow[];

  if (total > 0) {
    const sample = hot.length ? hot : touched;
    const supportCount = sample.filter((d) => d.sales_type === "support").length;
    const dealsHref = sample.length && supportCount > sample.length / 2 ? "/support-sales" : "/sales";

    items.push({
      key: "open_deals",
      title: "راجع صفقاتك المفتوحة",
      body: hot.length
        ? `عندك ${total} صفقة مفتوحة خلال آخر شهر، منها ${hot.length} في مراحل متقدمة (تفاوض، عرض، دفع، تجريبي) — ابدأ فيها وحدّث مرحلة كل وحدة.`
        : `عندك ${total} صفقة مفتوحة خلال آخر شهر — راجع مرحلة كل وحدة وحدّثها إذا تغيّرت.`,
      metric: total,
      list: hot.slice(0, 5).map((d) => `${d.client_name} · ${d.stage}`),
      link: { href: dealsHref, label: "افتح الصفقات" },
      doneLabel: "راجعتها ✓",
    });

    // ── سجل المتابعة ──
    const ids = [...new Set([...hot, ...touched].map((d) => d.id))];
    const noted = new Set<string>();
    for (let i = 0; i < ids.length; i += 150) {
      const { data: notes } = await supabase
        .from("follow_up_notes")
        .select("entity_id")
        .eq("org_id", orgId)
        .eq("entity_type", "deal")
        .gte("created_at", todayStartIso)
        .in("entity_id", ids.slice(i, i + 150));
      ((notes ?? []) as { entity_id: string }[]).forEach((n) => noted.add(n.entity_id));
    }
    // صفقات عدّلها اليوم بدون ما يكتب ملاحظة = أوضح مؤشر إن السجل ناقص
    const touchedNoNote = touched.filter((d) => !noted.has(d.id));
    const hotNoNote = hot.filter((d) => !noted.has(d.id));

    let log: { body: string; list: DealRow[] } | null = null;
    if (touchedNoNote.length > 0) {
      log = {
        body: `عدّلت ${touchedNoNote.length} صفقة اليوم بدون ما تكتب ملاحظة في سجل المتابعة — اكتب وش صار مع كل عميل.`,
        list: touchedNoNote,
      };
    } else if (hotNoNote.length > 0) {
      log = {
        body:
          slot === "start"
            ? `أي عميل تتواصل معه اليوم اكتب له ملاحظة في السجل — عندك ${hotNoNote.length} صفقة متقدمة تنتظر متابعتك.`
            : `باقي ${hotNoNote.length} صفقة متقدمة ما لها ملاحظة متابعة اليوم — تابعها واكتب وش صار.`,
        list: hotNoNote,
      };
    }
    if (log) {
      items.push({
        key: "follow_up_log",
        title: "حدّث سجل المتابعة",
        body: log.body,
        metric: log.list.length,
        list: log.list.slice(0, 5).map((d) => d.client_name),
        link: { href: dealsHref, label: "افتح السجل" },
        doneLabel: "حدّثته ✓",
      });
    }
  }

  // ── التذاكر (لموظفي الدعم) ──
  if (user.allowedPages.includes("support")) {
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("assigned_agent_name", user.name)
      .eq("open_date", today);
    const n = count ?? 0;
    items.push({
      key: "tickets",
      title: "تأكد إنك أضفت كل تذكرة",
      body:
        n > 0
          ? `مسجّل لك اليوم ${n} تذكرة — تأكد إن كل عميل كلّمك عن مشكلة له تذكرة في النظام.`
          : "ما فيه تذاكر مسجّلة لك اليوم — أي عميل يتواصل معك عن مشكلة أو طلب، أضف له تذكرة فوراً.",
      metric: n,
      link: { href: "/support", label: "افتح التذاكر" },
      doneLabel: "أضفتها كلها ✓",
    });
  }

  // ── تشجيع مبني على شغله الفعلي ──
  if (items.length > 0) {
    const [{ count: won }, { count: notesToday }] = await Promise.all([
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("assigned_rep_name", user.name)
        .eq("stage", "مكتملة")
        .gte("updated_at", weekAgoIso),
      supabase
        .from("follow_up_notes")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("author_name", user.name)
        .gte("created_at", todayStartIso),
    ]);
    let body: string;
    if ((won ?? 0) > 0) body = `قفلت ${won} صفقة خلال آخر ٧ أيام — شغل يرفع الراس، كمّل على نفس النَفَس 👏`;
    else if (slot === "mid" && (notesToday ?? 0) > 0) body = `كتبت ${notesToday} ملاحظة متابعة اليوم — هذا الالتزام اللي يقفل الصفقات 💪`;
    else body = pickGeneric(`${user.id}-${today}-${slot}`);
    items.push({ key: "cheer", title: `يعطيك العافية يا ${user.name.split(" ")[0]}`, body, doneLabel: "شكراً 💜" });
  }

  return items;
}

export interface AckRow {
  user_id: string;
  user_name: string;
  reminder_date: string;
  slot: ReminderSlot;
  item_key: ReminderItemKey;
  status: AckStatus;
  metric: number | null;
  created_at: string;
}

/** هل اتعرض هذا التذكير اليوم (أي تفاعل مسجّل)؟ */
export async function fetchMyAcks(userId: string, date: string): Promise<AckRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("team_reminder_acks")
    .select("user_id, user_name, reminder_date, slot, item_key, status, metric, created_at")
    .eq("org_id", getOrgId())
    .eq("user_id", userId)
    .eq("reminder_date", date);
  return (data ?? []) as AckRow[];
}

export async function saveAck(
  user: { id: string; name: string },
  slot: ReminderSlot,
  item: ReminderItem,
  status: AckStatus
): Promise<void> {
  const supabase = createClient();
  await supabase.from("team_reminder_acks").upsert(
    {
      org_id: getOrgId(),
      user_id: user.id,
      user_name: user.name,
      reminder_date: saudiDateStr(),
      slot,
      item_key: item.key,
      status,
      metric: item.metric ?? null,
    },
    { onConflict: "org_id,user_id,reminder_date,slot,item_key" }
  );
}

/** لصفحة المدير: كل تفاعلات يوم معيّن */
export async function fetchAcksForDate(date: string): Promise<AckRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_reminder_acks")
    .select("user_id, user_name, reminder_date, slot, item_key, status, metric, created_at")
    .eq("org_id", getOrgId())
    .eq("reminder_date", date)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as AckRow[];
}
