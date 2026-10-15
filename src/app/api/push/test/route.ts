import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/permissions";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

/** POST → إشعار تجربة لأجهزة المستخدم نفسه. */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await sendPushToUser(user.id, { title: "🔔 الإشعارات شغّالة", body: "بتوصلك التذكيرات حتى لو التطبيق مقفل", url: "/ideas", tag: "test" });
  if (!sent) return NextResponse.json({ error: "ما وصل لأي جهاز — فعّل الإشعارات من جديد" }, { status: 404 });
  return NextResponse.json({ sent });
}
