"use client";

import type { PostData } from "@/lib/package-posts/types";
import { FONT_LEXEND } from "../fonts";
import { DotBackground, FooterStacked, IconCheck, ImageBox, INK, Logo, PosterRoot } from "./parts";

/** الباقة الأساسية — 1080×1920. */
export function BasicTemplate({ post }: { post: PostData }) {
  const { purple, gold } = post.colors;
  return (
    <PosterRoot w={1080} h={1920}>
      <DotBackground bandTop={360} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "64px 0 56px" }}>
        {/* 1) اللوقو */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo height={124} purple={purple} gold={gold} />
        </div>

        {/* 2) الاسم والسعر يمين + صورة الجوال يسار */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "30px 50px 0 24px", height: 640 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div data-fit="packageName" data-fit-lines="1" style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.25 }}>
              {post.packageName}
            </div>
            <div
              data-fit="price" data-fit-lines="1" dir="ltr"
              style={{ fontFamily: FONT_LEXEND, fontWeight: 700, fontSize: 250, lineHeight: 1, color: purple, letterSpacing: -6, margin: "6px 0 18px" }}
            >
              {post.price}
            </div>
            <div style={{ background: gold, borderRadius: 16, padding: "10px 34px 14px", fontSize: 50, fontWeight: 800, lineHeight: 1.2 }}>
              {post.priceUnit}
            </div>
          </div>
          <ImageBox
            slot={post.images.hero}
            w={410}
            h={620}
            style={{
              WebkitMaskImage: "radial-gradient(ellipse 72% 72% at 50% 48%, #000 62%, transparent 100%)",
              maskImage: "radial-gradient(ellipse 72% 72% at 50% 48%, #000 62%, transparent 100%)",
            }}
          />
        </div>

        {/* 3) سطر الوصف */}
        <div data-fit="headline" data-fit-lines="1" style={{ fontSize: 60, fontWeight: 700, textAlign: "center", padding: "22px 40px 0", lineHeight: 1.3 }}>
          {post.headline}
        </div>

        {/* 4) الشريط البنفسجي */}
        <div style={{ background: purple, color: "#fff", marginTop: 22, padding: "22px 40px 28px", textAlign: "center" }}>
          <div data-fit="banner" data-fit-lines="1" style={{ fontSize: 66, fontWeight: 800, lineHeight: 1.25 }}>{post.banner}</div>
        </div>

        {/* 5) مقدمة المزايا */}
        <div data-fit="intro" data-fit-lines="1" style={{ fontSize: 50, fontWeight: 800, color: purple, padding: "30px 50px 0", lineHeight: 1.3 }}>
          {post.intro}
        </div>

        {/* المزايا */}
        <div data-flow style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: "22px 50px 0", display: "flex", flexDirection: "column", gap: 24 }}>
          {post.features.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <span style={{ marginTop: 10 }}><IconCheck size={42} color={gold} /></span>
              <span data-fit={`features.${i}`} data-fit-lines="1" style={{ flex: 1, minWidth: 0, fontSize: 42, fontWeight: 700, color: INK, lineHeight: 1.45 }}>
                {f}
              </span>
            </div>
          ))}
        </div>

        <FooterStacked post={post} />
      </div>
    </PosterRoot>
  );
}
