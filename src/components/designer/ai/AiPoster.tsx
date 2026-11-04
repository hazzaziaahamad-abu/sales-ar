"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AiDesign, DesignTheme } from "@/lib/ai-designs/types";
import { DESIGN_SIZE } from "@/lib/ai-designs/types";
import { FONT_LEXEND, FONT_TAJAWAL } from "../fonts";
import {
  Highlighted, IconCheck, IconInstagram, IconPhone, IconWhatsapp, INK, INK_2, LIGHT_BG, Logo, Ring,
} from "../templates/parts";

// مرسام «صمّم من مرجع»: يحوّل المواصفة (AiDesign) لبوست بهوية قائمة الطلبات بالمقاس الحقيقي.
// كل شي هنا CSS بسيط (بدون filter/blur) عشان التصدير PNG يطلع مطابق للمعاينة.

const PURPLE = "#4A2C9F";
const GOLD = "#F5C518";
const CONTACT = { phone: "920031843", whatsapp: "+966 59 116 6861", handle: "menuspages" };

interface Palette {
  bg: string; fg: string; sub: string; accent: string; accent2: string;
  card: string; cardBorder: string; onAccent: string; ctaBg: string; ctaFg: string;
  logoLight: boolean; logoGold: string; pattern: string;
}

const PALETTES: Record<DesignTheme, Palette> = {
  light: {
    bg: LIGHT_BG, fg: INK, sub: INK_2, accent: PURPLE, accent2: GOLD, card: "#FFFFFF", cardBorder: "rgba(74,44,159,0.12)",
    onAccent: "#FFFFFF", ctaBg: GOLD, ctaFg: INK, logoLight: false, logoGold: GOLD, pattern: "rgba(74,44,159,0.13)",
  },
  dark: {
    bg: INK, fg: "#FFFFFF", sub: "rgba(255,255,255,0.74)", accent: GOLD, accent2: "#8C6CF0", card: "rgba(255,255,255,0.07)",
    cardBorder: "rgba(255,255,255,0.14)", onAccent: INK, ctaBg: GOLD, ctaFg: INK, logoLight: true, logoGold: GOLD, pattern: "rgba(255,255,255,0.09)",
  },
  purple: {
    bg: PURPLE, fg: "#FFFFFF", sub: "rgba(255,255,255,0.8)", accent: GOLD, accent2: "#FFFFFF", card: "rgba(255,255,255,0.1)",
    cardBorder: "rgba(255,255,255,0.2)", onAccent: INK, ctaBg: GOLD, ctaFg: INK, logoLight: true, logoGold: GOLD, pattern: "rgba(255,255,255,0.12)",
  },
  gold: {
    bg: GOLD, fg: INK, sub: INK_2, accent: PURPLE, accent2: INK, card: "#FFFFFF", cardBorder: "rgba(30,20,51,0.1)",
    onAccent: "#FFFFFF", ctaBg: INK, ctaFg: "#FFFFFF", logoLight: false, logoGold: "#FFFFFF", pattern: "rgba(30,20,51,0.13)",
  },
};

const plainLen = (t: string) => t.replace(/\[\[|\]\]/g, "").length;

// ─── الخلفيات والزخارف ────────────────────────────────────────────────────────

function Background({ d, p, w, h }: { d: AiDesign; p: Palette; w: number; h: number }) {
  const layer: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
  switch (d.background) {
    case "dots":
      return <div style={{ ...layer, backgroundImage: `radial-gradient(${p.pattern} 2px, transparent 2px)`, backgroundSize: "26px 26px" }} />;
    case "grid":
      return (
        <div
          style={{
            ...layer,
            backgroundImage: `linear-gradient(${p.pattern} 1.5px, transparent 1.5px), linear-gradient(90deg, ${p.pattern} 1.5px, transparent 1.5px)`,
            backgroundSize: "72px 72px",
          }}
        />
      );
    case "glow":
      return (
        <div
          style={{
            ...layer,
            background: `radial-gradient(circle at 85% 8%, color-mix(in srgb, ${p.accent2} 45%, transparent) 0, transparent 45%),
              radial-gradient(circle at 8% 92%, color-mix(in srgb, ${p.accent} 20%, transparent) 0, transparent 42%)`,
          }}
        />
      );
    case "rays":
      return (
        <div
          style={{
            ...layer,
            background: `repeating-conic-gradient(from 0deg at 50% 28%, ${p.pattern} 0deg 7deg, transparent 7deg 18deg)`,
          }}
        />
      );
    case "waves":
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ ...layer, display: "block" }}>
          <path d={`M0 ${h * 0.78} C ${w * 0.3} ${h * 0.7}, ${w * 0.6} ${h * 0.9}, ${w} ${h * 0.76} L ${w} ${h} L 0 ${h} Z`} fill={p.pattern} />
          <path d={`M0 ${h * 0.86} C ${w * 0.35} ${h * 0.8}, ${w * 0.7} ${h * 0.96}, ${w} ${h * 0.84} L ${w} ${h} L 0 ${h} Z`} fill={p.pattern} />
        </svg>
      );
    default:
      return null;
  }
}

const Sparkle = ({ size, color, style }: { size: number; color: string; style: CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", display: "block", ...style }}>
    <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill={color} />
  </svg>
);

function Decor({ d, p, w, h }: { d: AiDesign; p: Palette; w: number; h: number }) {
  const abs: CSSProperties = { position: "absolute", pointerEvents: "none" };
  return (
    <>
      {d.decor.includes("stripe") && (
        <div style={{ ...abs, left: -300, top: h * 0.42, width: w + 700, height: 220, background: p.pattern, transform: "rotate(-18deg)" }} />
      )}
      {d.decor.includes("circles") && (
        <>
          <div style={{ ...abs, left: -140, top: -140, width: 420, height: 420, borderRadius: "50%", border: `3px solid ${p.pattern}` }} />
          <div style={{ ...abs, left: -60, top: -60, width: 260, height: 260, borderRadius: "50%", border: `3px solid ${p.pattern}` }} />
          <div style={{ ...abs, right: -90, bottom: h * 0.18, width: 220, height: 220, borderRadius: "50%", background: p.pattern }} />
        </>
      )}
      {d.decor.includes("ring") && (
        <div
          style={{
            ...abs, right: -260, top: -260, width: 620, height: 620, borderRadius: "50%",
            border: `70px solid color-mix(in srgb, ${p.accent} 22%, transparent)`,
          }}
        />
      )}
      {d.decor.includes("sparkles") && (
        <>
          <Sparkle size={54} color={p.accent2} style={{ left: 90, top: h * 0.2 }} />
          <Sparkle size={30} color={p.accent} style={{ left: 170, top: h * 0.27 }} />
          <Sparkle size={42} color={p.accent2} style={{ right: 110, top: h * 0.62 }} />
          <Sparkle size={24} color={p.accent} style={{ right: 60, top: h * 0.56 }} />
        </>
      )}
      {d.decor.includes("corners") && (
        <>
          {([
            { pos: { top: 36, right: 36 }, sides: ["Top", "Right"] },
            { pos: { top: 36, left: 36 }, sides: ["Top", "Left"] },
            { pos: { bottom: 36, right: 36 }, sides: ["Bottom", "Right"] },
            { pos: { bottom: 36, left: 36 }, sides: ["Bottom", "Left"] },
          ] as const).map((c, i) => {
            const line = `8px solid ${p.accent}`;
            const borders = Object.fromEntries(c.sides.map((sd) => [`border${sd}`, line]));
            return <div key={i} style={{ ...abs, ...c.pos, width: 110, height: 110, ...borders }} />;
          })}
        </>
      )}
    </>
  );
}

// ─── عناصر المحتوى ───────────────────────────────────────────────────────────

function Eyebrow({ text, p }: { text: string; p: Palette }) {
  return (
    <div
      data-fit="eyebrow"
      data-fit-lines="1"
      style={{
        display: "inline-block", background: p.accent, color: p.onAccent, borderRadius: 999, padding: "12px 34px 14px",
        fontWeight: 800, fontSize: 34, lineHeight: 1.2, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden",
      }}
    >
      {text}
    </div>
  );
}

function Bullets({ d, p, center }: { d: AiDesign; p: Palette; center: boolean }) {
  if (!d.bullets.length) return null;
  const fs = d.size === "square" ? 34 : 38;
  if (d.bulletStyle === "chips") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: center ? "center" : "flex-start" }}>
        {d.bullets.map((b, i) => (
          <span
            key={i}
            style={{
              background: p.card, border: `2px solid ${p.cardBorder}`, color: p.fg, borderRadius: 999,
              padding: "12px 28px 14px", fontWeight: 700, fontSize: fs * 0.9, lineHeight: 1.25,
            }}
          >
            {b}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "stretch", alignSelf: center ? "center" : "stretch", maxWidth: "100%" }}>
      {d.bullets.map((b, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, fontWeight: 700, fontSize: fs, color: p.fg, lineHeight: 1.3 }}>
          {d.bulletStyle === "numbers" ? (
            <span
              style={{
                width: 58, height: 58, borderRadius: "50%", background: p.accent, color: p.onAccent, flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_LEXEND, fontSize: 30, fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
          ) : (
            <Ring size={52} color={p.accent}><IconCheck size={28} color={p.accent} /></Ring>
          )}
          <span>{b}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ stat, p, big }: { stat: NonNullable<AiDesign["stat"]>; p: Palette; big?: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "baseline", gap: 16, direction: "rtl" }}>
      <span style={{ fontFamily: FONT_LEXEND, fontWeight: 700, fontSize: big ? 170 : 120, lineHeight: 1, color: p.accent, direction: "ltr" }}>
        {stat.value}
      </span>
      {stat.label && <span style={{ fontWeight: 800, fontSize: big ? 44 : 38, color: p.fg, maxWidth: 420 }}>{stat.label}</span>}
    </div>
  );
}

function Cta({ text, p }: { text: string; p: Palette }) {
  return (
    <div
      data-fit="cta"
      data-fit-lines="1"
      style={{
        display: "inline-flex", alignItems: "center", gap: 14, background: p.ctaBg, color: p.ctaFg, borderRadius: 999,
        padding: "20px 52px 24px", fontWeight: 900, fontSize: 42, lineHeight: 1.15, whiteSpace: "nowrap",
        boxShadow: "0 12px 30px rgba(30,20,51,0.18)",
      }}
    >
      {text}
      <span style={{ fontSize: 40, lineHeight: 1 }}>←</span>
    </div>
  );
}

function Contact({ p }: { p: Palette }) {
  const item = (icon: ReactNode, text: string) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, direction: "ltr" }}>
      {icon}
      <span style={{ fontFamily: FONT_LEXEND, fontWeight: 600, fontSize: 28 }}>{text}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "14px 40px", color: p.fg }}>
      {item(<IconPhone size={30} color={p.accent} />, CONTACT.phone)}
      {item(<IconWhatsapp size={30} color={p.accent} />, CONTACT.whatsapp)}
      {item(<IconInstagram size={30} color={p.accent} />, CONTACT.handle)}
    </div>
  );
}

/** الصورة تاخذ المساحة المتبقية (flex) وتنضغط بدل ما يطلع المحتوى برا البوست. */
function ImageBlock({ d, p }: { d: AiDesign; p: Palette }) {
  if (!d.image || d.imageFrame === "none") return null;
  const wrap: CSSProperties = { flex: "1 1 0", minHeight: 160, width: "100%", display: "flex", justifyContent: "center", alignItems: "center" };
  if (d.imageFrame === "phone") {
    return (
      <div style={wrap}>
        <div
          style={{
            height: "100%", aspectRatio: "9 / 18.5", maxWidth: "70%", borderRadius: 64, background: INK, padding: 16,
            boxSizing: "border-box", boxShadow: "0 30px 60px rgba(30,20,51,0.35)", position: "relative",
          }}
        >
          <div style={{ width: "100%", height: "100%", borderRadius: 50, overflow: "hidden", background: "#fff" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }} />
          </div>
          <div style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", width: 120, height: 30, borderRadius: 20, background: INK }} />
        </div>
      </div>
    );
  }
  const photo = d.imageFrame === "photo";
  return (
    <div style={wrap}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={d.image}
        alt=""
        style={{
          maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block",
          borderRadius: photo ? 36 : 28, border: photo ? `12px solid ${p.card === "#FFFFFF" ? "#FFFFFF" : "rgba(255,255,255,0.9)"}` : undefined,
          boxShadow: "0 24px 50px rgba(30,20,51,0.28)", transform: photo ? undefined : "rotate(-3deg)",
        }}
      />
    </div>
  );
}

function Headline({ d, p, scale = 1 }: { d: AiDesign; p: Palette; scale?: number }) {
  const base = d.size === "story" ? 104 : d.size === "portrait" ? 92 : 82;
  const len = plainLen(d.headline);
  const fit = len > 18 ? Math.max(0.58, Math.sqrt(18 / len)) : 1;
  return (
    <div
      data-fit="headline"
      style={{ fontWeight: 900, fontSize: Math.round(base * scale * fit), lineHeight: 1.22, color: p.fg, letterSpacing: -0.5, textWrap: "balance" } as CSSProperties}
    >
      <Highlighted text={d.headline} color={p.accent} />
    </div>
  );
}

function Sub({ d, p }: { d: AiDesign; p: Palette }) {
  if (!d.subheadline) return null;
  return (
    <div data-fit="subheadline" style={{ fontWeight: 500, fontSize: d.size === "square" ? 34 : 40, lineHeight: 1.45, color: p.sub, textWrap: "pretty" } as CSSProperties}>
      <Highlighted text={d.subheadline} color={p.accent} />
    </div>
  );
}

const LogoBlock = ({ p, height = 104 }: { p: Palette; height?: number }) => (
  <Logo height={height} purple={PURPLE} gold={p.logoGold} light={p.logoLight} />
);

// ─── التخطيطات ───────────────────────────────────────────────────────────────

function Stack({ d, p, center, pad, headScale = 1, withLogo = true }: {
  d: AiDesign; p: Palette; center: boolean; pad: number; headScale?: number; withLogo?: boolean;
}) {
  const gap = d.size === "square" ? 26 : 36;
  const hasImage = !!d.image && d.imageFrame !== "none";
  return (
    <div
      style={{
        position: "relative", height: "100%", boxSizing: "border-box", padding: pad,
        display: "flex", flexDirection: "column", gap, alignItems: center ? "center" : "stretch", textAlign: center ? "center" : "right",
      }}
    >
      {withLogo && <div style={{ alignSelf: center ? "center" : "flex-start" }}><LogoBlock p={p} /></div>}
      <div
        data-flow
        style={{
          flex: "1 1 0", minHeight: 0, overflow: "hidden", width: "100%", display: "flex", flexDirection: "column", gap,
          alignItems: center ? "center" : "flex-start", justifyContent: hasImage ? "flex-start" : "center",
        }}
      >
        {d.eyebrow && <Eyebrow text={d.eyebrow} p={p} />}
        <Headline d={d} p={p} scale={headScale} />
        <Sub d={d} p={p} />
        {d.stat && <Stat stat={d.stat} p={p} big={d.layout === "bold"} />}
        <Bullets d={d} p={p} center={center} />
        <ImageBlock d={d} p={p} />
      </div>
      {d.cta && <div style={{ alignSelf: center ? "center" : "flex-start" }}><Cta text={d.cta} p={p} /></div>}
      {d.showContact && <Contact p={p} />}
    </div>
  );
}

function SplitLayout({ d, p, w, h }: { d: AiDesign; p: Palette; w: number; h: number }) {
  const panelTheme: DesignTheme = d.theme === "purple" || d.theme === "gold" ? "dark" : "purple";
  const pp = PALETTES[panelTheme];
  const center = d.align === "center";
  const panelH = Math.round(h * (d.size === "story" ? 0.46 : 0.5));
  const gap = d.size === "square" ? 24 : 34;
  const hasImage = !!d.image && d.imageFrame !== "none";
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          position: "relative", height: panelH, flexShrink: 0, background: pp.bg, color: pp.fg, borderRadius: "0 0 90px 90px",
          padding: "64px 80px 56px", boxSizing: "border-box", overflow: "hidden",
          display: "flex", flexDirection: "column", gap, alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "right",
        }}
      >
        <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(${pp.pattern} 2px, transparent 2px)`, backgroundSize: "26px 26px" }} />
        <div style={{ position: "relative" }}><LogoBlock p={pp} height={96} /></div>
        <div data-flow style={{ position: "relative", flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap, justifyContent: "center", alignItems: center ? "center" : "flex-start", width: "100%" }}>
          {d.eyebrow && <Eyebrow text={d.eyebrow} p={pp} />}
          <Headline d={d} p={pp} scale={0.92} />
          <Sub d={d} p={pp} />
        </div>
      </div>
      <div
        style={{
          flex: "1 1 0", minHeight: 0, padding: "48px 80px 56px", boxSizing: "border-box",
          display: "flex", flexDirection: "column", gap, alignItems: center ? "center" : "stretch", textAlign: center ? "center" : "right", width: w,
        }}
      >
        <div data-flow style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap, justifyContent: hasImage ? "flex-start" : "center", alignItems: center ? "center" : "flex-start", width: "100%" }}>
          {d.stat && <Stat stat={d.stat} p={p} />}
          <Bullets d={d} p={p} center={center} />
          <ImageBlock d={d} p={p} />
        </div>
        {d.cta && <div style={{ alignSelf: center ? "center" : "flex-start" }}><Cta text={d.cta} p={p} /></div>}
        {d.showContact && <Contact p={p} />}
      </div>
    </div>
  );
}

export function AiPoster({ design: d }: { design: AiDesign }) {
  const { w, h } = DESIGN_SIZE[d.size];
  const p = PALETTES[d.theme];
  const center = d.align === "center";

  let body: ReactNode;
  if (d.layout === "split") {
    body = <SplitLayout d={d} p={p} w={w} h={h} />;
  } else if (d.layout === "card") {
    const cp = d.theme === "light" ? { ...PALETTES.light, bg: "#FFFFFF" } : PALETTES.light;
    body = (
      <div style={{ position: "relative", height: "100%", padding: d.size === "square" ? 54 : 64, boxSizing: "border-box" }}>
        <div
          style={{
            height: "100%", borderRadius: 56, background: cp.bg, color: cp.fg, overflow: "hidden",
            boxShadow: "0 30px 80px rgba(30,20,51,0.28)", border: `2px solid ${cp.cardBorder}`,
          }}
        >
          <Stack d={d} p={{ ...cp, card: LIGHT_BG }} center={center} pad={d.size === "square" ? 52 : 64} />
        </div>
      </div>
    );
  } else {
    body = (
      <Stack
        d={d}
        p={p}
        center={d.layout === "centered" ? center : d.layout === "editorial" ? false : center}
        pad={d.size === "square" ? 70 : 84}
        headScale={d.layout === "bold" ? 1.42 : 1}
      />
    );
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      data-poster
      style={{
        position: "relative", width: w, height: h, overflow: "hidden", background: p.bg, color: p.fg,
        fontFamily: FONT_TAJAWAL, lineHeight: 1.35, WebkitFontSmoothing: "antialiased", boxSizing: "border-box",
      }}
    >
      <Background d={d} p={p} w={w} h={h} />
      <Decor d={d} p={p} w={w} h={h} />
      {body}
    </div>
  );
}
