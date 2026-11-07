import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDeskAccess } from "@/lib/content-desk/server";
import { isContentType, isPlatform } from "@/lib/content-desk/types";
import { ASSET_COLS, isAssetKind, type BankAsset, type BankPayload, type LinkableItem } from "@/lib/content-desk/bank";

export const runtime = "nodejs";

const BUCKET = "content-bank";
const MAX_BYTES = 500 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_MIME = /^(image|video)\//;

const err = (error: string, status = 400) => NextResponse.json({ error }, { status });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const intOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 2_000_000_000 ? n : null;
};
const tagsOf = (v: unknown) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,،#\n]/) : [])
    .map((t) => String(t).trim().slice(0, 30)).filter(Boolean).slice(0, 12);
const safeName = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";

type Row = Omit<BankAsset, "preview_url" | "uploader_name" | "linked"> & { storage_path: string };

/** GET /api/content-desk/bank → كل ملفات بنك المنشأة + روابط معاينة موقّعة + نتائج منشور الخطة المربوط. */
export async function GET() {
  const access = await getDeskAccess(null);
  if (!access) return err("Unauthorized", 401);
  const { orgId, me } = access;

  const since = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
  const [assetsRes, itemsRes] = await Promise.all([
    supabaseAdmin.from("content_bank_assets").select(ASSET_COLS).eq("org_id", orgId).order("created_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("content_desk_items").select("id, idea, item_date, platform, actual_views, actual_engagement, link, user_id")
      .eq("org_id", orgId).gte("item_date", since).order("item_date", { ascending: false }).limit(1000),
  ]);
  if (assetsRes.error) return err(assetsRes.error.message, 500);
  const rows = (assetsRes.data ?? []) as Row[];
  const items = itemsRes.data ?? [];

  const userIds = [...new Set([...rows.map((r) => r.uploaded_by), ...items.map((i) => i.user_id as string)].filter(Boolean))] as string[];
  const { data: users } = userIds.length
    ? await supabaseAdmin.from("user_profiles").select("id, name").in("id", userIds)
    : { data: [] };
  const nameOf = new Map((users ?? []).map((u) => [u.id as string, (u.name as string) ?? ""]));
  const itemOf = new Map(items.map((i) => [i.id as string, i]));

  // عناصر مربوطة أقدم من نافذة الـ ١٨٠ يوم
  const missing = [...new Set(rows.map((r) => r.desk_item_id).filter((x): x is string => !!x && !itemOf.has(x)))];
  if (missing.length) {
    const { data } = await supabaseAdmin.from("content_desk_items").select("id, idea, item_date, platform, actual_views, actual_engagement, link, user_id").in("id", missing);
    for (const i of data ?? []) itemOf.set(i.id as string, i);
  }

  const paths = rows.map((r) => r.storage_path);
  const signed = paths.length ? (await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const assets: BankAsset[] = rows.map(({ storage_path, ...r }) => {
    const li = r.desk_item_id ? itemOf.get(r.desk_item_id) : undefined;
    return {
      ...r,
      preview_url: urlOf.get(storage_path) ?? null,
      uploader_name: r.uploaded_by ? nameOf.get(r.uploaded_by) ?? null : null,
      linked: li ? {
        idea: li.idea as string, item_date: li.item_date as string,
        actual_views: li.actual_views as number | null, actual_engagement: li.actual_engagement as number | null, link: li.link as string | null,
      } : null,
    };
  });
  const linkable: LinkableItem[] = items.map((i) => ({
    id: i.id as string, idea: i.idea as string, item_date: i.item_date as string, platform: i.platform as LinkableItem["platform"],
    actual_views: i.actual_views as number | null, owner_name: nameOf.get(i.user_id as string) ?? "",
  }));

  const payload: BankPayload = { me: { id: me.id, isManager: me.isManager }, assets, linkable };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/content-desk/bank — { action, ... }
 *  upload_url { file_name, mime_type, size_bytes } → رابط رفع موقّع (الملف يروح مباشرة للتخزين)
 *  create { path, title, kind, platform, ... } · update { id, ... } · delete { id } · download { id } → رابط تحميل
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const access = await getDeskAccess(null);
  if (!access) return err("Unauthorized", 401);
  const { orgId, me } = access;
  const now = new Date().toISOString();

  const meta = (b: Record<string, unknown>) => {
    const title = text(b.title, 200);
    if (!title) return { error: "اكتب اسم المحتوى" } as const;
    if (!isAssetKind(b.kind) || !isPlatform(b.platform)) return { error: "بيانات غير صالحة" } as const;
    return {
      row: {
        title, kind: b.kind, platform: b.platform,
        content_type: isContentType(b.content_type) ? b.content_type : null,
        tags: tagsOf(b.tags), note: text(b.note, 2000) || null,
        desk_item_id: typeof b.desk_item_id === "string" && UUID.test(b.desk_item_id) ? b.desk_item_id : null,
        views: intOrNull(b.views), engagement: intOrNull(b.engagement), updated_at: now,
      },
    } as const;
  };
  const checkItem = async (id: string | null) => {
    if (!id) return true;
    const { data } = await supabaseAdmin.from("content_desk_items").select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
    return !!data;
  };

  if (body.action === "upload_url") {
    const name = text(body.file_name, 200);
    const mime = text(body.mime_type, 100);
    const size = Number(body.size_bytes);
    if (!name || !ALLOWED_MIME.test(mime)) return err("ارفع صورة أو فيديو فقط");
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) return err("حجم الملف أكبر من ٥٠٠ ميقا");
    const path = `${orgId}/${now.slice(0, 7)}/${crypto.randomUUID()}-${safeName(name)}`;
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return err(error?.message ?? "تعذّر تجهيز الرفع", 500);
    return NextResponse.json({ path, signedUrl: data.signedUrl, token: data.token });
  }

  if (body.action === "create") {
    const path = text(body.path, 400);
    if (!path.startsWith(`${orgId}/`)) return err("مسار غير صالح");
    const m = meta(body);
    if ("error" in m) return err(m.error!);
    if (!(await checkItem(m.row.desk_item_id))) return err("المنشور المربوط غير موجود");
    // نتأكد إن الملف وصل التخزين فعلاً
    const dir = path.slice(0, path.lastIndexOf("/"));
    const file = path.slice(path.lastIndexOf("/") + 1);
    const { data: found } = await supabaseAdmin.storage.from(BUCKET).list(dir, { search: file, limit: 1 });
    if (!found?.length) return err("الملف ما اكتمل رفعه — جرّب مرة ثانية");
    const { data, error } = await supabaseAdmin.from("content_bank_assets").insert({
      ...m.row, org_id: orgId, storage_path: path,
      file_name: text(body.file_name, 200) || file, mime_type: text(body.mime_type, 100) || null,
      size_bytes: Number(found[0].metadata?.size) || intOrNull(body.size_bytes), uploaded_by: me.id,
    }).select("id").single();
    if (error) return err(error.message, 500);
    return NextResponse.json({ id: data.id });
  }

  if (!UUID.test(body.id ?? "")) return err("معرّف غير صالح");
  const { data: asset } = await supabaseAdmin.from("content_bank_assets").select("id, storage_path, file_name, uploaded_by, downloads")
    .eq("id", body.id).eq("org_id", orgId).maybeSingle();
  if (!asset) return err("غير موجود", 404);

  if (body.action === "download") {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(asset.storage_path as string, 600, { download: asset.file_name as string });
    if (error || !data) return err(error?.message ?? "تعذّر التحميل", 500);
    await supabaseAdmin.from("content_bank_assets").update({ downloads: (asset.downloads as number) + 1 }).eq("id", asset.id);
    return NextResponse.json({ url: data.signedUrl });
  }

  if (body.action === "update") {
    const m = meta(body);
    if ("error" in m) return err(m.error!);
    if (!(await checkItem(m.row.desk_item_id))) return err("المنشور المربوط غير موجود");
    const { error } = await supabaseAdmin.from("content_bank_assets").update(m.row).eq("id", asset.id).eq("org_id", orgId);
    if (error) return err(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    if (asset.uploaded_by !== me.id && !me.isManager) return err("الحذف لصاحب الملف أو المدير", 403);
    await supabaseAdmin.storage.from(BUCKET).remove([asset.storage_path as string]);
    const { error } = await supabaseAdmin.from("content_bank_assets").delete().eq("id", asset.id).eq("org_id", orgId);
    if (error) return err(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  return err("إجراء غير معروف");
}
