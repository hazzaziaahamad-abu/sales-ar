import { MEETING_TYPES } from "@/lib/meetings";

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
  return { ok: true, fields: f };
}
