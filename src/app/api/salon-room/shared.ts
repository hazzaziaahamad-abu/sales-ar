import { KPIS, type KpiKey } from "@/lib/salon-growth";
import { LEAD_STATUS_IDS, STAGE_IDS, type Health, type LeadStatus, type LogKind, type Priority, type Stage } from "@/lib/salon-room";
import { BOARD_CATEGORY_IDS, BOARD_STATUS_IDS, type BoardCategory, type BoardStatus, type BoardStep } from "@/lib/salon-room-board";

const str = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const date = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
const numOrNull = (v: unknown, max = 1e9) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, -max), max) : null;
};
const KPI_KEYS = new Set<string>(KPIS.map((k) => k.key));
const HEALTHS: Health[] = ["on_track", "at_risk", "off_track"];

function kpiValues(v: unknown): Partial<Record<KpiKey, number | null>> {
  const out: Partial<Record<KpiKey, number | null>> = {};
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (KPI_KEYS.has(k)) out[k as KpiKey] = numOrNull(val);
  }
  return out;
}

type Parsed = { ok: true; fields: Record<string, unknown> } | { ok: false; error: string };

export function parseClient(b: Record<string, unknown>, partial: boolean): Parsed {
  const f: Record<string, unknown> = {};
  const has = (k: string) => k in b;
  if (!partial || has("salon_name")) {
    const salon_name = str(b.salon_name, 120);
    if (salon_name.length < 2) return { ok: false, error: "اسم الصالون مطلوب" };
    f.salon_name = salon_name;
  }
  for (const k of ["owner_name", "phone", "city", "consultant"] as const) if (has(k)) f[k] = str(b[k], 120) || null;
  if (has("stage")) {
    if (!STAGE_IDS.includes(b.stage as Stage)) return { ok: false, error: "مرحلة غير صالحة" };
    f.stage = b.stage;
  }
  if (has("health")) {
    if (!HEALTHS.includes(b.health as Health)) return { ok: false, error: "حالة غير صالحة" };
    f.health = b.health;
  }
  for (const k of ["start_date", "next_review", "next_followup"] as const) if (has(k)) f[k] = date(b[k]);
  for (const k of ["source", "segment"] as const) if (has(k)) f[k] = str(b[k], 60) || null;
  if (has("priority")) f.priority = (["A", "B", "C"] as Priority[]).includes(b.priority as Priority) ? b.priority : "B";
  if (has("lead_status")) {
    if (!LEAD_STATUS_IDS.includes(b.lead_status as LeadStatus)) return { ok: false, error: "حالة استهداف غير صالحة" };
    f.lead_status = b.lead_status;
  }
  if (has("contract_value")) f.contract_value = numOrNull(b.contract_value);
  if (has("baseline")) f.baseline = kpiValues(b.baseline);
  if (has("current")) f.current = kpiValues(b.current);
  if (has("goals")) {
    f.goals = Array.isArray(b.goals)
      ? b.goals.slice(0, 3).map((g) => {
          const kpi = String((g as { kpi?: unknown })?.kpi ?? "");
          return { kpi: KPI_KEYS.has(kpi) ? kpi : "", target: numOrNull((g as { target?: unknown })?.target) };
        })
      : [];
  }
  if (has("notes")) f.notes = text(b.notes, 5000);
  if (has("free_session")) {
    const fs = b.free_session;
    if (!fs || typeof fs !== "object" || Array.isArray(fs) || JSON.stringify(fs).length > 10000) return { ok: false, error: "بيانات الجلسة غير صالحة" };
    f.free_session = fs;
  }
  if (has("diagnosis")) {
    const d = b.diagnosis;
    if (!d || typeof d !== "object" || Array.isArray(d) || JSON.stringify(d).length > 60000) return { ok: false, error: "تشخيص غير صالح" };
    f.diagnosis = d;
  }
  if (has("archived")) f.archived = !!b.archived;
  return { ok: true, fields: f };
}

export function parseTask(b: Record<string, unknown>, partial: boolean): Parsed {
  const f: Record<string, unknown> = {};
  const has = (k: string) => k in b;
  if (!partial) {
    if (typeof b.client_id !== "string") return { ok: false, error: "العميل مطلوب" };
    if (!STAGE_IDS.includes(b.phase as Stage)) return { ok: false, error: "مرحلة غير صالحة" };
    f.client_id = b.client_id;
    f.phase = b.phase;
  }
  if (!partial || has("title")) {
    const title = str(b.title, 200);
    if (!title) return { ok: false, error: "اكتب المهمة" };
    f.title = title;
  }
  if (has("due_date")) f.due_date = date(b.due_date);
  if (has("assignee")) f.assignee = str(b.assignee, 60) || null;
  return { ok: true, fields: f };
}

export function parseLog(b: Record<string, unknown>): Parsed {
  if (typeof b.client_id !== "string") return { ok: false, error: "العميل مطلوب" };
  const kind = (["note", "checkin", "meeting", "contact"] as LogKind[]).includes(b.kind as LogKind) ? b.kind : "note";
  const body = text(b.body, 2000);
  if (!body) return { ok: false, error: "اكتب الملاحظة" };
  return { ok: true, fields: { client_id: b.client_id, kind, body } };
}

export function parseTargets(b: Record<string, unknown>) {
  const n = (v: unknown, def: number) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) ? Math.min(Math.max(x, 0), 1000) : def;
  };
  const money = (v: unknown, def: number) => {
    const x = Math.round(Number(v));
    return Number.isFinite(x) ? Math.min(Math.max(x, 0), 1_000_000) : def;
  };
  return {
    contacts: n(b.contacts, 30), meetings: n(b.meetings, 5), contracts: n(b.contracts, 2),
    sessions_cap: n(b.sessions_cap, 3), session_value: money(b.session_value, 1500), session_cost: money(b.session_cost, 600),
  };
}

/** مراحل ما بعد التوقيع — أول دخول لها = تاريخ التعاقد. */
export const CONTRACTED_STAGES: Stage[] = ["onboarding", "execution", "review", "done"];

export function parseTeam(b: Record<string, unknown>, partial: boolean): Parsed {
  const f: Record<string, unknown> = {};
  const has = (k: string) => k in b;
  if (!partial || has("name")) {
    const name = str(b.name, 60);
    if (name.length < 2) return { ok: false, error: "اكتب الاسم" };
    f.name = name;
  }
  if (has("role")) f.role = str(b.role, 60) || "مستشارة";
  if (has("phone")) f.phone = str(b.phone, 30) || null;
  if (has("active")) f.active = !!b.active;
  return { ok: true, fields: f };
}

/** مهمة في «جدول المهام» — الخطوات تُستبدل كاملة، والتحديثات تُضاف واحد واحد (add_update) عشان ما تضيع تحديثات زميلة. */
export function parseBoard(b: Record<string, unknown>, partial: boolean): Parsed {
  const f: Record<string, unknown> = {};
  const has = (k: string) => k in b;
  if (!partial || has("title")) {
    const title = str(b.title, 200);
    if (!title) return { ok: false, error: "اكتب عنوان المهمة" };
    f.title = title;
  }
  if (!partial || has("category")) f.category = BOARD_CATEGORY_IDS.includes(b.category as BoardCategory) ? b.category : "other";
  if (has("body")) f.body = text(b.body, 5000);
  if (has("assignee")) f.assignee = str(b.assignee, 60) || null;
  if (has("priority")) f.priority = (["A", "B", "C"] as Priority[]).includes(b.priority as Priority) ? b.priority : "B";
  if (has("status")) {
    if (!BOARD_STATUS_IDS.includes(b.status as BoardStatus)) return { ok: false, error: "حالة غير صالحة" };
    f.status = b.status;
  }
  if (has("due_date")) f.due_date = date(b.due_date);
  if (has("steps")) {
    if (!Array.isArray(b.steps) || b.steps.length > 30) return { ok: false, error: "خطوات غير صالحة" };
    const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
    f.steps = b.steps.map((x, i): BoardStep => {
      const s = (x ?? {}) as Record<string, unknown>;
      return { key: str(s.key, 40) || `s${i + 1}`, label: str(s.label, 200) || "خطوة", done_at: iso(s.done_at), done_by: str(s.done_by, 60) || null };
    });
  }
  return { ok: true, fields: f };
}
