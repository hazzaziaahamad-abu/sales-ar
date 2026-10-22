import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isSuperAdmin } from "@/lib/permissions";
import { checkCode, clearRoomCookie, clientIp, getRoomAccess, lockedFor, setRoomCookie } from "@/lib/api/salon-room-auth";

export const runtime = "nodejs";

/** السوبر أدمن المسجّل في المنصة يقدر يضبط كود الغرفة (ما يتخطّى الكود). */
async function isOwner() {
  try {
    const a = await getTicketAccess();
    return a ? await isSuperAdmin(a.userId) : false;
  } catch {
    return false;
  }
}

/** GET /api/salon-room/session → { configured, authed, isOwner } */
export async function GET(req: NextRequest) {
  const [{ count }, access, owner] = await Promise.all([
    supabaseAdmin.from("consult_room_settings").select("org_id", { count: "exact", head: true }),
    getRoomAccess(req),
    isOwner(),
  ]);
  return NextResponse.json(
    { configured: (count ?? 0) > 0, authed: !(access instanceof NextResponse), isOwner: owner },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** POST /api/salon-room/session { code } → دخول الغرفة. */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const wait = lockedFor(ip);
  if (wait) return NextResponse.json({ error: `محاولات كثيرة — حاول بعد ${wait} دقيقة` }, { status: 429 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const code = String(b.code ?? "").trim();
  if (!code || code.length > 64) return NextResponse.json({ error: "أدخل الكود" }, { status: 400 });
  const hit = await checkCode(ip, code);
  if (!hit) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "الكود غير صحيح" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setRoomCookie(res, hit.orgId, hit.codeSetAt);
  return res;
}

/** DELETE /api/salon-room/session → خروج. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  clearRoomCookie(res);
  return res;
}
