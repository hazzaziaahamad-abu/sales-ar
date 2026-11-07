// سحب حسابات المنافسين يومياً عبر Apify (انستقرام + تيك توك). خادم فقط.
//   APIFY_TOKEN في متغيرات البيئة (Vercel). بدونه الصفحة تشتغل بالإدخال اليدوي.
import { supabaseAdmin } from "@/lib/supabase/admin";
import { riyadhDate } from "@/lib/daily-tasks/shared";
import type { Competitor, SocialPlatform } from "./bank";

const IG_ACTOR = "apify~instagram-profile-scraper";
const TT_ACTOR = "clockworks~tiktok-scraper";
const POSTS_PER_PROFILE = 12;

export const apifyConnected = () => !!process.env.APIFY_TOKEN;

type Json = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const avg = (xs: (number | null)[]) => {
  const ok = xs.filter((x): x is number => x != null);
  return ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
};

async function runActor(actor: string, input: Json): Promise<Json[]> {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=240&clean=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.APIFY_TOKEN}` },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(270_000),
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as Json[]) : [];
}

interface Normalized {
  followers: number | null; following: number | null; posts_count: number | null; total_likes: number | null;
  posts: { post_id: string; url: string | null; kind: string | null; caption: string | null; thumbnail_url: string | null; posted_at: string | null; views: number | null; likes: number | null; comments: number | null; shares: number | null }[];
}

async function fetchInstagram(usernames: string[]): Promise<Map<string, Normalized>> {
  const out = new Map<string, Normalized>();
  if (!usernames.length) return out;
  const items = await runActor(IG_ACTOR, { usernames, resultsLimit: POSTS_PER_PROFILE });
  for (const it of items) {
    const u = str(it.username)?.toLowerCase();
    if (!u) continue;
    const latest = (Array.isArray(it.latestPosts) ? it.latestPosts : []) as Json[];
    out.set(u, {
      followers: num(it.followersCount), following: num(it.followsCount), posts_count: num(it.postsCount), total_likes: null,
      posts: latest.slice(0, POSTS_PER_PROFILE).map((p) => {
        const type = str(p.type);
        return {
          post_id: str(p.shortCode) ?? str(p.id) ?? "",
          url: str(p.url),
          kind: type === "Video" ? "reel" : type === "Sidecar" ? "carousel" : "post",
          caption: str(p.caption)?.slice(0, 600) ?? null,
          thumbnail_url: str(p.displayUrl),
          posted_at: str(p.timestamp),
          views: num(p.videoPlayCount) ?? num(p.videoViewCount),
          likes: (num(p.likesCount) ?? -1) >= 0 ? num(p.likesCount) : null, // -1 = اللايكات مخفية
          comments: num(p.commentsCount),
          shares: null,
        };
      }).filter((p) => p.post_id),
    });
  }
  return out;
}

async function fetchTiktok(usernames: string[]): Promise<Map<string, Normalized>> {
  const out = new Map<string, Normalized>();
  if (!usernames.length) return out;
  const items = await runActor(TT_ACTOR, {
    profiles: usernames, resultsPerPage: POSTS_PER_PROFILE, profileScrapeSections: ["videos"],
    shouldDownloadVideos: false, shouldDownloadCovers: false, shouldDownloadSubtitles: false, shouldDownloadSlideshowImages: false,
  });
  for (const it of items) {
    const a = (it.authorMeta ?? {}) as Json;
    const u = str(a.name)?.toLowerCase();
    if (!u) continue;
    const cur = out.get(u) ?? { followers: num(a.fans), following: num(a.following), posts_count: num(a.video), total_likes: num(a.heart), posts: [] };
    const id = str(it.id);
    if (id && cur.posts.length < POSTS_PER_PROFILE) {
      cur.posts.push({
        post_id: id,
        url: str(it.webVideoUrl),
        kind: "video",
        caption: str(it.text)?.slice(0, 600) ?? null,
        thumbnail_url: str((it.videoMeta as Json | undefined)?.coverUrl),
        posted_at: str(it.createTimeISO),
        views: num(it.playCount), likes: num(it.diggCount), comments: num(it.commentCount), shares: num(it.shareCount),
      });
    }
    out.set(u, cur);
  }
  return out;
}

async function store(c: Competitor, platform: SocialPlatform, n: Normalized, day: string) {
  const now = new Date().toISOString();
  const likes = avg(n.posts.map((p) => p.likes));
  const comments = avg(n.posts.map((p) => p.comments));
  const er = n.followers && (likes != null || comments != null) ? Math.round((((likes ?? 0) + (comments ?? 0)) / n.followers) * 100_000) / 1000 : null;
  await supabaseAdmin.from("content_competitor_snapshots").upsert({
    competitor_id: c.id, platform, day,
    followers: n.followers, following: n.following, posts_count: n.posts_count, total_likes: n.total_likes,
    avg_views: avg(n.posts.map((p) => p.views)), avg_likes: likes, avg_comments: comments,
    engagement_rate: er != null ? Math.min(er, 9999) : null, source: "apify",
  }, { onConflict: "competitor_id,platform,day" });
  if (n.posts.length) {
    await supabaseAdmin.from("content_competitor_posts").upsert(
      n.posts.map((p) => ({ ...p, competitor_id: c.id, platform, updated_at: now })),
      { onConflict: "competitor_id,platform,post_id" },
    );
  }
}

/** يسحب كل المنافسين المعطاة دفعة وحدة لكل منصة. يرجع عدد الحسابات اللي تحدثت. */
export async function syncCompetitors(list: Competitor[]): Promise<{ synced: number; errors: string[] }> {
  if (!apifyConnected()) return { synced: 0, errors: ["أداة السحب غير مربوطة (APIFY_TOKEN)"] };
  const active = list.filter((c) => c.active);
  const igUsers = [...new Set(active.map((c) => c.ig_username).filter((x): x is string => !!x))];
  const ttUsers = [...new Set(active.map((c) => c.tt_username).filter((x): x is string => !!x))];
  const errors: string[] = [];
  const [ig, tt] = await Promise.all([
    fetchInstagram(igUsers).catch((e: Error) => { errors.push(`انستقرام: ${e.message}`); return new Map<string, Normalized>(); }),
    fetchTiktok(ttUsers).catch((e: Error) => { errors.push(`تيك توك: ${e.message}`); return new Map<string, Normalized>(); }),
  ]);
  const day = riyadhDate();
  let synced = 0;
  for (const c of active) {
    const miss: string[] = [];
    if (c.ig_username) { const n = ig.get(c.ig_username); if (n) { await store(c, "ig", n, day); synced++; } else miss.push("انستقرام"); }
    if (c.tt_username) { const n = tt.get(c.tt_username); if (n) { await store(c, "tt", n, day); synced++; } else miss.push("تيك توك"); }
    await supabaseAdmin.from("content_competitors").update({
      last_synced_at: new Date().toISOString(),
      last_error: miss.length ? `ما رجعت بيانات: ${miss.join("، ")}${errors.length ? ` — ${errors.join(" · ")}` : ""}`.slice(0, 500) : null,
    }).eq("id", c.id);
  }
  return { synced, errors };
}
