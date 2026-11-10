import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendPushToUser } from "@/lib/push";
import { getSuperAdmin, isPrepareTime, prepareDrafts, sendDue } from "@/lib/ticket-followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * متابعة التذاكر الساكتة — يستدعيها pg_cron كل دقيقة:
 *  - يرسل المتابعات اللي وافق عليها السوبر أدمن وحان موعدها (كتعليق عادي باسمه فيه منشن).
 *  - أيام التذكيرات فقط (السبت والاثنين والخميس) الساعة ٧:٠٣ ص: يجهّز مسودات للتذاكر والصفقات والتجديدات اللي لها
 *    ٤٨ ساعة إلى ١٠ أيام بدون تحديث، بعد تحليل ذكي يستبعد اللي ما تحتاج إجراء فعلاً، ويشعر السوبر أدمن يراجعها
 *    في /ticket-followups. ما ينرسل شي بدون موافقته.
 */
async function handle(req: NextRequest) {
  const secret = req.headers.get("x-push-secret") ?? req.headers.get("x-cron-secret");
  if (!(await verifyCronSecret(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDue();

  let drafted = 0;
  const now = new Date();
  const force = req.nextUrl.searchParams.get("prepare") === "1";
  if (force || isPrepareTime(now)) {
    drafted = await prepareDrafts();
    if (drafted > 0) {
      const admin = await getSuperAdmin();
      if (admin) {
        await sendPushToUser(admin.id, {
          title: "📋 متابعات تنتظر موافقتك",
          body: `${drafted} متابعة تحتاج إجراء فعلاً (بعد التحليل) — راجعها ووافق عليها`,
          url: "/ticket-followups",
          tag: "ticket-followups",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, drafted, ...result });
}

export const GET = handle;
export const POST = handle;
