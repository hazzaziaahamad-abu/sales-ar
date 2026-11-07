// متابعة التذاكر الساكتة (٤٨ ساعة بدون تحديث) — تجهيز مسودات، وبعد موافقة السوبر أدمن
// تنرسل كتعليق عادي باسمه فيه منشن للموظف، في أوقات متفرقة طبيعية داخل الدوام.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { saudiDateStr } from "@/lib/utils/format";

export const STALE_HOURS = 48;
const STALE_MS = STALE_HOURS * 3_600_000;
const SUPPORT_CLOSED = ["محلول", "مغلق"];

export type FollowupSource = "support" | "work";
export type FollowupStatus = "pending" | "approved" | "sending" | "sent" | "rejected" | "skipped";

export interface TicketFollowup {
  id: string;
  org_id: string;
  source: FollowupSource;
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

interface StaleTicket {
  source: FollowupSource;
  id: string;
  org_id: string;
  number: number;
  title: string;
  assignee: string;
  assigneeId: string | null;
  lastActivity: string;
}

const maxIso = (...xs: (string | null | undefined)[]) =>
  xs.filter((x): x is string => !!x).reduce((a, b) => (new Date(b) > new Date(a) ? b : a), "1970-01-01T00:00:00Z");

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// ─── آخر نشاط ────────────────────────────────────────────────────────────────

async function latestActivity(source: FollowupSource, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const rows: { key: string; at: string }[] = [];
    if (source === "support") {
      const { data } = await supabaseAdmin.from("follow_up_notes").select("entity_id, created_at")
        .eq("entity_type", "ticket").in("entity_id", chunk);
      for (const r of data ?? []) rows.push({ key: r.entity_id as string, at: r.created_at as string });
    } else {
      const { data } = await supabaseAdmin.from("work_ticket_events").select("ticket_id, created_at").in("ticket_id", chunk);
      for (const r of data ?? []) rows.push({ key: r.ticket_id as string, at: r.created_at as string });
    }
    for (const r of rows) if (!out.has(r.key) || new Date(r.at) > new Date(out.get(r.key)!)) out.set(r.key, r.at);
  }
  return out;
}

/** التذاكر المفتوحة في كل الأقسام اللي ما تحدّثت من ٤٨ ساعة (مع آخر نشاط لكل وحدة). */
export async function findStaleTickets(skipAssignee?: string): Promise<StaleTicket[]> {
  const cutoff = Date.now() - STALE_MS;
  const items: StaleTicket[] = [];

  const { data: tickets } = await supabaseAdmin
    .from("tickets")
    .select("id, org_id, ticket_number, client_name, issue, status, assigned_agent_name, created_at, updated_at, reopened_at")
    .not("status", "in", `(${SUPPORT_CLOSED.map((s) => `"${s}"`).join(",")})`)
    .limit(5000);
  const tNotes = await latestActivity("support", (tickets ?? []).map((t) => t.id as string));
  for (const t of tickets ?? []) {
    const assignee = ((t.assigned_agent_name as string | null) ?? "").trim();
    if (!assignee || assignee === skipAssignee) continue;
    const last = maxIso(t.created_at, t.updated_at, t.reopened_at, tNotes.get(t.id));
    if (new Date(last).getTime() > cutoff) continue;
    items.push({
      source: "support", id: t.id, org_id: t.org_id, number: t.ticket_number,
      title: (t.client_name || t.issue || "") as string, assignee, assigneeId: null, lastActivity: last,
    });
  }

  const { data: work } = await supabaseAdmin
    .from("work_tickets")
    .select("id, org_id, ticket_number, title, assigned_to, assigned_to_name, created_at, updated_at")
    .in("status", ["open", "in_progress"])
    .limit(5000);
  const wEvents = await latestActivity("work", (work ?? []).map((w) => w.id as string));
  for (const w of work ?? []) {
    const assignee = ((w.assigned_to_name as string | null) ?? "").trim();
    if (!assignee || assignee === skipAssignee) continue;
    const last = maxIso(w.created_at, w.updated_at, wEvents.get(w.id));
    if (new Date(last).getTime() > cutoff) continue;
    items.push({
      source: "work", id: w.id, org_id: w.org_id, number: w.ticket_number,
      title: (w.title || "") as string, assignee, assigneeId: (w.assigned_to as string | null) ?? null, lastActivity: last,
    });
  }
  return items;
}

// ─── نص المتابعة (صيغ متنوعة بأسلوب طبيعي) ────────────────────────────────────

const TEMPLATES: ((n: string, t: string, d: number) => string)[] = [
  (n, t) => `@${n} وش آخر المستجدات${t ? ` على ${t}` : " على هالتذكرة"}؟`,
  (n) => `@${n} هلا، طمني وين وصلت في هالتذكرة؟ لو فيه شي معطلها قول لي`,
  (n, _t, d) => `@${n} التذكرة واقفة من ${d} أيام تقريباً، وش وضعها؟`,
  (n, t) => `@${n} الله يعطيك العافية، ممكن تحدّث التذكرة${t ? ` (${t})` : ""} بآخر شي صار؟`,
  (n) => `@${n} محتاج تحديث على هالتذكرة لو سمحت، وين وصلنا؟`,
  (n, t) => `@${n} وش صار${t ? ` مع ${t}` : " في هالموضوع"}؟ حدّثني لو تكرمت`,
  (n) => `@${n} أبي أعرف وضع هالتذكرة، خلصت ولا لسا شغال عليها؟`,
];

export function draftBody(assignee: string, title: string, lastActivity: string, avoid = new Set<number>()): string {
  const days = Math.max(2, Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000));
  const short = title.length > 40 ? "" : title;
  const choices = TEMPLATES.map((_, i) => i).filter((i) => !avoid.has(i));
  const i = pick(choices.length ? choices : TEMPLATES.map((_, k) => k));
  avoid.add(i);
  return TEMPLATES[i](assignee, short, days);
}

// ─── أوقات إرسال طبيعية داخل الدوام ───────────────────────────────────────────

const RIYADH_MS = 3 * 3_600_000;
/** بداية/نهاية نافذة الإرسال (دقائق بتوقيت الرياض) — بعد بداية الدوام بشوي وقبل نهايته. */
const WINDOW_START = 7 * 60 + 40;
const WINDOW_END = 15 * 60 + 5;
/** وقت الظهر/الغداء — ما نرسل فيه. */
const BREAK_FROM = 11 * 60 + 55;
const BREAK_TO = 12 * 60 + 40;

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

/** ينقل الوقت لأقرب لحظة صالحة: يوم دوام، داخل النافذة، خارج وقت الظهر، ومو على رأس الساعة/نصها. */
function normalize(d: Date): Date {
  for (let guard = 0; guard < 20; guard++) {
    const day = saudiDateStr(d);
    const m = riyadhMin(d);
    if (!isTeamDay(day) || m >= WINDOW_END) { d = atRiyadh(nextTeamDay(day), WINDOW_START + rand(0, 80)); continue; }
    if (m < WINDOW_START) { d = atRiyadh(day, WINDOW_START + rand(0, 60)); continue; }
    if (m >= BREAK_FROM && m < BREAK_TO) { d = atRiyadh(day, BREAK_TO + rand(0, 25)); continue; }
    break;
  }
  const mm = new Date(d.getTime() + RIYADH_MS).getUTCMinutes();
  if (mm === 0 || mm === 30) d = new Date(d.getTime() + rand(2, 6) * 60_000);
  return new Date(d.getTime() + rand(0, 59) * 1000);
}

/** وقت دوام الفريق الحين؟ (لتجهيز المسودات) */
export function inTeamHours(now = new Date()): boolean {
  const m = riyadhMin(now);
  return isTeamDay(saudiDateStr(now)) && m >= 7 * 60 && m < 15 * 60 + 30;
}

/** يوزّع n إرسالات بعد آخر موعد مجدول: أول وحدة بعد ٨–٢٥ د، وبينها ١٢–٥٠ د. */
export function spreadSchedule(n: number, after: Date): Date[] {
  const out: Date[] = [];
  let cursor = new Date(Math.max(Date.now(), after.getTime()) + rand(8, 25) * 60_000);
  for (let i = 0; i < n; i++) {
    cursor = normalize(cursor);
    out.push(cursor);
    cursor = new Date(cursor.getTime() + rand(12, 50) * 60_000);
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

/** يجهّز مسودات جديدة للتذاكر الساكتة، ويلغي المسودات المعلّقة اللي تحدّثت تذاكرها. يرجع عدد الجديد. */
export async function prepareDrafts(): Promise<number> {
  const admin = await getSuperAdmin();
  const stale = await findStaleTickets(admin?.name);
  const staleIds = new Set(stale.map((s) => s.id));

  const { data: open } = await supabaseAdmin
    .from("ticket_followups").select("id, ticket_id, status, last_activity_at")
    .in("status", ["pending", "approved"]);
  const openByTicket = new Map((open ?? []).map((o) => [o.ticket_id as string, o]));

  // مسودة معلّقة/مجدولة لتذكرة صار عليها تحديث أو انقفلت ← تتلغى
  const nowIso = new Date().toISOString();
  const obsolete = (open ?? []).filter((o) => !staleIds.has(o.ticket_id as string)).map((o) => o.id as string);
  if (obsolete.length) {
    await supabaseAdmin.from("ticket_followups")
      .update({ status: "skipped", skip_reason: "تحدّثت التذكرة أو انقفلت", decided_at: nowIso })
      .in("id", obsolete).in("status", ["pending", "approved"]);
  }

  // ما نعيد اقتراح تذكرة رفضتها خلال آخر ٤٨ ساعة
  const since = new Date(Date.now() - STALE_MS).toISOString();
  const { data: rejected } = await supabaseAdmin
    .from("ticket_followups").select("ticket_id").eq("status", "rejected").gte("decided_at", since);
  const recentlyRejected = new Set((rejected ?? []).map((r) => r.ticket_id as string));

  const usedByAssignee = new Map<string, Set<number>>();
  const fresh = stale.filter((s) => !openByTicket.has(s.id) && !recentlyRejected.has(s.id));
  if (!fresh.length) return 0;

  const rows = fresh.map((s) => {
    const avoid = usedByAssignee.get(s.assignee) ?? new Set<number>();
    usedByAssignee.set(s.assignee, avoid);
    return {
      org_id: s.org_id, source: s.source, ticket_id: s.id, ticket_number: s.number, title: s.title,
      assignee_name: s.assignee, assignee_id: s.assigneeId, last_activity_at: s.lastActivity,
      body: draftBody(s.assignee, s.title, s.lastActivity, avoid), status: "pending",
    };
  });
  // إدخال واحد واحد: الفهرس الفريد (مسودة مفتوحة وحدة لكل تذكرة) يمنع التكرار لو تزامن تشغيلين
  let created = 0;
  for (const row of rows) {
    const { error } = await supabaseAdmin.from("ticket_followups").insert(row);
    if (!error) created++;
  }
  return created;
}

// ─── الإرسال ─────────────────────────────────────────────────────────────────

/** يرسل متابعة معتمدة كتعليق عادي باسم صاحبها. يتأكد قبلها إن التذكرة ما زالت ساكتة. */
export async function sendFollowup(f: TicketFollowup): Promise<"sent" | "skipped"> {
  const author = f.author_name ?? (await getSuperAdmin())?.name;
  const skip = async (reason: string) => {
    await supabaseAdmin.from("ticket_followups").update({ status: "skipped", skip_reason: reason }).eq("id", f.id);
    return "skipped" as const;
  };
  if (!author) return skip("ما فيه اسم مرسل");

  if (f.source === "support") {
    const { data: t } = await supabaseAdmin.from("tickets").select("status, updated_at, reopened_at").eq("id", f.ticket_id).maybeSingle();
    if (!t || SUPPORT_CLOSED.includes(t.status as string)) return skip("انقفلت التذكرة");
    const notes = await latestActivity("support", [f.ticket_id]);
    const last = maxIso(t.updated_at, t.reopened_at, notes.get(f.ticket_id));
    if (new Date(last) > new Date(f.last_activity_at)) return skip("تحدّثت التذكرة قبل الإرسال");

    const { data: note, error } = await supabaseAdmin.from("follow_up_notes")
      .insert({ org_id: f.org_id, entity_type: "ticket", entity_id: f.ticket_id, note: f.body, author_name: author })
      .select("id").single();
    if (error) throw error;
    await supabaseAdmin.from("mention_notifications").insert({
      org_id: f.org_id, note_id: note.id, entity_type: "ticket", entity_id: f.ticket_id,
      entity_name: f.title, mentioned_name: f.assignee_name, author_name: author, note_text: f.body,
    });
  } else {
    const { data: w } = await supabaseAdmin.from("work_tickets").select("status, updated_at").eq("id", f.ticket_id).maybeSingle();
    if (!w || !["open", "in_progress"].includes(w.status as string)) return skip("انقفلت التذكرة");
    const events = await latestActivity("work", [f.ticket_id]);
    const last = maxIso(w.updated_at, events.get(f.ticket_id));
    if (new Date(last) > new Date(f.last_activity_at)) return skip("تحدّثت التذكرة قبل الإرسال");

    const { error } = await supabaseAdmin.from("work_ticket_events").insert({
      ticket_id: f.ticket_id, org_id: f.org_id, event_type: "comment", body: f.body, actor_name: author,
    });
    if (error) throw error;
    await supabaseAdmin.from("work_tickets").update({ updated_at: new Date().toISOString() }).eq("id", f.ticket_id);
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
      errors.push(`#${f.ticket_number}: ${(e as Error).message}`);
      await supabaseAdmin.from("ticket_followups").update({ status: "approved" }).eq("id", f.id);
    }
  }
  return { sent, skipped, errors };
}
