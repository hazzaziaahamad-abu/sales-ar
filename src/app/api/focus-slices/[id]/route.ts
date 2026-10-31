import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSliceAccess } from "@/lib/api/focus-slices-access";
import {
  SLICE_COLS, dayLimit, SLICE_KINDS, cleanSliceTitle, isSliceKind, nextDayFor, todayRiyadh, type SliceKind, type SliceSpace,
} from "@/lib/focus-slices";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const COLS = SLICE_COLS;

/** الشريحة لازم تكون للمستخدم نفسه. */
async function ownSlice(id: string) {
  const { data: row } = await supabaseAdmin
    .from("focus_slices").select("id, org_id, user_id, space, kind, planned_for, focus_minutes").eq("id", id).maybeSingle();
  if (!row) return { res: NextResponse.json({ error: "غير موجودة" }, { status: 404 }) };
  const access = await getSliceAccess(row.space as SliceSpace);
  if (access instanceof NextResponse) return { res: access };
  if (row.org_id !== access.orgId || row.user_id !== access.userId) {
    return { res: NextResponse.json({ error: "غير موجودة" }, { status: 404 }) };
  }
  return { row, access };
}

/**
 * PATCH /api/focus-slices/[id]
 * { title?, kind?, plan?: "today" | "tomorrow" | null, done?: boolean, add_minutes?: number, session_at?: "HH:MM" | null }
 * «tomorrow» في العمل الوظيفي = يوم الدوام التالي.
 * الحد اليومي يُفرض هنا: عميقة واحدة + ٣ سطحية لكل يوم (٥ في الأفكار).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { row, access, res } = await ownSlice(id);
  if (res) return res;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (b.title !== undefined) {
    const title = cleanSliceTitle(b.title);
    if (!title) return NextResponse.json({ error: "اكتب عنوان الشريحة" }, { status: 400 });
    patch.title = title;
  }
  if (isSliceKind(b.kind)) patch.kind = b.kind;
  if ("plan" in b) {
    patch.planned_for = b.plan === "today" ? todayRiyadh() : b.plan === "tomorrow" ? nextDayFor(row.space as SliceSpace) : null;
  }
  // موعد الجلسة العميقة HH:MM (أو null للإلغاء)
  if (b.session_at === null) patch.session_at = null;
  else if (typeof b.session_at === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(b.session_at)) patch.session_at = b.session_at;
  if (typeof b.done === "boolean") patch.done_at = b.done ? new Date().toISOString() : null;
  // دقائق جلسة تركيز تنضاف لرصيد الشريحة
  const addMin = typeof b.add_minutes === "number" ? Math.round(b.add_minutes) : 0;
  if (addMin > 0) patch.focus_minutes = (row.focus_minutes ?? 0) + Math.min(addMin, 600);

  // فحص الحد لو تغيّر اليوم أو النوع والشريحة مخططة ليوم
  const kind = (patch.kind ?? row.kind) as SliceKind;
  const day = ("planned_for" in patch ? patch.planned_for : row.planned_for) as string | null;
  if (day && (day !== row.planned_for || kind !== row.kind)) {
    const { count } = await supabaseAdmin
      .from("focus_slices").select("id", { count: "exact", head: true })
      .eq("org_id", access.orgId).eq("user_id", access.userId).eq("space", row.space)
      .eq("planned_for", day).eq("kind", kind).neq("id", id);
    const limit = dayLimit(row.space as SliceSpace);
    if ((count ?? 0) >= limit[kind]) {
      const k = SLICE_KINDS[kind];
      const when = day === todayRiyadh() ? "اليوم" : "بكرة";
      return NextResponse.json(
        { error: kind === "deep"
          ? `${k.icon} عندك شريحة عميقة ${when} — وحدة تكفي. أنجزها أو رجّعها أولاً`
          : `${k.icon} اكتملت الشرائح السطحية ${when} (${limit.shallow}) — رجّع وحدة أولاً` },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabaseAdmin.from("focus_slices").update(patch).eq("id", id).select(COLS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slice: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { res } = await ownSlice(id);
  if (res) return res;
  const { error } = await supabaseAdmin.from("focus_slices").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
