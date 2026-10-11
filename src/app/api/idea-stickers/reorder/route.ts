import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";

export const runtime = "nodejs";

/** POST /api/idea-stickers/reorder { ids: [...] } → يحفظ ترتيب اللوحة بعد السحب والإفلات (أي عضو في المنظمة). */
export async function POST(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 1000) : [];
  if (!ids.length) return NextResponse.json({ error: "ids مطلوبة" }, { status: 400 });
  const results = await Promise.all(
    ids.map((id, i) => supabaseAdmin.from("idea_stickers").update({ sort_order: i }).eq("id", id).eq("org_id", access.orgId))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
