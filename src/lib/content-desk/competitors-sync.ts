// سحب حسابات المنافسين يومياً — داخلياً بدون أي خدمة خارجية (الصفحات العامة لانستقرام وتيك توك). خادم فقط.
//   انستقرام: واجهة الويب العامة web_profile_info (المتابعين + آخر ١٢ منشور بأرقامها)،
//            ولو انحجبت: وصف صفحة الحساب (og:description) للمتابعين وعدد المنشورات.
//   تيك توك: بيانات صفحة الحساب المضمّنة (__UNIVERSAL_DATA_FOR_REHYDRATION__ / SIGI_STATE).
import { supabaseAdmin } from "@/lib/supabase/admin";
import { riyadhDate } from "@/lib/daily-tasks/shared";
import type { Competitor, SocialPlatform } from "./bank";

const POSTS_PER_PROFILE = 12;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IG_APP_ID = "936619743392459";

type Json = Record<string, unknown>;
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return null;
};
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const avg = (xs: (number | null)[]) => {
  const ok = xs.filter((x): x is number => x != null);
  return ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** "12.5K" / "1,234" / "1.2M" → رقم */
const parseCount = (s: string): number | null => {
  const m = s.replace(/,/g, "").match(/^([\d.]+)\s*([KkMmBb])?$/);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k" | "m" | "b"] ?? 1;
  return Math.round(Number(m[1]) * mult);
};

async function get(url: string, headers: Record<string, string> = {}) {
  return fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...headers },
    redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
}

export interface NormalizedPost {
  post_id: string; url: string | null; kind: string | null; caption: string | null; thumbnail_url: string | null;
  posted_at: string | null; views: number | null; likes: number | null; comments: number | null; shares: number | null;
}
interface Normalized { followers: number | null; following: number | null; posts_count: number | null; total_likes: number | null; posts: NormalizedPost[] }

// ─── انستقرام ───────────────────────────────────────────────────────────
async function instagramApi(username: string): Promise<Normalized | null> {
  for (const host of ["https://www.instagram.com", "https://i.instagram.com"]) {
    const res = await get(`${host}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
      "x-ig-app-id": IG_APP_ID, Accept: "application/json", Referer: `https://www.instagram.com/${username}/`, "X-Requested-With": "XMLHttpRequest",
    }).catch(() => null);
    if (!res?.ok) continue;
    const json = await res.json().catch(() => null);
    const u = obj(obj(obj(json).data).user);
    if (!Object.keys(u).length) continue;
    const media = obj(u.edge_owner_to_timeline_media);
    const edges = (Array.isArray(media.edges) ? media.edges : []) as Json[];
    return {
      followers: num(obj(u.edge_followed_by).count), following: num(obj(u.edge_follow).count), posts_count: num(media.count), total_likes: null,
      posts: edges.slice(0, POSTS_PER_PROFILE).map((e) => {
        const n = obj(e.node);
        const type = str(n.__typename);
        const sc = str(n.shortcode);
        const capEdges = obj(n.edge_media_to_caption).edges as Json[] | undefined;
        const ts = num(n.taken_at_timestamp);
        const likes = num(obj(n.edge_liked_by).count) ?? num(obj(n.edge_media_preview_like).count);
        return {
          post_id: sc ?? str(n.id) ?? "",
          url: sc ? `https://www.instagram.com/${n.is_video ? "reel" : "p"}/${sc}/` : null,
          kind: n.is_video || type === "GraphVideo" ? "reel" : type === "GraphSidecar" ? "carousel" : "post",
          caption: str(obj(capEdges?.[0]?.node).text)?.slice(0, 600) ?? null,
          thumbnail_url: str(n.thumbnail_src) ?? str(n.display_url),
          posted_at: ts ? new Date(ts * 1000).toISOString() : null,
          views: num(n.video_view_count) ?? num(n.video_play_count),
          likes: likes != null && likes >= 0 ? likes : null,
          comments: num(obj(n.edge_media_to_comment).count),
          shares: null,
        };
      }).filter((p) => p.post_id),
    };
  }
  return null;
}

/** بديل: وصف الصفحة العامة "1,234 Followers, 56 Following, 78 Posts". */
async function instagramMeta(username: string): Promise<Normalized | null> {
  const res = await get(`https://www.instagram.com/${encodeURIComponent(username)}/`, { Accept: "text/html" }).catch(() => null);
  if (!res?.ok) return null;
  const html = await res.text();
  const desc = html.match(/<meta[^>]+(?:property|name)="(?:og:)?description"[^>]+content="([^"]+)"/i)?.[1] ?? "";
  const f = desc.match(/([\d.,]+\s*[KMB]?)\s+Followers/i), g = desc.match(/([\d.,]+\s*[KMB]?)\s+Following/i), p = desc.match(/([\d.,]+\s*[KMB]?)\s+Posts/i);
  if (!f) return null;
  return { followers: parseCount(f[1]), following: g ? parseCount(g[1]) : null, posts_count: p ? parseCount(p[1]) : null, total_likes: null, posts: [] };
}

async function fetchInstagram(username: string): Promise<Normalized> {
  const n = (await instagramApi(username)) ?? (await instagramMeta(username));
  if (!n) throw new Error("انستقرام رفض الطلب أو الحساب خاص/غير موجود");
  return n;
}

// ─── تيك توك ────────────────────────────────────────────────────────────
function tiktokItem(it: Json): NormalizedPost | null {
  const id = str(it.id);
  if (!id) return null;
  const s = obj(it.stats), s2 = obj(it.statsV2);
  const author = str(obj(it.author).uniqueId) ?? str(it.author);
  const ct = num(it.createTime);
  return {
    post_id: id,
    url: author ? `https://www.tiktok.com/@${author}/video/${id}` : null,
    kind: "video",
    caption: str(it.desc)?.slice(0, 600) ?? null,
    thumbnail_url: str(obj(it.video).cover) ?? str(obj(it.video).originCover),
    posted_at: ct ? new Date(ct * 1000).toISOString() : null,
    views: num(s.playCount) ?? num(s2.playCount), likes: num(s.diggCount) ?? num(s2.diggCount),
    comments: num(s.commentCount) ?? num(s2.commentCount), shares: num(s.shareCount) ?? num(s2.shareCount),
  };
}

async function fetchTiktok(username: string): Promise<Normalized> {
  const res = await get(`https://www.tiktok.com/@${encodeURIComponent(username)}?lang=en`, { Accept: "text/html" }).catch(() => null);
  if (!res?.ok) throw new Error(`تيك توك رفض الطلب${res ? ` (${res.status})` : ""}`);
  const html = await res.text();
  const script = (id: string) => {
    const m = html.match(new RegExp(`<script[^>]+id="${id}"[^>]*>([\\s\\S]*?)</script>`));
    try { return m ? (JSON.parse(m[1]) as Json) : null; } catch { return null; }
  };

  let info: Json = {};
  let items: Json[] = [];
  const universal = script("__UNIVERSAL_DATA_FOR_REHYDRATION__");
  if (universal) {
    const scope = obj(universal.__DEFAULT_SCOPE__);
    info = obj(obj(scope["webapp.user-detail"]).userInfo);
    const list = obj(scope["webapp.user-detail"]).itemList ?? obj(scope["webapp.video-list"]).itemList;
    if (Array.isArray(list)) items = list as Json[];
  }
  const sigi = script("SIGI_STATE");
  if (sigi) {
    if (!Object.keys(info).length) {
      const users = obj(obj(sigi.UserModule).users), stats = obj(obj(sigi.UserModule).stats);
      const key = Object.keys(users).find((k) => k.toLowerCase() === username) ?? Object.keys(users)[0];
      if (key) info = { user: users[key], stats: stats[key] };
    }
    if (!items.length) items = Object.values(obj(sigi.ItemModule)) as Json[];
  }
  const stats = obj(info.stats), stats2 = obj(info.statsV2);
  const followers = num(stats.followerCount) ?? num(stats2.followerCount);
  if (followers == null) throw new Error("تيك توك ما رجّع بيانات الحساب (ممكن خاص أو غير موجود)");
  return {
    followers,
    following: num(stats.followingCount) ?? num(stats2.followingCount),
    posts_count: num(stats.videoCount) ?? num(stats2.videoCount),
    total_likes: num(stats.heartCount) ?? num(stats.heart) ?? num(stats2.heartCount),
    posts: items.map(tiktokItem).filter((p): p is NormalizedPost => !!p)
      .sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? "")).slice(0, POSTS_PER_PROFILE),
  };
}

// ─── التخزين ────────────────────────────────────────────────────────────
async function store(c: Competitor, platform: SocialPlatform, n: Normalized, day: string) {
  const now = new Date().toISOString();
  // لو ما رجعت منشورات هالمرة نحسب المتوسطات من آخر منشورات محفوظة
  let posts: (NormalizedPost | { views: number | null; likes: number | null; comments: number | null })[] = n.posts;
  if (!posts.length) {
    const { data } = await supabaseAdmin.from("content_competitor_posts").select("views, likes, comments")
      .eq("competitor_id", c.id).eq("platform", platform).order("posted_at", { ascending: false }).limit(POSTS_PER_PROFILE);
    posts = data ?? [];
  }
  const likes = avg(posts.map((p) => p.likes));
  const comments = avg(posts.map((p) => p.comments));
  const er = n.followers && (likes != null || comments != null) ? Math.round((((likes ?? 0) + (comments ?? 0)) / n.followers) * 100_000) / 1000 : null;
  await supabaseAdmin.from("content_competitor_snapshots").upsert({
    competitor_id: c.id, platform, day,
    followers: n.followers, following: n.following, posts_count: n.posts_count, total_likes: n.total_likes,
    avg_views: avg(posts.map((p) => p.views)), avg_likes: likes, avg_comments: comments,
    engagement_rate: er != null ? Math.min(er, 9999) : null, source: "auto",
  }, { onConflict: "competitor_id,platform,day" });
  if (n.posts.length) {
    await supabaseAdmin.from("content_competitor_posts").upsert(
      n.posts.map((p) => ({ ...p, competitor_id: c.id, platform, updated_at: now })),
      { onConflict: "competitor_id,platform,post_id" },
    );
  }
}

/** يسحب المنافسين واحد واحد (بفاصل بسيط عشان ما ننحجب). يرجع عدد الحسابات اللي تحدثت. */
export async function syncCompetitors(list: Competitor[], budgetMs = 270_000): Promise<{ synced: number; errors: string[] }> {
  const started = Date.now();
  const day = riyadhDate();
  const errors: string[] = [];
  let synced = 0;
  for (const c of list.filter((x) => x.active)) {
    if (Date.now() - started > budgetMs) { errors.push("انتهى وقت السحب — الباقي ينسحب المرة الجاية"); break; }
    const fails: string[] = [];
    const jobs: [SocialPlatform, string | null, (u: string) => Promise<Normalized>][] = [["ig", c.ig_username, fetchInstagram], ["tt", c.tt_username, fetchTiktok]];
    for (const [p, u, fn] of jobs) {
      if (!u) continue;
      try {
        let n: Normalized;
        try { n = await fn(u); } catch { await sleep(2500); n = await fn(u); } // محاولة ثانية
        await store(c, p, n, day);
        synced++;
      } catch (e) {
        fails.push((e as Error).message);
      }
      await sleep(1200);
    }
    if (fails.length) errors.push(`${c.name}: ${fails.join("، ")}`);
    await supabaseAdmin.from("content_competitors").update({
      last_synced_at: new Date().toISOString(),
      last_error: fails.length ? fails.join(" · ").slice(0, 500) : null,
    }).eq("id", c.id);
  }
  return { synced, errors };
}
