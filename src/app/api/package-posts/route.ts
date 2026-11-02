import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";

export const runtime = "nodejs";

/** GET /api/package-posts → بوستات الباقات للمنظمة (الأقدم أولاً). */
export async function GET() {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("package_posts").select("id, data, updated_at").eq("org_id", access.orgId)
    .order("created_at", { ascending: true }).limit(500);
  if (error) return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  const posts = (data ?? []).map((r) => ({ ...(r.data as object), id: r.id, updatedAt: r.updated_at }));
  return NextResponse.json({ posts }, { headers: { "Cache-Control": "no-store" } });
}
