"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ImageSlot, PostData } from "@/lib/package-posts/types";
import { FONT_LEXEND, FONT_TAJAWAL } from "../fonts";

// ─── ألوان الهوية ─────────────────────────────────────────────────────────────
export const INK = "#1E1433";
export const INK_2 = "#3D3452";
export const LIGHT_BG = "#F4F3F7";

/** بنفسجي فاتح للكروت مشتق من البنفسجي المختار (يساوي ‎#E4DFF1 مع البنفسجي الافتراضي). */
export const lightPurple = (purple: string) => `color-mix(in srgb, ${purple} 15%, #F2F0F8)`;

/** جذر كل قالب: مقاس ثابت بالبكسل + RTL + الخط. */
export function PosterRoot({
  w, h, bg, children, style,
}: { w: number; h: number; bg?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      dir="rtl"
      lang="ar"
      data-poster
      style={{
        position: "relative",
        width: w,
        height: h,
        overflow: "hidden",
        background: bg ?? LIGHT_BG,
        color: INK,
        fontFamily: FONT_TAJAWAL,
        textAlign: "right",
        lineHeight: 1.35,
        WebkitFontSmoothing: "antialiased",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** الخلفية الفاتحة: نقاط خفيفة + شريط أبيض شفاف مائل للزينة. */
export function DotBackground({ bandTop = 420 }: { bandTop?: number }) {
  return (
    <>
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(#DAD6E4 1.6px, transparent 1.6px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        style={{
          position: "absolute", left: -300, top: bandTop, width: 1700, height: 300,
          background: "rgba(255,255,255,0.6)", transform: "rotate(-24deg)", transformOrigin: "center",
        }}
      />
    </>
  );
}

// ─── اللوقو ──────────────────────────────────────────────────────────────────

/** أيقونة اللوقو: شبكة 2×2 بإطار بنفسجي سميك، والمربع السفلي فيه ذيل ونقطتين. */
export function LogoMark({ size, purple, dot }: { size: number; purple: string; dot: string }) {
  // مربع بإطار: المستطيل الخارجي ناقص الداخلي (evenodd)
  const frame = (x: number, y: number) => `M${x} ${y}h44v44h-44z M${x + 10} ${y + 10}v24h24v-24z`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: "block", flexShrink: 0 }}>
      <path fillRule="evenodd" fill={purple} d={`${frame(0, 0)} ${frame(56, 0)} ${frame(0, 56)}`} />
      {/* المربع السفلي الأيسر في الرسم (السفلي الأيمن بصرياً في اللوقو): ذيل فقاعة عند الزاوية */}
      <path
        fillRule="evenodd"
        fill={purple}
        d="M56 56h44v44h-44z M66 66v24h24v-24z"
      />
      <path fill={purple} d="M56 89.5V100H47z" />
      <rect x="69" y="68" width="7" height="7" fill={dot} />
      <rect x="78.5" y="77.5" width="7" height="7" fill={dot} />
    </svg>
  );
}

/** اللوقو الكامل: «قائمة الطلبات» + شريط MENU ذهبي، والأيقونة يمينها. */
export function Logo({
  height = 120, purple, gold, light = false,
}: { height?: number; purple: string; gold: string; light?: boolean }) {
  const h = height;
  return (
    <div dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: h * 0.14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: h * 0.06 }}>
        <div
          dir="rtl"
          style={{
            fontFamily: FONT_TAJAWAL, fontWeight: 700, fontSize: h * 0.44, lineHeight: 1,
            color: light ? "#FFFFFF" : INK, whiteSpace: "nowrap", textAlign: "center", paddingTop: h * 0.04,
          }}
        >
          قائمة الطلبات
        </div>
        <div
          style={{
            background: gold, borderRadius: h * 0.06, height: h * 0.34,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: `0 ${h * 0.14}px`, fontFamily: FONT_LEXEND, fontWeight: 600,
            fontSize: h * 0.24, color: INK, lineHeight: 1,
          }}
        >
          {"MENU".split("").map((c) => <span key={c}>{c}</span>)}
        </div>
      </div>
      <LogoMark size={h} purple={light ? "#FFFFFF" : purple} dot={gold} />
    </div>
  );
}

// ─── أيقونات خطية ─────────────────────────────────────────────────────────────

const svgProps = (size: number, color: string, sw = 1.8) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color,
  strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  style: { display: "block", flexShrink: 0 },
});

export const IconWhatsapp = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg {...svgProps(size, color)}>
    <path d="M3.5 20.5l1.3-4.3A8.6 8.6 0 1 1 8 19.3z" />
    <path d="M9.2 8.6c.2-.5.5-.6.8-.6h.5c.2 0 .4.1.5.4l.6 1.5c.1.2 0 .5-.1.6l-.5.6c.6 1.2 1.6 2.2 2.8 2.8l.6-.5c.2-.2.4-.2.6-.1l1.5.6c.3.1.4.3.4.5v.5c0 .4-.2.7-.6.9-.9.4-2.3.3-4.1-1-1.6-1.2-2.6-2.6-3-3.9-.2-.8 0-1.5 0-1.9z" strokeWidth={1.4} />
  </svg>
);

export const IconInstagram = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg {...svgProps(size, color)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="0.6" fill={color} />
  </svg>
);

export const IconX = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg {...svgProps(size, color)}>
    <path d="M4.5 4h4.2l10.8 16h-4.2z" />
    <path d="M19.2 4l-6.1 7M4.8 20l6.1-7" />
  </svg>
);

export const IconTiktok = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg {...svgProps(size, color)}>
    <path d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3" />
    <path d="M13.5 3.5c.4 2.6 2.2 4.4 5 4.7" />
  </svg>
);

export const IconPhone = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg {...svgProps(size, color)}>
    <path d="M5 4h3.5l1.6 4-2.1 1.3a11 11 0 0 0 6.7 6.7l1.3-2.1 4 1.6V19a1.6 1.6 0 0 1-1.7 1.6A15.5 15.5 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4z" />
  </svg>
);

export const IconCheck = ({ size = 24, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg {...svgProps(size, color, 3.2)}>
    <path d="M4.5 12.5l4.8 4.8L19.5 7" />
  </svg>
);

/** أيقونة داخل إطار دائري. */
export function Ring({ size, color, children, fill }: { size: number; color: string; children: ReactNode; fill?: string }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", border: `${Math.max(2, size * 0.06)}px solid ${color}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        background: fill ?? "transparent", boxSizing: "border-box",
      }}
    >
      {children}
    </span>
  );
}

// ─── نص بتمييز [[...]] ─────────────────────────────────────────────────────

/** يحوّل «نص [[مميز]] نص» إلى عناصر، والجزء المميز باللون المعطى. */
export function Highlighted({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\[\[[\s\S]*?\]\])/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("[[") && p.endsWith("]]") ? (
          <span key={i} style={{ color }}>{p.slice(2, -2)}</span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

// ─── خانة صورة ───────────────────────────────────────────────────────────────

/** صورة بموضع وتكبير قابلين للضبط. لو الصورة مو موجودة يظهر صندوق رمادي باسم الملف. */
export function ImageBox({
  slot, w, h, style, radius = 0, placeholderLabel,
}: {
  slot?: ImageSlot; w: number; h: number; style?: CSSProperties; radius?: number; placeholderLabel?: string;
}) {
  const src = slot?.src ?? "";
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;
  const imgRef = useRef<HTMLImageElement>(null);
  // الصورة ممكن تفشل قبل ما React يربط onError (أول تحميل للصفحة) — نتحقق بعد التركيب
  useEffect(() => {
    const el = imgRef.current;
    if (!el || !el.complete || el.naturalWidth > 0) return;
    const t = setTimeout(() => setFailedSrc(src), 0);
    return () => clearTimeout(t);
  }, [src]);
  const label = placeholderLabel ?? (src.startsWith("data:") ? "صورة" : src.split("/").pop() || "صورة");

  return (
    <div style={{ width: w, height: h, position: "relative", overflow: "hidden", borderRadius: radius, flexShrink: 0, ...style }}>
      {failed ? (
        <div
          data-placeholder
          style={{
            position: "absolute", inset: 0, background: "#D9D6E0", border: "4px dashed #A9A3B8",
            borderRadius: radius, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#6B6480", fontFamily: FONT_LEXEND, fontWeight: 600, fontSize: Math.max(18, Math.min(34, w / 12)),
            textAlign: "center", padding: 16, boxSizing: "border-box", direction: "ltr",
          }}
        >
          {label}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={src}
          alt=""
          crossOrigin={src.startsWith("http") ? "anonymous" : undefined}
          onError={() => setFailedSrc(src)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: slot?.fit ?? "contain",
            objectPosition: `${slot?.x ?? 50}% ${slot?.y ?? 50}%`,
            transform: `scale(${slot?.zoom ?? 1})`,
            transformOrigin: `${slot?.x ?? 50}% ${slot?.y ?? 50}%`,
            display: "block",
          }}
        />
      )}
    </div>
  );
}

// ─── التذييل ─────────────────────────────────────────────────────────────────

/** أيقونات الحسابات الأربعة بإطار دائري. */
export function SocialIcons({ size, color, gap }: { size: number; color: string; gap: number }) {
  const inner = size * 0.56;
  return (
    <span dir="ltr" style={{ display: "inline-flex", gap, alignItems: "center" }}>
      <Ring size={size} color={color}><IconWhatsapp size={inner} color={color} /></Ring>
      <Ring size={size} color={color}><IconInstagram size={inner} color={color} /></Ring>
      <Ring size={size} color={color}><IconX size={inner} color={color} /></Ring>
      <Ring size={size} color={color}><IconTiktok size={inner} color={color} /></Ring>
    </span>
  );
}

/** رقم/حساب بخط Lexend واتجاه LTR. */
export function Latin({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span dir="ltr" style={{ fontFamily: FONT_LEXEND, fontWeight: 600, unicodeBidi: "isolate", whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  );
}

export function FooterStacked({ post }: { post: PostData }) {
  const { purple } = post.colors;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Ring size={62} color={purple}><IconWhatsapp size={36} color={purple} /></Ring>
        <Latin style={{ fontSize: 44, color: INK }}>{post.contact.whatsapp}</Latin>
      </div>
      <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <SocialIcons size={62} color={purple} gap={12} />
        <Latin style={{ fontSize: 44, color: INK }}>{post.contact.handle}</Latin>
      </div>
    </div>
  );
}

export function FooterInline({ post }: { post: PostData }) {
  const { purple } = post.colors;
  return (
    <div dir="ltr" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 34 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Ring size={54} color={purple}><IconWhatsapp size={31} color={purple} /></Ring>
        <Latin style={{ fontSize: 34, color: INK }}>{post.contact.whatsapp}</Latin>
      </div>
      <span style={{ width: 3, height: 44, background: "#CFC9DC", borderRadius: 2 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <SocialIcons size={54} color={purple} gap={8} />
        <Latin style={{ fontSize: 34, color: INK }}>{post.contact.handle}</Latin>
      </div>
    </div>
  );
}
