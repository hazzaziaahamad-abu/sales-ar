import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSliceAccess } from "@/lib/api/focus-slices-access";
import {
  DAY_LIMIT, SLICE_KINDS, cleanSliceTitle, isSliceKind, todayRiyadh, tomorrowRiyadh, type SliceKind, type SliceSpace,
} from "@/lib/focus-slices";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

const COLS = "id, space, idea_id, title, kind, planned_for, done_at, focus_minutes, sort_order, created_at";

/** الشريحة لازم تكون للمستخدم نفسه. */
async function ownSlice(id: string) {
  const { data: row } = await supabaseAdmin
    .from("focus_slices").select("id, org_id, user_id, space, kind, planned_for").eq("id", id).maybeSingle();
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
 * { title?, kind?, plan?: "today" | "tomorrow" | null, done?: boolean }
 * الحد اليومي يُفرض هنا: عميقة واحدة + ٣ سطحية لكل يوم.
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
    patch.planned_for = b.plan === "today" ? todayRiyadh() : b.plan === "tomorrow" ? tomorrowRiyadh() : null;
  }
  if (typeof b.done === "boolean") patch.done_at = b.done ? new Date().toISOString() : null;

  // فحص الحد لو تغيّر اليوم أو النوع والشريحة مخططة ليوم
  const kind = (patch.kind ?? row.kind) as SliceKind;
  const day = ("planned_for" in patch ? patch.planned_for : row.planned_for) as string | null;
  if (day && (day !== row.planned_for || kind !== row.kind)) {
    const { count } = await supabaseAdmin
      .from("focus_slices").select("id", { count: "exact", head: true })
      .eq("org_id", access.orgId).eq("user_id", access.userId).eq("space", row.space)
      .eq("planned_for", day).eq("kind", kind).neq("id", id);
    if ((count ?? 0) >= DAY_LIMIT[kind]) {
      const k = SLICE_KINDS[kind];
      const when = day === todayRiyadh() ? "اليوم" : "بكرة";
      return NextResponse.json(
        { error: kind === "deep"
          ? `${k.icon} عندك شريحة عميقة ${when} — وحدة تكفي. أنجزها أو رجّعها أولاً`
          : `${k.icon} اكتملت الشرائح السطحية ${when} (${DAY_LIMIT.shallow}) — رجّع وحدة أولاً` },
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
