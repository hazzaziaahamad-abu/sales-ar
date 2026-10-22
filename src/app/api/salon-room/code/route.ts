import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTicketAccess } from "@/lib/api/work-ticket-access";
import { isSuperAdmin } from "@/lib/permissions";
import { hashCode, newSalt, setRoomCookie } from "@/lib/api/salon-room-auth";
import { ROOM_MIN_CODE } from "@/lib/salon-room";

export const runtime = "nodejs";

/** PUT /api/salon-room/code { code } → ضبط/تغيير كود الغرفة (السوبر أدمن فقط). يُخرج كل الجلسات القديمة. */
export async function PUT(req: NextRequest) {
  const access = await getTicketAccess();
  if (!access) return NextResponse.json({ error: "سجّل الدخول للمنصة أولاً" }, { status: 401 });
  if (!(await isSuperAdmin(access.userId))) return NextResponse.json({ error: "للمسؤول فقط" }, { status: 403 });

  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const code = String(b.code ?? "").trim();
  if (code.length < ROOM_MIN_CODE || code.length > 64) {
    return NextResponse.json({ error: `الكود لازم يكون ${ROOM_MIN_CODE} خانات على الأقل` }, { status: 400 });
  }
  const salt = newSalt();
  const code_set_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("consult_room_settings").upsert(
    { org_id: access.orgId, code_hash: hashCode(code, salt), code_salt: salt, code_set_at, updated_by: access.userId },
    { onConflict: "org_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = NextResponse.json({ ok: true });
  setRoomCookie(res, access.orgId, code_set_at);
  return res;
}
