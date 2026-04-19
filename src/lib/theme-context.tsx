"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";

/* ─── Theme Definitions ─── */
export interface ThemeTokens {
  id: string;
  name: string;
  icon: string;
  desc: string;
  // Core
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  // Sidebar
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  // Dims
  cyanDim: string;
  greenDim: string;
  amberDim: string;
  redDim: string;
  purpleDim: string;
  blueDim: string;
  // Extended
  borderHi: string;
  dim: string;
  // Glass
  glassBg: string;
  glassBorder: string;
  glassShadow: string;
  glassInset: string;
  surfaceHover: string;
  surfaceActive: string;
  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
  // Body gradient
  bodyGradient: string;
  // Whether this is a light theme (for calendar picker filter)
  isLight: boolean;
}

export const THEMES: Record<string, ThemeTokens> = {
  current: {
    id: "current",
    name: "الافتراضي",
    icon: "◈",
    desc: "الشكل الحالي — متوازن بين العمق والوضوح",
    background: "#0C1220",
    foreground: "#F1F5F9",
    card: "#162032",
    cardForeground: "#F1F5F9",
    popover: "#162032",
    popoverForeground: "#F1F5F9",
    primary: "#00D4FF",
    primaryForeground: "#07090F",
    secondary: "rgba(22, 32, 50, 0.92)",
    secondaryForeground: "#F1F5F9",
    muted: "rgba(16, 22, 36, 0.9)",
    mutedForeground: "#A0B1C5",
    accent: "rgba(22, 32, 50, 0.9)",
    accentForeground: "#F1F5F9",
    destructive: "#EF4444",
    border: "#283A52",
    input: "rgba(40, 58, 82, 0.6)",
    ring: "rgba(0, 212, 255, 0.32)",
    sidebar: "#101828",
    sidebarForeground: "#F1F5F9",
    sidebarPrimary: "#00D4FF",
    sidebarPrimaryForeground: "#07090F",
    sidebarAccent: "rgba(22, 32, 50, 0.84)",
    sidebarAccentForeground: "#F1F5F9",
    sidebarBorder: "#283A52",
    sidebarRing: "rgba(0, 212, 255, 0.3)",
    cyanDim: "rgba(0, 212, 255, 0.15)",
    greenDim: "rgba(16, 185, 129, 0.15)",
    amberDim: "rgba(245, 158, 11, 0.15)",
    redDim: "rgba(239, 68, 68, 0.15)",
    purpleDim: "rgba(139, 92, 246, 0.15)",
    blueDim: "rgba(125, 166, 255, 0.15)",
    borderHi: "#3A5070",
    dim: "#6B7D94",
    glassBg: "linear-gradient(180deg, #131D2E 0%, #101828 100%)",
    glassBorder: "#283A52",
    glassShadow: "0 2px 12px rgba(0, 0, 0, 0.2)",
    glassInset: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
    surfaceHover: "rgba(255, 255, 255, 0.05)",
    surfaceActive: "rgba(255, 255, 255, 0.08)",
    scrollbarTrack: "#0C1220",
    scrollbarThumb: "rgba(40, 58, 82, 0.8)",
    scrollbarThumbHover: "rgba(40, 58, 82, 1)",
    bodyGradient: "radial-gradient(circle at top right, rgba(0,212,255,0.05), transparent 28%), radial-gradient(circle at top left, rgba(139,92,246,0.03), transparent 26%), linear-gradient(180deg, #101828 0%, #0C1220 45%, #0A0F1A 100%)",
    isLight: false,
  },
  dark: {
    id: "dark",
    name: "الداكن",
    icon: "🌙",
    desc: "الافتراضي — يحمي العينين في بيئات العمل المضيئة والساعات الطويلة",
    background: "#07090F",
    foreground: "#F1F5F9",
    card: "#111827",
    cardForeground: "#F1F5F9",
    popover: "#111827",
    popoverForeground: "#F1F5F9",
    primary: "#00D4FF",
    primaryForeground: "#07090F",
    secondary: "rgba(17, 24, 39, 0.88)",
    secondaryForeground: "#F1F5F9",
    muted: "rgba(13, 17, 23, 0.9)",
    mutedForeground: "#94A3B8",
    accent: "rgba(17, 24, 39, 0.9)",
    accentForeground: "#F1F5F9",
    destructive: "#EF4444",
    border: "#1E2A3A",
    input: "rgba(30, 42, 58, 0.6)",
    ring: "rgba(0, 212, 255, 0.32)",
    sidebar: "#0D1117",
    sidebarForeground: "#F1F5F9",
    sidebarPrimary: "#00D4FF",
    sidebarPrimaryForeground: "#07090F",
    sidebarAccent: "rgba(17, 24, 39, 0.84)",
    sidebarAccentForeground: "#F1F5F9",
    sidebarBorder: "#1E2A3A",
    sidebarRing: "rgba(0, 212, 255, 0.3)",
    cyanDim: "rgba(0, 212, 255, 0.14)",
    greenDim: "rgba(16, 185, 129, 0.14)",
    amberDim: "rgba(245, 158, 11, 0.14)",
    redDim: "rgba(239, 68, 68, 0.14)",
    purpleDim: "rgba(139, 92, 246, 0.14)",
    blueDim: "rgba(125, 166, 255, 0.14)",
    borderHi: "#2E3F55",
    dim: "#475569",
    glassBg: "linear-gradient(180deg, #0D1117 0%, #0B0F14 100%)",
    glassBorder: "#1E2A3A",
    glassShadow: "0 2px 12px rgba(0, 0, 0, 0.3)",
    glassInset: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
    surfaceHover: "rgba(255, 255, 255, 0.03)",
    surfaceActive: "rgba(255, 255, 255, 0.06)",
    scrollbarTrack: "#07090F",
    scrollbarThumb: "rgba(30, 42, 58, 0.8)",
    scrollbarThumbHover: "rgba(30, 42, 58, 1)",
    bodyGradient: "radial-gradient(circle at top right, rgba(0,212,255,0.06), transparent 24%), radial-gradient(circle at top left, rgba(139,92,246,0.04), transparent 22%), linear-gradient(180deg, #0D1117 0%, #07090F 45%, #050810 100%)",
    isLight: false,
  },
  light: {
    id: "light",
    name: "الأبيض",
    icon: "☀️",
    desc: "نظيف وصريح — مثالي للعروض التقديمية وبيئات العمل الساطعة",
    background: "#F1F5F9",
    foreground: "#0F172A",
    card: "#FFFFFF",
    cardForeground: "#0F172A",
    popover: "#FFFFFF",
    popoverForeground: "#0F172A",
    primary: "#0284C7",
    primaryForeground: "#FFFFFF",
    secondary: "rgba(241, 245, 249, 0.92)",
    secondaryForeground: "#0F172A",
    muted: "rgba(241, 245, 249, 0.9)",
    mutedForeground: "#475569",
    accent: "rgba(241, 245, 249, 0.9)",
    accentForeground: "#0F172A",
    destructive: "#DC2626",
    border: "#E2E8F0",
    input: "rgba(226, 232, 240, 0.6)",
    ring: "rgba(2, 132, 199, 0.32)",
    sidebar: "#FFFFFF",
    sidebarForeground: "#0F172A",
    sidebarPrimary: "#0284C7",
    sidebarPrimaryForeground: "#FFFFFF",
    sidebarAccent: "rgba(241, 245, 249, 0.84)",
    sidebarAccentForeground: "#0F172A",
    sidebarBorder: "#E2E8F0",
    sidebarRing: "rgba(2, 132, 199, 0.3)",
    cyanDim: "rgba(2, 132, 199, 0.10)",
    greenDim: "rgba(5, 150, 105, 0.10)",
    amberDim: "rgba(217, 119, 6, 0.10)",
    redDim: "rgba(220, 38, 38, 0.10)",
    purpleDim: "rgba(124, 58, 237, 0.10)",
    blueDim: "rgba(59, 130, 246, 0.10)",
    borderHi: "#CBD5E1",
    dim: "#94A3B8",
    glassBg: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
    glassBorder: "#E2E8F0",
    glassShadow: "0 2px 12px rgba(0, 0, 0, 0.06)",
    glassInset: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
    surfaceHover: "rgba(0, 0, 0, 0.03)",
    surfaceActive: "rgba(0, 0, 0, 0.06)",
    scrollbarTrack: "#F1F5F9",
    scrollbarThumb: "rgba(203, 213, 225, 0.8)",
    scrollbarThumbHover: "rgba(203, 213, 225, 1)",
    bodyGradient: "radial-gradient(circle at top right, rgba(2,132,199,0.04), transparent 28%), radial-gradient(circle at top left, rgba(124,58,237,0.03), transparent 26%), linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 45%, #E8EDF4 100%)",
    isLight: true,
  },
  slate: {
    id: "slate",
    name: "الصخري",
    icon: "🌃",
    desc: "داكن محترف — عمق أعلى وتباين أقوى للتفاصيل الدقيقة",
    background: "#0F1923",
    foreground: "#F1F5F9",
    card: "#1C2A3F",
    cardForeground: "#F1F5F9",
    popover: "#1C2A3F",
    popoverForeground: "#F1F5F9",
    primary: "#38BDF8",
    primaryForeground: "#0F1923",
    secondary: "rgba(28, 42, 63, 0.92)",
    secondaryForeground: "#F1F5F9",
    muted: "rgba(22, 32, 50, 0.9)",
    mutedForeground: "#94A3B8",
    accent: "rgba(28, 42, 63, 0.9)",
    accentForeground: "#F1F5F9",
    destructive: "#F87171",
    border: "#263548",
    input: "rgba(38, 53, 72, 0.6)",
    ring: "rgba(56, 189, 248, 0.32)",
    sidebar: "#162032",
    sidebarForeground: "#F1F5F9",
    sidebarPrimary: "#38BDF8",
    sidebarPrimaryForeground: "#0F1923",
    sidebarAccent: "rgba(28, 42, 63, 0.84)",
    sidebarAccentForeground: "#F1F5F9",
    sidebarBorder: "#263548",
    sidebarRing: "rgba(56, 189, 248, 0.3)",
    cyanDim: "rgba(56, 189, 248, 0.15)",
    greenDim: "rgba(52, 211, 153, 0.15)",
    amberDim: "rgba(251, 191, 36, 0.15)",
    redDim: "rgba(248, 113, 113, 0.15)",
    purpleDim: "rgba(167, 139, 250, 0.15)",
    blueDim: "rgba(125, 166, 255, 0.15)",
    borderHi: "#3A5070",
    dim: "#475569",
    glassBg: "linear-gradient(180deg, #1C2A3F 0%, #162032 100%)",
    glassBorder: "#263548",
    glassShadow: "0 2px 12px rgba(0, 0, 0, 0.25)",
    glassInset: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
    surfaceHover: "rgba(255, 255, 255, 0.04)",
    surfaceActive: "rgba(255, 255, 255, 0.07)",
    scrollbarTrack: "#0F1923",
    scrollbarThumb: "rgba(38, 53, 72, 0.8)",
    scrollbarThumbHover: "rgba(38, 53, 72, 1)",
    bodyGradient: "radial-gradient(circle at top right, rgba(56,189,248,0.05), transparent 28%), radial-gradient(circle at top left, rgba(167,139,250,0.04), transparent 26%), linear-gradient(180deg, #162032 0%, #0F1923 45%, #0B1219 100%)",
    isLight: false,
  },
  royal: {
    id: "royal",
    name: "الملكي",
    icon: "👑",
    desc: "ذهبي فاخر — أناقة ملكية بلمسات ذهبية ودرجات العنبر الداكن",
    background: "#0A0A14",
    foreground: "#F5F0E8",
    card: "#14142A",
    cardForeground: "#F5F0E8",
    popover: "#14142A",
    popoverForeground: "#F5F0E8",
    primary: "#D4A853",
    primaryForeground: "#0A0A14",
    secondary: "rgba(20, 20, 42, 0.92)",
    secondaryForeground: "#F5F0E8",
    muted: "rgba(14, 14, 28, 0.9)",
    mutedForeground: "#A89B8C",
    accent: "rgba(20, 20, 42, 0.9)",
    accentForeground: "#F5F0E8",
    destructive: "#E85D5D",
    border: "#2A2540",
    input: "rgba(42, 37, 64, 0.6)",
    ring: "rgba(212, 168, 83, 0.35)",
    sidebar: "#0E0E1C",
    sidebarForeground: "#F5F0E8",
    sidebarPrimary: "#D4A853",
    sidebarPrimaryForeground: "#0A0A14",
    sidebarAccent: "rgba(20, 20, 42, 0.84)",
    sidebarAccentForeground: "#F5F0E8",
    sidebarBorder: "#2A2540",
    sidebarRing: "rgba(212, 168, 83, 0.3)",
    cyanDim: "rgba(212, 168, 83, 0.12)",
    greenDim: "rgba(80, 200, 120, 0.12)",
    amberDim: "rgba(212, 168, 83, 0.15)",
    redDim: "rgba(232, 93, 93, 0.12)",
    purpleDim: "rgba(160, 120, 240, 0.12)",
    blueDim: "rgba(100, 140, 220, 0.12)",
    borderHi: "#3D3560",
    dim: "#6B6080",
    glassBg: "linear-gradient(180deg, #14142A 0%, #0E0E1C 100%)",
    glassBorder: "#2A2540",
    glassShadow: "0 2px 16px rgba(212, 168, 83, 0.08)",
    glassInset: "inset 0 1px 0 rgba(212, 168, 83, 0.06)",
    surfaceHover: "rgba(212, 168, 83, 0.05)",
    surfaceActive: "rgba(212, 168, 83, 0.08)",
    scrollbarTrack: "#0A0A14",
    scrollbarThumb: "rgba(42, 37, 64, 0.8)",
    scrollbarThumbHover: "rgba(42, 37, 64, 1)",
    bodyGradient: "radial-gradient(circle at top right, rgba(212,168,83,0.07), transparent 30%), radial-gradient(circle at bottom left, rgba(160,120,240,0.04), transparent 30%), linear-gradient(180deg, #0E0E1C 0%, #0A0A14 45%, #080810 100%)",
    isLight: false,
  },
  emerald: {
    id: "emerald",
    name: "الزمردي",
    icon: "💎",
    desc: "زمردي أنيق — درجات الزمرد والفيروز مع عمق مخملي فاخر",
    background: "#060F12",
    foreground: "#E8F5F0",
    card: "#0C1F24",
    cardForeground: "#E8F5F0",
    popover: "#0C1F24",
    popoverForeground: "#E8F5F0",
    primary: "#34D399",
    primaryForeground: "#060F12",
    secondary: "rgba(12, 31, 36, 0.92)",
    secondaryForeground: "#E8F5F0",
    muted: "rgba(8, 20, 24, 0.9)",
    mutedForeground: "#7BAEA0",
    accent: "rgba(12, 31, 36, 0.9)",
    accentForeground: "#E8F5F0",
    destructive: "#F87171",
    border: "#163A3A",
    input: "rgba(22, 58, 58, 0.6)",
    ring: "rgba(52, 211, 153, 0.35)",
    sidebar: "#081618",
    sidebarForeground: "#E8F5F0",
    sidebarPrimary: "#34D399",
    sidebarPrimaryForeground: "#060F12",
    sidebarAccent: "rgba(12, 31, 36, 0.84)",
    sidebarAccentForeground: "#E8F5F0",
    sidebarBorder: "#163A3A",
    sidebarRing: "rgba(52, 211, 153, 0.3)",
    cyanDim: "rgba(52, 211, 153, 0.12)",
    greenDim: "rgba(52, 211, 153, 0.15)",
    amberDim: "rgba(251, 191, 36, 0.12)",
    redDim: "rgba(248, 113, 113, 0.12)",
    purpleDim: "rgba(167, 139, 250, 0.12)",
    blueDim: "rgba(96, 165, 250, 0.12)",
    borderHi: "#1E5050",
    dim: "#4A7A70",
    glassBg: "linear-gradient(180deg, #0C1F24 0%, #081618 100%)",
    glassBorder: "#163A3A",
    glassShadow: "0 2px 16px rgba(52, 211, 153, 0.06)",
    glassInset: "inset 0 1px 0 rgba(52, 211, 153, 0.06)",
    surfaceHover: "rgba(52, 211, 153, 0.05)",
    surfaceActive: "rgba(52, 211, 153, 0.08)",
    scrollbarTrack: "#060F12",
    scrollbarThumb: "rgba(22, 58, 58, 0.8)",
    scrollbarThumbHover: "rgba(22, 58, 58, 1)",
    bodyGradient: "radial-gradient(circle at top right, rgba(52,211,153,0.06), transparent 30%), radial-gradient(circle at bottom left, rgba(20,184,166,0.04), transparent 30%), linear-gradient(180deg, #081618 0%, #060F12 45%, #040A0C 100%)",
    isLight: false,
  },
};

/* ─── Apply theme to :root ─── */
function applyTheme(theme: ThemeTokens) {
  const root = document.documentElement;
  const s = root.style;

  s.setProperty("--background", theme.background);
  s.setProperty("--foreground", theme.foreground);
  s.setProperty("--card", theme.card);
  s.setProperty("--card-foreground", theme.cardForeground);
  s.setProperty("--popover", theme.popover);
  s.setProperty("--popover-foreground", theme.popoverForeground);
  s.setProperty("--primary", theme.primary);
  s.setProperty("--primary-foreground", theme.primaryForeground);
  s.setProperty("--secondary", theme.secondary);
  s.setProperty("--secondary-foreground", theme.secondaryForeground);
  s.setProperty("--muted", theme.muted);
  s.setProperty("--muted-foreground", theme.mutedForeground);
  s.setProperty("--accent", theme.accent);
  s.setProperty("--accent-foreground", theme.accentForeground);
  s.setProperty("--destructive", theme.destructive);
  s.setProperty("--border", theme.border);
  s.setProperty("--input", theme.input);
  s.setProperty("--ring", theme.ring);
  s.setProperty("--sidebar", theme.sidebar);
  s.setProperty("--sidebar-foreground", theme.sidebarForeground);
  s.setProperty("--sidebar-primary", theme.sidebarPrimary);
  s.setProperty("--sidebar-primary-foreground", theme.sidebarPrimaryForeground);
  s.setProperty("--sidebar-accent", theme.sidebarAccent);
  s.setProperty("--sidebar-accent-foreground", theme.sidebarAccentForeground);
  s.setProperty("--sidebar-border", theme.sidebarBorder);
  s.setProperty("--sidebar-ring", theme.sidebarRing);
  s.setProperty("--cyan-dim", theme.cyanDim);
  s.setProperty("--green-dim", theme.greenDim);
  s.setProperty("--amber-dim", theme.amberDim);
  s.setProperty("--red-dim", theme.redDim);
  s.setProperty("--purple-dim", theme.purpleDim);
  s.setProperty("--blue-dim", theme.blueDim);
  s.setProperty("--border-hi", theme.borderHi);
  s.setProperty("--dim", theme.dim);
  s.setProperty("--glass-bg", theme.glassBg);
  s.setProperty("--glass-border", theme.glassBorder);
  s.setProperty("--glass-shadow", theme.glassShadow);
  s.setProperty("--glass-inset", theme.glassInset);
  s.setProperty("--surface-hover", theme.surfaceHover);
  s.setProperty("--surface-active", theme.surfaceActive);
  s.setProperty("--scrollbar-track", theme.scrollbarTrack);
  s.setProperty("--scrollbar-thumb", theme.scrollbarThumb);
  s.setProperty("--scrollbar-thumb-hover", theme.scrollbarThumbHover);

  // Body gradient
  document.body.style.backgroundImage = theme.bodyGradient;

  // Calendar picker filter
  root.setAttribute("data-theme-light", theme.isLight ? "true" : "false");
}

/* ─── Context ─── */
interface ThemeContextValue {
  themeId: string;
  theme: ThemeTokens;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeId: "current",
  theme: THEMES.current,
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "cc:theme";

export function CCThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState("current");

  // On mount, read from localStorage and apply
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const id = stored && THEMES[stored] ? stored : "current";
    setThemeId(id);
    applyTheme(THEMES[id]);
  }, []);

  const setTheme = useCallback((id: string) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    localStorage.setItem(STORAGE_KEY, id);
    applyTheme(THEMES[id]);
  }, []);

  return (
    <ThemeContext.Provider value={{ themeId, theme: THEMES[themeId] || THEMES.current, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
