import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/permissions";

export const runtime = "nodejs";

const TAGS = new Set(["focus"]);

/**
 * POST { tag, send_at | null, title?, body?, url? } → جدولة إشعار لوقت محدد (أو إلغاؤه بـ send_at = null).
 * مثل: «انتهى وقت التركيز» يوصل والجوال مقفل. الـcron يرسله في وقته.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const tag = String(b.tag ?? "");
  if (!TAGS.has(tag)) return NextResponse.json({ error: "tag غير مسموح" }, { status: 400 });

  if (b.send_at === null) {
    await supabaseAdmin.from("push_queue").delete().eq("user_id", user.id).eq("tag", tag);
    return NextResponse.json({ ok: true });
  }
  const at = new Date(String(b.send_at));
  if (isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000 || at.getTime() > Date.now() + 12 * 3600_000) {
    return NextResponse.json({ error: "وقت غير صالح" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("push_queue").upsert({
    user_id: user.id, tag, send_at: at.toISOString(), sent_at: null,
    title: String(b.title ?? "").slice(0, 120) || "⏰ انتهى الوقت",
    body: String(b.body ?? "").slice(0, 300),
    url: typeof b.url === "string" && b.url.startsWith("/") ? b.url.slice(0, 200) : "/",
  }, { onConflict: "user_id,tag" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
