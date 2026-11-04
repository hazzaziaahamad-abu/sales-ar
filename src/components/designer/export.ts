// تصدير البوست PNG بالمقاس الحقيقي + ZIP للكل + المشاركة من الجوال.

import { toPng } from "html-to-image";
import type { PostData } from "@/lib/package-posts/types";
import { TEMPLATE_SIZE } from "@/lib/package-posts/types";
import { embeddedFontCSS, loadStudioFonts } from "./fonts";

/** ينتظر تحميل كل الصور داخل العنصر (أو فشلها) وفك ترميزها. */
async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (!img.complete) {
        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }
      if (img.naturalWidth > 0) await img.decode().catch(() => undefined);
    })
  );
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const isWebKit = () =>
  typeof navigator !== "undefined" && /AppleWebKit/.test(navigator.userAgent) && !/Chrome|CriOS|Android/.test(navigator.userAgent);

/** يلتقط عنصر القالب (المقاس الكامل، بدون تصغير) ويرجّع PNG كـ Blob. */
export async function renderPng(node: HTMLElement, post: PostData): Promise<Blob> {
  const { w, h } = TEMPLATE_SIZE[post.template];
  return renderNodePng(node, w, h);
}

/** نفس التصدير لأي عنصر بمقاس معطى (يستخدمه «صمّم من مرجع»). */
export async function renderNodePng(node: HTMLElement, w: number, h: number): Promise<Blob> {
  await loadStudioFonts();
  await waitForImages(node);
  await nextFrame();
  const fontEmbedCSS = await embeddedFontCSS();
  const opts = {
    width: w, height: h, pixelRatio: 1, cacheBust: false, fontEmbedCSS, backgroundColor: "#ffffff",
    // لو صورة ما تحمّلت ما نفشل التصدير كله
    imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==",
  };
  // سفاري أحياناً يرسم الصور فاضية بأول التقاط — نسخة تسخين قبل الحقيقية
  if (isWebKit()) await toPng(node, opts).catch(() => undefined);
  const dataUrl = await toPng(node, opts);
  return (await fetch(dataUrl)).blob();
}

export function fileNameFor(post: PostData) {
  const safe = (post.title || post.template).replace(/[\\/:*?"<>|]+/g, "-").trim() || post.template;
  return `${safe}.png`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob(["x"], { type: "image/png" })], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export type ShareResult = "shared" | "cancelled" | "needs-gesture" | "downloaded";

/** يفتح قائمة المشاركة بالصورة (واتساب/إنستقرام…). لو الجهاز ما يدعم مشاركة الملفات ينزّلها. */
export async function shareFile(file: File): Promise<ShareResult> {
  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name.replace(/\.png$/, "") });
      return "shared";
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "AbortError") return "cancelled";
      // سفاري يرفض لو طال التوليد وراحت «لمسة المستخدم» — نطلب ضغطة ثانية والصورة جاهزة
      if (name === "NotAllowedError") return "needs-gesture";
      throw e;
    }
  }
  downloadBlob(file, file.name);
  return "downloaded";
}

export async function zipPngs(entries: { name: string; blob: Blob }[]): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const e of entries) {
    let name = e.name;
    for (let i = 2; used.has(name); i++) name = e.name.replace(/\.png$/, ` (${i}).png`);
    used.add(name);
    zip.file(name, e.blob);
  }
  return zip.generateAsync({ type: "blob" });
}

/** يصغّر الصورة المرفوعة ويحوّلها لـ data URL (WebP يحفظ الشفافية) عشان تنحفظ ولا تنكسر وقت التصدير. */
export async function fileToDataUrl(file: File, maxSide = 1400): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = bitmapUrl;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const webp = canvas.toDataURL("image/webp", 0.88);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
