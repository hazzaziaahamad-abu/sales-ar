import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { canOpenPage } from "@/lib/permissions";
import { DEFAULT_PROFILE, DEFAULT_SESSION, DEFAULT_SIMPLE, type Simple } from "@/lib/salon-simple";

export const runtime = "nodejs";

/** كل عميلة في صف مستقل: simple_c_<id>. المفتاح القديم «simple» (خطة وحدة) يتحوّل لأول عميلة. */
const PREFIX = "simple_c_";
const LEGACY = "simple";
const ID_RE = /^[a-z0-9]{6,24}$/;
const TABLE = "salon_growth_settings";

/** «الخطة المبسطة للصالونات»: السوبر أدمن، أو من صفحة offer-salon-simple مفعّلة في دوره. */
async function access() {
  const a = await getTicketAccess();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canOpenPage(a.userId, "offer-salon-simple"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return a;
}

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function normalize(raw: unknown): Simple {
  const v = (raw ?? {}) as Partial<Simple>;
  return {
    ...DEFAULT_SIMPLE, ...v,
    costs: { ...DEFAULT_SIMPLE.costs, ...v.costs },
    session: { ...DEFAULT_SESSION, ...v.session },
    profile: { ...DEFAULT_PROFILE, ...v.profile },
    months: Array.isArray(v.months) ? v.months : [],
  };
}

function summary(id: string, raw: unknown, updated_at: string) {
  const s = normalize(raw);
  const cur = s.months[s.months.length - 1];
  return {
    id, name: s.name, model: s.model, goal: s.profile.goal, updated_at,
    session_date: s.session.date || null, session_done: !!s.session.done_at,
    months: s.months.length, month: cur?.month ?? null,
    month_done: cur ? cur.actions.filter((a) => cur.done[a]).length : 0, month_total: cur?.actions.length ?? 0,
  };
}

/** الخطة القديمة (عميلة وحدة) → أول عميلة في القائمة، مرة وحدة. */
async function migrateLegacy(orgId: string) {
  const { data } = await supabaseAdmin.from(TABLE).select("value").eq("org_id", orgId).eq("key", LEGACY).maybeSingle();
  if (!data) return;
  const s = normalize(data.value);
  if (s.name.trim() || s.model || s.services.some((x) => x.name.trim())) {
    const { error } = await supabaseAdmin.from(TABLE).insert({ org_id: orgId, key: PREFIX + newId(), value: data.value, updated_at: new Date().toISOString() });
    if (error) return;
  }
  await supabaseAdmin.from(TABLE).delete().eq("org_id", orgId).eq("key", LEGACY);
}

/** GET /api/salon-simple → قائمة العميلات؛ ?id= → خطة عميلة وحدة. */
export async function GET(req: NextRequest) {
  const a = await access();
  if (a instanceof NextResponse) return a;
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    if (!ID_RE.test(id)) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    const { data, error } = await supabaseAdmin.from(TABLE).select("value").eq("org_id", a.orgId).eq("key", PREFIX + id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
    return NextResponse.json({ simple: normalize(data.value) }, { headers: { "Cache-Control": "no-store" } });
  }
  await migrateLegacy(a.orgId);
  const { data, error } = await supabaseAdmin.from(TABLE).select("key, value, updated_at").eq("org_id", a.orgId).like("key", `${PREFIX}%`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const clients = (data ?? []).filter((r) => r.key.startsWith(PREFIX))
    .map((r) => summary(r.key.slice(PREFIX.length), r.value, r.updated_at))
    .sort((x, y) => y.updated_at.localeCompare(x.updated_at));
  return NextResponse.json({ clients }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/salon-simple { name } → عميلة جديدة. */
export async function POST(req: NextRequest) {
  const a = await access();
  if (a instanceof NextResponse) return a;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!name) return NextResponse.json({ error: "اكتب اسم العميلة" }, { status: 400 });
  const id = newId();
  const simple: Simple = { ...DEFAULT_SIMPLE, name };
  const { error } = await supabaseAdmin.from(TABLE).insert({ org_id: a.orgId, key: PREFIX + id, value: simple, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id, simple });
}

/** PUT /api/salon-simple?id= { value } → حفظ خطة العميلة. */
export async function PUT(req: NextRequest) {
  const a = await access();
  if (a instanceof NextResponse) return a;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return NextResponse.json({ error: "عميلة غير معروفة" }, { status: 400 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const v = b.value;
  if (!v || typeof v !== "object" || Array.isArray(v) || JSON.stringify(v).length > 100000) {
    return NextResponse.json({ error: "قيمة غير صالحة" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from(TABLE).upsert(
    { org_id: a.orgId, key: PREFIX + id, value: v, updated_at: new Date().toISOString() },
    { onConflict: "org_id,key" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE /api/salon-simple?id= → حذف عميلة. */
export async function DELETE(req: NextRequest) {
  const a = await access();
  if (a instanceof NextResponse) return a;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!ID_RE.test(id)) return NextResponse.json({ error: "عميلة غير معروفة" }, { status: 400 });
  const { error } = await supabaseAdmin.from(TABLE).delete().eq("org_id", a.orgId).eq("key", PREFIX + id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
