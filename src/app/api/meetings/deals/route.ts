import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";

export const runtime = "nodejs";

/** GET /api/meetings/deals?q=... → صفقات المنظمة بالاسم أو الجوال، لربط موعد العميل بصفقته. */
export async function GET(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // نشيل الرموز اللي لها معنى في فلاتر PostgREST.
  const q = (req.nextUrl.searchParams.get("q") ?? "").replace(/[,()*%\\]/g, " ").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ deals: [] });

  const { data, error } = await supabaseAdmin
    .from("deals")
    .select("id, client_name, client_phone, stage, plan, source, assigned_rep_name, created_at")
    .eq("org_id", access.orgId)
    .or(`client_name.ilike.%${q}%,client_phone.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deals: data ?? [] });
}
