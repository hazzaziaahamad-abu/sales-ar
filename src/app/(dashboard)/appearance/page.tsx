"use client";

import { useState } from "react";
import { useTheme, THEMES, type ThemeTokens } from "@/lib/theme-context";
import { Check, Palette, Type, Layers } from "lucide-react";

/* ─── Mini Preview ─── */
function ThemeMiniPreview({ theme }: { theme: ThemeTokens }) {
  const bars = [40, 75, 55, 90, 65, 80];
  const mx = Math.max(...bars);
  const colors = [theme.primary, "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#EF4444"];

  return (
    <div
      className="overflow-hidden"
      style={{
        background: theme.background,
        borderRadius: "14px 14px 0 0",
        padding: 10,
        height: 152,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", gap: 6, height: "100%" }}>
        {/* Mini sidebar */}
        <div
          style={{
            width: 36,
            background: theme.sidebar,
            borderRadius: 8,
            border: `1px solid ${theme.border}`,
            padding: "6px 5px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: `linear-gradient(135deg, ${theme.primary}, #8B5CF6)`,
              marginBottom: 4,
              flexShrink: 0,
            }}
          />
          {[theme.primary, theme.dim, theme.dim, theme.dim, theme.dim].map((c, i) => (
            <div
              key={i}
              style={{
                height: 5,
                borderRadius: 3,
                background: i === 0 ? c : `${c}35`,
                flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Mini content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          {/* Topbar */}
          <div
            style={{
              height: 16,
              background: theme.card,
              borderRadius: 5,
              border: `1px solid ${theme.border}`,
              display: "flex",
              alignItems: "center",
              padding: "0 6px",
              gap: 3,
              flexShrink: 0,
            }}
          >
            <div style={{ width: 26, height: 4, borderRadius: 2, background: theme.primary }} />
            <div style={{ flex: 1 }} />
            <div style={{ width: 14, height: 4, borderRadius: 2, background: `${theme.dim}50` }} />
            <div style={{ width: 14, height: 4, borderRadius: 2, background: `${theme.dim}50` }} />
          </div>

          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, flexShrink: 0 }}>
            {[theme.primary, "#10B981", "#F59E0B", "#8B5CF6"].map((c, i) => (
              <div
                key={i}
                style={{
                  background: theme.card,
                  borderRadius: 4,
                  border: `1px solid ${c}50`,
                  padding: "4px 5px",
                }}
              >
                <div style={{ height: 7, width: "60%", borderRadius: 2, background: c, marginBottom: 2 }} />
                <div style={{ height: 3, borderRadius: 2, background: `${theme.dim}35` }} />
              </div>
            ))}
          </div>

          {/* Mini bar chart */}
          <div
            style={{
              flex: 1,
              background: theme.card,
              borderRadius: 6,
              border: `1px solid ${theme.border}`,
              padding: "5px 6px 3px",
              display: "flex",
              alignItems: "flex-end",
              gap: 3,
            }}
          >
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: "3px 3px 0 0",
                  background: colors[i],
                  height: `${Math.round((h / mx) * 100)}%`,
                  opacity: 0.9,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Palette Section ─── */
function PaletteSection({ theme }: { theme: ThemeTokens }) {
  const items = [
    { label: "خلفية الصفحة", color: theme.background },
    { label: "البطاقات", color: theme.card },
    { label: "الحدود", color: theme.border },
    { label: "الأساسي", color: theme.primary },
    { label: "النص", color: theme.foreground },
    { label: "نص خافت", color: theme.mutedForeground },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((x, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card/50 px-3 py-2.5 transition-colors hover:border-border-hi"
        >
          <div
            className="h-8 w-8 shrink-0 rounded-lg border border-border"
            style={{ background: x.color, boxShadow: `0 2px 8px ${x.color}30` }}
          />
          <div>
            <div className="text-xs font-semibold text-foreground">{x.label}</div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{x.color}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AppearancePage() {
  const { themeId, setTheme } = useTheme();
  const [hover, setHover] = useState<string | null>(null);
  const themes = Object.values(THEMES);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="glass-surface relative overflow-hidden rounded-[14px] p-6 text-center sm:p-8">
        <div
          className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full opacity-[0.06]"
          style={{ background: "var(--primary)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full opacity-[0.07]"
          style={{ background: "#8B5CF6" }}
        />
        <div className="relative">
          <Palette className="mx-auto mb-4 h-10 w-10 text-primary" />
          <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">تخصيص مظهر المنصة</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            اختر الشكل الذي يناسب بيئة عملك — التغيير فوري ويُحفظ تلقائياً
          </p>
        </div>
      </div>

      {/* Theme Cards */}
      <div>
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <Layers className="h-4 w-4" />
          اختر شكل المنصة
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {themes.map((theme) => {
            const isActive = theme.id === themeId;
            const isHover = hover === theme.id;

            return (
              <div
                key={theme.id}
                onMouseEnter={() => setHover(theme.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setTheme(theme.id)}
                className="cursor-pointer overflow-hidden rounded-[14px] transition-all duration-200"
                style={{
                  border: `2px solid ${isActive ? "var(--primary)" : isHover ? "var(--border-hi)" : "var(--border)"}`,
                  background: isActive ? "var(--primary-foreground)" : "var(--card)",
                  transform: isHover && !isActive ? "translateY(-4px)" : "translateY(0)",
                  boxShadow: isActive
                    ? "0 0 0 1px rgba(var(--primary), 0.3), 0 12px 32px rgba(0,0,0,0.2)"
                    : isHover
                    ? "0 8px 24px rgba(0,0,0,0.2)"
                    : "none",
                }}
              >
                {/* Mini preview */}
                <ThemeMiniPreview theme={theme} />

                {/* Info footer */}
                <div
                  className="border-t p-3.5"
                  style={{
                    borderColor: theme.border,
                    background: theme.card,
                  }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{theme.icon}</span>
                      <span className="text-sm font-extrabold" style={{ color: theme.foreground }}>
                        {theme.name}
                      </span>
                    </div>
                    {isActive ? (
                      <span
                        className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                        style={{
                          background: `${theme.primary}20`,
                          color: theme.primary,
                          border: `1px solid ${theme.primary}40`,
                        }}
                      >
                        <Check className="h-3 w-3" />
                        مُفعَّل
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: `${theme.border}50`,
                          color: theme.dim,
                          border: `1px solid ${theme.border}`,
                        }}
                      >
                        تطبيق
                      </span>
                    )}
                  </div>
                  <p className="mb-2.5 text-[11px] leading-relaxed" style={{ color: theme.dim }}>
                    {theme.desc}
                  </p>
                  {/* Color dots */}
                  <div className="flex gap-1.5">
                    {[theme.primary, "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#EF4444", theme.foreground].map(
                      (c, i) => (
                        <div
                          key={i}
                          className="transition-transform duration-150"
                          style={{
                            width: i === 6 ? 14 : 10,
                            height: i === 6 ? 14 : 10,
                            borderRadius: "50%",
                            background: c,
                            border: `2px solid ${theme.border}`,
                            flexShrink: 0,
                            transform: isHover ? "scale(1.15)" : "scale(1)",
                          }}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Palette */}
      <div className="cc-card rounded-[14px] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <Palette className="h-4 w-4 text-primary" />
          لوحة الألوان الحالية — {THEMES[themeId]?.name || "الافتراضي"}
        </div>
        <PaletteSection theme={THEMES[themeId] || THEMES.current} />
      </div>

      {/* Typography Preview */}
      <div className="cc-card rounded-[14px] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <Type className="h-4 w-4 text-primary" />
          معاينة الخطوط والأحجام
        </div>
        <div className="flex flex-col gap-1.5">
          {[
            { label: "عنوان رئيسي", size: 20, weight: 800, color: "text-foreground", text: "نظرة عامة على أداء المنصة" },
            { label: "عنوان قسم", size: 15, weight: 700, color: "text-foreground", text: "مؤشرات الأداء الرئيسية — KPIs" },
            { label: "نص أساسي", size: 13, weight: 400, color: "text-foreground", text: "إجمالي الإيرادات هذا الشهر محسوب من جميع المصادر" },
            { label: "نص ثانوي", size: 12, weight: 600, color: "text-muted-foreground", text: "آخر تحديث: منذ دقيقتين · مزامنة تلقائية" },
            { label: "أرقام مالية", size: 18, weight: 800, color: "text-cc-green", text: "3,400,000 ر.س", mono: true },
            { label: "نص خافت", size: 11, weight: 400, color: "text-dim", text: "ابدأ بإدخال بيانات للعرض هنا..." },
          ].map((x, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[10px] border border-border bg-card/50 px-3.5 py-2.5"
            >
              <div className="w-20 shrink-0 text-[10px] text-muted-foreground">{x.label}</div>
              <div className="h-5 w-px shrink-0 bg-border" />
              <div
                className={`${x.color} ${"mono" in x ? "font-mono" : ""}`}
                style={{ fontSize: x.size, fontWeight: x.weight, lineHeight: 1.3 }}
              >
                {x.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Components Preview */}
      <div className="cc-card rounded-[14px] p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
          <Layers className="h-4 w-4 text-primary" />
          معاينة المكونات
        </div>
        <div className="space-y-5">
          {/* Buttons */}
          <div>
            <div className="mb-2 text-[11px] text-muted-foreground">الأزرار</div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "الإجراء الرئيسي", color: "var(--primary)" },
                { label: "نجاح / إضافة", color: "#10B981" },
                { label: "تحذير", color: "#F59E0B" },
                { label: "حذف / خطر", color: "#EF4444" },
                { label: "ثانوي", color: "#8B5CF6" },
              ].map((b, i) => (
                <button
                  key={i}
                  className="rounded-[9px] px-4 py-1.5 text-xs font-bold"
                  style={{
                    background: `${b.color}20`,
                    color: b.color,
                    outline: `1px solid ${b.color}35`,
                    border: "none",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Badges */}
          <div>
            <div className="mb-2 text-[11px] text-muted-foreground">الحالات (Badges)</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "نشط", color: "#10B981" },
                { label: "معلق", color: "#F59E0B" },
                { label: "عاجل", color: "#EF4444" },
                { label: "تفاوض", color: "#8B5CF6" },
                { label: "قيد التواصل", color: "var(--primary)" },
              ].map((b, i) => (
                <span
                  key={i}
                  className="cc-badge"
                  style={{ background: `${b.color}25`, color: b.color }}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* Progress Bars */}
          <div>
            <div className="mb-2 text-[11px] text-muted-foreground">أشرطة التقدم</div>
            <div className="space-y-2">
              {[
                { label: "ممتاز (100%)", w: 100, color: "#10B981" },
                { label: "جيد (72%)", w: 72, color: "var(--primary)" },
                { label: "تحسين (45%)", w: 45, color: "#F59E0B" },
                { label: "متأخر (18%)", w: 18, color: "#EF4444" },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-[11px] text-muted-foreground">{p.label}</div>
                  <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${p.w}%`, background: p.color }}
                    />
                  </div>
                  <span className="w-8 text-left text-[11px] font-bold" style={{ color: p.color }}>
                    {p.w}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Mini KPI cards */}
          <div>
            <div className="mb-2 text-[11px] text-muted-foreground">بطاقة KPI نموذجية</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "الإيراد الشهري", value: "3.4M", color: "#10B981", icon: "💰" },
                { label: "عملاء نشطون", value: "1,247", color: "var(--primary)", icon: "👥" },
                { label: "Win Rate", value: "34%", color: "#8B5CF6", icon: "📈" },
                { label: "تذاكر مفتوحة", value: "43", color: "#F59E0B", icon: "🎫" },
              ].map((k, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden rounded-[12px] border bg-card/50 p-3"
                  style={{ borderColor: `${k.color}30` }}
                >
                  <div
                    className="pointer-events-none absolute -top-2.5 -right-2.5 h-10 w-10 rounded-full opacity-[0.08]"
                    style={{ background: k.color }}
                  />
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-base">{k.icon}</span>
                    <span
                      className="rounded-full px-1.5 py-px text-[10px] font-bold"
                      style={{ background: "#10B98120", color: "#10B981" }}
                    >
                      +12%
                    </span>
                  </div>
                  <div className="font-mono text-lg font-extrabold" style={{ color: k.color }}>
                    {k.value}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
