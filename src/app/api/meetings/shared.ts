import { MEETING_TYPES, CLIENT_SCRIPT_KEYS, CLIENT_PURPOSES } from "@/lib/meetings";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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
