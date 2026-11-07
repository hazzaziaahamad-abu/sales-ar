import { supabaseAdmin } from "@/lib/supabase/admin";
import { ensureClientMeetingLink } from "@/lib/api/client-meeting-link";
import { MEETING_TYPES, CLIENT_SCRIPT_KEYS, CLIENT_PURPOSES } from "@/lib/meetings";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** يتحقق من حقول الاجتماع ويرجع الحقول المسموحة فقط. */
export function parseMeetingFields(body: Record<string, unknown>, partial: boolean):
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; error: string } {
  const f: Record<string, unknown> = {};
  const has = (k: string) => k in body;

  if (!partial || has("title")) {
    const title = String(body.title ?? "").trim();
    if (!title) return { ok: false, error: "عنوان الاجتماع مطلوب" };
    f.title = title.slice(0, 200);
  }
  if (!partial || has("meeting_date")) {
    if (typeof body.meeting_date !== "string" || !DATE_RE.test(body.meeting_date)) return { ok: false, error: "تاريخ غير صالح" };
    f.meeting_date = body.meeting_date;
  }
  if (!partial || has("start_time")) {
    if (typeof body.start_time !== "string" || !TIME_RE.test(body.start_time)) return { ok: false, error: "وقت غير صالح" };
    f.start_time = body.start_time;
  }
  if (has("meeting_type")) {
    f.meeting_type = MEETING_TYPES.includes(body.meeting_type as never) ? body.meeting_type : "internal";
  }
  if (has("duration_minutes")) {
    const d = Number(body.duration_minutes);
    f.duration_minutes = Number.isFinite(d) ? Math.min(Math.max(Math.round(d), 5), 600) : 30;
  }
  if (has("location")) f.location = String(body.location ?? "").trim().slice(0, 500) || null;
  if (has("agenda")) f.agenda = String(body.agenda ?? "").trim().slice(0, 5000) || null;
  if (has("minutes")) f.minutes = String(body.minutes ?? "").trim().slice(0, 10000) || null;
  if (has("attendees")) {
    f.attendees = Array.isArray(body.attendees)
      ? Array.from(new Set(body.attendees.map((a) => String(a).trim()).filter(Boolean))).slice(0, 50)
      : [];
  }
  if (has("deal_id")) {
    const d = typeof body.deal_id === "string" ? body.deal_id.trim() : "";
    if (d && !UUID_RE.test(d)) return { ok: false, error: "صفقة غير صالحة" };
    f.deal_id = d || null;
  }
  if (has("client_brief")) f.client_brief = parseClientBrief(body.client_brief);
  return { ok: true, fields: f };
}

/** يرجّع تفاصيل اجتماع العميل بالحقول المسموحة فقط، أو null. */
function parseClientBrief(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const rawNotes = (b.notes && typeof b.notes === "object" ? b.notes : {}) as Record<string, unknown>;
  const notes: Record<string, string> = {};
  for (const k of CLIENT_SCRIPT_KEYS) {
    const v = String(rawNotes[k] ?? "").trim().slice(0, 5000);
    if (v) notes[k] = v;
  }
  const done = Array.isArray(b.done)
    ? CLIENT_SCRIPT_KEYS.filter((k) => (b.done as unknown[]).includes(k))
    : [];
  return {
    client_name: String(b.client_name ?? "").trim().slice(0, 200),
    client_phone: String(b.client_phone ?? "").trim().slice(0, 50),
    purpose: CLIENT_PURPOSES.includes(b.purpose as never) ? b.purpose : "new",
    notes,
    done,
  };
}

type LinkAccess = { userId: string; orgId: string; name: string | null };

/**
 * لو الطلب فيه صفقة: نربط الموعد برابط «خطة الاجتماع» حقها (ننشئه لو ما وُجد)،
 * ونعبّي اسم العميل وجواله من الصفقة لو فاضية. لو انشالت الصفقة نفك الربط.
 */
export async function linkDeal(fields: Record<string, unknown>, access: LinkAccess):
  Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!("deal_id" in fields)) return { ok: true };
  if (!fields.deal_id) {
    fields.client_meeting_id = null;
    return { ok: true };
  }
  const res = await ensureClientMeetingLink(String(fields.deal_id), access);
  if (!res.ok) return res;
  fields.client_meeting_id = res.meeting.id;
  const brief = fields.client_brief as { client_name?: string; client_phone?: string } | null | undefined;
  if (brief) {
    if (!brief.client_name) brief.client_name = res.deal.client_name ?? "";
    if (!brief.client_phone) brief.client_phone = res.deal.client_phone ?? "";
  }
  return { ok: true };
}

/** يضيف لكل اجتماع بيانات رابط خطة الاجتماع (token، كم مرة انفتح). */
export async function attachPlans<T extends { client_meeting_id?: string | null }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.client_meeting_id).filter(Boolean))] as string[];
  const plans = new Map<string, { token: string; open_count: number }>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabaseAdmin.from("client_meetings").select("id, token, open_count").in("id", ids.slice(i, i + 300));
    for (const p of data ?? []) plans.set(p.id, { token: p.token, open_count: p.open_count });
  }
  return rows.map((r) => ({ ...r, plan: r.client_meeting_id ? plans.get(r.client_meeting_id) ?? null : null }));
}
