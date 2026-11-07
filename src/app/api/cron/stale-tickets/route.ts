import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { verifyCronSecret } from "@/lib/cron-auth";
import { workClock } from "@/lib/work-hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** التذكرة اللي ما تحدّثت هالمدة يُنشن موظفها بطلب تحديث. */
const STALE_HOURS = 48;
const STALE_MS = STALE_HOURS * 3_600_000;

/** حالات تذاكر الدعم المقفولة (ما نذكّر عليها). */
const SUPPORT_CLOSED = ["محلول", "مغلق"];

interface StaleItem {
  source: "support" | "work";
  id: string;
  org_id: string;
  number: number;
  title: string;
  assignee: string;
  assigneeId: string | null;
  lastActivity: string;
}

const maxIso = (...xs: (string | null | undefined)[]) =>
  xs.filter(Boolean).reduce<string>((a, b) => (b! > a ? b! : a), "");

const daysSince = (iso: string, now: number) => Math.max(2, Math.floor((now - new Date(iso).getTime()) / 86_400_000));

/** آخر نشاط لكل تذكرة من جدول التعليقات/السجل. */
async function latestBy(source: "support" | "work", ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const rows: { key: string; created_at: string }[] = [];
    if (source === "support") {
      const { data } = await supabaseAdmin.from("follow_up_notes").select("entity_id, created_at")
        .eq("entity_type", "ticket").in("entity_id", chunk);
      for (const r of data ?? []) rows.push({ key: r.entity_id as string, created_at: r.created_at as string });
    } else {
      const { data } = await supabaseAdmin.from("work_ticket_events").select("ticket_id, created_at").in("ticket_id", chunk);
      for (const r of data ?? []) rows.push({ key: r.ticket_id as string, created_at: r.created_at as string });
    }
    for (const r of rows) if (!out.has(r.key) || r.created_at > out.get(r.key)!) out.set(r.key, r.created_at);
  }
  return out;
}

async function findStale(now: number, authorName: string): Promise<StaleItem[]> {
  const cutoff = now - STALE_MS;
  const items: StaleItem[] = [];

  // ١) تذاكر الدعم — كل المنظمات/الأقسام
  const { data: tickets } = await supabaseAdmin
    .from("tickets")
    .select("id, org_id, ticket_number, client_name, issue, status, assigned_agent_id, assigned_agent_name, created_at, updated_at, reopened_at")
    .not("status", "in", `(${SUPPORT_CLOSED.map((s) => `"${s}"`).join(",")})`)
    .limit(5000);
  const tIds = (tickets ?? []).map((t) => t.id as string);
  const tNotes = tIds.length ? await latestBy("support", tIds) : new Map();
  for (const t of tickets ?? []) {
    const assignee = (t.assigned_agent_name ?? "").trim();
    if (!assignee || assignee === authorName) continue;
    const last = maxIso(t.created_at, t.updated_at, t.reopened_at, tNotes.get(t.id));
    if (!last || new Date(last).getTime() > cutoff) continue;
    items.push({
      source: "support", id: t.id, org_id: t.org_id, number: t.ticket_number,
      title: t.client_name || t.issue || "", assignee, assigneeId: null, lastActivity: last,
    });
  }

  // ٢) الطلبات والتطويرات — كل المنظمات/الأقسام
  const { data: work } = await supabaseAdmin
    .from("work_tickets")
    .select("id, org_id, ticket_number, title, assigned_to, assigned_to_name, created_at, updated_at")
    .in("status", ["open", "in_progress"])
    .limit(5000);
  const wIds = (work ?? []).map((w) => w.id as string);
  const wEvents = wIds.length ? await latestBy("work", wIds) : new Map();
  for (const w of work ?? []) {
    const assignee = (w.assigned_to_name ?? "").trim();
    if (!assignee || assignee === authorName) continue;
    const last = maxIso(w.created_at, w.updated_at, wEvents.get(w.id));
    if (!last || new Date(last).getTime() > cutoff) continue;
    items.push({
      source: "work", id: w.id, org_id: w.org_id, number: w.ticket_number,
      title: w.title || "", assignee, assigneeId: w.assigned_to ?? null, lastActivity: last,
    });
  }
  return items;
}

/**
 * أتمتة «تذكرة بدون تحديث ٤٨ ساعة»: يستدعيها pg_cron كل ساعة.
 * في كل الأقسام (تذاكر الدعم + الطلبات والتطويرات، لكل المنظمات): أي تذكرة مفتوحة لها
 * ٤٨ ساعة بدون أي تحديث/تعليق يُضاف عليها تعليق باسم السوبر أدمن فيه منشن للموظف المسؤول
 * يطلب تحديث، مع إشعار منشن + إشعار جوال. التعليق نفسه يصفّر العداد، فلو استمر السكوت
 * يتكرر التذكير كل ٤٨ ساعة إلى أن يتحدث الموظف أو تنقفل التذكرة.
 * ما يرسل إلا وقت الدوام (الأحد–الخميس ٧:٠٠–١٥:٣٠ الرياض). `?dry=1` يعرض بدون إرسال.
 */
async function handle(req: NextRequest) {
  const secret = req.headers.get("x-push-secret") ?? req.headers.get("x-cron-secret");
  if (!(await verifyCronSecret(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const nowDate = new Date();
  const now = nowDate.getTime();

  if (!dry && workClock(nowDate).phase !== "on") {
    return NextResponse.json({ ok: true, skipped: "outside work hours" });
  }

  // صاحب المنشن: السوبر أدمن
  const { data: author } = await supabaseAdmin
    .from("user_profiles").select("id, name").eq("is_super_admin", true).eq("is_active", true)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  const authorName = (author?.name as string | undefined)?.trim();
  if (!authorName) return NextResponse.json({ error: "no super admin" }, { status: 500 });

  const stale = await findStale(now, authorName);
  if (dry) return NextResponse.json({ ok: true, dry: true, author: authorName, count: stale.length, stale });

  // ربط أسماء موظفي الدعم بحساباتهم للإشعار على الجوال
  const names = [...new Set(stale.filter((s) => !s.assigneeId).map((s) => s.assignee))];
  const idByName = new Map<string, string>();
  if (names.length) {
    const { data: profiles } = await supabaseAdmin.from("user_profiles").select("id, name").eq("is_active", true).in("name", names);
    for (const p of profiles ?? []) idByName.set(p.name as string, p.id as string);
  }

  let posted = 0;
  let pushed = 0;
  const errors: string[] = [];

  for (const s of stale) {
    const days = daysSince(s.lastActivity, now);
    const text =
      `@${s.assignee} تذكير: التذكرة #${s.number}${s.title ? ` (${s.title})` : ""} بدون أي تحديث من ${days} يوم. ` +
      `نرجو تحديث حالتها أو كتابة آخر المستجدات 🙏`;

    try {
      if (s.source === "support") {
        const { data: note, error } = await supabaseAdmin
          .from("follow_up_notes")
          .insert({ org_id: s.org_id, entity_type: "ticket", entity_id: s.id, note: text, author_name: authorName })
          .select("id").single();
        if (error) throw error;
        await supabaseAdmin.from("mention_notifications").insert({
          org_id: s.org_id, note_id: note.id, entity_type: "ticket", entity_id: s.id,
          entity_name: s.title, mentioned_name: s.assignee, author_name: authorName, note_text: text,
        });
      } else {
        const { error } = await supabaseAdmin.from("work_ticket_events").insert({
          ticket_id: s.id, org_id: s.org_id, event_type: "comment", body: text, actor_name: authorName,
        });
        if (error) throw error;
      }
      posted++;

      const uid = s.assigneeId ?? idByName.get(s.assignee);
      if (uid) {
        pushed += await sendPushToUser(uid, {
          title: `⏰ ${authorName} يطلب تحديث`,
          body: `التذكرة #${s.number} بدون تحديث من ${days} يوم`,
          url: s.source === "support" ? "/support" : "/work-tickets",
          tag: `stale-${s.id}`,
        });
      }
    } catch (e) {
      errors.push(`${s.source}#${s.number}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ ok: true, posted, pushed, errors });
}

export const GET = handle;
export const POST = handle;
