// طبقة الحفظ لاستوديو بوستات الباقات — كل القراءة والكتابة تمر من هنا فقط.
// الأساس: Supabase عبر /api/package-posts (نفس نمط باقي الأقسام).
// احتياطي: لو جدول package_posts لسا ما انطبق (الـ migration) نحفظ في localStorage مؤقتاً.

import type { PostData } from "./types";
import { defaultPosts, normalizePost } from "./defaults";

export type StorageMode = "cloud" | "local";

const LS_KEY = "cc.packagePosts.v1";
const TABLE_MISSING = new Set(["42P01", "PGRST205", "PGRST204"]);

let mode: StorageMode = "cloud";
export const getStorageMode = () => mode;

function readLocal(): PostData[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PostData[]) : null;
  } catch {
    return null;
  }
}

function writeLocal(posts: PostData[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(posts));
  } catch {
    throw new Error("مساحة التخزين المحلي ممتلئة — صغّر الصور المرفوعة");
  }
}

async function errorOf(res: Response): Promise<{ message: string; code?: string }> {
  const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return { message: j.error || `خطأ ${res.status}`, code: j.code };
}

/** يرجّع كل البوستات. أول تشغيل (ما فيه شيء محفوظ) يعبّي البوستات الأربعة الافتراضية ويحفظها. */
export async function listPosts(): Promise<{ posts: PostData[]; mode: StorageMode }> {
  let posts: PostData[] | null = null;
  try {
    const res = await fetch("/api/package-posts", { cache: "no-store" });
    if (res.ok) {
      mode = "cloud";
      posts = ((await res.json()) as { posts: PostData[] }).posts;
    } else {
      const err = await errorOf(res);
      if (res.status === 401) throw new Error("سجّل دخولك أولاً");
      if (err.code && TABLE_MISSING.has(err.code)) mode = "local";
      else throw new Error(err.message);
    }
  } catch (e) {
    if (e instanceof TypeError) mode = "local"; // الشبكة/الأوفلاين
    else throw e;
  }

  if (mode === "local") posts = readLocal();

  if (!posts || posts.length === 0) {
    const seeded = defaultPosts();
    for (const p of seeded) await savePost(p);
    return { posts: seeded, mode };
  }
  return { posts: posts.map(normalizePost), mode };
}

/** حفظ (إنشاء أو تحديث). يرجّع البوست بوقت التحديث الجديد. */
export async function savePost(post: PostData): Promise<PostData> {
  const updatedAt = new Date().toISOString();
  if (mode === "local") {
    const all = readLocal() ?? [];
    const next = { ...post, updatedAt };
    const i = all.findIndex((p) => p.id === post.id);
    if (i >= 0) all[i] = next;
    else all.push(next);
    writeLocal(all);
    return next;
  }
  const res = await fetch(`/api/package-posts/${post.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  });
  if (!res.ok) throw new Error((await errorOf(res)).message);
  const j = (await res.json()) as { updatedAt: string };
  return { ...post, updatedAt: j.updatedAt };
}

export async function deletePost(id: string): Promise<void> {
  if (mode === "local") {
    writeLocal((readLocal() ?? []).filter((p) => p.id !== id));
    return;
  }
  const res = await fetch(`/api/package-posts/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await errorOf(res)).message);
}
