import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { claimDaily, sendPushToUser } from "@/lib/push";
import { verifyCronSecret } from "@/lib/cron-auth";
import { DESK_SLUG } from "@/lib/content-desk/server";
import { topSliceOf, tomorrowRiyadh, type FocusSlice } from "@/lib/focus-slices";
import { WORK_END_MIN, WORK_START_MIN, riyadhMinutes, workClock } from "@/lib/work-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** وقت التذكير المسائي «اختر شرائح بكرة» (٨ م – ١١ م). */
const EVENING_FROM = 20 * 60;
const EVENING_TO = 23 * 60;

/** تذكير حالة الواتساب لأخصائيي المحتوى (١٢:٠٠ – ١٢:٣٠). */
const WA_REMINDER_MIN = 12 * 60;

async function waStatusReminders(today: string): Promise<number> {
  const { data: roles } = await supabaseAdmin.from("roles").select("id").contains("allowed_pages", [DESK_SLUG]);
  const roleIds = (roles ?? []).map((r) => r.id as string);
  if (!roleIds.length) return 0;
  const { data: people } = await supabaseAdmin.from("user_profiles").select("id")
    .eq("is_active", true).eq("is_super_admin", false).in("role_id", roleIds);
  const ids = (people ?? []).map((p) => p.id as string);
  if (!ids.length) return 0;
  const { data: done } = await supabaseAdmin.from("content_desk_days").select("user_id")
    .eq("day", today).not("wa_status_at", "is", null).in("user_id", ids);
  const doneSet = new Set((done ?? []).map((d) => d.user_id as string));
  let sent = 0;
  for (const uid of ids) {
    if (doneSet.has(uid) || !(await claimDaily(uid, "wa_status", today))) continue;
    sent += await sendPushToUser(uid, { title: "💬 حالة الواتساب", body: "ما فعّلت حالة الواتساب اليوم — فعّلها وأشّر عليها في مكتب المحتوى", url: "/content-desk", tag: "wa-status" });
  }
  return sent;
}

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

/**
 * يستدعيه pg_cron كل دقيقة (السر من push_config). يرسل إشعارات الجوال:
 *  - المجدولة (انتهاء جلسة التركيز)
 *  - 🌙 اختر شرائح بكرة (٨ م)
 *  - 💼 بداية الدوام · موعد الجلسة العميقة · Shutdown ١٥:٣٠ (للسوبر أدمن)
 * أثناء جلسة تركيز شغّالة تتأجل التذكيرات (ما عدا انتهاء الجلسة نفسها).
 */
async function handle(req: NextRequest) {
  if (!(await verifyCronSecret(req.headers.get("x-push-secret")))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const m = riyadhMinutes(now);
  const clock = workClock(now);
  const today = clock.today;
  let sent = 0;

  // ١) المجدولة
  const { data: due } = await supabaseAdmin
    .from("push_queue").select("id, user_id, title, body, url, tag").is("sent_at", null).lte("send_at", nowIso).limit(200);
  for (const q of due ?? []) {
    await supabaseAdmin.from("push_queue").update({ sent_at: nowIso }).eq("id", q.id);
    sent += await sendPushToUser(q.user_id, { title: q.title, body: q.body, url: q.url, tag: q.tag });
  }
  await supabaseAdmin.from("push_queue").delete().lt("send_at", new Date(now.getTime() - 2 * 86_400_000).toISOString());

  // ١.٥) 💬 حالة الواتساب — أخصائي المحتوى ما فعّلها قبل ١٢ الظهر
  if (m >= WA_REMINDER_MIN && m < WA_REMINDER_MIN + 30) sent += await waStatusReminders(today);

  // ٢) التذكيرات اليومية — فقط للي عندهم أجهزة مشتركة
  const inEvening = m >= EVENING_FROM && m < EVENING_TO;
  const workday = clock.phase !== "off";
  const inStart = workday && m >= WORK_START_MIN && m < WORK_START_MIN + 60;
  const inShutdown = workday && m >= WORK_END_MIN && m < WORK_END_MIN + 90;
  const maybeSession = clock.phase === "on";
  if (!inEvening && !inStart && !inShutdown && !maybeSession) return NextResponse.json({ ok: true, sent });

  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("user_id");
  const users = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  if (!users.length) return NextResponse.json({ ok: true, sent });

  const [{ data: focusing }, { data: supers }, { data: slices }] = await Promise.all([
    supabaseAdmin.from("push_queue").select("user_id").eq("tag", "focus").is("sent_at", null).gt("send_at", nowIso).in("user_id", users),
    supabaseAdmin.from("user_profiles").select("id").eq("is_super_admin", true).in("id", users),
    supabaseAdmin.from("focus_slices")
      .select("id, user_id, space, idea_id, work_item_id, title, kind, planned_for, done_at, focus_minutes, session_at, sort_order, created_at")
      .in("user_id", users).or(`done_at.is.null,planned_for.eq.${today}`).limit(5000),
  ]);
  const busy = new Set((focusing ?? []).map((f) => f.user_id as string));
  const superSet = new Set((supers ?? []).map((s) => s.id as string));
  const tomorrow = tomorrowRiyadh();

  for (const uid of users) {
    if (busy.has(uid)) continue; // في جلسة تركيز — نأجل
    const mine = ((slices ?? []) as (FocusSlice & { user_id: string })[]).filter((s) => s.user_id === uid);
    const ideas = mine.filter((s) => s.space === "ideas");
    const work = mine.filter((s) => s.space === "work");

    if (inEvening && ideas.some((s) => !s.done_at) && !ideas.some((s) => s.planned_for === tomorrow) && await claimDaily(uid, "evening", today)) {
      sent += await sendPushToUser(uid, { title: "🌙 اختر شرائح بكرة", body: "دقيقة تخطيط الليلة: عميقة وحدة + ٥ سطحية — تصحى وخطتك جاهزة", url: "/ideas", tag: "evening" });
    }

    if (!superSet.has(uid)) continue;
    const todays = work.filter((s) => s.planned_for === today);

    if (inStart && await claimDaily(uid, "work_start", today)) {
      const top = topSliceOf(work, today);
      sent += await sendPushToUser(uid, {
        title: "☀️ بداية الدوام 💼",
        body: top ? `🎯 أهم شريحة اليوم: ${top.title}` : "اختر أهم شريحة اليوم وحدد موعد جلستك العميقة",
        url: "/work", tag: "work-start",
      });
    }

    if (maybeSession) {
      const deep = todays.find((s) => s.kind === "deep" && !s.done_at && s.session_at);
      if (deep) {
        const sm = toMin(deep.session_at!);
        if (m >= sm - 5 && m < sm + 15 && await claimDaily(uid, `session:${deep.id}`, today)) {
          sent += await sendPushToUser(uid, { title: "🔥 موعد جلستك العميقة", body: deep.title, url: "/work", tag: "work-session" });
        }
      }
    }

    if (inShutdown && todays.length && await claimDaily(uid, "shutdown", today)) {
      const undone = todays.filter((s) => !s.done_at).length;
      sent += await sendPushToUser(uid, {
        title: "🔚 انتهى الدوام",
        body: undone ? `${undone.toLocaleString("ar-SA")} شرائح ما انجزت — رحّلها بضغطة وانتقل لـMENU` : "أنجزت كل شرائح اليوم 👏 انتقل لـMENU",
        url: "/work", tag: "shutdown",
      });
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export const GET = handle;
export const POST = handle;
