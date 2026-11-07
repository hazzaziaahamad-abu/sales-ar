// متابعة العناصر الساكتة (تذاكر الدعم، الطلبات والتطويرات، صفقات مبيعات المكتب والدعم، التجديدات):
// اللي آخر نشاط عليها بين ٤٨ ساعة و١٠ أيام تنجهز لها مسودة، وبعد موافقة السوبر أدمن تنرسل كتعليق
// عادي باسمه فيه منشن للموظف المسؤول، في أوقات متفرقة طبيعية داخل دوام الفريق.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { saudiDateStr } from "@/lib/utils/format";

export const STALE_HOURS = 48;
/** الأقدم من كذا ما ينجاب (متروك من زمان — مو متابعة يومية). */
export const MAX_STALE_DAYS = 10;
const STALE_MS = STALE_HOURS * 3_600_000;

export type FollowupSource = "support" | "work" | "deal" | "renewal";
export type FollowupCategory = "ticket" | "work" | "office_sales" | "support_sales" | "renewal";
export type FollowupStatus = "pending" | "approved" | "sending" | "sent" | "rejected" | "skipped";

export interface TicketFollowup {
  id: string;
  org_id: string;
  source: FollowupSource;
  category: FollowupCategory | null;
  ticket_id: string;
  ticket_number: number | null;
  title: string;
  assignee_name: string;
  assignee_id: string | null;
  last_activity_at: string;
  body: string;
  status: FollowupStatus;
  author_name: string | null;
  send_at: string | null;
  decided_at: string | null;
  sent_at: string | null;
  skip_reason: string | null;
  created_at: string;
}

interface Item {
  source: FollowupSource;
  category: FollowupCategory;
  id: string;
  org_id: string;
  item_number: number | null;
  title: string;
  assignee: string;
  assignee_id: string | null;
  last_activity: string;
}

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// ─── العناصر (محسوبة في قاعدة البيانات: followup_items / followup_stale_items) ──

async function staleItems(): Promise<Item[]> {
  const { data, error } = await supabaseAdmin.rpc("followup_stale_items", { p_min_hours: STALE_HOURS, p_max_days: MAX_STALE_DAYS });
  if (error) throw error;
  return (data ?? []) as Item[];
}

/** حالة عنصر وحده الحين: null = انقفل/ما عاد مفتوح. */
async function itemNow(source: FollowupSource, id: string): Promise<Item | null> {
  const { data, error } = await supabaseAdmin.rpc("followup_items", { p_source: source, p_id: id });
  if (error) throw error;
  return ((data ?? []) as Item[])[0] ?? null;
}

// ─── نص المتابعة: قصير وبدون اسم العميل (الاسم أحياناً رقم جوال أو نقطة) ─────────

/** صيغ عامة تصلح لكل شي. */
const GENERAL = [
  "احتاج تحديث",
  "عطني آخر تحديث",
  "وش آخر تحديث؟",
  "طمني وش صار؟",
  "وين وصلنا؟",
  "ممكن تحديث لو سمحت؟",
];
/** صيغ فيها «العميل» — للتذاكر والصفقات والتجديدات (مو الطلبات الداخلية). */
const CLIENT = [
  "ايش صار مع العميل؟",
  "وش آخر شي مع العميل؟",
  "تواصلت مع العميل؟ وش صار؟",
];

export function draftBody(source: FollowupSource, assignee: string, avoid = new Set<string>()): string {
  const pool = source === "work" ? GENERAL : [...GENERAL, ...CLIENT];
  const choices = pool.filter((t) => !avoid.has(t));
  const t = pick(choices.length ? choices : pool);
  avoid.add(t);
  return `@${assignee} ${t}`;
}

// ─── أوقات إرسال طبيعية حسب القسم ─────────────────────────────────────────────

const RIYADH_MS = 3 * 3_600_000;
const H = (h: number, m = 0) => h * 60 + m;

interface SendWindow { start: number; end: number; breaks: [number, number][] }
/** نافذة الإرسال لكل قسم (دقائق بتوقيت الرياض). */
const WINDOWS: Record<FollowupCategory, SendWindow> = {
  ticket:        { start: H(7, 40), end: H(15, 5), breaks: [[H(11, 55), H(12, 40)]] },
  work:          { start: H(7, 40), end: H(15, 5), breaks: [[H(11, 55), H(12, 40)]] },
  office_sales:  { start: H(9),     end: H(16, 55), breaks: [[H(11, 55), H(12, 40)]] }, // ٩ ص – ٥ م
  support_sales: { start: H(13),    end: H(21, 55), breaks: [] },                      // ١ ظ – ١٠ م
  renewal:       { start: H(13),    end: H(21, 55), breaks: [] },                      // ١ ظ – ١٠ م
};
const windowMinutes = (w: SendWindow) => w.end - w.start - w.breaks.reduce((s, [a, b]) => s + (b - a), 0);

/** أيام دوام الفريق: كل الأيام ما عدا الجمعة (getUTCDay على تاريخ الرياض: الجمعة = 5). */
const TEAM_OFF_DAYS = [5];
const isTeamDay = (ymd: string) => !TEAM_OFF_DAYS.includes(new Date(`${ymd}T00:00:00Z`).getUTCDay());
function nextTeamDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1); while (!isTeamDay(d.toISOString().slice(0, 10)));
  return d.toISOString().slice(0, 10);
}

const riyadhMin = (d: Date) => { const s = new Date(d.getTime() + RIYADH_MS); return s.getUTCHours() * 60 + s.getUTCMinutes(); };
const atRiyadh = (ymd: string, min: number) => new Date(new Date(`${ymd}T00:00:00Z`).getTime() + min * 60_000 - RIYADH_MS);

/** ينقل الوقت لأقرب لحظة صالحة: يوم دوام، داخل نافذة القسم، خارج الاستراحة، ومو على رأس الساعة/نصها. */
function normalize(d: Date, w: SendWindow): Date {
  for (let guard = 0; guard < 20; guard++) {
    const day = saudiDateStr(d);
    const m = riyadhMin(d);
    if (!isTeamDay(day) || m >= w.end) { d = atRiyadh(nextTeamDay(day), w.start + rand(3, 40)); continue; }
    if (m < w.start) { d = atRiyadh(day, w.start + rand(3, 40)); continue; }
    const br = w.breaks.find(([a, b]) => m >= a && m < b);
    if (br) { d = atRiyadh(day, br[1] + rand(0, 15)); continue; }
    break;
  }
  const mm = new Date(d.getTime() + RIYADH_MS).getUTCMinutes();
  if (mm === 0 || mm === 30) d = new Date(d.getTime() + rand(2, 6) * 60_000);
  return new Date(d.getTime() + rand(0, 59) * 1000);
}

/** وقت تجهيز المسودات (أيام الدوام، ٧ ص – ١٠ م). */
export function inTeamHours(now = new Date()): boolean {
  const m = riyadhMin(now);
  return isTeamDay(saudiDateStr(now)) && m >= H(7) && m < H(22);
}

/**
 * يوزّع n إرسالات لقسم واحد داخل نافذته، بعد آخر موعد مجدول له، بفواصل عشوائية تتناسب مع العدد:
 * القليل يتباعد (حتى ~٤٠ د) والكثير يتقارب (أقل شي ~٢ د) عشان يخلص خلال يوم تقريباً.
 */
export function spreadSchedule(n: number, after: Date, category: FollowupCategory): Date[] {
  const w = WINDOWS[category];
  const out: Date[] = [];
  const avg = Math.min(40, Math.max(2.5, windowMinutes(w) / Math.max(1, n)));
  let cursor = new Date(Math.max(Date.now(), after.getTime()) + rand(5, 15) * 60_000);
  for (let i = 0; i < n; i++) {
    cursor = normalize(cursor, w);
    out.push(cursor);
    cursor = new Date(cursor.getTime() + Math.round(avg * (0.5 + Math.random()) * 60_000));
  }
  return out;
}

// ─── السوبر أدمن ─────────────────────────────────────────────────────────────

export async function getSuperAdmin(): Promise<{ id: string; name: string } | null> {
  const { data } = await supabaseAdmin
    .from("user_profiles").select("id, name").eq("is_super_admin", true).eq("is_active", true)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  return data?.name ? { id: data.id as string, name: (data.name as string).trim() } : null;
}

// ─── تجهيز المسودات ──────────────────────────────────────────────────────────

/** يجهّز مسودات جديدة للعناصر الساكتة، ويلغي المعلّقة اللي ما عادت ساكتة. يرجع عدد الجديد. */
export async function prepareDrafts(): Promise<number> {
  const admin = await getSuperAdmin();
  const stale = (await staleItems()).filter((s) => s.assignee !== admin?.name);
  const staleIds = new Set(stale.map((s) => s.id));

  const { data: open } = await supabaseAdmin
    .from("ticket_followups").select("id, ticket_id").in("status", ["pending", "approved"]);
  const openIds = new Set((open ?? []).map((o) => o.ticket_id as string));

  // مسودة لعنصر تحدّث أو انقفل أو تجاوز ١٠ أيام ← تتلغى
  const nowIso = new Date().toISOString();
  const obsolete = (open ?? []).filter((o) => !staleIds.has(o.ticket_id as string)).map((o) => o.id as string);
  for (let i = 0; i < obsolete.length; i += 200) {
    await supabaseAdmin.from("ticket_followups")
      .update({ status: "skipped", skip_reason: "ما عادت ضمن المتابعة (تحدّثت أو انقفلت أو تجاوزت ١٠ أيام)", decided_at: nowIso })
      .in("id", obsolete.slice(i, i + 200)).in("status", ["pending", "approved"]);
  }

  // ما نعيد اقتراح عنصر رفضته خلال آخر ٤٨ ساعة
  const since = new Date(Date.now() - STALE_MS).toISOString();
  const { data: rejected } = await supabaseAdmin
    .from("ticket_followups").select("ticket_id").eq("status", "rejected").gte("decided_at", since).limit(5000);
  const recentlyRejected = new Set((rejected ?? []).map((r) => r.ticket_id as string));

  const fresh = stale.filter((s) => !openIds.has(s.id) && !recentlyRejected.has(s.id));
  if (!fresh.length) return 0;

  const usedByAssignee = new Map<string, Set<string>>();
  const rows = fresh.map((s) => {
    const avoid = usedByAssignee.get(s.assignee) ?? new Set<string>();
    usedByAssignee.set(s.assignee, avoid);
    return {
      org_id: s.org_id, source: s.source, category: s.category, ticket_id: s.id, ticket_number: s.item_number,
      title: s.title, assignee_name: s.assignee, assignee_id: s.assignee_id, last_activity_at: s.last_activity,
      body: draftBody(s.source, s.assignee, avoid), status: "pending",
    };
  });
  // دفعات؛ ولو تعارضت دفعة مع الفهرس الفريد (تشغيلين متزامنين) نكمل واحد واحد
  let created = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await supabaseAdmin.from("ticket_followups").insert(chunk).select("id");
    if (!error) { created += data?.length ?? 0; continue; }
    for (const row of chunk) {
      const { error: e } = await supabaseAdmin.from("ticket_followups").insert(row);
      if (!e) created++;
    }
  }
  return created;
}

// ─── الإرسال ─────────────────────────────────────────────────────────────────

/** يرسل متابعة معتمدة كتعليق عادي باسم صاحبها. يتأكد قبلها إن العنصر ما زال مفتوح وساكت. */
export async function sendFollowup(f: TicketFollowup): Promise<"sent" | "skipped"> {
  const author = f.author_name ?? (await getSuperAdmin())?.name;
  const skip = async (reason: string) => {
    await supabaseAdmin.from("ticket_followups").update({ status: "skipped", skip_reason: reason }).eq("id", f.id);
    return "skipped" as const;
  };
  if (!author) return skip("ما فيه اسم مرسل");

  const now = await itemNow(f.source, f.ticket_id);
  if (!now) return skip("ما عادت مفتوحة وقت الإرسال");
  if (new Date(now.last_activity) > new Date(f.last_activity_at)) return skip("تحدّثت قبل الإرسال");

  if (f.source === "work") {
    const { error } = await supabaseAdmin.from("work_ticket_events").insert({
      ticket_id: f.ticket_id, org_id: f.org_id, event_type: "comment", body: f.body, actor_name: author,
    });
    if (error) throw error;
    await supabaseAdmin.from("work_tickets").update({ updated_at: new Date().toISOString() }).eq("id", f.ticket_id);
  } else {
    const entityType = f.source === "support" ? "ticket" : f.source; // ticket / deal / renewal
    const { data: note, error } = await supabaseAdmin.from("follow_up_notes")
      .insert({ org_id: f.org_id, entity_type: entityType, entity_id: f.ticket_id, note: f.body, author_name: author })
      .select("id").single();
    if (error) throw error;
    await supabaseAdmin.from("mention_notifications").insert({
      org_id: f.org_id, note_id: note.id, entity_type: entityType, entity_id: f.ticket_id,
      entity_name: f.title, mentioned_name: f.assignee_name, author_name: author, note_text: f.body,
    });
  }

  await supabaseAdmin.from("ticket_followups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", f.id);
  return "sent";
}

/** يرسل المتابعات المعتمدة اللي حان وقتها (كل وحدة تنحجز قبل الإرسال عشان ما تتكرر). */
export async function sendDue(): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const { data: due } = await supabaseAdmin
    .from("ticket_followups").select("*").eq("status", "approved").lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true }).limit(20);
  let sent = 0, skipped = 0;
  const errors: string[] = [];
  for (const f of (due ?? []) as TicketFollowup[]) {
    const { data: claimed } = await supabaseAdmin
      .from("ticket_followups").update({ status: "sending" }).eq("id", f.id).eq("status", "approved").select("id");
    if (!claimed?.length) continue;
    try {
      if ((await sendFollowup(f)) === "sent") sent++;
      else skipped++;
    } catch (e) {
      errors.push(`${f.title}: ${(e as Error).message}`);
      await supabaseAdmin.from("ticket_followups").update({ status: "approved" }).eq("id", f.id);
    }
  }
  return { sent, skipped, errors };
}
