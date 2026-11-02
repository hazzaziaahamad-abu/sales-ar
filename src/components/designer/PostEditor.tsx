"use client";

import { useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, GripVertical, ImagePlus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageSlot, PostData } from "@/lib/package-posts/types";
import { GOLD_PRESETS, PURPLE_PRESETS } from "@/lib/package-posts/types";
import { makeDefaultPost } from "@/lib/package-posts/defaults";
import { FLOW_KEY, type FitWarnings } from "./measure";
import { fileToDataUrl } from "./export";

// ─── عناصر الإدخال ───────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-border bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20";

function Warn({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {msg}
    </p>
  );
}

function Field({
  label, value, onChange, warn, multiline, dirLtr, numeric, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; warn?: string;
  multiline?: boolean; dirLtr?: boolean; numeric?: boolean; hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "resize-y leading-relaxed", warn && "border-amber-400/60")} />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(numeric ? e.target.value.replace(/[^\d.,]/g, "") : e.target.value)}
          inputMode={numeric ? "decimal" : undefined}
          dir={dirLtr || numeric ? "ltr" : undefined}
          className={cn(inputCls, (dirLtr || numeric) && "text-left", warn && "border-amber-400/60")}
        />
      )}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
      <Warn msg={warn} />
    </label>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card/60">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold">
        {title}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-3 border-t border-border px-4 py-3">{children}</div>}
    </div>
  );
}

/** قائمة نصوص: إضافة، حذف، ترتيب بالسحب (وأسهم للجوال). */
function ListEditor({
  items, onChange, warnKey, warnings, addLabel = "إضافة ميزة",
}: { items: string[]; onChange: (v: string[]) => void; warnKey: string; warnings: FitWarnings; addLabel?: string }) {
  const dragFrom = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const warn = warnings[`${warnKey}.${i}`];
        return (
          <div
            key={i}
            draggable
            onDragStart={(e) => { dragFrom.current = i; e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => { e.preventDefault(); if (dragFrom.current !== null) move(dragFrom.current, i); dragFrom.current = null; setOver(null); }}
            onDragEnd={() => { dragFrom.current = null; setOver(null); }}
            className={cn("rounded-lg", over === i && "ring-2 ring-violet-400/60")}
          >
            <div className="flex items-center gap-1.5">
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
              <input value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className={cn(inputCls, "py-1.5", warn && "border-amber-400/60")} />
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="لفوق"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="لتحت"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:text-rose-400" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="pr-6"><Warn msg={warn} /></div>
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...items, ""])} className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

function ColorPicker({ label, value, presets, onChange }: { label: string; value: string; presets: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((c) => (
          <button
            key={c} type="button" onClick={() => onChange(c)} title={c}
            className={cn("h-8 w-8 rounded-full border-2 transition-transform", value.toLowerCase() === c.toLowerCase() ? "scale-110 border-white" : "border-transparent")}
            style={{ background: c }}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
        <span dir="ltr" className="font-mono text-xs text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-16 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-violet-500" />
      <span dir="ltr" className="w-10 text-left font-mono">{step < 1 ? value.toFixed(2) : value}</span>
    </label>
  );
}

function ImageSlotEditor({
  label, slot, fallback, onChange, onError,
}: { label: string; slot?: ImageSlot; fallback?: ImageSlot; onChange: (s: ImageSlot | undefined) => void; onError: (m: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const s = slot ?? fallback ?? { src: "", x: 50, y: 50, zoom: 1, fit: "contain" as const };
  const isUpload = s.src.startsWith("data:");
  const set = (patch: Partial<ImageSlot>) => onChange({ ...s, ...patch });
  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold">{label}</span>
        <span dir="ltr" className="truncate text-[11px] text-muted-foreground">{isUpload ? "صورة مرفوعة" : s.src.split("/").pop()}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/30 disabled:opacity-50">
          <ImagePlus className="h-3.5 w-3.5" /> {busy ? "جاري التجهيز…" : isUpload ? "استبدال الصورة" : "رفع صورة"}
        </button>
        {isUpload && fallback && (
          <button type="button" onClick={() => onChange({ ...fallback })} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            الرجوع للصورة الافتراضية
          </button>
        )}
        <select value={s.fit} onChange={(e) => set({ fit: e.target.value as ImageSlot["fit"] })} className="rounded-lg border border-border bg-transparent px-2 py-1 text-xs">
          <option value="contain">احتواء كامل</option>
          <option value="cover">تعبئة الخانة</option>
        </select>
      </div>
      <input
        ref={fileRef} type="file" accept="image/*" hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try { set({ src: await fileToDataUrl(f), x: 50, y: 50, zoom: 1 }); }
          catch { onError("تعذّر قراءة الصورة"); }
          finally { setBusy(false); }
        }}
      />
      <Slider label="أفقي" value={s.x} min={0} max={100} step={1} onChange={(x) => set({ x })} />
      <Slider label="عمودي" value={s.y} min={0} max={100} step={1} onChange={(y) => set({ y })} />
      <Slider label="تكبير" value={s.zoom} min={1} max={2} step={0.05} onChange={(zoom) => set({ zoom })} />
    </div>
  );
}

// ─── لوحة التعديل ─────────────────────────────────────────────────────────────

export function PostEditor({
  post, onChange, warnings, onError,
}: { post: PostData; onChange: (p: PostData) => void; warnings: FitWarnings; onError: (m: string) => void }) {
  const set = <K extends keyof PostData>(k: K, v: PostData[K]) => onChange({ ...post, [k]: v });
  const defaults = makeDefaultPost(post.template);
  const t = post.template;
  const isVip = t === "vip" || t === "vipPlus";

  return (
    <div className="space-y-3">
      {warnings[FLOW_KEY] && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {warnings[FLOW_KEY]}
        </div>
      )}

      <Section title="عام">
        <Field label="اسم البوست (داخلي)" value={post.title} onChange={(v) => set("title", v)} />
        <ColorPicker label="البنفسجي" value={post.colors.purple} presets={PURPLE_PRESETS} onChange={(v) => set("colors", { ...post.colors, purple: v })} />
        <ColorPicker label="الذهبي" value={post.colors.gold} presets={GOLD_PRESETS} onChange={(v) => set("colors", { ...post.colors, gold: v })} />
      </Section>

      {t !== "cashier" ? (
        <Section title="الباقة والسعر">
          <Field label="اسم الباقة" value={post.packageName} onChange={(v) => set("packageName", v)} warn={warnings.packageName} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="السعر" numeric value={post.price} onChange={(v) => set("price", v)} warn={warnings.price} />
            <Field label="وحدة السعر" value={post.priceUnit} onChange={(v) => set("priceUnit", v)} />
          </div>
        </Section>
      ) : (
        <Section title="العناوين">
          <Field label="العنوان الذهبي" value={post.headline ?? ""} onChange={(v) => set("headline", v)} warn={warnings.headline} />
          <Field label="السطر الأبيض" value={post.banner ?? ""} onChange={(v) => set("banner", v)} warn={warnings.banner} />
          <Field label="الكبسولة — الجزء الذهبي" value={post.badge?.strong ?? ""} onChange={(v) => set("badge", { text: post.badge?.text ?? "", strong: v })} warn={warnings.badge} />
          <Field label="الكبسولة — الوصف" value={post.badge?.text ?? ""} onChange={(v) => set("badge", { strong: post.badge?.strong ?? "", text: v })} />
          <Field label="زر التواصل" value={post.cta ?? ""} onChange={(v) => set("cta", v)} warn={warnings.cta} />
        </Section>
      )}

      {t === "basic" && (
        <Section title="النصوص">
          <Field label="سطر الوصف" value={post.headline ?? ""} onChange={(v) => set("headline", v)} warn={warnings.headline} />
          <Field label="الشريط البنفسجي" value={post.banner ?? ""} onChange={(v) => set("banner", v)} warn={warnings.banner} />
          <Field label="مقدمة المزايا" value={post.intro ?? ""} onChange={(v) => set("intro", v)} warn={warnings.intro} />
        </Section>
      )}

      {isVip && (
        <Section title="الفقرة">
          <Field multiline label="نص الفقرة" value={post.intro ?? ""} onChange={(v) => set("intro", v)} warn={warnings.intro} hint="حط النص اللي تبيه بنفسجي بين [[ و ]]" />
        </Section>
      )}

      {t !== "cashier" && (
        <Section title={`المزايا (${post.features.length})`}>
          <ListEditor items={post.features} onChange={(v) => set("features", v)} warnKey="features" warnings={warnings} />
        </Section>
      )}

      {isVip && post.side && (
        <Section title="العمود الجانبي">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">النوع</span>
            <select value={post.side.variant} onChange={(e) => set("side", { ...post.side!, variant: e.target.value as "loyalty" | "addons" })} className={inputCls}>
              <option value="loyalty">مزايا الولاء (مع صورة)</option>
              <option value="addons">مزايا مخصصة (صندوق بنفسجي)</option>
            </select>
          </label>
          <Field label="العنوان" value={post.side.title} onChange={(v) => set("side", { ...post.side!, title: v })} warn={warnings["side.title"]} />
          <ListEditor items={post.side.items} onChange={(v) => set("side", { ...post.side!, items: v })} warnKey="side.items" warnings={warnings} addLabel="إضافة بند" />
        </Section>
      )}

      {t === "cashier" && (
        <Section title="كروت الأسعار">
          {(post.cards ?? []).map((c, i) => {
            const upd = (patch: Partial<typeof c>) => set("cards", (post.cards ?? []).map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="space-y-2 rounded-lg border border-border/70 p-3">
                <Field label={`عنوان الكرت ${i + 1}`} value={c.title} onChange={(v) => upd({ title: v })} warn={warnings[`cards.${i}.title`]} />
                <Field multiline label="الوصف" value={c.desc} onChange={(v) => upd({ desc: v })} warn={warnings[`cards.${i}.desc`]} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="السعر" numeric value={c.price} onChange={(v) => upd({ price: v })} warn={warnings[`cards.${i}.price`]} />
                  <Field label="الوحدة" value={c.unit} onChange={(v) => upd({ unit: v })} />
                </div>
              </div>
            );
          })}
        </Section>
      )}

      <Section title="الصور" defaultOpen={false}>
        <ImageSlotEditor
          label={t === "cashier" ? "صورة جهاز الكاشير" : "صورة الجوال"}
          slot={post.images.hero} fallback={defaults.images.hero}
          onChange={(s) => set("images", { ...post.images, hero: s })} onError={onError}
        />
        {isVip && post.side?.variant === "loyalty" && (
          <ImageSlotEditor
            label="صورة بطاقة الولاء"
            slot={post.images.side} fallback={makeDefaultPost("vip").images.side}
            onChange={(s) => set("images", { ...post.images, side: s })} onError={onError}
          />
        )}
      </Section>

      <Section title="التواصل" defaultOpen={false}>
        <Field label="واتساب" dirLtr value={post.contact.whatsapp} onChange={(v) => set("contact", { ...post.contact, whatsapp: v })} />
        <Field label="الحسابات" dirLtr value={post.contact.handle} onChange={(v) => set("contact", { ...post.contact, handle: v })} />
        {t === "cashier" && <Field label="الهاتف الموحّد" dirLtr value={post.contact.phone} onChange={(v) => set("contact", { ...post.contact, phone: v })} />}
      </Section>

      <button
        type="button"
        onClick={() => { if (confirm("ترجيع كل نصوص هذا البوست للمحتوى الافتراضي للقالب؟")) onChange({ ...makeDefaultPost(post.template), id: post.id, title: post.title }); }}
        className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" /> ترجيع المحتوى الافتراضي للقالب
      </button>
    </div>
  );
}
