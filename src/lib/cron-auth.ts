import { timingSafeEqual } from "crypto";
import { getPushConfig } from "@/lib/push";

const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * يتحقق من سر استدعاءات pg_cron: يقبل CRON_SECRET من البيئة (لو مضبوط)، أو السر المخزّن
 * في push_config.cron_secret بقاعدة البيانات — عشان المؤقتات ما تتعطل لو اختلف متغير Vercel.
 */
export async function verifyCronSecret(provided: string | null | undefined): Promise<boolean> {
  if (!provided) return false;
  const env = process.env.CRON_SECRET;
  if (env && safeEq(provided, env)) return true;
  const cfg = await getPushConfig();
  return !!cfg?.cron_secret && safeEq(provided, cfg.cron_secret);
}
