"use client";

import type { PostData } from "@/lib/package-posts/types";
import { FONT_LEXEND } from "../fonts";
import { IconPhone, IconWhatsapp, ImageBox, INK, INK_2, Latin, Logo, PosterRoot, Ring, SocialIcons } from "./parts";

/** اكتملت الحلقة — نظام الكاشير — 1080×1350. */
export function CashierTemplate({ post }: { post: PostData }) {
  const { purple, gold } = post.colors;
  const cards = post.cards ?? [];
  return (
    <PosterRoot w={1080} h={1350} bg="#EEEDF2">
      {/* الجزء العلوي البنفسجي بحافة مائلة */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 760, background: purple, clipPath: "polygon(0 0,100% 0,100% 72%,0 100%)" }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", padding: "46px 50px 0" }}>
        <Logo height={96} purple={purple} gold={gold} light />

        <div data-fit="headline" data-fit-lines="1" style={{ color: gold, fontSize: 92, fontWeight: 900, lineHeight: 1.2, marginTop: 22, textAlign: "center" }}>
          {post.headline}
        </div>
        <div data-fit="banner" data-fit-lines="1" style={{ color: "#fff", fontSize: 66, fontWeight: 700, lineHeight: 1.25, marginTop: 4, textAlign: "center" }}>
          {post.banner}
        </div>

        {post.badge && (
          <div
            data-fit="badge" data-fit-lines="1"
            style={{
              marginTop: 24, border: "3px solid #fff", borderRadius: 999, background: "rgba(255,255,255,0.08)",
              padding: "10px 34px 14px", color: "#fff", fontSize: 29, fontWeight: 500, lineHeight: 1.35, whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: gold, fontWeight: 800, fontSize: 36 }}>{post.badge.strong}</span>{" "}
            {post.badge.text}
          </div>
        )}

        {/* صورة الجهاز يمين + كرتين الأسعار يسار */}
        <div style={{ display: "flex", gap: 26, marginTop: 34, width: "100%", alignItems: "stretch" }}>
          <ImageBox
            slot={post.images.hero}
            w={594}
            h={640}
            radius={28}
            style={{ boxShadow: "0 24px 50px rgba(30,20,51,0.28)", background: "#fff" }}
          />
          <div style={{ width: 360, height: 640, flexShrink: 0, display: "flex", flexDirection: "column", gap: 22 }}>
            {cards.map((c, i) => (
              <div
                key={i}
                data-flow
                style={{
                  flex: 1, minHeight: 0, background: "#fff", borderRadius: 26, padding: "24px 26px 20px",
                  boxShadow: "0 16px 36px rgba(30,20,51,0.16)", display: "flex", flexDirection: "column",
                }}
              >
                <div data-fit={`cards.${i}.title`} data-fit-lines="1" style={{ fontSize: 31, fontWeight: 800, color: purple, lineHeight: 1.3 }}>{c.title}</div>
                <div data-fit={`cards.${i}.desc`} data-fit-lines="4" style={{ fontSize: 22, fontWeight: 500, color: INK_2, lineHeight: 1.5, marginTop: 8 }}>{c.desc}</div>
                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <div data-fit={`cards.${i}.price`} data-fit-lines="1" dir="ltr" style={{ fontFamily: FONT_LEXEND, fontWeight: 700, fontSize: 72, lineHeight: 1, color: purple, letterSpacing: -1.5 }}>
                    {c.price}
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 700, color: INK_2, marginTop: 4 }}>{c.unit}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* الشريط السفلي + كبسولة «تواصل معنا الآن» */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 128, background: purple, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 26 }}>
        <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: 28, color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Ring size={44} color="#fff"><IconPhone size={24} color="#fff" /></Ring>
            <Latin style={{ fontSize: 30 }}>{post.contact.phone}</Latin>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Ring size={44} color="#fff"><IconWhatsapp size={25} color="#fff" /></Ring>
            <Latin style={{ fontSize: 30 }}>{post.contact.whatsapp}</Latin>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SocialIcons size={44} color="#fff" gap={6} />
            <Latin style={{ fontSize: 30 }}>{post.contact.handle}</Latin>
          </div>
        </div>
      </div>
      {post.cta && (
        <div
          data-fit="cta" data-fit-lines="1"
          style={{
            position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)",
            background: gold, color: INK, border: "4px solid #fff", borderRadius: 999,
            padding: "8px 48px 12px", fontSize: 38, fontWeight: 900, whiteSpace: "nowrap", lineHeight: 1.3,
          }}
        >
          {post.cta}
        </div>
      )}
    </PosterRoot>
  );
}
