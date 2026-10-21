import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CLIENT_COLS, type ClientRow } from "@/lib/salon-growth";
import { getSalonAccess, toNum } from "../../shared";

export const runtime = "nodejs";

/** PATCH /api/salon-growth/clients/[id] { winback_sent: true } → تسجيل إرسال عرض الاسترجاع. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const access = await getSalonAccess();
  if (access instanceof NextResponse) return access;
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  if (b.winback_sent !== true) return NextResponse.json({ error: "لا يوجد تعديل" }, { status: 400 });
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("salon_clients").update({ winback_sent_at: now, updated_at: now })
    .eq("id", id).eq("org_id", access.orgId).select(CLIENT_COLS).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json({ client: toNum(data as ClientRow, ["total_spent", "visits"]) });
}
