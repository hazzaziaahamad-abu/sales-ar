import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/permissions";
import { getPushConfig } from "@/lib/push";

export const runtime = "nodejs";

/** GET → المفتاح العام (VAPID) للاشتراك. */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getPushConfig();
  if (!cfg) return NextResponse.json({ error: "الإشعارات غير مهيأة" }, { status: 503 });
  const { count } = await supabaseAdmin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  return NextResponse.json({ publicKey: cfg.vapid_public, devices: count ?? 0 });
}

/** POST { subscription } → حفظ اشتراك الجهاز. */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  const sub = b.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !/^https:\/\//.test(sub.endpoint)) {
    return NextResponse.json({ error: "اشتراك غير صالح" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert({
    user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
  }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE { endpoint } → إلغاء اشتراك الجهاز. */
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = ((await req.json().catch(() => ({}))) ?? {}) as { endpoint?: string };
  if (b.endpoint) await supabaseAdmin.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", b.endpoint);
  return NextResponse.json({ ok: true });
}
