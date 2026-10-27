"use client";

// محرّر ملاحظات بشكل دفتر مسطّر مع قلم تظليل (أصفر، وردي، أخضر، أزرق، برتقالي) وخط عريض.
// التخزين نص عادي بعلامات بسيطة — {{y:نص مظلّل}} و **نص عريض** — ما نخزّن HTML أبداً:
// العرض يبني HTML من النص بعد الهروب، والتحرير يقرأ الـDOM ويرجّعه لنفس العلامات.

import React, { useEffect, useRef } from "react";
import { Bold, Eraser } from "lucide-react";

export const HIGHLIGHTS = [
  { id: "y", hex: "#fde68a", label: "أصفر" },
  { id: "p", hex: "#fbcfe8", label: "وردي" },
  { id: "g", hex: "#bbf7d0", label: "أخضر" },
  { id: "b", hex: "#bfdbfe", label: "أزرق" },
  { id: "o", hex: "#fed7aa", label: "برتقالي" },
] as const;
type HighlightId = (typeof HIGHLIGHTS)[number]["id"];

const hexOf = (id: string) => HIGHLIGHTS.find((h) => h.id === id)?.hex ?? HIGHLIGHTS[0].hex;
const rgbKey = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
const BY_RGB = new Map<string, HighlightId>(HIGHLIGHTS.map((h) => [rgbKey(h.hex), h.id]));

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MARK_RE = /\{\{([ypgbo]):([\s\S]*?)\}\}/g;
const BOLD_RE = /\*\*([^*\n]+?)\*\*/g;

/** النص المعلّم → HTML آمن (كل نص المستخدم يمر بالهروب أولاً). */
export function noteToHtml(v: string) {
  return escapeHtml(v ?? "")
    .replace(MARK_RE, (_, c: string, t: string) => `<span style="background-color: ${hexOf(c)}">${t}</span>`)
    .replace(BOLD_RE, "<b>$1</b>")
    .replace(/\n/g, "<br>");
}

/** للنسخ (واتساب): المظلّل والعريض يصيرون *عريض*، أو نص بدون علامات. */
export function noteToPlain(v: string, whatsapp = true) {
  const wrap = (t: string) => (whatsapp && t.trim() ? `*${t.trim()}*` : t);
  return (v ?? "")
    .replace(MARK_RE, (_, _c: string, t: string) => wrap(t.replace(BOLD_RE, "$1")))
    .replace(BOLD_RE, (_, t: string) => wrap(t));
}

/* ─── DOM → علامات ─── */

type Seg = { t: string; c: HighlightId | null; b: boolean };

function colorOf(bg: string, inherited: HighlightId | null): HighlightId | null {
  if (!bg) return inherited;
  if (bg === "transparent" || /rgba\(.*,\s*0\)$/.test(bg)) return null;
  const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (m) return BY_RGB.get(`${m[1]},${m[2]},${m[3]}`) ?? "y";
  const hex = bg.startsWith("#") && bg.length === 7 ? BY_RGB.get(rgbKey(bg)) : null;
  return hex ?? "y";
}

function walk(node: Node, c: HighlightId | null, b: boolean, out: Seg[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    out.push({ t: (node as Text).data.replace(/ /g, " "), c, b });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === "BR") { out.push({ t: "\n", c: null, b: false }); return; }
  const block = tag === "DIV" || tag === "P" || tag === "LI";
  const endsNl = () => !out.length || out[out.length - 1].t.endsWith("\n");
  if (block && !endsNl()) out.push({ t: "\n", c: null, b: false });
  const cc = tag === "MARK" ? (colorOf(el.style.backgroundColor, null) ?? "y") : colorOf(el.style.backgroundColor, c);
  const fw = el.style.fontWeight;
  const bb = tag === "B" || tag === "STRONG" || fw === "bold" || Number(fw) >= 600 ? true : fw === "normal" || fw === "400" ? false : b;
  el.childNodes.forEach((ch) => walk(ch, cc, bb, out));
  // سطر جديد داخل كتلة فاضية (<div><br></div>) انحسب من الـBR
  if (block && !endsNl() && el.nextSibling) out.push({ t: "\n", c: null, b: false });
}

export function serializeNote(root: HTMLElement) {
  const segs: Seg[] = [];
  root.childNodes.forEach((ch) => walk(ch, null, false, segs));
  // دمج المتجاور بنفس التنسيق، وتقسيم الأسطر عشان العلامات ما تمتد بين الأسطر
  const merged: Seg[] = [];
  for (const s of segs) {
    for (const [i, piece] of s.t.split("\n").entries()) {
      if (i > 0) merged.push({ t: "\n", c: null, b: false });
      if (!piece) continue;
      const last = merged[merged.length - 1];
      if (last && last.t !== "\n" && last.c === s.c && last.b === s.b) last.t += piece;
      else merged.push({ t: piece, c: s.c, b: s.b });
    }
  }
  return merged.map((s) => {
    if (s.t === "\n" || !s.t.trim()) return s.t;
    const lead = s.t.match(/^\s*/)![0], trail = s.t.match(/\s*$/)![0], core = s.t.trim();
    let out = s.b ? `**${core}**` : core;
    if (s.c) out = `{{${s.c}:${out}}}`;
    return lead + out + trail;
  }).join("").replace(/\s+$/, "");
}

/* ─── المحرّر ─── */

export function NoteEditor({ value, onChange, placeholder, label, minLines = 3, variant = "paper" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; label: string; minLines?: number;
  /** paper: دفتر مسطّر — bare: بدون خلفية (فوق ورقة ملوّنة) */
  variant?: "paper" | "bare";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const saved = useRef<Range | null>(null);

  // نحدّث المحتوى بس لو القيمة تغيّرت من برّا (تحميل، زميلة عدّلت) — مو مع كل حرف
  useEffect(() => {
    const el = ref.current;
    if (el && value !== emitted.current) {
      el.innerHTML = noteToHtml(value);
      emitted.current = value;
    }
  }, [value]);

  // نحفظ آخر تحديد داخل المحرّر عشان أزرار القلم تشتغل حتى لو الجوال شال التركيز
  useEffect(() => {
    const onSel = () => {
      const sel = document.getSelection();
      if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, []);

  const emit = () => {
    if (!ref.current) return;
    const v = serializeNote(ref.current);
    if (v === emitted.current) return;
    emitted.current = v;
    onChange(v);
  };

  const run = (cmd: "hiliteColor" | "bold", arg?: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = document.getSelection();
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current); }
    document.execCommand("styleWithCSS", false, "true");
    if (cmd === "hiliteColor" && !document.execCommand("hiliteColor", false, arg)) document.execCommand("backColor", false, arg);
    if (cmd === "bold") document.execCommand("bold");
    emit();
  };
  const keep = (e: React.SyntheticEvent) => e.preventDefault();

  const lh = 30;
  return (
    <div className={variant === "paper" ? "nb-wrap overflow-hidden rounded-2xl border border-[var(--line)]" : ""}>
      <style>{NOTE_CSS}</style>
      <div className={`flex flex-wrap items-center gap-1 ${variant === "paper" ? "border-b border-[var(--line)] bg-[var(--surface)] px-2 py-1.5" : "mb-1.5"}`} role="toolbar" aria-label={`أدوات ${label}`}>
        {HIGHLIGHTS.map((h) => (
          <button key={h.id} type="button" onMouseDown={keep} onPointerDown={keep} onClick={() => run("hiliteColor", h.hex)}
            className="nb-dot" style={{ background: h.hex }} title={`تظليل ${h.label}`} aria-label={`تظليل ${h.label}`} />
        ))}
        <span className="mx-0.5 h-4 w-px bg-[var(--line)]" />
        <button type="button" onMouseDown={keep} onPointerDown={keep} onClick={() => run("hiliteColor", "transparent")} className="nb-tool" title="إزالة التظليل" aria-label="إزالة التظليل"><Eraser size={14} /></button>
        <button type="button" onMouseDown={keep} onPointerDown={keep} onClick={() => run("bold")} className="nb-tool" title="عريض" aria-label="عريض"><Bold size={14} /></button>
        <span className="ms-auto hidden text-[10px] text-[var(--faint)] sm:inline">ظلّلي النص وبعدين اختاري اللون</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder={placeholder ?? ""}
        data-empty={!value ? "true" : "false"}
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }}
        className={`nb-edit ${variant === "paper" ? "nb-paper" : "nb-bare"}`}
        style={{ minHeight: minLines * lh + (variant === "paper" ? 16 : 0), lineHeight: `${lh}px` }}
      />
    </div>
  );
}

/** عرض فقط (الاستكر، المحاضر). */
export function NoteView({ value, className }: { value: string; className?: string }) {
  return <div className={`nb-view ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: noteToHtml(value) }} />;
}

const NOTE_CSS = `
.nb-dot { width:20px; height:20px; border-radius:50%; border:2px solid rgba(0,0,0,.08); transition: transform .15s ease; }
.nb-dot:hover { transform: scale(1.18); }
.nb-tool { display:grid; place-items:center; width:26px; height:26px; border-radius:8px; color:var(--muted); }
.nb-tool:hover { background:var(--hover); color:var(--ink); }
.nb-edit { outline:none; white-space:pre-wrap; word-break:break-word; font-size:14px; color:var(--ink); }
.nb-edit[data-empty="true"]:empty::before { content: attr(data-placeholder); color: var(--faint); pointer-events:none; }
.nb-paper { padding:8px 44px 8px 14px; background-color: color-mix(in srgb, var(--surface) 92%, #fffdf5);
  background-image:
    linear-gradient(to left, transparent 32px, rgba(220,38,38,.28) 32px, rgba(220,38,38,.28) 33px, transparent 33px),
    repeating-linear-gradient(to bottom, transparent 0, transparent 29px, color-mix(in srgb, var(--line-strong) 70%, transparent) 29px, color-mix(in srgb, var(--line-strong) 70%, transparent) 30px);
  background-position: 0 0, 0 8px; background-attachment: local; }
.nb-bare { color: inherit; }
.nb-edit span[style*="background"], .nb-view span[style*="background"] {
  border-radius:6px; padding:1px 3px; -webkit-box-decoration-break:clone; box-decoration-break:clone; color:#2A1018; }
.nb-edit span[style*="transparent"] { padding:0; color:inherit; }
.nb-view { white-space:normal; word-break:break-word; }
`;
