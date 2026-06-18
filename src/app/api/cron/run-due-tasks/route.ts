import { NextRequest, NextResponse } from "next/server";
import { runDueTasks } from "@/lib/tasks/executor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invoked by Supabase pg_cron (via pg_net.http_post) every minute. Runs all due
 * scheduled tasks. Guarded by a shared secret so it can't be triggered publicly.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDueTasks();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "run failed" },
      { status: 500 }
    );
  }
}

export const POST = handle;
export const GET = handle;
