import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";

export const runtime = "nodejs";

/** POST /api/idea-stickers/[id]/like → يبدّل إعجاب المستخدم الحالي (أي عضو في المنظمة). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: sticker } = await supabaseAdmin
    .from("idea_stickers").select("likes").eq("id", id).eq("org_id", access.orgId).maybeSingle();
  if (!sticker) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  const likes = (sticker.likes as string[] | null) ?? [];
  const next = likes.includes(access.userId) ? likes.filter((u) => u !== access.userId) : [...likes, access.userId];
  const { data, error } = await supabaseAdmin.from("idea_stickers").update({ likes: next }).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sticker: data });
}
