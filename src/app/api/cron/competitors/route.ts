import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/cron-auth";
import { syncCompetitors } from "@/lib/content-desk/competitors-sync";
import { COMPETITOR_COLS, type Competitor } from "@/lib/content-desk/bank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** السحب اليومي لحسابات المنافسين (pg_cron ٦ ص الرياض). */
export async function POST(req: NextRequest) {
  if (!(await verifyCronSecret(req.headers.get("x-push-secret")))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin.from("content_competitors").select(COMPETITOR_COLS).eq("active", true).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = await syncCompetitors((data ?? []) as Competitor[]);
  return NextResponse.json(res);
}
