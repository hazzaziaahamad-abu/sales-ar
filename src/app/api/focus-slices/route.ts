import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSliceAccess } from "@/lib/api/focus-slices-access";
import {
  SLICE_COLS, SLICE_MAX, SLICES_PER_IDEA_MAX, cleanSliceTitle, isSliceKind, isSliceSpace, nextDayFor, todayRiyadh,
} from "@/lib/focus-slices";

export const runtime = "nodejs";

const COLS = SLICE_COLS;

/** GET /api/focus-slices?space=ideas → شرائح المستخدم نفسه في المساحة. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("space");
  const space = isSliceSpace(raw) ? raw : "ideas";
  const access = await getSliceAccess(space);
  if (access instanceof NextResponse) return access;

  const { data, error } = await supabaseAdmin
    .from("focus_slices").select(COLS)
    .eq("org_id", access.orgId).eq("user_id", access.userId).eq("space", space)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { slices: data ?? [], today: todayRiyadh(), tomorrow: nextDayFor(space) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * POST /api/focus-slices { space, parent_id, slices: [{ title, kind }] } → حفظ شرائح (تروح «باقي الشرائح»).
 * الأم: فكرة من اللوحة (ideas) أو بند عمل (work). idea_id مقبول للتوافق.
 */
export async function POST(req: NextRequest) {
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const space = isSliceSpace(b.space) ? b.space : "ideas";
  const access = await getSliceAccess(space);
  if (access instanceof NextResponse) return access;

  const parentId = typeof b.parent_id === "string" ? b.parent_id : typeof b.idea_id === "string" ? b.idea_id : "";
  const parentCol = space === "work" ? "work_item_id" : "idea_id";
  const { data: parent } = space === "work"
    ? await supabaseAdmin.from("work_items").select("id").eq("id", parentId).eq("org_id", access.orgId).eq("user_id", access.userId).maybeSingle()
    : await supabaseAdmin.from("idea_stickers").select("id").eq("id", parentId).eq("org_id", access.orgId).maybeSingle();
  if (!parent) return NextResponse.json({ error: space === "work" ? "البند غير موجود" : "الفكرة غير موجودة" }, { status: 404 });

  const rows = (Array.isArray(b.slices) ? b.slices : [])
    .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>) : {}))
    .map((s) => ({ title: cleanSliceTitle(s.title), kind: isSliceKind(s.kind) ? s.kind : "shallow" }))
    .filter((s) => s.title)
    .slice(0, SLICE_MAX);
  if (!rows.length) return NextResponse.json({ error: "اكتب شريحة واحدة على الأقل" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("focus_slices").select("sort_order")
    .eq("org_id", access.orgId).eq("user_id", access.userId).eq(parentCol, parentId)
    .order("sort_order", { ascending: false });
  if ((existing?.length ?? 0) + rows.length > SLICES_PER_IDEA_MAX) {
    return NextResponse.json({ error: `الحد ${SLICES_PER_IDEA_MAX} شريحة للفكرة — أنجز أو احذف شرائح قديمة أولاً` }, { status: 400 });
  }
  const base = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from("focus_slices")
    .insert(rows.map((r, i) => ({
      org_id: access.orgId, user_id: access.userId, space, [parentCol]: parentId,
      title: r.title, kind: r.kind, sort_order: base + i,
    })))
    .select(COLS);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slices: data ?? [] });
}
