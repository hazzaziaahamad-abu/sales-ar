"use client";

import type { PostData } from "@/lib/package-posts/types";
import { FONT_LEXEND } from "../fonts";
import { DotBackground, FooterInline, Highlighted, ImageBox, INK, INK_2, lightPurple, Logo, PosterRoot } from "./parts";

const Square = ({ color, size }: { color: string; size: number }) => (
  <span style={{ width: size, height: size, background: color, borderRadius: size * 0.2, flexShrink: 0, display: "inline-block" }} />
);

/** باقة VIP و VIP بلس — 1080×1920. الفرق بينهم في البيانات (العمود الجانبي variant). */
export function VipTemplate({ post }: { post: PostData }) {
  const { purple, gold } = post.colors;
  const side = post.side;
  return (
    <PosterRoot w={1080} h={1920}>
      <DotBackground bandTop={260} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "54px 44px 46px" }}>
        {/* 1) اللوقو */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Logo height={104} purple={purple} gold={gold} />
        </div>

        {/* 2) الكرت: النص يمين + الجوال يطلع فوق حد الكرت يسار */}
        <div style={{ position: "relative", marginTop: 118, height: 360, borderRadius: 28, background: lightPurple(purple) }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 46, left: 440, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-start" }}>
            <div data-fit="packageName" data-fit-lines="1" style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.2 }}>
              {post.packageName}
            </div>
            <div data-fit="price" data-fit-lines="1" dir="ltr" style={{ fontFamily: FONT_LEXEND, fontWeight: 700, fontSize: 190, lineHeight: 0.95, color: purple, letterSpacing: -5, margin: "4px 0 16px" }}>
              {post.price}
            </div>
            <div style={{ background: gold, borderRadius: 14, padding: "8px 28px 12px", fontSize: 42, fontWeight: 800, lineHeight: 1.2 }}>
              {post.priceUnit}
            </div>
          </div>
          <ImageBox slot={post.images.hero} w={400} h={480} style={{ position: "absolute", left: 24, bottom: 0 }} />
        </div>

        {/* 3) الفقرة */}
        <div data-fit="intro" data-fit-lines="3" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.5, color: INK, marginTop: 26, padding: "0 8px" }}>
          <Highlighted text={post.intro ?? ""} color={purple} />
        </div>

        {/* 4) عمودين: المزايا يمين + العمود الجانبي يسار */}
        <div data-flow style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", gap: 28, marginTop: 26 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {post.features.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ marginTop: 14 }}><Square color={gold} size={14} /></span>
                <span data-fit={`features.${i}`} data-fit-lines="2" style={{ flex: 1, minWidth: 0, fontSize: 30, fontWeight: 700, lineHeight: 1.32, color: INK }}>
                  {f}
                </span>
              </div>
            ))}
          </div>

          {side && (
            <div style={{ width: 330, flexShrink: 0 }}>
              {side.variant === "loyalty" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div data-fit="side.title" style={{ fontSize: 38, fontWeight: 800, color: purple, lineHeight: 1.3 }}>{side.title}</div>
                  {side.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <span style={{ marginTop: 14 }}><Square color={gold} size={14} /></span>
                      <span data-fit={`side.items.${i}`} data-fit-lines="2" style={{ fontSize: 29, fontWeight: 700, lineHeight: 1.4, color: INK_2 }}>{it}</span>
                    </div>
                  ))}
                  <ImageBox slot={post.images.side} w={330} h={400} radius={24} style={{ marginTop: 10 }} />
                </div>
              ) : (
                <div style={{ background: purple, borderRadius: 30, padding: "34px 30px 38px", color: "#fff", display: "flex", flexDirection: "column", gap: 22 }}>
                  <div data-fit="side.title" style={{ fontSize: 31, fontWeight: 800, color: gold, lineHeight: 1.45 }}>{side.title}</div>
                  {side.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                      <span style={{ marginTop: 14, width: 14, height: 14, borderRadius: "50%", background: gold, flexShrink: 0 }} />
                      <span data-fit={`side.items.${i}`} data-fit-lines="3" style={{ fontSize: 29, fontWeight: 700, lineHeight: 1.45 }}>{it}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ paddingTop: 20 }}>
          <FooterInline post={post} />
        </div>
      </div>
    </PosterRoot>
  );
}
