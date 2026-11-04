"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AiDesign, DesignTheme } from "@/lib/ai-designs/types";
import { DESIGN_SIZE, isPhotoLayout } from "@/lib/ai-designs/types";
import { FONT_LEXEND, FONT_TAJAWAL } from "../fonts";
import {
  Highlighted, IconCheck, IconInstagram, IconTiktok, IconWhatsapp, IconX, INK, INK_2, LIGHT_BG, Logo, Ring,
} from "../templates/parts";

// مرسام «صمّم من مرجع»: يحوّل المواصفة (AiDesign) لبوست بهوية قائمة الطلبات بالمقاس الحقيقي.
// كل شي هنا CSS بسيط (بدون filter/blur) عشان التصدير PNG يطلع مطابق للمعاينة.

const PURPLE = "#4A2C9F";
const GOLD = "#F5C518";
const CONTACT = { whatsapp: "+966 591166861", handle: "MENUSPAGES" };

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

/** فوق الصور: نص أبيض، تمييز ذهبي، شريط بنفسجي. */
const PHOTO_PALETTE: Palette = {
  ...PALETTES.dark, bg: "#140D24", sub: "rgba(255,255,255,0.88)", card: "rgba(255,255,255,0.12)", cardBorder: "rgba(255,255,255,0.25)",
};

const plainLen = (t: string) => t.replace(/\[\[|\]\]/g, "").length;
const linesOf = (t: string) => t.replace(/\\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

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
  if (d.bulletStyle === "tags") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: center ? "center" : "flex-start", maxWidth: 900 }}>
        {d.bullets.map((b, i) => (
          <span
            key={i}
            style={{
              background: PURPLE, color: "#FFFFFF", borderRadius: 4, padding: "8px 24px 12px",
              fontWeight: 500, fontSize: fs * 1.05, lineHeight: 1.25, whiteSpace: "nowrap",
            }}
          >
            {b}
          </span>
        ))}
      </div>
    );
  }
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

/** الدعوة: سطر واحد = كبسولة بسهم · سطرين (\n) = كبسولتين فوق بعض (ذهبي ثم أبيض) مثل بوستاتنا. */
function Cta({ text, p, onPhoto }: { text: string; p: Palette; onPhoto?: boolean }) {
  const lines = linesOf(text);
  if (lines.length > 1) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        {lines.slice(0, 2).map((l, i) => (
          <div
            key={i}
            style={{
              background: i === 0 ? GOLD : "#FFFFFF", color: i === 0 ? "#FFFFFF" : GOLD, borderRadius: 999,
              padding: "6px 48px 16px", fontWeight: 900, fontSize: 76, lineHeight: 1.15, whiteSpace: "nowrap",
              border: `5px solid ${i === 0 ? GOLD : "#FFFFFF"}`, boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              textShadow: i === 0 ? "0 2px 0 rgba(0,0,0,0.12)" : undefined,
            }}
          >
            {l}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      data-fit="cta"
      data-fit-lines="1"
      style={{
        display: "inline-flex", alignItems: "center", gap: 14, background: p.ctaBg, color: p.ctaFg, borderRadius: 999,
        padding: "20px 52px 24px", fontWeight: 900, fontSize: 42, lineHeight: 1.15, whiteSpace: "nowrap",
        boxShadow: onPhoto ? "0 12px 30px rgba(0,0,0,0.35)" : "0 12px 30px rgba(30,20,51,0.18)",
      }}
    >
      {lines[0] ?? text}
      <span style={{ fontSize: 40, lineHeight: 1 }}>←</span>
    </div>
  );
}

/** التذييل بستايل بوستاتنا: واتساب يمين · أيقونات X/انستقرام/تيك توك + MENUSPAGES يسار. */
function Contact({ p }: { p: Palette }) {
  const circle = (icon: ReactNode) => (
    <span style={{ width: 46, height: 46, borderRadius: "50%", background: p.fg, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {icon}
    </span>
  );
  const glyph = p.fg === "#FFFFFF" ? "#111111" : "#FFFFFF";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%", color: p.fg, gap: 20 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 12, direction: "ltr" }}>
        {circle(<IconWhatsapp size={30} color={glyph} />)}
        <span style={{ fontFamily: FONT_LEXEND, fontWeight: 700, fontSize: 40, letterSpacing: 0.5 }}>{CONTACT.whatsapp}</span>
      </span>
      <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 8, direction: "ltr" }}>
        <span style={{ display: "inline-flex", gap: 10 }}>
          {circle(<IconX size={24} color={glyph} />)}
          {circle(<IconInstagram size={26} color={glyph} />)}
          {circle(<IconTiktok size={26} color={glyph} />)}
        </span>
        <span style={{ fontFamily: FONT_LEXEND, fontWeight: 700, fontSize: 40, lineHeight: 1 }}>{CONTACT.handle}</span>
      </span>
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

function Headline({ d, p, scale = 1, onPhoto, center = true }: { d: AiDesign; p: Palette; scale?: number; onPhoto?: boolean; center?: boolean }) {
  const { w } = DESIGN_SIZE[d.size];
  const base = (d.size === "story" ? 104 : d.size === "portrait" ? 92 : 82) * scale;
  const lines = linesOf(d.headline);
  const longest = Math.max(1, ...lines.map(plainLen));
  // سطور صريحة (\n): المقاس حسب أطول سطر عشان كل سطر يجي بسطر واحد · غير كذا: تصغير حسب الطول
  const size = lines.length > 1
    ? Math.min(base * 1.25, ((w - 170) / (longest * 0.56)))
    : base * (plainLen(d.headline) > 18 ? Math.max(0.58, Math.sqrt(18 / plainLen(d.headline))) : 1);
  const style = d.headlineStyle ?? "plain";
  const bar = PURPLE;
  const fg = style === "marker" ? "#FFFFFF" : p.fg;
  const lineSpan = (l: string, i: number) => {
    const deco: CSSProperties =
      style === "marker"
        ? { background: `linear-gradient(transparent 46%, ${bar} 46%, ${bar} 90%, transparent 90%)`, padding: "0 0.14em" }
        : style === "boxes"
          ? { background: onPhoto || p.fg === "#FFFFFF" ? "#FFFFFF" : PURPLE, color: onPhoto || p.fg === "#FFFFFF" ? INK : "#FFFFFF", padding: "0.02em 0.32em 0.14em", borderRadius: "0.22em" }
          : {};
    return (
      <div key={i} style={{ marginTop: i && style === "boxes" ? "0.14em" : 0 }}>
        <span style={{ ...deco, WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone" } as CSSProperties}>
          <Highlighted text={l} color={style === "boxes" ? PURPLE : p.accent} />
        </span>
      </div>
    );
  };
  return (
    <div
      data-fit="headline"
      style={{
        fontWeight: 900, fontSize: Math.round(size), lineHeight: style === "boxes" ? 1.3 : 1.28, color: fg, letterSpacing: -0.5,
        textAlign: center ? "center" : "right", textShadow: onPhoto && style === "plain" ? "0 4px 24px rgba(0,0,0,0.45)" : undefined,
        ...(lines.length > 1 ? {} : { textWrap: "balance" }),
      } as CSSProperties}
    >
      {lines.map(lineSpan)}
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
        <Headline d={d} p={p} scale={headScale} center={center} />
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
          <Headline d={d} p={pp} scale={0.92} center={center} />
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

// ─── تخطيطات الصور ───────────────────────────────────────────────────────────

const SHADE_RGB: Record<NonNullable<AiDesign["shadeColor"]>, string> = { dark: "14,8,28", purple: "52,26,130", light: "255,255,255" };

/** طبقة التضليل: تغطي جزء من الصورة بتدرّج ناعم (أو كل شي إلا دائرة). */
function ShadeOverlay({ d, focus }: { d: AiDesign; focus: "top" | "bottom" }) {
  const a = d.shade ?? 0.55;
  const c = SHADE_RGB[d.shadeColor ?? "dark"];
  const size = d.shadeSize ?? 55;
  const area = d.shadeArea ?? "auto";
  const col = (k: number) => `rgba(${c},${Math.min(0.96, a * k).toFixed(3)})`;
  let bg: string | null = null;
  if (area === "none") return null;
  if (area === "auto") {
    bg = focus === "top"
      ? `linear-gradient(180deg, ${col(1)} 0%, ${col(0.55)} 34%, ${col(0)} 55%, ${col(0)} 72%, ${col(1.1)} 100%)`
      : `linear-gradient(180deg, ${col(0.6)} 0%, ${col(0)} 22%, ${col(0)} 40%, ${col(1.25)} 72%, ${col(1.4)} 100%)`;
  } else if (area === "full") {
    bg = col(1);
  } else if (area === "spot") {
    bg = `radial-gradient(circle at ${d.spotX ?? 50}% ${d.spotY ?? 60}%, ${col(0)} 0, ${col(0)} ${size * 0.45}%, ${col(1)} ${size}%)`;
  } else {
    const dir = { top: "180deg", bottom: "0deg", right: "270deg", left: "90deg" }[area];
    bg = `linear-gradient(${dir}, ${col(1)} 0%, ${col(1)} ${size * 0.45}%, ${col(0)} ${size}%)`;
    // التذييل (التواصل) تحت دايماً يحتاج أرضية غامقة خفيفة عشان يبان
    if (area !== "bottom" && d.showContact && d.layout !== "photoSplit") {
      bg = `linear-gradient(0deg, rgba(14,8,28,0.7) 0%, rgba(14,8,28,0) 17%), ${bg}`;
    }
  }
  return <div style={{ position: "absolute", inset: 0, background: bg }} />;
}

/** صورة الخلفية (حقيقية مرفوعة أو مولّدة) + التضليل. بدون صورة: خلفية بنفسجية داكنة مؤقتة. */
function PhotoLayer({ d, area = "full", focus }: { d: AiDesign; area?: "full" | "top"; focus: "top" | "bottom" }) {
  const box: CSSProperties = { position: "absolute", left: 0, right: 0, top: 0, bottom: area === "top" ? undefined : 0, height: area === "top" ? "100%" : undefined, overflow: "hidden" };
  const zoom = d.photoZoom ?? 1;
  return (
    <div style={box}>
      {d.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={d.photo}
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            objectPosition: `${d.photoX ?? 50}% ${d.photoY ?? 50}%`, display: "block",
            transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: `${d.photoX ?? 50}% ${d.photoY ?? 50}%`,
          }}
        />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 70% 40%, #5B3FB8 0, #2A1A55 45%, #120A22 100%)` }} />
      )}
      {area === "full" || (d.shadeArea && d.shadeArea !== "auto") ? (
        <ShadeOverlay d={d} focus={focus} />
      ) : (
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, rgba(255,255,255,${(d.shade ?? 0.55) * 0.5}) 0%, rgba(255,255,255,0) 30%)` }} />
      )}
    </div>
  );
}

function PhotoLayout({ d, w, h }: { d: AiDesign; w: number; h: number }) {
  const p = PHOTO_PALETTE;
  const bottom = d.layout === "photoBottom";
  const center = d.align === "center";
  const pad = d.size === "square" ? 64 : 80;
  const gap = d.size === "square" ? 22 : 30;
  const hasFrame = !!d.image && d.imageFrame !== "none";
  const textBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap, alignItems: center ? "center" : "flex-start", width: "100%" }}>
      {d.eyebrow && <Eyebrow text={d.eyebrow} p={p} />}
      <Headline d={d} p={p} onPhoto center={center} />
      {d.subheadline && <div style={{ textShadow: "0 2px 14px rgba(0,0,0,0.5)", textAlign: center ? "center" : "right" }}><Sub d={d} p={p} /></div>}
      {d.stat && <Stat stat={d.stat} p={p} />}
    </div>
  );
  return (
    <div style={{ position: "relative", width: w, height: h }}>
      <PhotoLayer d={d} focus={bottom ? "bottom" : "top"} />
      <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding: `${pad - 10}px ${pad}px ${pad - 16}px`, display: "flex", flexDirection: "column", gap }}>
        <div style={{ alignSelf: "flex-start" }}><LogoBlock p={p} height={d.size === "square" ? 86 : 100} /></div>
        {!bottom && textBlock}
        <div data-flow style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap }}>
          {hasFrame && <ImageBlock d={d} p={p} />}
          {bottom && textBlock}
          <Bullets d={d} p={p} center={center} />
        </div>
        {d.cta && <div style={{ alignSelf: "center" }}><Cta text={d.cta} p={p} onPhoto /></div>}
        {d.showContact && <Contact p={p} />}
      </div>
    </div>
  );
}

/** صورة فوق + لوح فاتح تحت (مثل بوست «لا تشيل همـ»). */
function PhotoSplitLayout({ d, w, h }: { d: AiDesign; w: number; h: number }) {
  const p: Palette = { ...PALETTES.light, bg: "#ECEBF1" };
  const photoH = Math.round(h * (d.size === "story" ? 0.6 : d.size === "portrait" ? 0.52 : 0.48));
  const gap = d.size === "square" ? 18 : 26;
  return (
    <div style={{ position: "relative", width: w, height: h, background: p.bg }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: photoH, overflow: "hidden" }}>
        <PhotoLayer d={d} area="top" focus="top" />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160, background: `linear-gradient(180deg, rgba(236,235,241,0) 0%, ${p.bg} 100%)` }} />
      </div>
      <div style={{ position: "absolute", top: 56, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <LogoBlock p={p} height={d.size === "square" ? 86 : 104} />
      </div>
      <div
        style={{
          position: "absolute", top: photoH - 40, left: 0, right: 0, bottom: 0, padding: "0 80px 56px", boxSizing: "border-box",
          display: "flex", flexDirection: "column", alignItems: "center", gap, textAlign: "center",
        }}
      >
        <div data-flow style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap, width: "100%" }}>
          {d.eyebrow && <Eyebrow text={d.eyebrow} p={p} />}
          <Headline d={d} p={p} scale={0.9} />
          <Bullets d={d} p={p} center />
          {d.subheadline && <Sub d={d} p={p} />}
          {d.stat && <Stat stat={d.stat} p={p} />}
        </div>
        {d.cta && (
          <div style={{ background: GOLD, color: PURPLE, padding: "14px 40px 20px", fontWeight: 900, fontSize: 46, lineHeight: 1.2, borderRadius: 4, maxWidth: "100%" }}>
            {linesOf(d.cta).join(" ")}
          </div>
        )}
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
  if (isPhotoLayout(d.layout)) {
    body = d.layout === "photoSplit" ? <PhotoSplitLayout d={d} w={w} h={h} /> : <PhotoLayout d={d} w={w} h={h} />;
  } else if (d.layout === "split") {
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
      {!isPhotoLayout(d.layout) && <Background d={d} p={p} w={w} h={h} />}
      {!isPhotoLayout(d.layout) && <Decor d={d} p={p} w={w} h={h} />}
      {body}
    </div>
  );
}
