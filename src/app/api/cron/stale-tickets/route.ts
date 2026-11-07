import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { sendPushToUser } from "@/lib/push";
import { workClock, riyadhMinutes } from "@/lib/work-hours";
import { getSuperAdmin, prepareDrafts, sendDue } from "@/lib/ticket-followups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * متابعة التذاكر الساكتة — يستدعيها pg_cron كل دقيقة:
 *  - يرسل المتابعات اللي وافق عليها السوبر أدمن وحان موعدها (كتعليق عادي باسمه فيه منشن).
 *  - كل ربع ساعة وقت الدوام: يجهّز مسودات للتذاكر اللي لها ٤٨ ساعة بدون تحديث (كل الأقسام)
 *    ويشعر السوبر أدمن يراجعها في /ticket-followups. ما ينرسل شي بدون موافقته.
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
  if (force || (workClock(now).phase === "on" && riyadhMinutes(now) % 15 === 3)) {
    drafted = await prepareDrafts();
    if (drafted > 0) {
      const admin = await getSuperAdmin();
      if (admin) {
        await sendPushToUser(admin.id, {
          title: "📋 تذاكر تحتاج متابعة",
          body: `${drafted} تذكرة لها ٤٨ ساعة بدون تحديث — راجع المتابعات ووافق عليها`,
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
