// «بنك المحتوى» + «المنافسين» — أنواع مشتركة بين الواجهة ومسارات الـ API.
import type { ContentType, Platform } from "./types";

export type AssetKind = "post" | "reel" | "story" | "video" | "carousel";
export const ASSET_KINDS: Record<AssetKind, string> = { post: "بوست", reel: "ريلز", story: "ستوري", video: "فيديو", carousel: "كاروسيل" };
export const isAssetKind = (v: unknown): v is AssetKind => typeof v === "string" && v in ASSET_KINDS;

export interface BankAsset {
  id: string;
  title: string;
  kind: AssetKind;
  platform: Platform;
  content_type: ContentType | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  tags: string[];
  note: string | null;
  desk_item_id: string | null;
  views: number | null;
  engagement: number | null;
  downloads: number;
  uploaded_by: string | null;
  created_at: string;
  /** محسوبة بالخادم */
  preview_url: string | null;
  uploader_name: string | null;
  /** أرقام منشور الخطة المربوط (لو موجود) */
  linked: { idea: string; item_date: string; actual_views: number | null; actual_engagement: number | null; link: string | null } | null;
}

/** منشورات الخطة المتاحة للربط */
export interface LinkableItem { id: string; idea: string; item_date: string; platform: Platform; actual_views: number | null; owner_name: string }

export interface BankPayload {
  me: { id: string; isManager: boolean };
  assets: BankAsset[];
  linkable: LinkableItem[];
}

export const ASSET_COLS =
  "id, title, kind, platform, content_type, storage_path, file_name, mime_type, size_bytes, tags, note, desk_item_id, views, engagement, downloads, uploaded_by, created_at";

/** النتائج الفعلية: من منشور الخطة المربوط أولاً، وإلا الأرقام اليدوية. */
export const assetViews = (a: BankAsset) => a.linked?.actual_views ?? a.views;
export const assetEngagement = (a: BankAsset) => a.linked?.actual_engagement ?? a.engagement;

export const isVideo = (a: { mime_type: string | null; file_name: string }) =>
  (a.mime_type ?? "").startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(a.file_name);
export const isImage = (a: { mime_type: string | null; file_name: string }) =>
  (a.mime_type ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/i.test(a.file_name);

export const fmtSize = (b: number | null) => {
  if (!b) return "";
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
};

// ─── المنافسين ──────────────────────────────────────────────────────────
export type SocialPlatform = "ig" | "tt";

export interface Competitor {
  id: string;
  name: string;
  ig_username: string | null;
  tt_username: string | null;
  note: string | null;
  active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface CompetitorSnapshot {
  competitor_id: string;
  platform: SocialPlatform;
  day: string;
  followers: number | null;
  following: number | null;
  posts_count: number | null;
  total_likes: number | null;
  avg_views: number | null;
  avg_likes: number | null;
  avg_comments: number | null;
  engagement_rate: number | null;
  source: "auto" | "manual";
}

export interface CompetitorPost {
  competitor_id: string;
  platform: SocialPlatform;
  post_id: string;
  url: string | null;
  kind: string | null;
  caption: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

export interface CompetitorsPayload {
  me: { id: string; isManager: boolean };
  today: string;
  competitors: Competitor[];
  snapshots: CompetitorSnapshot[];
  posts: CompetitorPost[];
}

export const COMPETITOR_COLS = "id, name, ig_username, tt_username, note, active, last_synced_at, last_error";
export const SNAPSHOT_COLS = "competitor_id, platform, day, followers, following, posts_count, total_likes, avg_views, avg_likes, avg_comments, engagement_rate, source";
export const POST_COLS = "competitor_id, platform, post_id, url, kind, caption, thumbnail_url, posted_at, views, likes, comments, shares";

/** يقبل @user أو رابط الحساب ويرجع اسم المستخدم فقط. */
export function cleanUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  const m = s.match(/(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, "").replace(/\/.*$/, "").toLowerCase();
  return /^[a-z0-9._]{1,40}$/.test(s) ? s : null;
}
