// إرسال إشعارات الجوال (Web Push). المفاتيح من جدول push_config (service role فقط).
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface PushConfig { vapid_public: string; vapid_private: string; vapid_subject: string; cron_secret: string }
export interface PushPayload { title: string; body?: string; url?: string; tag?: string }

let cached: { cfg: PushConfig; at: number } | null = null;

export async function getPushConfig(): Promise<PushConfig | null> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.cfg;
  const { data } = await supabaseAdmin.from("push_config").select("vapid_public, vapid_private, vapid_subject, cron_secret").eq("id", 1).maybeSingle();
  if (!data) return null;
  cached = { cfg: data as PushConfig, at: Date.now() };
  return cached.cfg;
}

/** يرسل لكل أجهزة المستخدم، ويحذف الاشتراكات المنتهية (404/410). يرجع عدد الأجهزة اللي وصلها. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const cfg = await getPushConfig();
  if (!cfg) return 0;
  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let ok = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { vapidDetails: { subject: cfg.vapid_subject, publicKey: cfg.vapid_public, privateKey: cfg.vapid_private }, TTL: 3600, urgency: "high" }
      );
      ok++;
      await supabaseAdmin.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }));
  return ok;
}

/** يسجّل التذكير في push_log — يرجع false لو انرسل اليوم قبل (منع التكرار). */
export async function claimDaily(userId: string, kind: string, day: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("push_log").upsert({ user_id: userId, kind, day }, { onConflict: "user_id,kind,day", ignoreDuplicates: true })
    .select("user_id");
  return (data?.length ?? 0) > 0;
}
