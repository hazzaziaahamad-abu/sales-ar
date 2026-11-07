import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { riyadhDate } from "@/lib/daily-tasks/shared";
import { getDeskAccess } from "@/lib/content-desk/server";
import { apifyConnected, syncCompetitors } from "@/lib/content-desk/competitors-sync";
import {
  COMPETITOR_COLS, POST_COLS, SNAPSHOT_COLS, cleanUsername,
  type Competitor, type CompetitorPost, type CompetitorSnapshot, type CompetitorsPayload,
} from "@/lib/content-desk/bank";

export const runtime = "nodejs";
export const maxDuration = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const intOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 9_000_000_000 ? n : null;
};

/** GET → المنافسين + لقطات آخر ٣٥ يوم + منشوراتهم لآخر ٣٠ يوم. */
export async function GET() {
  const access = await getDeskAccess(null);
  if (!access) return err("Unauthorized", 401);
  const { orgId, me } = access;
  const today = riyadhDate();

  const { data: comps, error } = await supabaseAdmin.from("content_competitors").select(COMPETITOR_COLS)
    .eq("org_id", orgId).order("created_at");
  if (error) return err(error.message, 500);
  const ids = (comps ?? []).map((c) => c.id as string);
  const since = new Date(Date.now() - 35 * 86_400_000).toISOString();
  const [snaps, posts] = ids.length
    ? await Promise.all([
      supabaseAdmin.from("content_competitor_snapshots").select(SNAPSHOT_COLS).in("competitor_id", ids)
        .gte("day", since.slice(0, 10)).order("day").limit(5000),
      supabaseAdmin.from("content_competitor_posts").select(POST_COLS).in("competitor_id", ids)
        .gte("posted_at", since).order("posted_at", { ascending: false }).limit(2000),
    ])
    : [{ data: [] }, { data: [] }];

  const payload: CompetitorsPayload = {
    me: { id: me.id, isManager: me.isManager }, today, connected: apifyConnected(),
    competitors: (comps ?? []) as Competitor[],
    snapshots: ((snaps.data ?? []) as CompetitorSnapshot[]).map((s) => ({ ...s, engagement_rate: s.engagement_rate != null ? Number(s.engagement_rate) : null })),
    posts: (posts.data ?? []) as CompetitorPost[],
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST — { action, ... }
 *  save { id?, name, ig_username, tt_username, note, active } · delete { id }
 *  sync { id? } → سحب الآن (كل المنافسين أو واحد) · manual { id, platform, followers, ... } → إدخال يدوي لأرقام اليوم
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const access = await getDeskAccess(null);
  if (!access) return err("Unauthorized", 401);
  const { orgId, me } = access;

  if (body.action === "save") {
    const name = text(body.name, 120);
    if (!name) return err("اكتب اسم المنافس");
    const ig = cleanUsername(body.ig_username);
    const tt = cleanUsername(body.tt_username);
    if (!ig && !tt) return err("أضف حساب انستقرام أو تيك توك");
    const row = { name, ig_username: ig, tt_username: tt, note: text(body.note, 1000) || null, active: body.active !== false };
    if (body.id) {
      if (!UUID.test(body.id)) return err("معرّف غير صالح");
      const { data, error } = await supabaseAdmin.from("content_competitors").update(row).eq("id", body.id).eq("org_id", orgId).select(COMPETITOR_COLS).single();
      if (error) return err(error.message, 500);
      return NextResponse.json({ competitor: data });
    }
    const { count } = await supabaseAdmin.from("content_competitors").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    if ((count ?? 0) >= 30) return err("الحد ٣٠ منافس");
    const { data, error } = await supabaseAdmin.from("content_competitors").insert({ ...row, org_id: orgId, created_by: me.id }).select(COMPETITOR_COLS).single();
    if (error) return err(error.message, 500);
    // أول سحب مباشرة لو الأداة مربوطة
    if (apifyConnected()) await syncCompetitors([data as Competitor]).catch(() => null);
    return NextResponse.json({ competitor: data });
  }

  if (body.action === "sync") {
    if (!apifyConnected()) return err("أداة السحب غير مربوطة — أضف APIFY_TOKEN في إعدادات الاستضافة");
    let q = supabaseAdmin.from("content_competitors").select(COMPETITOR_COLS).eq("org_id", orgId).eq("active", true);
    if (body.id) { if (!UUID.test(body.id)) return err("معرّف غير صالح"); q = q.eq("id", body.id); }
    const { data } = await q;
    const res = await syncCompetitors((data ?? []) as Competitor[]);
    return NextResponse.json(res);
  }

  if (!UUID.test(body.id ?? "")) return err("معرّف غير صالح");
  const { data: comp } = await supabaseAdmin.from("content_competitors").select("id").eq("id", body.id).eq("org_id", orgId).maybeSingle();
  if (!comp) return err("غير موجود", 404);

  if (body.action === "delete") {
    if (!me.isManager) {
      const { data: c } = await supabaseAdmin.from("content_competitors").select("created_by").eq("id", body.id).single();
      if (c?.created_by !== me.id) return err("الحذف لمن أضافه أو المدير", 403);
    }
    const { error } = await supabaseAdmin.from("content_competitors").delete().eq("id", body.id).eq("org_id", orgId);
    if (error) return err(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "manual") {
    if (body.platform !== "ig" && body.platform !== "tt") return err("المنصة غير صالحة");
    const followers = intOrNull(body.followers);
    if (followers == null) return err("أدخل عدد المتابعين");
    const avgLikes = intOrNull(body.avg_likes), avgComments = intOrNull(body.avg_comments);
    const er = followers && (avgLikes != null || avgComments != null) ? Math.round((((avgLikes ?? 0) + (avgComments ?? 0)) / followers) * 100_000) / 1000 : null;
    const { error } = await supabaseAdmin.from("content_competitor_snapshots").upsert({
      competitor_id: body.id, platform: body.platform, day: riyadhDate(),
      followers, posts_count: intOrNull(body.posts_count), avg_views: intOrNull(body.avg_views),
      avg_likes: avgLikes, avg_comments: avgComments, engagement_rate: er, source: "manual",
    }, { onConflict: "competitor_id,platform,day" });
    if (error) return err(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  return err("إجراء غير معروف");
}
