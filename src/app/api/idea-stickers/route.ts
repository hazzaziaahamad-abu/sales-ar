import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isStickerKind, stickerKind } from "@/lib/idea-stickers";

export const runtime = "nodejs";

/** GET /api/idea-stickers → استكرات لوحة الأفكار للمنظمة مرتبة. */
export async function GET() {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("idea_stickers").select("*").eq("org_id", access.orgId)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { stickers: data ?? [], userId: access.userId, isManager: access.isManager },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** POST /api/idea-stickers { kind, tag?, title, body } → استكر جديد في آخر اللوحة. */
export async function POST(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const kind = isStickerKind(b.kind) ? b.kind : "star";
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : "";
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 3000) : "";
  if (!title && !body) return NextResponse.json({ error: "اكتب عنوان الفكرة أو تفاصيلها" }, { status: 400 });
  const tag = typeof b.tag === "string" && b.tag.trim() ? b.tag.trim().slice(0, 60) : stickerKind(kind).tag;

  const { data: last } = await supabaseAdmin
    .from("idea_stickers").select("sort_order").eq("org_id", access.orgId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin
    .from("idea_stickers")
    .insert({
      org_id: access.orgId, kind, tag, title, body,
      sort_order: (last?.sort_order ?? -1) + 1,
      created_by: access.userId, created_by_name: access.name,
    })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sticker: data });
}
