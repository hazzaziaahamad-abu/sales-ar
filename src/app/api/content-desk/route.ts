import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { riyadhDate } from "@/lib/daily-tasks/shared";
import { deskPeople, getDeskAccess } from "@/lib/content-desk/server";
import {
  ITEM_COLS, isContentType, isFormat, isPlatform, isStatus,
  type DeskDay, type DeskGoals, type DeskPayload, type DeskItem,
} from "@/lib/content-desk/types";

export const runtime = "nodejs";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GOAL_KEYS = ["views_target", "posts_target", "ig_followers_target", "tt_followers_target", "ig_followers_now", "tt_followers_now"] as const;

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const intOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 2_000_000_000 ? n : null;
};
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** GET /api/content-desk?from=&to=&period=&as= → منشورات الفترة + أيام الواتساب + أهداف الشهر. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const access = await getDeskAccess(sp.get("as"));
  if (!access) return err("Unauthorized", 401);
  const today = riyadhDate();
  const from = YMD.test(sp.get("from") ?? "") ? sp.get("from")! : `${today.slice(0, 7)}-01`;
  const to = YMD.test(sp.get("to") ?? "") ? sp.get("to")! : today;
  const period = PERIOD.test(sp.get("period") ?? "") ? sp.get("period")! : today.slice(0, 7);
  if (to < from || (Date.parse(to) - Date.parse(from)) / 86_400_000 > 70) return err("نطاق غير صالح");

  const { orgId, owner } = access;
  // أيام الواتساب: الفترة المعروضة + الشهر الحالي كاملاً (لسجل الشهر)
  const waFrom = from < `${today.slice(0, 7)}-01` ? from : `${today.slice(0, 7)}-01`;
  const waTo = to > today ? to : today;
  const [itemsRes, daysRes, goalsRes, people] = await Promise.all([
    supabaseAdmin.from("content_desk_items").select(ITEM_COLS)
      .eq("org_id", orgId).eq("user_id", owner.id).gte("item_date", from).lte("item_date", to)
      .order("item_date").order("item_time", { nullsFirst: true }).limit(1000),
    supabaseAdmin.from("content_desk_days").select("day, wa_status_at, checklist")
      .eq("org_id", orgId).eq("user_id", owner.id).gte("day", waFrom).lte("day", waTo),
    supabaseAdmin.from("content_desk_goals").select(`period, ${GOAL_KEYS.join(", ")}`)
      .eq("org_id", orgId).eq("user_id", owner.id).eq("period", period).maybeSingle(),
    access.me.isManager ? deskPeople(orgId) : Promise.resolve([]),
  ]);
  if (itemsRes.error) return err(itemsRes.error.message, 500);

  const payload: DeskPayload = {
    me: access.me, owner, canEdit: owner.id === access.me.id || access.me.isManager, today,
    items: (itemsRes.data ?? []) as DeskItem[],
    days: (daysRes.data ?? []) as DeskDay[],
    goals: (goalsRes.data as DeskGoals | null) ?? null,
    people,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/content-desk — { action, as?, ... }
 *  save_item { item } · delete_item { id } · wa { on } · check { key, on } · goals { period, ...أرقام }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const access = await getDeskAccess(typeof body.as === "string" ? body.as : null);
  if (!access) return err("Unauthorized", 401);
  const { orgId, owner, me } = access;
  if (owner.id !== me.id && !me.isManager) return err("غير مسموح", 403);
  const now = new Date().toISOString();
  const today = riyadhDate();

  if (body.action === "save_item") {
    const it = body.item ?? {};
    const idea = text(it.idea, 500);
    if (!idea) return err("اكتب فكرة المحتوى");
    if (!YMD.test(it.item_date ?? "")) return err("التاريخ غير صالح");
    if (!isContentType(it.content_type) || !isPlatform(it.platform) || !isFormat(it.format) || !isStatus(it.status)) return err("بيانات غير صالحة");
    const time = typeof it.item_time === "string" && /^\d{2}:\d{2}$/.test(it.item_time) ? it.item_time : null;
    const link = text(it.link, 1000);
    const row = {
      item_date: it.item_date, item_time: time, idea,
      content_type: it.content_type, platform: it.platform, format: it.format, status: it.status,
      target_views: intOrNull(it.target_views), target_engagement: intOrNull(it.target_engagement),
      actual_views: intOrNull(it.actual_views), actual_engagement: intOrNull(it.actual_engagement),
      link: link && /^https?:\/\//i.test(link) ? link : null,
      note: text(it.note, 2000) || null,
      updated_by: me.id, updated_at: now,
    };

    if (it.id) {
      if (!UUID.test(it.id)) return err("معرّف غير صالح");
      const { data: existing } = await supabaseAdmin.from("content_desk_items").select("status, done_at")
        .eq("id", it.id).eq("org_id", orgId).eq("user_id", owner.id).maybeSingle();
      if (!existing) return err("غير موجود", 404);
      const done_at = row.status === "done" ? (existing.done_at ?? now) : null;
      const { data, error } = await supabaseAdmin.from("content_desk_items").update({ ...row, done_at })
        .eq("id", it.id).eq("org_id", orgId).select(ITEM_COLS).single();
      if (error) return err(error.message, 500);
      return NextResponse.json({ item: data });
    }
    const { data, error } = await supabaseAdmin.from("content_desk_items")
      .insert({ ...row, org_id: orgId, user_id: owner.id, created_by: me.id, done_at: row.status === "done" ? now : null })
      .select(ITEM_COLS).single();
    if (error) return err(error.message, 500);
    return NextResponse.json({ item: data });
  }

  if (body.action === "delete_item") {
    if (!UUID.test(body.id ?? "")) return err("معرّف غير صالح");
    const { error } = await supabaseAdmin.from("content_desk_items").delete()
      .eq("id", body.id).eq("org_id", orgId).eq("user_id", owner.id);
    if (error) return err(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  // حالة الواتساب وقائمة اليوم: لليوم الحالي فقط، وصاحب المكتب نفسه
  if (body.action === "wa" || body.action === "check") {
    if (owner.id !== me.id) return err("هذي تخص الأخصائي نفسه", 403);
    const { data: cur } = await supabaseAdmin.from("content_desk_days").select("wa_status_at, checklist")
      .eq("org_id", orgId).eq("user_id", owner.id).eq("day", today).maybeSingle();
    const next = {
      wa_status_at: cur?.wa_status_at ?? null,
      checklist: { ...((cur?.checklist as Record<string, boolean>) ?? {}) },
    };
    if (body.action === "wa") next.wa_status_at = body.on ? (cur?.wa_status_at ?? now) : null;
    else {
      const key = text(body.key, 40);
      if (!/^[a-z_]+$/.test(key)) return err("بيانات غير صالحة");
      if (body.on) next.checklist[key] = true; else delete next.checklist[key];
    }
    const { error } = await supabaseAdmin.from("content_desk_days")
      .upsert({ org_id: orgId, user_id: owner.id, day: today, ...next, updated_at: now }, { onConflict: "org_id,user_id,day" });
    if (error) return err(error.message, 500);
    return NextResponse.json({ day: { day: today, ...next } });
  }

  if (body.action === "goals") {
    if (!PERIOD.test(body.period ?? "")) return err("الشهر غير صالح");
    const patch: Record<string, number | null> = {};
    for (const k of GOAL_KEYS) if (k in body) patch[k] = intOrNull(body[k]);
    const { data, error } = await supabaseAdmin.from("content_desk_goals")
      .upsert({ org_id: orgId, user_id: owner.id, period: body.period, ...patch, updated_by: me.id, updated_at: now }, { onConflict: "org_id,user_id,period" })
      .select(`period, ${GOAL_KEYS.join(", ")}`).single();
    if (error) return err(error.message, 500);
    return NextResponse.json({ goals: data });
  }

  return err("إجراء غير معروف");
}
