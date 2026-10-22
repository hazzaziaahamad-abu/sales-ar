"use client";

// عناصر واجهة مشتركة لغرفة التخطيط والتنفيذ (نفس هوية «الخطة التسويقية للصالونات»).

import React, { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

export const LOCALE = "ar-SA-u-ca-gregory";
export const fmt = (n: number) => Math.round(n).toLocaleString(LOCALE);
export const GOLD = "#D4AF37";

export type ThemeKey = "brand" | "night";
export const THEMES: Record<ThemeKey, Record<string, string>> = {
  brand: {
    "--bg": "#FAF5EF", "--surface": "#FFFFFF", "--surface-2": "#F5ECE2", "--hover": "#F3E8DC",
    "--line": "#EADDCF", "--line-strong": "#D8C5B2", "--ink": "#2A1018", "--body": "#4B3840",
    "--muted": "#7A6570", "--faint": "#A8939B", "--glass": "rgba(253,251,247,.9)",
    "--shadow": "0 1px 2px rgba(42,16,24,.04), 0 14px 34px -18px rgba(74,21,37,.22)",
    "--acc": "#581845", "--acc-deep": "#4A1525", "--on-acc": "#FFFFFF", "--rose": "#C76B8A",
  },
  night: {
    "--bg": "#14080D", "--surface": "rgba(255,255,255,.035)", "--surface-2": "rgba(255,255,255,.065)", "--hover": "rgba(255,255,255,.06)",
    "--line": "rgba(255,255,255,.09)", "--line-strong": "rgba(255,255,255,.2)", "--ink": "#FFF7F0", "--body": "#E6D6DA",
    "--muted": "#B39EA6", "--faint": "#7F6A72", "--glass": "rgba(20,8,13,.85)", "--shadow": "none",
    "--acc": "#E0A96D", "--acc-deep": "#A9683A", "--on-acc": "#2A1018", "--rose": "#E58FAE",
  },
};

export const card = "rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-[var(--on-acc)] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--body)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-50";
export const accGrad = { background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" };
export const input =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)] disabled:opacity-60";

/** YYYY-MM-DD بتوقيت الجهاز. */
export function todayKey(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export const addDaysKey = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return todayKey(new Date(y, m - 1, d + n).getTime());
};
export function dateLabel(key: string | null, withDay = false) {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(LOCALE, withDay ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "short" });
}
export const timeAgo = (iso: string) => {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `قبل ${fmt(mins)} د`;
  const h = Math.round(mins / 60);
  if (h < 24) return `قبل ${fmt(h)} س`;
  return new Date(iso).toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
};

export function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]">
      {children}
    </button>
  );
}

export function Avatar({ name, size = 32 }: { name: string | null; size?: number }) {
  const initials = (name ?? "؟").split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span className="grid shrink-0 place-items-center rounded-full font-black text-[var(--on-acc)]" style={{ width: size, height: size, fontSize: size * 0.38, background: "linear-gradient(135deg, var(--rose), var(--acc))" }} title={name ?? ""}>
      {initials}
    </span>
  );
}

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>{children}</span>;
}

export function Field({ label, children, group }: { label: string; children: React.ReactNode; group?: boolean }) {
  // group: مجموعة أزرار — div مع role=group بدل label (الـ label يضغط أول زر لو ضغطت على العنوان)
  if (group) {
    return (
      <div role="group" aria-label={label}>
        <span className="mb-1 block text-xs font-bold text-[var(--muted)]">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

export function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--line-strong)] p-8 text-center">
      <Icon size={26} className="text-[var(--faint)]" />
      <div className="mt-2 text-sm font-bold text-[var(--muted)]">{text}</div>
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}><Icon size={15} /></span>
      <h3 className="flex-1 text-base font-black text-[var(--ink)]">{title}</h3>
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`${card} sr-in max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-lg"} overflow-y-auto !bg-[var(--bg)] p-5 sm:p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[var(--ink)]">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)]" aria-label="إغلاق"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
