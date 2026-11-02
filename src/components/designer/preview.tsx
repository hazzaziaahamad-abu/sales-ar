"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import type { PostData } from "@/lib/package-posts/types";
import { TEMPLATE_SIZE } from "@/lib/package-posts/types";
import { PostRenderer } from "./templates";
import { fontFaceCSS, loadStudioFonts } from "./fonts";

/** يسجّل خطوط الاستوديو المحلية (@font-face) ويحمّل كل الأوزان. */
export function StudioFonts({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    let alive = true;
    loadStudioFonts().then(() => alive && onReady?.());
    return () => { alive = false; };
  }, [onReady]);
  return <style dangerouslySetInnerHTML={{ __html: fontFaceCSS() }} />;
}

/** معاينة مصغّرة: القالب يُرسم بمقاسه الحقيقي ثم يُصغَّر بـ transform: scale() حسب العرض المتاح. */
export function ScaledPreview({ post, maxHeight }: { post: PostData; maxHeight?: number }) {
  const { w, h } = TEMPLATE_SIZE[post.template];
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = avail ? Math.min(avail / w, maxHeight ? maxHeight / h : Infinity) : 0;
  return (
    <div ref={box} style={{ width: "100%" }}>
      <div
        style={{
          position: "relative", width: w * scale, height: h * scale, overflow: "hidden", margin: "0 auto",
          borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", visibility: scale ? "visible" : "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <PostRenderer post={post} />
        </div>
      </div>
    </div>
  );
}

/**
 * مسرح التصدير: البوست بمقاسه الكامل بدون أي تصغير، خارج الشاشة. منه نلتقط الـ PNG ونقيس طول النصوص
 * (يشتغل حتى لو تبويب المعاينة مخفي على الجوال).
 */
export const ExportStage = forwardRef<HTMLDivElement, { post: PostData }>(function ExportStage({ post }, ref) {
  return (
    <div aria-hidden style={{ position: "fixed", top: 0, left: -30000, pointerEvents: "none", zIndex: -1 }}>
      <div ref={ref} style={{ width: TEMPLATE_SIZE[post.template].w, height: TEMPLATE_SIZE[post.template].h }}>
        <PostRenderer post={post} />
      </div>
    </div>
  );
});
